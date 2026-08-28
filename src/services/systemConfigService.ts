import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { authFetch } from '@/lib/apiAuth';

// Security Cleanup: Purge any legacy API keys from localStorage
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('groq_api_key');
  }
} catch (_) {}

export interface GroqSystemConfig {
  apiKey: string;
  defaultModel: string;
  monthlyTokenLimit: number;
  systemPrompt?: string;
  temperature?: number;
}

export interface SmtpSystemConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure?: boolean;
}

export interface PlatformSystemConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  cbtEnabled: boolean;
  tournamentsEnabled: boolean;
  studyRoomsEnabled: boolean;
  jambDate: string;
  telegramSupportLink: string;
  telegramAnnouncementLink: string;
  whatsappSupportNumber: string;
}

export type GroqConfig = GroqSystemConfig;
export type SmtpConfig = SmtpSystemConfig;
export type PlatformControls = PlatformSystemConfig;

export interface FullSystemConfig {
  groq: GroqSystemConfig;
  smtp: SmtpSystemConfig;
  platform: PlatformSystemConfig;
}

export const testGroqKeyLive = async (apiKey: string, model?: string) => {
  const result = await testGroqConnection(apiKey, model);
  return {
    success: result.ok,
    message: result.message || (result.ok ? 'GROQ API connection successful' : 'GROQ API connection failed'),
    latency: result.latencyMs
  };
};

const DEFAULT_GROQ_CONFIG: GroqSystemConfig = {
  apiKey: '',
  defaultModel: 'llama-3.3-70b-versatile',
  monthlyTokenLimit: 5000000,
  systemPrompt: 'You are Scholars Resort AI, a world-class Nigerian UTME and WASSCE academic tutor specialized in JAMB syllabus, step-by-step problem breakdown, and student mentorship.',
  temperature: 0.7
};

const DEFAULT_SMTP_CONFIG: SmtpSystemConfig = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'admitwise2@gmail.com',
  pass: '',
  from: 'Scholars Resort <admitwise2@gmail.com>',
  secure: false
};

const DEFAULT_PLATFORM_CONFIG: PlatformSystemConfig = {
  maintenanceMode: false,
  maintenanceMessage: 'We are currently undergoing scheduled server upgrades to enhance your CBT experience.',
  cbtEnabled: true,
  tournamentsEnabled: true,
  studyRoomsEnabled: true,
  jambDate: '2026-04-15T08:00:00',
  telegramSupportLink: 'https://t.me/+6dtsZgQpwrNhZDM8',
  telegramAnnouncementLink: 'https://t.me/+9WU6HrQE6DJhYTRk',
  whatsappSupportNumber: '2348000000000'
};

/**
 * Fetch all system configurations from system_configs / admin_settings with runtime fallback
 */
export async function fetchAllSystemConfigs(): Promise<FullSystemConfig> {
  const result: FullSystemConfig = {
    groq: { ...DEFAULT_GROQ_CONFIG },
    smtp: { ...DEFAULT_SMTP_CONFIG },
    platform: { ...DEFAULT_PLATFORM_CONFIG }
  };

  try {
    // 1. Try server-side API first for fresh, secure server configs
    const res = await authFetch('/api/admin/system-configs');
    if (res.ok) {
      const data = await res.json();
      if (data.configs) {
        if (data.configs.groq) result.groq = { ...result.groq, ...data.configs.groq };
        if (data.configs.smtp) result.smtp = { ...result.smtp, ...data.configs.smtp };
        if (data.configs.platform) result.platform = { ...result.platform, ...data.configs.platform };
        return result;
      }
    }
  } catch (_) {}

  // 2. Direct Supabase Query fallback
  try {
    const { safeSupabaseQuery } = await import('@/lib/safeSupabase');
    // Check system_configs table safely
    const sysRes = await safeSupabaseQuery<any[]>(
      supabase.from('system_configs').select('*'),
      { contextName: 'SystemConfigService.system_configs', fallbackValue: [] }
    );
    const sysConfigs = sysRes.data || [];

    if (sysConfigs.length > 0) {
      sysConfigs.forEach((row: any) => {
        if (row.config_key === 'groq_settings' && row.config_value) {
          result.groq = { ...result.groq, ...row.config_value };
        } else if (row.config_key === 'smtp_settings' && row.config_value) {
          result.smtp = { ...result.smtp, ...row.config_value };
        } else if (row.config_key === 'platform_controls' && row.config_value) {
          result.platform = { ...result.platform, ...row.config_value };
        }
      });
    }

    // Check admin_settings table safely
    const adminRes = await safeSupabaseQuery<any[]>(
      supabase.from('admin_settings').select('*'),
      { contextName: 'SystemConfigService.admin_settings', fallbackValue: [] }
    );
    const adminRows = adminRes.data || [];
    if (adminRows && adminRows.length > 0) {
      adminRows.forEach((row: any) => {
        if (row.setting_key === 'ai_api_keys' && row.setting_value) {
          if (row.setting_value.groq && !result.groq.apiKey) result.groq.apiKey = row.setting_value.groq;
        }
        if (row.setting_key === 'api_keys' && row.setting_value) {
          const v = row.setting_value;
          if (v.smtp_host) result.smtp.host = v.smtp_host;
          if (v.smtp_port) result.smtp.port = Number(v.smtp_port) || 587;
          if (v.smtp_user) result.smtp.user = v.smtp_user;
          if (v.smtp_pass && !result.smtp.pass) result.smtp.pass = v.smtp_pass;
          if (v.smtp_from) result.smtp.from = v.smtp_from;
          if (v.groq && !result.groq.apiKey) result.groq.apiKey = v.groq;
        }
        if (row.setting_key === 'maintenance_mode' && row.setting_value) {
          result.platform.maintenanceMode = !!row.setting_value.enabled;
          if (row.setting_value.message) result.platform.maintenanceMessage = row.setting_value.message;
        }
        if (row.setting_key === 'feature_toggles' && row.setting_value) {
          result.platform.cbtEnabled = row.setting_value.cbt_enabled !== false;
          result.platform.tournamentsEnabled = row.setting_value.tournaments_enabled !== false;
          result.platform.studyRoomsEnabled = row.setting_value.study_rooms_enabled !== false;
        }
      });
    }
  } catch (err) {
    console.warn('[SystemConfigService] Notice loading configs:', err);
  }

  // Fallback to environment variable if set
  if (!result.groq.apiKey) {
    result.groq.apiKey = import.meta.env.VITE_GROQ_API_KEY || '';
  }

  return result;
}

