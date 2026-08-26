import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { safeSupabaseQuery, supabase } from '@/lib/safeSupabase';
import { DataSanitizer } from '@/utils/dataSanitizer';

export const TournamentPreview = () => {
  const [nextMock, setNextMock] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNextTournament = async () => {
      const res = await safeSupabaseQuery(
        supabase
          .from('tournaments')
          .select('*')
          .eq('status', 'upcoming')
          .gt('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle(),
        {
          contextName: 'TournamentPreview.fetchNextTournament',
          sanitizer: (data) => DataSanitizer.sanitizeTournament(data),
          fallbackValue: null
        }
      );
      setNextMock(res.data);
      setLoading(false);
    };
    fetchNextTournament();
  }, []);

  return (
    <Card className="bg-card text-card-foreground border-border shadow-md opacity-100 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
        <Swords className="w-24 h-24 text-primary" />
      </div>
      <CardHeader className="pb-2 border-b border-border/50">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
          <Calendar className="w-5 h-5 text-primary" /> Next Tournament
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        {loading ? (
          <div className="animate-pulse h-16 bg-muted/40 rounded-lg" />
        ) : nextMock ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold font-display text-foreground">{nextMock.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                {new Date(nextMock.start_time).toLocaleString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-2.5 py-1 bg-primary/10 rounded-md text-xs font-semibold text-primary">
                {nextMock.duration_minutes} Mins
              </span>
              <span className="px-2.5 py-1 bg-primary/10 rounded-md text-xs font-semibold text-primary">
                {nextMock.prize_pool || 'Prize Pool'}
              </span>
            </div>
            <Button asChild className="w-full bg-primary text-primary-foreground font-bold shadow-sm">
              <Link to="/tournaments">Register Now</Link>
            </Button>
          </div>
        ) : (
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">No upcoming national mock tournaments scheduled at the moment.</p>
            <Button asChild variant="outline" className="w-full border-border text-foreground hover:bg-muted">
              <Link to="/cbt">Practice Standard Mocks</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

