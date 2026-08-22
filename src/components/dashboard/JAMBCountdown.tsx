import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Rocket } from 'lucide-react';

export const JAMBCountdown = () => {
  const { profile } = useAuth();
  const [daysLeft, setDaysLeft] = useState(0);
  const [hoursLeft, setHoursLeft] = useState(0);
  const [minutesLeft, setMinutesLeft] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [examDate, setExamDate] = useState<Date>(new Date('2027-04-19'));
  const [loaded, setLoaded] = useState(false);
  const [telegramSupport, setTelegramSupport] = useState('https://t.me/+6dtsZgQpwrNhZDM8');
  const [telegramAnnouncements, setTelegramAnnouncements] = useState('https://t.me/+9WU6HrQE6DJhYTRk');

  useEffect(() => {
    // Fetch Telegram links & global countdown from global_config
    supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'global_config')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.setting_value) {
          if (data.setting_value.telegram_support_link) {
            setTelegramSupport(data.setting_value.telegram_support_link);
          }
          if (data.setting_value.telegram_announcement_link) {
            setTelegramAnnouncements(data.setting_value.telegram_announcement_link);
          }
          if (data.setting_value.jamb_date) {
            setExamDate(new Date(data.setting_value.jamb_date));
          }
        }
      });

    // Try to get exam date from study_goals
    if (profile?.id) {
      supabase
        .from('study_goals')
        .select('exam_date')
        .eq('user_id', profile.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.exam_date) {
            setExamDate(new Date(data.exam_date));
          }
          setLoaded(true);
        });
    } else {
      setLoaded(true);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!loaded) return;
    const tick = () => {
      const now = new Date();
      const diff = examDate.getTime() - now.getTime();
      if (diff <= 0) {
        setDaysLeft(0); setHoursLeft(0); setMinutesLeft(0); setSecondsLeft(0);
        return;
      }
      setDaysLeft(Math.floor(diff / (1000 * 60 * 60 * 24)));
      setHoursLeft(Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
      setMinutesLeft(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
      setSecondsLeft(Math.floor((diff % (1000 * 60)) / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [examDate, loaded]);

  const Digit = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-primary/10 border border-primary/30 rounded-xl w-16 h-16 flex items-center justify-center">
        <span className="text-2xl font-black text-primary font-mono">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1.5">{label}</span>
    </div>
  );

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="bg-gradient-to-br from-primary/20 to-purple-900/30 p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          <div>
            <div className="font-bold text-sm">JAMB Countdown</div>
            <div className="text-xs text-muted-foreground">
              Target: {examDate.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
      <CardContent className="py-6 flex justify-center">
        <div className="flex items-start gap-3">
          <Digit value={daysLeft} label="Days" />
          <span className="text-2xl font-black text-muted-foreground mt-4">:</span>
          <Digit value={hoursLeft} label="Hours" />
          <span className="text-2xl font-black text-muted-foreground mt-4">:</span>
          <Digit value={minutesLeft} label="Mins" />
          <span className="text-2xl font-black text-muted-foreground mt-4">:</span>
          <Digit value={secondsLeft} label="Secs" />
        </div>
      </CardContent>
      <div className="pb-4 text-center text-xs text-muted-foreground">
        {daysLeft > 0 ? `${daysLeft} days of preparation remaining` : 'Exam time!'}
      </div>

      <div className="border-t border-border p-3 bg-muted/20 space-y-2">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-center">Official Communities</div>
        <div className="grid grid-cols-2 gap-2">
          <a 
            href={telegramSupport} 
            target="_blank" 
            rel="noreferrer" 
            className="flex items-center justify-center gap-1 py-1 px-1.5 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 rounded-lg text-sky-600 dark:text-sky-400 font-extrabold text-[10px] transition-colors"
          >
            Support Group
          </a>
          <a 
            href={telegramAnnouncements} 
            target="_blank" 
            rel="noreferrer" 
            className="flex items-center justify-center gap-1 py-1 px-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-lg text-blue-600 dark:text-blue-400 font-extrabold text-[10px] transition-colors"
          >
            Announcements
          </a>
        </div>
      </div>
    </Card>
  );
};
