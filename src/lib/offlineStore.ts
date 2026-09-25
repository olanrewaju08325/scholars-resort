import { supabase } from './supabase';
import { offlineDb, type OfflineStoredPack, type StoredCustomQuestion, type StoredCompletedOfflineSession } from './offlineDb';
import { resolveSubjectIdsByNameOrAlias, normalizeSubjectName, isUUID } from '@/utils/subjectUtils';
import { fetchAllRowsPaginated } from './supabasePagination';

export interface OfflinePack {
  subjectId: string;
  subjectName: string;
  version: number;
  downloadedAt: string;
  questionsCount: number;
  questions: any[];
  hasUpdate?: boolean;
  remoteCount?: number;
  isStale?: boolean;
  daysSinceDownload?: number;
}

export const STALE_PACK_DAYS_THRESHOLD = 14;

/**
 * Returns staleness assessment and elapsed days for an offline subject pack
 */
export const getPackStaleness = (
  pack: OfflinePack | null | undefined, 
  thresholdDays: number = STALE_PACK_DAYS_THRESHOLD
): {
  isStale: boolean;
  daysAgo: number;
  downloadedDate: Date | null;
} => {
  if (!pack || !pack.downloadedAt) {
    return { isStale: false, daysAgo: 0, downloadedDate: null };
  }
  const downloadedDate = new Date(pack.downloadedAt);
  if (isNaN(downloadedDate.getTime())) {
    return { isStale: false, daysAgo: 0, downloadedDate: null };
  }
  const now = new Date();
  const diffTime = Math.max(0, now.getTime() - downloadedDate.getTime());
  const daysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return {
    isStale: daysAgo >= thresholdDays,
    daysAgo,
    downloadedDate
  };
};

export const isPackStale = (
  pack: OfflinePack | null | undefined, 
  thresholdDays: number = STALE_PACK_DAYS_THRESHOLD
): boolean => {
  return getPackStaleness(pack, thresholdDays).isStale;
};

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
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
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
  const result: Record<string, OfflinePack> = {};
  for (const [key, p] of Object.entries(inMemoryPacks)) {
    if (p) {
      const staleness = getPackStaleness(p);
      result[key] = {
        ...p,
        isStale: staleness.isStale,
        daysSinceDownload: staleness.daysAgo
      };
    }
  }
  return result;
};

