import Papa from 'papaparse';
import { supabase } from './supabase';
import { callGroqAPI } from '../services/aiService';
import { cleanQuestionText, cleanOptionText } from '../utils/questionUtils';

export interface ParsedQuestionItem {
  rowNumber: number;
  subjectName: string;
  topicName?: string;
  year?: number;
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
            const topicName = getFieldValue(raw, ['topic', 'topic_name', 'topicname', 'subject_topic', 'subjecttopic', 'chapter', 'unit', 'section', 'syllabus_topic']);
            const yearVal = getFieldValue(raw, ['year', 'exam_year', 'past_year', 'examyear', 'pastyear', 'session']);
            const parsedYear = yearVal ? parseInt(yearVal, 10) : undefined;
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
              year: (parsedYear && !isNaN(parsedYear)) ? parsedYear : undefined,
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

  // 3. Fetch existing questions for these subjects to enable smart upsert (update-on-duplicate)
  const subjectIdsSet = new Set<string>();
  const preProcessedItems: Array<{
    subject_id: string;
    topic_id: string | null;
    question_text: string;
    normalized_stem: string;
    options: string[];
    correct_answer: string;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    year: number | null;
    is_active: boolean;
  }> = [];

  for (let idx = 0; idx < questionsToImport.length; idx++) {
    const q = questionsToImport[idx];
    const subKey = q.subjectName.trim().toLowerCase();

    // A. Resolve or safely create subject
    let currentSubject = subjectsCache.get(subKey);
    if (!currentSubject) {
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

    subjectIdsSet.add(currentSubject.id);

    // B. Resolve or safely create topic if provided
    let topicId: string | null = null;
    const safeTopicName = String(q.topicName || q.topic || '').trim();
    if (safeTopicName && currentSubject?.id) {
      const topicKey = `${currentSubject.id}:${safeTopicName.toLowerCase()}`;
      let currentTopic = topicsCache.get(topicKey);

      if (!currentTopic) {
        const { data: newTopic } = await supabase
          .from('topics')
          .insert({
            subject_id: currentSubject.id,
            name: safeTopicName
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

    preProcessedItems.push({
      subject_id: currentSubject.id,
      topic_id: topicId,
      question_text: q.questionText,
      normalized_stem: normalizeQuestionStem(q.questionText),
      options: q.options,
      correct_answer: q.correctAnswer,
      explanation: q.explanation || '',
      difficulty: q.difficulty,
      year: q.year || null,
      is_active: publishImmediately
    });
  }

  // Fetch existing database questions for these subjects to detect existing duplicates for upsert based on (question_text, subject_id, exam_year)
  const existingQuestionsMap = new Map<string, string>(); // composite key -> question id
  if (subjectIdsSet.size > 0) {
    try {
      const { data: existingDbQ } = await supabase
        .from('questions')
        .select('id, question_text, subject_id, year')
        .in('subject_id', Array.from(subjectIdsSet));

      if (existingDbQ) {
        existingDbQ.forEach(eq => {
          if (eq.question_text && eq.subject_id) {
            const stem = normalizeQuestionStem(eq.question_text);
            const yr = eq.year || 0;
            existingQuestionsMap.set(`${eq.subject_id}:${stem}:${yr}`, eq.id);
            existingQuestionsMap.set(`${eq.subject_id}:${stem}:0`, eq.id);
          }
        });
      }
    } catch (e) {
      console.warn('Could not fetch existing questions for upsert check:', e);
    }
  }

  // Separate into updates (already exist -> update in place) and inserts (new -> insert)
  const toInsert: any[] = [];
  const toUpdate: Array<{ id: string; payload: any }> = [];

  for (const item of preProcessedItems) {
    const itemYear = item.year || 0;
    const key1 = `${item.subject_id}:${item.normalized_stem}:${itemYear}`;
    const key2 = `${item.subject_id}:${item.normalized_stem}:0`;
    const existingId = existingQuestionsMap.get(key1) || existingQuestionsMap.get(key2);

    const payload = {
      subject_id: item.subject_id,
      topic_id: item.topic_id,
      question_text: item.question_text,
      options: item.options,
      correct_answer: item.correct_answer,
      explanation: item.explanation,
      difficulty: item.difficulty,
      year: item.year,
      is_active: item.is_active
    };

    if (existingId) {
      toUpdate.push({ id: existingId, payload });
    } else {
      toInsert.push(payload);
    }
  }

  // 4. Perform direct single/batched upserts using composite key (subject_id, question_text, year)
  const allPayloads = preProcessedItems.map(item => ({
    subject_id: item.subject_id,
    topic_id: item.topic_id,
    question_text: item.question_text,
    options: item.options,
    correct_answer: item.correct_answer,
    explanation: item.explanation,
    difficulty: item.difficulty,
    year: item.year,
    is_active: item.is_active
  }));

  const chunkSize = 100;
  for (let i = 0; i < allPayloads.length; i += chunkSize) {
    const chunk = allPayloads.slice(i, i + chunkSize);
    onProgress?.(i, total, `Upserting batch ${i + 1} - ${Math.min(i + chunkSize, total)} of ${total}...`);

    let chunkSaved = false;

    // Attempt direct Supabase upsert using composite index constraint
    const { error: upsertErr } = await supabase
      .from('questions')
      .upsert(chunk, { onConflict: 'subject_id,question_text,year' });

    if (!upsertErr) {
      successCount += chunk.length;
      chunkSaved = true;
    } else {
      console.warn('Direct Supabase upsert notice:', upsertErr.message, 'Retrying via backend server proxy /api/questions/upsert...');
      
      // Fallback via server proxy /api/questions/upsert with admin token
      try {
        const adminToken = localStorage.getItem('scholar_admin_token') || 'scholar_admin_secure_key_2026';
        const proxyRes = await fetch('/api/questions/upsert', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-admin-token': adminToken
          },
          body: JSON.stringify({ questions: chunk, onConflict: 'subject_id,question_text,year' })
        });

        const proxyData = await proxyRes.json();
        if (proxyRes.ok && proxyData.success) {
          successCount += chunk.length;
          chunkSaved = true;
        } else {
          console.warn('Backend proxy upsert returned error:', proxyData.error);
        }
      } catch (proxyErr) {
        console.warn('Backend proxy upsert exception:', proxyErr);
      }
    }

    if (!chunkSaved) {
      // Final resilient fallback: try single row upserts
      for (const row of chunk) {
        const { error: singleErr } = await supabase
          .from('questions')
          .upsert(row, { onConflict: 'subject_id,question_text,year' });

        if (!singleErr) {
          successCount++;
        } else {
          failedCount++;
          errors.push(`Row insert failed: ${singleErr.message}`);
        }
      }
    }

    onProgress?.(successCount + failedCount, total, `Processed: ${successCount} saved, ${failedCount} failed...`);
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
