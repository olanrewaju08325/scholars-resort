import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { userId, userEmail, userName, amount, proofUrl, planId } = req.body || {};

  try {
    const targetHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const targetPort = Number(process.env.SMTP_PORT || 587);
    const targetUser = process.env.SMTP_USER || process.env.GMAIL_USER || 'admitwise2@gmail.com';
    const targetPass = process.env.SMTP_PASS || process.env.GMAIL_PASS || '';
    const senderEmail = process.env.SMTP_FROM || targetUser;

    const isSecure = targetPort === 465;
    const transporter = nodemailer.createTransport({
      host: targetHost,
      port: targetPort,
      secure: isSecure,
      auth: targetUser && targetPass ? { user: targetUser, pass: targetPass } : undefined,
      tls: { rejectUnauthorized: false }
    });

    const recipientAdmins = ['admitwise2@gmail.com', 'olanrewajuhamilot@gmail.com'];

    // 1. Send Admin Notification Email
    try {
      await transporter.sendMail({
        from: `"Scholars Resort System" <${senderEmail}>`,
        to: recipientAdmins,
        subject: `New Manual Payment Upload - ₦${amount}`,
        html: `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px;">
                 <h2 style="color: #4F46E5; margin-top: 0;">New Payment Receipt Uploaded</h2>
                 <p><strong>Student Name:</strong> ${userName || 'Student'}</p>
                 <p><strong>Email:</strong> ${userEmail || 'N/A'}</p>
                 <p><strong>User ID:</strong> ${userId}</p>
                 <p><strong>Amount:</strong> ₦${amount}</p>
                 <p><strong>Plan:</strong> ${planId || 'Lifetime Access'}</p>
                 <p style="margin-top: 20px;">
                   <a href="${proofUrl}" target="_blank" style="background: #4F46E5; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View Payment Receipt</a>
                 </p>
               </div>`
      });
    } catch (adminMailErr) {
      console.warn('Admin mail dispatch notice:', adminMailErr);
    }

    // 2. Send Confirmation Email to Student
    if (userEmail) {
      try {
        await transporter.sendMail({
          from: `"Scholars Resort" <${senderEmail}>`,
          to: userEmail,
          subject: 'Payment Receipt Received - Scholars Resort Access',
          html: `<div style="font-family: sans-serif; padding: 20px; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px;">
                   <h2 style="color: #4F46E5; margin-top: 0;">Payment Upload Confirmation</h2>
                   <p>Dear ${userName || 'Scholar'},</p>
                   <p>We have received your proof of payment (<strong>₦${amount}</strong>) for <strong>Scholars Resort Full Access</strong>.</p>
                   <p>Our verification team is reviewing your transaction receipt. Your account access will be activated within 24 hours.</p>
                   <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
                     <p style="margin: 0; font-size: 13px; color: #475569;">
                       <strong>Amount Paid:</strong> ₦${amount}<br/>
                       <strong>Status:</strong> Pending Admin Review<br/>
                       <strong>Date:</strong> ${new Date().toLocaleString()}
                     </p>
                   </div>
                   <p>Thank you for choosing Scholars Resort!</p>
                   <br/>
                   <p>Best regards,<br/><strong>Scholars Resort Team</strong></p>
                 </div>`
        });
      } catch (studentMailErr) {
        console.warn('Student mail dispatch notice:', studentMailErr);
      }
    }

    return res.status(200).json({ success: true, message: 'Payment notification dispatched successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to dispatch payment notification.' });
  }
}
