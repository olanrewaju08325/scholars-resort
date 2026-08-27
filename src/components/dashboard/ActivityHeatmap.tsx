import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ActivityHeatmap = () => {
  const { profile } = useAuth();
  const [days, setDays] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [consistencyScore, setConsistencyScore] = useState(0);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!profile) return;
      
      const thirtyFiveDaysAgo = new Date();
      thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);
      const isoThreshold = thirtyFiveDaysAgo.toISOString();

      const logsByDate: Record<string, number> = {};

      try {
        const { data: logData } = await supabase
          .from('study_logs')
          .select('created_at')
          .eq('user_id', profile.id)
          .gte('created_at', isoThreshold);

        logData?.forEach(log => {
          if (log.created_at) {
            const d = new Date(log.created_at).toISOString().split('T')[0];
            logsByDate[d] = (logsByDate[d] || 0) + 1;
          }
        });
      } catch {}

      try {
        const { data: sessionData } = await supabase
          .from('exam_sessions')
          .select('submitted_at, created_at')
          .eq('user_id', profile.id)
          .gte('created_at', isoThreshold);

        sessionData?.forEach(sess => {
          const rawDate = sess.submitted_at || sess.created_at;
          if (rawDate) {
            const d = new Date(rawDate).toISOString().split('T')[0];
            logsByDate[d] = (logsByDate[d] || 0) + 1;
          }
        });
      } catch {}

      // Build grid for the last 35 days, ending today
      const grid = [];
      let activeDaysCount = 0;

      for (let i = 34; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        const intensity = logsByDate[dateString] || 0;
        
        if (intensity > 0) activeDaysCount++;
        grid.push(Math.min(intensity, 4)); // cap intensity at 4 for coloring
      }

      setDays(grid);
      setConsistencyScore(Math.round((activeDaysCount / 35) * 100));
      setLoading(false);
    };

    fetchLogs();
  }, [profile]);

  const getColor = (intensity: number) => {
    switch (intensity) {
      case 0: return 'bg-muted/60 border border-border/60';
      case 1: return 'bg-emerald-500/20 border border-emerald-500/30';
      case 2: return 'bg-emerald-500/40 border border-emerald-500/50';
      case 3: return 'bg-emerald-500/70 border border-emerald-500/80';
      case 4: return 'bg-emerald-500 text-white border border-emerald-600 shadow-sm';
      default: return 'bg-muted/60 border border-border/60';
    }
  };

  return (
    <Card className="bg-card text-card-foreground border-border shadow-md overflow-hidden relative">
      {/* Background flare */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <CardContent className="p-6 relative z-10">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h3 className="text-lg font-bold font-display text-foreground">Study Heatmap</h3>
            <p className="text-sm text-muted-foreground mt-1">Your consistency over the last 35 days</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {consistencyScore}%
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">Consistency</div>
          </div>
        </div>

        {loading ? (
           <div className="h-[120px] flex items-center justify-center">
             <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
           </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 md:gap-3">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="text-center text-[10px] uppercase font-bold text-muted-foreground mb-2">
                  {day}
                </div>
              ))}
              {days.map((intensity, i) => {
                // Calculate date for tooltip
                const d = new Date();
                d.setDate(d.getDate() - (34 - i));
                const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                return (
                  <div 
                    key={i} 
                    className={`aspect-square rounded-md transition-all duration-300 hover:scale-110 hover:ring-2 ring-emerald-400/50 cursor-pointer ${getColor(intensity)}`}
                    title={`${dateStr}: ${intensity > 0 ? intensity + ' sessions' : 'No study activity'}`}
                  />
                );
              })}
            </div>
            
            <div className="flex items-center justify-end gap-2 mt-6 text-xs text-muted-foreground">
              <span className="font-medium text-[10px] uppercase tracking-wider">Less</span>
              <div className="flex gap-1.5">
                <div className="w-3.5 h-3.5 rounded bg-muted/60 border border-border/60" />
                <div className="w-3.5 h-3.5 rounded bg-emerald-500/20 border border-emerald-500/30" />
                <div className="w-3.5 h-3.5 rounded bg-emerald-500/40 border border-emerald-500/50" />
                <div className="w-3.5 h-3.5 rounded bg-emerald-500/70 border border-emerald-500/80" />
                <div className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-600" />
              </div>
              <span className="font-medium text-[10px] uppercase tracking-wider">More</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
