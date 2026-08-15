import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6.9.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const brandedEmail = (title: string, body: string, preheader = '') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:16px;border:1px solid #1e293b;overflow:hidden;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e1b4b 0%,#0f172a 100%);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">
                ✦ Scholars Resort
              </h1>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:13px;">Nigeria's #1 JAMB Preparation Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background:#0d1117;border-top:1px solid #1e293b;text-align:center;">
              <p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} Scholars Resort. All rights reserved.</p>
              <p style="margin:6px 0 0;color:#334155;font-size:11px;">You received this email because you have an account on Scholars Resort.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const h2 = (text: string) => `<h2 style="margin:0 0 16px;color:#f1f5f9;font-size:22px;font-weight:700;">${text}</h2>`;
const p = (text: string) => `<p style="margin:0 0 16px;color:#94a3b8;font-size:15px;line-height:1.6;">${text}</p>`;
const _badge = (text: string, color = '#6366f1') => `<span style="display:inline-block;background:${color}22;color:${color};border:1px solid ${color}44;border-radius:6px;padding:4px 12px;font-size:13px;font-weight:600;">${text}</span>`;
const cta = (text: string, url: string) => `
  <div style="text-align:center;margin:24px 0;">
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;letter-spacing:0.3px;">${text}</a>
  </div>
`;
const statRow = (label: string, value: string, color = '#6366f1') => `
  <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1e293b;">
    <span style="color:#64748b;font-size:14px;">${label}</span>
    <span style="color:${color};font-weight:700;font-size:14px;">${value}</span>
  </div>
`;

