import { useState, useCallback } from 'react';
import Papa from 'papaparse';

export interface ValidatedQuestionRow {
  rowNumber: number;
  subjectName: string;
  topicName: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  examYear: number;
  raw: Record<string, any>;
}

export interface InvalidQuestionRow {
  rowNumber: number;
  reason: string;
  raw: Record<string, any>;
}

export interface CsvValidationResult {
  totalRows: number;
  validRows: ValidatedQuestionRow[];
  invalidRows: InvalidQuestionRow[];
  detectedSubjects: string[];
}

const sanitizeField = (val: any): string => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.charCodeAt(0) === 0xfeff) str = str.substring(1).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.substring(1, str.length - 1).trim();
  }
  return str;
};

const getFlexibleFieldValue = (row: Record<string, any>, possibleKeys: string[]): string => {
  const rowKeys = Object.keys(row);
  for (const target of possibleKeys) {
    if (row[target] !== undefined) return sanitizeField(row[target]);
    const normTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of rowKeys) {
      const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normKey === normTarget) {
        return sanitizeField(row[key]);
      }
    }
  }
  return '';
};

export const useCsvValidation = () => {
  const [isValidating, setIsValidating] = useState(false);

  const validateCsvContent = useCallback((csvText: string): CsvValidationResult => {
    setIsValidating(true);
    
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h: string) => h.trim()
    });

    const rawData = (parsed.data as Record<string, any>[]).filter(
      r => r && Object.values(r).some(v => sanitizeField(v).length > 0)
    );

    const validRows: ValidatedQuestionRow[] = [];
    const invalidRows: InvalidQuestionRow[] = [];
    const subjectsSet = new Set<string>();

    rawData.forEach((row, idx) => {
      const rowNum = idx + 2;

      const subjectName = getFlexibleFieldValue(row, ['subject', 'subject_name', 'subjectname', 'course']);
      const topicName = getFlexibleFieldValue(row, ['topic', 'topic_name', 'topicname', 'section', 'unit']);
      const questionText = getFlexibleFieldValue(row, ['question', 'question_text', 'questiontext', 'stem']);
      const optA = getFlexibleFieldValue(row, ['option_a', 'optiona', 'a', 'opt_a', 'choice_a']);
      const optB = getFlexibleFieldValue(row, ['option_b', 'optionb', 'b', 'opt_b', 'choice_b']);
      const optC = getFlexibleFieldValue(row, ['option_c', 'optionc', 'c', 'opt_c', 'choice_c']);
      const optD = getFlexibleFieldValue(row, ['option_d', 'optiond', 'd', 'opt_d', 'choice_d']);
      const correctAnswer = getFlexibleFieldValue(row, ['correct_answer', 'correctanswer', 'answer', 'key']);
      const explanation = getFlexibleFieldValue(row, ['explanation', 'solution', 'rationale']);
      const difficultyRaw = getFlexibleFieldValue(row, ['difficulty', 'level']).toLowerCase();
      const yearRaw = getFlexibleFieldValue(row, ['exam_year', 'year', 'examyear']);

      const missingFields: string[] = [];
      if (!subjectName) missingFields.push('subject');
      if (!questionText) missingFields.push('question');
      if (!optA) missingFields.push('option_a');
      if (!optB) missingFields.push('option_b');
      if (!correctAnswer) missingFields.push('correct_answer');

      if (missingFields.length > 0) {
        invalidRows.push({
          rowNumber: rowNum,
          reason: `Missing required field(s): ${missingFields.join(', ')}`,
          raw: row
        });
        return;
      }

      const options = [optA, optB];
      if (optC) options.push(optC);
      if (optD) options.push(optD);

      const difficulty: 'easy' | 'medium' | 'hard' = 
        difficultyRaw === 'easy' ? 'easy' : difficultyRaw === 'hard' ? 'hard' : 'medium';
      
      const examYear = parseInt(yearRaw, 10) || new Date().getFullYear();

      subjectsSet.add(subjectName);

      validRows.push({
        rowNumber: rowNum,
        subjectName,
        topicName: topicName || 'General Concepts',
        questionText,
        options,
        correctAnswer,
        explanation,
        difficulty,
        examYear,
        raw: row
      });
    });

    setIsValidating(false);

    return {
      totalRows: rawData.length,
      validRows,
      invalidRows,
      detectedSubjects: Array.from(subjectsSet)
    };
  }, []);

  return {
    isValidating,
    validateCsvContent
  };
};
