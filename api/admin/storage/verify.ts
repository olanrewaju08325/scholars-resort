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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const auth = await verifyAdmin(req);
  if (!auth.authorized) {
    return res.status(auth.status).json({ success: false, error: auth.error });
  }

  const targetBuckets = ['study-materials', 'materials', 'library'];
  const results: Record<string, { exists: boolean; public: boolean; error?: string; probeSuccess?: boolean }> = {};

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets) {
      buckets.forEach(b => {
        if (targetBuckets.includes(b.name) || targetBuckets.includes(b.id)) {
          results[b.name || b.id] = { exists: true, public: !!b.public, probeSuccess: true };
        }
      });
    }
  } catch (_) {}

  for (const bName of targetBuckets) {
    if (!results[bName]) {
      try {
        const { error: probeErr } = await supabase.storage.from(bName).list('', { limit: 1 });
        if (!probeErr) {
          results[bName] = { exists: true, public: true, probeSuccess: true };
        } else {
          results[bName] = { exists: false, public: false, error: probeErr.message };
        }
      } catch (e: any) {
        results[bName] = { exists: false, public: false, error: e.message };
      }
    }
  }

  return res.status(200).json({
    success: true,
    storageConnected: true,
    buckets: results,
    recommendedBucket: 'study-materials'
  });
}
