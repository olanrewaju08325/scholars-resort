import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { safeSupabaseQuery, supabase } from '@/lib/safeSupabase';
import { DataSanitizer } from '@/utils/dataSanitizer';

export const LeaderboardPreview = () => {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const res = await safeSupabaseQuery(
        supabase
          .from('leaderboard_entries')
          .select('user_id, score, rank, full_name, avatar_url')
          .order('score', { ascending: false })
          .limit(5),
        {
          contextName: 'LeaderboardPreview.fetchLeaderboard',
          sanitizer: (data) => DataSanitizer.sanitizeArray(data, DataSanitizer.sanitizeLeaderboardEntry),
          fallbackValue: []
        }
      );
      setLeaders(res.data);
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  return (
    <Card className="bg-card text-card-foreground border-border shadow-md opacity-100">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> Global Top 5
          </CardTitle>
          <Button asChild variant="link" size="sm" className="h-auto p-0 text-muted-foreground hover:text-primary font-semibold">
            <Link to="/leaderboard">View All <ChevronRight className="w-4 h-4 ml-1" /></Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 p-0">
        <div className="divide-y divide-border/50">
          {loading ? (
             <div className="p-4 text-center text-sm text-muted-foreground">Loading ranks...</div>
          ) : leaders.length === 0 ? (
             <div className="p-4 text-center text-sm text-muted-foreground">No entries recorded yet. Complete CBT practice tests to claim your rank!</div>
          ) : (
            leaders.map((entry, index) => (
              <div key={entry.user_id ? `leaderboard-user-${entry.user_id}` : `leaderboard-idx-${index}`} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                    ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' : 
                      index === 1 ? 'bg-slate-400/20 text-slate-400' : 
                      index === 2 ? 'bg-amber-600/20 text-amber-600' : 
                      'bg-muted text-muted-foreground'}`}>
                    {index === 0 ? <Medal className="w-4 h-4" /> : index + 1}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-foreground">{entry.full_name || 'Scholar Candidate'}</div>
                    <p className="text-xs text-muted-foreground">{entry.score} pts</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

