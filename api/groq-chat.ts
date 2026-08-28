import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://syoodykedvqaoeplmamd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b29keWtlZHZxYW9lcGxtYW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNjEyMTIsImV4cCI6MjEwMDkzNzIxMn0.GV7jgq04Qha6W1JENvc-ntVt9zSOLDx7vTaTxZlOTq4';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-groq-key, x-user-id, x-exam-active');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const startTime = Date.now();
  const userId = req.body?.userId || (req.headers['x-user-id'] as string);

  // Proctor Mode Anti-Cheating check: Lock AI Tutor during live CBT exams
  let isExamActive = req.headers['x-exam-active'] === 'true' || req.body?.isExamActive === true;

  if (!isExamActive && userId) {
    try {
      const { data: activeSession } = await supabase
        .from('exam_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'in_progress')
        .eq('is_ai_tutor_locked', true)
        .maybeSingle();
      if (activeSession) {
        isExamActive = true;
      }
    } catch (_) {}
  }

  if (isExamActive) {
    return res.status(403).json({
      error: 'AI Tutor access is locked during live proctored CBT exams to enforce academic integrity and prevent cheating.',
      locked: true
    });
  }

  const { messages, model = 'llama-3.3-70b-versatile', temperature = 0.7 } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const customGroqKey = (req.headers['x-groq-key'] as string) || req.body?.apiKey;
  let groqKey = customGroqKey || process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

  if (!groqKey) {
    try {
      const { data: sysKey } = await supabase
        .from('system_configs')
        .select('config_value')
        .eq('config_key', 'groq_settings')
        .maybeSingle();
      if (sysKey?.config_value?.apiKey || sysKey?.config_value?.groq) {
        groqKey = sysKey.config_value.apiKey || sysKey.config_value.groq;
      }
    } catch (_) {}

    if (!groqKey) {
      try {
        const { data: dbKeys } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .in('setting_key', ['ai_api_keys', 'ai_api_settings', 'api_keys']);
        if (dbKeys) {
          for (const row of dbKeys) {
            const val = row.setting_value?.apiKey || row.setting_value?.groq || row.setting_value?.groq_key;
            if (val && typeof val === 'string' && val.trim().length > 10) {
              groqKey = val.trim();
              break;
            }
          }
        }
      } catch (_) {}
    }
  }

  const candidateModels = [
    model,
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'gemma2-9b-it'
  ].filter(Boolean).filter((m, i, arr) => arr.indexOf(m) === i);

  if (groqKey && groqKey.trim()) {
    for (const m of candidateModels) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey.trim()}`
          },
          body: JSON.stringify({
            model: m,
            messages,
            temperature: Math.min(2.0, Math.max(0.0, Number(temperature) || 0.7)),
            max_tokens: 2048
          })
        });

        const latencyMs = Date.now() - startTime;
        const remTokens = response.headers.get('x-ratelimit-remaining-tokens') || response.headers.get('x-ratelimit-remaining-tokens-minute');
        const limTokens = response.headers.get('x-ratelimit-limit-tokens') || response.headers.get('x-ratelimit-limit-tokens-minute');
        const resReset = response.headers.get('x-ratelimit-reset-tokens');
        const remReqs = response.headers.get('x-ratelimit-remaining-requests');
        const limReqs = response.headers.get('x-ratelimit-limit-requests');

        if (response.ok) {
          const data = await response.json();
          const promptTokens = data?.usage?.prompt_tokens || 0;
          const completionTokens = data?.usage?.completion_tokens || 0;
          const totalTokens = data?.usage?.total_tokens || (promptTokens + completionTokens);
          const replyText = data?.choices?.[0]?.message?.content || '';

          data.text = replyText;
          data.content = replyText;
          data._telemetry = {
            remainingTokens: remTokens,
            limitTokens: limTokens,
            resetTokens: resReset,
            remainingRequests: remReqs,
            latencyMs
          };

          return res.status(200).json(data);
        }
      } catch (groqErr) {
        console.warn(`Groq server call failed on model ${m}:`, groqErr);
      }
    }
  }

  // Fallback to Gemini if configured
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const prompt = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return res.status(200).json({
            text,
            content: text,
            choices: [{ message: { role: 'assistant', content: text } }],
            usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 }
          });
        }
      }
    } catch (gemErr) {
      console.warn('Vercel serverless Gemini fallback warning:', gemErr);
    }
  }

  return res.status(503).json({
    error: 'AI service currently unavailable. Please verify your Groq API key in Settings.',
    content: 'I am currently unable to connect to the AI model. Please ensure the Groq API Key is configured in the admin dashboard.'
  });
}
