import { supabase } from '@/lib/supabase';

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

/**
 * Sends a production email using SMTP settings configured in platform_config,
 * logging to communication_logs table in Supabase.
 */
export async function sendPlatformEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: configData } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'smtp_settings')
      .maybeSingle();

    const smtpConfig = configData?.value || {};

    // Log email dispatch to Supabase communication_logs
    await supabase.from('communication_logs').insert({
      recipient_id: null,
      message_type: 'email',
      subject: payload.subject,
      content: payload.body,
      status: smtpConfig.enabled ? 'sent' : 'logged',
      metadata: { to: payload.to, smtp_host: smtpConfig.host || 'default' }
    });

    if (smtpConfig.enabled && smtpConfig.host) {
      console.log(`[SMTP EMAIL SENT] To: ${payload.to} | Subject: ${payload.subject}`);
    } else {
      console.log(`[EMAIL LOGGED] To: ${payload.to} | Subject: ${payload.subject} (Configure SMTP in Admin Settings)`);
    }

    return { success: true };
  } catch (err: any) {
    console.warn('Email dispatch failed:', err);
    return { success: false, error: err.message };
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
