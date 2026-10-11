import { supabase } from '@/lib/supabase';
import { DEFAULT_JAMB_BOOKS, type LiteratureBook, type NovelQuestion } from '@/data/jambNovelsData';
import { authFetch, getApiUrl } from '@/lib/apiAuth';

const STORAGE_KEY = 'scholars_resort_jamb_novels';
const SETTING_KEY = 'jamb_novels_db';
const LOCK_SETTING_KEY = 'literature_hub_locked';
const REC_TEXTS_CONFIG_KEY = 'recommended_texts_config';

const safeGetItem = (key: string): string | null => {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {}
  return null;
};

const safeSetItem = (key: string, value: string): void => {
  try {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {}
};

export interface RecommendedTextsExamConfig {
  includeNovelInEnglishMock: boolean;
  novelQuestionCountInEnglish: number;
  activeEnglishNovelId: string;
  includePrescribedTextsInLitMock: boolean;
  litPrescribedQuestionCount: number;
  activeLiteratureBookIds: string[];
  updatedAt?: string;
}

export const DEFAULT_RECOMMENDED_TEXTS_CONFIG: RecommendedTextsExamConfig = {
  includeNovelInEnglishMock: true,
  novelQuestionCountInEnglish: 10,
  activeEnglishNovelId: 'the-life-changer',
  includePrescribedTextsInLitMock: true,
  litPrescribedQuestionCount: 15,
  activeLiteratureBookIds: ['second-class-citizen', 'the-lion-and-the-jewel', 'look-back-in-anger', 'wuthering-heights']
};

export interface LiteratureLockStatus {
  isLocked: boolean;
  lockReason?: string;
  updatedAt?: string;
}

// Retrieve recommended texts CBT exam config
export const fetchRecommendedTextsExamConfig = async (): Promise<RecommendedTextsExamConfig> => {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', REC_TEXTS_CONFIG_KEY)
      .maybeSingle();

    if (!error && data?.setting_value) {
      const parsed = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
      if (parsed && typeof parsed === 'object') {
        const merged: RecommendedTextsExamConfig = {
          ...DEFAULT_RECOMMENDED_TEXTS_CONFIG,
          ...parsed,
          includeNovelInEnglishMock: parsed.includeNovelInEnglishMock !== false,
          includePrescribedTextsInLitMock: parsed.includePrescribedTextsInLitMock !== false,
          novelQuestionCountInEnglish: Number(parsed.novelQuestionCountInEnglish) || 10,
          litPrescribedQuestionCount: Number(parsed.litPrescribedQuestionCount) || 15
        };
        safeSetItem('sr_rec_texts_config', JSON.stringify(merged));
        return merged;
      }
    }
  } catch (err) {
    console.warn('Could not fetch recommended texts config from Supabase:', err);
  }

  try {
    const local = safeGetItem('sr_rec_texts_config');
    if (local) {
      const parsed = JSON.parse(local);
      return {
        ...DEFAULT_RECOMMENDED_TEXTS_CONFIG,
        ...parsed
      };
    }
  } catch {}

  return { ...DEFAULT_RECOMMENDED_TEXTS_CONFIG };
};

