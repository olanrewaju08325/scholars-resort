import { toast } from 'sonner';

export interface TokenQuotaStatus {
  totalTokenBudget: number;
  tokensUsed: number;
  tokensRemaining: number;
  percentRemaining: number;
  percentUsed: number;
  dailyCallBudget: number;
  callsMadeToday: number;
  callsRemaining: number;
  isLowQuota: boolean; // true when remaining <= 20%
  isDepleted: boolean;
  statusMessage: string;
  lastUpdated: string;
}

type QuotaListener = (status: TokenQuotaStatus) => void;

const DEFAULT_TOKEN_BUDGET = 2_000_000; // 2 Million tokens standard monthly allocation
const DEFAULT_DAILY_CALLS = 1_000;      // 1000 AI requests/day

const STORAGE_KEY_TOKENS = 'scholars_ai_tokens_used';
const STORAGE_KEY_CALLS = 'scholars_ai_calls_today';
const STORAGE_KEY_ALERT_DISMISSED = 'scholars_ai_low_quota_alert_dismissed';

class AiUsageMonitoringServiceClass {
  private listeners: Set<QuotaListener> = new Set();
  private hasTriggeredLowQuotaToast = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY_TOKENS || e.key === STORAGE_KEY_CALLS) {
          this.notifyListeners();
        }
      });
    }
  }

  /**
   * Calculates current token quota health
   */
  public getQuotaStatus(): TokenQuotaStatus {
    let tokensUsed = 0;
    let callsToday = 0;

    if (typeof window !== 'undefined') {
      try {
        tokensUsed = Number(localStorage.getItem(STORAGE_KEY_TOKENS) || 0);
        callsToday = Number(sessionStorage.getItem(STORAGE_KEY_CALLS) || 0);
      } catch {
        // fallback
      }
    }

    const tokensRemaining = Math.max(0, DEFAULT_TOKEN_BUDGET - tokensUsed);
    const percentUsed = Math.min(100, Math.round((tokensUsed / DEFAULT_TOKEN_BUDGET) * 100));
    const percentRemaining = Math.max(0, 100 - percentUsed);

    const callsRemaining = Math.max(0, DEFAULT_DAILY_CALLS - callsToday);
    const isLowQuota = percentRemaining <= 20 || callsRemaining <= (DEFAULT_DAILY_CALLS * 0.2);
    const isDepleted = tokensRemaining <= 0 || callsRemaining <= 0;

    let statusMessage = 'AI Token Quota Healthy';
    if (isDepleted) {
      statusMessage = 'AI Token Quota Exhausted. System running in cached-only mode.';
    } else if (isLowQuota) {
      statusMessage = `Warning: AI Token Quota Low (${percentRemaining}% remaining, ~${tokensRemaining.toLocaleString()} tokens left).`;
    }

    return {
      totalTokenBudget: DEFAULT_TOKEN_BUDGET,
      tokensUsed,
      tokensRemaining,
      percentRemaining,
      percentUsed,
      dailyCallBudget: DEFAULT_DAILY_CALLS,
      callsMadeToday: callsToday,
      callsRemaining,
      isLowQuota,
      isDepleted,
      statusMessage,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Records token and request consumption
   */
  public recordUsage(estimatedTokens: number = 450, calls: number = 1): TokenQuotaStatus {
    let tokensUsed = 0;
    let callsToday = 0;

    if (typeof window !== 'undefined') {
      try {
        const currentTokens = Number(localStorage.getItem(STORAGE_KEY_TOKENS) || 0);
        const currentCalls = Number(sessionStorage.getItem(STORAGE_KEY_CALLS) || 0);

        tokensUsed = currentTokens + estimatedTokens;
        callsToday = currentCalls + calls;

        localStorage.setItem(STORAGE_KEY_TOKENS, String(tokensUsed));
        sessionStorage.setItem(STORAGE_KEY_CALLS, String(callsToday));
      } catch {
        // fallback
      }
    }

    const status = this.getQuotaStatus();
    this.checkAndTriggerLowQuotaAlert(status);
    this.notifyListeners(status);
    return status;
  }

  /**
   * Resets local usage tracking (for testing/admin quota reload)
   */
  public resetQuotaTracking(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY_TOKENS);
        sessionStorage.removeItem(STORAGE_KEY_CALLS);
        sessionStorage.removeItem(STORAGE_KEY_ALERT_DISMISSED);
        this.hasTriggeredLowQuotaToast = false;
      } catch {}
    }
    this.notifyListeners();
  }

  /**
   * Triggers a toast alert when quota drops below 20%
   */
  private checkAndTriggerLowQuotaAlert(status: TokenQuotaStatus): void {
    if (status.isLowQuota && !this.hasTriggeredLowQuotaToast) {
      const dismissed = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY_ALERT_DISMISSED) : null;
      if (!dismissed) {
        this.hasTriggeredLowQuotaToast = true;
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(STORAGE_KEY_ALERT_DISMISSED, 'true');
        }

        toast.warning(`⚠️ AI Token Quota Alert (${status.percentRemaining}% remaining)`, {
          description: `You have ~${status.tokensRemaining.toLocaleString()} tokens (${status.callsRemaining} calls) remaining before your allocation is exhausted. Cached questions continue to work at zero cost.`,
          duration: 9000,
          action: {
            label: 'View Quota',
            onClick: () => {
              window.dispatchEvent(new CustomEvent('open-ai-quota-modal'));
            }
          }
        });
      }
    }
  }

  /**
   * Subscribe to quota updates
   */
  public subscribe(listener: QuotaListener): () => void {
    this.listeners.add(listener);
    // Trigger initial status
    listener(this.getQuotaStatus());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(status?: TokenQuotaStatus): void {
    const currentStatus = status || this.getQuotaStatus();
    this.listeners.forEach(listener => {
      try {
        listener(currentStatus);
      } catch (err) {
        console.warn('[AiUsageMonitoringService] Listener error:', err);
      }
    });
  }
}

export const AiUsageMonitoringService = new AiUsageMonitoringServiceClass();
