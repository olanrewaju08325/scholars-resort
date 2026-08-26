/**
 * ContentNormalizer Utility
 * Strips all question indices, external exam prefixes, provider tags, HTML artifacts,
 * and metadata noise from incoming question streams.
 * Ensures every item displayed is properly branded as native Scholars Resort CBT Bank content.
 */

import { SafeStringParser } from './SafeStringParser';

export interface NormalizedOption {
  id: string; // e.g., 'A', 'B', 'C', 'D'
  text: string;
}

export interface NormalizedQuestion {
  id: string;
  question_text: string;
  options: NormalizedOption[];
  correct_option: string; // e.g., 'A', 'B', 'C', 'D' or index
  explanation?: string;
  hint?: string;
  subject_id?: string;
  subject_name?: string;
  topic?: string;
  year?: number | string;
  image_url?: string;
  source: string;
  raw?: any;
}

export class ContentNormalizer {
  /**
   * Unescapes HTML entities in text safely
   */
  public static unescapeHtml(text: any): string {
    return SafeStringParser.unescapeHtml(text);
  }

  /**
   * Strips HTML tags and extraneous whitespace safely
   */
  public static stripHtmlAndWhitespace(text: any): string {
    return SafeStringParser.stripHtmlAndWhitespace(text);
  }

  /**
   * Cleans question text: removes leading question indices, exam prefixes, and provider tags
   */
  public static cleanQuestionText(text: string | null | undefined): string {
    if (!text) return '';

    let cleaned = this.stripHtmlAndWhitespace(text);

    // 1. Remove provider tags e.g. [Myschool], (Pass.ng), {TestDriller}, [Prep50], "Flashlearners - "
    cleaned = cleaned.replace(/^\[?\s*(?:myschool|pass\.?ng|testdriller|prep50|flashlearners|examice|scholar)\s*\]?\s*[\:\-\|]?\s*/i, '');

    // 2. Remove exam year & prefix tags e.g. "JAMB 2018 Q4: ", "UTME 2020 Question 12 - ", "WAEC 2019 #5: ", "[2021 UTME]"
    cleaned = cleaned.replace(/^(?:\[?\s*(?:jamb|utme|waec|neco|pq|scholars|cbt)\s*(?:\d{4})?\s*\]?\s*)?(?:question|q)?\s*\[?\d+\]?\s*[\.\:\)\-\|\s]+\s*/i, '');

