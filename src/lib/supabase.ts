import { createClient } from '@supabase/supabase-js';

// Load from environment variables
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  rawSupabaseUrl && 
  rawSupabaseAnonKey && 
  rawSupabaseUrl.startsWith('http') &&
  !rawSupabaseUrl.includes('placeholder') &&
  !rawSupabaseAnonKey.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ Supabase environment variables missing or using placeholder values! ' +
    'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment configuration.'
  );
}

const supabaseUrl = isSupabaseConfigured ? rawSupabaseUrl : 'https://placeholder.supabase.co';
const supabaseAnonKey = isSupabaseConfigured ? rawSupabaseAnonKey : 'placeholder_key';

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

      // 2. Perform real fetch with graceful network error handling to prevent unhandled 'Failed to fetch' console errors
      try {
        const response = await fetch(url, options);
        return response;
      } catch (err: any) {
        console.warn('[Supabase Client] Network connectivity error intercepted:', err?.message || err);
        return new Response(
          JSON.stringify({ 
            error: {
              message: `Database connection failed (${err?.message || 'Network offline'}). Please check your internet connection.`,
              code: 'FETCH_ERROR',
              details: err?.message
            }, 
            data: null 
          }), 
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
  }
});

export { verifySupabaseConnection, type SupabaseDiagnosticResult } from './supabaseDiagnostic';


