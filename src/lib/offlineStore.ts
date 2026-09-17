import { supabase } from './supabase';
import { offlineDb, type OfflineStoredPack, type StoredCustomQuestion, type StoredCompletedOfflineSession } from './offlineDb';

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

export type CompletedOfflineSession = StoredCompletedOfflineSession;

// In-memory runtime cache for instant synchronous access across UI components
const inMemoryPacks: Record<string, OfflinePack> = {};
let inMemoryCustomQuestions: any[] = [];
let inMemoryCompletedSessions: CompletedOfflineSession[] = [];
let isStoreHydrated = false;
const hydrationListeners: Array<() => void> = [];

// Initialize & migrate from localStorage to IndexedDB immediately
export const hydrateOfflineStore = async (): Promise<void> => {
  try {
    // 1. Check if legacy localStorage has packs and migrate them to IndexedDB
    try {
      const legacyRaw = localStorage.getItem('scholar_offline_question_packs');
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (parsed && typeof parsed === 'object') {
          for (const key of Object.keys(parsed)) {
            const pack = parsed[key];
            if (pack && pack.subjectId) {
              await offlineDb.offlinePacks.put(pack);
            }
          }
        }
        // Remove from localStorage to free up browser quota
        localStorage.removeItem('scholar_offline_question_packs');
      }

      const legacyCustom = localStorage.getItem('scholar_custom_questions');
      if (legacyCustom) {
        const parsedCustom = JSON.parse(legacyCustom);
        if (Array.isArray(parsedCustom) && parsedCustom.length > 0) {
          await offlineDb.customQuestions.bulkPut(parsedCustom);
        }
        localStorage.removeItem('scholar_custom_questions');
      }

      const legacySessions = localStorage.getItem('scholar_offline_completed_sessions');
      if (legacySessions) {
        const parsedSessions = JSON.parse(legacySessions);
        if (Array.isArray(parsedSessions) && parsedSessions.length > 0) {
          await offlineDb.completedOfflineSessions.bulkPut(parsedSessions);
        }
        localStorage.removeItem('scholar_offline_completed_sessions');
      }
    } catch (migErr) {
      console.warn('[OfflineStore] Migration check notice:', migErr);
    }

    // 2. Load from IndexedDB into in-memory cache
    const dbPacks = await offlineDb.offlinePacks.toArray();
    for (const p of dbPacks) {
      if (p && p.subjectId) {
        inMemoryPacks[p.subjectId] = p;
      }
    }

    inMemoryCustomQuestions = await offlineDb.customQuestions.toArray();
    inMemoryCompletedSessions = await offlineDb.completedOfflineSessions.orderBy('completedAt').reverse().toArray();
    
    isStoreHydrated = true;
    hydrationListeners.forEach(listener => {
      try { listener(); } catch (_) {}
    });
  } catch (err) {
    console.warn('[OfflineStore] Hydration notice:', err);
    isStoreHydrated = true;
  }
};

// Trigger background hydration on script load
hydrateOfflineStore();

export const onOfflineStoreHydrated = (callback: () => void) => {
  if (isStoreHydrated) {
    callback();
  } else {
    hydrationListeners.push(callback);
  }
};

export const getDownloadedPacks = (): Record<string, OfflinePack> => {
  return { ...inMemoryPacks };
};

export const getDownloadedPacksAsync = async (): Promise<Record<string, OfflinePack>> => {
  try {
    const packs = await offlineDb.offlinePacks.toArray();
    const result: Record<string, OfflinePack> = {};
    for (const p of packs) {
      if (p && p.subjectId) {
        result[p.subjectId] = p;
        inMemoryPacks[p.subjectId] = p;
      }
    }
    return result;
  } catch {
    return { ...inMemoryPacks };
  }
};

export const saveOfflinePack = (subjectId: string, pack: OfflinePack) => {
  inMemoryPacks[subjectId] = pack;
  // Persist to IndexedDB asynchronously (no 5MB quota limit)
  offlineDb.offlinePacks.put(pack).catch(err => {
    console.error('[OfflineStore] Failed to save pack to IndexedDB:', err);
  });
};

export const deleteOfflinePack = (subjectId: string) => {
  delete inMemoryPacks[subjectId];
  offlineDb.offlinePacks.delete(subjectId).catch(err => {
    console.warn('[OfflineStore] Failed to delete pack from IndexedDB:', err);
  });
};

export const clearAllOfflinePacks = async () => {
  Object.keys(inMemoryPacks).forEach(k => delete inMemoryPacks[k]);
  try {
    await offlineDb.offlinePacks.clear();
  } catch (_) {}
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
      // Mark in memory and DB
      packs[subId].hasUpdate = true;
      packs[subId].remoteCount = res.remoteCount;
      offlineDb.offlinePacks.put(packs[subId]).catch(() => {});
    } else {
      packUpdatesMap[subId] = false;
      packs[subId].hasUpdate = false;
      offlineDb.offlinePacks.put(packs[subId]).catch(() => {});
    }
  }

  return { updatedSubjects, packUpdatesMap };
};

export const saveCustomQuestions = (questions: any[]) => {
  try {
    inMemoryCustomQuestions = [...inMemoryCustomQuestions, ...questions];
    offlineDb.customQuestions.bulkPut(questions).catch(err => {
      console.warn('Failed to save custom questions to IndexedDB:', err);
    });
  } catch (e) {
    console.warn('Failed to save custom questions:', e);
  }
};

export const getCustomQuestions = (subjectId?: string): any[] => {
  try {
    if (subjectId) {
      return inMemoryCustomQuestions.filter((q: any) => !q.subject_id || q.subject_id === subjectId);
    }
    return inMemoryCustomQuestions;
  } catch {
    return [];
  }
};

export const getCompletedOfflineSessions = (): CompletedOfflineSession[] => {
  return [...inMemoryCompletedSessions];
};

export const getCompletedOfflineSessionsAsync = async (): Promise<CompletedOfflineSession[]> => {
  try {
    const list = await offlineDb.completedOfflineSessions.orderBy('completedAt').reverse().toArray();
    inMemoryCompletedSessions = list;
    return list;
  } catch {
    return [...inMemoryCompletedSessions];
  }
};

export const saveCompletedOfflineSession = (session: CompletedOfflineSession) => {
  try {
    inMemoryCompletedSessions.unshift(session);
    if (inMemoryCompletedSessions.length > 100) {
      inMemoryCompletedSessions = inMemoryCompletedSessions.slice(0, 100);
    }
    offlineDb.completedOfflineSessions.put(session).catch(err => {
      console.warn('Failed to save completed offline session to IndexedDB:', err);
    });
  } catch (e) {
    console.warn('Failed to save completed offline session:', e);
  }
};

export const clearCompletedOfflineSessions = async () => {
  inMemoryCompletedSessions = [];
  try {
    await offlineDb.completedOfflineSessions.clear();
  } catch (_) {}
};


