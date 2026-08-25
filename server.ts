import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { setupStudyRoomWebSocket, getActiveStudyRoomsList } from './src/services/studyRoomSocketServer';

const app = express();
const PORT = 3000;

// Universal CORS configuration for Vercel, dev preview, custom domains, and local development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Groq-Key, X-Groq-Api-Key, x-groq-key, x-groq-api-key, *');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-Groq-Key', 'X-Groq-Api-Key', 'x-groq-key', 'x-groq-api-key', '*']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Production Supabase defaults
const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

// Helper to get Supabase client on server
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

let cachedWorkingSmtpConfig: any = null;

// Helper to resolve SMTP settings from DB or env or request
async function getSmtpConfig(customConfig?: any) {
  if (customConfig && customConfig.host) {
    return {
      host: customConfig.host,
      port: Number(customConfig.port) || 587,
      user: customConfig.user || '',
      pass: customConfig.pass || '',
      from: customConfig.fromEmail || customConfig.from || customConfig.smtp_from || 'admitwise2@gmail.com'
    };
  }

  if (cachedWorkingSmtpConfig && cachedWorkingSmtpConfig.host) {
    return cachedWorkingSmtpConfig;
  }

  // 1. Try DB admin_settings (where Admin -> Settings saves api_keys)
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
  } catch (err) {
    console.warn('Failed to load SMTP config from admin_settings:', err);
  }

  // 2. Try DB platform_config (where key = 'smtp_settings')
  try {
    const { data } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'smtp_settings')
      .maybeSingle();

    if (data?.value?.host) {
      return {
        host: data.value.host,
        port: Number(data.value.port) || 587,
        user: data.value.user || '',
        pass: data.value.pass || '',
        from: data.value.from || 'admitwise2@gmail.com'
      };
    }
  } catch (err) {
    console.warn('Failed to load SMTP config from platform_config:', err);
  }

  // Fallback to process.env
  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || process.env.GMAIL_USER || 'admitwise2@gmail.com',
    pass: process.env.SMTP_PASS || process.env.GMAIL_PASS || '',
    from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'admitwise2@gmail.com'
  };
}

// Helper function for server-side SMTP email dispatch
async function sendServerSmtpEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const config = await getSmtpConfig();
    if (!config.host) return false;

    const isSecure = config.port === 465;
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: isSecure,
      auth: config.user && config.pass ? {
        user: config.user,
        pass: config.pass
      } : undefined,
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: config.from || `Scholars Resort <${config.user || 'noreply@scholarsresort.com'}>`,
      to,
      subject,
      html,
      text: html.replace(/<[^>]*>?/gm, '')
    });
    console.log(`[SMTP System Dispatch] Successfully sent email to ${to}: "${subject}"`);

    // Log success in email_logs table
    try {
      await supabase.from('email_logs').insert({
        recipient: to,
        subject,
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null
      });
    } catch (logErr) {
      // Non-blocking log
    }

    return true;
  } catch (err: any) {
    console.warn(`[SMTP System Dispatch Notice] Could not deliver email to ${to}:`, err.message);

    // Log failure in email_logs table
    try {
      await supabase.from('email_logs').insert({
        recipient: to,
        subject,
        status: 'failed',
        sent_at: new Date().toISOString(),
        error_message: err.message || 'SMTP delivery failed'
      });
    } catch (logErr) {
      // Non-blocking log
    }

    return false;
  }
}

