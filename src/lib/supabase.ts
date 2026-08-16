import { createClient } from '@supabase/supabase-js';

// Load from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn('⚠️ Supabase environment variables missing! If deployed on Netlify, please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify Site Settings -> Environment variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder_key'
);

export { verifySupabaseConnection, type SupabaseDiagnosticResult } from './supabaseDiagnostic';

