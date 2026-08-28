import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyGuardian } from '../_auth';

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-guardian-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const auth = await verifyGuardian(req);
  if (!auth.authorized || !auth.user) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const queryGuardianId = (req.query.guardianId as string) || (req.headers['x-guardian-id'] as string);
  // Default to the authenticated guardian's user id
  const guardianId = queryGuardianId || auth.user.id;

  try {
    let studentIds: string[] = [];

    // 1. Try guardian_student_relationships table first
    try {
      const { data: rels, error: relErr } = await supabase
        .from('guardian_student_relationships')
        .select('*')
        .eq('guardian_id', guardianId)
        .eq('status', 'active');

      if (!relErr && rels && rels.length > 0) {
        studentIds = Array.from(new Set(rels.map((r: any) => r.student_id).filter(Boolean)));
      }
    } catch (_) {}

    // 2. Fallback to guardian_links table
    if (studentIds.length === 0) {
      try {
        const { data: links, error: linkErr } = await supabase
          .from('guardian_links')
          .select('*')
          .eq('guardian_id', guardianId)
          .eq('status', 'active');

        if (!linkErr && links && links.length > 0) {
          studentIds = Array.from(new Set(links.map((l: any) => l.student_id).filter(Boolean)));
        }
      } catch (_) {}
    }

    if (studentIds.length === 0) {
      return res.status(200).json({ success: true, students: [] });
    }

    // 3. Join profiles for linked students
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, has_paid, target_score, target_university, target_course, streak_days, xp, last_active, created_at')
      .in('id', studentIds);

    if (profErr) {
      return res.status(500).json({ success: false, error: profErr.message });
    }

    const profileMap: Record<string, any> = {};
    (profiles || []).forEach((p: any) => {
      profileMap[p.id] = p;
    });

    const formatted = studentIds.map((sId: string) => {
      const p = profileMap[sId] || {};
      return {
        id: sId,
        name: p.full_name || p.email || 'Student Ward',
        email: p.email || '',
        has_paid: !!p.has_paid,
        target_score: p.target_score || 320,
        target_university: p.target_university || '',
        target_course: p.target_course || '',
        xp: p.xp || 0,
        streak_days: p.streak_days || 0,
        last_active: p.last_active,
        status: 'active'
      };
    });

    return res.status(200).json({ success: true, students: formatted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error.' });
  }
}
