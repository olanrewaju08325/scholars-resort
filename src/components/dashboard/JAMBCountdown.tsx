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

  useEffect(() => {
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
    </Card>
  );
};
