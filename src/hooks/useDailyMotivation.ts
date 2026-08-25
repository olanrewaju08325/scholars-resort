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
}

export const OFFLINE_MOTIVATION_BANK: MotivationQuote[] = [
  {
    quote: "Consistency is your superpower. 45 minutes of focused CBT drill today creates a 300+ score in April.",
    author: "Scholars Resort Academy",
    focus: "Daily Discipline",
    category: "Discipline"
  },
  {
    quote: "Do not wait for extraordinary opportunities. Seize common occasions and make them great through relentless practice.",
    author: "UTME Merit Scholar",
    focus: "Relentless Effort",
    category: "Perseverance"
  },
  {
    quote: "The secret of getting ahead is getting started. Break your subject syllabus into small manageable daily topics.",
    author: "Scholars CBT Mentors",
    focus: "Syllabus Mastery",
    category: "Strategy"
  },
  {
    quote: "Your university admission letter is being typed with every correct question you solve today. Stay locked in!",
    author: "Scholars AI Assistant",
    focus: "Target Score Focus",
    category: "Focus"
  },
  {
    quote: "Failure is not the opposite of success; it is part of success. Review every mistake in CBT review mode.",
    author: "Scholars Educational Desk",
    focus: "Growth Mindset",
    category: "Mindset"
  },
  {
    quote: "Accuracy in Speed: Practice timed mock sessions until quick decision-making becomes second nature.",
    author: "UTME Top Scorer (342)",
    focus: "Time Management",
    category: "Speed"
  }
];

export function useDailyMotivation() {
  const { profile, user } = useAuth();
  const [motivation, setMotivation] = useState<MotivationQuote>(OFFLINE_MOTIVATION_BANK[0]);
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

  // Save quote to Supabase database table `motivational_quotes` or `daily_quotes`
  const saveQuoteToDatabase = async (newQuote: MotivationQuote) => {
    try {
      // 1. Save to local storage for instant offline retrieval
      const cachedStr = localStorage.getItem('scholars_saved_quotes') || '[]';
      const cachedList: MotivationQuote[] = JSON.parse(cachedStr);
      cachedList.unshift(newQuote);
      localStorage.setItem('scholars_saved_quotes', JSON.stringify(cachedList.slice(0, 50)));

      // 2. Save to Supabase DB if online
      if (navigator.onLine && supabase) {
        await supabase.from('motivational_quotes').insert({
          quote: newQuote.quote,
          author: newQuote.author,
          focus: newQuote.focus,
          category: newQuote.category || 'UTME Strategy',
          user_id: user?.id || null,
          created_at: new Date().toISOString()
        }).catch(() => {
          // Graceful fallback if table is named differently or has strict RLS
        });
      }
    } catch (e) {
      console.warn('Quote storage warning (saved locally):', e);
    }
  };

  // Fetch or generate fresh AI inspiration
  const generateNewMotivation = useCallback(async () => {
    if (!navigator.onLine) {
      const savedStr = localStorage.getItem('scholars_saved_quotes');
      let combinedBank = OFFLINE_MOTIVATION_BANK;
      if (savedStr) {
        try {
          const customSaved = JSON.parse(savedStr);
          if (Array.isArray(customSaved) && customSaved.length > 0) {
            combinedBank = [...customSaved, ...OFFLINE_MOTIVATION_BANK];
          }
        } catch {}
      }
      const randomIdx = Math.floor(Math.random() * combinedBank.length);
      setMotivation(combinedBank[randomIdx]);
      toast.info('Offline Mode: Loaded cached study strategy quote.');
      return;
    }

    setLoading(true);
    try {
      const userName = profile?.full_name?.split(' ')[0] || 'Scholar';
      const targetUni = profile?.target_university || 'Top University';
      const targetScore = profile?.target_score || 320;
      const seedTopics = ['Time Management', 'Negative Marking Avoidance', 'English Lexis Precision', 'Physics Formula Memory', 'Chemistry Reaction Steps', 'Biology Syllabus Speed'];
      const randomFocus = seedTopics[Math.floor(Math.random() * seedTopics.length)];

      const prompt = `You are the Scholars Resort AI Academic Performance Coach. Generate a brand-new, powerful 2-sentence motivational quote and practical study tip for ${userName} aiming for a UTME score of ${targetScore}+ at ${targetUni}. Focus on: ${randomFocus}. Do NOT use clichés. Keep it highly inspiring, crisp, and direct. Return ONLY the text, no quotes or metadata.`;

      const rawAiResponse = await callGroqAPI([{ role: 'user', content: prompt }]);
      const cleanedQuote = stripThinkTags(rawAiResponse).replace(/^["']|["']$/g, '').trim();

      if (cleanedQuote) {
        const freshQuoteObj: MotivationQuote = {
          quote: cleanedQuote,
          author: 'Scholars AI Performance Coach',
          focus: randomFocus,
          category: 'Daily AI Tip',
          created_at: new Date().toISOString()
        };

        setMotivation(freshQuoteObj);
        await saveQuoteToDatabase(freshQuoteObj);
        toast.success('Generated and saved fresh AI motivation!');
      } else {
        throw new Error('Empty AI response');
      }
    } catch (err) {
      const randomIdx = Math.floor(Math.random() * OFFLINE_MOTIVATION_BANK.length);
      setMotivation(OFFLINE_MOTIVATION_BANK[randomIdx]);
      toast.info('Loaded Scholars Resort verified study strategy.');
    } finally {
      setLoading(false);
    }
  }, [profile, user]);

  // Initial load
  useEffect(() => {
    // Check if we have today's quote cached
    const cachedToday = localStorage.getItem('scholars_quote_today');
    const todayDate = new Date().toDateString();

    if (cachedToday) {
      try {
        const parsed = JSON.parse(cachedToday);
        if (parsed.date === todayDate && parsed.quote) {
          setMotivation(parsed.quote);
          return;
        }
      } catch {}
    }

    // Otherwise generate or select initial
    const initialQuote = OFFLINE_MOTIVATION_BANK[Math.floor(Math.random() * OFFLINE_MOTIVATION_BANK.length)];
    setMotivation(initialQuote);
    localStorage.setItem('scholars_quote_today', JSON.stringify({ date: todayDate, quote: initialQuote }));
  }, []);

  return {
    motivation,
    loading,
    isOnline,
    generateNewMotivation
  };
}
