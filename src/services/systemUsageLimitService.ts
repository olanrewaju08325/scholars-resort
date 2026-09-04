// System Resource Quota Limits & Real-Time Usage Monitor Service
import { supabase } from '@/lib/supabase';
import { sendEmailMessage } from './emailService';

export interface UsageQuotaLimits {
  dbStorageLimitMB: number;
  fileStorageLimitMB: number;
  smtpDailyLimit: number;
  aiMonthlyTokensLimit: number;
  alertThresholdPercent: number; // e.g. 85%
  adminAlertEmail: string;
  autoEmailAlertsEnabled: boolean;
  lastAlertSentAt?: string;
}

export interface ResourceUsageStats {
  database: {
    totalRows: number;
    estimatedSizeMB: number;
    limitMB: number;
    percentUsed: number;
    mbLeft: number;
    isNearLimit: boolean;
    breakdown: {
      questions: number;
      profiles: number;
      examSessions: number;
      sessionAnswers: number;
      auditLogs: number;
      emailLogs: number;
      other: number;
    };
  };
  storage: {
    usedMB: number;
    limitMB: number;
    percentUsed: number;
    mbLeft: number;
    gbLeft: number;
    isNearLimit: boolean;
    objectsCount: number;
  };
  smtp: {
    emailsSentToday: number;
    emailsSentThisMonth: number;
    failedToday: number;
    dailyLimit: number;
    percentUsed: number;
    emailsLeftToday: number;
    isNearLimit: boolean;
  };
  ai: {
    tokensUsedThisMonth: number;
    requestsToday: number;
    monthlyLimit: number;
    percentUsed: number;
    tokensLeft: number;
    isNearLimit: boolean;
  };
  hasCriticalAlerts: boolean;
  alertMessages: string[];
}

export const DEFAULT_QUOTA_LIMITS: UsageQuotaLimits = {
  dbStorageLimitMB: 500,        // 500 MB free Supabase default
  fileStorageLimitMB: 1024,      // 1024 MB (1 GB)
  smtpDailyLimit: 500,           // 500 emails/day
  aiMonthlyTokensLimit: 1000000, // 1M tokens/month
  alertThresholdPercent: 85,     // Alert at 85% capacity
  adminAlertEmail: 'olanrewajuhamilot@gmail.com',
  autoEmailAlertsEnabled: true
};

const QUOTA_SETTINGS_KEY = 'scholars_resort_usage_quota_limits';

export class SystemUsageLimitService {
  /**
   * Loads custom quota limits from Supabase or localStorage
   */
  public static async getQuotaLimits(): Promise<UsageQuotaLimits> {
    try {
      // 1. Try DB platform_config
      const { data } = await supabase
        .from('platform_config')
        .select('value')
        .eq('key', 'system_usage_quota_limits')
        .maybeSingle();

      if (data?.value && typeof data.value === 'object') {
        return { ...DEFAULT_QUOTA_LIMITS, ...data.value };
      }
    } catch {
      // Fallback
    }

    try {
      const saved = localStorage.getItem(QUOTA_SETTINGS_KEY);
      if (saved) {
        return { ...DEFAULT_QUOTA_LIMITS, ...JSON.parse(saved) };
      }
    } catch {}

    return DEFAULT_QUOTA_LIMITS;
  }

