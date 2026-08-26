import { supabase } from './supabase';
import { errorTracker } from './errorTracker';
import { DataSanitizer } from '../utils/dataSanitizer';

export interface SafeQueryResult<T> {
  data: T;
  error: { code?: string; message: string; status?: number } | null;
  count?: number | null;
}

/**
 * safeSupabaseQuery wraps Supabase database calls in student panel modules.
 * - Encapsulates schema validation using DataSanitizer
 * - Catches 400/404/database exceptions and routes error logs to the Admin Error Tracker
 * - Suppresses raw browser console error spam for student UI calls
 * - Guarantees zero mock data fallbacks: returns true empty arrays/objects or clean null states
 */
export async function safeSupabaseQuery<T>(
  queryPromise: Promise<{ data: any; error: any; count?: number | null }>,
  options: {
    contextName: string;
    sanitizer?: (raw: any) => T;
    fallbackValue: T;
  }
): Promise<SafeQueryResult<T>> {
  try {
    const { data, error, count } = await queryPromise;

    if (error) {
      const status = error.status || error.code || '400';
      const message = error.message || error.details || 'Supabase query execution error';

      // Route error to Admin Dashboard error logs silently
      errorTracker.logError({
        type: 'database_error',
        message: `[${options.contextName}] Supabase Error ${status}: ${message}`,
        component: options.contextName,
        metadata: {
          code: error.code,
          details: error.details,
          hint: error.hint,
          status: error.status
        }
      });

      return {
        data: options.fallbackValue,
        error: {
          code: String(error.code || status),
          message,
          status: typeof error.status === 'number' ? error.status : 400
        },
        count: count ?? null
      };
    }

    let sanitizedResult: T;
    if (options.sanitizer) {
      sanitizedResult = options.sanitizer(data);
    } else if (Array.isArray(data)) {
      sanitizedResult = DataSanitizer.sanitizeArray(data) as unknown as T;
    } else {
      sanitizedResult = (data ?? options.fallbackValue) as T;
    }

    return {
      data: sanitizedResult ?? options.fallbackValue,
      error: null,
      count: count ?? null
    };
  } catch (err: any) {
    const errorMessage = err?.message || 'Unexpected network or client exception during database query';

    errorTracker.logError({
      type: 'database_error',
      message: `[${options.contextName}] Network/Exception: ${errorMessage}`,
      component: options.contextName,
      metadata: { stack: err?.stack }
    });

    return {
      data: options.fallbackValue,
      error: { message: errorMessage, status: 500 },
      count: null
    };
  }
}

export { SafeDataFetcher, type SafeFetchResponse } from '../utils/safeDataFetcher';
export { supabase };
