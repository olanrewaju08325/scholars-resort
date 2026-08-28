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

  const { guardianId, studentId, inviteCode } = req.body || {};
  if (!guardianId || (!studentId && !inviteCode)) {
    return res.status(400).json({ success: false, error: 'guardianId and (studentId or inviteCode) are required.' });
  }

  try {
    let resolvedStudentId = studentId;

    if (!resolvedStudentId && inviteCode) {
      const { data: matched } = await supabase
        .from('profiles')
        .select('id')
        .or(`invite_code.eq.${inviteCode.trim().toUpperCase()},id.eq.${inviteCode.trim()}`)
        .maybeSingle();

      if (matched) resolvedStudentId = matched.id;
    }

    if (!resolvedStudentId) {
      return res.status(404).json({ success: false, error: 'Student account not found with the provided code.' });
    }

    // Insert into relationships
    await Promise.allSettled([
      supabase.from('guardian_student_relationships').upsert({
        guardian_id: guardianId,
        student_id: resolvedStudentId,
        status: 'active',
        created_at: new Date().toISOString()
      }),
      supabase.from('guardian_links').upsert({
        guardian_id: guardianId,
        student_id: resolvedStudentId,
        status: 'active',
        created_at: new Date().toISOString()
      })
    ]);

    return res.status(200).json({ success: true, message: 'Student ward successfully linked to guardian.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
  }
}