export const getDownloadedPacksAsync = async (): Promise<Record<string, OfflinePack>> => {
  try {
    const packs = await offlineDb.offlinePacks.toArray();
    const result: Record<string, OfflinePack> = {};
    const normalizedNameToPack = new Map<string, OfflinePack>();

    // 1. Group packs by normalized subject name and retain only the highest-question-count version
    for (const p of packs) {
      if (!p || !p.subjectName) continue;
      const norm = normalizeSubjectName(p.subjectName).toLowerCase().trim();
      const existing = normalizedNameToPack.get(norm);
      if (!existing || (p.questionsCount || 0) > (existing.questionsCount || 0)) {
        normalizedNameToPack.set(norm, p);
      }
    }

    // 2. Prune obsolete duplicate records from IndexedDB if any exist
    for (const p of packs) {
      if (!p || !p.subjectName) continue;
      const norm = normalizeSubjectName(p.subjectName).toLowerCase().trim();
      const best = normalizedNameToPack.get(norm);
      if (best && best.subjectId !== p.subjectId) {
        offlineDb.offlinePacks.delete(p.subjectId).catch(() => {});
        delete inMemoryPacks[p.subjectId];
      }
    }

    // 3. Map canonical packs by DB UUID, canonical subject name, and lowercase name
    for (const best of normalizedNameToPack.values()) {
      const staleness = getPackStaleness(best);
      const decorated: OfflinePack = {
        ...best,
        isStale: staleness.isStale,
        daysSinceDownload: staleness.daysAgo
      };
      
      const canonicalName = normalizeSubjectName(best.subjectName);
      result[best.subjectId] = decorated;
      result[canonicalName] = decorated;
      result[canonicalName.toLowerCase()] = decorated;
      result[canonicalName.toLowerCase().replace(/\s+/g, '-')] = decorated;

      inMemoryPacks[best.subjectId] = decorated;
      inMemoryPacks[canonicalName] = decorated;
      inMemoryPacks[canonicalName.toLowerCase()] = decorated;
    }

    return result;
  } catch {
    return getDownloadedPacks();
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
  const canonical = normalizeSubjectName(pack.subjectName || '');
  if (canonical) {
    inMemoryPacks[canonical] = pack;
    inMemoryPacks[canonical.toLowerCase()] = pack;
  }
  // Persist to IndexedDB asynchronously
  offlineDb.offlinePacks.put(pack).catch(err => {
    console.error('[OfflineStore] Failed to save pack to IndexedDB:', err);
  });
};

export const deleteOfflinePack = (subjectId: string) => {
  const pack = inMemoryPacks[subjectId];
  delete inMemoryPacks[subjectId];
  if (pack?.subjectName) {
    const canonical = normalizeSubjectName(pack.subjectName);
    delete inMemoryPacks[canonical];
    delete inMemoryPacks[canonical.toLowerCase()];
  }
  
  offlineDb.offlinePacks.delete(subjectId).catch(err => {
    console.warn('[OfflineStore] Failed to delete pack from IndexedDB:', err);
  });

  // Also prune any record with matching subjectName
  offlineDb.offlinePacks.toArray().then(all => {
    all.forEach(p => {
      if (p.subjectId === subjectId || (pack?.subjectName && normalizeSubjectName(p.subjectName) === normalizeSubjectName(pack.subjectName))) {
        offlineDb.offlinePacks.delete(p.subjectId).catch(() => {});
        delete inMemoryPacks[p.subjectId];
      }
    });
  }).catch(() => {});
};

export const clearAllOfflinePacks = async () => {
  Object.keys(inMemoryPacks).forEach(k => delete inMemoryPacks[k]);
  try {
    await offlineDb.offlinePacks.clear();
  } catch (_) {}
};

export const downloadSubjectPack = async (
  subjectId: string, 
  subjectName: string,
  onProgress?: (loaded: number) => void
): Promise<OfflinePack> => {
  const canonicalName = normalizeSubjectName(subjectName || subjectId || 'Subject');

  // Resolve all possible database UUIDs for this subject
  let targetIds = [subjectId];
  try {
    const resolved = await resolveSubjectIdsByNameOrAlias(canonicalName);
    if (resolved.length > 0) {
      targetIds = Array.from(new Set([...targetIds, ...resolved])).filter(isUUID);
    }
  } catch (_) {}

  // Prefer true database UUID as primary key if available
  const primaryId = targetIds.find(isUUID) || subjectId;

  // Fetch all questions for this subject using PostgREST range pagination (bypasses 1000 limit)
  let data: any[] = [];
  try {
    if (targetIds.length > 1) {
      data = await fetchAllRowsPaginated(
        () => supabase.from('questions').select('*').in('subject_id', targetIds).order('id'),
        { onProgress }
      );
    } else if (targetIds.length === 1 && isUUID(targetIds[0])) {
      data = await fetchAllRowsPaginated(
        () => supabase.from('questions').select('*').eq('subject_id', targetIds[0]).order('id'),
        { onProgress }
      );
    }
  } catch (queryErr) {
    console.warn(`[OfflineStore] Primary query error for ${canonicalName}:`, queryErr);
  }

  // Fallback: If 0 questions returned by ID and subject has a clear name, search by subject relation or name alias
  if (data.length === 0) {
    try {
      const { data: altSubs } = await supabase.from('subjects').select('id, name').ilike('name', `%${canonicalName}%`);
      if (altSubs && altSubs.length > 0) {
        const altIds = altSubs.map(s => s.id).filter(isUUID);
        if (altIds.length > 0) {
          data = await fetchAllRowsPaginated(
            () => supabase.from('questions').select('*').in('subject_id', altIds).order('id'),
            { onProgress }
          );
        }
      }
    } catch (_) {}
  }

  // Prune any previous duplicate keys for this subject from IndexedDB
  try {
    const existingPacks = await offlineDb.offlinePacks.toArray();
    for (const ep of existingPacks) {
      if (ep.subjectId === subjectId || ep.subjectId === primaryId || normalizeSubjectName(ep.subjectName).toLowerCase() === canonicalName.toLowerCase()) {
        await offlineDb.offlinePacks.delete(ep.subjectId);
        delete inMemoryPacks[ep.subjectId];
      }
    }
  } catch (_) {}

  const pack: OfflinePack = {
    subjectId: primaryId,
    subjectName: canonicalName,
    version: Date.now(),
    downloadedAt: new Date().toISOString(),
    questionsCount: data.length,
    questions: data,
    hasUpdate: false,
    remoteCount: data.length
  };

  saveOfflinePack(primaryId, pack);
  if (subjectId !== primaryId) {
    saveOfflinePack(subjectId, pack);
  }
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
      const singleId = targetIds[0] || subjectId;
      const res = await supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('subject_id', singleId);
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
  const uniquePacks = Array.from(new Set(Object.values(packs)));
  const updatedSubjects: string[] = [];
  const packUpdatesMap: Record<string, boolean> = {};

  if (uniquePacks.length === 0) return { updatedSubjects: [], packUpdatesMap: {} };

  for (const pack of uniquePacks) {
    const subId = pack.subjectId;
    const res = await checkForSubjectUpdate(subId);
    if (res.hasUpdate) {
      updatedSubjects.push(subId);
      packUpdatesMap[subId] = true;
      pack.hasUpdate = true;
      pack.remoteCount = res.remoteCount;
      inMemoryPacks[subId] = pack;
      offlineDb.offlinePacks.put(pack).catch(() => {});
    } else {
      packUpdatesMap[subId] = false;
      pack.hasUpdate = false;
      pack.remoteCount = res.remoteCount;
      inMemoryPacks[subId] = pack;
      offlineDb.offlinePacks.put(pack).catch(() => {});
    }
  }

  return { updatedSubjects, packUpdatesMap };
};

export const updateAllDownloadedPacks = async (
  onProgress?: (current: number, total: number, subjectName: string) => void
): Promise<{ updatedCount: number; errors: string[] }> => {
  const packs = await getDownloadedPacksAsync();
  const packList = Array.from(new Set(Object.values(packs)));
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

/**
 * Calculates the serialized byte size of an offline question pack
 */
export const calculatePackSize = (pack: OfflinePack | null | undefined): number => {
  if (!pack) return 0;
  try {
    return new Blob([JSON.stringify(pack)]).size;
  } catch {
    return Math.max(1024, (pack.questionsCount || pack.questions?.length || 0) * 1400);
  }
};

/**
 * Formats raw byte count into human-readable representation (e.g. 1.2 MB, 840 KB)
 */
export const formatBytes = (bytes: number): string => {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export interface StorageCategoryMetrics {
  id: string;
  name: string;
  bytes: number;
  count: number;
  unitLabel: string;
  description: string;
}

export interface OfflineStorageMetrics {
  totalEstimatedBytes: number;
  quotaBytes: number;
  usageBytes: number;
  percentageUsed: number;
  isPersistent: boolean;
  categories: StorageCategoryMetrics[];
}

/**
 * Comprehensive analysis of IndexedDB storage usage for offline CBT data
 */
export const getOfflineStorageMetrics = async (): Promise<OfflineStorageMetrics> => {
  let quotaBytes = 50 * 1024 * 1024 * 1024; // Default fallback: 50 GB
  let usageBytes = 0;
  let isPersistent = false;

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.quota) quotaBytes = est.quota;
        if (est.usage) usageBytes = est.usage;
      }
      if (navigator.storage.persisted) {
        isPersistent = await navigator.storage.persisted();
      }
    } catch (_) {}
  }

  // 1. Calculate question packs size
  let packsBytes = 0;
  let packsCount = 0;
  let questionsCount = 0;
  try {
    const packs = await offlineDb.offlinePacks.toArray();
    packsCount = packs.length;
    packs.forEach(p => {
      const pBytes = calculatePackSize(p);
      packsBytes += pBytes;
      questionsCount += (p.questionsCount || p.questions?.length || 0);
    });
  } catch (_) {}

  // 2. Calculate practice history size
  let sessionsBytes = 0;
  let sessionsCount = 0;
  try {
    const sessions = await offlineDb.completedOfflineSessions.toArray();
    sessionsCount = sessions.length;
    sessionsBytes = new Blob([JSON.stringify(sessions)]).size;
  } catch (_) {}

  // 3. Calculate exam snapshots and crash recovery size
  let snapshotsBytes = 0;
  let snapshotsCount = 0;
  try {
    const snapshots = await offlineDb.examSnapshots.toArray();
    snapshotsCount = snapshots.length;
    snapshotsBytes = new Blob([JSON.stringify(snapshots)]).size;
  } catch (_) {}

  // 4. Calculate sync queue size
  let syncQueueBytes = 0;
  let syncQueueCount = 0;
  try {
    const syncItems = await offlineDb.syncQueue.toArray();
    syncQueueCount = syncItems.length;
    syncQueueBytes = new Blob([JSON.stringify(syncItems)]).size;
  } catch (_) {}

  const totalCalculated = packsBytes + sessionsBytes + snapshotsBytes + syncQueueBytes;
  const effectiveUsage = Math.max(usageBytes, totalCalculated);
  const percentageUsed = quotaBytes > 0 ? (effectiveUsage / quotaBytes) * 100 : 0;

  return {
    totalEstimatedBytes: totalCalculated,
    quotaBytes,
    usageBytes: effectiveUsage,
    percentageUsed,
    isPersistent,
    categories: [
      {
        id: 'packs',
        name: 'Question Packs',
        bytes: packsBytes,
        count: packsCount,
        unitLabel: `${questionsCount.toLocaleString()} Questions`,
        description: 'Downloaded UTME past question banks stored for offline CBT practice.'
      },
      {
        id: 'sessions',
        name: 'Offline Practice History',
        bytes: sessionsBytes,
        count: sessionsCount,
        unitLabel: `${sessionsCount} Sessions`,
        description: 'Completed offline mock exams, scores, and accuracy metrics.'
      },
      {
        id: 'snapshots',
        name: 'Session Snapshots',
        bytes: snapshotsBytes,
        count: snapshotsCount,
        unitLabel: `${snapshotsCount} Snapshots`,
        description: 'Temporary exam state backups for device crash auto-recovery.'
      },
      {
        id: 'queue',
        name: 'Sync Queue Records',
        bytes: syncQueueBytes,
        count: syncQueueCount,
        unitLabel: `${syncQueueCount} Records`,
        description: 'Offline mutations waiting to upload to Cloud upon reconnection.'
      }
    ]
  };
};