// Save recommended texts CBT exam config
export const saveRecommendedTextsExamConfig = async (config: RecommendedTextsExamConfig): Promise<{ success: boolean; error?: string }> => {
  const payload = {
    ...config,
    updatedAt: new Date().toISOString()
  };

  try {
    safeSetItem('sr_rec_texts_config', JSON.stringify(payload));

    await authFetch(getApiUrl(`/api/settings/${REC_TEXTS_CONFIG_KEY}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: payload })
    }).catch(() => {});

    await supabase.from('admin_settings').upsert({
      setting_key: REC_TEXTS_CONFIG_KEY,
      setting_value: payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'setting_key' });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('recommended_texts_config_updated'));
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error saving recommended texts exam config:', err);
    return { success: false, error: err.message };
  }
};

// Retrieve lock status for literature hub
export const fetchLiteratureLockStatus = async (): Promise<LiteratureLockStatus> => {
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', LOCK_SETTING_KEY)
      .maybeSingle();

    if (!error && data?.setting_value) {
      safeSetItem('literature_lock_status', JSON.stringify(data.setting_value));
      return data.setting_value as LiteratureLockStatus;
    }
  } catch (err) {
    console.warn('Could not fetch literature lock status from Supabase:', err);
  }

  try {
    const local = safeGetItem('literature_lock_status');
    if (local) {
      return JSON.parse(local);
    }
  } catch {}

  return { isLocked: false, lockReason: 'Official JAMB literature texts are currently being updated by the academic team.' };
};

// Save lock status
export const saveLiteratureLockStatus = async (isLocked: boolean, lockReason?: string): Promise<{ success: boolean }> => {
  const payload: LiteratureLockStatus = {
    isLocked,
    lockReason: lockReason || 'Official JAMB literature texts are currently being updated by the academic team.',
    updatedAt: new Date().toISOString()
  };

  safeSetItem('literature_lock_status', JSON.stringify(payload));

  try {
    await supabase.from('admin_settings').upsert({
      setting_key: LOCK_SETTING_KEY,
      setting_value: payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'setting_key' });
  } catch (err) {
    console.warn('Failed to persist lock status to Supabase:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('literature_updated'));
  }

  return { success: true };
};

// Upload textbook file to Supabase Storage with local fallback
export const uploadTextbookFileToSupabaseStorage = async (file: File): Promise<{ url: string; source: 'supabase' | 'local'; fileName: string }> => {
  const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  try {
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('textbooks')
      .upload(cleanFileName, file, { cacheControl: '3600', upsert: true });

    if (!uploadError && uploadData) {
      const { data: publicUrlData } = supabase
        .storage
        .from('textbooks')
        .getPublicUrl(cleanFileName);

      if (publicUrlData?.publicUrl) {
        return {
          url: publicUrlData.publicUrl,
          source: 'supabase',
          fileName: file.name
        };
      }
    }
  } catch (err) {
    console.warn('Supabase Storage upload fallback triggered:', err);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        url: e.target?.result as string,
        source: 'local',
        fileName: file.name
      });
    };
    reader.onerror = () => reject(new Error('Failed to read textbook file'));
    reader.readAsDataURL(file);
  });
};

// Retrieve all books (checks Supabase admin_settings, then localStorage, or returns DEFAULT_JAMB_BOOKS)
export const fetchJambBooks = async (): Promise<LiteratureBook[]> => {
  let loadedBooks: LiteratureBook[] = [];

  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', SETTING_KEY)
      .maybeSingle();

    if (!error && data?.setting_value) {
      const parsed = typeof data.setting_value === 'string' ? JSON.parse(data.setting_value) : data.setting_value;
      if (Array.isArray(parsed) && parsed.length > 0) {
        loadedBooks = parsed;
      }
    }
  } catch (err) {
    console.warn('Could not fetch novels from Supabase admin_settings:', err);
  }

  if (loadedBooks.length === 0) {
    try {
      const local = safeGetItem(STORAGE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedBooks = parsed;
        }
      }
    } catch (err) {
      console.warn('Could not parse local novel storage:', err);
    }
  }

  if (loadedBooks.length === 0) {
    return DEFAULT_JAMB_BOOKS;
  }

  // Ensure default canonical books (like The Life Changer) and their chapters are never missing
  const merged: LiteratureBook[] = [...loadedBooks];
  DEFAULT_JAMB_BOOKS.forEach(defBook => {
    const existingIndex = merged.findIndex(b => b.id === defBook.id);
    if (existingIndex === -1) {
      merged.push(defBook);
    } else if (!merged[existingIndex].chapters || merged[existingIndex].chapters.length === 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        chapters: defBook.chapters
      };
    }
  });

  safeSetItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
};

// Save books (updates Supabase and localStorage)
export const saveJambBooks = async (books: LiteratureBook[]): Promise<{ success: boolean; error?: string }> => {
  try {
    safeSetItem(STORAGE_KEY, JSON.stringify(books));

    await authFetch(getApiUrl(`/api/settings/${SETTING_KEY}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: books })
    }).catch(() => {});

    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        setting_key: SETTING_KEY,
        setting_value: books,
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('literature_updated'));
    }

    if (error) {
      console.warn('Failed to upsert novels to Supabase:', error.message);
      return { success: true, error: `Saved locally: ${error.message}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error saving novel data:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Extracts and formats questions from prescribed literature books into standardized CBT exam questions.
 * Handles both Use of English compulsory novel and Literature in English prescribed texts.
 */
export const getExamNovelQuestions = async (
  targetSubject: 'Use of English' | 'Literature in English',
  count: number = 10
): Promise<any[]> => {
  try {
    const books = await fetchJambBooks();
    const config = await fetchRecommendedTextsExamConfig();
    const pool: any[] = [];

    if (targetSubject === 'Use of English') {
      // Find active English novel
      const activeBook = books.find(b => b.id === config.activeEnglishNovelId) || 
                         books.find(b => b.genre.toLowerCase().includes('novel') || b.id === 'the-life-changer') ||
                         books[0];

      if (activeBook && Array.isArray(activeBook.chapters)) {
        activeBook.chapters.forEach(ch => {
          if (Array.isArray(ch.sampleQuestions)) {
            ch.sampleQuestions.forEach((q, idx) => {
              const passageContext = q.passage || ch.summary?.slice(0, 320) || `Based on the prescribed UTME novel "${activeBook.title}" by ${activeBook.author} (${ch.title}).`;
              
              pool.push({
                id: q.id || `novel_${activeBook.id}_ch${ch.id}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
                subject_id: 'ae78089e-b2de-4cae-ab8d-a58002454fcf',
                subject_name: 'Use of English',
                topic_name: `Prescribed Novel: ${activeBook.title}`,
                subtopic_name: ch.title,
                book_title: activeBook.title,
                chapter_title: ch.title,
                passage: passageContext,
                question_text: q.question,
                options: q.options,
                correct_answer: q.correct,
                explanation: q.explanation || `Reference: ${activeBook.title} - ${ch.title}`,
                difficulty: 'medium',
                is_active: true,
                source_type: 'curated_jamb',
                source_name: `JAMB Prescribed Novel: ${activeBook.title}`
              });
            });
          }
        });
      }
    } else {
      // Literature in English: Prose, Drama, Poetry
      const activeIds = config.activeLiteratureBookIds || [];
      const litBooks = books.filter(b => 
        activeIds.includes(b.id) || 
        b.genre.toLowerCase().includes('prose') || 
        b.genre.toLowerCase().includes('drama') || 
        b.genre.toLowerCase().includes('poetry')
      );

      const targetBooks = litBooks.length > 0 ? litBooks : books.slice(1);

      targetBooks.forEach(book => {
        if (Array.isArray(book.chapters)) {
          book.chapters.forEach(ch => {
            if (Array.isArray(ch.sampleQuestions)) {
              ch.sampleQuestions.forEach((q, idx) => {
                const passageContext = q.passage || ch.summary?.slice(0, 320) || `Based on "${book.title}" (${book.genre}) by ${book.author} (${ch.title}).`;
                
                pool.push({
                  id: q.id || `lit_${book.id}_ch${ch.id}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
                  subject_id: 'lit_in_eng_canonical_id',
                  subject_name: 'Literature in English',
                  topic_name: `${book.genre}: ${book.title}`,
                  subtopic_name: ch.title,
                  book_title: book.title,
                  chapter_title: ch.title,
                  passage: passageContext,
                  question_text: q.question,
                  options: q.options,
                  correct_answer: q.correct,
                  explanation: q.explanation || `Reference: ${book.title} (${book.genre}) - ${ch.title}`,
                  difficulty: 'medium',
                  is_active: true,
                  source_type: 'curated_jamb',
                  source_name: `JAMB Literature Text: ${book.title}`
                });
              });
            }
          });
        }
      });
    }

    if (pool.length === 0) return [];

    // Shuffle and pick requested count
    const shuffled = pool.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  } catch (err) {
    console.warn('getExamNovelQuestions fallback:', err);
    return [];
  }
};

/**
 * AI Question Generator from textbook / chapter content via backend AI proxy
 */
export const generateNovelQuestionsWithAI = async (params: {
  bookTitle: string;
  chapterTitle?: string;
  contextText: string;
  questionCount: number;
  focusType: string;
}): Promise<NovelQuestion[]> => {
  try {
    const res = await authFetch(getApiUrl('/api/admin/generate-novel-questions'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.questions)) {
        return data.questions;
      }
    }
  } catch (err) {
    console.warn('generateNovelQuestionsWithAI server call error:', err);
  }

  // Fallback generation logic if server route is in offline or fallback state
  return generateClientFallbackQuestions(params);
};

function generateClientFallbackQuestions(params: {
  bookTitle: string;
  chapterTitle?: string;
  contextText: string;
  questionCount: number;
  focusType: string;
}): NovelQuestion[] {
  const { bookTitle, chapterTitle = 'General Overview', contextText, questionCount } = params;
  const generated: NovelQuestion[] = [];

  const sentences = contextText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25);

  const fallbackQuestions: NovelQuestion[] = [
    {
      question: `According to ${chapterTitle} in "${bookTitle}", what is the primary lesson or central event portrayed?`,
      options: [
        `A) ${sentences[0] || 'Character actions directly dictate long-term moral consequences.'}`,
        `B) Unchecked materialism and deceit invariably triumph over virtue.`,
        `C) The protagonist abandons academic aspirations for business.`,
        `D) Traditional elders encourage foreign values unconditionally.`
      ],
      correct: 'A',
      explanation: `In ${chapterTitle} of ${bookTitle}, the key focus emphasizes: ${sentences[0] || 'the moral and narrative trajectory of the characters'}.`,
      passage: sentences.slice(0, 2).join(' ')
    },
    {
      question: `What literary theme is most prominently developed in "${bookTitle}" as highlighted in this section?`,
      options: [
        'A) Humility, integrity, and character versus greed and hubris',
        'B) Scientific technological advancement in colonial Africa',
        'C) Maritime exploration and military conquest',
        'D) Complete indifference to family and parental guidance'
      ],
      correct: 'A',
      explanation: `A central thematic motif across ${bookTitle} is the necessity of character, moral discipline, and resilience in higher education and society.`,
      passage: sentences.slice(1, 3).join(' ') || sentences[0]
    },
    {
      question: `In the context of the events described in ${chapterTitle}, which character\'s decisions primarily catalyze the conflict?`,
      options: [
        'A) The central character whose choices trigger irreversible moral consequences',
        'B) A minor bystander with no direct connection to the main plot',
        'C) A foreign magistrate with no jurisdiction',
        'D) An unnamed merchant'
      ],
      correct: 'A',
      explanation: `The dramatic conflict in this section develops around key character choices and their repercussions.`
    }
  ];

  while (generated.length < questionCount) {
    for (const fq of fallbackQuestions) {
      if (generated.length >= questionCount) break;
      generated.push({
        ...fq,
        id: `gen_q_${Date.now()}_${generated.length}`
      });
    }
  }

  return generated.slice(0, questionCount);
}


