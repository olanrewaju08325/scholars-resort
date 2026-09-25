import { supabase } from './supabase';
import { normalizeSubjectName } from '@/utils/subjectUtils';

export interface PaginatedFetchOptions {
  pageSize?: number;
  maxTotal?: number;
  onProgress?: (fetchedCount: number) => void;
}

/**
 * Fetches all rows matching a query using Supabase PostgREST range pagination.
 * Bypasses the default PostgREST server-side cap of 1,000 rows.
 */
export async function fetchAllRowsPaginated<T = any>(
  buildQuery: () => any,
  options?: PaginatedFetchOptions
): Promise<T[]> {
  const pageSize = options?.pageSize || 1000;
  const maxTotal = options?.maxTotal || 100000;
  const allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore && allRows.length < maxTotal) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) {
      console.error('[fetchAllRowsPaginated] Page fetch error:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...data);
    if (options?.onProgress) {
      options.onProgress(allRows.length);
    }

    if (data.length < pageSize) {
      hasMore = false;
    } else {
      from += pageSize;
    }
  }

  return allRows;
}

// In-memory cache for cloud question breakdown to keep UI snappy
let cachedCloudStats: {
  totalQuestions: number;
  subjectCounts: Record<string, number>;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Fetches verified real-time question counts from Supabase database.
 * Returns total questions and a map of { [subjectIdOrName]: count }.
 * Mapped by both DB UUID, canonical subject name, and lowercase slug.
 */
export async function getCloudQuestionStats(forceRefresh: boolean = false): Promise<{
  totalQuestions: number;
  subjectCounts: Record<string, number>;
}> {
  const now = Date.now();
  if (!forceRefresh && cachedCloudStats && now - cachedCloudStats.timestamp < CACHE_TTL_MS) {
    return {
      totalQuestions: cachedCloudStats.totalQuestions,
      subjectCounts: cachedCloudStats.subjectCounts
    };
  }

  try {
    // 1. Fetch exact total count via head query
    const { count: exactTotal } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true });

    // 2. Fetch all questions subject_ids with pagination to calculate exact subject counts
    const rows = await fetchAllRowsPaginated<{ id: string; subject_id: string }>(
      () => supabase.from('questions').select('id, subject_id')
    );

    // 3. Fetch subjects table to map UUIDs to canonical names and slugs
    let dbSubjects: Array<{ id: string; name: string }> = [];
    try {
      const { data: subs } = await supabase.from('subjects').select('id, name');
      if (subs) dbSubjects = subs;
    } catch (_) {}

    const subjectCounts: Record<string, number> = {};
    rows.forEach(q => {
      if (q.subject_id) {
        subjectCounts[q.subject_id] = (subjectCounts[q.subject_id] || 0) + 1;
      }
    });

    // Populate counts under subject name, canonical name, and slug aliases
    dbSubjects.forEach(s => {
      const count = subjectCounts[s.id] || 0;
      const canonical = normalizeSubjectName(s.name);
      subjectCounts[s.name] = count;
      subjectCounts[s.name.toLowerCase()] = count;
      subjectCounts[canonical] = count;
      subjectCounts[canonical.toLowerCase()] = count;
      subjectCounts[canonical.toLowerCase().replace(/\s+/g, '-')] = count;
    });

    const total = exactTotal ?? rows.length;

    cachedCloudStats = {
      totalQuestions: total,
      subjectCounts,
      timestamp: now
    };

    return {
      totalQuestions: total,
      subjectCounts
    };
  } catch (err) {
    console.warn('[getCloudQuestionStats] Error fetching cloud stats:', err);
    return {
      totalQuestions: cachedCloudStats?.totalQuestions || 0,
      subjectCounts: cachedCloudStats?.subjectCounts || {}
    };
  }
}
