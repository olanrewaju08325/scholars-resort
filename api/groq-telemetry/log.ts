import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const {
    model,
    promptTokens = 0,
    completionTokens = 0,
    totalTokens = 0,
    latencyMs = 0,
    status = 'success'
  } = req.body || {};

  try {
    const { data, error } = await supabase.from('ai_usage').insert({
      provider: 'groq',
      feature: 'groq_inference',
      prompt_tokens: Number(promptTokens) || 0,
      completion_tokens: Number(completionTokens) || 0,
      total_tokens: Number(totalTokens) || (Number(promptTokens) + Number(completionTokens)),
      created_at: new Date().toISOString()
    }).select();

    if (error) {
      return res.status(200).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, message: 'Logged to database successfully', data });
  } catch (err: any) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
