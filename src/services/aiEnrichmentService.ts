import { callGroqAPI, safeParseAIJSON, aiCircuitBreaker } from './aiService';
import { supabase } from '@/lib/supabase';
import { AiUsageMonitoringService } from './aiUsageMonitoringService';
import type { ParsedQuestionItem } from '../lib/csvQuestionParser';

/**
 * Normalizes any input payload into a guaranteed array of ParsedQuestionItem.
 * Protects against runtime TypeError: e.filter is not a function.
 */
export function normalizeQuestionsPayload(payload: any): ParsedQuestionItem[] {
  if (!payload) return [];

  let rawList: any[] = [];
  if (Array.isArray(payload)) {
    rawList = payload;
  } else if (typeof payload === 'object') {
    if (Array.isArray(payload.validQuestions)) {
      rawList = payload.validQuestions;
    } else if (Array.isArray(payload.questions)) {
      rawList = payload.questions;
    } else if (Array.isArray(payload.items)) {
      rawList = payload.items;
    } else if (Array.isArray(payload.data)) {
      rawList = payload.data;
    } else if (Array.isArray(payload.rows)) {
      rawList = payload.rows;
    } else if (payload.questionText || payload.question) {
      rawList = [payload];
    } else {
      // Look for any array property
      const firstArrayProp = Object.values(payload).find(v => Array.isArray(v));
      if (Array.isArray(firstArrayProp)) {
        rawList = firstArrayProp;
      }
    }
  }

  // Rigorous type-checking and sanitization for each item
  return rawList
    .filter(item => item && typeof item === 'object')
    .map((item, index) => {
      const rowNumber = typeof item.rowNumber === 'number' ? item.rowNumber : (typeof item.row === 'number' ? item.row : index + 1);
      const questionText = String(item.questionText || item.question || item.text || '').trim();
      const subjectName = String(item.subjectName || item.subject || 'General').trim();
      const options = item.options && typeof item.options === 'object' ? item.options : {
        A: String(item.option_a || item.optionA || 'A').trim(),
        B: String(item.option_b || item.optionB || 'B').trim(),
        C: String(item.option_c || item.optionC || 'C').trim(),
        D: String(item.option_d || item.optionD || 'D').trim(),
      };
      const correctAnswer = String(item.correctAnswer || item.correct_answer || item.answer || 'A').trim().toUpperCase();
      const explanation = item.explanation ? String(item.explanation).trim() : undefined;
      const year = item.year && !isNaN(Number(item.year)) ? Number(item.year) : undefined;
      const topicName = item.topicName || item.topic ? String(item.topicName || item.topic).trim() : undefined;
      const difficulty = ['easy', 'medium', 'hard'].includes(String(item.difficulty).toLowerCase())
        ? (String(item.difficulty).toLowerCase() as 'easy' | 'medium' | 'hard')
        : undefined;

      return {
        rowNumber,
        subjectName,
        questionText,
        options,
        correctAnswer,
        explanation,
        year,
        topicName,
        difficulty
      } as ParsedQuestionItem;
    });
}

/**
 * Executes an AI call with exponential backoff and circuit breaker safety.
 */
async function executeWithRetryAndBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T | null> {
  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxRetries) {
    attempt++;

    // Check circuit breaker state
    if (!aiCircuitBreaker.canAttempt()) {
      console.warn(`[AI Enrichment] Circuit breaker is OPEN. Skipping attempt ${attempt}/${maxRetries}.`);
      return null;
    }

    try {
      const result = await fn();
      aiCircuitBreaker.recordSuccess();
      return result;
    } catch (err: any) {
      console.warn(`[AI Enrichment] Attempt ${attempt}/${maxRetries} failed:`, err?.message || err);
      aiCircuitBreaker.recordFailure();

      if (attempt >= maxRetries) {
        break;
      }

      // Exponential backoff delay with jitter
      const jitter = Math.random() * 200;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      delay *= 2;
    }
  }

  return null;
}

export interface IncompleteFieldStats {
  total: number;
  missingExplanation: number;
  missingTopic: number;
  missingYear: number;
  missingDifficulty: number;
  hasIncomplete: boolean;
}

export class AiEnrichmentEngine {
  /**
   * Scans questions to detect missing column fields
   */
  public static scanQuestions(questions: any[]): IncompleteFieldStats {
    const list = normalizeQuestionsPayload(questions);
    let missingExp = 0;
    let missingTop = 0;
    let missingYr = 0;
    let missingDiff = 0;

    list.forEach(q => {
      if (!q.explanation || q.explanation.trim().length < 5) missingExp++;
      if (!q.topicName || q.topicName.trim().length < 2) missingTop++;
      if (!q.year) missingYr++;
      if (!q.difficulty) missingDiff++;
    });

    const hasIncomplete = (missingExp + missingTop + missingYr + missingDiff) > 0;

    return {
      total: list.length,
      missingExplanation: missingExp,
      missingTopic: missingTop,
      missingYear: missingYr,
      missingDifficulty: missingDiff,
      hasIncomplete
    };
  }

