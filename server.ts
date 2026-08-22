import express from 'express';
import cors from 'cors';
import path from 'path';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Helper to get Supabase client on server
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';
const supabase = createClient(supabaseUrl, supabaseKey);

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

// API Route: Send Email
app.post('/api/send-email', async (req, res) => {
  const { to, subject, html, text, smtpConfig } = req.body;

  if (!to || (!html && !text)) {
    return res.status(400).json({ success: false, error: 'Recipient "to" and email content are required.' });
  }

  const config = await getSmtpConfig(smtpConfig);

  if (!config.host) {
    return res.status(400).json({
      success: false,
      delivered: false,
      error: 'SMTP Host is not configured. Please enter SMTP settings in Admin -> Settings or set environment variables.'
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

    return res.json({
      success: true,
      delivered: true,
      messageId: info.messageId,
      message: `Email dispatched successfully to ${to} via ${config.host}:${config.port}`
    });
  } catch (err: any) {
    console.error('[SMTP DISPATCH ERROR]', err);
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
        auth: { user: 'admitwise2@gmail.com', pass: 'fliwopndlqxipara' }
      });
    }

    const senderEmail = config.from || 'admitwise2@gmail.com';

    // 1. Send Admin Notification Email
    await transporter.sendMail({
      from: `"Scholars Resort System" <${senderEmail}>`,
      to: 'admitwise2@gmail.com',
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
      return res.status(200).json({ success: false, error: subError.message, counts: {}, years: {} });
    }

    const counts: Record<string, number> = {};
    const canonicalCounts: Record<string, number> = {};
    const years: Record<string, string[]> = {};

    // Real-time grouping query using Supabase SDK
    const { data: groupingData, error: groupError } = await supabase
      .from('questions')
      .select('subject_id')
      .eq('is_active', true);

    const groupCounts: Record<string, number> = {};
    if (!groupError && groupingData) {
      groupingData.forEach((q: any) => {
        if (q.subject_id) {
          groupCounts[q.subject_id] = (groupCounts[q.subject_id] || 0) + 1;
        }
      });
    }

    if (subjects && subjects.length > 0) {
      await Promise.all(
        subjects.map(async (sub) => {
          // Use the real-time aggregated count
          let count = groupCounts[sub.id] || 0;

          // Double check with direct fallback if count is zero to prevent missing newly inserted active questions
          if (count === 0) {
            const { count: fallbackCount, error: countError } = await supabase
              .from('questions')
              .select('id', { count: 'exact', head: true })
              .eq('subject_id', sub.id)
              .eq('is_active', true);
            if (!countError && fallbackCount !== null) {
              count = fallbackCount;
            }
          }

          counts[sub.id] = count;
          const canonical = sub.name.trim().toLowerCase();
          canonicalCounts[canonical] = count;

          // Fetch past years with active questions
          const { data: yearsData } = await supabase
            .from('questions')
            .select('exam_year')
            .eq('subject_id', sub.id)
            .eq('is_active', true)
            .not('exam_year', 'is', null)
            .limit(100);

          if (yearsData && yearsData.length > 0) {
            const uniqueYears = Array.from(new Set(yearsData.map(y => String(y.exam_year)))).sort().reverse();
            years[sub.id] = uniqueYears;
          } else {
            years[sub.id] = [];
          }
        })
      );
    }

    return res.json({ success: true, counts, canonicalCounts, years });
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

    // 1. Insert into materials table
    const newMaterialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
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

// API Route: Secure Material Deletion (Bypasses Client-Side RLS)
app.post('/api/admin/materials/delete', async (req, res) => {
  const { id, title, file_path } = req.body;
  if (!id && !title) {
    return res.status(400).json({ success: false, error: 'Missing required id or title parameter' });
  }

  try {
    const results: string[] = [];

    // 1. Delete from materials table by ID or by matching title
    if (id) {
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

    // 2. Also try to delete from storage if file_path is specified
    if (file_path) {
      const cleanPath = file_path.split('/').slice(-2).join('/'); // e.g. "subject_id/file.pdf"
      await supabase.storage.from('study-materials').remove([file_path, cleanPath]).catch(() => {});
      await supabase.storage.from('materials').remove([file_path, cleanPath]).catch(() => {});
    }

    return res.json({ success: true, results });
  } catch (err: any) {
    console.error('[Server Secure Delete Material Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error deleting material' });
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

// Vite middleware for development vs static for production
async function startServer() {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