    // 3. Remove leading question numbers e.g. "1. ", "15. ", "10) ", "100 - "
    cleaned = cleaned.replace(/^\d+[\.\:\)\-]\s*/, '');

    // 4. Remove standalone "Question 12: " or "Q12. "
    cleaned = cleaned.replace(/^(?:question|q)\s*\d+\s*[\.\:\-]\s*/i, '');

    cleaned = cleaned.trim();

    // Capitalize first letter if needed
    if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
  }

  /**
   * Cleans option text: removes option prefixes (e.g. "A. ", "(B) ", "c) ")
   */
  public static cleanOptionText(text: string | null | undefined): string {
    if (!text) return '';

    let cleaned = this.stripHtmlAndWhitespace(text);

    // Remove option letter prefixes like "A. ", "A) ", "a. ", "(A) ", "A: "
    cleaned = cleaned.replace(/^\(?\s*[a-eA-E1-5]\s*[\)\.\:\-]\s*/, '').trim();

    if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
  }

  /**
   * Cleans explanation or hint text
   */
  public static cleanExplanation(text: string | null | undefined): string {
    if (!text) return '';
    let cleaned = this.stripHtmlAndWhitespace(text);
    // Remove "Explanation: ", "Sol: ", "Solution: "
    cleaned = cleaned.replace(/^(?:explanation|solution|sol|note)\s*[\:\-]\s*/i, '').trim();
    if (cleaned.length > 0 && /^[a-z]/.test(cleaned)) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    return cleaned;
  }

  /**
   * Normalizes option inputs into a standard array of { id, text }
   */
  public static normalizeOptions(rawOptions: any): NormalizedOption[] {
    const letters = ['A', 'B', 'C', 'D', 'E'];

    if (!rawOptions) return [];

    // Case 1: Array of strings or objects
    if (Array.isArray(rawOptions)) {
      return rawOptions.map((opt, idx) => {
        const letter = letters[idx] || String.fromCharCode(65 + idx);
        if (typeof opt === 'string') {
          return { id: letter, text: this.cleanOptionText(opt) };
        } else if (typeof opt === 'object' && opt !== null) {
          const optKey = (opt.id || opt.key || opt.letter || letter).toString().toUpperCase();
          const optText = opt.text || opt.option || opt.value || Object.values(opt)[0] || '';
          return { id: optKey, text: this.cleanOptionText(String(optText)) };
        }
        return { id: letter, text: this.cleanOptionText(String(opt)) };
      });
    }

    // Case 2: Record / Object e.g. { a: "Option A", b: "Option B" } or { A: "...", B: "..." }
    if (typeof rawOptions === 'object' && rawOptions !== null) {
      const keys = Object.keys(rawOptions);
      return keys.map((key, idx) => {
        const letter = key.length === 1 ? key.toUpperCase() : letters[idx] || String.fromCharCode(65 + idx);
        const val = rawOptions[key];
        const optText = typeof val === 'object' && val !== null ? (val.text || val.value || '') : String(val);
        return { id: letter, text: this.cleanOptionText(optText) };
      });
    }

    return [];
  }

  /**
   * Normalizes correct_option field to standard uppercase letter ('A', 'B', 'C', 'D')
   */
  public static normalizeCorrectOption(rawCorrect: any, options: NormalizedOption[]): string {
    if (rawCorrect === null || rawCorrect === undefined) {
      return options.length > 0 ? options[0].id : 'A';
    }

    const str = String(rawCorrect).trim().toUpperCase();

    // Direct match e.g. 'A', 'B', 'C', 'D'
    if (/^[A-E]$/.test(str)) {
      return str;
    }

    // Index match e.g. 0 -> A, 1 -> B, 2 -> C
    if (/^\d+$/.test(str)) {
      const num = parseInt(str, 10);
      const letters = ['A', 'B', 'C', 'D', 'E'];
      if (num >= 0 && num < letters.length) {
        return letters[num];
      }
      if (num >= 1 && num <= letters.length) {
        return letters[num - 1];
      }
    }

    // Text match: see if rawCorrect matches one of the options text
    const cleanRaw = this.cleanOptionText(str);
    const matchedOpt = options.find(o => o.text.toUpperCase() === cleanRaw || o.id === str);
    if (matchedOpt) {
      return matchedOpt.id;
    }

    return 'A';
  }

  /**
   * Normalizes a single raw question object into a clean, Scholars Resort branded question
   */
  public static normalizeQuestion(rawQuestion: any): NormalizedQuestion {
    if (!rawQuestion) {
      return {
        id: crypto.randomUUID(),
        question_text: 'Sample UTME Question',
        options: [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
          { id: 'C', text: 'Option C' },
          { id: 'D', text: 'Option D' },
        ],
        correct_option: 'A',
        source: 'Scholars Resort Question Bank',
      };
    }

    const rawText = rawQuestion.question_text || rawQuestion.question || rawQuestion.text || rawQuestion.stem || '';
    const cleanText = this.cleanQuestionText(rawText);

    // Parse Options
    let rawOpts = rawQuestion.options || rawQuestion.choices;
    if (typeof rawOpts === 'string') {
      try {
        rawOpts = JSON.parse(rawOpts);
      } catch {
        rawOpts = [
          rawQuestion.option_a || rawQuestion.a,
          rawQuestion.option_b || rawQuestion.b,
          rawQuestion.option_c || rawQuestion.c,
          rawQuestion.option_d || rawQuestion.d,
        ].filter(Boolean);
      }
    }

    // If options still missing, fallback to explicit option_a, option_b, option_c, option_d fields
    if (!rawOpts || (Array.isArray(rawOpts) && rawOpts.length === 0)) {
      rawOpts = {
        A: rawQuestion.option_a || rawQuestion.a || rawQuestion.optionA || '',
        B: rawQuestion.option_b || rawQuestion.b || rawQuestion.optionB || '',
        C: rawQuestion.option_c || rawQuestion.c || rawQuestion.optionC || '',
        D: rawQuestion.option_d || rawQuestion.d || rawQuestion.optionD || '',
      };
    }

    const normalizedOpts = this.normalizeOptions(rawOpts);

    // Normalize Correct Option
    const rawCorrect = rawQuestion.correct_option ?? rawQuestion.correct_answer ?? rawQuestion.answer ?? rawQuestion.correctOption;
    const cleanCorrect = this.normalizeCorrectOption(rawCorrect, normalizedOpts);

    return {
      id: rawQuestion.id || crypto.randomUUID(),
      question_text: cleanText,
      options: normalizedOpts,
      correct_option: cleanCorrect,
      explanation: this.cleanExplanation(rawQuestion.explanation || rawQuestion.solution || rawQuestion.sol),
      hint: this.cleanExplanation(rawQuestion.hint || rawQuestion.tip),
      subject_id: rawQuestion.subject_id || rawQuestion.subjectId,
      subject_name: rawQuestion.subject_name || rawQuestion.subjectName || rawQuestion.subject,
      topic: rawQuestion.topic || rawQuestion.topic_name,
      year: rawQuestion.year || rawQuestion.exam_year,
      image_url: rawQuestion.image_url || rawQuestion.imageUrl || rawQuestion.image,
      source: 'Scholars Resort CBT Bank',
      raw: rawQuestion,
    };
  }

  /**
   * Normalizes an entire stream/array of raw question objects
   */
  public static normalizeStream(rawQuestions: any[]): NormalizedQuestion[] {
    if (!Array.isArray(rawQuestions)) return [];
    return rawQuestions.map(q => this.normalizeQuestion(q));
  }
}
