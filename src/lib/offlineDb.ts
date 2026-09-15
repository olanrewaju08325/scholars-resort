import Dexie, { type Table } from 'dexie';

export interface OfflineQuestion {
  id: string;
  subject_id: string;
  topic_id?: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  explanation?: string;
}

export interface OfflineAnswer {
  id?: number;
  question_id: string;
  selected_answer: string;
  is_correct: boolean;
  time_spent_seconds: number;
  synced: boolean;
  timestamp: number;
}

// Live exam session snapshot for crash recovery
export interface OfflineExamSnapshot {
  id: string;            // Fixed key: 'current_session' per user
  userId: string;
  questions: any[];
  answers: Record<string, string>;
  startedAt: string;
  savedAt: string;
  timeLeft: number;
}

export interface OfflineSyncItem {
  id?: number;
  type: 'exam_result' | 'study_progress' | 'session_answer' | 'daily_goal' | 'profile_update' | 'custom_write';
  table: string;
  action: 'insert' | 'upsert' | 'update';
  payload: any;
  matchCriteria?: Record<string, any>;
  userId?: string;
  timestamp: number;
  retryCount: number;
  nextRetryTime?: number;
  status: 'pending' | 'syncing' | 'failed';
  lastError?: string;
}

export class ScholarsResortDB extends Dexie {
  questions!: Table<OfflineQuestion, string>;
  answers!: Table<OfflineAnswer, number>;
  examSnapshots!: Table<OfflineExamSnapshot, string>;
  syncQueue!: Table<OfflineSyncItem, number>;

  constructor() {
    super('ScholarsResortOfflineDB');
    this.version(1).stores({
      questions: 'id, subject_id, topic_id',
      answers: '++id, question_id, synced'
    });
    this.version(2).stores({
      questions: 'id, subject_id, topic_id',
      answers: '++id, question_id, synced',
      examSnapshots: 'id, userId'
    });
    this.version(3).stores({
      questions: 'id, subject_id, topic_id',
      answers: '++id, question_id, synced',
      examSnapshots: 'id, userId',
      syncQueue: '++id, type, table, status, userId, timestamp'
    });
  }
}

export const sanitizeDbKey = (key: any): string | null => {
  if (key === null || key === undefined) return null;
  if (Array.isArray(key)) {
    if (key.length >= 1) {
      return sanitizeDbKey(key[0]);
    }
    return null;
  }
  if (typeof key === 'string') {
    const trimmed = key.trim();
    if (trimmed === '' || trimmed === 'undefined' || trimmed === 'null') return null;
    return trimmed;
  }
  if (typeof key === 'number') {
    return (!isNaN(key) && isFinite(key)) ? String(key) : null;
  }
  if (key instanceof Date) {
    return !isNaN(key.getTime()) ? key.toISOString() : null;
  }
  if (typeof key === 'object') {
    if (key.id) return sanitizeDbKey(key.id);
    if (key.userId) return sanitizeDbKey(key.userId);
  }
  return null;
};

export const offlineDb = new ScholarsResortDB();

// ─────────────────────────────────────────────────────────
// Exam Snapshot helpers (replaces sessionStorage in CBTExam)
// ─────────────────────────────────────────────────────────

export const saveExamSnapshot = async (snapshot: OfflineExamSnapshot) => {
  try {
    if (!snapshot) return;
    const cleanUserId = sanitizeDbKey(snapshot.userId) || 'guest';
    const cleanId = sanitizeDbKey(snapshot.id) || `session_${cleanUserId}`;
    
    const safeSnapshot: OfflineExamSnapshot = {
      id: cleanId,
      userId: cleanUserId,
      questions: Array.isArray(snapshot.questions) ? snapshot.questions : [],
      answers: (snapshot.answers && typeof snapshot.answers === 'object') ? snapshot.answers : {},
      startedAt: snapshot.startedAt || new Date().toISOString(),
      savedAt: snapshot.savedAt || new Date().toISOString(),
      timeLeft: typeof snapshot.timeLeft === 'number' ? snapshot.timeLeft : 0
    };

    await offlineDb.examSnapshots.put(safeSnapshot);
  } catch (e) {
    console.warn('[OfflineDb] saveExamSnapshot notice:', e);
  }
};

export const getExamSnapshot = async (userId?: any): Promise<OfflineExamSnapshot | undefined> => {
  const cleanUserId = sanitizeDbKey(userId);
  if (!cleanUserId) return undefined;
  
  try {
    return await offlineDb.examSnapshots.where('userId').equals(cleanUserId).first();
  } catch (e) {
    console.warn('[OfflineDb] getExamSnapshot notice:', e);
    return undefined;
  }
};

export const clearExamSnapshot = async (userId?: any) => {
  try {
    const cleanUserId = sanitizeDbKey(userId);
    if (cleanUserId) {
      await offlineDb.examSnapshots.where('userId').equals(cleanUserId).delete();
    } else {
      await offlineDb.examSnapshots.clear();
    }
  } catch (e) {
    console.warn('[OfflineDb] clearExamSnapshot notice:', e);
  }
};

// ─────────────────────────────────────────────────────────
// Answer sync helpers
// ─────────────────────────────────────────────────────────

// Helper to sync pending answers to Supabase when online
export const syncPendingAnswers = async (supabaseClient: any, userId?: any) => {
  const cleanUserId = sanitizeDbKey(userId);
  if (!navigator.onLine || !cleanUserId || !supabaseClient) return;
  
  try {
    const pending = await offlineDb.answers.filter(a => !a.synced).toArray();
    if (pending.length === 0) return;

    const payloads = pending.map(ans => ({
      user_id: cleanUserId,
      question_id: ans.question_id,
      selected_answer: ans.selected_answer,
      is_correct: ans.is_correct,
      time_spent_seconds: ans.time_spent_seconds,
    }));
    
    const { error } = await supabaseClient.from('session_answers').insert(payloads);
    
    if (!error) {
      await offlineDb.answers.filter(a => !a.synced).modify({ synced: true });
      console.log(`Synced ${pending.length} offline answers to backend.`);
    }
  } catch (error) {
    console.error("Failed to sync offline answers", error);
  }
};
