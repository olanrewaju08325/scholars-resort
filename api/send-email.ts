import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { getAuthenticatedUser, authSupabase } from './_auth';

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

  // Security Hardening: Enforce user authentication
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Authentication required to dispatch emails.' });
  }

  const startTime = Date.now();
  
  // Extract custom SMTP config and payload
  const { host, port, user: smtpUserParam, pass, fromEmail, to, subject, html, text } = req.body || {};
  
  let targetPass = pass;
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
  const targetUser = smtpUserParam || process.env.SMTP_USER || process.env.GMAIL_USER || 'admitwise2@gmail.com';
  const targetFrom = fromEmail || process.env.SMTP_FROM || 'admitwise2@gmail.com';
  const recipient = to;

  if (!targetHost || !recipient) {
    return res.status(400).json({
      success: false,
      message: 'SMTP Host and Recipient (to) are required.'
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

    const info = await transporter.sendMail({
      from: targetFrom,
      to: recipient,
      subject: subject || 'Scholars Resort Notification',
      text: text || 'This is a message from Scholars Resort.',
      html: html || undefined
    });

    const latency = Date.now() - startTime;
    return res.status(200).json({
      success: true,
      latency,
      message: `Email dispatched to ${recipient} (${latency}ms).`,
      messageId: info.messageId
    });

  } catch (err: any) {
    const latency = Date.now() - startTime;
    return res.status(200).json({
      success: false,
      latency,
      message: `SMTP Delivery Failed: ${err.message}`,
      error: err.message
    });
  }
}
