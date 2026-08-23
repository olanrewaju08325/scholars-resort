import { useState, useEffect, useCallback } from 'react';
import { 
  FileQuestion, BookOpen, Users, RefreshCw, Sparkles, TrendingUp, ShieldCheck, Database
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fetchJambBooks } from '@/services/novelService';
import { getSubjectQuestionCountsAggregation } from '@/utils/subjectUtils';

export interface QuickStatsData {
  totalQuestions: number;
  totalLiteraryEntries: number;
  totalRegisteredUsers: number;
  activeStudents: number;
  lastUpdated: string;
}

export function QuickStats() {
  const [stats, setStats] = useState<QuickStatsData>({
    totalQuestions: 0,
    totalLiteraryEntries: 0,
    totalRegisteredUsers: 0,
    activeStudents: 0,
    lastUpdated: ''
  });
  const [loading, setLoading] = useState(true);

  const fetchQuickStats = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Total Questions via aggregation service utility grouped by subject_id
      const aggregation = await getSubjectQuestionCountsAggregation();
      const questionsCount = aggregation.totalQuestions > 0 
        ? aggregation.totalQuestions 
        : (await supabase.from('questions').select('*', { count: 'exact', head: true })).count || 0;

      // 2. Fetch Total Literary Entries (Books + Chapters + Sample Questions)
      let literaryEntriesCount = 0;
      try {
        const books = await fetchJambBooks();
        if (books && books.length > 0) {
          // Count total books + total chapters + total novel questions
          books.forEach(b => {
            literaryEntriesCount += 1; // book entry
            if (b.chapters) {
              literaryEntriesCount += b.chapters.length; // chapter entries
              b.chapters.forEach(c => {
                if (c.sampleQuestions) {
                  literaryEntriesCount += c.sampleQuestions.length; // literary questions
                }
              });
            }
          });
        }
      } catch (err) {
        console.warn('Could not count literary entries:', err);
      }

      // Literary entries count calculated from local/database books
      // (literature_books count is already included in literaryEntriesCount above)

      // 3. Fetch Registered Users & Active Students
      const [{ count: usersCount }, { count: studentsCount }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student')
      ]);

      setStats({
        totalQuestions: questionsCount || 0,
        totalLiteraryEntries: literaryEntriesCount || 0,
        totalRegisteredUsers: usersCount || 0,
        activeStudents: studentsCount || 0,
        lastUpdated: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    } catch (e) {
      console.error('Failed to load QuickStats:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuickStats();

    // Listen for custom events triggered during content updates
    const handleUpdate = () => fetchQuickStats();
    window.addEventListener('questions_updated', handleUpdate);
    window.addEventListener('literature_updated', handleUpdate);

    // Periodic poll every 45 seconds for real-time counts
    const interval = setInterval(fetchQuickStats, 45000);

    return () => {
      window.removeEventListener('questions_updated', handleUpdate);
      window.removeEventListener('literature_updated', handleUpdate);
      clearInterval(interval);
    };
  }, [fetchQuickStats]);

  return (
    <div className="space-y-3">
      {/* Component Title Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Real-Time Core Repository Stats</h3>
          <Badge variant="outline" className="text-[10px] h-5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 gap-1 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live DB
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {stats.lastUpdated && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline-block font-mono">
              Updated: {stats.lastUpdated}
            </span>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchQuickStats} 
            disabled={loading}
            className="h-7 text-xs gap-1.5 hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Refresh Real-Time Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Questions Card */}
        <Card className="bg-card text-card-foreground border border-border shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
          <CardContent className="p-4 flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Questions</p>
              <h4 className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground">
                {loading ? '...' : stats.totalQuestions.toLocaleString()}
              </h4>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> CBT Question Bank
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
              <FileQuestion className="w-7 h-7" />
            </div>
          </CardContent>
        </Card>

        {/* Total Literary Entries Card */}
        <Card className="bg-card text-card-foreground border border-border shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all" />
          <CardContent className="p-4 flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Literary Entries</p>
              <h4 className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground">
                {loading ? '...' : stats.totalLiteraryEntries.toLocaleString()}
              </h4>
              <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Novels & Drama Breakdown
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
              <BookOpen className="w-7 h-7" />
            </div>
          </CardContent>
        </Card>

        {/* Total Registered Users Card */}
        <Card className="bg-card text-card-foreground border border-border shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <CardContent className="p-4 flex items-center justify-between relative z-10">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registered Users</p>
              <h4 className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground">
                {loading ? '...' : stats.totalRegisteredUsers.toLocaleString()}
              </h4>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Users className="w-3 h-3" /> {stats.activeStudents.toLocaleString()} Active Students
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <Users className="w-7 h-7" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
