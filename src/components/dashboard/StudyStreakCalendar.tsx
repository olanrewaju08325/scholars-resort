import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Flame, ChevronLeft, ChevronRight, Calendar as CalendarIcon, BookOpen } from 'lucide-react';
import { useStudentStats } from '@/hooks/useStudentStats';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export const StudyStreakCalendar = () => {
  const { profile } = useAuth();
  const { streak, history } = useStudentStats();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [utmeStudyLogs, setUtmeStudyLogs] = useState<string[]>([]);

  // Registered UTME subjects
  const userUtmeSubjects: string[] = useMemo(() => {
    if (profile?.utme_subjects && Array.isArray(profile.utme_subjects) && profile.utme_subjects.length > 0) {
      return profile.utme_subjects;
    }
    return ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];
  }, [profile?.utme_subjects]);

  // Fetch UTME subject specific activity logs
  useEffect(() => {
    if (!profile?.id) return;
    const fetchUtmeLogs = async () => {
      try {
        const { data } = await supabase
          .from('study_logs')
          .select('created_at, subject_context, is_utme_curriculum')
          .eq('user_id', profile.id)
          .eq('is_utme_curriculum', true);

        if (data && data.length > 0) {
          const dates = data.map((d: any) => new Date(d.created_at).toISOString().split('T')[0]);
          setUtmeStudyLogs(dates);
        }
      } catch {}
    };
    fetchUtmeLogs();
  }, [profile?.id]);

  // Extract practice dates from history & study logs specifically matching registered UTME subjects
  const activeDaysSet = useMemo(() => {
    const set = new Set<string>();

    // Add UTME curriculum study logs
    utmeStudyLogs.forEach(d => set.add(d));

    // Fallback: Add session history if valid
    if (history && Array.isArray(history)) {
      history.forEach((session: any) => {
        if (session.created_at) {
          const d = new Date(session.created_at).toISOString().split('T')[0];
          set.add(d);
        }
      });
    }

    // Include today if current streak > 0
    if (streak > 0) {
      set.add(new Date().toISOString().split('T')[0]);
    }
    return set;
  }, [utmeStudyLogs, history, streak]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Calculate active days in this month
  const activeDaysThisMonth = useMemo(() => {
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (activeDaysSet.has(dateStr)) count++;
    }
    return count;
  }, [year, month, daysInMonth, activeDaysSet]);

  const monthlyConsistencyRate = Math.round((activeDaysThisMonth / daysInMonth) * 100);

  return (
    <Card className="border-border shadow-sm bg-card overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" /> Study Streak & Practice Calendar
            </CardTitle>
            <CardDescription className="text-xs">
              Track your daily CBT practice consistency for your registered UTME subjects
            </CardDescription>
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-primary" /> Active UTME Focus:
              </span>
              {userUtmeSubjects.map((sub, idx) => (
                <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold">
                  {sub}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full text-xs font-bold">
              <Flame className="w-4 h-4 fill-orange-500 text-orange-500 animate-bounce" />
              <span>{streak} Day Streak</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {/* Month Navigation & Stats Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-foreground">
              {monthNames[month]} {year}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCurrentMonth}
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Today
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevMonth}
              className="h-7 w-7 border-border"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextMonth}
              className="h-7 w-7 border-border"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-[11px] font-semibold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {/* Empty cells before month starts */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8 sm:h-9 rounded-lg bg-transparent" />
          ))}

          {/* Days of current month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isActive = activeDaysSet.has(dateStr);
            const isToday = dateStr === todayStr;

            return (
              <div
                key={dateStr}
                className={`h-8 sm:h-9 rounded-lg flex flex-col items-center justify-center relative transition-all border text-xs font-medium ${
                  isActive
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : isToday
                    ? 'bg-primary/10 border-primary/40 text-primary font-bold'
                    : 'bg-muted/10 border-border/40 text-muted-foreground hover:bg-muted/30'
                }`}
                title={isActive ? `Practiced on ${dateStr}` : isToday ? 'Today' : dateStr}
              >
                <span>{dayNum}</span>
                {isActive && (
                  <div className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </div>
            );
          })}
        </div>

        {/* Consistency Footer Stats */}
        <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground block">Active Days</span>
            <span className="font-bold text-foreground font-mono">{activeDaysThisMonth} / {daysInMonth}</span>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground block">Consistency</span>
            <span className="font-bold text-emerald-500 font-mono">{monthlyConsistencyRate}%</span>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 border border-border/40">
            <span className="text-[10px] text-muted-foreground block">Streak Target</span>
            <span className="font-bold text-orange-500 font-mono">14 Days</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
