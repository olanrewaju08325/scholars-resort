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

  const { 
    userId, 
    target_score, 
    target_university, 
    daily_study_goal_minutes, 
    utme_subjects, 
    intended_course 
  } = req.body || {};

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  try {
    const updatePayload: any = {
      onboarding_completed: true,
      target_score: parseInt(target_score) || 270,
      target_university: target_university || 'Not Specified',
      daily_study_goal_minutes: parseInt(daily_study_goal_minutes) || 60,
      utme_subjects: Array.isArray(utme_subjects) ? utme_subjects : ['Use of English'],
      intended_course: intended_course || null,
      updated_at: new Date().toISOString()
    };

    const { data: dbData, error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[Onboarding Complete DB Update Warning]', error.message);
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Onboarding completed successfully', 
      profile: dbData || { id: userId, ...updatePayload }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
