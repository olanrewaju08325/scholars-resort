import { authFetch } from '@/lib/apiAuth';

export interface AiUsageLogRow {
  id: string;
  user_id: string | null;
  feature: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  provider: string;
  created_at: string;
  status_verification: 'verified_success' | 'prompt_only_aborted' | 'zero_tokens';
  verification_verdict: string;
  is_valid_deduction: boolean;
  yield_ratio_percent: number;
  estimated_cost_usd: number;
}

export interface AiUsageDiagnosticSummary {
  total_rows_sampled: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  success_count: number;
  failed_count: number;
  zero_token_count: number;
  success_rate_percent: number;
  overall_integrity: string;
}

export interface AiUsageDiagnosticResponse {
  success: boolean;
  total_count: number;
  limit: number;
  offset: number;
  summary: AiUsageDiagnosticSummary;
  rows: AiUsageLogRow[];
  error?: string;
}

export interface AiUsageQueryParams {
  limit?: number;
  offset?: number;
  feature?: string;
  status?: string;
  provider?: string;
  search?: string;
}

export const AiUsageDiagnosticService = {
  async fetchLogs(params: AiUsageQueryParams = {}): Promise<AiUsageDiagnosticResponse> {
    const q = new URLSearchParams();
    if (params.limit) q.set('limit', String(params.limit));
    if (params.offset) q.set('offset', String(params.offset));
    if (params.feature && params.feature !== 'all') q.set('feature', params.feature);
    if (params.status && params.status !== 'all') q.set('status', params.status);
    if (params.provider && params.provider !== 'all') q.set('provider', params.provider);
    if (params.search) q.set('search', params.search);

    try {
      const res = await authFetch(`/api/admin/ai-usage-raw-logs?${q.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      console.error('[AiUsageDiagnosticService fetchLogs error]', err);
      return {
        success: false,
        total_count: 0,
        limit: params.limit || 100,
        offset: params.offset || 0,
        summary: {
          total_rows_sampled: 0,
          total_prompt_tokens: 0,
          total_completion_tokens: 0,
          total_tokens: 0,
          success_count: 0,
          failed_count: 0,
          zero_token_count: 0,
          success_rate_percent: 0,
          overall_integrity: 'Error fetching telemetry'
        },
        rows: [],
        error: err.message
      };
    }
  },

  async runSimulation(prompt?: string): Promise<{ success: boolean; message?: string; log?: AiUsageLogRow; error?: string }> {
    try {
      const res = await authFetch('/api/admin/ai-usage-diagnostics/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async clearSimulationLogs(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await authFetch('/api/admin/ai-usage-raw-logs', {
        method: 'DELETE'
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
