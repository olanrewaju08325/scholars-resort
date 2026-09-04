import { useState, useEffect, useCallback } from 'react';
import { callGroqAPI, stripThinkTags } from '@/services/aiService';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface MotivationQuote {
  id?: string;
  quote: string;
  author: string;
  focus: string;
  category?: string;
  created_at?: string;
  bg_image?: string;
}

export const INITIAL_SEED_QUOTES: MotivationQuote[] = [
  {
    quote: "Consistency is your superpower. 45 minutes of focused CBT drill today creates a 300+ score in April.",
    author: "Scholars Resort Academy",
    focus: "Daily Discipline",
    category: "Discipline",
    bg_image: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80"
  },
  {
    quote: "Do not wait for extraordinary opportunities. Seize common occasions and make them great through relentless practice.",
    author: "UTME Merit Scholar",
    focus: "Relentless Effort",
    category: "Perseverance",
    bg_image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80"
  },
  {
    quote: "The secret of getting ahead is getting started. Break your subject syllabus into small manageable daily topics.",
    author: "Scholars CBT Mentors",
    focus: "Syllabus Mastery",
    category: "Strategy",
    bg_image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80"
  },
  {
    quote: "Your university admission letter is being typed with every correct question you solve today. Stay locked in!",
    author: "Scholars AI Assistant",
    focus: "Target Score Focus",
    category: "Focus",
    bg_image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80"
  },
  {
    quote: "Failure is not the opposite of success; it is part of success. Review every mistake in CBT review mode.",
    author: "Scholars Educational Desk",
    focus: "Growth Mindset",
    category: "Mindset",
    bg_image: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&w=800&q=80"
  },
  {
    quote: "Accuracy in Speed: Practice timed mock sessions until quick decision-making becomes second nature.",
    author: "UTME Top Scorer (342)",
    focus: "Time Management",
    category: "Speed",
    bg_image: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80"
  }
];

