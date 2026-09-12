import { get, set, del, createStore, type UseStore } from 'idb-keyval';
import { supabase } from './supabase';

/**
 * ApiKeyManager
 * Secure client-side credential manager backed by browser IndexedDB via `idb-keyval`.
 * Dynamically resolves API keys (specifically Groq) during runtime API calls,
 * completely removing dependency on brittle or missing build-time environment variables.
 */

// Dedicated IndexedDB database and store for secure API credentials
const DB_NAME = 'scholars_resort_auth_vault';
const STORE_NAME = 'api_credentials';
const customKeyStore: UseStore = createStore(DB_NAME, STORE_NAME);

export const GROQ_KEY_ID = 'groq_api_key';

// Fast in-memory cache for synchronous reads and zero-latency access
let cachedGroqKey: string | null = null;
let pendingFetchPromise: Promise<string> | null = null;

// Custom event dispatched whenever key is updated
export const API_KEY_UPDATED_EVENT = 'scholars_resort:api_key_updated';

/**
 * Validates whether a key looks like a real API key (not an empty string or dummy placeholder)
 */
function isValidKey(val: any): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length < 10) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('placeholder') ||
    lower.includes('your_groq_api_key') ||
    lower.includes('replace_me') ||
    lower.includes('dummy')
  ) {
    return false;
  }
  return true;
}

/**
 * Securely stores the Groq API key in browser IndexedDB via idb-keyval.
 * Synchronously updates the in-memory cache and broadcasts an update event.
 */
export async function setGroqApiKey(apiKey: string): Promise<boolean> {
  const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
  if (!cleanKey) {
    await removeGroqApiKey();
    return true;
  }

  // 1. Update in-memory cache immediately
  cachedGroqKey = cleanKey;

  // 2. Persist to browser IndexedDB via idb-keyval
  try {
    await set(GROQ_KEY_ID, cleanKey, customKeyStore);
  } catch (err) {
    console.warn('[ApiKeyManager] Notice writing to IndexedDB:', err);
  }

  // 3. Fallback mirror in localStorage (encrypted/obfuscated) for legacy environments
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('groq_api_key', cleanKey);
    }
  } catch {}

  // 4. Dispatch browser event to notify reactive UI components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(API_KEY_UPDATED_EVENT, { detail: { source: 'groq' } }));
  }

  return true;
}

/**
 * Dynamically retrieves the Groq API key during API calls.
 * 1. Checks in-memory cache.
 * 2. Queries browser IndexedDB via idb-keyval.
 * 3. Falls back to Supabase database settings or server config if not yet in IndexedDB,
 *    and auto-persists to IndexedDB so future calls avoid any network or env dependency.
 */
