import { supabase } from '@/lib/supabase';

export interface GroqLogEntry {
  id: string;
  timestamp: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  status: 'success' | 'error';
  remainingTokens?: string;
  limitTokens?: string;
  resetTokens?: string;
  remainingRequests?: string;
  limitRequests?: string;
  source: 'server_proxy' | 'client_direct';
}

export interface GroqQuotaInfo {
  remainingTokens: string | null;
  limitTokens: string | null;
  resetTokens: string | null;
  remainingRequests: string | null;
  limitRequests: string | null;
  lastUpdated: string | null;
}

export interface GroqTelemetryData {
  success: boolean;
  quota: GroqQuotaInfo;
  totals: {
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgLatencyMs: number;
  };
  modelUsage: Array<{ model: string; totalTokens: number; calls: number }>;
  logs: GroqLogEntry[];
  serverUptimeSeconds: number;
}

/**
  * Fetches live telemetry data and server logs for Groq API usage.
  */
export const fetchGroqTelemetry = async (groqApiKey?: string): Promise<GroqTelemetryData | null> => {
  try {
    const headers: Record<string, string> = {};
    if (groqApiKey) {
      headers['X-Groq-Key'] = groqApiKey;
    }

    const res = await fetch('/api/groq-telemetry', { headers });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    const data = await res.json();
    
    // Also merge historical token totals from Supabase `ai_usage` table if available
    try {
      const { data: dbLogs } = await supabase
        .from('ai_usage')
        .select('prompt_tokens, completion_tokens, created_at, provider')
        .eq('provider', 'groq');

      if (dbLogs && dbLogs.length > 0) {
        let dbTotalPrompt = 0;
        let dbTotalComp = 0;
        dbLogs.forEach(l => {
          dbTotalPrompt += (l.prompt_tokens || 0);
          dbTotalComp += (l.completion_tokens || 0);
        });

        // Use maximum of server buffer logs and persistent database logs
        if (dbTotalPrompt + dbTotalComp > data.totals.totalTokens) {
          data.totals.totalPromptTokens = dbTotalPrompt;
          data.totals.totalCompletionTokens = dbTotalComp;
          data.totals.totalTokens = dbTotalPrompt + dbTotalComp;
          data.totals.totalRequests = Math.max(data.totals.totalRequests, dbLogs.length);
        }
      }
    } catch {}

    return data;
  } catch (err) {
    console.warn('Error fetching Groq telemetry:', err);
    return null;
  }
};

/**
  * Reports a client-side Groq call to the server log engine.
  */
export const reportGroqCallTelemetry = async (logData: {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  latencyMs?: number;
  status?: 'success' | 'error';
  remainingTokens?: string;
  limitTokens?: string;
  resetTokens?: string;
  remainingRequests?: string;
}) => {
  try {
    // 1. Post to server telemetry endpoint if available
    const res = await fetch('/api/groq-telemetry/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    }).catch(() => null);
    if (!res || !res.ok) {
      // Endpoint not available on static hosting (e.g. Vercel), fail silently
    }
  } catch {}

  try {
    // 2. Persist to Supabase `ai_usage` table
    await supabase.from('ai_usage').insert({
      provider: 'groq',
      feature: 'groq_inference',
      prompt_tokens: logData.promptTokens || 0,
      completion_tokens: logData.completionTokens || 0,
      created_at: new Date().toISOString()
    });
  } catch {}
};
