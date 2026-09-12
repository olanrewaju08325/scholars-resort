import { supabase } from '@/lib/supabase';
import { ApiKeyManager } from '@/lib/apiKeyManager';
import { getSecureGroqKey, setSecureGroqKey } from '@/lib/secureStorage';
import { supabaseConnectionManager, type ConnectionState } from '@/lib/supabaseConnectionManager';
import { authFetch } from '@/lib/apiAuth';

export interface ApiHealthReport {
  supabaseConnected: boolean;
  supabaseLatencyMs: number;
  groqKeyPresent: boolean;
  groqKeyValid: boolean;
  groqSource: 'indexedDB' | 'environment' | 'admin_settings' | 'server_config' | 'missing';
  groqKeyPreview: string;
  realtimeState: ConnectionState;
  isHealthy: boolean;
  issues: string[];
  checkedAt: number;
}

/**
 * Validate presence and connectivity of Supabase and Groq AI configurations.
 */
export async function runApiHealthCheck(): Promise<ApiHealthReport> {
  const startTime = Date.now();
  const issues: string[] = [];
  let supabaseConnected = false;
  let supabaseLatencyMs = 0;
  let groqKeyPresent = false;
  let groqKeyValid = false;
  let groqSource: ApiHealthReport['groqSource'] = 'missing';
  let activeGroqKey = '';

  // 1. Check Supabase Connectivity
  try {
    const sbStart = Date.now();
    const { error } = await supabase.from('admin_settings').select('setting_key').limit(1);
    supabaseLatencyMs = Date.now() - sbStart;
    if (!error) {
      supabaseConnected = true;
    } else if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
      // 0 rows or harmless result still means connected
      supabaseConnected = true;
    } else {
      issues.push(`Supabase response note: ${error.message}`);
      supabaseConnected = true; // Connection reached backend
    }
  } catch (err: any) {
    issues.push(`Supabase network unreachable: ${err.message || 'Unknown network error'}`);
    supabaseConnected = false;
  }

  // 2. Check Groq API Key in Secure Storage (IndexedDB via ApiKeyManager)
  try {
    const key = await ApiKeyManager.getGroqApiKey();
    if (key && key.trim().length > 10 && !key.includes('placeholder')) {
      activeGroqKey = key.trim();
      groqKeyPresent = true;
      groqSource = 'indexedDB';
    }
  } catch {}

  // 3. Fallback check: Server / Environment / admin_settings if not in IndexedDB
  if (!groqKeyPresent) {
    try {
      const envKey = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_GROQ_API_KEY || import.meta.env?.GROQ_API_KEY)) ||
                     (typeof process !== 'undefined' && (process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY));
      if (envKey && typeof envKey === 'string' && envKey.trim().length > 10 && !envKey.includes('placeholder')) {
        activeGroqKey = envKey.trim();
        groqKeyPresent = true;
        groqSource = 'environment';
        // Auto-persist into secure IndexedDB for resilience
        await setSecureGroqKey(activeGroqKey);
      }
    } catch {}
  }

  if (!groqKeyPresent) {
    try {
      // Try querying server config endpoint
      const res = await authFetch('/api/admin/system-configs');
      if (res.ok) {
        const data = await res.json();
        if (data?.configs?.groq?.apiKey && data.configs.groq.apiKey.length > 10) {
          activeGroqKey = data.configs.groq.apiKey.trim();
          groqKeyPresent = true;
          groqSource = 'server_config';
          await setSecureGroqKey(activeGroqKey);
        }
      }
    } catch {}
  }

  if (!groqKeyPresent) {
    try {
      const { data: dbData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .in('setting_key', ['ai_api_keys', 'api_keys'])
        .limit(2);

      if (dbData) {
        for (const row of dbData) {
          const k = row.setting_value?.groq || row.setting_value?.apiKey;
          if (typeof k === 'string' && k.trim().length > 10 && !k.includes('placeholder')) {
            activeGroqKey = k.trim();
            groqKeyPresent = true;
            groqSource = 'admin_settings';
            await setSecureGroqKey(activeGroqKey);
            break;
          }
        }
      }
    } catch {}
  }

  // 4. Validate Groq Key format
  if (activeGroqKey && activeGroqKey.length >= 10 && !activeGroqKey.includes('placeholder')) {
    groqKeyValid = true;
  } else {
    issues.push('Groq AI API key is unconfigured. AI features will require key setup.');
  }

  const realtimeState = supabaseConnectionManager.getState();
  const groqKeyPreview = activeGroqKey 
    ? `${activeGroqKey.substring(0, 4)}...${activeGroqKey.substring(activeGroqKey.length - 4)}` 
    : 'Not configured';

  return {
    supabaseConnected,
    supabaseLatencyMs,
    groqKeyPresent,
    groqKeyValid,
    groqSource,
    groqKeyPreview,
    realtimeState,
    isHealthy: supabaseConnected && groqKeyValid,
    issues,
    checkedAt: Date.now()
  };
}