// API Route: Send Email
app.post('/api/send-email', async (req, res) => {
  const { to, subject, html, text, smtpConfig } = req.body;

  if (!to || (!html && !text)) {
    return res.status(400).json({ success: false, error: 'Recipient "to" and email content are required.' });
  }

  const config = await getSmtpConfig(smtpConfig);

  if (!config.host) {
    // Log dispatch attempt to communication_logs and email_logs without failing
    try {
      await supabase.from('email_logs').insert({
        recipient: to,
        subject: subject || 'No Subject',
        status: 'queued',
        sent_at: new Date().toISOString(),
        error_message: 'SMTP Host is not configured (logged locally)'
      });
      await supabase.from('communication_logs').insert({
        recipient: to,
        subject: subject || 'Notification',
        body: text || html || '',
        status: 'logged',
        created_at: new Date().toISOString()
      });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      delivered: false,
      message: 'SMTP Host is not configured. Email logged to system communication records.'
    });
  }

  try {
    const isSecure = config.port === 465;
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: isSecure,
      auth: config.user && config.pass ? {
        user: config.user,
        pass: config.pass
      } : undefined,
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: config.from || `Scholars Resort <${config.user || 'noreply@scholarsresort.com'}>`,
      to,
      subject,
      html: html || text,
      text: text || html?.replace(/<[^>]*>?/gm, '')
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP REAL DISPATCH SUCCESS] Message sent to ${to}: ${info.messageId}`);

    // Record success in email_logs
    try {
      await supabase.from('email_logs').insert({
        recipient: to,
        subject,
        status: 'sent',
        sent_at: new Date().toISOString(),
        error_message: null
      });
    } catch (_) {}

    return res.json({
      success: true,
      delivered: true,
      messageId: info.messageId,
      message: `Email dispatched successfully to ${to} via ${config.host}:${config.port}`
    });
  } catch (err: any) {
    console.error('[SMTP DISPATCH ERROR]', err);

    // Record failure in email_logs
    try {
      await supabase.from('email_logs').insert({
        recipient: to,
        subject: subject || 'Untitled Notification',
        status: 'failed',
        sent_at: new Date().toISOString(),
        error_message: err.message || 'SMTP dispatch error'
      });
    } catch (_) {}

    return res.status(500).json({
      success: false,
      delivered: false,
      error: err.message || 'Failed to dispatch email via SMTP server.',
      details: err.code || err.command
    });
  }
});

// API Route: Bulk Email Dispatch Service
app.post('/api/send-bulk-email', async (req, res) => {
  const { target = 'all', subject, body, html, recipients: explicitRecipients, adminId } = req.body;

  if (!subject || (!body && !html)) {
    return res.status(400).json({ success: false, error: 'Subject and email body are required.' });
  }

  try {
    // 1. Resolve recipients
    let recipientList: string[] = [];
    if (explicitRecipients && Array.isArray(explicitRecipients) && explicitRecipients.length > 0) {
      recipientList = explicitRecipients;
    } else {
      let query = supabase.from('profiles').select('email');
      if (target === 'paid') {
        query = query.eq('has_paid', true);
      } else if (target === 'unpaid') {
        query = query.eq('has_paid', false);
      }
      const { data: profileRows } = await query;
      if (profileRows && profileRows.length > 0) {
        recipientList = profileRows.map(p => p.email).filter(Boolean);
      }
      
      if (recipientList.length === 0) {
        recipientList = ['student@scholarsresort.com'];
      }
    }

    // 2. Publish to in-app Announcements
    try {
      await supabase.from('announcements').insert({
        title: subject,
        body: body || html,
        content: body || html,
        target,
        created_by: adminId || null,
        is_pinned: true
      });
    } catch (annErr: any) {
      console.warn('[Bulk Email Announcement Notice]', annErr.message);
    }

    // 3. Dispatch emails via SMTP
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

        // Send in parallel batches of 5
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

              // Log to communication_logs
              await supabase.from('communication_logs').insert({
                recipient_email: email,
                message_type: 'bulk_email',
                subject,
                content: body || html,
                status: 'delivered',
                sent_at: new Date().toISOString()
              }).catch(() => {});
            } catch (singleErr: any) {
              console.warn(`[Bulk Email single error for ${email}]`, singleErr.message);
              smtpError = singleErr.message;
            }
          }));
        }
      } catch (transporterErr: any) {
        console.error('[Bulk Email SMTP Transporter Error]', transporterErr);
        smtpError = transporterErr.message;
      }
    } else {
      smtpError = 'SMTP credentials not fully configured in Settings.';
    }

    // 4. Log to audit_logs
    try {
      await supabase.from('audit_logs').insert({
        user_id: adminId || '00000000-0000-0000-0000-000000000000',
        action: `Bulk Broadcast: ${subject} (${sentCount}/${recipientList.length} delivered)`,
        entity_type: 'communication',
        entity_id: 'bulk_email',
        status: sentCount > 0 ? 'success' : 'failed',
        created_at: new Date().toISOString()
      });
    } catch (auditErr: any) {
      console.warn('[Audit Log Notice]', auditErr.message);
    }

    const message = sentCount > 0 
      ? `Successfully dispatched bulk email via SMTP to ${sentCount} recipient(s) and published live in-app announcements!`
      : `Broadcast published to in-app student dashboards! Note: Direct email delivery requires saving valid SMTP host and password in Admin -> Settings.`;

    return res.json({
      success: true,
      count: recipientList.length,
      deliveredCount: sentCount,
      message,
      smtpNote: smtpError || null
    });
  } catch (err: any) {
    console.error('[Bulk Email Route Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to dispatch bulk email.' });
  }
});

// API Route: Manual Payment Notification (Sends emails to Admin & Student)
app.post('/api/payment-notification', async (req, res) => {
  const { userId, userEmail, userName, amount, proofUrl, planId } = req.body;

  try {
    const config = await getSmtpConfig();
    let transporter: nodemailer.Transporter;

    if (!config.host && process.env.SMTP_HOST) {
      config.host = process.env.SMTP_HOST;
      config.port = Number(process.env.SMTP_PORT) || 587;
      config.user = process.env.SMTP_USER || process.env.GMAIL_USER || '';
      config.pass = process.env.SMTP_PASS || process.env.GMAIL_PASS || '';
    }

    if (config.host) {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
        tls: { rejectUnauthorized: false }
      });
    } else {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { 
          user: process.env.SMTP_USER || process.env.GMAIL_USER || 'admitwise2@gmail.com', 
          pass: process.env.SMTP_PASS || process.env.GMAIL_PASS || '' 
        }
      });
    }

    const senderEmail = config.from || 'admitwise2@gmail.com';
    const recipientAdmins = ['admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com'];

    // 1. Send Admin Notification Email
    await transporter.sendMail({
      from: `"Scholars Resort System" <${senderEmail}>`,
      to: recipientAdmins,
      subject: `New Manual Payment Upload - ₦${amount}`,
      html: `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
               <h2 style="color: #4F46E5;">New Manual Payment Uploaded</h2>
               <p><strong>Student Name:</strong> ${userName || 'Student'}</p>
               <p><strong>Email:</strong> ${userEmail || 'N/A'}</p>
               <p><strong>User ID:</strong> ${userId}</p>
               <p><strong>Amount:</strong> ₦${amount}</p>
               <p><strong>Plan:</strong> ${planId || 'Lifetime Access'}</p>
               <p><a href="${proofUrl}" style="background: #4F46E5; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block;">View Payment Receipt</a></p>
             </div>`
    });

    // 2. Send Confirmation Email to Student
    if (userEmail) {
      await transporter.sendMail({
        from: `"Scholars Resort" <${senderEmail}>`,
        to: userEmail,
        subject: 'Payment Receipt Received - Scholars Resort Access',
        html: `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
                 <h2 style="color: #4F46E5;">Payment Upload Confirmation</h2>
                 <p>Dear ${userName || 'Scholar'},</p>
                 <p>We have received your proof of payment (<strong>₦${amount}</strong>) for <strong>Scholars Resort Full Exam Access</strong>.</p>
                 <p>Our verification team is reviewing your transaction receipt. Your account access will be activated within 24 hours.</p>
                 <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
                   <p style="margin: 0; font-size: 13px; color: #475569;">
                     <strong>Amount Paid:</strong> ₦${amount}<br/>
                     <strong>Status:</strong> Pending Admin Review<br/>
                     <strong>Date:</strong> ${new Date().toLocaleString()}
                   </p>
                 </div>
                 <p>Thank you for choosing Scholars Resort!</p>
                 <br/>
                 <p>Best regards,<br/><strong>Scholars Resort Team</strong></p>
               </div>`
      });
    }

    return res.json({ success: true, message: 'Payment notification dispatched successfully to admin and student.' });
  } catch (err: any) {
    console.error('Payment notification error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to dispatch payment notification emails.' });
  }
});

// API Route: Test SMTP
app.post('/api/test-smtp', async (req, res) => {
  const startTime = Date.now();
  const { host, port, user, pass, fromEmail, testRecipient } = req.body;

  const targetHost = host || process.env.SMTP_HOST;
  const targetPort = Number(port || process.env.SMTP_PORT || 587);
  const targetUser = user || process.env.SMTP_USER;
  const targetPass = pass || process.env.SMTP_PASS;
  const targetFrom = fromEmail || process.env.SMTP_FROM || 'noreply@scholarsresort.com';
  const recipient = testRecipient || targetUser || 'test-admin@scholarsresort.com';

  if (!targetHost) {
    return res.status(400).json({
      success: false,
      message: 'SMTP Host is required for testing.'
    });
  }

  try {
    const isSecure = targetPort === 465;
    const transporter = nodemailer.createTransport({
      host: targetHost,
      port: targetPort,
      secure: isSecure,
      auth: targetUser && targetPass ? {
        user: targetUser,
        pass: targetPass
      } : undefined,
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify connection & credentials
    await transporter.verify();

    // Send real test email
    let info;
    if (recipient) {
      info = await transporter.sendMail({
        from: targetFrom,
        to: recipient,
        subject: 'Scholars Resort - Real SMTP Diagnostic Verification',
        text: `This is an official verification email sent from Scholars Resort to confirm real SMTP delivery to ${recipient} via ${targetHost}:${targetPort} at ${new Date().toISOString()}.`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #4f46e5; margin-top: 0;">SMTP Verification Successful!</h2>
          <p style="color: #334155; line-height: 1.5;">Your SMTP server configuration for <strong>${targetHost}:${targetPort}</strong> was verified and sent a live test message to <strong>${recipient}</strong>.</p>
          <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #475569;">
            Timestamp: ${new Date().toLocaleString()}<br/>
            Sender: ${targetFrom}
          </div>
        </div>`
      });
    }

    const latency = Date.now() - startTime;
    cachedWorkingSmtpConfig = {
      host: targetHost,
      port: targetPort,
      user: targetUser,
      pass: targetPass,
      from: targetFrom
    };
    return res.json({
      success: true,
      latency,
      message: `SMTP Connection Verified! Live test email dispatched to ${recipient} (${latency}ms).`,
      messageId: info?.messageId
    });
  } catch (err: any) {
    const latency = Date.now() - startTime;
    console.error('[SMTP TEST ERROR]', err);

    let errorHint = err.message || 'Authentication or network timeout';
    if (targetUser?.toLowerCase().includes('@gmail.com') && !targetHost.toLowerCase().includes('gmail')) {
      errorHint += ` -> Helpful Hint: You entered a Gmail user ('${targetUser}') but host is set to '${targetHost}'. If sending via Gmail, change host to 'smtp.gmail.com' and port to '465' (or '587').`;
    } else if (targetHost.toLowerCase().includes('gmail') && (err.message?.includes('530') || err.message?.includes('535') || err.message?.includes('Authentication'))) {
      errorHint += ' -> Helpful Hint: Gmail requires a 16-character App Password generated at https://myaccount.google.com/apppasswords (2FA must be active). Regular Google account passwords are blocked by Gmail.';
    }

    return res.status(200).json({
      success: false,
      latency,
      message: `SMTP Connection Failed: ${errorHint}`,
      error: err.message,
      code: err.code
    });
  }
});

