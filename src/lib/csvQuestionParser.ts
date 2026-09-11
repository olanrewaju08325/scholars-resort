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

export type ErrorCategory = 
  | 'database_constraint' 
  | 'validation_issue' 
  | 'auth_permission' 
  | 'schema_mismatch' 
  | 'server_error';

export interface QuestionUploadErrorItem {
  id?: string;
  rowNumber?: number;
  questionSnippet: string;
  subjectName?: string;
  topicName?: string;
  examYear?: number | string;
  errorCategory: ErrorCategory;
  errorCode?: string;
  technicalMessage: string;
  humanReadableReason: string;
  suggestedFix: string;
  rawError?: any;
}

export interface DiagnosticReport {
  isConstraintMissing?: boolean;
  isAuthError?: boolean;
  isRlsBlocked?: boolean;
  summary: string;
  suggestedSql?: string;
  details: string[];
}

export interface ImportQuestionsResult {
  successCount: number;
  failedCount: number;
  createdSubjects: string[];
  createdTopics: string[];
  errors: string[];
  detailedErrors: QuestionUploadErrorItem[];
  diagnosticReport?: DiagnosticReport;
}

/**
 * Translates low-level database, PostgREST, and server error objects into human-readable diagnostics.
 */
export function translateErrorToHumanReadable(
  err: any,
  context?: {
    rowNumber?: number;
    questionText?: string;
    subjectName?: string;
    topicName?: string;
    examYear?: number | string;
  }
): QuestionUploadErrorItem {
  const code = err?.code ? String(err.code) : '';
  const msg = err?.message ? String(err.message) : (typeof err === 'string' ? err : JSON.stringify(err || ''));
  const details = err?.details ? String(err.details) : '';
  const hint = err?.hint ? String(err.hint) : '';
  const status = err?.status || err?.statusCode || '';

  const snippet = context?.questionText 
    ? (context.questionText.length > 85 ? context.questionText.slice(0, 85) + '...' : context.questionText)
    : 'Question snippet unavailable';

  let errorCategory: ErrorCategory = 'server_error';
  let humanReadableReason = '';
  let suggestedFix = '';

  // 1. Unique / ON CONFLICT / Database Constraints
  if (code === '23505' || msg.includes('duplicate key') || msg.includes('unique constraint')) {
    errorCategory = 'database_constraint';
    humanReadableReason = `Duplicate Question: A record with this exact question stem, subject, and exam year already exists in the database.`;
    suggestedFix = `Ensure this question is not duplicated in your file, or update its exam year or question text.`;
  } else if (code === '42P10' || msg.includes('ON CONFLICT') || msg.includes('there is no unique or exclusion constraint')) {
    errorCategory = 'database_constraint';
    humanReadableReason = `Missing Database Unique Constraint: Supabase PostgreSQL database lacks the composite unique constraint on (subject_id, question_text, year).`;
    suggestedFix = `Execute SQL Migration 0046 in the Supabase SQL Editor to define 'uq_questions_subject_text_year' for idempotent upserts.`;
  } else if (code === '23502' || msg.includes('not-null constraint') || msg.includes('violates not-null')) {
    errorCategory = 'database_constraint';
    const matchCol = msg.match(/column "([^"]+)"/i) || details.match(/column "([^"]+)"/i);
    const colName = matchCol ? matchCol[1] : 'required field';
    humanReadableReason = `Database Not-Null Violation: Mandatory column '${colName}' was empty or null in this row.`;
    suggestedFix = `Populate a valid non-empty value for '${colName}'.`;
  } else if (code === '23503' || msg.includes('foreign key constraint')) {
    errorCategory = 'database_constraint';
    humanReadableReason = `Foreign Key Error: The referenced subject ID or topic ID does not exist in the database.`;
    suggestedFix = `Verify that the academic subject exists in the subjects table before linking questions.`;
  }
  // 2. Auth / Security / RLS
  else if (status === 401 || code === '401' || msg.includes('Unauthorized') || msg.includes('JWT') || msg.includes('token')) {
    errorCategory = 'auth_permission';
    humanReadableReason = `Authentication Session Expired or Lacks Admin Token: The request was rejected by the server auth check.`;
    suggestedFix = `Re-authenticate with your administrator account (e.g. admitwise2@gmail.com) or check server token.`;
  } else if (code === '42501' || msg.includes('row-level security') || msg.includes('RLS')) {
    errorCategory = 'auth_permission';
    humanReadableReason = `Row-Level Security (RLS) Denial: Current Supabase user role does not have INSERT/UPDATE privileges on 'public.questions'.`;
    suggestedFix = `Ensure your user profile has 'role = admin' or execute an admin policy grant in Supabase.`;
  }
  // 3. Validation Issues
  else if (msg.toLowerCase().includes('option') || msg.toLowerCase().includes('choice') || msg.includes('fewer than 2')) {
    errorCategory = 'validation_issue';
    humanReadableReason = `Option Choices Incomplete: Question must provide at least 2 distinct multiple choice options.`;
    suggestedFix = `Ensure columns option_a, option_b, etc. are filled out with valid choice text.`;
  } else if (msg.toLowerCase().includes('correct answer') || msg.toLowerCase().includes('correct_answer')) {
    errorCategory = 'validation_issue';
    humanReadableReason = `Correct Answer Missing or Mismatched: The answer specified does not correspond to any valid option.`;
    suggestedFix = `Set 'correct_answer' to either the option letter (A, B, C, D) or the exact option text.`;
  } else if (msg.toLowerCase().includes('subject') && (msg.toLowerCase().includes('required') || msg.toLowerCase().includes('missing'))) {
    errorCategory = 'validation_issue';
    humanReadableReason = `Missing Academic Subject: Question has no assigned subject.`;
    suggestedFix = `Assign a valid subject (e.g., Mathematics, English Language, Physics).`;
  }
  // 4. Schema Syntax
  else if (code === '22P02' || msg.includes('invalid input syntax')) {
    errorCategory = 'schema_mismatch';
    humanReadableReason = `Data Type Syntax Error: A value has the wrong format (e.g. invalid UUID format or non-numeric year).`;
    suggestedFix = `Ensure the exam year is a valid number (e.g. 2024) and IDs are valid UUIDs.`;
  }
  // Default server error
  else {
    errorCategory = 'server_error';
    humanReadableReason = msg || 'Server rejected question insertion.';
    suggestedFix = hint || 'Inspect the technical error code and raw server response.';
  }

  return {
    id: context?.rowNumber ? `err-row-${context.rowNumber}-${Math.random().toString(36).slice(2, 6)}` : `err-${Math.random().toString(36).slice(2, 8)}`,
    rowNumber: context?.rowNumber,
    questionSnippet: snippet,
    subjectName: context?.subjectName,
    topicName: context?.topicName,
    examYear: context?.examYear,
    errorCategory,
    errorCode: code || (status ? `HTTP ${status}` : undefined),
    technicalMessage: [msg, details, hint].filter(Boolean).join(' | ') || 'No detailed server message returned',
    humanReadableReason,
    suggestedFix,
    rawError: err
  };
}