/**
 * Save full system configurations to system_configs & admin_settings tables
 */
export async function saveAllSystemConfigs(configs: FullSystemConfig): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Post to Server-Side API Endpoint for immediate runtime synchronization
    const apiRes = await authFetch('/api/admin/system-configs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configs)
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.success) {
        return { success: true };
      }
    }

    // 2. Direct Supabase Upserts Fallback
    try {
      await supabase.from('system_configs').upsert([
        {
          config_key: 'groq_settings',
          config_value: configs.groq,
          updated_at: new Date().toISOString()
        },
        {
          config_key: 'smtp_settings',
          config_value: configs.smtp,
          updated_at: new Date().toISOString()
        },
        {
          config_key: 'platform_controls',
          config_value: configs.platform,
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'config_key' });
    } catch (_) {}

    // 3. Mirror to admin_settings table for backward compatibility
    try {
      await supabase.from('admin_settings').upsert([
        {
          setting_key: 'ai_api_keys',
          setting_value: { groq: configs.groq.apiKey, default_model: configs.groq.defaultModel },
          updated_at: new Date().toISOString()
        },
        {
          setting_key: 'api_keys',
          setting_value: {
            smtp_host: configs.smtp.host,
            smtp_port: configs.smtp.port,
            smtp_user: configs.smtp.user,
            smtp_pass: configs.smtp.pass,
            smtp_from: configs.smtp.from,
            groq: configs.groq.apiKey
          },
          updated_at: new Date().toISOString()
        },
        {
          setting_key: 'maintenance_mode',
          setting_value: {
            enabled: configs.platform.maintenanceMode,
            message: configs.platform.maintenanceMessage
          },
          updated_at: new Date().toISOString()
        },
        {
          setting_key: 'feature_toggles',
          setting_value: {
            cbt_enabled: configs.platform.cbtEnabled,
            tournaments_enabled: configs.platform.tournamentsEnabled,
            study_rooms_enabled: configs.platform.studyRoomsEnabled
          },
          updated_at: new Date().toISOString()
        }
      ], { onConflict: 'setting_key' });
    } catch (_) {}

    return { success: true };
  } catch (err: any) {
    console.error('[SystemConfigService] Save error:', err);
    return { success: false, error: err.message || 'Failed to save system configurations.' };
  }
}

/**
 * Test GROQ API key in real-time
 */
export async function testGroqConnection(apiKey: string, model: string = 'llama-3.3-70b-versatile'): Promise<{ ok: boolean; latencyMs?: number; message?: string }> {
  try {
    const res = await authFetch('/api/admin/test-groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, model })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return { ok: true, latencyMs: data.latencyMs, message: data.message || 'GROQ API connection verified successfully!' };
    }

    return { ok: false, message: data.message || data.error || 'Failed to verify GROQ API key.' };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Failed to connect to GROQ API server.' };
  }
}

/**
 * Test SMTP connection and dispatch probe email
 */
export async function testSmtpConnection(smtp: SmtpSystemConfig, targetEmail?: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await authFetch('/api/admin/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host: smtp.host, port: smtp.port, user: smtp.user, pass: smtp.pass, fromEmail: smtp.from, testRecipient: targetEmail })
    });

    if (res.ok) {
      const data = await res.json();
      return { ok: data.success, message: data.message };
    }
    const errData = await res.json().catch(() => ({}));
    return { ok: false, message: errData?.error || 'SMTP server rejected credentials.' };
  } catch (err: any) {
    return { ok: false, message: err.message || 'SMTP diagnostic request failed.' };
  }
}
