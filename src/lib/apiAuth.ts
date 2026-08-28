import { supabase } from './supabase';

/**
 * Returns authorization headers including the current Supabase session Bearer token.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn('[apiAuth] Error reading auth session:', err);
  }

  return headers;
}

/**
 * Helper to perform an authenticated fetch with current Supabase Bearer token
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const mergedHeaders = {
    ...authHeaders,
    ...(options.headers || {})
  };

  return fetch(url, {
    ...options,
    headers: mergedHeaders
  });
}
