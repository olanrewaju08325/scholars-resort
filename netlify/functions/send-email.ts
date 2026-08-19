import nodemailer from 'nodemailer';

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { host, port, user, pass, fromEmail, testRecipient, to, subject, html } = JSON.parse(event.body || '{}');

    const smtpHost = host || process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort = Number(port || process.env.SMTP_PORT || 587);
    const smtpUser = user || process.env.SMTP_USER || 'admitwise2@gmail.com';
    const smtpPass = pass || process.env.SMTP_PASS || 'fliwopndlqxipara';
    const sender = fromEmail || process.env.SMTP_FROM || `Scholars Resort <${smtpUser}>`;
    const recipient = testRecipient || to || 'admitwise2@gmail.com';

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    const info = await transporter.sendMail({
      from: sender,
      to: recipient,
      subject: subject || 'Scholars Resort SMTP Test Verification',
      html: html || `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #4F46E5; border-radius: 8px;">
        <h2 style="color: #4F46E5;">Scholars Resort SMTP System Online</h2>
        <p>Your SMTP credentials configured for <strong>${smtpUser}</strong> (${smtpHost}:${smtpPort}) are working perfectly.</p>
        <p style="color: #6B7280; font-size: 12px;">Sent automatically by Scholars Resort Platform at ${new Date().toLocaleString()}</p>
      </div>`
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
        message: `Email dispatched successfully to ${recipient} via ${smtpHost}:${smtpPort}!`
      })
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: err.message || 'SMTP Connection Error'
      })
    };
  }
};