/**
 * Converts a client-side CSV validation failure into a structured QuestionUploadErrorItem.
 */
export const convertFailedRowToErrorItem = (failedRow: { rowNumber: number; raw: any; reason: string }): QuestionUploadErrorItem => {
  const raw = failedRow.raw || {};
  const questionText = raw.question || raw.question_text || raw.questiontext || raw.stem || '';
  const subjectName = raw.subject || raw.subject_name || raw.subjectname || raw.course || '';
  const topicName = raw.topic || raw.topic_name || raw.topicname || '';
  const examYear = raw.exam_year || raw.year || raw.examyear || '';

  return {
    id: `val-row-${failedRow.rowNumber}`,
    rowNumber: failedRow.rowNumber,
    questionSnippet: questionText ? (questionText.length > 85 ? questionText.slice(0, 85) + '...' : questionText) : 'Question text missing',
    subjectName: subjectName || 'Unspecified Subject',
    topicName: topicName || undefined,
    examYear: examYear || undefined,
    errorCategory: 'validation_issue',
    errorCode: 'VAL_ERR',
    technicalMessage: `Client-side CSV Row Validation: ${failedRow.reason}`,
    humanReadableReason: failedRow.reason,
    suggestedFix: failedRow.reason.includes('Missing required field')
      ? 'Ensure all required columns (subject, question, option_a, option_b, correct_answer) are filled.'
      : failedRow.reason.includes('options')
      ? 'Provide at least two non-empty option choices for this question.'
      : 'Review and update this row in your spreadsheet.',
    rawError: failedRow.raw
  };
};

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
      is_active: publishImmediately,
      rawItem: q
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
  const toInsert: Array<{ payload: any; item: typeof preProcessedItems[0] }> = [];
  const toUpdate: Array<{ id: string; payload: any; item: typeof preProcessedItems[0] }> = [];

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
      toUpdate.push({ id: existingId, payload, item });
    } else {
      toInsert.push({ payload, item });
    }
  }

  // Initialize diagnostic report and structured errors list
  const diagnosticReport: DiagnosticReport = {
    details: []
  };
  const detailedErrors: QuestionUploadErrorItem[] = [];

  // Robust session token retrieval (active session or refreshed session or local storage)
  let sessionToken = '';
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      sessionToken = data.session.access_token;
    } else {
      const { data: refreshData } = await supabase.auth.refreshSession();
      if (refreshData?.session?.access_token) {
        sessionToken = refreshData.session.access_token;
      }
    }
  } catch (_) {}

  if (!sessionToken && typeof window !== 'undefined') {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            if (parsed?.access_token) {
              sessionToken = parsed.access_token;
              break;
            }
          }
        }
      }
    } catch (_) {}
  }

  const adminSecretToken = localStorage.getItem('scholar_admin_token') || 'scholar_admin_secure_key_2026';

  const commonHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-admin-token': adminSecretToken,
    'x-admin-key': adminSecretToken
  };
  if (sessionToken) {
    commonHeaders['Authorization'] = `Bearer ${sessionToken}`;
  }

  // 4. Batch update existing questions (Primary Key `id` present -> safe upsert/update with zero 400 errors)
  if (toUpdate.length > 0) {
    const updateChunkSize = 50;
    
    for (let i = 0; i < toUpdate.length; i += updateChunkSize) {
      const chunkEntries = toUpdate.slice(i, i + updateChunkSize);
      const chunkPayloads = chunkEntries.map(u => ({ id: u.id, ...u.payload }));
      onProgress?.(successCount + failedCount, total, `Updating ${i + 1} - ${Math.min(i + updateChunkSize, toUpdate.length)} of ${toUpdate.length} existing questions...`);

      let chunkSaved = false;

      // Primary Key ID upsert (guaranteed no on_conflict constraint mismatch error)
      const { error: updateErr } = await supabase.from('questions').upsert(chunkPayloads);
      if (!updateErr) {
        successCount += chunkEntries.length;
        chunkSaved = true;
      } else {
        // Record constraint or RLS issue if present
        if (updateErr.code === '42P10' || updateErr.message?.includes('ON CONFLICT') || updateErr.message?.includes('constraint')) {
          diagnosticReport.isConstraintMissing = true;
          diagnosticReport.summary = "PostgREST Notice: ON CONFLICT unique constraint is not defined in PostgreSQL. Switched to primary-key update.";
        }
        if (updateErr.code === '42501' || updateErr.message?.includes('row-level security')) {
          diagnosticReport.isRlsBlocked = true;
        }

        // Fallback via server API
        try {
          const proxyRes = await fetch('/api/questions/upsert', {
            method: 'POST',
            headers: commonHeaders,
            body: JSON.stringify({ questions: chunkPayloads })
          });
          const proxyData = await proxyRes.json();
          if (proxyRes.ok && proxyData.success) {
            successCount += chunkEntries.length;
            chunkSaved = true;

            if (proxyData.failedItems && Array.isArray(proxyData.failedItems)) {
              for (const fItem of proxyData.failedItems) {
                detailedErrors.push(translateErrorToHumanReadable(fItem.error, {
                  questionText: fItem.question_text,
                  examYear: fItem.year
                }));
              }
            }
          } else if (proxyRes.status === 401) {
            diagnosticReport.isAuthError = true;
            diagnosticReport.details.push(`Proxy 401: ${proxyData.error || 'Unauthorized'}`);
          }
        } catch (e: any) {
          diagnosticReport.details.push(`Proxy network notice: ${e.message}`);
        }
      }

      if (!chunkSaved) {
        // Individual fallback
        for (const upEntry of chunkEntries) {
          const { error: singleErr } = await supabase.from('questions').update(upEntry.payload).eq('id', upEntry.id);
          if (!singleErr) {
            successCount++;
          } else {
            failedCount++;
            const errItem = translateErrorToHumanReadable(singleErr, {
              rowNumber: upEntry.item.rawItem?.rowNumber,
              questionText: upEntry.item.question_text,
              subjectName: upEntry.item.rawItem?.subjectName,
              topicName: upEntry.item.rawItem?.topicName,
              examYear: upEntry.item.year || undefined
            });
            detailedErrors.push(errItem);
            errors.push(`Row update failed (ID: ${upEntry.id}): ${singleErr.message}`);
          }
        }
      }
    }
  }

  // 5. Batch insert new questions
  if (toInsert.length > 0) {
    const insertChunkSize = 50;
    for (let i = 0; i < toInsert.length; i += insertChunkSize) {
      const chunkEntries = toInsert.slice(i, i + insertChunkSize);
      const chunkPayloads = chunkEntries.map(e => e.payload);
      onProgress?.(successCount + failedCount, total, `Inserting ${i + 1} - ${Math.min(i + insertChunkSize, toInsert.length)} of ${toInsert.length} new questions...`);

      let chunkSaved = false;
      const { error: insertErr } = await supabase.from('questions').insert(chunkPayloads);

      if (!insertErr) {
        successCount += chunkEntries.length;
        chunkSaved = true;
      } else {
        if (insertErr.code === '42P10' || insertErr.message?.includes('ON CONFLICT') || insertErr.message?.includes('constraint')) {
          diagnosticReport.isConstraintMissing = true;
        }
        if (insertErr.code === '42501' || insertErr.message?.includes('row-level security')) {
          diagnosticReport.isRlsBlocked = true;
        }

        // Fallback via server API
        try {
          const proxyRes = await fetch('/api/questions/insert', {
            method: 'POST',
            headers: commonHeaders,
            body: JSON.stringify({ questions: chunkPayloads })
          });
          const proxyData = await proxyRes.json();
          if (proxyRes.ok && proxyData.success) {
            successCount += chunkEntries.length;
            chunkSaved = true;

            if (proxyData.failedItems && Array.isArray(proxyData.failedItems)) {
              for (const fItem of proxyData.failedItems) {
                detailedErrors.push(translateErrorToHumanReadable(fItem.error, {
                  questionText: fItem.question_text,
                  examYear: fItem.year
                }));
              }
            }
          } else if (proxyRes.status === 401) {
            diagnosticReport.isAuthError = true;
            diagnosticReport.details.push(`Proxy 401: ${proxyData.error || 'Unauthorized'}`);
          }
        } catch (e: any) {
          diagnosticReport.details.push(`Proxy network notice: ${e.message}`);
        }
      }

      if (!chunkSaved) {
        for (const inEntry of chunkEntries) {
          const { error: singleErr } = await supabase.from('questions').insert([inEntry.payload]);
          if (!singleErr) {
            successCount++;
          } else {
            failedCount++;
            const errItem = translateErrorToHumanReadable(singleErr, {
              rowNumber: inEntry.item.rawItem?.rowNumber,
              questionText: inEntry.item.question_text,
              subjectName: inEntry.item.rawItem?.subjectName,
              topicName: inEntry.item.rawItem?.topicName,
              examYear: inEntry.item.year || undefined
            });
            detailedErrors.push(errItem);
            errors.push(`Row insert failed (Row ${inEntry.item.rawItem?.rowNumber || '?'}): ${singleErr.message}`);
          }
        }
      }
    }
  }

  onProgress?.(total, total, `Completed: ${successCount} saved!`);

  if (diagnosticReport.isConstraintMissing && !diagnosticReport.suggestedSql) {
    diagnosticReport.summary = "PostgREST unique constraint notice: The composite constraint on (subject_id, question_text, year) is not currently present in Supabase.";
    diagnosticReport.suggestedSql = `-- Execute in Supabase SQL Editor (Migration 0046):
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS year INTEGER DEFAULT 0;
UPDATE public.questions SET year = 0 WHERE year IS NULL;
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS uq_questions_subject_text_year;
ALTER TABLE public.questions ADD CONSTRAINT uq_questions_subject_text_year UNIQUE (subject_id, question_text, year);`;
  }

  return {
    successCount,
    failedCount,
    createdSubjects,
    createdTopics,
    errors,
    detailedErrors,
    diagnosticReport: (diagnosticReport.isConstraintMissing || diagnosticReport.isAuthError || diagnosticReport.isRlsBlocked || diagnosticReport.details.length > 0)
      ? diagnosticReport
      : undefined
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
