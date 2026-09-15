/**
 * Exam Data Sanitization Engine
 * Strips functions, circular references, React nodes, component references (e.g. Lucide icons),
 * and nested metadata structures from question objects and exam sessions before they reach
 * React components, preventing Minified React Error #31 and related crashes.
 */

export interface PlainOption {
  id: string; // 'A', 'B', 'C', 'D'
  text: string;
}

export interface PlainQuestion {
  id: string;
  question_text: string;
  options: string[]; // Pure plain strings for safe JSX rendering
  raw_options?: PlainOption[]; // Structured options if needed
  correct_answer: string;
  correct_option: string;
  explanation?: string;
  hint?: string;
  subject_id?: string;
  subject_name: string;
  category?: string; // Strictly primitive string (e.g. 'sciences', 'compulsory')
  icon?: string; // Strictly primitive string icon name (e.g. 'book-open'), never a React Component
  topic_name?: string;
  topic?: string;
  year?: number | string;
  image_url?: string;
  is_ai_generated?: boolean;
  source_type?: string;
  [key: string]: any;
}

/**
 * Strips non-serializable properties (functions, symbols, DOM nodes, React elements)
 * and breaks circular references.
 */
export function stripNonSerializable<T = any>(val: any, seen: WeakSet<object> = new WeakSet()): T {
  if (val === null || val === undefined) return val;

  // Primitives
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return val as any;
  }

  // React element ($$typeof or _owner) or function/component reference
  if (typeof val === 'function') {
    return (val.displayName || val.name || '') as any;
  }

  if (typeof val === 'object') {
    // Detect React nodes/elements
    if ('$$typeof' in val || '_owner' in val) {
      if (typeof val.type === 'function') {
        return (val.type.displayName || val.type.name || '') as any;
      }
      return '' as any;
    }

    // Circular reference prevention
    if (seen.has(val)) {
      return '[Circular]' as any;
    }
    seen.add(val);

    if (Array.isArray(val)) {
      return val.map(item => stripNonSerializable(item, seen)) as any;
    }

    const plainObj: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      // Skip internal react/fiber props
      if (key.startsWith('__react') || key === '$$typeof' || key === '_owner') {
        continue;
      }
      try {
        const propVal = val[key];
        if (typeof propVal === 'function') {
          // Keep string representation if component name
          plainObj[key] = propVal.displayName || propVal.name || undefined;
        } else {
          plainObj[key] = stripNonSerializable(propVal, seen);
        }
      } catch {
        // Skip un-readable getters
      }
    }
    return plainObj as any;
  }

  return String(val) as any;
}

/**
 * Extracts a safe primitive string for subject name from any input format
 * (e.g. raw string, { id, name, aliases, category, icon }, or DB joined relation { name }).
 */
export function extractSafeSubjectName(input: any, fallback = 'Use of English'): string {
  if (!input) return fallback;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  if (typeof input === 'object') {
    if (typeof input.name === 'string' && input.name.trim().length > 0) {
      return input.name.trim();
    }
    if (typeof input.title === 'string' && input.title.trim().length > 0) {
      return input.title.trim();
    }
    if (typeof input.subject_name === 'string' && input.subject_name.trim().length > 0) {
      return input.subject_name.trim();
    }
    if (typeof input.id === 'string' && input.id.trim().length > 0) {
      return input.id.trim();
    }
  }
  return String(input || fallback);
}

/**
 * Normalizes question options into a guaranteed array of plain strings.
 * Handles strings, array of strings, array of option objects, and key-value records.
 */
export function extractSafeOptionStrings(rawOptions: any): string[] {
  if (!rawOptions) return [];

  let optionsArray: any[] = [];

  if (typeof rawOptions === 'string') {
    try {
      const parsed = JSON.parse(rawOptions);
      if (Array.isArray(parsed)) {
        optionsArray = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        optionsArray = Object.values(parsed);
      } else {
        optionsArray = [rawOptions];
      }
    } catch {
      optionsArray = [rawOptions];
    }
  } else if (Array.isArray(rawOptions)) {
    optionsArray = rawOptions;
  } else if (typeof rawOptions === 'object') {
    optionsArray = Object.values(rawOptions);
  }

  return optionsArray.map((opt: any) => {
    if (typeof opt === 'string') return opt.trim();
    if (typeof opt === 'number' || typeof opt === 'boolean') return String(opt);
    if (typeof opt === 'object' && opt !== null) {
      // If it's an option object like { label: 'A', text: '...' } or { id: 'A', text: '...' }
      if (typeof opt.text === 'string') return opt.text.trim();
      if (typeof opt.value === 'string') return opt.value.trim();
      if (typeof opt.label === 'string') return opt.label.trim();
      if (typeof opt.name === 'string') return opt.name.trim();
      // If it's another object format, serialize safely
      try {
        return JSON.stringify(opt);
      } catch {
        return '';
      }
    }
    return '';
  }).filter(text => typeof text === 'string');
}

/**
 * Universal question mapping function. Strips out functions, circular references,
 * and React nodes. Ensures category and icon are strings or undefined.
 */
