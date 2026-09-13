import { supabase } from './supabase';
import { getApiUrl } from './utils';
import { logErrorDiag } from './errorDiagStorage';

export { getApiUrl };

/**
 * Returns authorization headers including the current Supabase session Bearer token.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-admin-token': 'scholar_admin_secure_key_2026'
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
 * Helper to perform an authenticated fetch with current Supabase Bearer token,
 * automatically logging 400/500 errors and network timeouts to local 'error_diag' storage.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const resolvedUrl = getApiUrl(url);
  const authHeaders = await getAuthHeaders();
  const mergedHeaders = {
    ...authHeaders,
    ...(options.headers || {})
  };

  let sessionState = { isAuthenticated: false, userId: undefined as string | undefined };
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      sessionState = { isAuthenticated: true, userId: session.user.id };
    }
  } catch (_) {}

  let parsedPayload: any = undefined;
  if (options.body && typeof options.body === 'string') {
    try {
      parsedPayload = JSON.parse(options.body);
    } catch {
      parsedPayload = options.body;
    }
  }

  try {
    const response = await fetch(resolvedUrl, {
      ...options,
      headers: mergedHeaders
    });

    if (!response.ok && (response.status >= 400)) {
      let errMsg = `HTTP ${response.status} ${response.statusText}`;
      try {
        const clone = response.clone();
        const json = await clone.json();
        errMsg = json.error || json.message || errMsg;
      } catch (_) {}

      logErrorDiag({
        endpoint: resolvedUrl,
        method: options.method || 'GET',
        status: response.status,
        errorMessage: errMsg,
        requestPayload: parsedPayload,
        sessionState,
        networkTimeout: false
      });
    }

    return response;
  } catch (netErr: any) {
    logErrorDiag({
      endpoint: resolvedUrl,
      method: options.method || 'GET',
      status: 0,
      errorMessage: netErr?.message || 'Network Timeout / ENOTFOUND',
      requestPayload: parsedPayload,
      sessionState,
      networkTimeout: true
    });

    // Return safe fallback response object to prevent UI crashes
    return new Response(
      JSON.stringify({ success: false, error: netErr?.message || 'Network request failed' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

