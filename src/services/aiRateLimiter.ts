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

export interface StudentDailyLimits {
  monthly_token_limit: number;
  student_daily_free_limit: number;
  student_daily_pro_limit: number;
  student_daily_token_limit: number;
}

class AIRateLimiter {
  private requestTimestamps: number[] = [];

  /**
   * Fetch student daily limit settings from admin_settings or platform_config
   */
  public async getStudentDailyLimits(): Promise<StudentDailyLimits> {
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'ai_limits')
        .maybeSingle();

      if (data?.setting_value) {
        return {
          monthly_token_limit: Number(data.setting_value.monthly_token_limit) || 5000000,
          student_daily_free_limit: Number(data.setting_value.student_daily_free_limit) || 10,
          student_daily_pro_limit: Number(data.setting_value.student_daily_pro_limit) || 100,
          student_daily_token_limit: Number(data.setting_value.student_daily_token_limit) || 25000
        };
      }
    } catch (_) {}

    return {
      monthly_token_limit: 5000000,
      student_daily_free_limit: 10,
      student_daily_pro_limit: 100,
      student_daily_token_limit: 25000
    };
  }

  /**
   * Check if a student has exceeded their daily AI query quota
   */
  public async checkStudentDailyQuota(userId: string, isPro: boolean = false): Promise<{ allowed: boolean; remaining: number; maxLimit: number; warning?: string }> {
    try {
      const limits = await this.getStudentDailyLimits();
      const maxLimit = isPro ? limits.student_daily_pro_limit : limits.student_daily_free_limit;

      // Count queries made today (UTC day)
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('ai_usage')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfDay.toISOString());

      const usedToday = (!error && typeof count === 'number') ? count : 0;
      const remaining = Math.max(0, maxLimit - usedToday);

      if (usedToday >= maxLimit) {
        return {
          allowed: false,
          remaining: 0,
          maxLimit,
          warning: isPro 
            ? `You have reached your daily Pro limit of ${maxLimit} AI requests. Please try again tomorrow!`
            : `You have reached your Free daily limit of ${maxLimit} AI questions. Upgrade to Pro for ${limits.student_daily_pro_limit} questions/day!`
        };
      }

      return { allowed: true, remaining, maxLimit };
    } catch (_) {
      return { allowed: true, remaining: 10, maxLimit: 10 };
    }
  }

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
          provider: val.provider || 'groq',
          lastUpdated: val.lastUpdated || new Date().toISOString()
        };
      }
    } catch (e) {
      console.warn('Fetch AI quota notice:', e);
    }

    return {
      tokensUsed: 0,
      totalLimit: 100000,
      warningThresholdPercent: 80,
      warningTriggered: false,
      apiKey: '',
      provider: 'groq',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Admin function to update API key and reset quota usage counter
   */
  public async updateKeyAndResetQuota(newApiKey: string, provider: 'gemini' | 'groq' = 'groq', newTotalLimit: number = 100000) {
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

