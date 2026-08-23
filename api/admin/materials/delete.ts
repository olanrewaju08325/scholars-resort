import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { id, title, file_path } = req.body || {};
  if (!id && !title && !file_path) {
    return res.status(400).json({ success: false, error: 'Missing required id, title, or file_path' });
  }

  try {
    const results: string[] = [];

    // 1. Delete from materials and library_materials by UUID
    if (id && isValidUUID(id)) {
      const { error: err1 } = await supabase.from('materials').delete().eq('id', id);
      if (!err1) results.push('materials_deleted_by_id');
      const { error: err2 } = await supabase.from('library_materials').delete().eq('id', id);
      if (!err2) results.push('library_materials_deleted_by_id');
    }

    // 2. Delete by title match
    if (title) {
      const { error: err1 } = await supabase.from('materials').delete().ilike('title', title.trim());
      if (!err1) results.push('materials_deleted_by_title');
      const { error: err2 } = await supabase.from('library_materials').delete().ilike('title', title.trim());
      if (!err2) results.push('library_materials_deleted_by_title');
    }

    // 3. Remove from storage buckets
    if (file_path) {
      const cleanPath = file_path.split('/').slice(-2).join('/');
      await supabase.storage.from('study-materials').remove([file_path, cleanPath]).catch(() => {});
      await supabase.storage.from('materials').remove([file_path, cleanPath]).catch(() => {});
      await supabase.storage.from('library').remove([file_path, cleanPath]).catch(() => {});
      results.push('storage_removed');
    }

    return res.status(200).json({ success: true, results });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Error deleting material' });
  }
}
