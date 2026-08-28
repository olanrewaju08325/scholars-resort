import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

  try {
    const { email, otp, newPassword } = req.body || {};
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();

    if (!cleanEmail || !cleanOtp) {
      return res.status(400).json({ success: false, error: 'Email and 6-digit verification OTP are required.' });
    }

    let isVerified = false;

    // Verify against communication_logs in Supabase
    try {
      const { data: logs } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('recipient_email', cleanEmail)
        .eq('email_type', 'password_reset')
        .order('created_at', { ascending: false })
        .limit(5);

      if (logs && logs.length > 0) {
        for (const log of logs) {
          const meta = log.metadata || {};
          if ((meta.pin === cleanOtp || meta.code === cleanOtp) && !meta.used) {
            const createdAt = new Date(log.created_at).getTime();
            if (Date.now() - createdAt <= 20 * 60 * 1000) {
              isVerified = true;
              await supabase.from('communication_logs').update({
                metadata: { ...meta, used: true }
              }).eq('id', log.id);
              break;
            }
          }
        }
      }
    } catch (_) {}

    if (!isVerified) {
      return res.status(400).json({ success: false, error: 'Invalid or expired 6-digit OTP code.' });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully. Your password can now be updated.'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
  }
}
