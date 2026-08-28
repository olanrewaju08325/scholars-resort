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

  const { title, description, subject_id, topic_id, file_path, is_premium } = req.body;
  if (!title || !file_path) {
    return res.status(400).json({ success: false, error: 'Missing required title or file path' });
  }

  try {
    const results: string[] = [];

    // 1. Insert into materials table
    const newMaterialId = `mat_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const { error: matError } = await supabase.from('materials').insert({
      id: newMaterialId,
      title,
      description: description || '',
      subject_id: subject_id || null,
      file_path,
      file_size_bytes: 1024 * 1024 * 2,
      visibility: true,
      is_premium: !!is_premium
    });
    if (!matError) results.push('materials_inserted');
    else console.warn('Server materials insert warn:', matError.message);

    // 2. Insert into library_materials table
    const { error: libError } = await supabase.from('library_materials').insert({
      title,
      description: description || '',
      subject_id: subject_id || null,
      file_url: file_path,
      is_premium: !!is_premium,
      is_active: true
    });
    if (!libError) results.push('library_materials_inserted');
    else console.warn('Server library_materials insert warn:', libError.message);

    // 3. Update subjects table with study_material_url if requested and no topic is specified
    if (subject_id && !topic_id) {
      const { error: subError } = await supabase
        .from('subjects')
        .update({ study_material_url: file_path })
        .eq('id', subject_id);
      if (!subError) results.push('subject_url_updated');
      else console.warn('Server subject update warn:', subError.message);
    }

    // 4. Update topics table with study_material_url if topic_id is specified
    if (topic_id) {
      const { error: topError } = await supabase
        .from('topics')
        .update({ study_material_url: file_path })
        .eq('id', topic_id);
      if (!topError) results.push('topic_url_updated');
      else console.warn('Server topic update warn:', topError.message);
    }

    return res.status(200).json({
      success: true,
      results
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to link upload metadata' });
  }
}
