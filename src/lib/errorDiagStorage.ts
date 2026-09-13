/**
 * Centralized error_diag local storage utility.
 * Captures 400/500 errors, network timeouts, request payloads, and user session state
 * to prevent crashes and provide deep diagnostic context.
 */

export interface ErrorDiagItem {
  id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  status: number;
  errorMessage: string;
  requestPayload?: any;
  sessionState: {
    isAuthenticated: boolean;
    userId?: string;
    role?: string;
  };
  networkTimeout: boolean;
}

const ERROR_DIAG_KEY = 'error_diag';
const MAX_DIAG_LOGS = 100;

let memoryDiagLogs: ErrorDiagItem[] = [];

/**
 * Reads logs from localStorage or memory cache
 */
export function getErrorDiagLogs(): ErrorDiagItem[] {
  if (memoryDiagLogs.length > 0) {
    return memoryDiagLogs;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(ERROR_DIAG_KEY);
      if (stored) {
        memoryDiagLogs = JSON.parse(stored);
        return memoryDiagLogs;
      }
    } catch (e) {
      console.warn('[error_diag] Failed to read from localStorage:', e);
    }
  }
  return [];
}

/**
 * Logs a diagnostic entry to local 'error_diag' storage
 */
export function logErrorDiag(entry: Omit<ErrorDiagItem, 'id' | 'timestamp'>): ErrorDiagItem {
  const item: ErrorDiagItem = {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };

  const logs = getErrorDiagLogs();
  logs.unshift(item);

  if (logs.length > MAX_DIAG_LOGS) {
    logs.length = MAX_DIAG_LOGS;
  }

  memoryDiagLogs = logs;

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ERROR_DIAG_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[error_diag] Storage write warning:', e);
    }
  }

  return item;
}

/**
 * Clears local error_diag storage
 */
export function clearErrorDiagLogs(): void {
  memoryDiagLogs = [];
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(ERROR_DIAG_KEY);
    } catch (_) {}
  }
}
