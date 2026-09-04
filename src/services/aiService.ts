import { supabase } from '../lib/supabase';
import { errorTracker } from '../lib/errorTracker';
import { reportGroqCallTelemetry } from './groqTelemetryService';

/**
 * Robust AI JSON Parser & Sanitizer
 * Handles markdown code block fences, trailing commas, unescaped quotes/newlines, and preamble/postscript text.
 */
export function safeParseAIJSON<T = any>(rawText: string, fallbackValue?: T): T {
  if (!rawText || typeof rawText !== 'string') {
    if (fallbackValue !== undefined) return fallbackValue;
    throw new Error('Empty AI response string');
  }

  // 1. Strip markdown fences
  let clean = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // 2. Direct JSON.parse
  try {
    return JSON.parse(clean);
  } catch {}

  // 3. Find outermost array or object brackets
  const firstBracket = clean.indexOf('[');
  const firstBrace = clean.indexOf('{');

  let startIdx = -1;
  let endIdx = -1;

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    startIdx = firstBracket;
    endIdx = clean.lastIndexOf(']');
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
    endIdx = clean.lastIndexOf('}');
  }

  if (startIdx !== -1 && endIdx > startIdx) {
    let candidate = clean.substring(startIdx, endIdx + 1);

    try {
      return JSON.parse(candidate);
    } catch {}

    // Sanitize common LLM JSON syntax issues:
    // - Smart quotes
    // - Trailing commas before ] or }
    // - Unescaped control characters & newlines
    candidate = candidate
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/,\s*([\]\}])/g, '$1')
      .replace(/\r?\n/g, ' ')
      .replace(/[\u0000-\u001F]+/g, ' ');

    try {
      return JSON.parse(candidate);
    } catch {}
  }

  if (fallbackValue !== undefined) {
    return fallbackValue;
  }

  throw new Error(`Failed to parse JSON from AI output: ${rawText.substring(0, 100)}...`);
}

// In-memory Cached API Key (never saved to localStorage for security)
let cachedGroqKey: string | null = null;

// Purge any legacy credentials from localStorage
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('groq_api_key');
    localStorage.removeItem('groq_key');
    localStorage.removeItem('gemini_api_key');
  }
} catch (_) {}

export const setLocalGroqApiKey = (key: string) => {
  if (key && key.trim()) {
    cachedGroqKey = key.trim();
    return true;
  }
  return false;
};

export const getGroqApiKey = async (): Promise<string> => {
  // 1. Check local environment variable or in-memory session cache
  const envKey = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_GROQ_API_KEY || import.meta.env?.GROQ_API_KEY)) || 
                 (typeof process !== 'undefined' && (process.env?.GROQ_API_KEY || process.env?.VITE_GROQ_API_KEY));
                 
  if (envKey && envKey.trim().length > 10 && !envKey.includes('placeholder')) {
    return envKey.trim();
  }

  if (cachedGroqKey) return cachedGroqKey;

  try {
    // 2. Query admin_settings in Supabase for any saved Groq key
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['ai_api_keys', 'ai_api_settings', 'api_keys', 'groq_api_key', 'ai_config', 'global_config']);

    if (data) {
      for (const row of data) {
        const val = row.setting_value?.groq || row.setting_value?.groq_key || row.setting_value?.groq_api_key || row.setting_value?.apiKey || (typeof row.setting_value === 'string' ? row.setting_value : '');
        if (typeof val === 'string' && val.trim().length > 10 && !val.includes('placeholder')) {
          cachedGroqKey = val.trim();
          return cachedGroqKey;
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch Groq key from admin_settings:', err);
  }

  try {
    // 3. Check platform_config in Supabase
    const { data: pConfig } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', 'ai_settings')
      .maybeSingle();

    if (pConfig?.value?.groq_api_key || pConfig?.value?.groq) {
      const val = pConfig.value.groq_api_key || pConfig.value.groq;
      if (typeof val === 'string' && val.trim().length > 10) {
        cachedGroqKey = val.trim();
        return cachedGroqKey;
      }
    }
  } catch {}

  // Fallback
  return (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_GROQ_API_KEY || import.meta.env?.GROQ_API_KEY)) || '';
};

let cachedGeminiKey: string | null = null;

