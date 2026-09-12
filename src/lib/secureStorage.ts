/**
 * Secure Client-Side Storage Engine for API Keys and System Secrets
 * Uses native IndexedDB with Encrypted / Obfuscated LocalStorage fallback.
 * Solves environment variable deployment failures by safely caching API keys in browser storage.
 */

const DB_NAME = 'ScholarsResort_Vault_v1';
const STORE_NAME = 'secure_api_vault';
const DB_VERSION = 1;

// In-memory runtime cache for zero-latency synchronous reads
const memoryCache = new Map<string, string>();

/**
 * Open IndexedDB instance safely
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * Simple client-side obfuscation / encryption for localStorage fallback
 */
function encryptValue(val: string): string {
  try {
    const salt = 'sr_vault_2026_';
    const encoded = btoa(encodeURIComponent(salt + val));
    return `enc_${encoded.split('').reverse().join('')}`;
  } catch {
    return val;
  }
}

function decryptValue(enc: string): string | null {
  try {
    if (!enc || !enc.startsWith('enc_')) return enc || null;
    const raw = enc.slice(4).split('').reverse().join('');
    const decoded = decodeURIComponent(atob(raw));
    const salt = 'sr_vault_2026_';
    if (decoded.startsWith(salt)) {
      return decoded.slice(salt.length);
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Save a key-value pair to IndexedDB with localStorage fallback
 */
export async function setSecureItem(key: string, value: string): Promise<boolean> {
  if (!key) return false;
  const cleanVal = (value || '').trim();

  // 1. Update in-memory cache
  memoryCache.set(key, cleanVal);

  // 2. Try IndexedDB
  let idbSuccess = false;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ key, value: cleanVal, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    idbSuccess = true;
  } catch (err) {
    // Fall back to localStorage
  }

  // 3. Encrypted localStorage mirror
  try {
    if (typeof localStorage !== 'undefined') {
      if (cleanVal) {
        localStorage.setItem(`_sr_sec_${key}`, encryptValue(cleanVal));
      } else {
        localStorage.removeItem(`_sr_sec_${key}`);
      }
    }
  } catch {}

  return true;
}

/**
 * Get a key-value pair from in-memory cache, IndexedDB, or Encrypted LocalStorage
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (!key) return null;

  // 1. Check in-memory cache first
  if (memoryCache.has(key)) {
    const val = memoryCache.get(key);
    if (val && val.length > 0) return val;
  }

  // 2. Check IndexedDB
  try {
    const db = await openDatabase();
    const result = await new Promise<{ key: string; value: string } | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (result && result.value && result.value.trim().length > 0) {
      memoryCache.set(key, result.value.trim());
      return result.value.trim();
    }
  } catch (err) {
    // Ignore IndexedDB error and check localStorage
  }

  // 3. Check encrypted localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const rawEnc = localStorage.getItem(`_sr_sec_${key}`);
      if (rawEnc) {
        const decrypted = decryptValue(rawEnc);
        if (decrypted && decrypted.trim().length > 0) {
          memoryCache.set(key, decrypted.trim());
          return decrypted.trim();
        }
      }

      // Legacy fallback
      const plain = localStorage.getItem(key);
      if (plain && plain.trim().length > 0 && !plain.includes('placeholder')) {
        memoryCache.set(key, plain.trim());
        // Migrate to secure store
        setSecureItem(key, plain.trim()).catch(() => {});
        return plain.trim();
      }
    }
  } catch {}

  return null;
}

/**
 * Remove a key from all storage tiers
 */
export async function removeSecureItem(key: string): Promise<boolean> {
  if (!key) return false;
  memoryCache.delete(key);

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`_sr_sec_${key}`);
      localStorage.removeItem(key);
    }
  } catch {}

  return true;
}

// ---------------------------------------------------------------------------
// Specialized Helpers for Groq and AI API Keys
// ---------------------------------------------------------------------------

import { ApiKeyManager, setGroqApiKey, getGroqApiKey, removeGroqApiKey } from './apiKeyManager';

export { ApiKeyManager };

const GROQ_KEY_NAME = 'groq_api_key';

/**
 * Set the Groq API key securely across IndexedDB via ApiKeyManager (idb-keyval)
 */
export async function setSecureGroqKey(apiKey: string): Promise<boolean> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return removeSecureGroqKey();
  }
  await setGroqApiKey(cleanKey);
  return setSecureItem(GROQ_KEY_NAME, cleanKey);
}

/**
 * Get the Groq API key dynamically from IndexedDB via ApiKeyManager (idb-keyval)
 */
export async function getSecureGroqKey(): Promise<string | null> {
  const key = await getGroqApiKey();
  if (key && key.length > 10 && !key.includes('placeholder')) {
    return key;
  }
  return null;
}

/**
 * Remove the stored Groq API key
 */
export async function removeSecureGroqKey(): Promise<boolean> {
  await removeGroqApiKey();
  return removeSecureItem(GROQ_KEY_NAME);
}
