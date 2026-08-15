import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface AIQuotaStatus {
  tokensUsed: number;
  totalLimit: number;
  warningThresholdPercent: number;
  warningTriggered: boolean;
  apiKey: string;
  provider: 'gemini' | 'groq' | 'openai';
  lastUpdated: string;
}

class AIRateLimiter {
  private requestTimestamps: number[] = [];

  /**
   * Check if request limit has been exceeded (30 requests/min)
   */
  public canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > oneMinuteAgo);

    if (this.requestTimestamps.length >= 30) {
      toast.error('AI request rate limit reached. Please wait a moment before sending more queries.');
      return false;
    }

    this.requestTimestamps.push(now);
    return true;
  }

  /**
   * Log AI token usage and trigger alert if threshold (e.g. 80%) is reached
   */
  public async recordTokenUsage(tokensUsed: number = 500): Promise<AIQuotaStatus | null> {
    try {
      const status = await this.getQuotaStatus();
      const updatedUsed = status.tokensUsed + tokensUsed;
      const usagePercentage = (updatedUsed / status.totalLimit) * 100;
      const isWarning = usagePercentage >= status.warningThresholdPercent;

      const updatedPayload = {
        ...status,
        tokensUsed: updatedUsed,
        warningTriggered: isWarning,
        lastUpdated: new Date().toISOString()
      };

      // Sync to admin_settings
      await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'ai_api_settings',
          setting_value: updatedPayload
        });

      // Sync to platform_config
      await supabase
        .from('platform_config')
        .upsert({
          key: 'ai_api_settings',
          value: updatedPayload
        });

      if (isWarning && !status.warningTriggered) {
        toast.warning(
          `⚠️ AI API Token Alert: ${Math.round(usagePercentage)}% of API token quota used (${updatedUsed.toLocaleString()} / ${status.totalLimit.toLocaleString()}). Update API Key in Admin Panel.`,
          { duration: 8000 }
        );
      }

      return updatedPayload;
    } catch (e) {
      console.warn('AI usage recording warning:', e);
      return null;
    }
  }

  /**
   * Fetch active AI Quota status from database
   */
  public async getQuotaStatus(): Promise<AIQuotaStatus> {
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'ai_api_settings')
        .maybeSingle();

      if (data && data.setting_value) {
        const val = data.setting_value;
        return {
          tokensUsed: val.tokensUsed || 0,
          totalLimit: val.totalLimit || 100000,
          warningThresholdPercent: val.warningThresholdPercent || 80,
          warningTriggered: Boolean(val.warningTriggered),
          apiKey: val.apiKey || '',
          provider: val.provider || 'gemini',
          lastUpdated: val.lastUpdated || new Date().toISOString()
        };
      }
    } catch (e) {
      console.warn('Fetch AI quota notice:', e);
    }

    return {
      tokensUsed: 12400,
      totalLimit: 100000,
      warningThresholdPercent: 80,
      warningTriggered: false,
      apiKey: '',
      provider: 'gemini',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Admin function to update API key and reset quota usage counter
   */
  public async updateKeyAndResetQuota(newApiKey: string, provider: 'gemini' | 'groq' = 'gemini', newTotalLimit: number = 100000) {
    try {
      const newStatus: AIQuotaStatus = {
        tokensUsed: 0,
        totalLimit: newTotalLimit,
        warningThresholdPercent: 80,
        warningTriggered: false,
        apiKey: newApiKey,
        provider,
        lastUpdated: new Date().toISOString()
      };

      await supabase.from('admin_settings').upsert({
        setting_key: 'ai_api_settings',
        setting_value: newStatus
      });

      await supabase.from('platform_config').upsert({
        key: 'ai_api_settings',
        value: newStatus
      });

      toast.success('AI API Key updated & Token Quota reset to 0 tokens!', { duration: 5000 });
      return newStatus;
    } catch (err: any) {
      toast.error('Failed to update AI API key: ' + err.message);
      throw err;
    }
  }
}

export const aiRateLimiter = new AIRateLimiter();

