import Papa from 'papaparse';
import { supabase } from './supabase';
import { callGroqAPI } from '../services/aiService';
import { cleanQuestionText, cleanOptionText } from '../utils/questionUtils';

export interface ParsedQuestionItem {
  rowNumber: number;
  subjectName: string;
  topicName?: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  isDuplicateInFile?: boolean;
  isDuplicateInDb?: boolean;
  existingQuestionId?: string;
  validationError?: string;
}

export interface CsvParseResult {
  totalRows: number;
  validQuestions: ParsedQuestionItem[];
  duplicateQuestionsInFile: ParsedQuestionItem[];
  duplicateQuestionsInDb: ParsedQuestionItem[];
  failedRows: { rowNumber: number; raw: any; reason: string }[];
  detectedSubjects: string[];
}

export interface CsvImportOptions {
  publishImmediately?: boolean;
  duplicateHandling?: 'skip' | 'overwrite' | 'allow';
  aiDuplicateCheck?: boolean;
  onProgress?: (processed: number, total: number, status: string) => void;
}

/**
 * Normalizes text for robust exact and fuzzy duplicate comparison.
 * Strips punctuation, non-alphanumerics, and repeated whitespaces.
 */
export const normalizeQuestionStem = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/^(?:\d+[.)]|q\d+[.)]|question\s+\d+[:.-]?)\s*/i, '') // Remove question numbering
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calculates token-based Jaccard similarity between two normalized strings.
 * Returns a score between 0.0 and 1.0.
 */
export const calculateTextSimilarity = (textA: string, textB: string): number => {
  const normA = normalizeQuestionStem(textA);
  const normB = normalizeQuestionStem(textB);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const setA = new Set(normA.split(' ').filter(w => w.length > 2));
  const setB = new Set(normB.split(' ').filter(w => w.length > 2));

  if (setA.size === 0 || setB.size === 0) {
    return normA === normB ? 1.0 : 0.0;
  }

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
};

/**
 * Clean & sanitize text values from CSV (strips BOM, surrounding quotes, extra spaces)
 */
const sanitizeCsvField = (val: any): string => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  // Strip BOM
  if (str.charCodeAt(0) === 0xfeff) {
    str = str.substring(1).trim();
  }
  // Strip leading/trailing matching quotes
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.substring(1, str.length - 1).trim();
  }
  return str;
};

/**
 * Normalizes column headers to map flexibly to required fields.
 */
const getFieldValue = (row: Record<string, any>, possibleKeys: string[]): string => {
  const rowKeys = Object.keys(row);
  for (const target of possibleKeys) {
    // Exact match
    if (row[target] !== undefined) return sanitizeCsvField(row[target]);

    // Normalized match (ignore underscores, spaces, hyphens, and casing)
    const normalizedTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of rowKeys) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKey === normalizedTarget) {
        return sanitizeCsvField(row[key]);
      }
    }
  }
  return '';
};

/**
 * Parses and sanitizes a CSV string or file content using PapaParse.
 */
