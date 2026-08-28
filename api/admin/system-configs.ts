import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '../_auth';

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-email');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Security Hardening: Enforce Admin authorization
  const auth = await verifyAdmin(req);
  if (!auth.authorized) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  if (req.method === 'GET') {
    try {
      const configs: any = {
        groq: {
          apiKey: process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '',
          defaultModel: 'llama-3.3-70b-versatile',
          monthlyTokenLimit: 5000000
        },
        smtp: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT || 587),
          user: process.env.SMTP_USER || process.env.GMAIL_USER || 'admitwise2@gmail.com',
          pass: process.env.SMTP_PASS || process.env.GMAIL_PASS || '',
          from: process.env.SMTP_FROM || 'Scholars Resort <admitwise2@gmail.com>',
          secure: false
        },
        platform: {
          maintenanceMode: false,
          maintenanceMessage: 'We are currently undergoing scheduled maintenance.',
          cbtEnabled: true,
          tournamentsEnabled: true,
          studyRoomsEnabled: true,
          jambDate: '2026-04-15T08:00:00',
          telegramSupportLink: 'https://t.me/+6dtsZgQpwrNhZDM8',
          telegramAnnouncementLink: 'https://t.me/+9WU6HrQE6DJhYTRk',
          whatsappSupportNumber: '2348000000000'
        }
      };

      try {
        const { data: sysConfigs } = await supabase.from('system_configs').select('*');
        if (sysConfigs && sysConfigs.length > 0) {
          sysConfigs.forEach((row: any) => {
            if (row.config_key === 'groq_settings' && row.config_value) {
              configs.groq = { ...configs.groq, ...row.config_value };
            } else if (row.config_key === 'smtp_settings' && row.config_value) {
              configs.smtp = { ...configs.smtp, ...row.config_value };
            } else if (row.config_key === 'platform_controls' && row.config_value) {
              configs.platform = { ...configs.platform, ...row.config_value };
            }
          });
        }
      } catch (_) {}

      try {
        const { data: adminSettings } = await supabase.from('admin_settings').select('*');
        if (adminSettings && adminSettings.length > 0) {
          adminSettings.forEach((row: any) => {
            if (row.setting_key === 'ai_api_keys' && row.setting_value) {
              if (row.setting_value.groq && !configs.groq.apiKey) configs.groq.apiKey = row.setting_value.groq;
            }
            if (row.setting_key === 'api_keys' && row.setting_value) {
              const v = row.setting_value;
              if (v.smtp_host) configs.smtp.host = v.smtp_host;
              if (v.smtp_port) configs.smtp.port = Number(v.smtp_port) || 587;
              if (v.smtp_user) configs.smtp.user = v.smtp_user;
              if (v.smtp_pass && !configs.smtp.pass) configs.smtp.pass = v.smtp_pass;
              if (v.smtp_from) configs.smtp.from = v.smtp_from;
            }
            if (row.setting_key === 'maintenance_mode' && row.setting_value) {
              configs.platform.maintenanceMode = !!row.setting_value.enabled;
              if (row.setting_value.message) configs.platform.maintenanceMessage = row.setting_value.message;
            }
            if (row.setting_key === 'feature_toggles' && row.setting_value) {
              configs.platform.cbtEnabled = row.setting_value.cbt_enabled !== false;
              configs.platform.tournamentsEnabled = row.setting_value.tournaments_enabled !== false;
              configs.platform.studyRoomsEnabled = row.setting_value.study_rooms_enabled !== false;
            }
          });
        }
      } catch (_) {}

      // Mask sensitive secret values before sending over API
      const maskedConfigs = {
        ...configs,
        groq: {
          ...configs.groq,
          isConfigured: !!configs.groq.apiKey,
          apiKey: configs.groq.apiKey ? 'gsk_' + '•'.repeat(16) + configs.groq.apiKey.slice(-4) : ''
        },
        smtp: {
          ...configs.smtp,
          isConfigured: !!configs.smtp.pass,
          pass: configs.smtp.pass ? '••••••••••••' : ''
        }
      };

      return res.status(200).json({ success: true, configs: maskedConfigs });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { groq, smtp, platform } = req.body || {};

      // Get existing settings to avoid overwriting masked/empty secrets
      let existingGroqKey = process.env.GROQ_API_KEY || '';
      let existingSmtpPass = process.env.SMTP_PASS || '';

      try {
        const { data: existingConfigs } = await supabase.from('system_configs').select('*');
        existingConfigs?.forEach((r: any) => {
          if (r.config_key === 'groq_settings' && r.config_value?.apiKey) {
            existingGroqKey = r.config_value.apiKey;
          }
          if (r.config_key === 'smtp_settings' && r.config_value?.pass) {
            existingSmtpPass = r.config_value.pass;
          }
        });
      } catch (_) {}

      const inserts = [];
      if (groq) {
        const finalGroq = { ...groq };
        // If apiKey is masked or empty, retain existing secret
        if (!finalGroq.apiKey || finalGroq.apiKey.includes('•')) {
          finalGroq.apiKey = existingGroqKey;
        }
        inserts.push({
          config_key: 'groq_settings',
          config_value: finalGroq,
          updated_at: new Date().toISOString()
        });
      }
      if (smtp) {
        const finalSmtp = { ...smtp };
        // If pass is masked or empty, retain existing secret
        if (!finalSmtp.pass || finalSmtp.pass.includes('•')) {
          finalSmtp.pass = existingSmtpPass;
        }
        inserts.push({
          config_key: 'smtp_settings',
          config_value: finalSmtp,
          updated_at: new Date().toISOString()
        });
      }
      if (platform) {
        inserts.push({
          config_key: 'platform_controls',
          config_value: platform,
          updated_at: new Date().toISOString()
        });
      }

      if (inserts.length > 0) {
        await supabase.from('system_configs').upsert(inserts, { onConflict: 'config_key' });
      }

      return res.status(200).json({ success: true, message: 'System configurations saved successfully.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Failed to save system configurations.' });
    }
  }

  return res.status(405).json({ success: false, error: 'Method Not Allowed' });
}
