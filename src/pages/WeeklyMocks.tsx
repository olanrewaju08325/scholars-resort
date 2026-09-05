import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Clock, Trophy, PlayCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useLiveFetch } from '@/hooks/useLiveFetch';
import { DataLoading } from '@/components/DataLoading';
import db from '@/lib/db';
import { toast } from 'sonner';

const WeeklyMocks = () => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<{ hours: number, mins: number, secs: number } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const { data: activeMock, loading } = useLiveFetch<any>(
    async () => {
      // 1. Check admin_settings for authoritative live configuration
      const { data: configRow } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'weekly_mock_config')
        .maybeSingle();

      if (configRow?.setting_value) {
        const config = typeof configRow.setting_value === 'string' 
          ? JSON.parse(configRow.setting_value) 
          : configRow.setting_value;

        if (config.is_active !== false) {
          return {
            data: {
              id: 'admin_configured_mock',
              title: config.title || 'National JAMB UTME Grand Mock Exam',
              description: config.description || 'Synchronized live mock testing student readiness under strict UTME timing.',
              start_time: config.start_time || new Date(Date.now() + 86400000).toISOString(),
              end_time: config.end_time || new Date(Date.now() + 86400000 * 2).toISOString(),
              duration_minutes: config.duration_minutes || 120,
              question_count: config.question_count || 180,
              rolling_mock_closes: config.rolling_mock_closes || 'Closes on Sunday at 11:59 PM',
              cash_prize_summary: config.cash_prize_summary || '₦5,000 for 1st Place | ₦3,000 for 2nd Place | ₦1,000 for 3rd Place',
              contact_instructions: config.contact_instructions || 'Winners receive cash or airtime every Sunday evening.'
            },
            error: null
          };
        }
      }

      // 2. Fallback to mock_exams table
      const { data, error } = await supabase
        .from('mock_exams')
        .select('*')
        .eq('is_active', true)
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      return { data: data || null, error };
    },
    {
      contextName: 'WeeklyMocks.activeMock',
      fallbackData: null
    }
  );

  useEffect(() => {
    if (!activeMock) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const start = new Date(activeMock.start_time).getTime();
      const difference = start - now;

      if (difference > 0) {
        setTimeLeft({
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)) + (Math.floor(difference / (1000 * 60 * 60 * 24)) * 24),
          mins: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          secs: Math.floor((difference % (1000 * 60)) / 1000)
        });
      } else {
        setTimeLeft(null); // It has started!
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeMock]);

  const startRollingMock = () => {
    navigate('/exam?mode=weekly-mock');
  };

  const startSyncedMock = () => {
    if (!activeMock) return;
    navigate(`/exam?mode=synced-mock&id=${activeMock.id}`);
  };

  const handleDownloadOffline = async () => {
    setDownloading(true);
    try {
      // 1. Fetch all subjects
      const { data: subjects } = await supabase.from('subjects').select('*');
      if (subjects) await db.subjects_cache.bulkPut(subjects);

      // 2. Fetch all questions
      const { data: questions } = await supabase.from('questions').select('*');
      if (questions) {
        const parsed = questions.map(q => ({
          ...q,
          options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
          topic: q.topic_id || 'general'
        }));
        await db.questions_cache.bulkPut(parsed);
      }
      
      setDownloaded(true);
      toast.success('Offline pack downloaded successfully!');
    } catch(e) {
      console.error(e);
      toast.error('Failed to download offline pack.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
        <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold font-display">
          <img src="/scholar.jpg" alt="Scholars Resort Logo" className="h-6 w-6 rounded-sm object-cover" />
          <span>Scholars Resort</span>
        </Link>
        <Button variant="ghost" asChild>
          <Link to="/dashboard" className="flex items-center gap-2">
             <ArrowLeft className="w-4 h-4" /> Dashboard
          </Link>
        </Button>
      </header>

      <main className="flex-1 p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-4">Weekly Mock Exams</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Test yourself against thousands of students nationwide. Compete in the synced live event or take the rolling mock at your convenience.
          </p>
        </div>

        {loading ? (
          <DataLoading message="Loading Weekly Mock Events..." subtext="Syncing official JAMB mock schedules and countdowns..." />
        ) : (
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            {/* Rolling Mock */}
            <Card className="border-border bg-card/40 hover:border-primary/50 transition-colors">
              <CardHeader className="text-center pb-4">
                <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-6 w-6" />
                </div>
                <CardTitle className="text-2xl">Rolling Mock</CardTitle>
                <CardDescription>Available all week. Take it on your own schedule.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 text-center">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">Status: <span className="text-green-500">Available Now</span></p>
                  <p className="text-xs text-muted-foreground">{activeMock?.rolling_mock_closes || 'Closes on Sunday at 11:59 PM'}</p>
                </div>
                {activeMock?.cash_prize_summary && (
                  <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>{activeMock.cash_prize_summary}</span>
                  </div>
                )}
                <Button onClick={startRollingMock} className="w-full h-12 text-lg">
                  <PlayCircle className="mr-2 h-5 w-5" /> Start Rolling Mock
                </Button>
                
                <Button 
                  variant="outline" 
                  className={`w-full gap-2 ${downloaded ? 'border-green-500 text-green-500' : 'border-primary/20 text-primary hover:bg-primary/5'}`}
                  onClick={handleDownloadOffline}
                  disabled={downloading || downloaded}
                >
                  {downloading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</>
                  ) : downloaded ? (
                    <><Trophy className="w-4 h-4" /> Downloaded Successfully</>
                  ) : (
                    <>Download Offline Pack</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Synced Event */}
            {activeMock ? (
              <Card className="border-primary/50 bg-primary/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                  Live Event
                </div>
                <CardHeader className="text-center pb-4">
                  <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-2xl">{activeMock.title}</CardTitle>
                  <CardDescription>Everyone starts at the exact same time. Win prizes!</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-center">
                  <div className="p-4 bg-background border border-border rounded-lg shadow-inner">
                    {timeLeft ? (
                      <>
                        <p className="text-sm text-muted-foreground mb-2">Starts In:</p>
                        <div className="flex justify-center gap-4 font-mono text-2xl font-bold">
                          <div className="flex flex-col items-center">
                            <span>{timeLeft.hours.toString().padStart(2, '0')}</span>
                            <span className="text-[10px] text-muted-foreground font-sans uppercase">Hours</span>
                          </div>
                          <span>:</span>
                          <div className="flex flex-col items-center">
                            <span>{timeLeft.mins.toString().padStart(2, '0')}</span>
                            <span className="text-[10px] text-muted-foreground font-sans uppercase">Mins</span>
                          </div>
                          <span>:</span>
                          <div className="flex flex-col items-center text-primary">
                            <span>{timeLeft.secs.toString().padStart(2, '0')}</span>
                            <span className="text-[10px] text-muted-foreground font-sans uppercase">Secs</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">
                          {new Date(activeMock.start_time).toLocaleString()}
                        </p>
                      </>
                    ) : (
                       <div className="py-4">
                         <p className="text-green-500 font-bold text-xl mb-1">Event is LIVE!</p>
                         <p className="text-xs text-muted-foreground">Ends: {new Date(activeMock.end_time).toLocaleString()}</p>
                       </div>
                    )}
                  </div>
                  {timeLeft ? (
                    <Button disabled className="w-full h-12 text-lg">
                      Waiting for start time...
                    </Button>
                  ) : (
                    <Button onClick={startSyncedMock} className="w-full h-12 text-lg bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20">
                      <PlayCircle className="mr-2 h-5 w-5" /> Start Grand Mock
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
               <Card className="border-border bg-card/40 flex flex-col items-center justify-center text-center p-6">
                 <Trophy className="w-12 h-12 text-muted-foreground opacity-20 mb-4" />
                 <CardTitle className="text-xl mb-2">No Scheduled Events</CardTitle>
                 <CardDescription>
                   There are no Synced Grand Mocks scheduled at the moment. Please check back later or take a Rolling Mock!
                 </CardDescription>
               </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default WeeklyMocks;