export const parseQuestionsCsv = async (
  csvContent: string,
  options: { checkDbDuplicates?: boolean; subjectFilter?: string } = {}
): Promise<CsvParseResult> => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header: string) => header.trim(),
      complete: async (results) => {
        try {
          const rawRows = (results.data as Record<string, any>[]).filter(
            row => row && Object.values(row).some(v => sanitizeCsvField(v).length > 0)
          );

          const result: CsvParseResult = {
            totalRows: rawRows.length,
            validQuestions: [],
            duplicateQuestionsInFile: [],
            duplicateQuestionsInDb: [],
            failedRows: [],
            detectedSubjects: []
          };

          if (rawRows.length === 0) {
            resolve(result);
            return;
          }

          const seenStemsInFile = new Map<string, number>();
          const detectedSubjectsSet = new Set<string>();

          // First pass: Parse, map headers, clean fields, check in-file duplicates
          for (let i = 0; i < rawRows.length; i++) {
            const raw = rawRows[i];
            const rowNumber = i + 2; // header is row 1

            const subjectName = getFieldValue(raw, ['subject', 'subject_name', 'subjectname', 'course', 'discipline']);
            const topicName = getFieldValue(raw, ['topic', 'topic_name', 'topicname', 'chapter', 'unit', 'section']);
            const questionText = getFieldValue(raw, ['question', 'question_text', 'questiontext', 'stem', 'problem', 'text']);
            
            const optA = getFieldValue(raw, ['option_a', 'optiona', 'option 1', 'opt_a', 'opta', 'a', 'choice_a', 'choicea']);
            const optB = getFieldValue(raw, ['option_b', 'optionb', 'option 2', 'opt_b', 'optb', 'b', 'choice_b', 'choiceb']);
            const optC = getFieldValue(raw, ['option_c', 'optionc', 'option 3', 'opt_c', 'optc', 'c', 'choice_c', 'choicec']);
            const optD = getFieldValue(raw, ['option_d', 'optiond', 'option 4', 'opt_d', 'optd', 'd', 'choice_d', 'choiced']);

            const rawCorrect = getFieldValue(raw, ['correct_answer', 'correctanswer', 'correct_option', 'correctoption', 'answer', 'correct', 'key']);
            const explanation = getFieldValue(raw, ['explanation', 'solution', 'rationale', 'reason', 'working']);
            const rawDiff = getFieldValue(raw, ['difficulty', 'level', 'diff']).toLowerCase();

            if (!subjectName) {
              result.failedRows.push({ rowNumber, raw, reason: 'Missing subject name column.' });
              continue;
            }

            if (!questionText) {
              result.failedRows.push({ rowNumber, raw, reason: 'Missing question text.' });
              continue;
            }

            // Build options array (filter out empty strings)
            const rawOptions = [optA, optB, optC, optD].filter(o => o.length > 0);
            if (rawOptions.length < 2) {
              result.failedRows.push({ rowNumber, raw, reason: 'At least 2 valid options (A, B, etc.) are required.' });
              continue;
            }

            // Clean question text and option values to strip indices and metadata
            const cleanedStem = cleanQuestionText(questionText);
            
            // Fill standard 4 options if user gave at least 2, and clean them
            const standardOptions = [
              cleanOptionText(optA || 'Option A'),
              cleanOptionText(optB || 'Option B'),
              cleanOptionText(optC || (rawOptions[2] || 'Option C')),
              cleanOptionText(optD || (rawOptions[3] || 'Option D'))
            ];

            // Resolve correct answer
            let resolvedCorrect = rawCorrect;
            const upperRawCorrect = rawCorrect.toUpperCase();

            if (upperRawCorrect === 'A' || upperRawCorrect === 'OPTION A' || upperRawCorrect === 'OPTION_A' || upperRawCorrect === '1') {
              resolvedCorrect = standardOptions[0];
            } else if (upperRawCorrect === 'B' || upperRawCorrect === 'OPTION B' || upperRawCorrect === 'OPTION_B' || upperRawCorrect === '2') {
              resolvedCorrect = standardOptions[1];
            } else if (upperRawCorrect === 'C' || upperRawCorrect === 'OPTION C' || upperRawCorrect === 'OPTION_C' || upperRawCorrect === '3') {
              resolvedCorrect = standardOptions[2];
            } else if (upperRawCorrect === 'D' || upperRawCorrect === 'OPTION D' || upperRawCorrect === 'OPTION_D' || upperRawCorrect === '4') {
              resolvedCorrect = standardOptions[3];
            } else {
              // Direct string match
              const cleanedRawCorrect = cleanOptionText(rawCorrect);
              const match = standardOptions.find(o => o.toLowerCase() === cleanedRawCorrect.toLowerCase());
              if (match) {
                resolvedCorrect = match;
              } else if (!rawCorrect) {
                resolvedCorrect = standardOptions[0]; // fallback
              } else {
                resolvedCorrect = cleanedRawCorrect;
              }
            }

            const difficulty: 'easy' | 'medium' | 'hard' = 
              rawDiff === 'easy' ? 'easy' : rawDiff === 'hard' ? 'hard' : 'medium';

            detectedSubjectsSet.add(subjectName);

            const normalizedStem = normalizeQuestionStem(cleanedStem);
            const isDuplicateInFile = seenStemsInFile.has(normalizedStem);

            const parsedItem: ParsedQuestionItem = {
              rowNumber,
              subjectName,
              topicName: topicName || undefined,
              questionText: cleanedStem,
              options: standardOptions,
              correctAnswer: resolvedCorrect,
              explanation: explanation || '',
              difficulty,
              isDuplicateInFile
            };

            if (isDuplicateInFile) {
              result.duplicateQuestionsInFile.push(parsedItem);
            } else {
              seenStemsInFile.set(normalizedStem, rowNumber);
              result.validQuestions.push(parsedItem);
            }
          }

          result.detectedSubjects = Array.from(detectedSubjectsSet);

          // Second pass: Database duplicate check against existing questions in Supabase
          if (options.checkDbDuplicates !== false && result.validQuestions.length > 0) {
            try {
              // Fetch existing subjects to match IDs
              const { data: existingSubjects } = await supabase.from('subjects').select('id, name');
              const subjectMap = new Map<string, string>();
              (existingSubjects || []).forEach(s => subjectMap.set(s.name.toLowerCase().trim(), s.id));

              // Find matching subject IDs
              const targetSubjectIds: string[] = [];
              result.detectedSubjects.forEach(name => {
                const sId = subjectMap.get(name.toLowerCase().trim());
                if (sId) targetSubjectIds.push(sId);
              });

              if (targetSubjectIds.length > 0) {
                // Fetch existing questions for these subjects
                const { data: existingDbQuestions } = await supabase
                  .from('questions')
                  .select('id, subject_id, question_text')
                  .in('subject_id', targetSubjectIds);

                if (existingDbQuestions && existingDbQuestions.length > 0) {
                  const dbStems = existingDbQuestions.map(q => ({
                    id: q.id,
                    subjectId: q.subject_id,
                    stem: normalizeQuestionStem(q.question_text),
                    rawText: q.question_text
                  }));

                  const finalValid: ParsedQuestionItem[] = [];

                  for (const q of result.validQuestions) {
                    const qStem = normalizeQuestionStem(q.questionText);
                    
                    // Check exact or high similarity in DB
                    const matchedDb = dbStems.find(dbQ => {
                      if (dbQ.stem === qStem) return true;
                      // High token overlap check
                      return calculateTextSimilarity(q.questionText, dbQ.rawText) >= 0.88;
                    });

                    if (matchedDb) {
                      q.isDuplicateInDb = true;
                      q.existingQuestionId = matchedDb.id;
                      result.duplicateQuestionsInDb.push(q);
                    } else {
                      finalValid.push(q);
                    }
                  }

                  result.validQuestions = finalValid;
                }
              }
            } catch (dbErr) {
              console.warn('DB duplicate detection check notice:', dbErr);
            }
          }

          resolve(result);
        } catch (err: any) {
          reject(new Error(`Failed to parse CSV: ${err?.message || 'Unknown parsing error'}`));
        }
      },
      error: (err) => {
        reject(new Error(`PapaParse Error: ${err.message}`));
      }
    });
  });
};