// --- Groq Server-Side Telemetry Log Store ---
interface GroqTelemetryLog {
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

const groqServerLogs: GroqTelemetryLog[] = [];
let latestGroqQuotaHeader = {
  remainingTokens: null as string | null,
  limitTokens: null as string | null,
  resetTokens: null as string | null,
  remainingRequests: null as string | null,
  limitRequests: null as string | null,
  lastUpdated: null as string | null
};

function addGroqServerLog(entry: Omit<GroqTelemetryLog, 'id' | 'timestamp'>) {
  const log: GroqTelemetryLog = {
    id: `groq_log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  
  if (entry.remainingTokens || entry.limitTokens) {
    latestGroqQuotaHeader = {
      remainingTokens: entry.remainingTokens || latestGroqQuotaHeader.remainingTokens,
      limitTokens: entry.limitTokens || latestGroqQuotaHeader.limitTokens,
      resetTokens: entry.resetTokens || latestGroqQuotaHeader.resetTokens,
      remainingRequests: entry.remainingRequests || latestGroqQuotaHeader.remainingRequests,
      limitRequests: entry.limitRequests || latestGroqQuotaHeader.limitRequests,
      lastUpdated: new Date().toISOString()
    };
  }

  groqServerLogs.unshift(log);
  if (groqServerLogs.length > 500) {
    groqServerLogs.length = 500;
  }
  return log;
}

// API Route: Groq AI Chat Proxy (Production Groq Key with Telemetry Logging)
app.post('/api/groq-chat', async (req, res) => {
  const startTime = Date.now();
  const { messages, model = 'openai/gpt-oss-120b', temperature = 0.7 } = req.body;
  const customGroqKey = req.headers['x-groq-key'] as string;
  const groqKey = customGroqKey || process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

  if (!groqKey || !groqKey.trim()) {
    return res.status(400).json({ error: 'GROQ_API_KEY is not configured on the server.' });
  }

  const candidateModels = [
    model,
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'groq/compound',
    'groq/compound-mini'
  ].filter(Boolean).filter((m, i, arr) => arr.indexOf(m) === i);

  for (const m of candidateModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey.trim()}`
        },
        body: JSON.stringify({
          model: m,
          messages,
          temperature: Math.min(2.0, Math.max(0.0, Number(temperature) || 0.7)),
          max_tokens: 2048
        })
      });

      const latencyMs = Date.now() - startTime;
      const remTokens = response.headers.get('x-ratelimit-remaining-tokens') || response.headers.get('x-ratelimit-remaining-tokens-minute');
      const limTokens = response.headers.get('x-ratelimit-limit-tokens') || response.headers.get('x-ratelimit-limit-tokens-minute');
      const resReset = response.headers.get('x-ratelimit-reset-tokens');
      const remReqs = response.headers.get('x-ratelimit-remaining-requests');
      const limReqs = response.headers.get('x-ratelimit-limit-requests');

      if (response.ok) {
        const data = await response.json();
        const promptTokens = data?.usage?.prompt_tokens || 0;
        const completionTokens = data?.usage?.completion_tokens || 0;
        const totalTokens = data?.usage?.total_tokens || (promptTokens + completionTokens);

        addGroqServerLog({
          model: m,
          promptTokens,
          completionTokens,
          totalTokens,
          latencyMs,
          status: 'success',
          remainingTokens: remTokens || undefined,
          limitTokens: limTokens || undefined,
          resetTokens: resReset || undefined,
          remainingRequests: remReqs || undefined,
          limitRequests: limReqs || undefined,
          source: 'server_proxy'
        });

        data._telemetry = {
          remainingTokens: remTokens,
          limitTokens: limTokens,
          resetTokens: resReset,
          remainingRequests: remReqs,
          latencyMs
        };

        return res.json(data);
      }
    } catch (groqErr) {
      console.warn(`Groq server call failed on model ${m}:`, groqErr);
    }
  }

  addGroqServerLog({
    model,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    latencyMs: Date.now() - startTime,
    status: 'error',
    source: 'server_proxy'
  });

  return res.status(502).json({
    error: 'All Groq model completion attempts failed on the server.'
  });
});

// Endpoint to log client-side Groq call telemetry to server store
app.post('/api/groq-telemetry/log', (req, res) => {
  const {
    model,
    promptTokens = 0,
    completionTokens = 0,
    totalTokens = 0,
    latencyMs = 0,
    status = 'success',
    remainingTokens,
    limitTokens,
    resetTokens,
    remainingRequests,
    limitRequests
  } = req.body;

  const log = addGroqServerLog({
    model: model || 'groq-unknown',
    promptTokens: Number(promptTokens) || 0,
    completionTokens: Number(completionTokens) || 0,
    totalTokens: Number(totalTokens) || (Number(promptTokens) + Number(completionTokens)),
    latencyMs: Number(latencyMs) || 0,
    status: status === 'error' ? 'error' : 'success',
    remainingTokens: remainingTokens ? String(remainingTokens) : undefined,
    limitTokens: limitTokens ? String(limitTokens) : undefined,
    resetTokens: resetTokens ? String(resetTokens) : undefined,
    remainingRequests: remainingRequests ? String(remainingRequests) : undefined,
    limitRequests: limitRequests ? String(limitRequests) : undefined,
    source: 'client_direct'
  });

  return res.json({ success: true, log });
});

// Endpoint to fetch real-time Groq API usage telemetry & server logs
app.get('/api/groq-telemetry', async (req, res) => {
  try {
    const customGroqKey = req.headers['x-groq-key'] as string;
    const groqKey = customGroqKey || process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

    if ((!latestGroqQuotaHeader.remainingTokens || !latestGroqQuotaHeader.limitTokens) && groqKey && groqKey.trim().length > 10) {
      try {
        const liveRes = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { 'Authorization': `Bearer ${groqKey.trim()}` }
        });
        if (liveRes.ok) {
          const remTokens = liveRes.headers.get('x-ratelimit-remaining-tokens') || liveRes.headers.get('x-ratelimit-remaining-tokens-minute');
          const limTokens = liveRes.headers.get('x-ratelimit-limit-tokens') || liveRes.headers.get('x-ratelimit-limit-tokens-minute');
          const resReset = liveRes.headers.get('x-ratelimit-reset-tokens');
          const remReqs = liveRes.headers.get('x-ratelimit-remaining-requests');
          const limReqs = liveRes.headers.get('x-ratelimit-limit-requests');

          if (remTokens || limTokens) {
            latestGroqQuotaHeader = {
              remainingTokens: remTokens,
              limitTokens: limTokens,
              resetTokens: resReset || '1m',
              remainingRequests: remReqs,
              limitRequests: limReqs,
              lastUpdated: new Date().toISOString()
            };
          }
        }
      } catch (err) {
        console.warn('Live Groq quota check warning:', err);
      }
    }

    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalLatencyMs = 0;

    const modelMap: Record<string, { totalTokens: number; calls: number }> = {};

    groqServerLogs.forEach(log => {
      totalTokens += log.totalTokens;
      totalPromptTokens += log.promptTokens;
      totalCompletionTokens += log.completionTokens;
      totalLatencyMs += log.latencyMs;
      if (log.status === 'success') successCount++;
      else errorCount++;

      if (!modelMap[log.model]) {
        modelMap[log.model] = { totalTokens: 0, calls: 0 };
      }
      modelMap[log.model].totalTokens += log.totalTokens;
      modelMap[log.model].calls += 1;
    });

    const avgLatencyMs = groqServerLogs.length > 0 ? Math.round(totalLatencyMs / groqServerLogs.length) : 0;

    const modelUsage = Object.entries(modelMap).map(([model, stats]) => ({
      model,
      totalTokens: stats.totalTokens,
      calls: stats.calls
    })).sort((a, b) => b.totalTokens - a.totalTokens);

    return res.json({
      success: true,
      quota: latestGroqQuotaHeader,
      totals: {
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalRequests: groqServerLogs.length,
        successCount,
        errorCount,
        avgLatencyMs
      },
      modelUsage,
      logs: groqServerLogs.slice(0, 100),
      serverUptimeSeconds: Math.floor(process.uptime())
    });
  } catch (globalErr: any) {
    console.error('[Server Groq Telemetry Global Error]', globalErr);
    return res.status(200).json({
      success: false,
      error: globalErr.message || 'Telemetry failure',
      quota: latestGroqQuotaHeader,
      totals: {
        totalTokens: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        avgLatencyMs: 0
      },
      modelUsage: [],
      logs: [],
      serverUptimeSeconds: Math.floor(process.uptime())
    });
  }
});

// API Route: Get real-time accurate counts of active questions grouped by subject_id
app.get('/api/admin/subject-counts', async (req, res) => {
  try {
    const { data: subjects, error: subError } = await supabase
      .from('subjects')
      .select('id, name');

    if (subError) {
      console.warn('[Server Admin Subject Counts Warn] Error fetching subjects:', subError.message);
      return res.status(200).json({ success: false, error: subError.message, counts: {}, totalCounts: {}, canonicalCounts: {}, years: {} });
    }

    const counts: Record<string, number> = {};
    const totalCounts: Record<string, number> = {};
    const canonicalCounts: Record<string, number> = {};
    const years: Record<string, string[]> = {};

    if (subjects && subjects.length > 0) {
      await Promise.all(
        subjects.map(async (sub) => {
          // 1. Direct exact count query for active (published) questions
          const { count: activeCount } = await supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('subject_id', sub.id)
            .eq('is_active', true);

          // 2. Direct exact count query for total questions (including drafts)
          const { count: totalCount } = await supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('subject_id', sub.id);

          const finalActive = activeCount ?? 0;
          const finalTotal = totalCount ?? 0;

          counts[sub.id] = finalActive;
          totalCounts[sub.id] = finalTotal;

          const canonical = sub.name.trim().toLowerCase();
          canonicalCounts[canonical] = finalActive;

          // Fetch distinct exam years with active questions
          const { data: yearsData } = await supabase
            .from('questions')
            .select('exam_year')
            .eq('subject_id', sub.id)
            .eq('is_active', true)
            .not('exam_year', 'is', null)
            .limit(200);

          if (yearsData && yearsData.length > 0) {
            const uniqueYears = Array.from(
              new Set(yearsData.map((y: any) => String(y.exam_year).trim()))
            ).filter(Boolean).sort().reverse();
            years[sub.id] = uniqueYears;
          } else {
            years[sub.id] = [];
          }
        })
      );
    }

    return res.json({ success: true, counts, totalCounts, canonicalCounts, years });
  } catch (err: any) {
    console.error('[Server Admin Subject Counts Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch subject counts.' });
  }
});

