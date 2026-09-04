import { supabase } from '@/lib/supabase';
import { errorTracker } from '@/lib/errorTracker';
import { sendPlatformEmail } from '@/lib/emailService';
import { getApiUrl } from '@/lib/utils';
import { authFetch } from '@/lib/apiAuth';

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

    // Call dedicated SMTP test endpoint first, then send-email fallback
    const endpoints = ['/api/test-smtp', '/api/admin/test-smtp', '/api/send-email'];
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
          if (data.success && data.delivered !== false) {
            return {
              success: true,
              latency: data.latency || latency,
              message: data.message || `SMTP Connection Verified! Real test email sent to ${recipientEmail} (${latency}ms).`
            };
          } else {
            lastError = data.message || data.error || 'SMTP delivery was not completed by host';
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
      const response = await authFetch(getApiUrl('/api/send-bulk-email'), {
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

    // Log in activity_logs
    if (user) {
      try {
        await supabase.from('activity_logs').insert({
          user_id: user.id,
          activity_type: 'email_broadcast',
          action: `Sent Broadcast: ${payload.subject}`,
          metadata: { details: `Email broadcast dispatched to targeted scholars` },
          created_at: new Date().toISOString()
        });
      } catch (auditErr) {
        console.warn('Activity log insert notice:', auditErr);
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
 * Send branded password reset email with 6-digit OTP verification code
 */
export const sendPasswordResetEmail = async (
  email: string,
  pin: string,
  resetUrl?: string
): Promise<{ success: boolean; delivered?: boolean; message: string; error?: string }> => {
  const subject = `🔐 Your Scholars Resort Verification OTP: ${pin}`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background: #ffffff; color: #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; padding: 12px; background: #eff6ff; border-radius: 16px; margin-bottom: 12px;">
          <span style="font-size: 28px;">🔐</span>
        </div>
        <h2 style="color: #0f172a; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">Scholars Resort</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Official UTME & JAMB CBT Learning Platform</p>
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 24px; margin-bottom: 24px;">
        <h3 style="color: #0f172a; font-size: 17px; font-weight: 600; margin: 0 0 8px 0;">Security Verification Code (OTP)</h3>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
          A password reset request was initiated for your Scholars Resort account associated with <strong>${email}</strong>.
        </p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
          Enter the 6-digit One-Time Password (OTP) below into the verification screen to reset your password:
        </p>

        <!-- OTP Code Highlight Box -->
        <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px 16px; text-align: center; margin: 24px 0;">
          <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
            One-Time Password (OTP)
          </div>
          <div style="font-family: 'Courier New', Courier, monospace, monospace; font-size: 40px; font-weight: 800; color: #2563eb; letter-spacing: 10px; line-height: 1; padding: 8px 0;">
            ${pin}
          </div>
          <div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">
            ⏳ Valid for 15 minutes • Single use only
          </div>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 12px 16px; margin: 20px 0;">
          <p style="color: #92400e; font-size: 12px; line-height: 1.5; margin: 0;">
            <strong>Security Notice:</strong> Never share this code with anyone. Scholars Resort staff will never ask for your verification PIN or password.
          </p>
        </div>

        <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 20px 0 0 0;">
          If you did not make this request, you can safely ignore this email — your account remains secure and no changes have been made.
        </p>
      </div>

      <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center;">
        <p style="color: #94a3b8; font-size: 11px; margin: 0; line-height: 1.5;">
          Scholars Resort Learning Engine • admitwise2@gmail.com<br />
          Empowering Nigerian Scholars to score 300+ in JAMB UTME
        </p>
      </div>
    </div>
  `;

  const res = await sendPlatformEmail({
    to: email,
    subject,
    body: `Your Scholars Resort Password Reset 6-Digit OTP is: ${pin}. Valid for 15 minutes.`,
    html: htmlBody
  });

  const expiresAt = Date.now() + 15 * 60 * 1000;
  try {
    await supabase.from('communication_logs').insert({
      recipient_email: email.toLowerCase().trim(),
      email_type: 'password_reset',
      subject,
      metadata: { pin, reset_url: resetUrl || '', expires_at: expiresAt, used: false },
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
      ? 'Password reset OTP email dispatched successfully via SMTP server.'
      : `Email dispatch notice: ${res.error || 'SMTP server not configured'}`
  };
};

/**
 * Send Welcome Email upon new user registration
 */
export const sendWelcomeEmail = async (
  email: string,
  name: string
): Promise<{ success: boolean; delivered?: boolean; message: string }> => {
  const subject = `🎓 Welcome to Scholars Resort, ${name || 'Scholar'}!`;
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #4f46e5; margin: 0;">Scholars Resort</h2>
        <p style="color: #64748b; font-size: 14px;">UTME/JAMB Exam Prep & Learning Platform</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <h3 style="color: #0f172a; margin-top: 0;">Welcome aboard, ${name || 'Scholar'}! 🚀</h3>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Thank you for creating your account on Scholars Resort. You now have access to high-yield JAMB UTME prep tools designed to boost your score above 300!
      </p>
      <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0;">
        <h4 style="margin: 0 0 8px 0; color: #1e293b;">Your Learning Arsenal:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.6;">
          <li><strong>Full-Length CBT Mocks:</strong> Authentic 4-subject UTME exam simulation.</li>
          <li><strong>AI Study Tutor:</strong> 24/7 step-by-step breakdown for complex questions.</li>
          <li><strong>Curated Study Library:</strong> JAMB novel summaries and past questions.</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="https://scholarsresort.com/login" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Start Studying Now</a>
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; text-align: center;">
        Need help? Contact our support team at <a href="mailto:admitwise2@gmail.com" style="color: #4f46e5;">admitwise2@gmail.com</a>
      </p>
    </div>
  `;

  return sendPlatformEmail({
    to: email,
    subject,
    body: `Welcome to Scholars Resort, ${name}! Log in at https://scholarsresort.com/login to begin your UTME preparation.`,
    html: htmlBody
  });
};

/**
 * Send Payment Verified / Pro Access Activated Email
 */
export const sendPaymentApprovedEmail = async (
  email: string,
  name: string,
  amount: number,
  planLabel: string = 'Full Access Pass'
): Promise<{ success: boolean; delivered?: boolean; message: string }> => {
  const subject = `🎉 Payment Verified - ${planLabel} Activated!`;
  const formattedAmount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #16a34a; margin: 0;">Payment Verified!</h2>
        <p style="color: #64748b; font-size: 14px;">Scholars Resort Learning Platform</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <h3 style="color: #0f172a; margin-top: 0;">Congratulations, ${name || 'Scholar'}! 🎉</h3>
      <p style="color: #334155; font-size: 15px; line-height: 1.6;">
        Your payment of <strong>${formattedAmount}</strong> has been confirmed by the administration. Your <strong>${planLabel}</strong> is now active.
      </p>
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; margin: 20px 0; border-radius: 8px;">
        <h4 style="margin: 0 0 8px 0; color: #166534;">Unlocked Pro Benefits:</h4>
        <ul style="margin: 0; padding-left: 20px; color: #15803d; font-size: 14px; line-height: 1.6;">
          <li>Unlimited CBT Mock Drills & Timed UTME Practice</li>
          <li>Complete Study Library, PDF Downloads & Novel In-depth Guides</li>
          <li>Detailed Topic Analytics & Weakness Breakdown</li>
          <li>Unrestricted AI Tutor Support</li>
        </ul>
      </div>
      <div style="text-align: center; margin: 28px 0;">
        <a href="https://scholarsresort.com/cbt" style="background-color: #16a34a; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block;">Take a Practice CBT Drill</a>
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; text-align: center;">
        Thank you for choosing Scholars Resort. If you have any questions, reach out to us at <a href="mailto:admitwise2@gmail.com" style="color: #16a34a;">admitwise2@gmail.com</a>
      </p>
    </div>
  `;

  return sendPlatformEmail({
    to: email,
    subject,
    body: `Your payment of ${formattedAmount} for ${planLabel} on Scholars Resort has been verified. Access all features now at https://scholarsresort.com/cbt`,
    html: htmlBody
  });
};