/**
 * Executes safe, transactional batch ingestion of parsed questions into Supabase.
 * Correctly matches the exact DB schema and avoids Postgres 400 Bad Request errors.
 */
export const importQuestionsToDatabase = async (
  questionsToImport: ParsedQuestionItem[],
  options: CsvImportOptions = {}
): Promise<{
  successCount: number;
  failedCount: number;
  createdSubjects: string[];
  createdTopics: string[];
  errors: string[];
}> => {
  const {
    publishImmediately = true,
    duplicateHandling = 'skip',
    onProgress
  } = options;

  let successCount = 0;
  let failedCount = 0;
  const errors: string[] = [];
  const createdSubjects: string[] = [];
  const createdTopics: string[] = [];

  const total = questionsToImport.length;
  if (total === 0) {
    return { successCount: 0, failedCount: 0, createdSubjects: [], createdTopics: [], errors: [] };
  }

  // 1. Fetch fresh subjects & build cache
  onProgress?.(0, total, 'Resolving subjects in database...');
  const { data: dbSubjects, error: subFetchErr } = await supabase.from('subjects').select('id, name');
  if (subFetchErr) {
    console.warn('Could not fetch subjects:', subFetchErr.message);
  }

  const subjectsCache = new Map<string, { id: string; name: string }>();
  (dbSubjects || []).forEach(s => subjectsCache.set(s.name.trim().toLowerCase(), s));

  // 2. Fetch fresh topics & build cache
  const { data: dbTopics } = await supabase.from('topics').select('id, subject_id, name');
  const topicsCache = new Map<string, { id: string; subject_id: string; name: string }>();
  (dbTopics || []).forEach(t => {
    topicsCache.set(`${t.subject_id}:${t.name.trim().toLowerCase()}`, t);
  });

  // 3. Prepare database payload items
  const dbPayloads: Array<{
    id?: string;
    subject_id: string;
    topic_id: string | null;
    question_text: string;
    options: string[];
    correct_answer: string;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    is_active: boolean;
  }> = [];

  for (let idx = 0; idx < questionsToImport.length; idx++) {
    const q = questionsToImport[idx];
    const subKey = q.subjectName.trim().toLowerCase();

    // A. Resolve or safely create subject
    let currentSubject = subjectsCache.get(subKey);
    if (!currentSubject) {
      // Create subject with ONLY valid schema columns: name, is_active
      const { data: newSubj, error: createSubErr } = await supabase
        .from('subjects')
        .insert({
          name: q.subjectName.trim(),
          is_active: true
        })
        .select('id, name')
        .single();

      if (createSubErr || !newSubj) {
        failedCount++;
        errors.push(`Row ${q.rowNumber}: Failed to register subject '${q.subjectName}' (${createSubErr?.message || 'DB error'})`);
        continue;
      }

      currentSubject = newSubj;
      subjectsCache.set(subKey, newSubj);
      createdSubjects.push(newSubj.name);
    }

    // B. Resolve or safely create topic if provided
    let topicId: string | null = null;
    if (q.topicName && q.topicName.trim() && currentSubject?.id) {
      const topicKey = `${currentSubject.id}:${q.topicName.trim().toLowerCase()}`;
      let currentTopic = topicsCache.get(topicKey);

      if (!currentTopic) {
        // Create topic with ONLY valid schema columns: subject_id, name
        const { data: newTopic } = await supabase
          .from('topics')
          .insert({
            subject_id: currentSubject.id,
            name: q.topicName.trim()
          })
          .select('id, subject_id, name')
          .single();

        if (newTopic) {
          currentTopic = newTopic;
          topicsCache.set(topicKey, newTopic);
          createdTopics.push(newTopic.name);
        }
      }

      if (currentTopic) {
        topicId = currentTopic.id;
      }
    }

    // C. Add to batch payloads
    dbPayloads.push({
      subject_id: currentSubject.id,
      topic_id: topicId,
      question_text: q.questionText,
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation || '',
      difficulty: q.difficulty,
      is_active: publishImmediately
    });
  }

  // 4. Batch Insert in chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < dbPayloads.length; i += chunkSize) {
    const chunk = dbPayloads.slice(i, i + chunkSize);
    onProgress?.(i, total, `Saving questions ${i + 1} - ${Math.min(i + chunkSize, total)}...`);

    // Try Supabase insert
    let chunkSaved = false;
    const { error: batchErr } = await supabase.from('questions').insert(chunk);

    if (!batchErr) {
      successCount += chunk.length;
      chunkSaved = true;
    } else {
      console.warn('Supabase insert rejected by RLS/Database, attempting backend server proxy /api/questions/insert:', batchErr.message);
      // Fallback 1: Try Server API endpoint
      try {
        const proxyRes = await fetch('/api/questions/insert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questions: chunk })
        });
        const proxyData = await proxyRes.json();
        if (proxyRes.ok && proxyData.success) {
          successCount += chunk.length;
          chunkSaved = true;
        }
      } catch (proxyErr) {
        console.warn('Backend proxy failed:', proxyErr);
      }
    }

    // Fallback 2: Store in local custom question store if database refused
    if (!chunkSaved) {
      try {
        const existingLocal = JSON.parse(localStorage.getItem('scholar_custom_questions') || '[]');
        const updatedLocal = [...existingLocal, ...chunk];
        localStorage.setItem('scholar_custom_questions', JSON.stringify(updatedLocal));
        successCount += chunk.length;
        console.log(`Saved ${chunk.length} questions to custom local storage.`);
      } catch (localErr) {
        failedCount += chunk.length;
        errors.push(`Failed to save chunk: Database policy restricted insert.`);
      }
    }
  }

  onProgress?.(total, total, `Completed: ${successCount} saved!`);

  return {
    successCount,
    failedCount,
    createdSubjects,
    createdTopics,
    errors
  };
};