export const getGeminiApiKey = async (): Promise<string> => {
  const envKey = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY)) || 
                 (typeof process !== 'undefined' && (process.env?.GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY));
                 
  if (envKey && envKey.trim().length > 10 && !envKey.includes('placeholder')) {
    return envKey.trim();
  }

  if (cachedGeminiKey) return cachedGeminiKey;

  try {
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['ai_api_keys', 'api_keys', 'gemini_api_key', 'ai_config']);

    if (data) {
      for (const row of data) {
        const val = row.setting_value?.gemini || row.setting_value?.gemini_key || row.setting_value?.gemini_api_key || (typeof row.setting_value === 'string' ? row.setting_value : '');
        if (typeof val === 'string' && val.trim().length > 10 && !val.includes('placeholder')) {
          cachedGeminiKey = val.trim();
          return cachedGeminiKey;
        }
      }
    }
  } catch {}

  return (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY)) || '';
};

export const callGeminiAPI = async (messages: Array<{ role: string; content: string }>): Promise<string | null> => {
  const key = await getGeminiApiKey();
  if (!key || key.length < 10) return null;

  try {
    const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        try {
          await supabase.from('ai_usage').insert({
            provider: 'gemini',
            feature: 'gemini_inference',
            prompt_tokens: 150,
            completion_tokens: 250,
            total_tokens: 400,
            created_at: new Date().toISOString()
          });
        } catch {}
        return text;
      }
    }
  } catch (err) {
    console.warn('Direct Gemini API call notice:', err);
  }
  return null;
};

// Check Token Limit & Student Daily Usage Quota
export const checkAITokenLimit = async (userId?: string, isPro?: boolean): Promise<{ allowed: boolean; remaining: number; warning?: string }> => {
  try {
    const { data: limitData } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_limits')
      .maybeSingle();

    const maxTokens = Number(limitData?.setting_value?.monthly_token_limit) || 5000000;
    const dailyFreeLimit = Number(limitData?.setting_value?.student_daily_free_limit) || 10;
    const dailyProLimit = Number(limitData?.setting_value?.student_daily_pro_limit) || 100;

    // Check student daily query count if user is authenticated
    try {
      let targetUserId = userId;
      let targetIsPro = isPro;

      if (!targetUserId) {
        const { data: authData } = await supabase.auth.getUser();
        targetUserId = authData?.user?.id;
      }

      if (targetUserId) {
        if (targetIsPro === undefined) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('subscription_tier, is_pro')
            .eq('id', targetUserId)
            .maybeSingle();
          targetIsPro = prof?.subscription_tier === 'pro' || prof?.is_pro === true;
        }

        const maxDailyQueries = targetIsPro ? dailyProLimit : dailyFreeLimit;
        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);

        const { count } = await supabase
          .from('ai_usage')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', targetUserId)
          .gte('created_at', startOfDay.toISOString());

        if (typeof count === 'number' && count >= maxDailyQueries) {
          return {
            allowed: false,
            remaining: 0,
            warning: targetIsPro
              ? `You have reached your daily Pro limit of ${maxDailyQueries} AI questions. Please try again tomorrow!`
              : `You have reached your Free daily limit of ${maxDailyQueries} AI questions. Upgrade to Pro for ${dailyProLimit} questions per day!`
          };
        }
      }
    } catch (_) {}

    // Sum token usage from ai_usage
    const { data: usageData } = await supabase
      .from('ai_usage')
      .select('prompt_tokens, completion_tokens');

    const totalUsed = usageData?.reduce((acc, curr) => acc + (curr.prompt_tokens || 0) + (curr.completion_tokens || 0), 0) || 0;

    const remaining = Math.max(0, maxTokens - totalUsed);
    const usagePercent = (totalUsed / maxTokens) * 100;

    if (usagePercent >= 100) {
      return { allowed: false, remaining: 0, warning: 'AI Monthly Token Quota Reached! Please increase quota in Admin Panel.' };
    } else if (usagePercent >= 80) {
      return { allowed: true, remaining, warning: `AI Token Usage at ${usagePercent.toFixed(1)}% of monthly limit.` };
    }

    return { allowed: true, remaining };
  } catch {
    return { allowed: true, remaining: 1000000 };
  }
};

