import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAdmin } from '../_auth';

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

  const startTime = Date.now();
  try {
    const { apiKey, model = 'llama-3.3-70b-versatile' } = req.body || {};
    const keyToTest = (apiKey || process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '').trim();

    if (!keyToTest) {
      return res.status(400).json({ success: false, message: 'GROQ API key is required for testing.' });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToTest}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5
      })
    });

    const latencyMs = Date.now() - startTime;

    if (response.ok) {
      return res.status(200).json({
        success: true,
        latencyMs,
        message: `GROQ API Connection Successful! Latency: ${latencyMs}ms on model ${model}.`
      });
    }

    const errJson: any = await response.json().catch(() => ({}));
    return res.status(200).json({
      success: false,
      latencyMs,
      message: errJson?.error?.message || `GROQ API rejected request with HTTP status ${response.status}.`
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      latencyMs: Date.now() - startTime,
      message: err.message || 'Network error connecting to GROQ API servers.'
    });
  }
}
