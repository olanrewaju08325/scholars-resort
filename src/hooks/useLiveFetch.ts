import { useState, useEffect, useCallback } from 'react';
import { SafeDataFetcher, type SafeFetchResponse } from '@/utils/safeDataFetcher';

export interface UseLiveFetchOptions<T> {
  contextName?: string;
  fallbackData?: T;
  enabled?: boolean;
  sanitizer?: (raw: any) => T;
  deps?: any[];
}

export function useLiveFetch<T = any[]>(
  fetchFn: () => Promise<{ data: any; error: any; count?: number | null }>,
  options: UseLiveFetchOptions<T> = {}
) {
  const { contextName = 'useLiveFetch', fallbackData = [] as unknown as T, enabled = true, deps = [] } = options;

  const [state, setState] = useState<SafeFetchResponse<T>>({
    data: fallbackData,
    loading: enabled,
    error: null,
    count: null
  });

  const executeFetch = useCallback(async () => {
    if (!enabled) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    setState(prev => ({ ...prev, loading: true }));
    const result = await SafeDataFetcher<T>(fetchFn, {
      contextName,
      fallbackData,
      sanitizer: options.sanitizer
    });

    setState(result);
  }, [enabled, contextName, ...deps]);

  useEffect(() => {
    executeFetch();
  }, [executeFetch]);

  return {
    ...state,
    refetch: executeFetch
  };
}

export default useLiveFetch;
