import { supabase } from '@/lib/supabase';
import { normalizeQuestionStem } from '@/lib/csvQuestionParser';

export interface BulkDiagnosticReport {
  timestamp: string;
  totalQuestionsInDb: number;
  duplicateStemsCount: number;
  missingMandatoryFieldsCount: number;
  status: 'healthy' | 'warning' | 'critical';
  recommendations: string[];
  sampleDefects: Array<{ id?: string; question_text: string; issue: string }>;
}

/**
 * Diagnostic Script: Verifies questions table integrity, unique key constraints,
 * and mandatory field compliance for bulk uploads.
 */
export async function runBulkUploadDiagnostics(): Promise<BulkDiagnosticReport> {
  const recommendations: string[] = [];
  const sampleDefects: Array<{ id?: string; question_text: string; issue: string }> = [];

  try {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('id, question_text, subject_id, topic_id, options, correct_answer, explanation, year, difficulty');

    if (error) {
      return {
        timestamp: new Date().toISOString(),
        totalQuestionsInDb: 0,
        duplicateStemsCount: 0,
        missingMandatoryFieldsCount: 0,
        status: 'critical',
        recommendations: [`Database connection or RLS error querying questions: ${error.message}`],
        sampleDefects: []
      };
    }

    const allQuestions = questions || [];
    const stemMap = new Map<string, number>();
    let missingMandatoryCount = 0;
    let duplicateStemsCount = 0;

    for (const q of allQuestions) {
      // Check mandatory fields
      const hasSubject = Boolean(q.subject_id);
      const hasText = Boolean(q.question_text && q.question_text.trim().length > 0);
      const hasOptions = Boolean(q.options && (Array.isArray(q.options) ? q.options.length >= 2 : Object.keys(q.options).length >= 2));
      const hasAnswer = Boolean(q.correct_answer && q.correct_answer.trim().length > 0);

      if (!hasSubject || !hasText || !hasOptions || !hasAnswer) {
        missingMandatoryCount++;
        if (sampleDefects.length < 10) {
          sampleDefects.push({
            id: q.id,
            question_text: q.question_text || '(Missing Text)',
            issue: `Missing mandatory fields: ${!hasSubject ? 'Subject ' : ''}${!hasText ? 'Text ' : ''}${!hasOptions ? 'Options ' : ''}${!hasAnswer ? 'Answer' : ''}`
          });
        }
      }

      // Check unique normalized stem
      if (hasText) {
        const stem = normalizeQuestionStem(q.question_text);
        const count = stemMap.get(stem) || 0;
        if (count > 0) {
          duplicateStemsCount++;
          if (sampleDefects.length < 10) {
            sampleDefects.push({
              id: q.id,
              question_text: q.question_text,
              issue: 'Duplicate question stem detected in database.'
            });
          }
        }
        stemMap.set(stem, count + 1);
      }
    }

    if (missingMandatoryCount > 0) {
      recommendations.push(`Found ${missingMandatoryCount} questions missing mandatory fields (subject, text, options, or correct answer). Run cleanup or re-upload with complete CSV format.`);
    }

    if (duplicateStemsCount > 0) {
      recommendations.push(`Found ${duplicateStemsCount} duplicate question stems in the database. Use the 'Update Existing & Enrich' uploader mode to sync without duplicating records.`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Questions table schema and records passed all integrity and mandatory field checks successfully.');
    }

    const status = missingMandatoryCount > 0 ? 'critical' : duplicateStemsCount > 0 ? 'warning' : 'healthy';

    return {
      timestamp: new Date().toISOString(),
      totalQuestionsInDb: allQuestions.length,
      duplicateStemsCount,
      missingMandatoryFieldsCount: missingMandatoryCount,
      status,
      recommendations,
      sampleDefects
    };
  } catch (err: any) {
    return {
      timestamp: new Date().toISOString(),
      totalQuestionsInDb: 0,
      duplicateStemsCount: 0,
      missingMandatoryFieldsCount: 0,
      status: 'critical',
      recommendations: [`Diagnostic execution failed: ${err.message}`],
      sampleDefects: []
    };
  }
}
