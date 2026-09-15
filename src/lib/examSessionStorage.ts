/**
 * Active Exam Session Crash-Recovery Storage Utility
 * 
 * Synchronously mirrors the live CBT exam state to localStorage (and Dexie)
 * so that if a student accidentally closes the browser tab, runs out of battery,
 * or reloads the page, the app immediately offers to restore their in-progress exam.
 */

import { saveExamSnapshot, clearExamSnapshot, getExamSnapshot, sanitizeDbKey } from './offlineDb';

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
    if (typeof window === 'undefined' || !data) return;
    
    const cleanUserId = sanitizeDbKey(data.userId) || 'guest';
    const safeData: InterruptedExamData = {
      ...data,
      userId: cleanUserId,
      answers: data.answers || {},
      flagged: data.flagged || {},
      questions: Array.isArray(data.questions) ? data.questions : [],
      subjects: Array.isArray(data.subjects) ? data.subjects : []
    };

    // Save to localStorage for instant synchronous availability
    localStorage.setItem(INTERRUPTED_EXAM_KEY, JSON.stringify(safeData));

    // Save to Dexie for durable offline persistence
    await saveExamSnapshot({
      id: `session_${cleanUserId}`,
      userId: cleanUserId,
      questions: safeData.questions,
      answers: safeData.answers,
      startedAt: safeData.startedAt,
      savedAt: safeData.savedAt,
      timeLeft: safeData.timeLeft
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
    if (!data || !Array.isArray(data.questions) || data.questions.length === 0 || typeof data.timeLeft !== 'number' || data.timeLeft <= 0) {
      clearInterruptedExamSession(data?.userId);
      return null;
    }

    // Sessions older than 24 hours are considered expired
    const savedTime = new Date(data.savedAt).getTime();
    const now = Date.now();
    if (isNaN(savedTime) || (now - savedTime > 24 * 60 * 60 * 1000)) {
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
 * Async check that falls back to Dexie if localStorage was cleared
 */
export async function getInterruptedExamSessionAsync(userId?: any): Promise<InterruptedExamData | null> {
  const syncSession = getInterruptedExamSession();
  if (syncSession) return syncSession;

  const cleanUserId = sanitizeDbKey(userId);
  if (!cleanUserId) return null;

  try {
    const snapshot = await getExamSnapshot(cleanUserId);
    if (snapshot && Array.isArray(snapshot.questions) && snapshot.questions.length > 0 && snapshot.timeLeft > 0) {
      const savedTime = new Date(snapshot.savedAt).getTime();
      const now = Date.now();
      if (!isNaN(savedTime) && (now - savedTime <= 24 * 60 * 60 * 1000)) {
        return {
          userId: cleanUserId,
          startedAt: snapshot.startedAt,
          savedAt: snapshot.savedAt,
          timeLeft: snapshot.timeLeft,
          currentQuestionIdx: 0,
          answers: snapshot.answers || {},
          flagged: {},
          questions: snapshot.questions,
          subjects: []
        };
      }
    }
  } catch (e) {
    console.warn('[ExamStorage] Failed to read Dexie snapshot:', e);
  }

  return null;
}

/**
 * Clear the interrupted exam session upon normal submission or explicit discard
 */
export async function clearInterruptedExamSession(userId?: any): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(INTERRUPTED_EXAM_KEY);
      localStorage.removeItem('scholars_live_exam_active');
      sessionStorage.removeItem('cbt_backup');
    }
    const cleanUserId = sanitizeDbKey(userId);
    await clearExamSnapshot(cleanUserId);
  } catch (e) {
    console.warn('[ExamStorage] Failed to clear exam snapshot:', e);
  }
}
