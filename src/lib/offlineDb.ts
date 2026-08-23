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

export const offlineDb = new ScholarsResortDB();

// ─────────────────────────────────────────────────────────
// Exam Snapshot helpers (replaces sessionStorage in CBTExam)
// ─────────────────────────────────────────────────────────

export const saveExamSnapshot = async (snapshot: OfflineExamSnapshot) => {
  await offlineDb.examSnapshots.put(snapshot);
};

export const getExamSnapshot = async (userId: string): Promise<OfflineExamSnapshot | undefined> => {
  return offlineDb.examSnapshots.where('userId').equals(userId).first();
};

export const clearExamSnapshot = async (userId: string) => {
  await offlineDb.examSnapshots.where('userId').equals(userId).delete();
};

// ─────────────────────────────────────────────────────────
// Answer sync helpers
// ─────────────────────────────────────────────────────────

// Helper to sync pending answers to Supabase when online
export const syncPendingAnswers = async (supabaseClient: any, userId: string) => {
  if (!navigator.onLine) return;
  
  const pending = await offlineDb.answers.where('synced').equals(0).toArray();
  if (pending.length === 0) return;

  try {
    const payloads = pending.map(ans => ({
      user_id: userId,
      question_id: ans.question_id,
      selected_answer: ans.selected_answer,
      is_correct: ans.is_correct,
      time_spent_seconds: ans.time_spent_seconds,
    }));
    
    const { error } = await supabaseClient.from('session_answers').insert(payloads);
    
    if (!error) {
      await offlineDb.answers.where('synced').equals(0).modify({ synced: true });
      console.log(`Synced ${pending.length} offline answers to backend.`);
    }
  } catch (error) {
    console.error("Failed to sync offline answers", error);
  }
};