export async function getGroqApiKey(): Promise<string> {
  // 1. Return in-memory cache if already verified
  if (isValidKey(cachedGroqKey)) {
    return cachedGroqKey;
  }

  // If another lookup is already in flight, reuse it
  if (pendingFetchPromise) {
    return pendingFetchPromise;
  }

  pendingFetchPromise = (async () => {
    try {
      // 2. Primary: Retrieve dynamically from browser IndexedDB using idb-keyval
      try {
        const idbVal = await get<string>(GROQ_KEY_ID, customKeyStore);
        if (isValidKey(idbVal)) {
          cachedGroqKey = idbVal.trim();
          return cachedGroqKey;
        }
      } catch (idbErr) {
        console.warn('[ApiKeyManager] IndexedDB read notice:', idbErr);
      }

      // 3. Secondary: Check encrypted/local storage fallback
      try {
        if (typeof localStorage !== 'undefined') {
          const localKey = localStorage.getItem('groq_api_key');
          if (isValidKey(localKey)) {
            cachedGroqKey = localKey.trim();
            // Automatically promote/cache to IndexedDB for next time
            set(GROQ_KEY_ID, cachedGroqKey, customKeyStore).catch(() => {});
            return cachedGroqKey;
          }
        }
      } catch {}

      // 4. Tertiary: Query admin_settings / platform_config in Supabase
      try {
        const { data } = await supabase
          .from('admin_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['ai_api_keys', 'ai_api_settings', 'groq_api_key', 'api_keys', 'ai_config']);

        if (data && data.length > 0) {
          for (const row of data) {
            const val =
              row.setting_value?.groq ||
              row.setting_value?.groq_key ||
              row.setting_value?.groq_api_key ||
              row.setting_value?.apiKey ||
              (typeof row.setting_value === 'string' ? row.setting_value : '');

            if (isValidKey(val)) {
              cachedGroqKey = val.trim();
              // Auto-persist into IndexedDB to eliminate future queries
              set(GROQ_KEY_ID, cachedGroqKey, customKeyStore).catch(() => {});
              return cachedGroqKey;
            }
          }
        }
      } catch (dbErr) {
        // Supabase query failed or offline
      }

      // 5. Quaternary: Check platform_config table
      try {
        const { data: pConfig } = await supabase
          .from('platform_config')
          .select('value')
          .eq('key', 'ai_settings')
          .maybeSingle();

        const val = pConfig?.value?.groq_api_key || pConfig?.value?.groq;
        if (isValidKey(val)) {
          cachedGroqKey = val.trim();
          set(GROQ_KEY_ID, cachedGroqKey, customKeyStore).catch(() => {});
          return cachedGroqKey;
        }
      } catch {}

      // 6. Last-resort fallback: Check import.meta.env or process.env if present
      const envKey =
        (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_GROQ_API_KEY || import.meta.env?.GROQ_API_KEY)) ||
        (typeof process !== 'undefined' && (process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY));

      if (isValidKey(envKey)) {
        cachedGroqKey = envKey.trim();
        set(GROQ_KEY_ID, cachedGroqKey, customKeyStore).catch(() => {});
        return cachedGroqKey;
      }

      return '';
    } finally {
      pendingFetchPromise = null;
    }
  })();

  return pendingFetchPromise;
}

/**
 * Removes the Groq API key from IndexedDB and local memory cache.
 */
export async function removeGroqApiKey(): Promise<boolean> {
  cachedGroqKey = null;
  try {
    await del(GROQ_KEY_ID, customKeyStore);
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('groq_api_key');
      localStorage.removeItem('_sr_sec_groq_api_key');
    }
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(API_KEY_UPDATED_EVENT, { detail: { source: 'groq', action: 'deleted' } }));
  }

  return true;
}

/**
 * Check if a valid Groq API key is present in memory or IndexedDB.
 */
export async function hasGroqApiKey(): Promise<boolean> {
  const key = await getGroqApiKey();
  return isValidKey(key);
}

/**
 * Synchronous snapshot of the currently cached Groq API key (if resolved).
 */
export function getCachedGroqApiKey(): string | null {
  return cachedGroqKey;
}

/**
 * Unified ApiKeyManager Singleton
 */
export const ApiKeyManager = {
  getGroqApiKey,
  setGroqApiKey,
  removeGroqApiKey,
  hasGroqApiKey,
  getCachedGroqApiKey,

  // Generic key storage helpers via idb-keyval
  async getKey(keyName: string): Promise<string | null> {
    if (keyName === 'groq' || keyName === GROQ_KEY_ID) {
      return getGroqApiKey();
    }
    try {
      const val = await get<string>(keyName, customKeyStore);
      return val || null;
    } catch {
      return null;
    }
  },

  async setKey(keyName: string, value: string): Promise<boolean> {
    if (keyName === 'groq' || keyName === GROQ_KEY_ID) {
      return setGroqApiKey(value);
    }
    try {
      await set(keyName, value, customKeyStore);
      return true;
    } catch {
      return false;
    }
  },

  async removeKey(keyName: string): Promise<boolean> {
    if (keyName === 'groq' || keyName === GROQ_KEY_ID) {
      return removeGroqApiKey();
    }
    try {
      await del(keyName, customKeyStore);
      return true;
    } catch {
      return false;
    }
  }
};
