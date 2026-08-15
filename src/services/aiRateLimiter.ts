import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface RateLimiterConfig {
  maxRequestsPerMinute: number;
  tokenWarningThreshold: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  maxRequestsPerMinute: 30,
  tokenWarningThreshold: 80,
};

class AIRateLimiter {
  private requestTimestamps: number[] = [];

  /**
   * Check if request limit has been exceeded
   */
  public canMakeRequest(): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    this.requestTimestamps = this.requestTimestamps.filter((t) => t > oneMinuteAgo);

    if (this.requestTimestamps.length >= DEFAULT_CONFIG.maxRequestsPerMinute) {
      toast.error('AI request rate limit reached. Please wait 30 seconds.');
      return false;
    }

    this.requestTimestamps.push(now);
    return true;
  }

  /**
   * Log AI token usage and check quota warnings
   */
  public async recordTokenUsage(tokensUsed: number = 500) {
    try {
      const { data } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'ai_api_settings')
        .maybeSingle();

      if (data && data.value) {
        const currentUsage = (data.value.token_usage_count || 0) + tokensUsed;
        const threshold = data.value.quota_warning_threshold || 80;

        await supabase
          .from('platform_config')
          .update({
            value: { ...data.value, token_usage_count: currentUsage }
          })
          .eq('key', 'ai_api_settings');

        // Check if usage exceeded threshold (e.g. 50,000 tokens)
        if (currentUsage > 50000 && currentUsage % 10000 === 0) {
          toast.warning(`AI Token Usage Warning: ${currentUsage} tokens consumed. Check Admin Panel to update API Key.`, {
            duration: 6000
          });
        }
      }
    } catch (e) {
      console.warn('AI usage recording failed:', e);
    }
  }
}

export const aiRateLimiter = new AIRateLimiter();
