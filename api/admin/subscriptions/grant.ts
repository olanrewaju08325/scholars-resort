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

  const { user_id, plan_name = 'Lifetime Access (Gifted)', duration_years = 100 } = req.body || {};
  if (!user_id) {
    return res.status(400).json({ success: false, error: 'user_id is required' });
  }

  try {
    const { error: profError } = await supabase
      .from('profiles')
      .update({ has_paid: true, updated_at: new Date().toISOString() })
      .eq('id', user_id);

    if (profError) {
      console.warn('[Server Grant Access] Profile update warning:', profError.message);
    }

    const expiresAt = new Date(Date.now() + duration_years * 365 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await supabase.from('subscriptions').insert({
        user_id,
        plan_name,
        status: 'active',
        expires_at: expiresAt
      });
    } catch (_) {}

    return res.status(200).json({
      success: true,
      message: 'Premium subscription granted successfully.',
      user_id,
      has_paid: true
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
