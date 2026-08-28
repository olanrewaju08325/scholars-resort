import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { verifyAdmin, authSupabase } from './_auth';

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

  const auth = await verifyAdmin(req);
  if (!auth.authorized) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const startTime = Date.now();
  const { host, port, user, pass, fromEmail, testRecipient } = req.body || {};

  let targetPass = pass;
  // If pass is omitted or masked, lookup stored secret from env or db
  if (!targetPass || targetPass.includes('•')) {
    targetPass = process.env.SMTP_PASS || process.env.GMAIL_PASS;
    if (!targetPass) {
      try {
        const { data: sysData } = await authSupabase
          .from('system_configs')
          .select('config_value')
          .eq('config_key', 'smtp_settings')
          .maybeSingle();
        if (sysData?.config_value?.pass) {
          targetPass = sysData.config_value.pass;
        }
      } catch (_) {}
    }
  }

  const targetHost = host || process.env.SMTP_HOST || 'smtp.gmail.com';
  const targetPort = Number(port || process.env.SMTP_PORT || 587);
  const targetUser = user || process.env.SMTP_USER || process.env.GMAIL_USER || 'admitwise2@gmail.com';
  const targetFrom = fromEmail || process.env.SMTP_FROM || 'admitwise2@gmail.com';
  const recipient = testRecipient || targetUser || 'admitwise2@gmail.com';

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

    await transporter.verify();

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
    return res.status(200).json({
      success: true,
      latency,
      message: `SMTP Connection Verified! Live test email dispatched to ${recipient} (${latency}ms).`,
      messageId: info?.messageId
    });
  } catch (err: any) {
    const latency = Date.now() - startTime;
    return res.status(200).json({
      success: false,
      latency,
      message: `SMTP Connection Failed: ${err.message}`,
      error: err.message
    });
  }
}
