import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export const TournamentPreview = () => {
  const [nextMock, setNextMock] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNextTournament = async () => {
      try {
        const { data } = await supabase
          .from('tournaments')
          .select('*')
          .eq('status', 'upcoming')
          .gt('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle();
        setNextMock(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchNextTournament();
  }, []);

  return (
    <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/30 shadow-md overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <Swords className="w-24 h-24" />
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-indigo-300">
          <Calendar className="w-5 h-5" /> Next Tournament
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="animate-pulse h-16 bg-white/5 rounded-lg" />
        ) : nextMock ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold font-display text-white">{nextMock.title}</h3>
              <p className="text-sm text-indigo-200/70 mt-1">
                {new Date(nextMock.start_time).toLocaleString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                })}
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-white/10 rounded-md text-xs font-semibold text-white/80">
                {nextMock.duration_minutes} Mins
              </span>
              <span className="px-2 py-1 bg-white/10 rounded-md text-xs font-semibold text-white/80">
                Prize Pool
              </span>
            </div>
            <Button asChild className="w-full bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg">
              <Link to="/tournaments">Register Now</Link>
            </Button>
          </div>
        ) : (
          <div className="py-4 space-y-3">
            <p className="text-sm text-indigo-200/70">No upcoming national mock tournaments scheduled at the moment.</p>
            <Button asChild variant="outline" className="w-full border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/20">
              <Link to="/cbt">Practice Standard Mocks</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
