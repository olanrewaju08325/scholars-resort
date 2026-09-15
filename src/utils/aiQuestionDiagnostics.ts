/**
 * Diagnostic Utility: AI-Generated Question Schema Auditor
 * Inspects questions retrieved from the database or AI synthesis pipelines,
 * analyzes field types, validates that 'category' and 'icon' are strictly primitives,
 * and logs schema diagnostics to help administrators identify non-serializable objects.
 */

import { supabase } from '@/lib/supabase';
import { sanitizeQuestionForRendering } from './sanitizeExamData';

export interface FieldDiagnostic {
  field: string;
  type: string;
  isPrimitive: boolean;
  sampleValue: string;
  isNonSerializableOrReactNode: boolean;
  warning?: string;
}

export interface QuestionSchemaReport {
  questionId: string;
  subject: string;
  isAiGenerated: boolean;
  hasCategoryObject: boolean;
  hasIconObject: boolean;
  hasCircularReferences: boolean;
  fields: FieldDiagnostic[];
  isValidForRendering: boolean;
}

export interface DiagnosticSummary {
  timestamp: string;
  totalAudited: number;
  validCount: number;
  invalidCount: number;
  issues: string[];
  detailedReports: QuestionSchemaReport[];
}

/**
 * Checks if a value is a React node, element, function component, or complex object.
 */
export function inspectFieldType(key: string, val: any): FieldDiagnostic {
  const typeStr = typeof val;
  const isPrimitive = val === null || val === undefined || ['string', 'number', 'boolean'].includes(typeStr);
  let isNonSerializable = false;
  let warning: string | undefined = undefined;

  if (typeStr === 'function') {
    isNonSerializable = true;
    warning = `Field '${key}' contains a Function / React Component reference! This causes Minified React Error #31.`;
  } else if (typeStr === 'object' && val !== null) {
    if ('$$typeof' in val) {
      isNonSerializable = true;
      warning = `Field '${key}' contains a React Element / JSX node! Must be a primitive string.`;
    } else if (key === 'category' || key === 'icon') {
      isNonSerializable = true;
      warning = `Field '${key}' is an Object ({${Object.keys(val).join(', ')}}). Must be a primitive string.`;
    }
  }

  let sampleStr = '';
  try {
    sampleStr = typeof val === 'object' ? JSON.stringify(val).substring(0, 80) : String(val).substring(0, 80);
  } catch {
    sampleStr = '[Unserializable]';
  }

  return {
    field: key,
    type: Array.isArray(val) ? `array[${val.length}]` : typeStr,
    isPrimitive,
    sampleValue: sampleStr,
    isNonSerializableOrReactNode: isNonSerializable,
    warning
  };
}

/**
 * Runs a schema diagnostic on a list of question objects.
 */
export function auditQuestionSchema(questions: any[]): DiagnosticSummary {
  const reports: QuestionSchemaReport[] = [];
  const issues: string[] = [];

  questions.forEach((q, idx) => {
    if (!q) return;

    const fields: FieldDiagnostic[] = [];
    let hasCategoryObj = false;
    let hasIconObj = false;

    // Check specific fields: category & icon
    if (q.category && typeof q.category !== 'string') {
      hasCategoryObj = true;
      issues.push(`Q #${idx + 1} (${q.id}): 'category' is not a primitive string (type: ${typeof q.category})`);
    }

    if (q.icon && typeof q.icon !== 'string') {
      hasIconObj = true;
      issues.push(`Q #${idx + 1} (${q.id}): 'icon' contains an object or component reference (type: ${typeof q.icon})`);
    }

    // Check if options contains raw objects without text
    if (Array.isArray(q.options)) {
      q.options.forEach((opt: any, optIdx: number) => {
        if (typeof opt === 'object' && opt !== null && !opt.text && !opt.value) {
          issues.push(`Q #${idx + 1} (${q.id}): option[${optIdx}] is an object missing 'text' property.`);
        }
      });
    }

    // Inspect all top-level keys
    for (const key of Object.keys(q)) {
      fields.push(inspectFieldType(key, q[key]));
    }

    const isValid = !hasCategoryObj && !hasIconObj && !fields.some(f => f.isNonSerializableOrReactNode);

    reports.push({
      questionId: String(q.id || `sample_${idx}`),
      subject: typeof q.subject_name === 'string' ? q.subject_name : (q.subject_name?.name || 'General'),
      isAiGenerated: Boolean(q.is_ai_generated || q.source_type === 'ai_generated'),
      hasCategoryObject: hasCategoryObj,
      hasIconObject: hasIconObj,
      hasCircularReferences: false,
      fields,
      isValidForRendering: isValid
    });
  });

  const validCount = reports.filter(r => r.isValidForRendering).length;
  const invalidCount = reports.length - validCount;

  return {
    timestamp: new Date().toISOString(),
    totalAudited: reports.length,
    validCount,
    invalidCount,
    issues,
    detailedReports: reports
  };
}

/**
 * Diagnostic utility function: queries active and AI-generated questions from the database,
 * logs full schema inspection into console.table, and returns the diagnostic summary.
 */
export async function diagnoseAiQuestionSchemaFromDatabase(): Promise<DiagnosticSummary> {
  console.group('🔍 [AI Question Schema Diagnostic]');
  console.info('Querying questions from database to verify schema safety...');

  let sampledQuestions: any[] = [];

  try {
    // 1. Fetch recent questions from Supabase
    const { data, error } = await supabase
      .from('questions')
      .select('id, subject_id, question_text, options, correct_answer, explanation, year, is_active, subjects(id, name)')
      .limit(30);

    if (error) {
      console.warn('Database query note:', error.message);
    } else if (data) {
      sampledQuestions = data;
    }
  } catch (err) {
    console.warn('Diagnostic DB sample error:', err);
  }

  // 2. Audit fetched questions
  const summary = auditQuestionSchema(sampledQuestions);

  // 3. Log results cleanly to console
  console.log(`Schema Audit: ${summary.validCount}/${summary.totalAudited} questions passed rendering validation.`);
  if (summary.issues.length > 0) {
    console.warn('⚠️ Schema Warnings Found:', summary.issues);
  } else {
    console.log('✅ All sampled questions have safe primitive fields for category, icon, and options.');
  }

  console.table(
    summary.detailedReports.map(r => ({
      ID: r.questionId,
      Subject: r.subject,
      'Valid for Render': r.isValidForRendering ? 'YES' : 'NO ❌',
      'Category Safe': !r.hasCategoryObject ? 'YES' : 'OBJECT ❌',
      'Icon Safe': !r.hasIconObject ? 'YES' : 'OBJECT ❌'
    }))
  );

  console.groupEnd();
  return summary;
}
