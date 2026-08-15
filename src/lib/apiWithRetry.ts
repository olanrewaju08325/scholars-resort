import { toast } from 'sonner';
import { supabase } from './supabase';

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  showToast?: boolean;
  timeoutMs?: number;
}

export class ApiError extends Error {
  constructor(public message: string, public status?: number, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wraps a promise with an abort controller timeout.
 */
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

/**
 * Executes a function with exponential backoff and timeout.
 * Ideal for API calls and Edge Function invocations.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, showToast = false, timeoutMs = 15000 } = options;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const result = await withTimeout(operation(), timeoutMs);
      return result;
    } catch (error: any) {
      attempt++;
      
      const isClientError = error?.status && error.status >= 400 && error.status < 500;
      // Do not retry 400/404 errors as they are likely permanent client errors, unless it's a 429
      if (isClientError && error.status !== 429) {
        logToDb(error, 'client_error');
        throw error;
      }

      if (attempt >= maxRetries) {
        logToDb(error, 'fatal_error');
        if (showToast) {
          toast.error(`Operation failed after ${maxRetries} attempts: ${error.message}`);
        }
        throw new ApiError(error.message, error.status, error);
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      if (showToast) {
        toast.warning(`Network unstable. Retrying in ${delay / 1000}s...`);
      }
      
      await new Promise(res => setTimeout(res, delay));
    }
  }

  throw new Error("Unreachable");
}

/**
 * Automatically logs critical failures to the database without throwing to the UI.
 */
async function logToDb(error: any, severity: string = 'error') {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Attempt to log
    await supabase.from('platform_error_logs').insert({
      user_id: user?.id || null,
      error_message: error.message || 'Unknown error',
      stack_trace: error.stack || null,
      severity,
      metadata: { status: error.status, details: error.details },
      url: window.location.href,
      user_agent: navigator.userAgent
    });
  } catch (e) {
    console.error("Failed to write to error log:", e);
  }
}
