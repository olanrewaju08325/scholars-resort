import { ContentNormalizer } from './ContentNormalizer';

export { ContentNormalizer };

export function cleanQuestionText(text: string | null | undefined): string {
  return ContentNormalizer.cleanQuestionText(text);
}

export function cleanOptionText(text: string | null | undefined): string {
  return ContentNormalizer.cleanOptionText(text);
}

/**
 * Universal, robust question answer correctness checker.
 * Handles comparison across all possible representations:
 * - Option letters ('A', 'B', 'C', 'D')
 * - Full option text
 * - Option objects ({ id: 'A', text: '...' })
 * - Direct option_a, option_b, option_c, option_d columns
 */
export function checkIsCorrect(userAnswer: string | undefined | null, q: any): boolean {
  if (!userAnswer || !q) return false;
  const rawUser = String(userAnswer).trim();
  const rawCorrect = String(q.correct_answer || q.correct_option || q.correctAnswer || '').trim();
  if (!rawCorrect) return false;

  // 1. Direct equality
  if (rawUser.toLowerCase() === rawCorrect.toLowerCase()) return true;

  // 2. Normalizing options
  let rawOptions: any[] = [];
  if (q.options) {
    if (typeof q.options === 'string') {
      try {
        rawOptions = JSON.parse(q.options);
      } catch {
        rawOptions = [];
      }
    } else if (Array.isArray(q.options)) {
      rawOptions = q.options;
    } else if (typeof q.options === 'object') {
      rawOptions = Object.values(q.options);
    }
  }

  if (rawOptions.length === 0) {
    rawOptions = [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean);
  }

  const mapped = rawOptions.map((opt: any, idx: number) => {
    const letter = String.fromCharCode(65 + idx); // 'A', 'B', 'C', 'D'
    const text = typeof opt === 'object' && opt !== null 
      ? (opt.text || opt.value || opt.id || '') 
      : String(opt || '');
    const clean = cleanOptionText(text).toLowerCase();
    const id = (typeof opt === 'object' && opt !== null && opt.id ? String(opt.id) : letter).toUpperCase();
    return { letter, id, text: text.trim().toLowerCase(), clean };
  });

  // Find user's selected option
  const userOpt = mapped.find(m => 
    String(m.id || '').toLowerCase() === String(rawUser).toLowerCase() || 
    String(m.letter || '').toLowerCase() === String(rawUser).toLowerCase() ||
    String(m.clean || '') === cleanOptionText(String(rawUser)).toLowerCase() ||
    String(m.text || '').toLowerCase() === String(rawUser).toLowerCase()
  );

  // Find correct option
  const correctOpt = mapped.find(m => 
    String(m.id || '').toLowerCase() === String(rawCorrect).toLowerCase() || 
    String(m.letter || '').toLowerCase() === String(rawCorrect).toLowerCase() ||
    String(m.clean || '') === cleanOptionText(String(rawCorrect)).toLowerCase() ||
    String(m.text || '').toLowerCase() === String(rawCorrect).toLowerCase()
  );

  if (userOpt && correctOpt) {
    return userOpt.letter === correctOpt.letter || userOpt.id === correctOpt.id;
  }

  if (/^[A-E]$/i.test(rawCorrect) && userOpt) {
    return userOpt.letter.toUpperCase() === rawCorrect.toUpperCase();
  }
  if (/^[A-E]$/i.test(rawUser) && correctOpt) {
    return correctOpt.letter.toUpperCase() === rawUser.toUpperCase();
  }

  return false;
}