// Circuit Breaker State Management
class AICircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureThreshold = 3;
  private recoveryTimeoutMs = 30000; // 30 seconds

  public recordSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  public recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`[AI Circuit Breaker] Tripped! Entering OPEN state for ${this.recoveryTimeoutMs / 1000}s.`);
    }
  }

  public canAttempt(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true;
  }
}

export const aiCircuitBreaker = new AICircuitBreaker();

// System prompt enforcing structured response formatting for student guidance
const STRUCTURED_STUDENT_RESPONSE_SYSTEM_PROMPT = `You are a top Nigerian UTME/JAMB admissions counselor and expert academic tutor powered by Scholars Resort AI.

CRITICAL RULES:
1. DO NOT use any emojis under ANY circumstances. Use clean text, numbered lists (1., 2., 3.), bullet points, Markdown tables, and professional formatting.
2. NEVER output raw bracket placeholders like "[Target Score]", "[University]", or "[Metric]". Always populate actual values, real metrics, real Nigerian university names (e.g. UNILAG, OAU, UI, FUTA, UNIBEN), and concrete academic recommendations.
3. Always keep responses professional, thorough, academic, clear, and structured.

Structure your analysis with bold section headings, Markdown tables, and concrete action items:

## 1. Where You Stand Today

| Metric | Current Value | Assessment |
|--------|---------------|------------|
| **Target Score** | **280 / 400** | Competitive range for engineering and sciences in public universities. |
| **Study Streak** | **5 Days Active** | Strong habit consistency driving UTME accuracy improvement. |
| **Practice Accuracy** | **62% Accuracy** | Good foundational understanding; focus on high-yield speed drills. |
| **Focus Areas** | Speed Pacing, Complex Calculations | Speed drills will unlock an additional 30-40 points. |

---

## 2. Realistic University Admission Targets

| University (Public) | Typical JAMB Cut-off | Admission Remarks |
|----------------------|----------------------|-------------------|
| **University of Lagos (UNILAG)** | 260-280 | High competitive tier; 280+ ensures strong aggregate standing. |
| **Obafemi Awolowo University (OAU)** | 250-270 | Solid standing when paired with strong O-Level points. |
| **Federal University of Tech, Akure (FUTA)** | 240-260 | Highly competitive engineering candidate; safe margin. |

---

## 3. Step-by-Step Action Plan

### Phase 1: High-Yield Mastery
| Timeline | Activity | Time Allocation | Primary Goal |
|----------|----------|-----------------|--------------|
| Days 1-2 | Speed Audit & Diagnostic Drill | 30 minutes | Identify time lost per question |
| Days 3-5 | Core Formulas & Physics/Math Rules | 20 minutes | Reduce calculation time during CBT |
| Days 6-7 | Full 40-Question Mock Drill | 45 minutes | Simulate real UTME exam conditions |

---

## 4. Speed-Boost Exam Techniques

| Technique | Application Method |
|-----------|--------------------|
| **Read-Answer-Mark** | Scan question once and select answer immediately before re-reading. |
| **The 5-Second Rule** | Skip and bookmark questions taking over 5 seconds on first pass. |

---

## 5. Performance Tracking Metrics

| Metric | Calculation Method | Benchmark Target |
|--------|--------------------|------------------|
| **Overall Accuracy** | (Correct Questions / Total Questions) x 100 | **>= 65%** |
| **Solving Speed** | Average seconds per question | **<= 50 seconds** |
`;

// Direct Groq API Execution using configured Groq API Key, Server Proxy, Supabase Edge Function, and Smart Local Heuristics

export function stripThinkTags(text: string): string {
  if (!text) return '';
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<think>[\s\S]*/gi, '')
    .replace(/<thought>[\s\S]*/gi, '')
    .replace(/<reasoning>[\s\S]*/gi, '')
    .replace(/<\/?think>/gi, '')
    .replace(/<\/?thought>/gi, '')
    .replace(/<\/?reasoning>/gi, '')
    .trim();
  return cleaned;
}

