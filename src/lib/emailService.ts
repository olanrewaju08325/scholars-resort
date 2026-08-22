import { supabase } from '@/lib/supabase';

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

/**
 * Sends a production email using SMTP via backend /api/send-email endpoint,
 * logging to communication_logs table in Supabase.
 */
export async function sendPlatformEmail(payload: EmailPayload): Promise<{ success: boolean; delivered?: boolean; error?: string }> {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
        html: payload.html || payload.body
      })
    });

    const text = await response.text();
    let resData: any = {};
    try {
      resData = JSON.parse(text);
    } catch {
      resData = { success: false, error: text || `Server error (${response.status})` };
    }

    // Log email dispatch to Supabase communication_logs (with column error fallback)
    try {
      await supabase.from('communication_logs').insert({
        recipient_email: payload.to,
        subject: payload.subject,
        body: payload.body,
        status: resData.success ? 'sent' : 'failed',
        created_at: new Date().toISOString()
      }).catch(async () => {
        // Fallback schema table insert
        await supabase.from('communication_logs').insert({
          recipient: payload.to,
          subject: payload.subject,
          status: 'sent',
          created_at: new Date().toISOString()
        }).catch(() => {});
      });
    } catch (dbErr) {
      console.warn('Logging email dispatch notice:', dbErr);
    }

    if (response.ok && resData.success) {
      console.log(`[REAL SMTP DISPATCH] To: ${payload.to} | Subject: ${payload.subject}`);
      return { success: true, delivered: true };
    } else {
      console.warn(`[SMTP DISPATCH FAILED] To: ${payload.to} | Error: ${resData.error || resData.message}`);
      return { success: false, delivered: false, error: resData.error || resData.message || 'SMTP dispatch failed' };
    }
  } catch (err: any) {
    console.warn('Email dispatch network error:', err);
    return { success: false, delivered: false, error: err.message || 'Network error' };
  }
}

/**
 * Convenience helper to send sign-in / welcome email on user login
 */
export async function sendWelcomeSignInEmail(email: string, fullName: string = 'Scholar') {
  return await sendPlatformEmail({
    to: email,
    subject: 'Welcome & Successful Sign-In - Scholars Resort CBT Platform',
    body: `Hello ${fullName},\n\nYou have successfully logged into Scholars Resort CBT Platform.\nTime: ${new Date().toLocaleString()}\n\nBest of luck with your UTME/WAEC exam prep!`
  });
}
