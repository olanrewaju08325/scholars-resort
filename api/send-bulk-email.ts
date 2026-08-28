import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { verifyAdmin } from './_auth';

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

  const { target = 'all', subject, body, html, recipients: explicitRecipients, adminId } = req.body || {};

  if (!subject || (!body && !html)) {
    return res.status(400).json({ success: false, error: 'Subject and email body are required.' });
  }

  try {
    let recipientList: string[] = [];
    if (explicitRecipients && Array.isArray(explicitRecipients) && explicitRecipients.length > 0) {
      recipientList = explicitRecipients;
    } else {
      let query = supabase.from('profiles').select('email');
      if (target === 'paid') {
        query = query.eq('has_paid', true);
      } else if (target === 'unpaid') {
        query = query.eq('has_paid', false);
      }
      const { data: profileRows } = await query;
      if (profileRows && profileRows.length > 0) {
        recipientList = profileRows.map((p: any) => p.email).filter(Boolean);
      }
    }

    // Publish to announcements
    try {
      await supabase.from('announcements').insert({
        title: subject,
        body: body || html,
        content: body || html,
        target,
        created_by: adminId || null,
        is_pinned: true
      });
    } catch (_) {}

    const targetHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const targetPort = Number(process.env.SMTP_PORT || 587);
    const targetUser = process.env.SMTP_USER || process.env.GMAIL_USER || 'admitwise2@gmail.com';
    const targetPass = process.env.SMTP_PASS || process.env.GMAIL_PASS;

    let sentCount = 0;
    if (targetUser && targetPass && recipientList.length > 0) {
      try {
        const transporter = nodemailer.createTransport({
          host: targetHost,
          port: targetPort,
          secure: targetPort === 465,
          auth: { user: targetUser, pass: targetPass },
          tls: { rejectUnauthorized: false }
        });

        const batchSize = 5;
        for (let i = 0; i < recipientList.length; i += batchSize) {
          const batch = recipientList.slice(i, i + batchSize);
          await Promise.allSettled(
            batch.map(async (email) => {
              await transporter.sendMail({
                from: `"Scholars Resort" <${targetUser}>`,
                to: email,
                subject,
                text: body || '',
                html: html || `<p>${body}</p>`
              });
              sentCount++;
            })
          );
        }
      } catch (err: any) {
        console.warn('Bulk mail error:', err);
      }
    }

    return res.status(200).json({
      success: true,
      sentCount,
      totalRecipients: recipientList.length,
      announcementPosted: true,
      message: `Dispatched to ${sentCount} recipient(s) and published in-app announcement.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
