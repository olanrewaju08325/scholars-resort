import Dexie, { type EntityTable } from 'dexie';

export interface SubjectCache {
  id: string;
  name: string;
  version: number;
}

export interface QuestionCache {
  id: string;
  subject_id: string;
  question_text: string;
  options: string[]; // JSON array parsed
  correct_answer: string;
  explanation: string;
  topic: string;
  difficulty: string;
}

export interface PendingSession {
  id: string;
  user_id: string;
  mode: 'practice' | 'exam';
  subject_ids: string[];
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  synced: boolean;
  compromised?: boolean;
}

export interface PendingAnswer {
  id: string;
  session_id: string;
  question_id: string;
  selected_answer: string | null;
  time_spent_seconds: number;
  synced: boolean;
}

export interface DownloadMeta {
  subject_id: string;
  size: number;
  last_synced: string;
}

const db = new Dexie('ScholarsResortDB') as Dexie & {
  subjects_cache: EntityTable<SubjectCache, 'id'>;
  questions_cache: EntityTable<QuestionCache, 'id'>;
  pending_sessions: EntityTable<PendingSession, 'id'>;
  pending_answers: EntityTable<PendingAnswer, 'id'>;
  download_meta: EntityTable<DownloadMeta, 'subject_id'>;
};

// Define database schema
db.version(1).stores({
  subjects_cache: 'id, name, version',
  questions_cache: 'id, subject_id, topic, difficulty', // Indexed fields
  pending_sessions: 'id, user_id, mode, synced',
  pending_answers: 'id, session_id, question_id, synced',
  download_meta: 'subject_id, last_synced'
});

export default db;