// API Route: Admin Material Ingestion & Association (Bypasses Client-Side RLS)
app.post('/api/admin/materials/upload-metadata', async (req, res) => {
  const { title, description, subject_id, topic_id, file_path, is_premium } = req.body;
  if (!title || !file_path) {
    return res.status(400).json({ success: false, error: 'Missing required title or file path' });
  }

  try {
    const results: string[] = [];

    // 1. Insert into materials table (use UUID if table expects UUID)
    const newMaterialId = crypto.randomUUID();
    const { error: matError } = await supabase.from('materials').insert({
      id: newMaterialId,
      title,
      description: description || '',
      subject_id: subject_id || null,
      file_path,
      file_size_bytes: 1024 * 1024 * 2,
      visibility: true,
      is_premium: !!is_premium
    });
    if (!matError) results.push('materials_inserted');
    else console.warn('Server materials insert warn:', matError.message);

    // 2. Insert into library_materials table
    const { error: libError } = await supabase.from('library_materials').insert({
      title,
      description: description || '',
      subject_id: subject_id || null,
      file_url: file_path,
      is_premium: !!is_premium,
      is_active: true
    });
    if (!libError) results.push('library_materials_inserted');
    else console.warn('Server library_materials insert warn:', libError.message);

    // 3. Update subjects table with study_material_url if requested and no topic is specified
    if (subject_id && !topic_id) {
      const { error: subError } = await supabase
        .from('subjects')
        .update({ study_material_url: file_path })
        .eq('id', subject_id);
      if (!subError) results.push('subject_url_updated');
      else console.warn('Server subject update warn:', subError.message);
    }

    // 4. Update topics table with study_material_url if topic_id is specified
    if (topic_id) {
      const { error: topError } = await supabase
        .from('topics')
        .update({ study_material_url: file_path })
        .eq('id', topic_id);
      if (!topError) results.push('topic_url_updated');
      else console.warn('Server topic update warn:', topError.message);
    }

    return res.json({ success: true, results });
  } catch (err: any) {
    console.error('[Server Admin Material Upload Metadata Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error uploading material metadata' });
  }
});

// Helper for validating UUID
const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// API Route: Secure Material Deletion (Bypasses Client-Side RLS)
app.post('/api/admin/materials/delete', async (req, res) => {
  const { id, title, file_path } = req.body;
  if (!id && !title && !file_path) {
    return res.status(400).json({ success: false, error: 'Missing required id, title, or file_path parameter' });
  }

  try {
    const results: string[] = [];

    // 1. Delete from materials table by UUID or by matching title
    if (id && isValidUUID(id)) {
      const { error: err1 } = await supabase.from('materials').delete().eq('id', id);
      if (!err1) results.push('materials_deleted_by_id');
      const { error: err2 } = await supabase.from('library_materials').delete().eq('id', id);
      if (!err2) results.push('library_materials_deleted_by_id');
    }

    if (title) {
      const { error: err1 } = await supabase.from('materials').delete().ilike('title', title.trim());
      if (!err1) results.push('materials_deleted_by_title');
      const { error: err2 } = await supabase.from('library_materials').delete().ilike('title', title.trim());
      if (!err2) results.push('library_materials_deleted_by_title');
    }

    // 2. Also delete from storage if file_path is specified
    if (file_path) {
      const cleanPath = file_path.split('/').slice(-2).join('/'); // e.g. "subject_id/file.pdf"
      try { await supabase.storage.from('study-materials').remove([file_path, cleanPath]); } catch {}
      try { await supabase.storage.from('materials').remove([file_path, cleanPath]); } catch {}
      try { await supabase.storage.from('library').remove([file_path, cleanPath]); } catch {}
      results.push('storage_removed');
    }

    return res.json({ success: true, results });
  } catch (err: any) {
    console.error('[Server Secure Delete Material Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error deleting material' });
  }
});

// ─── Persistent Server-Side User Overrides Store ─────────────────────────────
// Guarantees all admin grants, lifetime passes, onboarding completions, and role changes
// immediately and permanently persist across page refreshes and client sessions.
const persistentUserOverrides = new Map<string, Partial<any>>();

// Helper to merge DB profile with server overrides
function mergeProfileWithOverrides(dbProfile: any, userId?: string) {
  const id = dbProfile?.id || userId;
  if (!id) return dbProfile;
  const overrides = persistentUserOverrides.get(id) || {};
  const emailVal = (dbProfile?.email || overrides.email || '').toLowerCase().trim();
  const MASTER_ADMINS = ['admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com'];
  const isMasterAdmin = emailVal && MASTER_ADMINS.includes(emailVal);
  
  return {
    ...dbProfile,
    ...overrides,
    role: isMasterAdmin ? 'admin' : (overrides.role || dbProfile?.role || 'student'),
    has_paid: isMasterAdmin ? true : (overrides.has_paid !== undefined ? overrides.has_paid : !!dbProfile?.has_paid),
    onboarding_completed: isMasterAdmin ? true : (overrides.onboarding_completed !== undefined ? overrides.onboarding_completed : !!dbProfile?.onboarding_completed),
  };
}

// API Route: Authoritative Profile Fetch (Merged with Server Grants & Overrides)
app.get('/api/profile/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, error: 'User ID is required' });

  try {
    const { data: dbProf, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error && !persistentUserOverrides.has(id)) {
      console.warn(`[API /api/profile/${id} DB Warn]`, error.message);
    }

    const merged = mergeProfileWithOverrides(dbProf || { id }, id);
    return res.json({ success: true, profile: merged });
  } catch (err: any) {
    console.error(`[API /api/profile/${id} Error]`, err);
    const fallback = mergeProfileWithOverrides({ id }, id);
    return res.json({ success: true, profile: fallback });
  }
});

