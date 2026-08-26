import { supabase } from '@/lib/supabase';
import { SafeDataFetcher } from '@/utils/safeDataFetcher';

export interface DailyQuoteItem {
  id?: string;
  quote: string;
  author: string;
  focus: string;
  category?: string;
  bg_image?: string;
  created_at?: string;
}

export const SEED_DAILY_QUOTES: DailyQuoteItem[] = [
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

export class DailyQuoteService {
  /**
   * Fetches quotes from Supabase `daily_quotes` or `motivational_quotes` tables safely.
   * Auto-seeds default entries if the database table is empty.
   */
  static async getHourlyQuote(): Promise<DailyQuoteItem> {
    const currentHour = new Date().getHours();

    try {
      // 1. Try daily_quotes table
      const res1 = await SafeDataFetcher<DailyQuoteItem[]>(
        supabase.from('daily_quotes').select('*').order('created_at', { ascending: false }),
        { contextName: 'DailyQuoteService.daily_quotes' }
      );

      if (res1.data && res1.data.length > 0) {
        return res1.data[currentHour % res1.data.length];
      }

      // 2. Try motivational_quotes table
      const res2 = await SafeDataFetcher<DailyQuoteItem[]>(
        supabase.from('motivational_quotes').select('*').order('created_at', { ascending: false }),
        { contextName: 'DailyQuoteService.motivational_quotes' }
      );

      if (res2.data && res2.data.length > 0) {
        return res2.data[currentHour % res2.data.length];
      }

      // 3. If both empty, seed daily_quotes table
      await this.seedDailyQuotes();
    } catch (e) {
      console.warn('DailyQuoteService fetch warning:', e);
    }

    return SEED_DAILY_QUOTES[currentHour % SEED_DAILY_QUOTES.length];
  }

  /**
   * Seed quotes into `daily_quotes` table in Supabase
   */
  static async seedDailyQuotes(): Promise<void> {
    if (!supabase) return;
    try {
      const payload = SEED_DAILY_QUOTES.map(q => ({
        quote: q.quote,
        author: q.author,
        focus: q.focus,
        category: q.category,
        bg_image: q.bg_image,
        created_at: new Date().toISOString()
      }));

      await supabase.from('daily_quotes').insert(payload).catch(() => {});
      await supabase.from('motivational_quotes').insert(payload).catch(() => {});
    } catch (e) {
      console.warn('DailyQuoteService seed warning:', e);
    }
  }

  /**
   * Add new quote to daily_quotes table
   */
  static async saveQuote(item: DailyQuoteItem): Promise<boolean> {
    if (!supabase) return false;
    try {
      const payload = {
        quote: item.quote,
        author: item.author || 'Scholars AI Performance Coach',
        focus: item.focus || 'UTME Strategy',
        category: item.category || 'Daily Tip',
        bg_image: item.bg_image || SEED_DAILY_QUOTES[0].bg_image,
        created_at: new Date().toISOString()
      };

      await supabase.from('daily_quotes').insert(payload).catch(() => {});
      await supabase.from('motivational_quotes').insert(payload).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
}
