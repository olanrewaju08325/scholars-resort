import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Swords, Trophy, CheckCircle, XCircle, Clock, Users, Sparkles } from 'lucide-react';
import { callGroqAPI } from '@/services/aiService';

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
    const now = new Date().toISOString().split('T')[0];
    let userSubj = 'Use of English';

    if (profile?.id) {
      try {
        const { data: userSubjs } = await supabase
          .from('student_subjects')
          .select('subjects(name)')
          .eq('student_id', profile.id);

        if (userSubjs && userSubjs.length > 0) {
          const names = userSubjs.map((s: any) => s.subjects?.name).filter(Boolean);
          if (names.length > 0) {
            userSubj = names[Math.floor(Math.random() * names.length)];
          }
        }
      } catch {}
    }

    try {
      const { data: challenges } = await supabase
        .from('weekly_challenges')
        .select('*')
        .eq('is_active', true)
        .lte('week_start', now)
        .gte('week_end', now)
        .limit(1);

      if (challenges && challenges.length > 0) {
        const c = challenges[0];
        setChallenge(c);

        if (profile?.id) {
          const { data: sub } = await supabase
            .from('weekly_challenge_submissions')
            .select('*')
            .eq('challenge_id', c.id)
            .eq('user_id', profile.id)
            .maybeSingle();
          if (sub) setSubmission(sub);
        }

        const { count } = await supabase
          .from('weekly_challenge_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('challenge_id', c.id);
        setParticipantCount(count || 0);
        setLoading(false);
        return;
      }

      const prompt = `Generate 1 challenging JAMB UTME examination question for subject "${userSubj}". 
Return strictly JSON object format without markdown block backticks:
{
  "question": "Clear, high-yield question string",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "answer": "A",
  "explanation": "Detailed step-by-step reasoning."
}`;

      const aiResponse = await callGroqAPI([
        { role: 'system', content: 'You are an expert JAMB UTME test writer.' },
        { role: 'user', content: prompt }
      ]);

      if (aiResponse) {
        try {
          const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse);

          if (parsed.question && Array.isArray(parsed.options) && parsed.answer) {
            const nextSunday = new Date();
            nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));

            setChallenge({
              id: `ai_challenge_${userSubj.toLowerCase().replace(/\s+/g, '_')}_${now}`,
              title: `AI Weekly High-Yield Challenge: ${userSubj}`,
              subject: userSubj,
              xp_reward: 100,
              week_start: now,
              week_end: nextSunday.toISOString().split('T')[0],
              question_data: {
                question: parsed.question,
                options: parsed.options,
                answer: String(parsed.answer).replace(/[^A-D]/g, '') || 'A',
                explanation: parsed.explanation || 'Step-by-step solution based on JAMB UTME syllabus.'
              }
            });
            setParticipantCount(18);
            setLoading(false);
            return;
          }
        } catch {}
      }

      const { data: qData } = await supabase
        .from('questions')
        .select('*, subjects(name)')
        .eq('is_active', true)
        .limit(10);

      if (qData && qData.length > 0) {
        const dbQ = qData[Math.floor(Math.random() * qData.length)];
        const opts = typeof dbQ.options === 'string' ? JSON.parse(dbQ.options) : dbQ.options;
        const nextSunday = new Date();
        nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));

        setChallenge({
          id: `db_challenge_${dbQ.id}`,
          title: `UTME Master Challenge: ${dbQ.subjects?.name || userSubj}`,
          subject: dbQ.subjects?.name || userSubj,
          xp_reward: 100,
          week_start: now,
          week_end: nextSunday.toISOString().split('T')[0],
          question_data: {
            question: dbQ.question_text,
            options: Array.isArray(opts) ? opts : ['A) Option 1', 'B) Option 2', 'C) Option 3', 'D) Option 4'],
            answer: dbQ.correct_answer?.substring(0, 1)?.toUpperCase() || 'A',
            explanation: dbQ.explanation || 'Detailed solution from question bank.'
          }
        });
        setParticipantCount(25);
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
    <Card className="bg-card border-border overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-primary/80 to-purple-600/80 p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-white" />
            <span className="font-bold text-white">Weekly Challenge</span>
          </div>
          <div className="flex items-center gap-4 text-white/80 text-sm">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" /> {participantCount} participating
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> {timeLeft}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-white/70 uppercase font-semibold tracking-wider">{challenge.subject}</div>
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
