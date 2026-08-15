import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── GROQ PROVIDER ────────────────────────────────────────────────────────────
async function callGroq(
  apiKey: string,
  model: string,
  messages: any[],
  temperature: number,
  jsonMode: boolean
) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
    })
  });
  if (!res.ok) throw new Error(`Groq error (${res.status}): ${await res.text()}`);
  const raw = await res.json();
  return { ...raw, _provider: 'groq' };
}

// ─── CLAUDE (ANTHROPIC) PROVIDER ──────────────────────────────────────────────
async function callClaude(
  apiKey: string,
  messages: any[],
  temperature: number
) {
  // Anthropic uses a separate system prompt field; extract it from the messages array
  const systemMsg = messages.find((m: any) => m.role === 'system');
  const chatMessages = messages.filter((m: any) => m.role !== 'system');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      temperature,
      system: systemMsg?.content || 'You are a helpful AI Tutor for Nigerian JAMB candidates.',
      messages: chatMessages.map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content)
      }))
    })
  });

  if (!res.ok) throw new Error(`Claude error (${res.status}): ${await res.text()}`);
  const raw = await res.json();

  // Normalise to OpenAI-compatible shape so the rest of the code
  // and the frontend never need to know which provider responded.
  return {
    _provider: 'claude',
    choices: [{
      message: { role: 'assistant', content: raw.content?.[0]?.text ?? '' },
      finish_reason: raw.stop_reason
    }],
    usage: {
      prompt_tokens:     raw.usage?.input_tokens  ?? 0,
      completion_tokens: raw.usage?.output_tokens ?? 0,
      total_tokens:      (raw.usage?.input_tokens ?? 0) + (raw.usage?.output_tokens ?? 0)
    },
    model: raw.model
  };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, payload } = await req.json();

    // Auth validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    // Init Supabase clients
    const supabaseUrl  = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || supabaseAnon;
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized request');

    // ─── DYNAMIC API KEY RESOLUTION ───────────────────────────────────────────
    let groqApiKey   = Deno.env.get('GROQ_API_KEY');
    let claudeApiKey = Deno.env.get('ANTHROPIC_API_KEY');

    const { data: customKeys } = await adminClient
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_api_keys')
      .maybeSingle();

    if (customKeys?.setting_value) {
      if (customKeys.setting_value.groq) groqApiKey = customKeys.setting_value.groq;
      if (customKeys.setting_value.anthropic) claudeApiKey = customKeys.setting_value.anthropic;
    }

    // ─── TEST API KEY ACTION ──────────────────────────────────────────────────
    if (action === 'test_api_key') {
      const { provider, api_key } = payload;
      let result;
      if (provider === 'claude') {
        result = await callClaude(api_key, [{ role: 'user', content: 'Say OK in exactly 2 letters without punctuation.' }], 0.1);
      } else if (provider === 'groq') {
        result = await callGroq(api_key, 'llama3-8b-8192', [{ role: 'user', content: 'Say OK in exactly 2 letters without punctuation.' }], 0.1, false);
      } else {
        throw new Error('Unsupported provider for testing.');
      }
      return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (!groqApiKey && !claudeApiKey) {
      throw new Error('No AI provider configured. Set GROQ_API_KEY or ANTHROPIC_API_KEY in Supabase Edge Secrets, or configure them in the Admin Panel.');
    }

    // (Admin Client and User validation moved up)

    // Resolve feature → system prompt from DB
    let featureKey = payload.feature || 'tutor_chat';
    if (action === 'generate_question')                                  featureKey = 'question_generator';
    if (action === 'validate_question' || action === 'validate_batch')   featureKey = 'question_validator';
    if (action === 'study_planner')                                      featureKey = 'study_planner';
    if (action === 'flashcards')                                         featureKey = 'flashcards';
    if (action === 'quiz_generator')                                     featureKey = 'quiz_generator';

    let systemPrompt = 'You are a helpful AI Tutor for Nigerian JAMB candidates. Provide clear, accurate, and encouraging educational support.';
    let model        = payload.model || 'llama-3.3-70b-versatile';
    let temperature  = 0.7;

    const { data: promptData } = await adminClient
      .from('admin_ai_prompts')
      .select('*')
      .eq('feature_name', featureKey)
      .maybeSingle();

    if (promptData) {
      systemPrompt = promptData.system_prompt;
      model        = promptData.model || model;
      temperature  = promptData.temperature ?? temperature;
    }

    // Build messages array
    const jsonMode = action === 'generate_question' || action === 'validate_batch';
    let chatMessages: any[] = [{ role: 'system', content: systemPrompt }];

    if (action === 'chat' && payload.messages) {
      const hasSystem = payload.messages.some((m: any) => m.role === 'system');
      chatMessages = hasSystem ? [...payload.messages] : [...chatMessages, ...payload.messages];
    } else if (action === 'generate_question') {
      chatMessages.push({ role: 'user', content: `Generate a JAMB multiple-choice question for Topic: ${payload.topic} at Difficulty: ${payload.difficulty}. Format strictly as JSON: { "question": "", "options": ["A","B","C","D"], "correct_answer": "", "explanation": "" }` });
    } else if (action === 'validate_question') {
      chatMessages.push({ role: 'user', content: `Validate this question for errors: ${JSON.stringify(payload.question)}` });
    } else if (action === 'validate_batch') {
      chatMessages.push({ role: 'user', content: `Analyze the following JSON array of questions for spelling and duplicate errors. Return a strictly formatted JSON array containing the exact same questions with any errors corrected. Ensure the array structure remains identical. Array: ${JSON.stringify(payload.questions)}` });
    } else {
      chatMessages.push({ role: 'user', content: typeof payload === 'string' ? payload : JSON.stringify(payload) });
    }

    // ── Intelligent Provider Routing ─────────────────────────────────────────
    let data: any;
    let providerUsed = 'unknown';

    // Tasks requiring high reasoning context should prefer Claude only IF key exists
    const preferClaude = !!claudeApiKey && (action === 'study_planner' || action === 'admin_assistant' || action === 'explain_question' || action === 'content_ingestion' || action === 'validate_batch' || action === 'validate_question');
    // Tasks requiring fast tutoring or JSON output should prefer Groq
    const preferGroq = action === 'generate_question' || action === 'flashcards' || action === 'chat' || action === 'quiz_generator';

    // Determine primary and secondary providers based on preference and available keys
    const canUseGroq = !!groqApiKey;
    const canUseClaude = !!claudeApiKey;

    if (!canUseGroq && !canUseClaude) {
       throw new Error("No AI providers configured.");
    }

    const tryGroq = async () => {
      data = await callGroq(groqApiKey!, model, chatMessages, temperature, jsonMode);
      providerUsed = 'groq';
    };

    const tryClaude = async () => {
      data = await callClaude(claudeApiKey!, chatMessages, temperature);
      providerUsed = 'claude';
    };

    if (preferClaude && canUseClaude) {
      try {
        await tryClaude();
      } catch (err: any) {
        console.warn(`Claude failed: ${err?.message || err}. Falling back to Groq.`);
        if (canUseGroq) await tryGroq();
        else throw err;
      }
    } else if (preferGroq && canUseGroq) {
      try {
        await tryGroq();
      } catch (err: any) {
        console.warn(`Groq failed: ${err?.message || err}. Falling back to Claude.`);
        if (canUseClaude) await tryClaude();
        else throw err;
      }
    } else if (canUseGroq) {
      try {
        await tryGroq();
      } catch (err) {
        console.warn(`Groq failed: ${err.message}. Falling back to Claude.`);
        if (canUseClaude) await tryClaude();
        else throw err;
      }
    } else {
      // Only Claude available
      await tryClaude();
    }

    // Log usage asynchronously (ignore errors so they never block the response)
    adminClient.from('ai_usage').insert({
      user_id:           user.id,
      feature:           action,
      provider:          providerUsed,
      prompt_tokens:     data.usage?.prompt_tokens     || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      total_tokens:      data.usage?.total_tokens      || 0,
    }).then(() => {}).catch(console.error);

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
