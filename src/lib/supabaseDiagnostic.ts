import { supabase } from './supabase';

export interface SupabaseDiagnosticResult {
  initialized: boolean;
  hasUrl: boolean;
  hasAnonKey: boolean;
  urlPreview: string;
  canFetchProfiles: boolean;
  latencyMs: number;
  profilesCount?: number;
  error?: string | null;
  timestamp: string;
}

/**
 * Diagnostic utility function to verify that the Supabase client is correctly
 * initialized with the provided environment variables and can successfully
 * perform a simple fetch operation against the 'profiles' table.
 */
export async function verifySupabaseConnection(): Promise<SupabaseDiagnosticResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  const hasUrl = Boolean(supabaseUrl && supabaseUrl.startsWith('http') && !supabaseUrl.includes('placeholder'));
  const hasAnonKey = Boolean(supabaseAnonKey && supabaseAnonKey.length > 20 && !supabaseAnonKey.includes('placeholder'));
  const initialized = hasUrl && hasAnonKey && Boolean(supabase);

  const start = performance.now();
  let canFetchProfiles = false;
  let errorMsg: string | null = null;
  let profilesCount = 0;

  try {
    const { data, error, count } = await supabase
      .from('profiles')
      .select('id, full_name, role', { count: 'exact', head: false })
      .limit(5);

    if (error) {
      errorMsg = error.message;
      canFetchProfiles = false;
    } else {
      canFetchProfiles = true;
      profilesCount = count ?? (data ? data.length : 0);
    }
  } catch (err: any) {
    errorMsg = err?.message || 'Unknown network or query error';
    canFetchProfiles = false;
  }

  const latencyMs = Math.round(performance.now() - start);

  return {
    initialized,
    hasUrl,
    hasAnonKey,
    urlPreview: hasUrl ? supabaseUrl.replace(/^(https:\/\/[^.]+).*/, '$1.supabase.co') : 'missing',
    canFetchProfiles,
    latencyMs,
    profilesCount,
    error: errorMsg,
    timestamp: new Date().toISOString()
  };
}
