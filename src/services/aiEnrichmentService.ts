import { callGroqAPI, safeParseAIJSON } from './aiService';
import type { ParsedQuestionItem } from '../lib/csvQuestionParser';

export async function enrichQuestionsBatchWithAI(
  questions: ParsedQuestionItem[],
  batchSize = 20,
  onProgress?: (processed: number, total: number, message: string) => void
): Promise<ParsedQuestionItem[]> {
  const enriched = [...questions];
  const incompleteItems = enriched.filter(q => !q.explanation || !q.year || !q.topicName);

  if (incompleteItems.length === 0) {
    return enriched;
  }

  let processedCount = 0;
  const totalIncomplete = incompleteItems.length;

  for (let i = 0; i < enriched.length; i += batchSize) {
    const chunk = enriched.slice(i, i + batchSize);
    const chunkIncomplete = chunk.filter(q => !q.explanation || !q.year || !q.topicName);

    if (chunkIncomplete.length === 0) {
      processedCount += chunk.length;
      continue;
    }

    onProgress?.(processedCount, totalIncomplete, `AI Enriching batch ${Math.floor(i / batchSize) + 1} (${chunkIncomplete.length} items)...`);

    try {
      const prompt = `You are an expert curriculum AI for Nigerian UTME CBT. For each question below, provide missing details in strict JSON array format.
Items to process:
${JSON.stringify(chunkIncomplete.map(q => ({
  row: q.rowNumber,
  subject: q.subjectName,
  question: q.questionText,
  options: q.options,
  correct: q.correctAnswer,
  hasExplanation: Boolean(q.explanation),
  hasYear: Boolean(q.year),
  hasTopic: Boolean(q.topicName)
})))}

Output MUST be a JSON array with objects matching:
[
  {
    "row": number,
    "explanation": "Clear step-by-step pedagogical rationale for the correct answer",
    "year": 2023,
    "topicName": "Standard curriculum sub-topic name",
    "difficulty": "medium"
  }
]
Return ONLY valid JSON.`;

      const aiRes = await callGroqAPI([{ role: 'user', content: prompt }], 'openai/gpt-oss-120b', 0.3);
      const parsed = safeParseAIJSON<Array<{ row: number; explanation?: string; year?: number; topicName?: string; difficulty?: string }>>(aiRes, []);

      if (Array.isArray(parsed)) {
        for (const resItem of parsed) {
          const target = enriched.find(q => q.rowNumber === resItem.row);
          if (target) {
            if (!target.explanation && resItem.explanation) target.explanation = resItem.explanation;
            if (!target.year && resItem.year && !isNaN(Number(resItem.year))) target.year = Number(resItem.year);
            if (!target.topicName && resItem.topicName) target.topicName = resItem.topicName;
            if (resItem.difficulty && ['easy', 'medium', 'hard'].includes(resItem.difficulty)) {
              target.difficulty = resItem.difficulty as any;
            }
          }
        }
      }
    } catch (e: any) {
      console.warn('AI batch enrichment warning:', e?.message || e);
    }

    processedCount += chunk.length;
    onProgress?.(processedCount, totalIncomplete, `Completed batch ${Math.floor(i / batchSize) + 1}`);
  }

  return enriched;
}