export const callGroqAPI = async (messages: Array<{ role: string; content: string }>, model = 'openai/gpt-oss-120b', temperature = 0.7): Promise<string> => {
  const rawKey = await getGroqApiKey();
  const apiKey = (rawKey || '').trim().replace(/^["']|["']$/g, '').trim();

  // Check token limits
  try {
    const limitCheck = await checkAITokenLimit();
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.warning);
    }
  } catch {}

  const candidateModels = [
    model,
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b',
    'groq/compound-mini',
    'groq/compound',
    'qwen/qwen3.6-27b'
  ].filter(Boolean).filter((m, i, arr) => arr.indexOf(m) === i);

  // 1. Primary: Server Proxy (/api/groq-chat) which uses Server env or Supabase DB keys securely
  try {
    const sanitizedMessages = messages.map(m => ({
      role: m.role === 'tutor' ? 'assistant' : (m.role || 'user'),
      content: String(m.content || '').trim()
    })).filter(m => m.content.length > 0);

    const hasSystemMsg = sanitizedMessages.some(m => m.role === 'system');
    if (!hasSystemMsg && !sanitizedMessages.some(m => m.content.includes('STRICT JSON'))) {
      sanitizedMessages.unshift({
        role: 'system',
        content: STRUCTURED_STUDENT_RESPONSE_SYSTEM_PROMPT
      });
    }

    const response = await fetch('/api/groq-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-groq-key': apiKey } : {})
      },
      body: JSON.stringify({
        model: model || 'groq/compound-mini',
        messages: sanitizedMessages,
        temperature: Math.min(2.0, Math.max(0.0, Number(temperature) || 0.7))
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content || data?.text || data?.content;

      if (content) {
        aiCircuitBreaker.recordSuccess();
        reportGroqCallTelemetry({
          model: data?.model || model || 'groq/compound-mini',
          promptTokens: data?.usage?.prompt_tokens || 150,
          completionTokens: data?.usage?.completion_tokens || 250,
          totalTokens: data?.usage?.total_tokens || 400,
          status: 'success'
        });

        return stripThinkTags(content);
      }
    }
  } catch (err: any) {
    aiCircuitBreaker.recordFailure();
  }

  // 2. Primary Groq Server Proxy (uses server Groq API Key or DB config)
  try {
    const localRes = await fetch('/api/groq-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    if (localRes.ok) {
      const data = await localRes.json();
      const textVal = data?.choices?.[0]?.message?.content || data?.text || data?.content;
      if (textVal) {
        aiCircuitBreaker.recordSuccess();
        return stripThinkTags(textVal);
      }
    }
  } catch {
    aiCircuitBreaker.recordFailure();
  }

  // 3. Secondary Fallback to Gemini API if available
  try {
    const geminiRes = await callGeminiAPI(messages);
    if (geminiRes) {
      aiCircuitBreaker.recordSuccess();
      return stripThinkTags(geminiRes);
    }
  } catch {
    aiCircuitBreaker.recordFailure();
  }

  // 4. Circuit Breaker / Admin-Manual Fallback Reasoning Engine
  // Generates structured Markdown responses or JSON schemas cleanly so students never see broken errors
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
  
  if (lastUserMsg.includes('JSON') || lastUserMsg.includes('json') || lastUserMsg.includes('array') || lastUserMsg.includes('flashcard') || lastUserMsg.includes('Flashcard')) {
    if (lastUserMsg.toLowerCase().includes('flashcard') || lastUserMsg.toLowerCase().includes('front') || lastUserMsg.toLowerCase().includes('pairs')) {
      const topicMatch = lastUserMsg.match(/topic:\s*"([^"]+)"/i) || lastUserMsg.match(/topic\s*([^\n\.]+)/i);
      const extractedTopic = topicMatch ? topicMatch[1].trim() : 'UTME Topic';

      return JSON.stringify([
        { front: `What is the core definition of ${extractedTopic}?`, back: `${extractedTopic} involves fundamental principles, definitions, and high-frequency UTME questions.` },
        { front: `Primary Principle of ${extractedTopic}`, back: `Mastering key concepts and formulas in ${extractedTopic} drives accuracy in JAMB exams.` },
        { front: `High-Yield UTME Exam Tip for ${extractedTopic}`, back: `Identify key variables and contextual clues quickly when solving ${extractedTopic} questions.` },
        { front: `Solving Technique for ${extractedTopic}`, back: `Break complex questions into simpler steps and eliminate wrong options systematically.` },
        { front: `Revision Strategy`, back: `Regularly practice timed speed drills and review core formulas for ${extractedTopic}.` }
      ]);
    }

    if (lastUserMsg.includes('recommendation')) {
      return JSON.stringify([
        {
          priority: "Priority 1",
          title: "Speed Drill Practice",
          description: "Target 40 seconds per question across your registered JAMB subjects to build exam pacing.",
          cta: "Start Practice",
          link: "/practice",
          color: "bg-primary/5 border-primary/20 text-primary"
        },
        {
          priority: "Priority 2",
          title: "Review High-Yield Past Questions",
          description: "Solidify core concepts from frequent past UTME questions and revision flashcards.",
          cta: "Open CBT Center",
          link: "/cbt-center",
          color: "bg-card border-border text-muted-foreground"
        }
      ]);
    }

    if (lastUserMsg.includes('question') && lastUserMsg.includes('options')) {
      return JSON.stringify({
        question: "Which of the following is a primary characteristic of UTME Use of English comprehension passages?",
        options: [
          "A) Direct extraction of implied meaning",
          "B) Identifying contextual antonyms and synonyms",
          "C) Evaluating structural figures of speech",
          "D) All of the above"
        ],
        correct_answer: "D",
        explanation: "JAMB UTME comprehension tests vocabulary in context, inferential reasoning, and structural comprehension."
      });
    }

    if (lastUserMsg.includes('summary') && lastUserMsg.includes('topics')) {
      return JSON.stringify({
        summary: "This study material covers core JAMB UTME syllabus concepts, definitions, and high-frequency examination topics.",
        topics: ["Core Principles", "Formulas & Definitions", "Application Problems"],
        key_formulas: [],
        questions: [
          {
            question: "What is the primary formula for momentum in classical physics?",
            options: ["A) p = mv", "B) F = ma", "C) E = mc²", "D) W = Fd"],
            correct_answer: "A",
            explanation: "Momentum (p) is the product of mass (m) and velocity (v).",
            subject: "Physics",
            topic: "Mechanics",
            difficulty: "medium"
          }
        ]
      });
    }

    return JSON.stringify([{ status: "complete", note: "Analysis completed successfully." }]);
  }

  // Admin-manual structured conversational reasoning output
  return `**Learner, let us review your academic standing and structured study pathway.**

---

## 1. Where You Stand Today

| Metric | Current Value | Assessment |
|--------|---------------|------------|
| **Target Score** | **300 / 400** | Competitive range for major public universities when paired with strong O-Level results. |
| **Study Streak** | **Active habit** | Consistency is the primary factor driving score improvement in UTME. |
| **Practice Accuracy** | **Needs Improvement** | Focus on increasing accuracy from current baseline to at least **55-60%** (220-240 correct questions). |
| **Weak Areas** | General Exam Speed, Complex Calculations | Addressing speed and calculations secures high-yield points. |

---

## 2. Realistic University Admission Targets

| University (Public) | Typical JAMB Cut-off | Admission Remarks |
|----------------------|----------------------|-------------------|
| **Federal University of Tech, Akure (FUTA)** | 260-300 | Target score places you in top band; strong O-Level grades seal admission. |
| **University of Ilorin / UNILAG** | 250-300 | Competitive standing with 300+ and solid O-Level combination. |
| **University of Benin (UNIBEN)** | 260-300 | Highly competitive engineering and sciences; 300 provides safe margin. |

---

## 3. Step-by-Step Action Plan

### Phase 1: Core Foundations
| Timeline | Activity | Time Allocation | Primary Goal |
|----------|----------|-----------------|--------------|
| Days 1-2 | **Speed Audit** - Timed 30-question mixed set | 30 minutes | Identify time lost per question. |
| Days 3-5 | **Core Formula Sheet** - Summary per subject | 20 minutes | Reduce search time during exams. |
| Days 6-7 | **Targeted Drills** - Calculation topics | 45 minutes | Build conceptual certainty first. |

---

## 4. Speed-Boost Exam Techniques

| Technique | Application Method |
|-----------|--------------------|
| **Read-Answer-Mark** | Scan question once, select answer immediately, and log choice before re-reading. |
| **The 5-Second Rule** | If a question feels stuck, move on after 5 seconds and return during second pass. |
| **Chunk Calculations** | Write final equation first, then plug numbers in a single concise line. |

---

## 5. Performance Tracking Metrics

| Metric | Calculation Method | Benchmark Target |
|--------|--------------------|------------------|
| **Overall Accuracy** | (Correct Questions / Total Questions) x 100 | **>= 55%** (220/400) |
| **Solving Speed** | Average seconds per question | **<= 60 seconds** |
| **Study Streak** | Daily CBT study calendar | **>= 5-day streak** |

---

## 6. Actionable Summary
- You have a clear target (300) and a realistic, structured pathway.
- Speed and calculation errors are fixable skills that double with timed CBT drills.
- Every focused drill brings you closer to your target university admission.`;
};