// ── Main Handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, templateName, payload } = await req.json()
    
    const smtpUser = Deno.env.get('SMTP_USERNAME') || Deno.env.get('SMTP_USER') || 'admitwise2@gmail.com';
    const smtpPass = Deno.env.get('SMTP_PASSWORD') || Deno.env.get('SMTP_PASS') || 'fliwopndlqxipara';
    const smtpHost = Deno.env.get('SMTP_HOSTNAME') || Deno.env.get('SMTP_HOST') || '';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const fromEmail = Deno.env.get('FROM_EMAIL') || smtpUser;

    if (!smtpUser || !smtpPass) {
      throw new Error("SMTP credentials are not configured in edge secrets.");
    }

    let transporter;
    if (smtpHost) {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass }
      });
    } else {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: smtpUser, pass: smtpPass }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    let subject = "Update from Scholars Resort";
    let htmlContent = "<p>Hello</p>";
    const appUrl = Deno.env.get('SITE_URL') || 'https://scholarsresort.com';

    switch (templateName) {

      case 'welcome':
        subject = `Welcome to Scholars Resort, ${payload.name || 'Scholar'}! 🎓`;
        htmlContent = brandedEmail(
          'Welcome!',
          `
          ${h2(`Welcome, ${payload.name || 'Scholar'}! 🎉`)}
          ${p("You've just joined Nigeria's most powerful JAMB preparation platform. Your journey to JAMB success starts now.")}
          ${p("Here's what's waiting for you:")}
          <ul style="color:#94a3b8;font-size:14px;line-height:2;padding-left:20px;">
            <li>🤖 AI-powered study recommendations</li>
            <li>📝 1000+ JAMB-style practice questions</li>
            <li>🏆 Live tournaments & leaderboards</li>
            <li>📊 Real-time performance analytics</li>
            <li>👨‍👩‍👧 Guardian progress reporting</li>
          </ul>
          ${cta('Start Studying Now →', `${appUrl}/dashboard`)}
          `,
          `Welcome to Scholars Resort! Your JAMB success journey begins today.`
        );
        break;

      case 'otp':
        subject = "Scholars Resort Admin Login Code";
        htmlContent = brandedEmail(
          'Admin OTP',
          `
          ${h2('Your Admin Login Code')}
          ${p('Use the one-time code below to access the admin portal. This code expires in 10 minutes.')}
          <div style="text-align:center;margin:32px 0;">
            <div style="display:inline-block;background:#1e1b4b;border:2px solid #4f46e5;border-radius:12px;padding:20px 48px;">
              <span style="color:#818cf8;font-size:42px;font-weight:900;letter-spacing:10px;font-family:monospace;">${payload.otp}</span>
            </div>
          </div>
          ${p('<strong style="color:#f87171;">⚠️ Do not share this code with anyone.</strong> Our team will never ask for your OTP.')}
          `
        );
        break;

      case 'guardian_linked':
        subject = `You've been connected to ${payload.studentName}'s account`;
        htmlContent = brandedEmail(
          'Guardian Connected',
          `
          ${h2('You are now a Guardian 👨‍👩‍👧')}
          ${p(`You have been successfully linked as a guardian for <strong style="color:#f1f5f9;">${payload.studentName}</strong> on Scholars Resort.`)}
          ${p("You can now monitor their study activity, exam performance, streaks, and receive weekly progress reports.")}
          ${cta('Open Guardian Portal →', `${appUrl}/guardian`)}
          `
        );
        break;

      case 'payment_notification':
        subject = `⚡ New Payment Awaiting Approval — ${payload.userId}`;
        htmlContent = brandedEmail(
          'New Payment',
          `
          ${h2('New Payment Submission')}
          ${p('A student has submitted a payment receipt that requires your approval.')}
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin:20px 0;">
            ${statRow('User ID', payload.userId || 'N/A')}
            ${statRow('Amount', `₦${payload.amount || 'N/A'}`, '#22c55e')}
            ${statRow('Plan', payload.planId || 'Premium', '#6366f1')}
            ${statRow('Submitted', new Date().toLocaleString(), '#94a3b8')}
          </div>
          ${cta('Review Payment in Admin Portal →', `${appUrl}/scholarresortadmin@benedict`)}
          `
        );
        break;

      case 'payment_approved':
        subject = "🎉 Your Scholars Resort Premium Access is Activated!";
        htmlContent = brandedEmail(
          'Premium Activated',
          `
          ${h2('You Are Now Premium! 🚀')}
          ${p("Congratulations! Your payment has been approved and your premium subscription is now active.")}
          ${p("You now have full, unrestricted access to:")}
          <ul style="color:#94a3b8;font-size:14px;line-height:2;padding-left:20px;">
            <li>✅ All practice modes & mock exams</li>
            <li>✅ AI explanations & flashcard generator</li>
            <li>✅ Tournament Arena</li>
            <li>✅ Performance analytics & weak area drill</li>
            <li>✅ Guardian progress sharing</li>
          </ul>
          ${cta('Access Your Dashboard →', `${appUrl}/dashboard`)}
          `
        );
        break;

      case 'payment_rejected':
        subject = "Payment Verification Update — Action Required";
        htmlContent = brandedEmail(
          'Payment Update',
          `
          ${h2('Payment Could Not Be Verified')}
          ${p('We were unable to verify your recent payment submission. This may be due to an unclear or invalid receipt.')}
          ${p('Please re-upload a clear receipt or contact our support team for assistance.')}
          ${cta('Contact Support →', `${appUrl}/support`)}
          `
        );
        break;

      case 'badge_earned':
        subject = `🏅 You earned the "${payload.badgeName}" badge!`;
        htmlContent = brandedEmail(
          'Badge Earned',
          `
          ${h2(`Congratulations, ${payload.name || 'Scholar'}! 🏅`)}
          ${p(`You just earned a new achievement badge on Scholars Resort:`)}
          <div style="text-align:center;margin:28px 0;">
            <div style="display:inline-block;background:linear-gradient(135deg,#854d0e,#ca8a04);border-radius:16px;padding:24px 40px;">
              <div style="font-size:48px;margin-bottom:8px;">${payload.badgeIcon || '🏅'}</div>
              <div style="color:#fef9c3;font-size:18px;font-weight:800;">${payload.badgeName}</div>
              <div style="color:#fde68a;font-size:13px;margin-top:4px;">${payload.badgeDescription || ''}</div>
            </div>
          </div>
          ${p("Keep up the great work! Visit your dashboard to see all your achievements.")}
          ${cta('View My Achievements →', `${appUrl}/dashboard`)}
          `
        );
        break;

      case 'tournament_starting':
        subject = `⚔️ Tournament Starting Soon: ${payload.tournamentTitle}`;
        htmlContent = brandedEmail(
          'Tournament Alert',
          `
          ${h2(`Tournament Alert! ⚔️`)}
          ${p(`The tournament you registered for is starting soon!`)}
          <div style="background:#0f172a;border:1px solid #f97316;border-radius:12px;padding:20px;margin:20px 0;">
            ${statRow('Tournament', payload.tournamentTitle || 'N/A', '#f97316')}
            ${statRow('Start Time', payload.startTime || 'Soon', '#94a3b8')}
            ${statRow('Duration', `${payload.duration || 60} minutes`, '#94a3b8')}
            ${statRow('Prize', payload.prize || 'Special Badge', '#fbbf24')}
          </div>
          ${p('Make sure you have a stable internet connection before entering.')}
          ${cta('Enter Tournament Arena →', `${appUrl}/tournaments`)}
          `
        );
        break;

      case 'report_card':
        subject = `📊 Weekly Progress Report: ${payload.studentName}`;
        htmlContent = brandedEmail(
          'Weekly Report',
          `
          ${h2(`Weekly Report for ${payload.studentName}`)}
          ${p(`Dear ${payload.guardianName || 'Guardian'}, here is a summary of this week's study activity:`)}
          <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin:20px 0;">
            ${statRow('Exams Completed', String(payload.totalExams || 0), '#6366f1')}
            ${statRow('Average Score', `${payload.avgScore || 0}%`, payload.avgScore >= 60 ? '#22c55e' : '#f87171')}
            ${statRow('Study Streak', `${payload.streak || 0} days 🔥`, '#f97316')}
            ${statRow('Total Study Time', `${payload.totalHours || 0} hours`, '#94a3b8')}
          </div>
          ${cta('View Full Report →', `${appUrl}/guardian`)}
          `
        );
        break;

      default:
        subject = payload.subject || subject;
        htmlContent = brandedEmail(
          payload.subject || 'Update',
          payload.html || `<p style="color:#94a3b8;">You have a new message from Scholars Resort.</p>`
        );
    }

    const info = await transporter.sendMail({
      from: `"Scholars Resort" <${fromEmail || smtpUser}>`,
      to: to,
      subject: subject,
      html: htmlContent
    });

    await supabase.from('communication_logs').insert({
      recipient_email: Array.isArray(to) ? to.join(',') : to,
      email_type: templateName,
      subject: subject,
      status: 'delivered',
      sent_at: new Date().toISOString()
    });

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error("SMTP Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
