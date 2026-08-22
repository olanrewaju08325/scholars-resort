import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { data: subjects, error: subError } = await supabase
      .from('subjects')
      .select('id, name');

    if (subError) {
      return res.status(200).json({ success: false, error: subError.message, counts: {}, years: {} });
    }

    const counts: Record<string, number> = {};
    const canonicalCounts: Record<string, number> = {};
    const years: Record<string, string[]> = {};

    if (subjects && subjects.length > 0) {
      await Promise.all(
        subjects.map(async (sub) => {
          // Exact count from Database using head: true
          const { count, error: countError } = await supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('subject_id', sub.id)
            .eq('is_active', true);

          if (!countError && count !== null) {
            counts[sub.id] = count;
            const canonical = sub.name.trim().toLowerCase();
            canonicalCounts[canonical] = count;
          } else {
            counts[sub.id] = 0;
          }

          // Fetch past years with active questions
          const { data: yearsData } = await supabase
            .from('questions')
            .select('exam_year')
            .eq('subject_id', sub.id)
            .eq('is_active', true)
            .not('exam_year', 'is', null)
            .limit(100);

          if (yearsData) {
            const uniqueYears = Array.from(new Set(yearsData.map(y => String(y.exam_year)).filter(Boolean))).sort();
            years[sub.id] = uniqueYears;
          } else {
            years[sub.id] = [];
          }
        })
      );
    }

    return res.status(200).json({
      success: true,
      counts,
      canonicalCounts,
      years
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch subject counts.' });
  }
}