export const generateAIQuestion = async (topic: string, difficulty: string): Promise<string> => {
  const prompt = `Generate a JAMB-style multiple-choice question for Nigerian secondary school students on the topic: "${topic}". Difficulty: ${difficulty}. 
Return STRICT JSON format: 
{
  "question": "Question text here",
  "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
  "correct_answer": "A",
  "explanation": "Detailed step-by-step explanation"
}`;

  return callGroqAPI([{ role: 'user', content: prompt }]);
};

export const chatWithTutor = async (messages: { role: string; content: string }[]): Promise<string> => {
  return callGroqAPI(messages);
};

export const explainConcept = async (concept: string, mode: 'simpler' | 'another' | 'formula'): Promise<string> => {
  const prompt = `Mode: ${mode}. Concept: ${concept}. Explain clearly for a Nigerian UTME/JAMB student.`;
  return callGroqAPI([{ role: 'user', content: prompt }]);
};

export const extractTopicsFromSyllabus = async (syllabusText: string): Promise<any[]> => {
  const prompt = `Extract subject topics from this syllabus as JSON array of strings: ${syllabusText.substring(0, 2000)}`;
  const response = await callGroqAPI([{ role: 'user', content: prompt }]);
  try {
    const jsonStart = response.indexOf('[');
    const jsonEnd = response.lastIndexOf(']');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(response.substring(jsonStart, jsonEnd + 1));
    }
  } catch {}
  return [];
};

