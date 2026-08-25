import { supabase } from './supabase';

export interface OfflinePack {
  subjectId: string;
  subjectName: string;
  version: number;
  downloadedAt: string;
  questionsCount: number;
  questions: any[];
  hasUpdate?: boolean;
  remoteCount?: number;
}

const STORAGE_KEY = 'scholar_offline_question_packs';

export const getDownloadedPacks = (): Record<string, OfflinePack> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveOfflinePack = (subjectId: string, pack: OfflinePack) => {
  const packs = getDownloadedPacks();
  packs[subjectId] = pack;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
};

export const deleteOfflinePack = (subjectId: string) => {
  const packs = getDownloadedPacks();
  delete packs[subjectId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
};

export const downloadSubjectPack = async (subjectId: string, subjectName: string): Promise<OfflinePack> => {
  // Fetch up to 1000 questions for this subject from Supabase
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('subject_id', subjectId)
    .limit(1000);

  if (error) throw error;

  const pack: OfflinePack = {
    subjectId,
    subjectName,
    version: Date.now(),
    downloadedAt: new Date().toISOString(),
    questionsCount: data?.length || 0,
    questions: data || [],
    hasUpdate: false,
    remoteCount: data?.length || 0
  };

  saveOfflinePack(subjectId, pack);
  return pack;
};

export const checkForSubjectUpdate = async (subjectId: string): Promise<{ hasUpdate: boolean; remoteCount: number }> => {
  const packs = getDownloadedPacks();
  const localPack = packs[subjectId];
  if (!localPack) return { hasUpdate: false, remoteCount: 0 };

  try {
    const { count, error } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('subject_id', subjectId);

    if (error || count === null) return { hasUpdate: false, remoteCount: localPack.questionsCount };

    const hasUpdate = count > localPack.questionsCount;
    return { hasUpdate, remoteCount: count };
  } catch {
    return { hasUpdate: false, remoteCount: localPack.questionsCount };
  }
};

export const checkForPackUpdates = async (): Promise<{ updatedSubjects: string[]; packUpdatesMap: Record<string, boolean> }> => {
  const packs = getDownloadedPacks();
  const packKeys = Object.keys(packs);
  const updatedSubjects: string[] = [];
  const packUpdatesMap: Record<string, boolean> = {};

  if (packKeys.length === 0) return { updatedSubjects: [], packUpdatesMap: {} };

  for (const subId of packKeys) {
    const res = await checkForSubjectUpdate(subId);
    if (res.hasUpdate) {
      updatedSubjects.push(subId);
      packUpdatesMap[subId] = true;
      // Mark in storage
      packs[subId].hasUpdate = true;
      packs[subId].remoteCount = res.remoteCount;
    } else {
      packUpdatesMap[subId] = false;
      packs[subId].hasUpdate = false;
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
  return { updatedSubjects, packUpdatesMap };
};

export const saveCustomQuestions = (questions: any[]) => {
  try {
    const existingRaw = localStorage.getItem('scholar_custom_questions');
    const existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
    const updated = [...existing, ...questions];
    localStorage.setItem('scholar_custom_questions', JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save custom questions to localStorage:', e);
  }
};

export const getCustomQuestions = (subjectId?: string): any[] => {
  try {
    const raw = localStorage.getItem('scholar_custom_questions');
    const questions: any[] = raw ? JSON.parse(raw) : [];
    if (subjectId) {
      return questions.filter((q: any) => !q.subject_id || q.subject_id === subjectId);
    }
    return questions;
  } catch {
    return [];
  }
};

export interface CompletedOfflineSession {
  id: string;
  mode: 'CBT Exam' | 'Practice Drill' | 'Weakness Drill' | 'Custom Practice';
  score: number;
  totalQuestions: number;
  percentageScore: number;
  timeSpentSeconds: number;
  completedAt: string;
  subjects?: string[];
  userId?: string;
}

const COMPLETED_SESSIONS_KEY = 'scholar_offline_completed_sessions';

export const getCompletedOfflineSessions = (): CompletedOfflineSession[] => {
  try {
    const raw = localStorage.getItem(COMPLETED_SESSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveCompletedOfflineSession = (session: CompletedOfflineSession) => {
  try {
    const existing = getCompletedOfflineSessions();
    existing.unshift(session);
    // Keep last 100 offline session logs
    localStorage.setItem(COMPLETED_SESSIONS_KEY, JSON.stringify(existing.slice(0, 100)));
  } catch (e) {
    console.warn('Failed to save completed offline session:', e);
  }
};

