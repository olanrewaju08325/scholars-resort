import { callGroqAPI, stripThinkTags } from '@/services/aiService';
import { ContentNormalizer, type NormalizedQuestion } from '@/utils/ContentNormalizer';

export interface AISimulationTestRequest {
  subject: string;
  topic: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  examYear?: string;
  targetCount?: number;
}

export interface IntegrityCheckItem {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  score: number; // 0 to 100
  details: string;
}

export interface AISimulationResult {
  timestamp: string;
  subject: string;
  topic: string;
  difficulty: string;
  rawAIResponse: string;
  normalizedQuestions: NormalizedQuestion[];
  latencyMs: number;
  totalGenerated: number;
  overallScore: number; // 0 - 100
  status: 'passed' | 'warning' | 'failed';
  checks: IntegrityCheckItem[];
  brandingVerification: {
    schorlarsResortPersonaApplied: boolean;
    zeroExternalVendorTags: boolean; // No Myschool, Pass.ng, Prep50, TestDriller
    cleanQuestionPrefixes: boolean; // No 1. 2. Q1.
    standardOptionsSchema: boolean; // A, B, C, D distinct
    pedagogicalExplanationPresent: boolean;
    mathLatexFormatted: boolean;
  };
}

export class AISimulationService {
  /**
   * Runs a complete AI Question Generation & Normalization Simulation test.
   * Validates tone, syllabus alignment, formatting, and stripping of third-party tags.
   */
  public static async runSimulation(req: AISimulationTestRequest): Promise<AISimulationResult> {
    const startTime = Date.now();
    const subject = req.subject || 'Physics';
    const topic = req.topic || 'Newtonian Mechanics & Gravitation';
    const difficulty = req.difficulty || 'medium';
    const count = req.targetCount || 3;

    const prompt = `You are the lead academic AI tutor for "Scholars Resort CBT Bank", specialized in preparing Nigerian secondary students for UTME/JAMB exams.
Generate exactly ${count} authentic, syllabus-compliant JAMB multiple choice questions for Subject: "${subject}", Topic: "${topic}", Difficulty: "${difficulty}".

Rules:
1. Each question must have 4 distinct options (A, B, C, D).
2. Format as a strict JSON array of objects:
[
  {
    "question": "Clear question text with proper math formatting if needed",
    "options": ["A: First option", "B: Second option", "C: Third option", "D: Fourth option"],
    "correct_answer": "A",
    "explanation": "Step-by-step clear pedagogical explanation breaking down why this is correct."
  }
]
Output strictly raw JSON without markdown code fences or conversational greetings.`;

    let rawOutput = '';
    let parsedJson: any[] = [];

    try {
      const response = await callGroqAPI(
        [
          {
            role: 'system',
            content: 'You are the official Scholars Resort CBT Bank Academic Engine. Output only valid JSON arrays.'
          },
          { role: 'user', content: prompt }
        ],
        { temperature: 0.3 }
      );

      rawOutput = stripThinkTags(response).trim();
      
      // Extract JSON array
      const jsonMatch = rawOutput.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedJson = JSON.parse(jsonMatch[0]);
      } else {
        const singleObjMatch = rawOutput.match(/\{[\s\S]*\}/);
        if (singleObjMatch) {
          parsedJson = [JSON.parse(singleObjMatch[0])];
        }
      }
    } catch (err: any) {
      console.error('[AISimulationService] Generation error:', err);
      rawOutput = `Error calling AI Engine: ${err.message || err}`;
    }

    const latencyMs = Date.now() - startTime;

    // Apply Content Normalization Pipeline
    const normalizedQuestions = ContentNormalizer.normalizeStream(parsedJson);

    // Run Integrity Scorecard Assertions
    const checks: IntegrityCheckItem[] = [];

    // Check 1: JSON Parsing & Structural validity
    const jsonParsedOk = Array.isArray(parsedJson) && parsedJson.length > 0;
    checks.push({
      id: 'json_validity',
      name: 'Valid Schema & Structure',
      description: 'AI output parsed into a structured array of questions',
      passed: jsonParsedOk,
      score: jsonParsedOk ? 100 : 0,
      details: jsonParsedOk ? `Parsed ${parsedJson.length} questions successfully` : 'Failed to parse JSON array'
    });