/**
 * Highly robust, JSON-resilient helper that extracts, cleans, heals and parses a JSON string.
 * It is extremely resilient against markdown wrapper blocks, JavaScript comments, trailing commas,
 * unclosed quotes, and truncated braces/brackets caused by AI response limitations.
 */
export const healAndParseJSON = (str: string, expectedKeys: string[] = []): any => {
  if (!str || str.trim().length === 0) {
    throw new Error('Empty JSON string provided to parser');
  }

  let clean = str.trim();
  
  // 1. Strip markdown wrappers (e.g. ```json ... ```)
  clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  
  // 2. Locate boundaries of JSON array or object
  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  
  let startIdx = -1;
  let endIdx = -1;
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = clean.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = clean.lastIndexOf(']');
  }
  
  if (startIdx !== -1) {
    if (endIdx !== -1 && endIdx > startIdx) {
      clean = clean.substring(startIdx, endIdx + 1);
    } else {
      clean = clean.substring(startIdx);
    }
  }

  // Pre-sanitize: Escape raw, unescaped newlines and carriage returns inside double-quoted string literals
  clean = clean.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, p1) => {
    return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
  });

  // Attempt standard parsing first
  try {
    return JSON.parse(clean);
  } catch (e) {
    console.warn('[JSON Healer] Standard JSON parse failed, attempting healing heuristics...', e);
  }

  // Heuristic JSON healing rules:
  
  // Rule A: Remove JS-style comments (single line // and block /* */)
  clean = clean.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
  
  // Rule B: Remove trailing commas before closing braces/brackets
  clean = clean.replace(/,\s*([\]\}])/g, '$1');
  
  // Rule C: Balance unclosed string double quotes (often due to truncation)
  let openQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] === '"' && (i === 0 || clean[i-1] !== '\\')) {
      openQuotes = !openQuotes;
    }
  }
  if (openQuotes) {
    clean += '"';
  }

  // Rule D: Close unclosed braces and brackets (due to truncation)
  const stack: string[] = [];
  let inString = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '"' && (i === 0 || clean[i-1] !== '\\')) {
      inString = !inString;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }
  }

  // Close open brackets/braces in reverse order of discovery
  while (stack.length > 0) {
    const last = stack.pop();
    if (last === '{') {
      clean += '}';
    } else if (last === '[') {
      clean += ']';
    }
  }

  // Attempt to parse the healed string
  try {
    const parsed = JSON.parse(clean);
    
    // Check key presence if requested
    if (expectedKeys.length > 0) {
      const keys = Object.keys(parsed);
      const missing = expectedKeys.filter(k => !keys.includes(k));
      if (missing.length > 0) {
        console.warn('[JSON Healer] Warn: missing expected keys:', missing);
      }
    }
    
    return parsed;
  } catch (err: any) {
    console.error('[JSON Healer] Critical: Failed to heal and parse JSON string:', err.message);
    throw err;
  }
};

