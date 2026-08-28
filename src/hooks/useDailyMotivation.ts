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

  // Fetch all quotes from database and auto-rotate hourly
  const fetchQuotesFromDb = useCallback(async () => {
    try {
      if (supabase && navigator.onLine) {
        const { safeSupabaseQuery } = await import('@/lib/safeSupabase');
        const qRes = await safeSupabaseQuery<any[]>(
          supabase.from('daily_quotes').select('*').order('created_at', { ascending: false }),
          { contextName: 'useDailyMotivation', fallbackValue: [] }
        );
        const data = qRes.data || [];
        if (data.length > 0) {
          const formatted: MotivationQuote[] = data.map(q => ({
            id: q.id,
            quote: q.quote,
            author: q.author || 'Scholars AI Coach',
            focus: q.focus || 'UTME Drill',
            category: q.category || 'Strategy',
            created_at: q.created_at,
            bg_image: q.bg_image || INITIAL_SEED_QUOTES[Math.floor(Math.random() * INITIAL_SEED_QUOTES.length)].bg_image
          }));
          setDbQuotes(formatted);

          // Rotate quote based on current hour so quotes change automatically every hour
          const currentHour = new Date().getHours();
          const selectedIdx = currentHour % formatted.length;
          setMotivation(formatted[selectedIdx]);
          return formatted;
        } else {
          // If database is empty or error, seed initial quotes to Supabase DB
          await seedInitialQuotes();
        }
      }
    } catch (err) {
      console.warn('DB quote fetch info:', err);
    }
    // Fallback if offline or DB unavailable
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
      await supabase.from('daily_quotes').insert(payload);
    } catch (e) {
      console.warn('Initial quote seed handled:', e);
    }
  };

  // Save new quote to database
  const saveQuoteToDatabase = async (newQuote: MotivationQuote) => {
    try {
      // 1. Save to local storage for instant offline retrieval
      const cachedStr = localStorage.getItem('scholars_saved_quotes') || '[]';
      const cachedList: MotivationQuote[] = JSON.parse(cachedStr);
      cachedList.unshift(newQuote);
      localStorage.setItem('scholars_saved_quotes', JSON.stringify(cachedList.slice(0, 50)));

      // 2. Insert into Supabase DB
      if (navigator.onLine && supabase) {
        const { data } = await supabase.from('daily_quotes').insert({
          quote: newQuote.quote,
          author: newQuote.author,
          focus: newQuote.focus,
          category: newQuote.category || 'Daily AI Tip',
          bg_image: newQuote.bg_image || INITIAL_SEED_QUOTES[Math.floor(Math.random() * INITIAL_SEED_QUOTES.length)].bg_image,
          user_id: user?.id || null,
          created_at: new Date().toISOString()
        }).select();

        if (data && data[0]) {
          setDbQuotes(prev => [data[0], ...prev]);
        }
      }
    } catch (e) {
      console.warn('Quote storage warning (saved locally):', e);
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