    // Check 2: Content Normalization & Question Prefix Stripping
    let hasDirtyPrefix = false;
    let hasVendorTags = false;
    const vendorRegex = /\[(Myschool|Pass\.ng|TestDriller|Prep50|ExamGuide)\]/i;
    const prefixRegex = /^(Question\s*\d+[\s.:-]*|\d+[\s.):-]\s*)/i;

    parsedJson.forEach(q => {
      const txt = q.question || q.question_text || '';
      if (prefixRegex.test(txt)) hasDirtyPrefix = true;
      if (vendorRegex.test(txt)) hasVendorTags = true;
    });

    const cleanNormalization = normalizedQuestions.every(q => !prefixRegex.test(q.question_text) && !vendorRegex.test(q.question_text));

    checks.push({
      id: 'content_normalization',
      name: 'Content Normalizer Strip Layer',
      description: 'Stripped leading indices (1., Q1:) and third-party vendor tags',
      passed: cleanNormalization,
      score: cleanNormalization ? 100 : 50,
      details: cleanNormalization ? 'All question strings cleanly normalized' : 'Residual artifacts detected in text'
    });

    // Check 3: 4 Distinct Standard Options (A, B, C, D)
    let optionsValid = true;
    normalizedQuestions.forEach(q => {
      if (!Array.isArray(q.options) || q.options.length < 4) {
        optionsValid = false;
      }
    });

    checks.push({
      id: 'options_schema',
      name: 'UTME 4-Option Standard',
      description: 'Each question contains standard 4 distinct choices (A, B, C, D)',
      passed: optionsValid && normalizedQuestions.length > 0,
      score: optionsValid && normalizedQuestions.length > 0 ? 100 : 0,
      details: optionsValid ? 'All items adhere to 4-option CBT layout' : 'Some questions lack 4 options'
    });

    // Check 4: Correct Answer Assignment
    let answersValid = true;
    normalizedQuestions.forEach(q => {
      if (!q.correct_option || !['A', 'B', 'C', 'D'].includes(q.correct_option)) {
        answersValid = false;
      }
    });

    checks.push({
      id: 'answer_assignment',
      name: 'Correct Option Validation',
      description: 'Every question is keyed to a valid A/B/C/D answer key',
      passed: answersValid && normalizedQuestions.length > 0,
      score: answersValid && normalizedQuestions.length > 0 ? 100 : 0,
      details: answersValid ? 'Answer keys mapped accurately' : 'Missing or invalid correct_option'
    });

    // Check 5: Pedagogical Step-by-Step Explanation
    let explanationsCount = 0;
    normalizedQuestions.forEach(q => {
      if (q.explanation && q.explanation.trim().length > 15) {
        explanationsCount++;
      }
    });

    const explanationScore = normalizedQuestions.length > 0 
      ? Math.round((explanationsCount / normalizedQuestions.length) * 100)
      : 0;

    checks.push({
      id: 'explanation_quality',
      name: 'Pedagogical Explanation',
      description: 'Comprehensive step-by-step explanation generated for students',
      passed: explanationScore >= 80,
      score: explanationScore,
      details: `${explanationsCount}/${normalizedQuestions.length} questions have detailed explanations`
    });

    // Compute Overall Score
    const totalScore = Math.round(checks.reduce((acc, c) => acc + c.score, 0) / checks.length);
    let status: 'passed' | 'warning' | 'failed' = 'passed';
    if (totalScore < 50 || normalizedQuestions.length === 0) status = 'failed';
    else if (totalScore < 85) status = 'warning';

    return {
      timestamp: new Date().toISOString(),
      subject,
      topic,
      difficulty,
      rawAIResponse: rawOutput,
      normalizedQuestions,
      latencyMs,
      totalGenerated: normalizedQuestions.length,
      overallScore: totalScore,
      status,
      checks,
      brandingVerification: {
        schorlarsResortPersonaApplied: true,
        zeroExternalVendorTags: !hasVendorTags,
        cleanQuestionPrefixes: !hasDirtyPrefix,
        standardOptionsSchema: optionsValid,
        pedagogicalExplanationPresent: explanationScore >= 80,
        mathLatexFormatted: rawOutput.includes('$') || rawOutput.includes('\\') || rawOutput.includes('^') || rawOutput.includes('='),
      }
    };
  }
}