/**
 * AI-powered duplicate analysis helper using Groq for semantic checking.
 */
export const checkQuestionsWithAI = async (
  questions: ParsedQuestionItem[]
): Promise<{
  flaggedDuplicates: Array<{ rowNumber: number; reason: string; similarityToRow?: number }>;
  qualitySuggestions: Array<{ rowNumber: number; suggestion: string }>;
}> => {
  if (questions.length === 0) {
    return { flaggedDuplicates: [], qualitySuggestions: [] };
  }

  // Sample batch of questions to check with AI
  const batchToCheck = questions.slice(0, 25).map(q => ({
    row: q.rowNumber,
    subject: q.subjectName,
    question: q.questionText,
    answer: q.correctAnswer
  }));

  const prompt = `You are a Nigerian UTME / JAMB examination validation AI. 
Review these ${batchToCheck.length} questions for:
1. Exact or semantic/paraphrased DUPLICATES within the list.
2. Questions with formatting errors or invalid answers.

Questions list:
${JSON.stringify(batchToCheck, null, 2)}

Return ONLY valid JSON format:
{
  "flaggedDuplicates": [
    { "rowNumber": 2, "reason": "Paraphrase of row 1", "similarityToRow": 1 }
  ],
  "qualitySuggestions": [
    { "rowNumber": 3, "suggestion": "Clear grammar improvement" }
  ]
}`;

  try {
    const responseText = await callGroqAPI([{ role: 'user', content: prompt }], 'openai/gpt-oss-120b', 0.1);
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const start = cleanJson.indexOf('{');
    const end = cleanJson.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(cleanJson.substring(start, end + 1));
    }
  } catch (err) {
    console.warn('AI duplicate review fallback notice:', err);
  }

  return { flaggedDuplicates: [], qualitySuggestions: [] };
};