export function sanitizeQuestionForRendering(rawQuestion: any): PlainQuestion {
  if (!rawQuestion) {
    return {
      id: crypto.randomUUID(),
      question_text: 'Question content unavailable',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: 'A',
      correct_option: 'A',
      subject_name: 'General'
    };
  }

  // 1. Safe ID
  const id = typeof rawQuestion.id === 'string' && rawQuestion.id.trim().length > 0
    ? rawQuestion.id.trim()
    : (typeof rawQuestion.id === 'number' ? String(rawQuestion.id) : crypto.randomUUID());

  // 2. Safe Question Text
  let questionText = '';
  const rawQText = rawQuestion.question_text ?? rawQuestion.question ?? rawQuestion.text ?? rawQuestion.stem ?? '';
  if (typeof rawQText === 'string') {
    questionText = rawQText;
  } else if (typeof rawQText === 'object' && rawQText !== null) {
    questionText = rawQText.text || rawQText.question_text || rawQText.content || '';
  } else {
    questionText = String(rawQText || '');
  }

  // 3. Safe Options Array (guaranteed string[])
  const rawOptionsSource = rawQuestion.options ?? rawQuestion.choices ?? [
    rawQuestion.option_a || rawQuestion.a,
    rawQuestion.option_b || rawQuestion.b,
    rawQuestion.option_c || rawQuestion.c,
    rawQuestion.option_d || rawQuestion.d
  ].filter(Boolean);

  const safeOptions = extractSafeOptionStrings(rawOptionsSource);

  // 4. Safe Correct Answer
  let rawCorrect = rawQuestion.correct_answer ?? rawQuestion.correct_option ?? rawQuestion.answer ?? rawQuestion.correctOption ?? 'A';
  if (typeof rawCorrect === 'object' && rawCorrect !== null) {
    rawCorrect = rawCorrect.id || rawCorrect.label || rawCorrect.value || 'A';
  }
  const correctAnswerStr = String(rawCorrect || 'A').trim().toUpperCase();

  // 5. Safe Subject Name
  const subjectName = extractSafeSubjectName(
    rawQuestion.subject_name || rawQuestion.subjectName || rawQuestion.subject || rawQuestion.subjects || rawQuestion.subject_id
  );

  // 6. Safe Category (ensures it is NEVER an object or component)
  let safeCategory: string | undefined = undefined;
  if (rawQuestion.category) {
    if (typeof rawQuestion.category === 'string') {
      safeCategory = rawQuestion.category;
    } else if (typeof rawQuestion.category === 'object') {
      safeCategory = rawQuestion.category.name || rawQuestion.category.title || rawQuestion.category.id || undefined;
    }
  }

  // 7. Safe Icon (ensures it is NEVER a React component or JSX node)
  let safeIcon: string | undefined = undefined;
  if (rawQuestion.icon) {
    if (typeof rawQuestion.icon === 'string') {
      safeIcon = rawQuestion.icon;
    } else if (typeof rawQuestion.icon === 'function') {
      safeIcon = rawQuestion.icon.displayName || rawQuestion.icon.name || 'book-open';
    } else if (typeof rawQuestion.icon === 'object' && rawQuestion.icon !== null) {
      safeIcon = rawQuestion.icon.name || 'book-open';
    }
  }

  // 8. Safe Explanation & Hint
  let safeExplanation: string | undefined = undefined;
  const rawExpl = rawQuestion.explanation ?? rawQuestion.solution ?? rawQuestion.sol ?? rawQuestion.rationale;
  if (typeof rawExpl === 'string' && rawExpl.trim().length > 0) {
    safeExplanation = rawExpl.trim();
  }

  let safeHint: string | undefined = undefined;
  const rawHint = rawQuestion.hint ?? rawQuestion.tip;
  if (typeof rawHint === 'string' && rawHint.trim().length > 0) {
    safeHint = rawHint.trim();
  }

  // 9. Safe Topic
  let safeTopic: string | undefined = undefined;
  const rawTopic = rawQuestion.topic_name ?? rawQuestion.topic;
  if (typeof rawTopic === 'string' && rawTopic.trim().length > 0) {
    safeTopic = rawTopic.trim();
  } else if (typeof rawTopic === 'object' && rawTopic !== null) {
    safeTopic = rawTopic.name || rawTopic.title || undefined;
  }

  return {
    id,
    question_text: questionText,
    options: safeOptions,
    correct_answer: correctAnswerStr,
    correct_option: correctAnswerStr,
    explanation: safeExplanation,
    hint: safeHint,
    subject_id: typeof rawQuestion.subject_id === 'string' ? rawQuestion.subject_id : undefined,
    subject_name: subjectName,
    category: safeCategory,
    icon: safeIcon,
    topic_name: safeTopic,
    topic: safeTopic,
    year: typeof rawQuestion.year === 'number' || typeof rawQuestion.year === 'string' ? rawQuestion.year : undefined,
    image_url: typeof rawQuestion.image_url === 'string' ? rawQuestion.image_url : undefined,
    is_ai_generated: Boolean(rawQuestion.is_ai_generated),
    source_type: typeof rawQuestion.source_type === 'string' ? rawQuestion.source_type : undefined
  };
}

/**
 * Sanitizes an array of questions in bulk before setting state.
 */
export function sanitizeQuestionList(questions: any[]): PlainQuestion[] {
  if (!Array.isArray(questions)) return [];
  return questions.map(q => sanitizeQuestionForRendering(q));
}
