import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://syoodykedvqaoeplmamd.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getSmtpConfig(customConfig?: any) {
  if (customConfig && customConfig.host) {
    return {
      host: customConfig.host,
      port: Number(customConfig.port) || 587,
      user: customConfig.user || '',
      pass: customConfig.pass || '',
      from: customConfig.fromEmail || customConfig.from || 'admitwise2@gmail.com'
    };
  }

  try {
    const { data: adminData } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'api_keys')
      .maybeSingle();

    if (adminData?.setting_value?.smtp_host) {
      return {
        host: adminData.setting_value.smtp_host,
        port: Number(adminData.setting_value.smtp_port) || 587,
        user: adminData.setting_value.smtp_user || '',
        pass: adminData.setting_value.smtp_pass || '',
        from: adminData.setting_value.smtp_from || adminData.setting_value.smtp_user || 'admitwise2@gmail.com'
      };
    }
  } catch {}

  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || 'admitwise2@gmail.com',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'admitwise2@gmail.com'
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { target = 'all', subject, body, html, recipients: explicitRecipients, adminId } = req.body || {};

  if (!subject || (!body && !html)) {
    return res.status(400).json({ success: false, error: 'Subject and email body are required.' });
  }

  try {
    let recipientList: string[] = [];
    if (explicitRecipients && Array.isArray(explicitRecipients) && explicitRecipients.length > 0) {
      recipientList = explicitRecipients;
    } else {
      let query = supabase.from('profiles').select('email');
      if (target === 'paid') {
        query = query.eq('is_paid', true);
      } else if (target === 'unpaid') {
        query = query.eq('is_paid', false);
      }
      const { data: profileRows } = await query;
      if (profileRows) {
        recipientList = profileRows.map(p => p.email).filter(Boolean);
      }
    }

    if (recipientList.length === 0) {
      return res.status(400).json({ success: false, error: 'No recipient email addresses found for the selected target group.' });
    }

    // Insert in-app announcement
    try {
      await supabase.from('announcements').insert({
        title: subject,
        body: body || html,
        content: body || html,
        target,
        created_by: adminId || null,
        is_pinned: true
      });
    } catch {}

    const config = await getSmtpConfig();
    let sentCount = 0;
    let smtpError = '';

    if (config.host && config.user && config.pass) {
      try {
        const isSecure = config.port === 465;
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: isSecure,
          auth: { user: config.user, pass: config.pass },
          tls: { rejectUnauthorized: false }
        });

        const batchSize = 5;
        for (let i = 0; i < recipientList.length; i += batchSize) {
          const batch = recipientList.slice(i, i + batchSize);
          await Promise.all(batch.map(async (email) => {
            try {
              await transporter.sendMail({
                from: config.from || `Scholars Resort <${config.user}>`,
                to: email,
                subject,
                html: html || body,
                text: body || html?.replace(/<[^>]*>?/gm, '')
              });
              sentCount++;

              await supabase.from('communication_logs').insert({
                recipient_email: email,
                message_type: 'bulk_email',
                subject,
                content: body || html,
                status: 'delivered',
                sent_at: new Date().toISOString()
              });
            } catch (singleErr: any) {
              smtpError = singleErr.message;
            }
          }));
        }
      } catch (transporterErr: any) {
        smtpError = transporterErr.message;
      }
    } else {
      smtpError = 'SMTP credentials not fully configured in Settings.';
    }

    try {
      await supabase.from('audit_logs').insert({
        user_id: adminId || '00000000-0000-0000-0000-000000000000',
        action: `Bulk Broadcast: ${subject} (${sentCount}/${recipientList.length} delivered)`,
        entity_type: 'communication',
        entity_id: 'bulk_email',
        status: sentCount > 0 ? 'success' : 'failed',
        created_at: new Date().toISOString()
      });
    } catch {}

    const message = sentCount > 0 
      ? `Successfully dispatched bulk email via SMTP to ${sentCount} recipient(s) and published live in-app announcements!`
      : `Broadcast published to in-app student dashboards! Note: Direct email delivery requires saving valid SMTP host and password in Admin -> Settings.`;

    return res.status(200).json({
      success: true,
      count: recipientList.length,
      deliveredCount: sentCount,
      message,
      smtpNote: smtpError || null
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to dispatch bulk email.' });
  }
}
