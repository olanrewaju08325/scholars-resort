import { callGroqAPI, safeParseAIJSON, aiCircuitBreaker } from './aiService';
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

    const prompt = `You are an expert curriculum AI for Nigerian UTME CBT. For each question below, provide missing details in strict JSON array format.
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

Output MUST be a JSON array with objects matching:
[
  {
    "row": number,
    "explanation": "Clear step-by-step pedagogical rationale for the correct answer",
    "year": 2023,
    "topicName": "Standard curriculum sub-topic name",
    "difficulty": "medium"
  }
]
Return ONLY valid JSON array.`;

    const aiRes = await executeWithRetryAndBackoff(async () => {
      return await callGroqAPI([{ role: 'user', content: prompt }], 'openai/gpt-oss-120b', 0.3);
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
