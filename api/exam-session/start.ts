import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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

  const { userId, sessionId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required.' });
  }

  const sId = sessionId || crypto.randomUUID();
  try {
    const payload = {
      id: sId,
      user_id: userId,
      status: 'in_progress',
      is_ai_tutor_locked: true,
      started_at: new Date().toISOString()
    };

    await supabase
      .from('exam_sessions')
      .upsert(payload);

    return res.status(200).json({
      success: true,
      sessionId: sId,
      is_ai_tutor_locked: true,
      status: 'in_progress'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