export function useDailyMotivation() {
  const { profile, user } = useAuth();
  const [motivation, setMotivation] = useState<MotivationQuote>(INITIAL_SEED_QUOTES[0]);
  const [dbQuotes, setDbQuotes] = useState<MotivationQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch all quotes from database and auto-rotate hourly without burning AI tokens
  const fetchQuotesFromDb = useCallback(async () => {
    try {
      // 1. Try local cache first
      const cachedStr = localStorage.getItem('scholars_saved_quotes');
      let cachedQuotes: MotivationQuote[] = [];
      if (cachedStr) {
        try {
          cachedQuotes = JSON.parse(cachedStr);
        } catch {}
      }

      if (supabase && navigator.onLine) {
        // 2. Fetch from admin_settings.daily_quotes_bank
        const { data: settingData } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'daily_quotes_bank')
          .maybeSingle();

        let dbBank: MotivationQuote[] = [];
        if (settingData?.setting_value && Array.isArray(settingData.setting_value) && settingData.setting_value.length > 0) {
          dbBank = settingData.setting_value.map((q: any) => ({
            id: q.id || q.quote.slice(0, 16),
            quote: q.quote,
            author: q.author || 'Scholars AI Coach',
            focus: q.focus || 'UTME Strategy',
            category: q.category || 'Strategy',
            created_at: q.created_at,
            bg_image: q.bg_image || INITIAL_SEED_QUOTES[0].bg_image
          }));
        } else {
          // Initialize bank in database
          await seedInitialQuotes();
          dbBank = INITIAL_SEED_QUOTES;
        }

        // Merge DB bank with local cache deduplicating by quote text
        const mergedMap = new Map<string, MotivationQuote>();
        [...dbBank, ...cachedQuotes, ...INITIAL_SEED_QUOTES].forEach(item => {
          if (item?.quote && !mergedMap.has(item.quote.trim())) {
            mergedMap.set(item.quote.trim(), item);
          }
        });

        const merged = Array.from(mergedMap.values());
        setDbQuotes(merged);
        localStorage.setItem('scholars_saved_quotes', JSON.stringify(merged.slice(0, 50)));

        const currentHour = new Date().getHours();
        const selected = merged[currentHour % merged.length];
        setMotivation(selected);
        return merged;
      } else if (cachedQuotes.length > 0) {
        setDbQuotes(cachedQuotes);
        const currentHour = new Date().getHours();
        setMotivation(cachedQuotes[currentHour % cachedQuotes.length]);
        return cachedQuotes;
      }
    } catch (err) {
      // Clean fallback
    }

    // Default fallback
    const currentHour = new Date().getHours();
    const fallback = INITIAL_SEED_QUOTES[currentHour % INITIAL_SEED_QUOTES.length];
    setMotivation(fallback);
    return INITIAL_SEED_QUOTES;
  }, []);

  // Seed initial quotes to Supabase if database is empty
  const seedInitialQuotes = async () => {
    if (!supabase || !navigator.onLine) return;
    try {
      const payload = INITIAL_SEED_QUOTES.map(q => ({
        quote: q.quote,
        author: q.author,
        focus: q.focus,
        category: q.category,
        bg_image: q.bg_image,
        user_id: user?.id || null,
        created_at: new Date().toISOString()
      }));

      await supabase.from('admin_settings').upsert({
        setting_key: 'daily_quotes_bank',
        setting_value: payload,
        updated_at: new Date().toISOString()
      });
    } catch {}
  };

  // Save newly generated AI quote to database
  const saveQuoteToDatabase = async (newQuote: MotivationQuote) => {
    try {
      // 1. Save to local storage
      const cachedStr = localStorage.getItem('scholars_saved_quotes') || '[]';
      let cachedList: MotivationQuote[] = [];
      try {
        cachedList = JSON.parse(cachedStr);
      } catch {}
      cachedList = [newQuote, ...cachedList.filter(q => q.quote !== newQuote.quote)].slice(0, 50);
      localStorage.setItem('scholars_saved_quotes', JSON.stringify(cachedList));

      // 2. Persist to Supabase admin_settings.daily_quotes_bank
      if (navigator.onLine && supabase) {
        const { data: settingData } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'daily_quotes_bank')
          .maybeSingle();

        let currentBank: MotivationQuote[] = Array.isArray(settingData?.setting_value) 
          ? settingData.setting_value 
          : [...INITIAL_SEED_QUOTES];

        currentBank = [newQuote, ...currentBank.filter(q => q.quote !== newQuote.quote)].slice(0, 100);

        await supabase.from('admin_settings').upsert({
          setting_key: 'daily_quotes_bank',
          setting_value: currentBank,
          updated_at: new Date().toISOString()
        });

        setDbQuotes(currentBank);
      }
    } catch (e) {
      // Saved locally
    }
  };

  // Generate fresh AI inspiration & save directly to DB
  const generateNewMotivation = useCallback(async () => {
    if (!navigator.onLine) {
      const pool = dbQuotes.length > 0 ? dbQuotes : INITIAL_SEED_QUOTES;
      const randomIdx = Math.floor(Math.random() * pool.length);
      setMotivation(pool[randomIdx]);
      toast.info('Offline Mode: Loaded cached study strategy quote.');
      return;
    }

    setLoading(true);
    try {
      const userName = profile?.full_name?.split(' ')[0] || 'Scholar';
      const targetUni = profile?.target_university || 'Top University';
      const targetScore = profile?.target_score || 320;
      const seedTopics = [
        'Time Management in English Comprehension', 
        'Negative Marking Avoidance Tactics', 
        'Physics Kinematics Speed Formulas', 
        'Chemistry Reaction Balance Shortcuts', 
        'Biology Diagram Recognition Memory', 
        'JAMB CBT Option Elimination Secrets'
      ];
      const randomFocus = seedTopics[Math.floor(Math.random() * seedTopics.length)];

      const prompt = `You are the ultimate Scholars Resort AI Academic Performance Coach. 
      Write a highly encouraging, 2-sentence motivational study strategy specifically for ${userName} who is determined to score ${targetScore}+ in their JAMB UTME exam and secure admission to ${targetUni}.
      
      CRITICAL STRUCTURAL RULES:
      1. Your response MUST be EXACTLY two clear, powerful sentences. No more, no less.
      2. The first sentence should be a burning, inspirational quote about self-discipline and academic greatness.
      3. The second sentence must be a hyper-practical, actionable study tip targeting: "${randomFocus}".
      4. DO NOT output any HTML tags, do NOT mention image URLs, do NOT include markdown syntax, and do NOT output any "Image:" or "Quote:" prefixes.
      5. Output ONLY the pure plain text quote content.`;

      const rawAiResponse = await callGroqAPI([{ role: 'user', content: prompt }]);
      const cleanedQuote = stripThinkTags(rawAiResponse).replace(/^["']|["']$/g, '').trim();

      if (cleanedQuote) {
        const randomImg = INITIAL_SEED_QUOTES[Math.floor(Math.random() * INITIAL_SEED_QUOTES.length)].bg_image;
        const freshQuoteObj: MotivationQuote = {
          quote: cleanedQuote,
          author: 'Scholars AI Performance Coach',
          focus: randomFocus,
          category: 'Daily AI Tip',
          bg_image: randomImg,
          created_at: new Date().toISOString()
        };

        setMotivation(freshQuoteObj);
        await saveQuoteToDatabase(freshQuoteObj);
        toast.success('Generated and saved fresh quote to database!');
      } else {
        throw new Error('Empty AI response');
      }
    } catch (err) {
      const pool = dbQuotes.length > 0 ? dbQuotes : INITIAL_SEED_QUOTES;
      const randomIdx = Math.floor(Math.random() * pool.length);
      setMotivation(pool[randomIdx]);
      toast.info('Loaded Scholars Resort verified study strategy.');
    } finally {
      setLoading(false);
    }
  }, [profile, user, dbQuotes]);

  // Initial load and periodic hourly auto-rotation
  useEffect(() => {
    fetchQuotesFromDb();

    // Check hourly for auto-rotation
    const interval = setInterval(() => {
      if (dbQuotes.length > 0) {
        const currentHour = new Date().getHours();
        const selectedIdx = currentHour % dbQuotes.length;
        setMotivation(dbQuotes[selectedIdx]);
      } else {
        fetchQuotesFromDb();
      }
    }, 60 * 60 * 1000); // 1 hour rotation

    return () => clearInterval(interval);
  }, [fetchQuotesFromDb, dbQuotes.length]);

  return {
    motivation,
    dbQuotesCount: dbQuotes.length,
    loading,
    isOnline,
    generateNewMotivation,
    fetchQuotesFromDb
  };
}

