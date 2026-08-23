/**
 * Active Exam Session Crash-Recovery Storage Utility
 * 
 * Synchronously mirrors the live CBT exam state to localStorage (and Dexie)
 * so that if a student accidentally closes the browser tab, runs out of battery,
 * or reloads the page, the app immediately offers to restore their in-progress exam.
 */

import { saveExamSnapshot, clearExamSnapshot, getExamSnapshot } from './offlineDb';

export const INTERRUPTED_EXAM_KEY = 'scholars_interrupted_exam_session';

export interface InterruptedExamData {
  userId: string;
  startedAt: string;
  savedAt: string;
  timeLeft: number;
  totalTimeSecs?: number;
  currentQuestionIdx: number;
  answers: Record<string, string>;
  flagged: Record<number, boolean>;
  questions: any[];
  subjects: string[];
}

/**
 * Save active exam session state to both localStorage and Dexie IndexedDB
 */
export async function persistActiveExamSession(data: InterruptedExamData): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    
    // Save to localStorage for instant synchronous availability
    localStorage.setItem(INTERRUPTED_EXAM_KEY, JSON.stringify(data));

    // Save to Dexie for durable offline persistence
    await saveExamSnapshot({
      id: `session_${data.userId}`,
      userId: data.userId,
      questions: data.questions,
      answers: data.answers,
      startedAt: data.startedAt,
      savedAt: data.savedAt,
      timeLeft: data.timeLeft
    });
  } catch (e) {
    console.warn('[ExamStorage] Failed to persist active exam snapshot:', e);
  }
}

/**
 * Check if there is an interrupted exam session that was active and not submitted
 */
export function getInterruptedExamSession(): InterruptedExamData | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(INTERRUPTED_EXAM_KEY);
    if (!raw) return null;

    const data: InterruptedExamData = JSON.parse(raw);
    
    // Validate session data: must have questions and positive time left
    if (!data || !data.questions || data.questions.length === 0 || data.timeLeft <= 0) {
      clearInterruptedExamSession(data?.userId);
      return null;
    }

    // Sessions older than 24 hours are considered expired
    const savedTime = new Date(data.savedAt).getTime();
    const now = Date.now();
    if (now - savedTime > 24 * 60 * 60 * 1000) {
      clearInterruptedExamSession(data?.userId);
      return null;
    }

    return data;
  } catch (e) {
    console.warn('[ExamStorage] Failed to parse interrupted exam session:', e);
    return null;
  }
}

/**
 * Clear the interrupted exam session upon normal submission or explicit discard
 */
export async function clearInterruptedExamSession(userId?: string): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(INTERRUPTED_EXAM_KEY);
    }
    if (userId) {
      await clearExamSnapshot(userId);
    }
  } catch (e) {
    console.warn('[ExamStorage] Failed to clear exam snapshot:', e);
  }
}
