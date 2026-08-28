import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyAdmin } from '../../_auth';

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-email');

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

  const { user_id } = req.body || {};
  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id is required.' });
  }

  try {
    await Promise.allSettled([
      supabase.from('guardian_links').delete().or(`guardian_id.eq.${user_id},student_id.eq.${user_id}`),
      supabase.from('guardian_student_relationships').delete().or(`guardian_id.eq.${user_id},student_id.eq.${user_id}`),
      supabase.from('exam_sessions').delete().eq('user_id', user_id),
      supabase.from('manual_payments').delete().eq('user_id', user_id),
      supabase.from('device_sessions').delete().eq('user_id', user_id),
      supabase.from('session_answers').delete().eq('user_id', user_id),
      supabase.from('support_tickets').delete().eq('user_id', user_id),
      supabase.from('study_streaks').delete().eq('user_id', user_id),
      supabase.from('profiles').delete().eq('id', user_id)
    ]);

    try {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceRoleKey) {
        const adminAuthClient = createClient(supabaseUrl, serviceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        await adminAuthClient.auth.admin.deleteUser(user_id);
      }
    } catch (authErr) {
      console.warn('[Admin User Auth Delete Warning]', authErr);
    }

    return res.status(200).json({ success: true, message: 'User and all associated records deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
