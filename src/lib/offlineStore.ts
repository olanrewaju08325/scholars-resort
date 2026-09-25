import { supabase } from './supabase';
import { offlineDb, type OfflineStoredPack, type StoredCustomQuestion, type StoredCompletedOfflineSession } from './offlineDb';
import { resolveSubjectIdsByNameOrAlias, normalizeSubjectName, isUUID } from '@/utils/subjectUtils';

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

export const findOfflinePackForSubject = (subjectIdOrName: string, packs?: Record<string, OfflinePack>): OfflinePack | null => {
  const currentPacks = packs || inMemoryPacks;
  if (!subjectIdOrName) return null;
  
  // Direct key lookup
  if (currentPacks[subjectIdOrName]) {
    return currentPacks[subjectIdOrName];
  }

  const queryNorm = normalizeSubjectName(subjectIdOrName).toLowerCase().trim();
  const rawQuery = subjectIdOrName.toLowerCase().trim();

  // Search across all saved packs by ID, Name, or normalized Name
  for (const pack of Object.values(currentPacks)) {
    if (!pack) continue;
    if (pack.subjectId === subjectIdOrName) return pack;
    const pNameNorm = normalizeSubjectName(pack.subjectName || '').toLowerCase().trim();
    const pNameRaw = (pack.subjectName || '').toLowerCase().trim();

    if (pNameNorm === queryNorm || pNameRaw === rawQuery || pNameNorm.includes(queryNorm) || queryNorm.includes(pNameNorm)) {
      return pack;
    }
  }

  return null;
};

export const saveOfflinePack = (subjectId: string, pack: OfflinePack) => {
  inMemoryPacks[subjectId] = pack;
  // Persist to IndexedDB asynchronously
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
  // Resolve all possible database UUIDs for this subject
  let targetIds = [subjectId];
  try {
    const resolved = await resolveSubjectIdsByNameOrAlias(subjectName || subjectId);
    if (resolved.length > 0) {
      targetIds = Array.from(new Set([...targetIds, ...resolved])).filter(isUUID);
    }
  } catch (_) {}

  // Fetch up to 1000 questions for this subject from Supabase
  let data: any[] | null = null;
  let error: any = null;

  if (targetIds.length > 1) {
    const res = await supabase
      .from('questions')
      .select('*')
      .in('subject_id', targetIds)
      .limit(1000);
    data = res.data;
    error = res.error;
  } else {
    const res = await supabase
      .from('questions')
      .select('*')
      .eq('subject_id', subjectId)
      .limit(1000);
    data = res.data;
    error = res.error;
  }

  // Fallback: If 0 questions returned by ID and subject has a clear name, search by subject relation or name alias
  if ((!data || data.length === 0) && !error) {
    try {
      const { data: altSubs } = await supabase.from('subjects').select('id, name').ilike('name', `%${subjectName}%`);
      if (altSubs && altSubs.length > 0) {
        const altIds = altSubs.map(s => s.id);
        const altRes = await supabase.from('questions').select('*').in('subject_id', altIds).limit(1000);
        if (altRes.data && altRes.data.length > 0) {
          data = altRes.data;
        }
      }
    } catch (_) {}
  }

  if (error) throw error;

  const pack: OfflinePack = {
    subjectId,
    subjectName: normalizeSubjectName(subjectName || 'Subject'),
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
  const packs = await getDownloadedPacksAsync();
  const localPack = packs[subjectId];
  if (!localPack) return { hasUpdate: false, remoteCount: 0 };

  try {
    // Resolve all possible DB IDs
    let targetIds = [subjectId];
    try {
      const resolved = await resolveSubjectIdsByNameOrAlias(localPack.subjectName || subjectId);
      if (resolved.length > 0) {
        targetIds = Array.from(new Set([...targetIds, ...resolved])).filter(isUUID);
      }
    } catch (_) {}

    let count: number | null = null;
    if (targetIds.length > 1) {
      const res = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .in('subject_id', targetIds);
      count = res.count;
    } else {
      const res = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', subjectId);
      count = res.count;
    }

    if (count === null) return { hasUpdate: false, remoteCount: localPack.questionsCount };

    const hasUpdate = count > localPack.questionsCount || (localPack.questionsCount === 0 && count > 0);
    return { hasUpdate, remoteCount: count };
  } catch {
    return { hasUpdate: false, remoteCount: localPack.questionsCount };
  }
};

export const checkForPackUpdates = async (): Promise<{ updatedSubjects: string[]; packUpdatesMap: Record<string, boolean> }> => {
  const packs = await getDownloadedPacksAsync();
  const packKeys = Object.keys(packs);
  const updatedSubjects: string[] = [];
  const packUpdatesMap: Record<string, boolean> = {};

  if (packKeys.length === 0) return { updatedSubjects: [], packUpdatesMap: {} };

  for (const subId of packKeys) {
    const res = await checkForSubjectUpdate(subId);
    if (res.hasUpdate) {
      updatedSubjects.push(subId);
      packUpdatesMap[subId] = true;
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

export const updateAllDownloadedPacks = async (
  onProgress?: (current: number, total: number, subjectName: string) => void
): Promise<{ updatedCount: number; errors: string[] }> => {
  const packs = await getDownloadedPacksAsync();
  const packList = Object.values(packs);
  let updatedCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < packList.length; i++) {
    const pack = packList[i];
    if (onProgress) {
      onProgress(i + 1, packList.length, pack.subjectName);
    }
    try {
      await downloadSubjectPack(pack.subjectId, pack.subjectName);
      updatedCount++;
    } catch (e: any) {
      errors.push(`${pack.subjectName}: ${e.message}`);
    }
  }

  return { updatedCount, errors };
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



