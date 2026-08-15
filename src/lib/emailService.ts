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

    const resData = await response.json();

    // Log email dispatch to Supabase communication_logs
    try {
      await supabase.from('communication_logs').insert({
        recipient_id: null,
        recipient_email: payload.to,
        message_type: 'email',
        subject: payload.subject,
        content: payload.body,
        status: resData.success ? 'delivered' : 'failed',
        metadata: { to: payload.to, error: resData.error || null, messageId: resData.messageId || null }
      });
    } catch (dbErr) {
      console.warn('Logging email dispatch notice:', dbErr);
    }

    if (resData.success) {
      console.log(`[REAL SMTP DISPATCH] To: ${payload.to} | Subject: ${payload.subject}`);
      return { success: true, delivered: true };
    } else {
      console.warn(`[SMTP DISPATCH FAILED] To: ${payload.to} | Error: ${resData.error}`);
      return { success: false, delivered: false, error: resData.error };
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
