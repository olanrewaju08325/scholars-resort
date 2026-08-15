import express from 'express';
import cors from 'cors';
import path from 'path';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';

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
      from: customConfig.fromEmail || customConfig.from || 'noreply@scholarsresort.com'
    };
  }

  // Try DB
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
        from: data.value.from || 'noreply@scholarsresort.com'
      };
    }
  } catch (err) {
    console.warn('Failed to load SMTP config from DB:', err);
  }

  // Fallback to process.env
  return {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || process.env.GMAIL_USER || '',
    pass: process.env.SMTP_PASS || process.env.GMAIL_PASS || '',
    from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@scholarsresort.com'
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
    return res.status(500).json({
      success: false,
      latency,
      message: `SMTP Connection Failed: ${err.message || 'Authentication or network timeout'}`,
      error: err.message,
      code: err.code
    });
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
