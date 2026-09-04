import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { safeSupabaseQuery, supabase } from '@/lib/safeSupabase';
import { DataSanitizer } from '@/utils/dataSanitizer';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Swords, Trophy, CheckCircle, XCircle, Clock, Users, Sparkles } from 'lucide-react';

export const WeeklyChallenge = () => {
  const { profile } = useAuth();
  const [challenge, setChallenge] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState('');

  const fetchChallenge = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date().toISOString().split('T')[0];

      // 1. Check admin_settings.weekly_challenges_db (Primary storage in this project)
      let activeChallenge: any = null;
      try {
        const { data: settingData } = await supabase
          .from('admin_settings')
          .select('setting_value')
          .eq('setting_key', 'weekly_challenges_db')
          .maybeSingle();

        if (settingData?.setting_value && Array.isArray(settingData.setting_value)) {
          const list = settingData.setting_value;
          // Match active within window or most recent active
          activeChallenge = list.find((c: any) => c.is_active && c.week_start <= now && c.week_end >= now) 
            || list.find((c: any) => c.is_active) 
            || list[0];
        }
      } catch {}

      // 2. Fallback to weekly_challenges table if needed
      if (!activeChallenge) {
        try {
          const challengesRes = await safeSupabaseQuery(
            supabase
              .from('weekly_challenges')
              .select('*')
              .eq('is_active', true)
              .lte('week_start', now)
              .gte('week_end', now)
              .limit(1),
            {
              contextName: 'WeeklyChallenge.fetchChallenges',
              sanitizer: (data) => DataSanitizer.sanitizeArray(data, DataSanitizer.sanitizeWeeklyChallenge),
              fallbackValue: []
            }
          );

          if (challengesRes.data && challengesRes.data.length > 0) {
            activeChallenge = challengesRes.data[0];
          }
        } catch {}
      }

      // 3. If local fallback exists
      if (!activeChallenge) {
        try {
          const localRaw = localStorage.getItem('scholar_weekly_challenges');
          if (localRaw) {
            const parsed = JSON.parse(localRaw);
            if (Array.isArray(parsed)) {
              const matched = parsed.find((c: any) => c.is_active && c.week_start <= now && c.week_end >= now)
                || parsed.find((c: any) => c.is_active);
              if (matched) {
                activeChallenge = matched;
              }
            }
          }
        } catch {}
      }

      if (activeChallenge) {
        setChallenge(activeChallenge);

        if (profile?.id) {
          try {
            const subRes = await safeSupabaseQuery(
              supabase
                .from('weekly_challenge_submissions')
                .select('*')
                .eq('challenge_id', activeChallenge.id)
                .eq('user_id', profile.id)
                .maybeSingle(),
              { contextName: 'WeeklyChallenge.fetchSubmission', fallbackValue: null }
            );
            if (subRes.data) {
              setSubmission(subRes.data);
            } else {
              const localSub = localStorage.getItem(`wc_sub_${activeChallenge.id}_${profile.id}`);
              if (localSub) setSubmission(JSON.parse(localSub));
            }
          } catch {
            const localSub = localStorage.getItem(`wc_sub_${activeChallenge.id}_${profile.id}`);
            if (localSub) setSubmission(JSON.parse(localSub));
          }

          try {
            const countRes = await safeSupabaseQuery(
              supabase
                .from('weekly_challenge_submissions')
                .select('*', { count: 'exact', head: true })
                .eq('challenge_id', activeChallenge.id),
              { contextName: 'WeeklyChallenge.fetchParticipantCount', fallbackValue: [] }
            );
            setParticipantCount(countRes.count || 0);
          } catch {
            setParticipantCount(0);
          }
        }
        setLoading(false);
        return;
      }

      // If no admin challenge is published, truthfully show no challenge
      setChallenge(null);
    } catch {
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);


  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  useEffect(() => {
    if (!challenge) return;
    const timer = setInterval(() => {
      const end = new Date(challenge.week_end + 'T23:59:59');
      const now = new Date();
      const diff = end.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft('Challenge ended');
        clearInterval(timer);
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${days}d ${hours}h ${minutes}m`);
    }, 1000);
    return () => clearInterval(timer);
  }, [challenge]);

  const handleSubmit = async () => {
    if (!selectedAnswer || !challenge || !profile?.id) return;
    setSubmitting(true);

    try {
      const correctAnswer = challenge.question_data?.answer;
      const isCorrect = selectedAnswer.startsWith(correctAnswer);

      // Try database insert
      try {
        await supabase.from('weekly_challenge_submissions').insert({
          challenge_id: challenge.id,
          user_id: profile.id,
          selected_answer: selectedAnswer,
          is_correct: isCorrect
        });
      } catch (dbErr) {
        console.warn('DB submission fallback:', dbErr);
      }

      // Award XP if correct
      if (isCorrect) {
        try {
          await supabase.from('profiles').update({ xp: (profile.xp || 0) + 50 }).eq('id', profile.id);
          await supabase.from('xp_transactions').insert({ user_id: profile.id, amount: 50, reason: 'Weekly Challenge correct answer' });
        } catch {}
        toast.success('Correct! You earned +50 XP!', { duration: 4000 });
      } else {
        toast.error('Wrong answer. Keep practicing!');
      }

      // Save local submission state
      localStorage.setItem(`wc_sub_${challenge.id}_${profile.id}`, JSON.stringify({ selected_answer: selectedAnswer, is_correct: isCorrect }));
      setSubmission({ selected_answer: selectedAnswer, is_correct: isCorrect });
      setParticipantCount(p => p + 1);
    } catch (err: any) {
      toast.error(`Submission error: ${err.message || 'Please try again'}`);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-8 text-center text-muted-foreground">Loading weekly challenge...</CardContent>
      </Card>
    );
  }

  if (!challenge) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Swords className="w-5 h-5 text-primary" /> Weekly Challenge</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No challenge available this week.</p>
          <p className="text-sm mt-1">Check back soon!</p>
        </CardContent>
      </Card>
    );
  }

  const questionData = challenge.question_data;

  return (
    <Card className="bg-card text-card-foreground border-border overflow-hidden">
      {/* Header Banner */}
      <div className="bg-primary p-4 text-primary-foreground">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-primary-foreground" />
            <span className="font-bold text-primary-foreground">Weekly Challenge</span>
          </div>
          <div className="flex items-center gap-4 text-primary-foreground/90 text-sm">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {participantCount} participating
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> {timeLeft}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-primary-foreground/80 uppercase font-semibold tracking-wider">{challenge.subject}</div>
      </div>

      <CardContent className="p-6 space-y-4">
        <h3 className="text-base font-semibold leading-relaxed">{questionData?.question}</h3>

        {submission ? (
          // Show results
          <div className="space-y-3">
            <div className={`flex items-center gap-3 p-4 rounded-xl ${submission.is_correct ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              {submission.is_correct ? (
                <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500 shrink-0" />
              )}
              <div>
                <div className="font-bold">{submission.is_correct ? 'Correct! +50 XP' : 'Not quite!'}</div>
                <div className="text-sm text-muted-foreground">Your answer: {submission.selected_answer}</div>
              </div>
            </div>
            
            {!submission.is_correct && questionData?.explanation && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <div className="text-xs font-bold text-blue-400 uppercase mb-1">Explanation</div>
                <p className="text-sm">{questionData.explanation}</p>
              </div>
            )}
          </div>
        ) : (
          // Show options
          <div className="space-y-3">
            {questionData?.options?.map((option: string) => (
              <button
                key={option}
                onClick={() => setSelectedAnswer(option)}
                className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${
                  selectedAnswer === option
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border hover:border-primary/50 hover:bg-primary/5'
                }`}
              >
                {option}
              </button>
            ))}
            
            <Button
              onClick={handleSubmit}
              disabled={!selectedAnswer || submitting}
              className="w-full mt-4 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 transition-opacity"
            >
              {submitting ? 'Submitting...' : 'Submit Answer'}
            </Button>
          </div>
        )}
        
        <div className="text-center text-xs text-muted-foreground border-t border-border pt-4">
          <Trophy className="w-4 h-4 inline mr-1 text-yellow-500" />
          Earn 50 XP for a correct answer
        </div>
      </CardContent>
    </Card>
  );
};
