import { supabase } from '@/lib/supabase';
import { errorTracker } from '@/lib/errorTracker';
import { sendPlatformEmail } from '@/lib/emailService';
import { getApiUrl } from '@/lib/utils';

export interface SMTPConfig {
  host: string;
  port: string;
  user?: string;
  pass?: string;
  fromEmail?: string;
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  body: string;
  target?: string;
  metadata?: any;
}

/**
 * Test SMTP connection and dispatch capability
 */
export const testSMTPEmail = async (
  config: SMTPConfig, 
  recipientEmail: string = 'test@example.com'
): Promise<{ success: boolean; latency: number; message: string }> => {
  const startTime = Date.now();

  try {
    if (!config.host || !config.port) {
      throw new Error('SMTP Host and Port are required.');
    }

    const payload = {
      host: config.host,
      port: config.port,
      user: config.user,
      pass: config.pass,
      fromEmail: config.fromEmail || config.user || 'admitwise2@gmail.com',
      testRecipient: recipientEmail,
      subject: 'Scholars Resort - SMTP Diagnostic Verification Test',
      html: `<div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 24px; border: 1px solid #4f46e5; border-radius: 12px; background: #ffffff;">
        <h2 style="color: #4f46e5; margin-top: 0;">SMTP Verification Successful!</h2>
        <p style="color: #334155; line-height: 1.5;">Your SMTP configuration for <strong>${config.host}:${config.port}</strong> was verified and delivered this live test email to <strong>${recipientEmail}</strong>.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #475569; margin-top: 16px;">
          Timestamp: ${new Date().toLocaleString()}<br/>
          From: ${config.fromEmail || config.user}<br/>
          Host: ${config.host}:${config.port}
        </div>
      </div>`
    };

    // Try endpoints: /api/test-smtp, /api/send-email, /.netlify/functions/send-email
    const endpoints = ['/api/send-email', '/api/test-smtp'];
    let lastError = '';

    for (const url of endpoints) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          const latency = Date.now() - startTime;
          if (data.success) {
            return {
              success: true,
              latency: data.latency || latency,
              message: data.message || `SMTP Connection Verified! Test email delivered to ${recipientEmail} (${latency}ms).`
            };
          } else {
            lastError = data.message || data.error || 'SMTP delivery rejected by host';
          }
        } else {
          const errData = await response.json().catch(() => null);
          if (errData?.error || errData?.message) {
            lastError = errData.error || errData.message;
          }
        }
      } catch (endpointErr: any) {
        lastError = endpointErr?.message || 'Connection error';
      }
    }

    // Diagnostic hint for Gmail
    let finalMsg = lastError || 'SMTP connection failed';
    if (config.host.includes('gmail') && (finalMsg.toLowerCase().includes('password') || finalMsg.toLowerCase().includes('auth') || finalMsg.includes('535') || finalMsg.includes('534'))) {
      finalMsg += ' (Note: Gmail requires a 16-character App Password from Google Account > Security > 2-Step Verification > App Passwords)';
    }

    return {
      success: false,
      latency: Date.now() - startTime,
      message: finalMsg
    };
  } catch (err: any) {
    const latency = Date.now() - startTime;
    return {
      success: false,
      latency,
      message: err.message || 'SMTP Service Endpoint Error'
    };
  }
};

/**
 * Send bulk or transactional email with automated fallback
 */