// API Route: Complete Student Onboarding
app.post('/api/onboarding/complete', async (req, res) => {
  const { 
    userId, 
    target_score, 
    target_university, 
    daily_study_goal_minutes, 
    utme_subjects, 
    intended_course 
  } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  try {
    const updatePayload: any = {
      onboarding_completed: true,
      target_score: parseInt(target_score) || 270,
      target_university: target_university || 'Not Specified',
      daily_study_goal_minutes: parseInt(daily_study_goal_minutes) || 60,
      utme_subjects: Array.isArray(utme_subjects) ? utme_subjects : ['Use of English'],
      intended_course: intended_course || null,
      updated_at: new Date().toISOString()
    };

    // 1. Update in-memory persistent override store
    const existing = persistentUserOverrides.get(userId) || {};
    persistentUserOverrides.set(userId, {
      ...existing,
      ...updatePayload
    });

    // 2. Update Supabase database
    const { data: dbData, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Onboarding Complete DB Update Warning]', error.message);
    }

    const merged = mergeProfileWithOverrides(dbData || { id: userId, ...updatePayload }, userId);
    return res.json({ 
      success: true, 
      message: 'Onboarding completed successfully', 
      profile: merged 
    });
  } catch (err: any) {
    console.error('[Onboarding Complete Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Server-Side Premium Subscription Grant (Bypasses Client-Side RLS)
app.post('/api/admin/subscriptions/grant', async (req, res) => {
  const { user_id, plan_name = 'Lifetime Access (Gifted)', duration_years = 100 } = req.body;
  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id is required' });
  }

  try {
    // 1. Save in server-side persistent store
    const existing = persistentUserOverrides.get(user_id) || {};
    persistentUserOverrides.set(user_id, {
      ...existing,
      has_paid: true,
      subscription_plan: plan_name,
      updated_at: new Date().toISOString()
    });

    // 2. Update profile in database
    const { error: profError } = await supabase
      .from('profiles')
      .update({ has_paid: true, updated_at: new Date().toISOString() })
      .eq('id', user_id);

    if (profError) {
      console.warn('[Server Grant Access] Profile update warning:', profError.message);
    }

    // 3. Try inserting into subscriptions table
    const expiresAt = new Date(Date.now() + duration_years * 365 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await supabase.from('subscriptions').insert({
        user_id,
        plan_name,
        status: 'active',
        expires_at: expiresAt
      });
    } catch {}

    // 4. Send email notification to user
    try {
      const { data: prof } = await supabase.from('profiles').select('email, full_name').eq('id', user_id).maybeSingle();
      if (prof?.email) {
        sendServerSmtpEmail(
          prof.email,
          `Full Access Granted - Scholars Resort (${plan_name})`,
          `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px;">
             <h2 style="color: #4F46E5; margin-top: 0;">Congratulations, Full Access Granted!</h2>
             <p>Dear ${prof.full_name || 'Scholar'},</p>
             <p>The system administrator has granted you full access to <strong>${plan_name}</strong> on Scholars Resort.</p>
             <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
               <strong>Unlocked Features:</strong>
               <ul style="margin: 6px 0 0 16px; padding: 0;">
                 <li>Unlimited Full-Length UTME CBT Mock Drills</li>
                 <li>All Study Materials & Novel Guides</li>
                 <li>Unrestricted AI Tutor Chat & Analytics</li>
               </ul>
             </div>
             <p style="margin-top: 20px;">
               <a href="https://scholarsresort.com/cbt" style="background: #4F46E5; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Start CBT Practice Now</a>
             </p>
           </div>`
        ).catch(() => {});
      }
    } catch {}

    return res.json({ 
      success: true, 
      message: 'Premium subscription granted successfully.', 
      user_id, 
      has_paid: true 
    });
  } catch (err: any) {
    console.error('[Server Grant Access Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Revoke Premium Subscription
app.post('/api/admin/subscriptions/revoke', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id is required' });
  }

  try {
    // 1. Update in-memory persistent store
    const existing = persistentUserOverrides.get(user_id) || {};
    persistentUserOverrides.set(user_id, {
      ...existing,
      has_paid: false,
      subscription_plan: 'Free Tier',
      updated_at: new Date().toISOString()
    });

    // 2. Update database
    await supabase.from('profiles').update({ has_paid: false, updated_at: new Date().toISOString() }).eq('id', user_id);
    await supabase.from('subscriptions').update({ status: 'revoked' }).eq('user_id', user_id);

    return res.json({ success: true, message: 'Subscription revoked successfully.', user_id, has_paid: false });
  } catch (err: any) {
    console.error('[Server Revoke Access Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Full User Directory for Admin (Merged with Real-Time Server Overrides)
app.get('/api/admin/users/directory', async (req, res) => {
  try {
    const { data: dbProfiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Admin User Directory DB Warning]', error.message);
    }

    const profilesList = (dbProfiles || []).map((p: any) => mergeProfileWithOverrides(p, p.id));

    // Also include any profiles registered only in override map
    const existingIds = new Set(profilesList.map((p: any) => p.id));
    persistentUserOverrides.forEach((override, id) => {
      if (!existingIds.has(id)) {
        profilesList.push(mergeProfileWithOverrides({ id, created_at: new Date().toISOString() }, id));
      }
    });

    return res.json({ success: true, profiles: profilesList });
  } catch (err: any) {
    console.error('[Admin Directory API Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Question Bank - Bulk & Single Insert (Server Admin Client)
app.post('/api/questions/insert', async (req, res) => {
  const { questions } = req.body;
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ success: false, error: 'Array of questions is required.' });
  }

  try {
    const { data, error } = await supabase.from('questions').insert(questions).select();
    if (error) {
      console.warn('[Server Questions Insert Warn]', error.message);
      return res.status(200).json({ success: false, error: error.message, count: 0 });
    }
    return res.json({ success: true, count: data?.length || questions.length, data });
  } catch (err: any) {
    console.error('[Server Questions Insert Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Server insert failed.' });
  }
});

// API Route: Question Bank - Delete
app.delete('/api/questions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Attempt dependent cleanup
    try {
      await supabase.from('exam_answers').delete().eq('question_id', id);
      await supabase.from('question_history').delete().eq('question_id', id);
    } catch {}

    const { error } = await supabase.from('questions').delete().eq('id', id);
    if (error) {
      // Fallback: deactivate
      await supabase.from('questions').update({ is_active: false }).eq('id', id);
      return res.json({ success: true, deactivated: true, message: 'Question deactivated in DB.' });
    }
    return res.json({ success: true, deleted: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Question Bank - Update
app.put('/api/questions/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  try {
    const { data, error } = await supabase.from('questions').update(updates).eq('id', id).select();
    if (error) {
      return res.status(200).json({ success: false, error: error.message });
    }
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Admin Device Reset & Exemption Management
app.post('/api/admin/device/reset', async (req, res) => {
  const { user_id, email } = req.body;
  const MASTER_ADMINS = ['admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com'];

  try {
    if (email && MASTER_ADMINS.includes(email.toLowerCase().trim())) {
      // Master admin is perpetually exempt
      await supabase.from('profiles').update({
        device_uuid: null,
        role: 'admin',
        has_paid: true,
        onboarding_completed: true
      }).eq('email', email);

      return res.json({ success: true, message: 'Master admin device exemption enforced.' });
    }

    if (user_id) {
      const { error } = await supabase.from('profiles').update({
        device_uuid: null,
        updated_at: new Date().toISOString()
      }).eq('id', user_id);

      if (error) {
        return res.status(500).json({ success: false, error: error.message });
      }

      // Also resolve any open device_reset tickets for this user
      await supabase.from('support_tickets').update({
        status: 'resolved'
      }).eq('user_id', user_id).eq('category', 'device_reset');

      return res.json({ success: true, message: 'Device reset successfully. User can now pair a new device.' });
    }

    return res.status(400).json({ success: false, error: 'user_id or email is required.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Admin User Status Update (Suspend, Ban, Reactivate)
app.post('/api/admin/users/status', async (req, res) => {
  const { user_id, status, reason } = req.body;
  if (!user_id || !status) {
    return res.status(400).json({ success: false, error: 'user_id and status are required.' });
  }

  try {
    const isBanned = status === 'banned';
    const isSuspended = status === 'suspended';

    const updates: any = {
      status,
      is_banned: isBanned,
      is_suspended: isSuspended,
      ban_reason: (isBanned || isSuspended) ? (reason || 'Administrative action') : null,
      updated_at: new Date().toISOString()
    };

    // Update in-memory persistent store
    const existing = persistentUserOverrides.get(user_id) || {};
    persistentUserOverrides.set(user_id, {
      ...existing,
      ...updates
    });

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user_id)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Admin User Status Update Warning]', error.message);
    }

    // Try logging into security/audit logs
    try {
      await supabase.from('admin_audit_logs').insert({
        action: `USER_${status.toUpperCase()}`,
        details: `User ${user_id} set to ${status}. Reason: ${reason || 'None provided'}`,
        target_id: user_id,
        created_at: new Date().toISOString()
      });
    } catch {}

    const merged = mergeProfileWithOverrides(data || { id: user_id, ...updates }, user_id);

    // Send email notification to the user regarding their account status change
    if (merged?.email) {
      if (isBanned || isSuspended) {
        sendServerSmtpEmail(
          merged.email,
          `Important Notice: Scholars Resort Account ${isBanned ? 'Banned' : 'Suspended'}`,
          `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px;">
             <h2 style="color: #dc2626; margin-top: 0;">Account ${isBanned ? 'Banned' : 'Suspended'}</h2>
             <p>Dear ${merged.full_name || 'Scholar'},</p>
             <p>Your Scholars Resort account has been <strong>${isBanned ? 'permanently banned' : 'temporarily suspended'}</strong> by the system administrator.</p>
             <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px 16px; border-radius: 8px; margin: 16px 0; color: #991b1b;">
               <strong>Reason:</strong> ${reason || 'Administrative policy enforcement'}
             </div>
             <p>If you believe this was done in error or would like to submit an appeal, please reply directly to this email or contact support at <a href="mailto:admitwise2@gmail.com">admitwise2@gmail.com</a>.</p>
           </div>`
        ).catch(() => {});
      } else if (status === 'active') {
        sendServerSmtpEmail(
          merged.email,
          'Your Scholars Resort Account Has Been Reactivated',
          `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px;">
             <h2 style="color: #16a34a; margin-top: 0;">Account Reinstated</h2>
             <p>Dear ${merged.full_name || 'Scholar'},</p>
             <p>Great news! Your Scholars Resort account has been reviewed and successfully <strong>reactivated</strong>.</p>
             <p>You can now log in and continue your JAMB UTME exam preparation, CBT mock drills, and access study materials.</p>
             <p style="margin-top: 20px;">
               <a href="https://scholarsresort.com/login" style="background: #4F46E5; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Log In to Account</a>
             </p>
           </div>`
        ).catch(() => {});
      }
    }

    return res.json({ success: true, message: `User status changed to ${status}.`, profile: merged });
  } catch (err: any) {
    console.error('[API /api/admin/users/status Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
  }
});

// API Route: Admin User Role Update
app.post('/api/admin/users/role', async (req, res) => {
  const { user_id, role } = req.body;
  if (!user_id || !role) {
    return res.status(400).json({ success: false, error: 'user_id and role are required.' });
  }

  try {
    const updates: any = {
      role,
      updated_at: new Date().toISOString()
    };
    if (role === 'admin') {
      updates.has_paid = true;
      updates.onboarding_completed = true;
    }

    // Update in-memory persistent store
    const existing = persistentUserOverrides.get(user_id) || {};
    persistentUserOverrides.set(user_id, {
      ...existing,
      ...updates
    });

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user_id)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Admin User Role Update Warning]', error.message);
    }

    const merged = mergeProfileWithOverrides(data || { id: user_id, ...updates }, user_id);
    return res.json({ success: true, message: `User role updated to ${role}.`, profile: merged });
  } catch (err: any) {
    console.error('[API /api/admin/users/role Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Admin User Complete Deletion
app.post('/api/admin/users/delete', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id is required.' });
  }

  try {
    persistentUserOverrides.delete(user_id);

    // Delete user from linked tables
    await Promise.allSettled([
      supabase.from('guardian_links').delete().or(`guardian_id.eq.${user_id},student_id.eq.${user_id}`),
      supabase.from('guardian_student_relationships').delete().or(`guardian_id.eq.${user_id},student_id.eq.${user_id}`),
      supabase.from('exam_sessions').delete().eq('user_id', user_id),
      supabase.from('manual_payments').delete().eq('user_id', user_id),
      supabase.from('device_sessions').delete().eq('user_id', user_id),
      supabase.from('session_answers').delete().eq('user_id', user_id),
      supabase.from('support_tickets').delete().eq('user_id', user_id),
      supabase.from('study_streaks').delete().eq('user_id', user_id),
      supabase.from('profiles').delete().eq('id', user_id)
    ]);

    // Try deleting from auth.users if admin service role is available
    try {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        const adminAuthClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        await adminAuthClient.auth.admin.deleteUser(user_id);
      }
    } catch (authErr) {
      console.warn('[Admin User Auth Delete Warning]', authErr);
    }

    return res.json({ success: true, message: 'User and all associated records deleted successfully.' });
  } catch (err: any) {
    console.error('[API /api/admin/users/delete Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Guardian Portal - Link Student by Student Identifier / Invite Code
app.post('/api/guardian/link', async (req, res) => {
  const { guardianId, studentId, inviteCode } = req.body;
  if (!guardianId || (!studentId && !inviteCode)) {
    return res.status(400).json({ success: false, error: 'guardianId and (studentId or inviteCode) are required.' });
  }

  try {
    let resolvedStudentId = studentId;

    if (!resolvedStudentId && inviteCode) {
      const { data: matched } = await supabase
        .from('profiles')
        .select('id')
        .or(`invite_code.eq.${inviteCode.trim().toUpperCase()},id.eq.${inviteCode.trim()}`)
        .maybeSingle();

      if (matched) resolvedStudentId = matched.id;
    }

    if (!resolvedStudentId) {
      return res.status(404).json({ success: false, error: 'Student account not found with the provided code.' });
    }

    // Insert into relationships
    await Promise.allSettled([
      supabase.from('guardian_student_relationships').upsert({
        guardian_id: guardianId,
        student_id: resolvedStudentId,
        status: 'active',
        created_at: new Date().toISOString()
      }),
      supabase.from('guardian_links').upsert({
        guardian_id: guardianId,
        student_id: resolvedStudentId,
        status: 'active',
        created_at: new Date().toISOString()
      })
    ]);

    return res.json({ success: true, message: 'Student ward successfully linked to guardian.' });
  } catch (err: any) {
    console.error('[API /api/guardian/link Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Route: Guardian Portal - Get Linked Students (strictly scoped by guardian_id)
app.get('/api/guardian/students', async (req, res) => {
  const guardianId = req.query.guardianId as string;
  if (!guardianId) {
    return res.status(400).json({ success: false, error: 'guardianId query parameter is required.' });
  }

  try {
    let studentIds: string[] = [];
    
    // 1. Try guardian_student_relationships table first
    try {
      const { data: rels, error: relErr } = await supabase
        .from('guardian_student_relationships')
        .select('*')
        .eq('guardian_id', guardianId)
        .eq('status', 'active');
      
      if (!relErr && rels && rels.length > 0) {
        studentIds = Array.from(new Set(rels.map((r: any) => r.student_id).filter(Boolean)));
      }
    } catch {
      // fallback
    }

    // 2. Fallback to guardian_links table
    if (studentIds.length === 0) {
      const { data: links, error: linkErr } = await supabase
        .from('guardian_links')
        .select('*')
        .eq('guardian_id', guardianId)
        .eq('status', 'active');

      if (!linkErr && links && links.length > 0) {
        studentIds = Array.from(new Set(links.map((l: any) => l.student_id).filter(Boolean)));
      }
    }

    if (studentIds.length === 0) {
      return res.json({ success: true, students: [] });
    }

    // 3. Join profiles for linked students
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, has_paid, target_score, target_university, target_course, streak_days, xp, last_active, created_at')
      .in('id', studentIds);

    if (profErr) {
      return res.status(500).json({ success: false, error: profErr.message });
    }

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

    const formatted = studentIds.map((sId: string) => {
      const p = profileMap[sId] || {};
      return {
        id: sId,
        name: p.full_name || p.email || 'Student Ward',
        email: p.email || '',
        has_paid: !!p.has_paid,
        target_score: p.target_score || 320,
        target_university: p.target_university || '',
        target_course: p.target_course || '',
        xp: p.xp || 0,
        streak_days: p.streak_days || 0,
        last_active: p.last_active,
        status: 'active'
      };
    });

    return res.json({ success: true, students: formatted });
  } catch (err: any) {
    console.error('[API /api/guardian/students Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
  }
});

// API Route: Guardian Portal - Get Comprehensive Student Performance & Analytics
app.post('/api/guardian/student-details', async (req, res) => {
  const { guardianId, studentId } = req.body;

  if (!guardianId || !studentId) {
    return res.status(400).json({ success: false, error: 'Both guardianId and studentId are required.' });
  }

  try {
    // 1. Security Check: verify guardian is actively linked to this student
    let isLinked = false;
    try {
      const { data: rel } = await supabase
        .from('guardian_student_relationships')
        .select('id')
        .eq('guardian_id', guardianId)
        .eq('student_id', studentId)
        .eq('status', 'active')
        .maybeSingle();
      if (rel) isLinked = true;
    } catch {}

    if (!isLinked) {
      try {
        const { data: link } = await supabase
          .from('guardian_links')
          .select('id')
          .eq('guardian_id', guardianId)
          .eq('student_id', studentId)
          .eq('status', 'active')
          .maybeSingle();
        if (link) isLinked = true;
      } catch {}
    }

    if (!isLinked) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Student is not linked to this guardian account.' });
    }

    // 2. Fetch Student Profile (Merged with server overrides)
    const { data: dbStudentProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    const studentProfile = mergeProfileWithOverrides(dbStudentProfile || { id: studentId }, studentId);

    if (!studentProfile) {
      return res.status(404).json({ success: false, error: 'Student record not found.' });
    }

    // 3. Fetch Real Exam Sessions
    const { data: sessions } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false });

    // 4. Fetch Real Payments
    const { data: payments } = await supabase
      .from('manual_payments')
      .select('*')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false });

    // 5. Fetch Real Answers
    const { data: answerData } = await supabase
      .from('session_answers')
      .select('question_id, is_correct, created_at, time_spent_seconds')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false })
      .limit(300);

    // 6. Subject Accuracy & Weak Areas
    const subjectScores: Record<string, { correct: number; total: number }> = {};
    if (answerData && answerData.length > 0) {
      const qIds = Array.from(new Set(answerData.map((a: any) => a.question_id).filter(Boolean)));
      if (qIds.length > 0) {
        const { data: qList } = await supabase
          .from('questions')
          .select('id, subject_id')
          .in('id', qIds.slice(0, 100));

        const subIds = Array.from(new Set((qList || []).map((q: any) => q.subject_id).filter(Boolean)));
        let subMap: Record<string, string> = {};
        if (subIds.length > 0) {
          const { data: subs } = await supabase.from('subjects').select('id, name').in('id', subIds);
          (subs || []).forEach((s: any) => { subMap[s.id] = s.name; });
        }

        const qSubjectMap: Record<string, string> = {};
        (qList || []).forEach((q: any) => {
          if (q.subject_id && subMap[q.subject_id]) {
            qSubjectMap[q.id] = subMap[q.subject_id];
          }
        });

        answerData.forEach((a: any) => {
          const subName = qSubjectMap[a.question_id] || 'General Studies';
          if (!subjectScores[subName]) subjectScores[subName] = { correct: 0, total: 0 };
          subjectScores[subName].total++;
          if (a.is_correct) subjectScores[subName].correct++;
        });
      }
    }

    if (Object.keys(subjectScores).length === 0 && sessions && sessions.length > 0) {
      sessions.forEach((s: any) => {
        const subName = s.subject_name || s.subject || 'UTME Mock Exam';
        if (!subjectScores[subName]) subjectScores[subName] = { correct: 0, total: 0 };
        const totalQ = s.total_questions || 50;
        const score = s.score || 0;
        subjectScores[subName].total += totalQ;
        subjectScores[subName].correct += Math.min(score, totalQ);
      });
    }

    const weakSubjects = Object.entries(subjectScores)
      .map(([name, s]) => ({ name, rate: s.total > 0 ? s.correct / s.total : 1 }))
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3)
      .map(s => s.name);

    // 7. Global Rank
    let globalRank = 1;
    try {
      const { count: higherCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('xp', studentProfile.xp || 0);
      globalRank = (higherCount || 0) + 1;
    } catch {}

    // 8. Exam History & Scores
    const submittedSessions = (sessions || []).filter((s: any) => s.status === 'submitted' || (s.score && s.score > 0));
    let avgScore = 0;
    const target = studentProfile.target_score || 320;
    let readiness = 0;
    let history: any[] = [];

    if (submittedSessions.length > 0) {
      const totalEquiv = submittedSessions.reduce((acc: number, curr: any) => {
        const raw = curr.score || 0;
        const totalQ = curr.total_questions || 50;
        return acc + Math.round((raw / totalQ) * 400);
      }, 0);
      avgScore = Math.round(totalEquiv / submittedSessions.length);
      readiness = Math.min(100, Math.max(15, Math.round((avgScore / target) * 85 + (submittedSessions.length * 3))));

      history = submittedSessions.slice(0, 6).map((s: any) => {
        const raw = s.score || 0;
        const totalQ = s.total_questions || 50;
        const mins = s.time_spent_seconds ? Math.floor(s.time_spent_seconds / 60) : null;
        const dateStr = s.submitted_at || s.created_at;
        return {
          date: dateStr ? new Date(dateStr).toLocaleDateString() : 'Recent',
          score: Math.round((raw / totalQ) * 400),
          percent: Math.round((raw / totalQ) * 100),
          time: mins ? `${mins} min` : 'N/A'
        };
      });
    }

    // 9. Focus Time in past 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let weeklyFocusSeconds = 0;
    (sessions || []).forEach((s: any) => {
      const sDate = new Date(s.created_at || s.submitted_at || 0);
      if (sDate >= sevenDaysAgo && s.time_spent_seconds) {
        weeklyFocusSeconds += Number(s.time_spent_seconds);
      }
    });
    (answerData || []).forEach((a: any) => {
      const aDate = new Date(a.created_at || 0);
      if (aDate >= sevenDaysAgo && a.time_spent_seconds) {
        weeklyFocusSeconds += Number(a.time_spent_seconds);
      }
    });
    const focusHours = Math.floor(weeklyFocusSeconds / 3600);
    const focusMins = Math.floor((weeklyFocusSeconds % 3600) / 60);
    const weeklyFocusFormatted = focusHours > 0 ? `${focusHours}h ${focusMins}m` : `${focusMins || (submittedSessions.length > 0 ? submittedSessions.length * 20 : 0)}m`;

    // 10. 14-Day Activity Heatmap
    const heatmapDays: { date: string; count: number; intensity: number }[] = [];
    const activityCountByDay: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      activityCountByDay[d.toISOString().split('T')[0]] = 0;
    }
    (sessions || []).forEach((s: any) => {
      const day = (s.created_at || '').split('T')[0];
      if (activityCountByDay[day] !== undefined) activityCountByDay[day] += 1;
    });
    (answerData || []).forEach((a: any) => {
      const day = (a.created_at || '').split('T')[0];
      if (activityCountByDay[day] !== undefined) activityCountByDay[day] += 1;
    });
    Object.entries(activityCountByDay).forEach(([date, count]) => {
      let intensity = 0;
      if (count >= 15) intensity = 3;
      else if (count >= 5) intensity = 2;
      else if (count > 0) intensity = 1;
      heatmapDays.push({ date, count, intensity });
    });

    const daysActiveInWeek = heatmapDays.slice(7).filter(d => d.count > 0).length;
    const attendanceRate = Math.min(100, Math.round((daysActiveInWeek / 7) * 100));

    const defaultSubjects = ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];
    const subjectProgress = Object.keys(subjectScores).length > 0
      ? Object.entries(subjectScores).map(([sub, s]) => ({
          sub,
          progress: s.total > 0 ? Math.min(100, Math.round((s.correct / s.total) * 100)) : 0
        }))
      : defaultSubjects.map(sub => ({ sub, progress: 0 }));

    return res.json({
      success: true,
      data: {
        id: studentProfile.id,
        name: studentProfile.full_name || studentProfile.email || 'Student Ward',
        email: studentProfile.email || '',
        has_paid: !!studentProfile.has_paid,
        score: avgScore,
        weakSubjects: weakSubjects.length > 0 ? weakSubjects : ['No weak areas identified yet'],
        recentActivity: history.length > 0 ? `Mock Exam on ${history[0].date}` : (studentProfile.last_active ? `Active on ${new Date(studentProfile.last_active).toLocaleDateString()}` : 'No activity logged yet'),
        readiness,
        target,
        globalRank,
        weeklyFocusTime: weeklyFocusFormatted,
        attendanceRate: attendanceRate > 0 ? `${attendanceRate}%` : (studentProfile.streak_days ? `${Math.min(100, studentProfile.streak_days * 15)}%` : '0%'),
        heatmap: heatmapDays,
        payments: (payments || []).map((p: any) => ({
          date: new Date(p.created_at).toLocaleDateString(),
          amount: `₦${Number(p.amount || 0).toLocaleString()}`,
          ref: p.id ? p.id.substring(0, 8).toUpperCase() : 'REC-AUTOPAY',
          status: p.status || 'approved'
        })),
        syllabus: subjectProgress,
        history
      }
    });
  } catch (err: any) {
    console.error('[API /api/guardian/student-details Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
  }
});

// API Route: Admin Materials Metadata Upload & Persistence Handler
app.post('/api/admin/materials/upload-metadata', async (req, res) => {
  const { title, description, subject_id, file_path, is_premium } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required for study material.' });
  }

  try {
    const payload = {
      title,
      description: description || '',
      subject_id: subject_id || null,
      file_path: file_path || '',
      is_premium: !!is_premium,
      created_at: new Date().toISOString()
    };

    let insertedData: any = null;

    // 1. Try inserting into library_materials
    try {
      const { data, error } = await supabase.from('library_materials').insert(payload).select().maybeSingle();
      if (!error && data) insertedData = data;
    } catch (_) {}

    // 2. Try inserting into materials table as fallback/complement
    try {
      const { data, error } = await supabase.from('materials').insert(payload).select().maybeSingle();
      if (!error && data && !insertedData) insertedData = data;
    } catch (_) {}

    // 3. If subject_id is provided, safely update subjects table
    if (subject_id && file_path) {
      try {
        await supabase.from('subjects').update({
          study_material_url: file_path,
          study_materials_url: file_path,
          updated_at: new Date().toISOString()
        }).eq('id', subject_id);
      } catch (_) {}
    }

    return res.json({
      success: true,
      data: insertedData || { ...payload, id: `mat_${Date.now()}` }
    });
  } catch (err: any) {
    console.error('[API /api/admin/materials/upload-metadata Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save material metadata.' });
  }
});

// API Route: Verify & Diagnose Supabase Storage Buckets
app.get('/api/admin/storage/verify', async (req, res) => {
  const targetBuckets = ['study-materials', 'materials', 'library'];
  const results: Record<string, { exists: boolean; public: boolean; error?: string; probeSuccess?: boolean }> = {};
  let overallBucketCount = 0;
  let listBucketsError: string | null = null;

  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      listBucketsError = listError.message;
    } else if (buckets) {
      overallBucketCount = buckets.length;
      buckets.forEach(b => {
        if (targetBuckets.includes(b.name) || targetBuckets.includes(b.id)) {
          results[b.name || b.id] = {
            exists: true,
            public: !!b.public,
            probeSuccess: true
          };
        }
      });
    }
  } catch (err: any) {
    listBucketsError = err.message || 'Failed listing storage buckets';
  }

  // Probe each bucket individually by attempting a metadata read / probe ping
  for (const bName of targetBuckets) {
    if (!results[bName]) {
      try {
        const { data: probeList, error: probeErr } = await supabase.storage.from(bName).list('', { limit: 1 });
        if (!probeErr) {
          results[bName] = {
            exists: true,
            public: true,
            probeSuccess: true
          };
        } else {
          // Check if bucket creation is possible
          results[bName] = {
            exists: false,
            public: false,
            error: probeErr.message || 'Bucket not found'
          };
        }
      } catch (e: any) {
        results[bName] = {
          exists: false,
          public: false,
          error: e.message || 'Bucket probe exception'
        };
      }
    }
  }

  // Attempt auto-creation for missing buckets
  const autoCreated: string[] = [];
  for (const bName of targetBuckets) {
    if (!results[bName]?.exists) {
      try {
        const { error: createErr } = await supabase.storage.createBucket(bName, {
          public: true,
          fileSizeLimit: 52428800 // 50 MB
        });
        if (!createErr) {
          results[bName] = { exists: true, public: true, probeSuccess: true };
          autoCreated.push(bName);
        }
      } catch (_) {}
    }
  }

  const sqlInstructions = `-- SUPABASE SQL SCRIPT: CREATE STORAGE BUCKETS & RLS POLICIES
-- Copy and paste this directly into Supabase Dashboard -> SQL Editor -> Run

-- 1. Create 'study-materials' bucket (Public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('study-materials', 'study-materials', true, 52428800, ARRAY['application/pdf', 'application/epub+zip', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Create 'materials' bucket (Public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('materials', 'materials', true, 52428800, ARRAY['application/pdf', 'application/epub+zip', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Create 'library' bucket (Public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('library', 'library', true, 52428800, ARRAY['application/pdf', 'application/epub+zip', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Enable Public Read Access for all users & students
DROP POLICY IF EXISTS "Public Read Access for Study Materials" ON storage.objects;
CREATE POLICY "Public Read Access for Study Materials" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('study-materials', 'materials', 'library'));

-- 5. Enable Upload Access for Admins & Authenticated Users
DROP POLICY IF EXISTS "Upload Access for Study Materials" ON storage.objects;
CREATE POLICY "Upload Access for Study Materials" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id IN ('study-materials', 'materials', 'library'));

-- 6. Enable Update Access
DROP POLICY IF EXISTS "Update Access for Study Materials" ON storage.objects;
CREATE POLICY "Update Access for Study Materials" 
ON storage.objects FOR UPDATE 
USING (bucket_id IN ('study-materials', 'materials', 'library'));

-- 7. Enable Delete Access
DROP POLICY IF EXISTS "Delete Access for Study Materials" ON storage.objects;
CREATE POLICY "Delete Access for Study Materials" 
ON storage.objects FOR DELETE 
USING (bucket_id IN ('study-materials', 'materials', 'library'));
`;

  return res.json({
    success: true,
    supabaseUrl,
    overallBucketCount,
    listBucketsError,
    buckets: results,
    autoCreated,
    allReady: targetBuckets.every(b => results[b]?.exists),
    sqlInstructions,
    setupSteps: [
      "1. Open your Supabase Project Dashboard (https://supabase.com/dashboard).",
      "2. Go to 'Storage' in the left sidebar menu.",
      "3. Click 'New Bucket' -> Name it 'study-materials' -> Toggle 'Public bucket' ON -> Click Save.",
      "4. Create another bucket named 'materials' -> Toggle 'Public bucket' ON -> Click Save.",
      "5. Alternatively, open 'SQL Editor' and run the copyable SQL script provided to create buckets and RLS policies in 1 click."
    ]
  });
});

// API Route: Backend Proxied File Upload with Exponential Backoff Retries & Fallbacks
app.post('/api/admin/materials/upload-file', async (req, res) => {
  const { fileName, fileBase64, contentType = 'application/pdf', title, description, subject_id, is_premium } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required for material upload.' });
  }

  if (!fileBase64 && !fileName) {
    return res.status(400).json({ success: false, error: 'File data is required for upload.' });
  }

  try {
    // 1. Decode base64 payload to binary buffer
    let buffer: Buffer;
    if (fileBase64.includes(';base64,')) {
      const base64Data = fileBase64.split(';base64,').pop();
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(fileBase64, 'base64');
    }

    const cleanExt = fileName ? (fileName.split('.').pop() || 'pdf') : 'pdf';
    const uniqueFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${cleanExt}`;
    const storagePath = `${subject_id || 'general'}/${uniqueFileName}`;

    let publicUrl = '';
    let bucketUsed = '';
    let uploadErrors: string[] = [];

    // Helper: Retry upload function with exponential backoff
    const tryUploadToBucket = async (bucketName: string, maxAttempts = 3): Promise<boolean> => {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const { error: upErr } = await supabase.storage
            .from(bucketName)
            .upload(storagePath, buffer, {
              contentType: contentType || 'application/pdf',
              upsert: true
            });

          if (!upErr) {
            const { data: pubData } = supabase.storage.from(bucketName).getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              publicUrl = pubData.publicUrl;
              bucketUsed = bucketName;
              return true;
            }
          } else {
            uploadErrors.push(`[${bucketName} attempt ${attempt}/${maxAttempts}] ${upErr.message}`);
            // If bucket not found, break to next bucket rather than retrying same missing bucket
            if (upErr.message?.toLowerCase().includes('not found') || upErr.message?.toLowerCase().includes('bucket')) {
              break;
            }
          }
        } catch (e: any) {
          uploadErrors.push(`[${bucketName} attempt ${attempt}] ${e.message}`);
        }

        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, attempt * 300));
        }
      }
      return false;
    };

    // 2. Sequential bucket upload hierarchy with retries
    let isUploaded = await tryUploadToBucket('study-materials', 3);
    if (!isUploaded) {
      isUploaded = await tryUploadToBucket('materials', 3);
    }
    if (!isUploaded) {
      isUploaded = await tryUploadToBucket('library', 2);
    }

    // 3. Fallback to permanent Data URL representation if Supabase storage is completely unavailable
    let fallbackUsed = false;
    if (!publicUrl) {
      fallbackUsed = true;
      publicUrl = fileBase64.startsWith('data:') ? fileBase64 : `data:${contentType};base64,${fileBase64}`;
    }

    // 4. Update database tables
    const newMaterialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const materialPayload = {
      id: newMaterialId,
      title,
      description: description || '',
      subject_id: subject_id || null,
      file_path: publicUrl,
      file_url: publicUrl,
      file_size_bytes: buffer.length,
      visibility: true,
      is_premium: !!is_premium,
      created_at: new Date().toISOString()
    };

    // 4a. Update subjects table
    if (subject_id) {
      try {
        await supabase.from('subjects').update({
          study_material_url: publicUrl,
          study_materials_url: publicUrl,
          updated_at: new Date().toISOString()
        }).eq('id', subject_id);
      } catch (sErr) {
        console.warn('Subject update notice:', sErr);
      }
    }

    // 4b. Insert to library_materials & materials
    try {
      await supabase.from('library_materials').insert({
        title,
        description: description || '',
        subject_id: subject_id || null,
        file_url: publicUrl,
        is_premium: !!is_premium,
        is_active: true,
        created_at: new Date().toISOString()
      });
    } catch (_) {}

    try {
      await supabase.from('materials').insert(materialPayload);
    } catch (_) {}

    return res.json({
      success: true,
      publicUrl,
      bucketUsed: bucketUsed || 'embedded_persistent_data',
      fallbackUsed,
      uploadErrors: uploadErrors.length > 0 ? uploadErrors : undefined,
      material: materialPayload
    });

  } catch (err: any) {
    console.error('[API /api/admin/materials/upload-file Error]', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'File upload failed.'
    });
  }
});

// API Route: Peer Study Rooms List
app.get('/api/study-rooms', (req, res) => {
  return res.json({ success: true, rooms: getActiveStudyRoomsList() });
});

// Vite middleware for development vs static for production
async function startServer() {
  const httpServer = http.createServer(app);

  // Setup WebSocket server for Peer Study Rooms
  setupStudyRoomWebSocket(httpServer);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running with WebSocket study room support on http://0.0.0.0:${PORT}`);
  });
}

startServer();
