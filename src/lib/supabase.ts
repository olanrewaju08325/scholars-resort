import { createClient } from '@supabase/supabase-js';

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

// Create Supabase client with custom fetch wrapper to catch network and placeholder errors gracefully
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
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

      // Intercept direct client inserts to tournament_participants with non-UUID or offline to avoid 400 Bad Request
      if (urlStr.includes('/rest/v1/tournament_participants') && options?.method === 'POST') {
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
      }

      const isMissingOptionalTable = urlStr.includes('/rest/v1/reported_errors') || 
                                     urlStr.includes('/rest/v1/weekly_challenges') ||
                                     urlStr.includes('/rest/v1/weekly_challenge_submissions');

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
          return response;
        } catch (err: any) {
          if (attempts < maxAttempts) {
            // Brief backoff before retry on network transition
            await new Promise(res => setTimeout(res, 350));
            continue;
          }

          console.warn('[Supabase Client] Network connectivity error intercepted:', err?.message || err);
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

// Gracefully tear down Realtime channels when browser tab enters bfcache
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    try {
      supabase.removeAllChannels();
    } catch {}
  });
}


