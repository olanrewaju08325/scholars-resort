import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const startTime = Date.now();
  
  // Extract custom SMTP config and payload
  const { host, port, user, pass, fromEmail, to, subject, html, text } = req.body || {};
  
  // Fallback to environment variables
  const targetHost = host || process.env.SMTP_HOST;
  const targetPort = Number(port || process.env.SMTP_PORT || 587);
  const targetUser = user || process.env.SMTP_USER;
  const targetPass = pass || process.env.SMTP_PASS;
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
