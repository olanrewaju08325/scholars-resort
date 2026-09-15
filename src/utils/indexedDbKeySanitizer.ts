/**
 * IndexedDB Key Sanitization & Type Validation Utility
 * 
 * IndexedDB strictly supports only specific types as keys:
 * - String (non-empty, non-null)
 * - Number (finite, not NaN)
 * - Date (valid timestamps)
 * - ArrayBuffer / Array of valid keys
 * 
 * Passing objects, undefined, null, NaN, or boolean causes
 * "TypeError: Failed to execute '...' on 'IDBObjectStore': Invalid key provided".
 * This utility guarantees keys are strictly validated and serialized before
 * reaching Dexie or native IndexedDB operations.
 */

/**
 * Validates if a value is natively supported by IndexedDB as a valid primary/index key.
 */
export function isValidIndexedDbKey(key: unknown): boolean {
  if (key === null || key === undefined) return false;

  if (typeof key === 'string') {
    return key.trim().length > 0 && key !== 'undefined' && key !== 'null' && key !== '[object Object]';
  }

  if (typeof key === 'number') {
    return !Number.isNaN(key) && Number.isFinite(key);
  }

  if (key instanceof Date) {
    return !Number.isNaN(key.getTime());
  }

  if (Array.isArray(key)) {
    return key.length > 0 && key.every(isValidIndexedDbKey);
  }

  return false;
}

/**
 * Strict sanitizer that converts any arbitrary input into a safe, valid IndexedDB key string.
 * Extracts nested IDs if an object/profile is mistakenly passed.
 */
export function sanitizeIndexedDbKey(key: unknown, fallback: string = 'guest_session'): string {
  if (key === null || key === undefined) {
    return fallback;
  }

  // Handle direct string
  if (typeof key === 'string') {
    const trimmed = key.trim();
    if (trimmed && trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== '[object Object]') {
      return trimmed;
    }
    return fallback;
  }

  // Handle number
  if (typeof key === 'number') {
    if (!Number.isNaN(key) && Number.isFinite(key)) {
      return String(key);
    }
    return fallback;
  }

  // Handle Date
  if (key instanceof Date) {
    if (!Number.isNaN(key.getTime())) {
      return key.toISOString();
    }
    return fallback;
  }

  // Handle Array
  if (Array.isArray(key)) {
    if (key.length > 0) {
      const firstValid = key.find(isValidIndexedDbKey);
      if (firstValid !== undefined) {
        return sanitizeIndexedDbKey(firstValid, fallback);
      }
    }
    return fallback;
  }

  // Handle objects like User Profile or Auth objects: { id: '...', userId: '...' }
  if (typeof key === 'object') {
    const obj = key as Record<string, any>;
    if (obj.id) return sanitizeIndexedDbKey(obj.id, fallback);
    if (obj.userId) return sanitizeIndexedDbKey(obj.userId, fallback);
    if (obj.user_id) return sanitizeIndexedDbKey(obj.user_id, fallback);
    if (obj.sub) return sanitizeIndexedDbKey(obj.sub, fallback);
    if (obj.sessionId) return sanitizeIndexedDbKey(obj.sessionId, fallback);
    if (obj.session_id) return sanitizeIndexedDbKey(obj.session_id, fallback);
  }

  return fallback;
}

/**
 * Sanitizes numeric auto-increment or integer keys
 */
export function sanitizeNumericKey(key: unknown): number | null {
  if (typeof key === 'number' && !Number.isNaN(key) && Number.isFinite(key)) {
    return key;
  }
  if (typeof key === 'string') {
    const parsed = parseInt(key, 10);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}
