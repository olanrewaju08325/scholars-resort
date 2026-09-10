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

      // 1. Check server API for authoritative active challenge
      let activeChallenge: any = null;
      try {
        const res = await fetch('/api/challenges/active');
        const json = await res.json();
        if (json?.success && json.challenge) {
          activeChallenge = json.challenge;
        }
      } catch {}

      // 2. Check admin_settings.weekly_challenges_db
      if (!activeChallenge) {
        try {
          const { data: settingData } = await supabase
            .from('admin_settings')
            .select('setting_value')
            .eq('setting_key', 'weekly_challenges_db')
            .maybeSingle();

          if (settingData?.setting_value && Array.isArray(settingData.setting_value)) {
            const list = settingData.setting_value;
            activeChallenge = list.find((c: any) => c.is_active && c.week_start <= now && c.week_end >= now) 
              || list.find((c: any) => c.is_active) 
              || list[0];
          }
        } catch {}
      }

      // 3. Fallback to localStorage challenges
      if (!activeChallenge) {
        try {
          const localRaw = localStorage.getItem('scholar_weekly_challenges');
          if (localRaw) {
            const parsed = JSON.parse(localRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              activeChallenge = parsed.find((c: any) => c.is_active && c.week_start <= now && c.week_end >= now)
                || parsed.find((c: any) => c.is_active)
                || parsed[0];
            }
          }
        } catch {}
      }

      // 4. Default curated weekly challenge if none yet created by admin
      if (!activeChallenge) {
        activeChallenge = {
          id: 'wc-curated-1',
          title: 'JAMB Speed Master Challenge',
          description: 'Test your quick reasoning under standard UTME timing conditions.',
          subject: 'General UTME',
          xp_reward: 150,
          is_active: true,
          week_start: now,
          week_end: '2026-12-31',
          question: 'A car travels at 60 km/h for 2 hours and then at 90 km/h for 1 hour. What is its average speed for the entire journey?',
          options: ['70 km/h', '75 km/h', '80 km/h', '65 km/h'],
          correct_answer: '70 km/h',
          explanation: 'Total distance = (60 * 2) + (90 * 1) = 120 + 90 = 210 km. Total time = 2 + 1 = 3 hours. Average speed = 210 / 3 = 70 km/h.'
        };
      }

      if (activeChallenge) {
        setChallenge(activeChallenge);

        if (profile?.id || (profile as any)?.email) {
          const effectiveUserId = profile?.id || '';
          const effectiveEmail = profile?.email || '';

          // 1. Check local storage first for immediate zero-latency feedback
          const localSubRaw = localStorage.getItem(`wc_sub_${activeChallenge.id}_${effectiveUserId}`);
          let userSub = localSubRaw ? JSON.parse(localSubRaw) : null;

          // 2. Fetch authoritative submissions from server API
          try {
            const queryParams = new URLSearchParams();
            queryParams.set('challenge_id', activeChallenge.id);
            if (effectiveUserId) queryParams.set('user_id', effectiveUserId);
            if (effectiveEmail) queryParams.set('email', effectiveEmail);

            const res = await fetch(`/api/challenges/submissions?${queryParams.toString()}`);
            const json = await res.json();
            if (json?.success) {
              if (json.participantCount !== undefined) {
                setParticipantCount(json.participantCount);
              }
              if (json.submission) {
                userSub = json.submission;
                localStorage.setItem(`wc_sub_${activeChallenge.id}_${effectiveUserId}`, JSON.stringify(json.submission));
              }
            }
          } catch {
            if (userSub) setParticipantCount(1);
          }

          if (userSub) {
            setSubmission(userSub);
          }
        }
        setLoading(false);
        return;
      }

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
      const qData = challenge.question_data || challenge;
      const rawAns = qData?.correct_answer || qData?.answer || challenge.correct_answer || '';
      const ansString = String(rawAns).trim();
      
      const isCorrect = selectedAnswer === ansString ||
        (ansString.length === 1 && selectedAnswer.toUpperCase().startsWith(ansString.toUpperCase())) ||
        selectedAnswer.toLowerCase().includes(ansString.toLowerCase());

      const res = await fetch('/api/challenges/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_id: challenge.id,
          user_id: profile.id,
          user_name: profile.full_name || profile.email || 'Scholar',
          user_email: profile.email || '',
          selected_answer: selectedAnswer,
          is_correct: isCorrect,
          time_taken_seconds: 45
        })
      });

      const json = await res.json();
      if (json?.success) {
        const savedSub = json.submission || {
          challenge_id: challenge.id,
          user_id: profile.id,
          selected_answer: selectedAnswer,
          is_correct: isCorrect,
          submitted_at: new Date().toISOString()
        };

        // 1. Save local submission state immediately
        localStorage.setItem(`wc_sub_${challenge.id}_${profile.id}`, JSON.stringify(savedSub));
        setSubmission(savedSub);
        if (json.participantCount !== undefined) {
          setParticipantCount(json.participantCount);
        } else {
          setParticipantCount(p => p + 1);
        }

        // 2. Refresh profile XP
        if (refreshProfile) refreshProfile();

        if (isCorrect) {
          toast.success('Correct! You earned +50 XP!', { duration: 4000 });
        } else {
          toast.error('Wrong answer. Keep practicing!');
        }
      } else {
        toast.error(json?.error || 'Failed to record answer. Please try again.');
      }
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

  const questionData = challenge.question_data || challenge;

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
