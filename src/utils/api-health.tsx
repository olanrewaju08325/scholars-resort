import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/apiAuth';

export interface FetchLogEntry {
  id: string;
  timestamp: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  ok: boolean;
  durationMs: number;
  error?: string;
  requestPayload?: any;
  responsePayload?: any;
}

// Centralized log storage
const logsStore: FetchLogEntry[] = [];
const MAX_LOGS = 150;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

export function getFetchLogs(): FetchLogEntry[] {
  return [...logsStore];
}

export function clearFetchLogs(): void {
  logsStore.length = 0;
  notifyListeners();
}

export function logApiEvent(entry: Omit<FetchLogEntry, 'id' | 'timestamp'>): FetchLogEntry {
  const fullEntry: FetchLogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString()
  };
  
  logsStore.unshift(fullEntry);
  if (logsStore.length > MAX_LOGS) {
    logsStore.pop();
  }
  
  notifyListeners();
  
  if (isDebugMode()) {
    const badge = entry.ok ? '[API SUCCESS]' : `[API ERROR ${entry.status}]`;
    console.log(`${badge} ${entry.method} ${entry.url} (${entry.durationMs}ms)`, entry.error || entry.responsePayload || '');
  }
  
  return fullEntry;
}

export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;
  const search = window.location.search || '';
  const params = new URLSearchParams(search);
  return params.get('debug') === 'true' || params.get('debug') === '1' || localStorage.getItem('debug_mode') === 'true';
}

/**
 * Standardized Fetch Middleware wrapper for all API calls
 */
export async function apiHealthFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const startTime = Date.now();
  const method = options.method || 'GET';
  
  let reqPayload: any = undefined;
  if (options.body && typeof options.body === 'string') {
    try {
      reqPayload = JSON.parse(options.body);
    } catch {
      reqPayload = options.body;
    }
  }

  try {
    const response = await authFetch(url, options);
    const durationMs = Date.now() - startTime;

    let resBody: any = undefined;
    try {
      const clone = response.clone();
      resBody = await clone.json();
    } catch {
      try {
        const cloneText = await response.clone();
        resBody = await cloneText.text();
      } catch {}
    }

    const isOk = response.ok && response.status < 400;
    const errMsg = !isOk 
      ? (resBody?.error || resBody?.message || `HTTP ${response.status} ${response.statusText}`)
      : undefined;

    logApiEvent({
      url,
      method,
      status: response.status,
      statusText: response.statusText || (isOk ? 'OK' : 'Error'),
      ok: isOk,
      durationMs,
      error: errMsg,
      requestPayload: reqPayload,
      responsePayload: resBody
    });

    return response;
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err?.message || 'Network request failed';

    logApiEvent({
      url,
      method,
      status: 0,
      statusText: 'Network Timeout / Error',
      ok: false,
      durationMs,
      error: errorMsg,
      requestPayload: reqPayload
    });

    // Safe fallback response to prevent frontend UI crashes
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Hidden Debug Console Component that renders when ?debug=true is present in URL
 */
export const ApiDebugConsole: React.FC = () => {
  const [logs, setLogs] = useState<FetchLogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'errors' | 'success'>('all');
  const [search, setSearch] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const checkDebug = () => {
      const active = isDebugMode();
      setEnabled(active);
    };
    checkDebug();
    
    const handleUpdate = () => {
      setLogs(getFetchLogs());
    };

    listeners.add(handleUpdate);
    handleUpdate();

    window.addEventListener('popstate', checkDebug);
    return () => {
      listeners.delete(handleUpdate);
      window.removeEventListener('popstate', checkDebug);
    };
  }, []);

  if (!enabled) return null;

  const filteredLogs = logs.filter(log => {
    if (filter === 'errors' && log.ok) return false;
    if (filter === 'success' && !log.ok) return false;
    if (search) {
      const term = search.toLowerCase();
      return (
        log.url.toLowerCase().includes(term) ||
        log.method.toLowerCase().includes(term) ||
        String(log.status).includes(term) ||
        (log.error && log.error.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="fixed bottom-4 right-4 z-[99999] font-mono text-xs">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-zinc-900 text-amber-400 hover:bg-zinc-800 border border-amber-500/40 px-3 py-2 rounded-xl shadow-2xl flex items-center gap-2 font-bold tracking-wider animate-bounce"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>DEBUG CONSOLE ({logs.filter(l => !l.ok).length} ERRORS)</span>
        </button>
      ) : (
        <div className="w-[95vw] sm:w-[600px] h-[450px] bg-zinc-950 text-zinc-100 border border-amber-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Top Bar */}
          <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <span>⚡ API HEALTH & DEBUG CONSOLE</span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                ?debug=true
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => clearFetchLogs()}
                className="text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded bg-zinc-800 text-[11px]"
              >
                Clear
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 text-[11px]"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="p-2 bg-zinc-900/60 border-b border-zinc-800 flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter endpoint or error..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 text-zinc-200 px-2 py-1 rounded w-full text-xs focus:outline-none focus:border-amber-500/50"
            />
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setFilter('all')}
                className={`px-2 py-1 rounded text-[10px] ${filter === 'all' ? 'bg-amber-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
              >
                All ({logs.length})
              </button>
              <button
                onClick={() => setFilter('errors')}
                className={`px-2 py-1 rounded text-[10px] ${filter === 'errors' ? 'bg-red-500 text-white font-bold' : 'bg-zinc-800 text-zinc-400'}`}
              >
                Errors ({logs.filter(l => !l.ok).length})
              </button>
              <button
                onClick={() => setFilter('success')}
                className={`px-2 py-1 rounded text-[10px] ${filter === 'success' ? 'bg-emerald-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400'}`}
              >
                OK ({logs.filter(l => l.ok).length})
              </button>
            </div>
          </div>

          {/* Log Stream */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {filteredLogs.length === 0 ? (
              <div className="text-center text-zinc-500 py-12">No API fetch activity recorded yet.</div>
            ) : (
              filteredLogs.map(log => (
                <div
                  key={log.id}
                  className={`p-2 rounded-lg border text-[11px] font-mono transition-colors ${
                    log.ok
                      ? 'bg-zinc-900/40 border-emerald-500/20 text-zinc-300'
                      : 'bg-red-950/30 border-red-500/40 text-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden truncate">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        log.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {log.status || 'ERR'}
                      </span>
                      <span className="font-bold text-zinc-400 shrink-0">{log.method}</span>
                      <span className="truncate text-zinc-200">{log.url}</span>
                    </div>
                    <span className="text-zinc-500 text-[10px] shrink-0">{log.durationMs}ms</span>
                  </div>

                  {log.error && (
                    <div className="mt-1 text-red-400 bg-red-950/60 p-1.5 rounded border border-red-500/20 text-[10px] break-all">
                      ⚠️ {log.error}
                    </div>
                  )}

                  {log.responsePayload && log.ok && (
                    <details className="mt-1 text-[10px] text-zinc-400">
                      <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">Payload Preview</summary>
                      <pre className="mt-1 bg-zinc-950 p-1 rounded overflow-x-auto text-[10px]">
                        {JSON.stringify(log.responsePayload, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
