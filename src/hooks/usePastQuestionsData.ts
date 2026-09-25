import { useState, useEffect, useCallback, useRef } from 'react';
import { QuestionFlowService } from '@/services/questionFlowService';
import { getDownloadedPacks, findOfflinePackForSubject } from '@/lib/offlineStore';
import type { CleanQuestion } from '@/types/exam';

export interface UsePastQuestionsOptions {
  subjectId?: string;
  subjectName?: string;
  year?: number;
  limit?: number;
  topic?: string;
  enabled?: boolean;
}

export interface UsePastQuestionsReturn {
  questions: CleanQuestion[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  totalCount: number;
  isFromCache: boolean;
}

// In-memory query cache to avoid redundant Supabase roundtrips
const pastQuestionsCache = new Map<string, { data: CleanQuestion[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

export const usePastQuestionsData = (options: UsePastQuestionsOptions = {}): UsePastQuestionsReturn => {
  const {
    subjectId,
    subjectName,
    year,
    limit = 40,
    topic,
    enabled = true
  } = options;

  const [questions, setQuestions] = useState<CleanQuestion[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const cacheKey = `pq_${subjectId || 'any'}_${subjectName || 'any'}_${year || 'any'}_${topic || 'any'}_${limit}`;

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!enabled) return;

    // 1. Check in-memory cache if not forcing refresh
    if (!forceRefresh) {
      const cached = pastQuestionsCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        setQuestions(cached.data);
        setIsFromCache(true);
        setLoading(false);
        setError(null);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setIsFromCache(false);

    try {
      // 2. Query Supabase via QuestionFlowService
      const fetched = await QuestionFlowService.fetchPastQuestions({
        subjectId,
        subjectName,
        year,
        limit,
        topicName: topic
      });

      if (!isMountedRef.current) return;

      if (fetched && fetched.length > 0) {
        pastQuestionsCache.set(cacheKey, { data: fetched, timestamp: Date.now() });
        setQuestions(fetched);
        setLoading(false);
        return;
      }

      // 3. Fallback to offline downloaded packs if online fetch returns empty or fails
      const packs = getDownloadedPacks();
      const matchedPack = findOfflinePackForSubject(subjectId || subjectName || '', packs);

      if (matchedPack && matchedPack.questions?.length) {
        let filtered = matchedPack.questions;
        if (year) {
          const yearFiltered = filtered.filter((q: any) => Number(q.year) === Number(year));
          if (yearFiltered.length > 0) filtered = yearFiltered;
        }
        if (topic) {
          const topicFiltered = filtered.filter((q: any) => 
            q.topic_id === topic || 
            (q.topics?.name && q.topics.name.toLowerCase().includes(topic.toLowerCase()))
          );
          if (topicFiltered.length > 0) filtered = topicFiltered;
        }

        const offlineQuestions = filtered.map((q: any) => ({
          ...q,
          subject_name: q.subject_name || matchedPack.subjectName || subjectName || 'Past Question',
          year: q.year || year || 2024
        }));
        setQuestions(offlineQuestions.slice(0, limit));
        setIsFromCache(true);
      } else {
        setQuestions([]);
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      console.warn('[usePastQuestionsData] Fetch error, checking offline packs:', err);
      setError(err instanceof Error ? err : new Error(err?.message || 'Failed to fetch past questions'));

      // Check offline store on network error
      try {
        const packs = getDownloadedPacks();
        const matchedPack = findOfflinePackForSubject(subjectId || subjectName || '', packs) || Object.values(packs)[0];
        if (matchedPack && matchedPack.questions?.length) {
          const offlineQuestions = matchedPack.questions.map((q: any) => ({
            ...q,
            subject_name: q.subject_name || matchedPack.subjectName || subjectName || 'Past Question',
            year: q.year || year || 2024
          }));
          setQuestions(offlineQuestions.slice(0, limit));
          setIsFromCache(true);
        }
      } catch (fallbackErr) {
        console.error('[usePastQuestionsData] Offline fallback also failed:', fallbackErr);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [subjectId, subjectName, year, limit, topic, enabled, cacheKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refetch = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  return {
    questions,
    loading,
    error,
    refetch,
    totalCount: questions.length,
    isFromCache
  };
};
