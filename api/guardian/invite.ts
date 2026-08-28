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

  const { studentId, parentEmail, studentName, baseUrl } = req.body || {};
  if (!studentId) {
    return res.status(400).json({ success: false, error: 'studentId is required.' });
  }

  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, full_name, email, invite_code')
      .eq('id', studentId)
      .maybeSingle();

    if (!prof) {
      return res.status(404).json({ success: false, error: 'Student profile not found.' });
    }

    let code = prof.invite_code;
    if (!code) {
      code = `SCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      await supabase.from('profiles').update({ invite_code: code }).eq('id', studentId);
    }

    await supabase.from('guardian_links').upsert({
      student_id: studentId,
      invitation_code: code,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    const appOrigin = baseUrl || req.headers.origin || 'https://scholars-resort.vercel.app';
    const connectUrl = `${appOrigin}/guardian-connect?code=${code}`;

    let emailSent = false;
    if (parentEmail && parentEmail.trim()) {
      try {
        const sName = studentName || prof.full_name || prof.email || 'Your Student Ward';
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
            from: `"Scholars Resort Guardian Portal" <${targetUser}>`,
            to: parentEmail.trim(),
            subject: `Academic Monitoring Invitation: Connect to ${sName} on Scholars Resort`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                <h1 style="color: #ea580c; margin: 0; font-size: 24px;">Scholars Resort Guardian Portal</h1>
                <p>Hello,</p>
                <p><strong>${sName}</strong> has invited you to monitor their JAMB UTME examination preparation, test scores, and attendance on Scholars Resort.</p>
                <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #64748b;">Connection Code:</p>
                  <span style="font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #ea580c;">${code}</span>
                </div>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${connectUrl}" style="background: #ea580c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Connect to Student</a>
                </div>
                <p style="font-size: 13px; color: #64748b;">Or visit <a href="${appOrigin}/guardian-connect">${appOrigin}/guardian-connect</a> and enter code: <strong>${code}</strong></p>
              </div>
            `
          });
          emailSent = true;
        }
      } catch (mailErr) {
        console.warn('Mail send failed:', mailErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: emailSent ? 'Invitation emailed to parent successfully.' : 'Invitation code generated.',
      code,
      connectUrl,
      emailSent
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
  }
}