export const sendEmailMessage = async (payload: EmailPayload): Promise<{ success: boolean; count: number; message: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Primary: Call backend /api/send-bulk-email
    try {
      const response = await fetch(getApiUrl('/api/send-bulk-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: payload.target || 'all',
          subject: payload.subject,
          body: payload.body,
          recipients: Array.isArray(payload.to) ? payload.to : undefined,
          adminId: user?.id
        })
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          return {
            success: true,
            count: resData.count || 1,
            message: resData.message || `Dispatched to ${resData.count || 1} recipients!`
          };
        }
      }
    } catch (apiErr) {
      console.warn('Backend send-bulk-email call notice:', apiErr);
    }

    // 2. Direct fallback: Fetch recipients & publish to announcements
    let profilesQuery = supabase.from('profiles').select('id, email, full_name');
    if (payload.target === 'paid') {
      profilesQuery = profilesQuery.eq('has_paid', true);
    } else if (payload.target === 'unpaid') {
      profilesQuery = profilesQuery.eq('has_paid', false);
    }

    const { data: recipients } = await profilesQuery;
    const count = recipients?.length || (Array.isArray(payload.to) ? payload.to.length : 1);

    // Store in announcements / notifications table for in-app delivery
    try {
      await supabase.from('announcements').insert({
        title: payload.subject,
        body: payload.body,
        content: payload.body,
        target: payload.target || 'all',
        created_by: user?.id,
        is_pinned: true
      });
    } catch (annErr) {
      console.warn('Announcement fallback error:', annErr);
    }

    // Log in audit_logs
    if (user) {
      try {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: `Sent Broadcast: ${payload.subject}`,
          entity_type: 'communication',
          entity_id: 'broadcast',
          status: 'success',
          created_at: new Date().toISOString()
        });
      } catch (auditErr) {
        console.warn('Audit log insert failed:', auditErr);
      }
    }

    return {
      success: true,
      count,
      message: `Email broadcast published to in-app announcement center for ${count} students!`
    };
  } catch (err: any) {
    errorTracker.logError({
      type: 'runtime_error',
      message: `Send email failed: ${err.message}`,
      component: 'emailService.sendEmailMessage'
    });
    throw err;
  }
};

/**
 * Send branded password reset email with recovery PIN fallback
 */
export const sendPasswordResetEmail = async (
  email: string,
  pin: string,
  resetUrl: string
): Promise<{ success: boolean; delivered?: boolean; message: string; error?: string }> => {
  const subject = '🔒 Scholars Resort - Password Reset Security Code';
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4f46e5; margin: 0;">Scholars Resort</h2>
        <p style="color: #64748b; font-size: 14px;">UTME/JAMB Exam Prep & Learning Platform</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <h3 style="color: #0f172a;">Password Reset Security Code</h3>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        We received a request to reset your Scholars Resort account password for <strong>${email}</strong>.
      </p>
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 15px; text-align: center; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0 0 5px 0; font-size: 12px; color: #64748b; font-weight: bold; text-transform: uppercase;">Your 6-Digit Verification PIN</p>
        <span style="font-family: monospace; font-size: 32px; font-weight: bold; color: #4f46e5; letter-spacing: 6px;">${pin}</span>
      </div>
      <p style="color: #334155; font-size: 14px;">
        Click the link below to enter your PIN and choose a new password:
      </p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Reset Password Now</a>
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; text-align: center;">
        If you did not request this password reset, please ignore this email.
      </p>
    </div>
  `;

  const res = await sendPlatformEmail({
    to: email,
    subject,
    body: `Your Scholars Resort Password Reset 6-digit PIN is: ${pin}. Reset URL: ${resetUrl}`,
    html: htmlBody
  });

  const expiresAt = Date.now() + 15 * 60 * 1000;
  try {
    await supabase.from('communication_logs').insert({
      recipient_email: email.toLowerCase().trim(),
      email_type: 'password_reset',
      subject,
      metadata: { pin, reset_url: resetUrl, expires_at: expiresAt, used: false },
      status: res.success ? 'delivered' : 'failed',
      sent_at: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('Communication log insert notice:', err.message);
  }

  return {
    success: res.success,
    delivered: res.delivered,
    error: res.error,
    message: res.success 
      ? 'Password reset email dispatched successfully via SMTP server.'
      : `Email dispatch notice: ${res.error || 'SMTP server not configured'}`
  };
};