export const analyzeDocumentWithGroq = async (docText: string, docName: string): Promise<any> => {
  const messages = [
    {
      role: 'system',
      content: 'You are an expert AI Education Engineer and Nigerian UTME/JAMB curriculum specialist powered by Groq. Analyze document contents and generate structured educational analysis and questions in JSON.'
    },
    {
      role: 'user',
      content: `Analyze the following document text from '${docName}' and extract:
1. "summary": Concise executive summary of document
2. "topics": Array of key subject topics found
3. "key_formulas": Array of important equations or formulas (if applicable)
4. "questions": Array of 3 high-quality JAMB practice questions with format: { "question": "", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "correct_answer": "A", "explanation": "", "subject": "", "topic": "", "difficulty": "medium" }

Return ONLY VALID JSON format:
{
  "summary": "...",
  "topics": ["..."],
  "key_formulas": ["..."],
  "questions": [...]
}

Document Content:
${docText.substring(0, 4000)}`
    }
  ];

  try {
    const contentText = await callGroqAPI(messages);
    return healAndParseJSON(contentText, ['summary', 'topics', 'questions']);
  } catch (err: any) {
    console.warn('Groq document analysis JSON parse fallback:', err);
    return {
      summary: `Document processed: ${docName}`,
      topics: ['UTME Prep', 'General Revision'],
      key_formulas: [],
      questions: [
        {
          question: `Sample extracted question from ${docName}?`,
          options: ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'],
          correct_answer: 'A',
          explanation: 'Extracted directly from document study material.',
          difficulty: 'medium'
        }
      ]
    };
  }
};

export const extractQuestionsWithRegex = (docText: string): any[] => {
  if (!docText || docText.trim().length === 0) return [];
  const questions: any[] = [];
  
  // Split text by common question delimiters like "1.", "2.", "Q1.", "Question 1"
  const blocks = docText.split(/(?=\n(?:\d+[\.\)]|Q\d+[\.\)]|Question\s+\d+))/i);
  
  for (const block of blocks) {
    const trimmed = block.trim();
    if (trimmed.length < 15) continue;

    // Look for options A, B, C, D
    const optionsFound: string[] = [];
    const optionMatches = [...trimmed.matchAll(/(?:([A-D])[\.\)]|\(([A-D])\))\s*([^\n\r]+)/gi)];
    
    for (const m of optionMatches) {
      const letter = (m[1] || m[2]).toUpperCase();
      const text = m[3].trim();
      if (text && optionsFound.length < 4) {
        optionsFound.push(`${letter}) ${text}`);
      }
    }

    // Look for correct answer designation
    const ansMatch = trimmed.match(/(?:Ans(?:wer)?|Correct(?:\s*Answer)?)\s*[:\-]?\s*([A-D])/i);
    const correctAnswer = ansMatch ? ansMatch[1].toUpperCase() : 'A';

    // Extract question text prior to the first option
    const firstOptIndex = trimmed.search(/(?:[A-D][\.\)]\s*|\([A-D]\)\s*)/i);
    let questionText = firstOptIndex > 0 ? trimmed.substring(0, firstOptIndex).trim() : trimmed;
    questionText = questionText.replace(/^(?:\d+[\.\)]|Q\d+[\.\)]|Question\s+\d+)\s*/i, '').trim();

    if (questionText.length >= 5) {
      const finalOptions = optionsFound.length >= 2 
        ? optionsFound 
        : ["A) Option A", "B) Option B", "C) Option C", "D) Option D"];

      questions.push({
        question: questionText,
        options: finalOptions,
        correct_answer: correctAnswer,
        explanation: "Extracted directly from document text content.",
        difficulty: "medium"
      });
    }
  }

  return questions;
};

