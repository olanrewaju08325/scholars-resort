import { createClient } from '@supabase/supabase-js';
import { logErrorDiag } from './errorDiagStorage';

// Load from environment variables or production defaults
const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const rawSupabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const rawSupabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  rawSupabaseUrl && 
  rawSupabaseAnonKey && 
  rawSupabaseUrl.startsWith('http') &&
  !rawSupabaseUrl.includes('placeholder') &&
  !rawSupabaseAnonKey.includes('placeholder')
);

const supabaseUrl = isSupabaseConfigured ? rawSupabaseUrl : DEFAULT_SUPABASE_URL;
const supabaseAnonKey = isSupabaseConfigured ? rawSupabaseAnonKey : DEFAULT_SUPABASE_ANON_KEY;

// Construct explicit Realtime WebSocket endpoint URL
const supabaseRealtimeUrl = isSupabaseConfigured && supabaseUrl
  ? `${supabaseUrl.replace(/^http/i, 'ws')}/realtime/v1`
  : undefined;

// Create Supabase client with custom fetch wrapper to catch network and placeholder errors gracefully
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
      apikey: supabaseAnonKey,
      vsn: '1.0.0',
    },
    timeout: 20000,
    heartbeatIntervalMs: 30000,
    headers: {
      apikey: supabaseAnonKey,
    },
    ...(supabaseRealtimeUrl ? { url: supabaseRealtimeUrl } : {})
  },
  global: {
    fetch: async (url, options) => {
      // 1. If unconfigured or placeholder URL, prevent actual network fetch and return empty mock response
      if (!isSupabaseConfigured) {
        console.warn('[Supabase Client] Request suppressed because VITE_SUPABASE_URL is unconfigured or placeholder.');
        return new Response(
          JSON.stringify({ 
            error: {
              message: 'Supabase is unconfigured. Please provide valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.',
              code: 'UNCONFIGURED_SUPABASE'
            }, 
            data: null 
          }), 
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // 2. Intercept known optional legacy tables that may not exist in remote Supabase
      let urlStr = String(url);

      // Auto-sanitize library_materials queries requesting non-existent 'type' column (real column is material_type)
      if (urlStr.includes('/rest/v1/library_materials')) {
        urlStr = urlStr.replace(/%2Ctype\b/g, '').replace(/,type\b/g, '');
        url = urlStr;
      }

      // Auto-sanitize exam_sessions queries: 'created_at' does not exist in schema (real column is 'started_at')
      if (urlStr.includes('/rest/v1/exam_sessions')) {
        urlStr = urlStr
          .replace(/(%2C|,)?created_at\b/gi, (match, prefix) => (prefix || '') + 'started_at')
          .replace(/created_at=gte\./gi, 'started_at=gte.')
          .replace(/created_at=lte\./gi, 'started_at=lte.')
          .replace(/order=created_at\b/gi, 'order=started_at');
        url = urlStr;

        // Clean POST/PATCH payload to remove columns that don't exist on remote exam_sessions table
        if (options?.body && (options.method === 'POST' || options.method === 'PATCH' || !options.method)) {
          try {
            const parsed = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            const sanitizeRow = (row: any) => {
              if (!row || typeof row !== 'object') return row;
              const clean: any = {};

              // id: only keep if valid UUID
              if (row.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id)) {
                clean.id = row.id;
              }

              // user_id: only keep if valid UUID
              if (row.user_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.user_id)) {
                clean.user_id = row.user_id;
              }

              // mock_exam_id: only keep if valid UUID
              if (row.mock_exam_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.mock_exam_id)) {
                clean.mock_exam_id = row.mock_exam_id;
              }

              // status: strictly map to allowed PostgreSQL enum ('in_progress', 'submitted', 'abandoned')
              let status = row.status || 'in_progress';
              if (status === 'compromised' || status === 'completed') status = 'submitted';
              if (!['in_progress', 'submitted', 'abandoned'].includes(status)) status = 'in_progress';
              clean.status = status;

              if (typeof row.score === 'number' && !isNaN(row.score)) clean.score = Math.round(row.score);
              if (typeof row.total_questions === 'number' && !isNaN(row.total_questions)) clean.total_questions = Math.round(row.total_questions);

              const started = row.started_at || row.created_at || new Date().toISOString();
              clean.started_at = started;

              if (row.submitted_at || row.completed_at) {
                clean.submitted_at = row.submitted_at || row.completed_at;
              }

              return clean;
            };

            const cleanBody = Array.isArray(parsed) ? parsed.map(sanitizeRow) : sanitizeRow(parsed);
            options = {
              ...options,
              body: JSON.stringify(cleanBody)
            };
          } catch {}
        }
      }

      // Intercept direct client queries & mutations to tournaments with non-UUID to avoid 400 Bad Request
      if (urlStr.includes('/rest/v1/tournaments')) {
        const idMatch = urlStr.match(/[?&]id=eq\.([^&]+)/);
        if (idMatch) {
          const rawId = decodeURIComponent(idMatch[1]);
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
          if (!isUUID) {
            const acceptHeader = String((options?.headers as any)?.['Accept'] || (options?.headers as any)?.['accept'] || '');
            const wantsSingle = acceptHeader.includes('vnd.pgrst.object');
            
            try {
              const res = await fetch(`/api/tournaments/${encodeURIComponent(rawId)}`);
              if (res.ok) {
                const json = await res.json();
                if (json.success && json.tournament) {
                  return new Response(JSON.stringify(wantsSingle ? json.tournament : [json.tournament]), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json', 'content-range': '0-0/1' }
                  });
                }
              }
            } catch {}

            return new Response(JSON.stringify(wantsSingle ? null : []), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'content-range': '0-0/0' }
            });
          }
        }
      }

      // Intercept direct client queries & mutations to tournament_participants with non-UUID to avoid 400 Bad Request
      if (urlStr.includes('/rest/v1/tournament_participants')) {
        if (options?.method === 'POST') {
          try {
            const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
            const payload = Array.isArray(body) ? body[0] : body;
            if (payload && payload.tournament_id) {
              const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.tournament_id);
              if (!isUUID) {
                // Direct non-UUID tournament_id to API register route to prevent Postgres 22P02 400 error
                fetch('/api/tournaments/register', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                }).catch(() => {});
                return new Response(JSON.stringify([{ id: 'reg_' + Date.now(), ...payload }]), {
                  status: 201,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
            }
          } catch {}
        } else {
          const tIdMatch = urlStr.match(/[?&]tournament_id=eq\.([^&]+)/);
          if (tIdMatch) {
            const rawTId = decodeURIComponent(tIdMatch[1]);
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTId);
            if (!isUUID) {
              if (options?.method === 'PATCH' || options?.method === 'DELETE') {
                return new Response(JSON.stringify([]), {
                  status: 200,
                  headers: { 'Content-Type': 'application/json' }
                });
              }
              // GET request for non-UUID tournament participants
              try {
                const res = await fetch(`/api/tournaments/${encodeURIComponent(rawTId)}/leaderboard`);
                if (res.ok) {
                  const json = await res.json();
                  if (json.success && Array.isArray(json.leaderboard)) {
                    const mapped = json.leaderboard.map((lb: any) => ({
                      tournament_id: rawTId,
                      user_id: lb.userId,
                      score: lb.score,
                      time_spent_seconds: lb.timeSpent,
                      completed_at: lb.completedAt,
                      profiles: { full_name: lb.name, email: '' }
                    }));
                    return new Response(JSON.stringify(mapped), {
                      status: 200,
                      headers: { 'Content-Type': 'application/json', 'content-range': `0-${mapped.length}/${mapped.length}` }
                    });
                  }
                }
              } catch {}

              return new Response(JSON.stringify([]), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'content-range': '0-0/0' }
              });
            }
          }
        }
      }

      // Intercept questions query with non-UUID subject_id to avoid 400 Bad Request
      if (urlStr.includes('/rest/v1/questions')) {
        const inMatch = urlStr.match(/subject_id=in\.\(([^)]+)\)/);
        if (inMatch) {
          const rawIds = inMatch[1].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
          const validUUIDs = rawIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
          if (validUUIDs.length === 0) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'content-range': '0-0/0' }
            });
          } else if (validUUIDs.length !== rawIds.length) {
            urlStr = urlStr.replace(inMatch[0], `subject_id=in.(${validUUIDs.map(id => `"${id}"`).join(',')})`);
            url = urlStr;
          }
        }
        const eqMatch = urlStr.match(/[?&]subject_id=eq\.([^&]+)/);
        if (eqMatch) {
          const rawId = decodeURIComponent(eqMatch[1]);
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId)) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'content-range': '0-0/0' }
            });
          }
        }
      }

      const isMissingOptionalTable = urlStr.includes('/rest/v1/reported_errors') || 
                                     urlStr.includes('/rest/v1/weekly_challenges') ||
                                     urlStr.includes('/rest/v1/weekly_challenge_submissions') ||
                                     urlStr.includes('/rest/v1/user_progress');

      if (isMissingOptionalTable) {
        return new Response(JSON.stringify(options?.method === 'POST' ? {} : []), {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'content-range': '0-0/0'
          }
        });
      }

      // 3. Perform real fetch with automatic retry on network glitches (e.g. ERR_NETWORK_CHANGED)
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        attempts++;
        try {
          const response = await fetch(url, options);
          
          // Gracefully intercept 400/404 on known schema mismatch tables (e.g. user_progress, exam_sessions)
          if (!response.ok && (response.status === 404 || response.status === 400)) {
            if (
              urlStr.includes('/rest/v1/exam_sessions') || 
              urlStr.includes('/rest/v1/user_progress') || 
              urlStr.includes('/rest/v1/reported_errors') ||
              urlStr.includes('/rest/v1/weekly_challenges') ||
              urlStr.includes('/rest/v1/study_logs')
            ) {
              return new Response(JSON.stringify(options?.method === 'POST' ? {} : []), {
                status: 200,
                headers: { 
                  'Content-Type': 'application/json',
                  'content-range': '0-0/0'
                }
              });
            }
          }

          if (!response.ok) {
            logErrorDiag({
              endpoint: urlStr,
              method: options?.method || 'GET',
              status: response.status,
              errorMessage: `Supabase REST HTTP ${response.status}`,
              requestPayload: options?.body ? (typeof options.body === 'string' ? options.body.slice(0, 300) : options.body) : undefined,
              sessionState: { isAuthenticated: true },
              networkTimeout: false
            });
          }

          return response;
        } catch (err: any) {
          if (attempts < maxAttempts) {
            // Brief backoff before retry on network transition
            await new Promise(res => setTimeout(res, 350));
            continue;
          }

          console.warn('[Supabase Client] Network connectivity error intercepted:', err?.message || err);

          logErrorDiag({
            endpoint: urlStr,
            method: options?.method || 'GET',
            status: 0,
            errorMessage: err?.message || 'Supabase Network Timeout',
            requestPayload: options?.body ? (typeof options.body === 'string' ? options.body.slice(0, 300) : options.body) : undefined,
            sessionState: { isAuthenticated: true },
            networkTimeout: true
          });

          return new Response(
            JSON.stringify({ 
              error: {
                message: `Database connection temporarily unavailable (${err?.message || 'Network transition'}). Safe fallback active.`,
                code: 'FETCH_ERROR',
                details: err?.message
              }, 
              data: isMissingOptionalTable ? [] : null 
            }), 
            {
              status: 200, // Return 200 with error/null payload to prevent browser red resource crash
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }

      return new Response(JSON.stringify(isMissingOptionalTable ? [] : null), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
});

export { verifySupabaseConnection, type SupabaseDiagnosticResult } from './supabaseDiagnostic';

// Realtime & WebSocket Connection Lifecycle is authoritatively managed in lib/supabaseLifecycle.ts



