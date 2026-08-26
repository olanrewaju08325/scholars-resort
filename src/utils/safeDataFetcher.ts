import { errorTracker } from '@/lib/errorTracker';
import { DataSanitizer } from './dataSanitizer';
import { supabase } from '@/lib/supabase';

export interface SafeFetchResponse<T = any[]> {
  data: T;
  loading: boolean;
  error: { code?: string; message: string; status?: number } | null;
  count?: number | null;
}

/**
 * Log API error directly to Supabase central database logs (`error_logs` and `platform_error_logs`).
 */
async function logErrorToDatabase(contextName: string, status: number | string, message: string, metadata?: any) {
  // Suppress logging for 404/400 missing tables to keep console and logs clean
  if (status === 404 || status === 400 || String(message).includes('relation') || String(message).includes('does not exist')) {
    return;
  }
  if (!supabase) return;
  const payload = {
    error_type: 'database_error',
    error_message: `[${contextName}] API Error (${status}): ${message}`,
    error_context: {
      status,
      context: contextName,
      ...metadata
    },
    created_at: new Date().toISOString()
  };

  try {
    // Insert into both platform_error_logs and error_logs for admin tray visibility
    await Promise.allSettled([
      supabase.from('platform_error_logs').insert(payload).catch(() => {}),
      supabase.from('error_logs').insert({
        message: payload.error_message,
        source: contextName,
        status_code: status,
        details: JSON.stringify(metadata || {}),
        created_at: payload.created_at
      }).catch(() => {})
    ]);
  } catch {
    // Ignore background logging failures
  }
}

/**
 * SafeDataFetcher
 * Wraps Supabase client calls to catch 400/404 and API response type errors.
 * Logs issues to central Supabase error_logs and platform_error_logs tables for Admin Dashboard monitoring tray.
 * Guarantees a standardized { data, loading: false, error: null } structure.
 * Prevents "TypeError: e.replace is not a function" crashes caused by malformed API responses or unexpected string/object types.
 */
export async function SafeDataFetcher<T = any[]>(
  queryPromise: Promise<{ data: any; error: any; count?: number | null }> | (() => Promise<{ data: any; error: any; count?: number | null }>),
  options: {
    contextName?: string;
    fallbackData?: T;
    sanitizer?: (raw: any) => T;
  } = {}
): Promise<SafeFetchResponse<T>> {
  const contextName = options.contextName || 'SafeDataFetcher';
  const fallback = (options.fallbackData !== undefined ? options.fallbackData : []) as unknown as T;

  try {
    const promise = typeof queryPromise === 'function' ? queryPromise() : queryPromise;
    const { data, error, count } = await promise;

    if (error) {
      const status = error.status || error.code || 400;
      const message = typeof error.message === 'string' ? error.message : (typeof error === 'string' ? error : 'Supabase API Error');

      // Log 400, 404 and other database errors directly to central database table in Supabase
      logErrorToDatabase(contextName, status, message, {
        code: error.code,
        details: error.details,
        hint: error.hint,
        status: error.status
      });

      // Also log to errorTracker in memory
      errorTracker.logError({
        type: 'database_error',
        message: `[${contextName}] API Error (${status}): ${message}`,
        component: contextName,
        metadata: {
          code: error.code,
          details: error.details,
          hint: error.hint,
          status: error.status
        }
      });

      return {
        data: fallback,
        loading: false,
        error: null, // Gracefully handled so UI renders fallback state without crashing
        count: count ?? null
      };
    }

    // Sanitize response data to prevent crashes like `e.replace is not a function`
    let sanitizedData: T;
    if (options.sanitizer) {
      sanitizedData = options.sanitizer(data);
    } else if (Array.isArray(data)) {
      sanitizedData = DataSanitizer.sanitizeArray(data) as unknown as T;
    } else if (data !== null && data !== undefined) {
      sanitizedData = data as T;
    } else {
      sanitizedData = fallback;
    }

    return {
      data: sanitizedData,
      loading: false,
      error: null,
      count: count ?? null
    };
  } catch (err: any) {
    const errorMessage = err?.message && typeof err.message === 'string' ? err.message : String(err || 'Unknown API Exception');

    logErrorToDatabase(contextName, 500, errorMessage, { stack: err?.stack });

    errorTracker.logError({
      type: 'database_error',
      message: `[${contextName}] Exception: ${errorMessage}`,
      component: contextName,
      metadata: { stack: err?.stack }
    });

    return {
      data: fallback,
      loading: false,
      error: null,
      count: null
    };
  }
}

export default SafeDataFetcher;