  /**
   * Saves updated usage limits and syncs to DB
   */
  public static async saveQuotaLimits(limits: UsageQuotaLimits): Promise<boolean> {
    try {
      localStorage.setItem(QUOTA_SETTINGS_KEY, JSON.stringify(limits));

      // Persist to server API or DB
      try {
        await fetch('/api/system-usage/limits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(limits)
        });
      } catch {}

      try {
        await supabase
          .from('platform_config')
          .upsert({
            key: 'system_usage_quota_limits',
            value: limits,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch {}

      return true;
    } catch (e) {
      console.error('[SystemUsageLimitService] Save limits error:', e);
      return false;
    }
  }

  /**
   * Fetches real live usage across Database, Storage, SMTP and AI
   */
  public static async fetchLiveUsageStats(): Promise<ResourceUsageStats> {
    const limits = await this.getQuotaLimits();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayIso = startOfToday.toISOString();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthIso = startOfMonth.toISOString();

    let qCount = 0, pCount = 0, sessCount = 0, ansCount = 0, auditCount = 0, emailCount = 0, matCount = 0;
    let emailsSentToday = 0, emailsSentMonth = 0, failedEmailsToday = 0;
    let aiTokensMonth = 0, aiRequestsToday = 0;

    try {
      // 1. Database real row counts
      const [
        { count: questions },
        { count: profiles },
        { count: examSessions },
        { count: sessionAnswers },
        { count: activityLogs },
        { count: libraryMaterials }
      ] = await Promise.all([
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('exam_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('session_answers').select('*', { count: 'exact', head: true }),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }),
        supabase.from('library_materials').select('*', { count: 'exact', head: true })
      ]);

      qCount = questions || 0;
      pCount = profiles || 0;
      sessCount = examSessions || 0;
      ansCount = sessionAnswers || 0;
      auditCount = activityLogs || 0;
      matCount = libraryMaterials || 0;
    } catch (dbErr) {
      console.warn('[SystemUsageLimitService] DB counts notice:', dbErr);
    }

    try {
      // 2. SMTP Real Usage - derived from activity_logs
      const { data: emailLogsData } = await supabase
        .from('activity_logs')
        .select('action, created_at')
        .ilike('action', '%email%')
        .gte('created_at', monthIso);

      if (emailLogsData) {
        emailsSentMonth = emailLogsData.filter(l => l.action.includes('sent') || l.action.includes('approved')).length;
        emailsSentToday = emailLogsData.filter(l => (l.action.includes('sent') || l.action.includes('approved')) && new Date(l.created_at) >= startOfToday).length;
        failedEmailsToday = emailLogsData.filter(l => l.action.includes('fail') && new Date(l.created_at) >= startOfToday).length;
      }
    } catch (smtpErr) {
      console.warn('[SystemUsageLimitService] SMTP counts notice:', smtpErr);
    }

    try {
      // 3. AI Real Usage
      const { data: aiMonthData } = await supabase
        .from('ai_usage')
        .select('total_tokens, created_at')
        .gte('created_at', monthIso);

      if (aiMonthData) {
        aiTokensMonth = aiMonthData.reduce((acc, curr) => acc + (curr.total_tokens || 0), 0);
        aiRequestsToday = aiMonthData.filter(d => new Date(d.created_at) >= startOfToday).length;
      }
    } catch (aiErr) {
      console.warn('[SystemUsageLimitService] AI usage query error:', aiErr);
    }

    // Calculations
    const totalRows = qCount + pCount + sessCount + ansCount + auditCount + emailCount + matCount;
    // Avg ~1.2 KB per active record including indexes & foreign keys
    const estimatedDbSizeMB = Math.round((totalRows * 1.35 / 1024) * 10) / 10;
    const dbPercent = Math.min(100, Math.round((estimatedDbSizeMB / limits.dbStorageLimitMB) * 100));
    const dbMbLeft = Math.max(0, Math.round((limits.dbStorageLimitMB - estimatedDbSizeMB) * 10) / 10);
    const dbNearLimit = dbPercent >= limits.alertThresholdPercent;

    // Storage Estimate: Base assets + study materials + avatars + snapshots
    const estimatedStorageMB = Math.round(((matCount * 2.8) + (pCount * 0.4) + 42) * 10) / 10;
    const storagePercent = Math.min(100, Math.round((estimatedStorageMB / limits.fileStorageLimitMB) * 100));
    const storageMbLeft = Math.max(0, Math.round((limits.fileStorageLimitMB - estimatedStorageMB) * 10) / 10);
    const storageGbLeft = Math.round((storageMbLeft / 1024) * 100) / 100;
    const storageNearLimit = storagePercent >= limits.alertThresholdPercent;

    // SMTP percentage
    const smtpPercent = Math.min(100, Math.round((emailsSentToday / limits.smtpDailyLimit) * 100));
    const emailsLeftToday = Math.max(0, limits.smtpDailyLimit - emailsSentToday);
    const smtpNearLimit = smtpPercent >= limits.alertThresholdPercent;

    // AI percentage
    const aiPercent = Math.min(100, Math.round((aiTokensMonth / limits.aiMonthlyTokensLimit) * 100));
    const tokensLeft = Math.max(0, limits.aiMonthlyTokensLimit - aiTokensMonth);
    const aiNearLimit = aiPercent >= limits.alertThresholdPercent;

    const alertMessages: string[] = [];
    if (dbNearLimit) {
      alertMessages.push(`Database Storage is at ${dbPercent}% capacity (${dbMbLeft} MB remaining of ${limits.dbStorageLimitMB} MB limit).`);
    }
    if (storageNearLimit) {
      alertMessages.push(`File Storage is at ${storagePercent}% capacity (${storageGbLeft} GB / ${storageMbLeft} MB remaining of ${limits.fileStorageLimitMB} MB limit).`);
    }
    if (smtpNearLimit) {
      alertMessages.push(`Daily SMTP email quota is at ${smtpPercent}% capacity (${emailsLeftToday} emails remaining today).`);
    }
    if (aiNearLimit) {
      alertMessages.push(`Monthly AI Token limit is at ${aiPercent}% capacity (${tokensLeft.toLocaleString()} tokens remaining).`);
    }

    const hasCriticalAlerts = alertMessages.length > 0;

    const stats: ResourceUsageStats = {
      database: {
        totalRows,
        estimatedSizeMB: estimatedDbSizeMB,
        limitMB: limits.dbStorageLimitMB,
        percentUsed: dbPercent,
        mbLeft: dbMbLeft,
        isNearLimit: dbNearLimit,
        breakdown: {
          questions: qCount,
          profiles: pCount,
          examSessions: sessCount,
          sessionAnswers: ansCount,
          auditLogs: auditCount,
          emailLogs: emailCount,
          other: matCount
        }
      },
      storage: {
        usedMB: estimatedStorageMB,
        limitMB: limits.fileStorageLimitMB,
        percentUsed: storagePercent,
        mbLeft: storageMbLeft,
        gbLeft: storageGbLeft,
        isNearLimit: storageNearLimit,
        objectsCount: matCount + pCount + 24
      },
      smtp: {
        emailsSentToday,
        emailsSentThisMonth: emailsSentMonth,
        failedToday: failedEmailsToday,
        dailyLimit: limits.smtpDailyLimit,
        percentUsed: smtpPercent,
        emailsLeftToday,
        isNearLimit: smtpNearLimit
      },
      ai: {
        tokensUsedThisMonth: aiTokensMonth,
        requestsToday: aiRequestsToday,
        monthlyLimit: limits.aiMonthlyTokensLimit,
        percentUsed: aiPercent,
        tokensLeft,
        isNearLimit: aiNearLimit
      },
      hasCriticalAlerts,
      alertMessages
    };

    // Trigger auto email dispatch if near limit and not alerted in last 12h
    if (hasCriticalAlerts && limits.autoEmailAlertsEnabled && limits.adminAlertEmail) {
      this.checkAndDispatchEmailAlert(stats, limits);
    }

    return stats;
  }

  /**
   * Dispatches warning email to Admin if critical threshold is reached
   */
  private static async checkAndDispatchEmailAlert(stats: ResourceUsageStats, limits: UsageQuotaLimits) {
    const lastAlertKey = 'scholars_last_quota_alert_sent';
    const lastSent = localStorage.getItem(lastAlertKey);
    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;

    if (lastSent && parseInt(lastSent, 10) > twelveHoursAgo) {
      return; // Already notified recently
    }

    try {
      localStorage.setItem(lastAlertKey, Date.now().toString());

      const subject = `⚠️ URGENT: System Resource Capacity Alert (${stats.alertMessages.length} Warnings)`;
      const bodyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #ef4444; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #dc2626; margin-top: 0;">System Resource Capacity Alert</h2>
          <p style="color: #334155; line-height: 1.6;">One or more of your Scholars Resort platform services have exceeded your designated threshold of <strong>${limits.alertThresholdPercent}%</strong>.</p>
          
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 14px; border-radius: 6px; margin: 16px 0;">
            <ul style="margin: 0; padding-left: 20px; color: #991b1b; font-size: 14px;">
              ${stats.alertMessages.map(m => `<li style="margin-bottom: 6px;"><strong>${m}</strong></li>`).join('')}
            </ul>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 20px 0;">
            <tr style="background: #f8fafc;">
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Resource</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Usage / Limit</th>
              <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Capacity</th>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">Database Storage</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${stats.database.estimatedSizeMB} MB / ${stats.database.limitMB} MB</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: ${stats.database.isNearLimit ? '#dc2626' : '#16a34a'};">${stats.database.percentUsed}%</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">File Storage</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${stats.storage.usedMB} MB (${stats.storage.gbLeft} GB left)</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: ${stats.storage.isNearLimit ? '#dc2626' : '#16a34a'};">${stats.storage.percentUsed}%</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">Daily SMTP Quota</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${stats.smtp.emailsSentToday} / ${stats.smtp.dailyLimit} emails</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: ${stats.smtp.isNearLimit ? '#dc2626' : '#16a34a'};">${stats.smtp.percentUsed}%</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">Monthly AI Tokens</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0;">${stats.ai.tokensUsedThisMonth.toLocaleString()} / ${stats.ai.monthlyLimit.toLocaleString()}</td>
              <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold; color: ${stats.ai.isNearLimit ? '#dc2626' : '#16a34a'};">${stats.ai.percentUsed}%</td>
            </tr>
          </table>

          <p style="color: #64748b; font-size: 12px; margin-top: 24px;">
            Log in to the Admin Dashboard > System Health to adjust your storage limits or upgrade your service capacity.
          </p>
        </div>
      `;

      await sendEmailMessage({
        to: limits.adminAlertEmail,
        subject,
        body: bodyHtml
      });

      // Log notification to Admin Tray
      try {
        await supabase.from('activity_logs').insert({
          activity_type: 'SYSTEM_CAPACITY_ALERT',
          action: 'SYSTEM_CAPACITY_ALERT',
          metadata: { details: `Resource Warning: ${stats.alertMessages.join(' | ')}` },
          created_at: new Date().toISOString()
        });
      } catch {}
    } catch (emailErr) {
      console.warn('[SystemUsageLimitService] Failed to dispatch automated alert email:', emailErr);
    }
  }
}
