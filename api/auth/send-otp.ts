import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { email } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    // Log to communication_logs in Supabase for cross-serverless persistence
    try {
      await supabase.from('communication_logs').insert({
        recipient_email: cleanEmail,
        email_type: 'password_reset',
        subject: 'Your Scholars Resort Security Verification Code',
        status: 'dispatched',
        metadata: {
          pin: generatedOtp,
          code: generatedOtp,
          expires_at: expiresAt,
          used: false
        },
        created_at: new Date().toISOString()
      });
    } catch (logErr) {
      console.warn('[OTP Log Notice]', logErr);
    }

    // Dispatch email
    let dispatched = false;
    try {
      const targetHost = process.env.SMTP_HOST || 'smtp.gmail.com';
      const targetPort = Number(process.env.SMTP_PORT || 587);
      const targetUser = process.env.SMTP_USER || process.env.GMAIL_USER || 'admitwise2@gmail.com';
      const targetPass = process.env.SMTP_PASS || process.env.GMAIL_PASS;

      if (targetUser && targetPass) {
        const transporter = nodemailer.createTransport({
          host: targetHost,
          port: targetPort,
          secure: targetPort === 465,
          auth: { user: targetUser, pass: targetPass },
          tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
          from: `"Scholars Resort Authentication" <${targetUser}>`,
          to: cleanEmail,
          subject: `${generatedOtp} is your Scholars Resort Verification Code`,
          html: `
            <div style="font-family: sans-serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
              <h2 style="color: #0f172a;">Security Verification Code</h2>
              <p>Your one-time 6-digit verification code is:</p>
              <div style="margin: 24px 0; text-align: center;">
                <span style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 10px; color: #4f46e5; background: #f8fafc; padding: 12px 24px; border-radius: 8px; border: 1px solid #c7d2fe;">${generatedOtp}</span>
              </div>
              <p style="font-size: 13px; color: #64748b;">This code expires in 15 minutes.</p>
            </div>
          `
        });
        dispatched = true;
      }
    } catch (mailErr) {
      console.warn('Mail dispatch error:', mailErr);
    }

    return res.status(200).json({
      success: true,
      delivered: dispatched,
      message: 'Verification code generated and dispatched.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
  }
}
