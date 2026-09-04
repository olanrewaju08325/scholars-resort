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
   * Fetches quotes from Supabase `admin_settings.daily_quotes_bank` or `daily_quotes` table safely.
   * Rotates hourly so tokens are not consumed on normal page visits.
   */
  static async getHourlyQuote(): Promise<DailyQuoteItem> {
    const currentHour = new Date().getHours();

    try {
      // 1. Check admin_settings.daily_quotes_bank
      const { data: settingData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'daily_quotes_bank')
        .maybeSingle();

      if (settingData?.setting_value && Array.isArray(settingData.setting_value) && settingData.setting_value.length > 0) {
        const quotes: DailyQuoteItem[] = settingData.setting_value;
        return quotes[currentHour % quotes.length];
      }

      // 2. Try daily_quotes table if present
      const res1 = await SafeDataFetcher<DailyQuoteItem[]>(
        supabase.from('daily_quotes').select('*').order('created_at', { ascending: false }).limit(20),
        { contextName: 'DailyQuoteService.daily_quotes', fallbackValue: [] }
      );

      if (res1.data && res1.data.length > 0) {
        return res1.data[currentHour % res1.data.length];
      }

      // If empty in DB, seed into admin_settings
      await this.seedDailyQuotes();
    } catch (e) {
      // Fallback cleanly
    }

    return SEED_DAILY_QUOTES[currentHour % SEED_DAILY_QUOTES.length];
  }

  /**
   * Seed quotes into `admin_settings.daily_quotes_bank`
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

      await supabase.from('admin_settings').upsert({
        setting_key: 'daily_quotes_bank',
        setting_value: payload,
        updated_at: new Date().toISOString()
      });
    } catch {}
  }

  /**
   * Add new quote to database quote bank (admin_settings & daily_quotes table)
   */
  static async saveQuote(item: DailyQuoteItem): Promise<boolean> {
    if (!supabase) return false;
    try {
      const newEntry: DailyQuoteItem = {
        quote: item.quote,
        author: item.author || 'Scholars AI Performance Coach',
        focus: item.focus || 'UTME Strategy',
        category: item.category || 'Daily Tip',
        bg_image: item.bg_image || SEED_DAILY_QUOTES[0].bg_image,
        created_at: new Date().toISOString()
      };

      // 1. Fetch current bank and prepend
      const { data: settingData } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'daily_quotes_bank')
        .maybeSingle();

      let currentList: DailyQuoteItem[] = Array.isArray(settingData?.setting_value) ? settingData.setting_value : [...SEED_DAILY_QUOTES];
      currentList = [newEntry, ...currentList.filter(q => q.quote !== newEntry.quote)].slice(0, 100);

      await supabase.from('admin_settings').upsert({
        setting_key: 'daily_quotes_bank',
        setting_value: currentList,
        updated_at: new Date().toISOString()
      });

      // 2. Also try daily_quotes table if it exists
      try {
        await supabase.from('daily_quotes').insert(newEntry);
      } catch {}

      return true;
    } catch {
      return false;
    }
  }
}
