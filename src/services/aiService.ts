import { supabase } from '../lib/supabase';
import { errorTracker } from '../lib/errorTracker';

// Cached API Key
let cachedGroqKey: string | null = null;

export const getGroqApiKey = async (): Promise<string> => {
  // 1. Check local environment or localStorage
  const envKey = import.meta.env.VITE_GROQ_API_KEY || localStorage.getItem('groq_api_key');
  if (envKey && envKey.trim().length > 10) return envKey.trim();

  if (cachedGroqKey) return cachedGroqKey;

  try {
    // 2. Query admin_settings in Supabase
    const { data } = await supabase
      .from('admin_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['ai_api_keys', 'api_keys']);

    if (data) {
      for (const row of data) {
        const val = row.setting_value?.groq || row.setting_value?.groq_key || row.setting_value?.groq_api_key;
        if (typeof val === 'string' && val.trim().length > 10) {
          cachedGroqKey = val.trim();
          localStorage.setItem('groq_api_key', cachedGroqKey);
          return cachedGroqKey;
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch Groq key from admin_settings:', err);
  }

  // Fallback default development key or placeholder
  return import.meta.env.VITE_GROQ_API_KEY || '';
};

// Check Token Limit
export const checkAITokenLimit = async (): Promise<{ allowed: boolean; remaining: number; warning?: string }> => {
  try {
    const { data: limitData } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_limits')
      .maybeSingle();

    const maxTokens = limitData?.setting_value?.monthly_token_limit || 5000000;

    // Sum token usage from ai_usage
    const { data: usageData } = await supabase
      .from('ai_usage')
      .select('prompt_tokens, completion_tokens');

    const totalUsed = usageData?.reduce((acc, curr) => acc + (curr.prompt_tokens || 0) + (curr.completion_tokens || 0), 0) || 0;

    const remaining = maxTokens - totalUsed;
    const usagePercent = (totalUsed / maxTokens) * 100;

    if (usagePercent >= 100) {
      return { allowed: false, remaining: 0, warning: 'AI Monthly Token Quota Reached! Please upgrade or increase quota in Admin Panel.' };
    } else if (usagePercent >= 80) {
      return { allowed: true, remaining, warning: `AI Token Usage at ${usagePercent.toFixed(1)}% of monthly limit.` };
    }

    return { allowed: true, remaining };
  } catch {
    return { allowed: true, remaining: 1000000 };
  }
};

// Direct Groq API Execution with fallback to Supabase Edge Function
export const callGroqAPI = async (messages: Array<{ role: string; content: string }>, model = 'llama-3.3-70b-versatile', temperature = 0.7): Promise<string> => {
  const apiKey = await getGroqApiKey();

  // Check token limits
  const limitCheck = await checkAITokenLimit();
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.warning);
  }

  if (apiKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: 2048
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) throw new Error('Empty response from Groq API');

      // Log usage to Supabase ai_usage table
      const promptTokens = data?.usage?.prompt_tokens || 100;
      const completionTokens = data?.usage?.completion_tokens || 200;

      try {
        supabase.from('ai_usage').insert({
          provider: 'groq',
          feature: 'groq_inference',
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          created_at: new Date().toISOString()
        }).then(() => {}, () => {});
      } catch {}

      return content;
    } catch (err: any) {
      console.warn('Direct Groq call failed, attempting Supabase Edge Function fallback:', err.message);
      errorTracker.logError({
        type: 'ai_error',
        message: err.message,
        component: 'callGroqAPI'
      });
    }
  }

  // Fallback to Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: { action: 'chat', payload: { messages } }
    });

    if (error) throw error;
    return data?.choices?.[0]?.message?.content || 'No AI response generated.';
  } catch (edgeError: any) {
    errorTracker.logError({
      type: 'ai_error',
      message: edgeError.message,
      component: 'callGroqAPI (Edge Fallback)'
    });
    throw new Error(`AI Generation Error: Please set a valid Groq API Key in the Admin Panel (${edgeError.message})`);
  }
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
    const cleanJson = contentText.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonStart = cleanJson.indexOf('{');
    const jsonEnd = cleanJson.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(cleanJson.substring(jsonStart, jsonEnd + 1));
    }
    return JSON.parse(cleanJson);
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

  // Chunk text into ~3500 character blocks to avoid AI context window limit
  const chunkSize = 3500;
  const totalLength = docText.length;
  const chunks: string[] = [];

  for (let i = 0; i < totalLength; i += chunkSize) {
    chunks.push(docText.substring(i, i + chunkSize));
  }

  const allQuestions: any[] = [];
  let aiSuccess = false;

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunkText = chunks[idx];
    const messages = [
      {
        role: 'system',
        content: 'You are an AI Question Bank Extraction Engine for Nigerian JAMB/UTME exams. Extract EVERY SINGLE multiple-choice question from the text provided.'
      },
      {
        role: 'user',
        content: `Extract ALL multiple-choice questions present in this text block (${idx + 1}/${chunks.length}) from document '${docName}'.
Return ONLY a STRICT JSON array of objects without conversational preamble:
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

    try {
      const responseText = await callGroqAPI(messages, 'llama-3.3-70b-versatile', 0.2);
      
      // Extract array portion cleanly avoiding preamble text
      const arrayMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        const parsedArray = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsedArray) && parsedArray.length > 0) {
          allQuestions.push(...parsedArray);
          aiSuccess = true;
        }
      }
    } catch (e) {
      console.warn(`Chunk ${idx + 1} AI extraction notice:`, e);
    }
  }

  // If AI did not extract questions or failed, execute deterministic Regex extraction fallback
  if (allQuestions.length === 0 || !aiSuccess) {
    console.info('Executing deterministic Regex question extraction fallback...');
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
  const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
  const jsonStart = cleanJson.indexOf('{');
  const jsonEnd = cleanJson.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) {
    return JSON.parse(cleanJson.substring(jsonStart, jsonEnd + 1));
  }
  throw new Error("Could not parse AI study plan output.");
};
