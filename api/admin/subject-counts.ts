import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 60-second in-memory cache for serverless invocation reuse
let cachedData: any = null;
let lastCacheTime = 0;

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

  if (cachedData && (Date.now() - lastCacheTime < 60000)) {
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(cachedData);
  }

  try {
    const { data: subjects, error: subError } = await supabase
      .from('subjects')
      .select('id, name');

    if (subError) {
      return res.status(200).json({ success: false, error: subError.message, counts: {}, totalCounts: {}, canonicalCounts: {}, years: {} });
    }

    const counts: Record<string, number> = {};
    const totalCounts: Record<string, number> = {};
    const canonicalCounts: Record<string, number> = {};
    const years: Record<string, string[]> = {};

    if (subjects && subjects.length > 0) {
      await Promise.all(
        subjects.map(async (sub) => {
          const { count: activeCount } = await supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('subject_id', sub.id)
            .eq('is_active', true);

          const { count: totalCount } = await supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('subject_id', sub.id);

          const finalActive = activeCount ?? 0;
          const finalTotal = totalCount ?? 0;

          counts[sub.id] = finalActive;
          totalCounts[sub.id] = finalTotal;
          canonicalCounts[sub.name.trim().toLowerCase()] = finalActive;

          const { data: yearsData } = await supabase
            .from('questions')
            .select('exam_year')
            .eq('subject_id', sub.id)
            .eq('is_active', true)
            .not('exam_year', 'is', null)
            .limit(100);

          if (yearsData && yearsData.length > 0) {
            years[sub.id] = Array.from(
              new Set(yearsData.map((y: any) => String(y.exam_year).trim()))
            ).filter(Boolean).sort().reverse();
          } else {
            years[sub.id] = [];
          }
        })
      );
    }

    cachedData = { success: true, counts, totalCounts, canonicalCounts, years };
    lastCacheTime = Date.now();

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(cachedData);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