  /**
   * Automatically enriches incomplete questions and directly updates the Supabase database
   */
  public static async autoEnrichAndUpsertToDatabase(
    incompleteDbQuestions: Array<{ id: string; question_text: string; correct_answer?: string; subject_id?: string; subject_name?: string; options?: any }>,
    onProgress?: (processed: number, total: number, message: string) => void
  ): Promise<{ updatedCount: number; failedCount: number }> {
    if (!Array.isArray(incompleteDbQuestions) || incompleteDbQuestions.length === 0) {
      return { updatedCount: 0, failedCount: 0 };
    }

    const parsedItems: ParsedQuestionItem[] = incompleteDbQuestions.map((q, idx) => ({
      rowNumber: idx + 1,
      subjectName: q.subject_name || 'General',
      topicName: '',
      questionText: q.question_text,
      options: Array.isArray(q.options) ? q.options : (typeof q.options === 'object' ? q.options : {}),
      correctAnswer: q.correct_answer || 'A',
      explanation: '',
      year: 2023,
      difficulty: 'medium'
    }));

    const enriched = await enrichQuestionsBatchWithAI(parsedItems, 20, onProgress);

    let updatedCount = 0;
    let failedCount = 0;

    for (const item of enriched) {
      const orig = incompleteDbQuestions[item.rowNumber - 1];
      if (orig && orig.id) {
        try {
          const updatePayload: Record<string, any> = {};
          if (item.explanation) updatePayload.explanation = item.explanation;
          if (item.year) updatePayload.year = item.year;
          if (item.difficulty) updatePayload.difficulty = item.difficulty;

          const { error } = await supabase
            .from('questions')
            .update(updatePayload)
            .eq('id', orig.id);

          if (!error) {
            updatedCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }
    }

    return { updatedCount, failedCount };
  }
}

export interface AiUsageHealth {
  isOperational: boolean;
  circuitState: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  estimatedCallsRemaining: number;
  totalCallsMade: number;
  usagePercentage: number;
  isLowQuota: boolean;
  statusMessage: string;
}

// In-memory / session tracking of AI calls to monitor quota & notify
let aiSessionCallsCount = 0;
const ESTIMATED_DAILY_QUOTA = 500; // standard daily rate-limit budget

export function recordAiUsageCall(count = 1) {
  aiSessionCallsCount += count;
  try {
    const saved = Number(sessionStorage.getItem('ai_session_calls_count') || 0);
    sessionStorage.setItem('ai_session_calls_count', String(saved + count));
  } catch {}
  AiUsageMonitoringService.recordUsage(count * 400, count);
}

export function getAiUsageHealthStatus(): AiUsageHealth {
  let storedCalls = aiSessionCallsCount;
  try {
    storedCalls = Number(sessionStorage.getItem('ai_session_calls_count') || aiSessionCallsCount);
  } catch {}

  const canAttempt = aiCircuitBreaker.canAttempt();
  const state = aiCircuitBreaker.getState();
  const remaining = Math.max(0, ESTIMATED_DAILY_QUOTA - storedCalls);
  const usagePercentage = Math.min(100, Math.round((storedCalls / ESTIMATED_DAILY_QUOTA) * 100));
  const isLowQuota = remaining <= 50 || usagePercentage >= 90;

  let statusMessage = 'AI Engine Healthy & Ready';
  if (!canAttempt || state === 'OPEN') {
    statusMessage = 'AI Service temporarily rate-limited. Circuit breaker active (resets in 30s).';
  } else if (isLowQuota) {
    statusMessage = `Warning: High AI usage (${usagePercentage}%). ${remaining} calls remaining in current quota window.`;
  }

  return {
    isOperational: canAttempt && state !== 'OPEN',
    circuitState: state,
    estimatedCallsRemaining: remaining,
    totalCallsMade: storedCalls,
    usagePercentage,
    isLowQuota,
    statusMessage
  };
}

export function notifyAiUsageIfApproachingLimit(): void {
  const health = getAiUsageHealthStatus();
  if (health.isLowQuota && typeof window !== 'undefined') {
    console.warn(`[AI Usage Notification] ${health.statusMessage}`);
  }
}

export async function enrichQuestionsBatchWithAI(
  questionsInput: any,
  batchSize = 20,
  onProgress?: (processed: number, total: number, message: string) => void
): Promise<ParsedQuestionItem[]> {
  // 1. Force input payload into a validated array
  const safeQuestions = normalizeQuestionsPayload(questionsInput);

  if (safeQuestions.length === 0) {
    return [];
  }

  // Check quota status and notify if approaching limit
  notifyAiUsageIfApproachingLimit();

  const enriched = [...safeQuestions];
  const incompleteItems = enriched.filter(q => !q.explanation || !q.year || !q.topicName);

  if (incompleteItems.length === 0) {
    return enriched;
  }

  let processedCount = 0;
  const totalIncomplete = incompleteItems.length;

  for (let i = 0; i < enriched.length; i += batchSize) {
    const chunk = enriched.slice(i, i + batchSize);
    const chunkIncomplete = chunk.filter(q => !q.explanation || !q.year || !q.topicName);

    if (chunkIncomplete.length === 0) {
      processedCount += chunk.length;
      continue;
    }

    onProgress?.(
      processedCount,
      totalIncomplete,
      `AI Enriching batch ${Math.floor(i / batchSize) + 1} (${chunkIncomplete.length} items)...`
    );

    const hasMathOrScience = chunkIncomplete.some(q => {
      const sub = (q.subjectName || '').toLowerCase();
      return sub.includes('math') || sub.includes('physic') || sub.includes('chem') || sub.includes('quant');
    });

    const prompt = `You are an expert curriculum AI specialist for Nigerian JAMB UTME CBT examination questions.
Task: For each question below, provide missing pedagogical explanations, syllabus topic names, UTME exam years, and difficulty.

${hasMathOrScience ? `SPECIAL INSTRUCTION FOR MATHEMATICS & SCIENCE:
- For Mathematics, Further Maths, Physics, and quantitative questions, provide rigorous step-by-step calculations and mathematical derivations.
- State the relevant formula, show algebraic substitutions clearly with LaTeX notation ($...$), and explain why the correct option is mathematically sound.
- Use clean mathematical formatting ($...$, $$...$$).` : ''}

Items to process:
${JSON.stringify(chunkIncomplete.map(q => ({
  row: q.rowNumber,
  subject: q.subjectName,
  question: q.questionText,
  options: q.options,
  correct: q.correctAnswer,
  hasExplanation: Boolean(q.explanation),
  hasYear: Boolean(q.year),
  hasTopic: Boolean(q.topicName)
})))}

Output MUST be a JSON array with objects matching this exact schema:
[
  {
    "row": number,
    "explanation": "Clear step-by-step pedagogical explanation or mathematical working with LaTeX proving why the chosen option is correct",
    "year": 2023,
    "topicName": "Standard curriculum topic/sub-topic name",
    "difficulty": "medium"
  }
]
Return ONLY a valid JSON array. Do not include markdown code block backticks.`;

    const aiRes = await executeWithRetryAndBackoff(async () => {
      recordAiUsageCall(1);
      return await callGroqAPI([{ role: 'user', content: prompt }], 'openai/gpt-oss-120b', 0.2);
    });

    if (aiRes) {
      try {
        const rawParsed = safeParseAIJSON<any>(aiRes, []);

        // Rigorous extraction: handles array or object wrappers { items: [...] }, { results: [...] }
        let parsedArray: Array<{ row: number; explanation?: string; year?: number; topicName?: string; difficulty?: string }> = [];
        if (Array.isArray(rawParsed)) {
          parsedArray = rawParsed;
        } else if (rawParsed && typeof rawParsed === 'object') {
          if (Array.isArray(rawParsed.items)) {
            parsedArray = rawParsed.items;
          } else if (Array.isArray(rawParsed.questions)) {
            parsedArray = rawParsed.questions;
          } else if (Array.isArray(rawParsed.results)) {
            parsedArray = rawParsed.results;
          } else if (Array.isArray(rawParsed.data)) {
            parsedArray = rawParsed.data;
          }
        }

        if (Array.isArray(parsedArray)) {
          for (const resItem of parsedArray) {
            if (!resItem || typeof resItem !== 'object') continue;
            const target = enriched.find(q => q.rowNumber === resItem.row);
            if (target) {
              if (!target.explanation && resItem.explanation) target.explanation = String(resItem.explanation).trim();
              if (!target.year && resItem.year && !isNaN(Number(resItem.year))) target.year = Number(resItem.year);
              if (!target.topicName && resItem.topicName) target.topicName = String(resItem.topicName).trim();
              if (resItem.difficulty && ['easy', 'medium', 'hard'].includes(String(resItem.difficulty).toLowerCase())) {
                target.difficulty = String(resItem.difficulty).toLowerCase() as any;
              }
            }
          }
        }
      } catch (parseErr) {
        console.warn('[AI Enrichment] Parse warning for batch chunk:', parseErr);
      }
    }

    processedCount += chunk.length;
    onProgress?.(processedCount, totalIncomplete, `Completed batch ${Math.floor(i / batchSize) + 1}`);
  }

  return enriched;
}

