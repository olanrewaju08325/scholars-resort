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
      from: customConfig.fromEmail || customConfig.from || 'admitwise2@gmail.com'
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
        from: data.value.from || 'admitwise2@gmail.com'
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

// API Route: Groq & Gemini AI Chat Proxy
app.post('/api/groq-chat', async (req, res) => {
  const { messages, model = 'llama-3.3-70b-versatile', temperature = 0.7 } = req.body;
  const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  // 1. Try Groq if key exists
  if (groqKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: 2048
        })
      });

      if (response.ok) {
        const data = await response.json();
        return res.json(data);
      }
    } catch (groqErr) {
      console.warn('Groq API call on server failed, trying Gemini fallback:', groqErr);
    }
  }

  // 2. Try Gemini fallback if key exists
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt
      });
      const text = response.text || '';
      return res.json({
        choices: [{ message: { role: 'assistant', content: text } }],
        content: text
      });
    } catch (geminiErr: any) {
      console.warn('Gemini fallback failed:', geminiErr?.message);
    }
  }

  return res.status(400).json({
    error: 'AI Proxy requires an active GROQ_API_KEY or GEMINI_API_KEY on the server.'
  });
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
