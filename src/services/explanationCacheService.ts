import { supabase } from '@/lib/supabase';
import { callGroqAPI, stripThinkTags } from './aiService';

// In-memory cache for ultra-fast instant lookups during the session
const memCache = new Map<string, string>();

// Local storage key for persistent offline explanations
const LOCAL_STORAGE_KEY = 'jamb_explanations_cache_v2';

function getLocalStore(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToLocalStore(key: string, explanation: string) {
  try {
    memCache.set(key, explanation);
    const store = getLocalStore();
    store[key] = explanation;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('Could not save explanation locally:', err);
  }
}

/**
 * Creates a unique deterministic cache key for a question
 */
export function getQuestionKey(questionId?: string, questionText?: string): string {
  if (questionId && questionId.trim()) return `q_${questionId.trim()}`;
  if (questionText) {
    // Generate a simple hash of the question text
    let hash = 0;
    for (let i = 0; i < questionText.length; i++) {
      hash = ((hash << 5) - hash) + questionText.charCodeAt(i);
      hash |= 0;
    }
    return `q_hash_${Math.abs(hash)}`;
  }
  return `q_rand_${Date.now()}`;
}

export class ExplanationCacheService {
  /**
   * Retrieves an explanation with 0 AI tokens whenever available.
   * If not cached anywhere, generates it once via AI and permanently persists it to the database.
   */
  public static async getExplanation(params: {
    questionId?: string;
    questionText: string;
    correctAnswer: string;
    selectedAnswer?: string;
    existingExplanation?: string;
    options?: string[];
  }): Promise<string> {
    const { questionId, questionText, correctAnswer, selectedAnswer, existingExplanation } = params;

    // 1. Check existing explanation on object
    if (existingExplanation && existingExplanation.trim().length > 6 && !existingExplanation.includes('undefined')) {
      return existingExplanation.trim();
    }

    const key = getQuestionKey(questionId, questionText);

    // 2. Check in-memory session cache
    if (memCache.has(key)) {
      return memCache.get(key)!;
    }

    // 3. Check localStorage cache
    const localStore = getLocalStore();
    if (localStore[key] && localStore[key].trim().length > 6) {
      memCache.set(key, localStore[key]);
      return localStore[key];
    }

    // 4. Check database questions table or admin_settings
    if (questionId) {
      try {
        const { data } = await supabase
          .from('questions')
          .select('explanation')
          .eq('id', questionId)
          .maybeSingle();

        if (data?.explanation && data.explanation.trim().length > 6) {
          saveToLocalStore(key, data.explanation);
          return data.explanation;
        }
      } catch {
        // Continue to AI generation
      }
    }

    // 5. Not found in any cache -> Generate via AI Tutor ONCE
    try {
      const prompt = `You are an expert Nigerian JAMB UTME academic tutor.
Question: "${questionText}"
Correct Option: "${correctAnswer}"
${selectedAnswer && selectedAnswer !== correctAnswer ? `Student Option: "${selectedAnswer}"` : ''}

Explain clearly and concisely why option "${correctAnswer}" is the correct answer.
STRICT GUIDELINES:
- Target Standard Nigerian Senior Secondary School (SS3) / UTME syllabus.
- Write a direct 2-3 sentence explanation with mathematical or scientific rationale.
- If relevant formulas apply, format them clearly.
- Strictly NO introductory fluff or preambles (do NOT write "Problem Recap", "Here is the explanation").`;

      const aiResponse = await callGroqAPI([{ role: 'user', content: prompt }]);
      const cleaned = aiResponse ? stripThinkTags(aiResponse).replace(/^\s*\**Problem Recap\**\s*:?/i, '').trim() : '';
      const finalExplanation = cleaned || `Option ${correctAnswer} is the correct answer according to the UTME syllabus.`;

      // Cache locally immediately
      saveToLocalStore(key, finalExplanation);

      // Persist permanently to Supabase database so NO student ever consumes tokens for this question again!
      if (questionId) {
        supabase
          .from('questions')
          .update({ explanation: finalExplanation })
          .eq('id', questionId)
          .then(() => {})
          .catch(() => {});
      }

      return finalExplanation;
    } catch (err) {
      console.warn('AI Explanation generation error:', err);
      const fallback = `Option ${correctAnswer} is the correct answer.`;
      saveToLocalStore(key, fallback);
      return fallback;
    }
  }

  /**
   * Pre-loads explanations for a batch of questions
   */
  public static preloadExplanations(questions: any[]) {
    if (!Array.isArray(questions)) return;
    const store = getLocalStore();
    for (const q of questions) {
      if (q && q.explanation && q.explanation.length > 6) {
        const key = getQuestionKey(q.id, q.question_text || q.question);
        store[key] = q.explanation;
        memCache.set(key, q.explanation);
      }
    }
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
    } catch {}
  }
}