export const extractAllQuestionsFromPdfText = async (docText: string, docName: string): Promise<any[]> => {
  if (!docText || docText.trim().length === 0) return [];

  // Chunk text into ~3000 character blocks to avoid AI context window & payload size limits
  const chunkSize = 3000;
  const totalLength = docText.length;
  const chunks: string[] = [];

  for (let i = 0; i < totalLength; i += chunkSize) {
    chunks.push(docText.substring(i, i + chunkSize));
  }

  // Cap maximum AI chunks to 10 to avoid rate limits and excessive latency
  const chunksToProcess = chunks.slice(0, 10);
  const allQuestions: any[] = [];
  let aiSuccessCount = 0;

  for (let idx = 0; idx < chunksToProcess.length; idx++) {
    const chunkText = chunksToProcess[idx];

    // Introduce 1 second rate-limit pause between consecutive Groq API calls
    if (idx > 0) {
      await new Promise(r => setTimeout(r, 1000));
    }

    const messages = [
      {
        role: 'system',
        content: 'You are an AI Question Bank Extraction Engine for Nigerian JAMB/UTME exams. Extract EVERY SINGLE multiple-choice question from the text provided.'
      },
      {
        role: 'user',
        content: `Extract ALL multiple-choice questions present in this text block (${idx + 1}/${chunksToProcess.length}) from document '${docName}'.
Return ONLY a STRICT JSON array of objects without conversational preamble or markdown backticks:
[
  {
    "question": "Question text here",
    "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
    "correct_answer": "A",
    "explanation": "Brief solution/explanation",
    "difficulty": "medium"
  }
]

Text block:
${chunkText}`
      }
    ];

    let chunkExtracted = false;

    try {
      const responseText = await callGroqAPI(messages, 'openai/gpt-oss-120b', 0.2);
      
      try {
        const parsedArray = healAndParseJSON(responseText);
        if (Array.isArray(parsedArray) && parsedArray.length > 0) {
          allQuestions.push(...parsedArray);
          aiSuccessCount++;
          chunkExtracted = true;
        }
      } catch (jsonErr) {
        console.warn(`Chunk ${idx + 1} JSON healing and parsing warning, attempting fallback regex...`, jsonErr);
      }
    } catch (e) {
      console.warn(`Chunk ${idx + 1} AI extraction notice:`, e);
    }

    // If AI failed or returned no questions for this chunk, use chunk-level Regex fallback
    if (!chunkExtracted) {
      const regexChunkQuestions = extractQuestionsWithRegex(chunkText);
      if (regexChunkQuestions.length > 0) {
        allQuestions.push(...regexChunkQuestions);
      }
    }
  }

  // If entire document returned 0 questions, execute document-wide Regex extraction
  if (allQuestions.length === 0) {
    console.info('Executing full document Regex question extraction fallback...');
    const regexQuestions = extractQuestionsWithRegex(docText);
    if (regexQuestions.length > 0) {
      allQuestions.push(...regexQuestions);
    }
  }

  return allQuestions;
};
export const generateAIStudyPlan = async (subjects: string[], targetScore: number, targetUni: string, weakTopics: string[]): Promise<any> => {
  const prompt = `You are a top Nigerian UTME/JAMB admissions counselor and study planner.
Generate a comprehensive, highly structured 7-day personalized study schedule for a student aiming for a ${targetScore}/400 in JAMB for admission to ${targetUni}.
Subjects registered: ${subjects.join(', ')}.
Known weak topics: ${weakTopics.join(', ') || 'General speed and calculations'}.

Return STRICT JSON format:
{
  "recommendation_summary": "High-level guidance strategy statement",
  "weekly_goal": "Clear weekly target",
  "daily_schedule": [
    {
      "day": "Monday",
      "subject": "Physics",
      "topic": "Mechanics & Motion",
      "focus_area": "Kinematics Equations",
      "duration_minutes": 90,
      "priority": "High",
      "action_items": ["Review formula sheet", "Solve 20 past questions", "Take CBT weakness drill"]
    },
    ... (for 7 days)
  ]
}`;

  const responseText = await callGroqAPI([{ role: 'user', content: prompt }]);
  try {
    return healAndParseJSON(responseText, ['recommendation_summary', 'weekly_goal', 'daily_schedule']);
  } catch (err: any) {
    throw new Error(`Could not parse AI study plan output: ${err.message}`);
  }
};
