import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, BrainCircuit, TrendingUp, AlertTriangle, GraduationCap, Target, Sparkles, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { callGroqAPI } from '@/services/aiService';

interface PredictionResult {
  predicted_score: number;
  confidence: string;
  chance_of_admission: string;
  top_courses: { course: string; university: string; chance: string }[];
  weak_areas: string[];
  improvements: string[];
  verdict: string;
  completion_prediction?: {
    daily_pace: number;
    total_remaining_questions: number;
    days_to_completion: number;
    estimated_completion_date: string;
    reasoning_steps: string[];
  };
}

export const JAMBScorePredictor = () => {
  const { profile } = useAuth();
  const [targetCourse, setTargetCourse] = useState('');
  const [targetUniversity, setTargetUniversity] = useState('');
  const [recentMockScore, setRecentMockScore] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);

  const handlePredict = async () => {
    if (!profile?.id) return;
    setLoading(true);
    setResult(null);

    try {
      // Fetch actual performance data
      const { data: sessions, error: sessErr } = await supabase
        .from('exam_sessions')
        .select('score, total_questions, created_at, submitted_at')
        .eq('user_id', profile.id)
        .eq('status', 'submitted')
        .order('created_at', { ascending: false })
        .limit(10);

      if (sessErr) {
        console.warn('[JAMBScorePredictor] exam_sessions query notice:', sessErr);
      }

      let answers: any[] = [];
      try {
        const { data: ansData } = await supabase
          .from('session_answers')
          .select('question_id, is_correct')
          .eq('user_id', profile.id)
          .limit(200);
        if (ansData) answers = ansData;
      } catch {}

      // Aggregate subject performance
      const subjectScores: Record<string, { correct: number; total: number }> = {};
      if (answers && answers.length > 0) {
        const qIds = Array.from(new Set(answers.map((a: any) => a.question_id).filter(Boolean)));
        if (qIds.length > 0) {
          try {
            const { data: qList } = await supabase
              .from('questions')
              .select('id, subject_id')
              .in('id', qIds.slice(0, 50));

            const subIds = Array.from(new Set((qList || []).map((q: any) => q.subject_id).filter(Boolean)));
            let subMap: Record<string, string> = {};
            if (subIds.length > 0) {
              const { data: subs } = await supabase.from('subjects').select('id, name').in('id', subIds);
              (subs || []).forEach((s: any) => { subMap[s.id] = s.name; });
            }

            const qSubMap: Record<string, string> = {};
            (qList || []).forEach((q: any) => {
              if (q.subject_id && subMap[q.subject_id]) qSubMap[q.id] = subMap[q.subject_id];
            });

            answers.forEach((a: any) => {
              const name = qSubMap[a.question_id] || 'General';
              if (!subjectScores[name]) subjectScores[name] = { correct: 0, total: 0 };
              subjectScores[name].total++;
              if (a.is_correct) subjectScores[name].correct++;
            });
          } catch {}
        }
      }

      const subjectSummary = Object.entries(subjectScores).length > 0
        ? Object.entries(subjectScores)
            .map(([name, s]) => `${name}: ${Math.round((s.correct / s.total) * 100)}%`)
            .join(', ')
        : (profile?.utme_subjects?.join(', ') || 'English, Mathematics, Physics, Chemistry');

      const averageScore = sessions && sessions.length > 0
        ? Math.round(sessions.reduce((acc, s) => acc + ((s.score || 0) / (s.total_questions || 50)) * 400, 0) / sessions.length)
        : null;

      const trend = sessions && sessions.length >= 2
        ? (sessions[0].score > sessions[1].score ? 'improving' : 'declining')
        : 'stable';

      // Calculate completion velocity & date prediction based on practice history
      const totalExamQuestionsSolved = sessions?.reduce((acc, s) => acc + (s.total_questions || 20), 0) || answers?.length || 15;
      const daysActive = Math.max(1, profile?.streak_days || 1);
      const dailyVelocity = Math.max(5, Math.round(totalExamQuestionsSolved / daysActive));
      const totalSyllabusQuestions = 1200; // Target high-frequency question pool
      const remainingQuestions = Math.max(50, totalSyllabusQuestions - totalExamQuestionsSolved);
      const daysToCompletion = Math.ceil(remainingQuestions / dailyVelocity);
      
      const targetCompletionDate = new Date();
      targetCompletionDate.setDate(targetCompletionDate.getDate() + daysToCompletion);
      const formattedDate = targetCompletionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const prompt = `You are a JAMB academic advisor AI. Based on the student performance data, calculate their score prediction, completion date, and step-by-step non-technical reasoning.

Student Performance:
- Average JAMB mock score (over last ${sessions?.length || 0} exams): ${recentMockScore || averageScore || 'Not enough data'}/400
- Score trend: ${trend}
- Subject-level accuracy: ${subjectSummary || 'Insufficient data yet'}
- Daily Practice Pace: ~${dailyVelocity} questions/day over ${daysActive} active days
- Target course: ${targetCourse || 'Not specified'}
- Target university: ${targetUniversity || 'Not specified'}

Return STRICT JSON format:
{
  "predicted_score": 280,
  "confidence": "Medium",
  "chance_of_admission": "Fair",
  "completion_prediction": {
    "daily_pace": ${dailyVelocity},
    "total_remaining_questions": ${remainingQuestions},
    "days_to_completion": ${daysToCompletion},
    "estimated_completion_date": "${formattedDate}",
    "reasoning_steps": [
      "1. Pace Analysis: At your current rate of ${dailyVelocity} practice questions per day, you cover roughly ${dailyVelocity * 7} questions weekly.",
      "2. Syllabus Coverage: You have completed ${totalExamQuestionsSolved} questions out of the 1,200 core high-yield UTME question bank.",
      "3. Time Estimate: Covering the remaining ${remainingQuestions} questions will take approximately ${daysToCompletion} days of consistent daily practice.",
      "4. Target Date: Reaching full syllabus readiness is projected for ${formattedDate}."
    ]
  },
  "top_courses": [
    {"course": "Computer Science", "university": "UNILAG", "chance": "High"}
  ],
  "weak_areas": ["Physics", "Mathematics"],
  "improvements": ["Spend 1 extra hour on Physics daily", "Complete 50 Math questions per day"],
  "verdict": "Your current trajectory shows steady progress. Maintaining your practice pace will ensure full syllabus readiness before the exam."
}

Do NOT include any emojis anywhere in your output. Return ONLY valid JSON.`;

      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart === -1) throw new Error('No JSON returned');

      const parsed = JSON.parse(content.substring(jsonStart, jsonEnd + 1));
      setResult(parsed);
    } catch (err: any) {
      console.error('Score prediction failed:', err);
      // Fallback with graceful message
      setResult({
        predicted_score: 0,
        confidence: 'N/A',
        chance_of_admission: 'Unable to predict',
        top_courses: [],
        weak_areas: [],
        improvements: ['Please take at least 3 practice exams for accurate predictions.'],
        verdict: 'Not enough data to generate a prediction. Take more practice exams and come back!'
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 280) return 'text-green-400';
    if (score >= 200) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <Card className="bg-slate-950/60 backdrop-blur-md border-slate-800 text-slate-100 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <CardHeader className="relative z-10 pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BrainCircuit className="w-5 h-5 text-purple-400" />
          JAMB Score Predictor
          <span className="ml-auto text-xs font-normal text-purple-400/70 bg-purple-500/10 border border-purple-500/20 px-2 py-1 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI Powered
          </span>
        </CardTitle>
        <p className="text-sm text-slate-400">Predict your likely JAMB score based on real performance data.</p>
      </CardHeader>

      <CardContent className="relative z-10 space-y-4">
        {/* Optional Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Course (optional)</label>
            <Input
              value={targetCourse}
              onChange={e => setTargetCourse(e.target.value)}
              placeholder="e.g. Medicine & Surgery"
              className="bg-slate-900 border-slate-700 text-slate-200 focus:border-purple-500/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target University (optional)</label>
            <Input
              value={targetUniversity}
              onChange={e => setTargetUniversity(e.target.value)}
              placeholder="e.g. University of Lagos"
              className="bg-slate-900 border-slate-700 text-slate-200 focus:border-purple-500/50"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Mock Score Override (optional)</label>
          <Input
            type="number"
            min="0"
            max="400"
            value={recentMockScore}
            onChange={e => setRecentMockScore(e.target.value)}
            placeholder="Override with a specific score (0–400)"
            className="bg-slate-900 border-slate-700 text-slate-200 focus:border-purple-500/50"
          />
        </div>

        <Button
          onClick={handlePredict}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 font-bold shadow-lg shadow-purple-500/25 h-11"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Performance...</>
          ) : (
            <><TrendingUp className="w-4 h-4 mr-2" /> Predict My JAMB Score</>
          )}
        </Button>

        {result && (
          <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Score Display */}
            {result.predicted_score > 0 && (
              <div className="text-center py-6 bg-slate-900/70 rounded-2xl border border-slate-800">
                <div className={`text-7xl font-black font-mono ${getScoreColor(result.predicted_score)}`}>
                  {result.predicted_score}
                </div>
                <div className="text-sm text-slate-400 mt-2">Predicted JAMB Score / 400</div>
                <div className="flex justify-center gap-4 mt-3">
                  <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
                    Confidence: {result.confidence}
                  </span>
                  <span className="text-xs bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-slate-300">
                    Admission Chance: {result.chance_of_admission}
                  </span>
                </div>
              </div>
            )}

            {/* Verdict */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
              <p className="text-sm text-slate-300 leading-relaxed italic">{result.verdict}</p>
            </div>

            {/* Completion Date Prediction & Step-by-Step Reasoning */}
            {result.completion_prediction && (
              <div className="bg-slate-900/80 border border-purple-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-400" /> Syllabus Completion Forecast
                  </h4>
                  <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Est. {result.completion_prediction.estimated_completion_date}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Daily Solving Velocity</span>
                    <span className="text-sm font-bold text-slate-200 font-mono">{result.completion_prediction.daily_pace} Qs / day</span>
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 block text-[11px]">Estimated Days Left</span>
                    <span className="text-sm font-bold text-slate-200 font-mono">{result.completion_prediction.days_to_completion} Days</span>
                  </div>
                </div>

                {/* Step-by-Step Reasoning Breakdown */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Step-by-Step Calculation Breakdown:</span>
                  {result.completion_prediction.reasoning_steps?.map((step, idx) => (
                    <div key={idx} className="text-xs text-slate-300 bg-slate-950/40 border border-slate-800/80 rounded-md px-3 py-1.5 leading-relaxed">
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Course Matches */}
            {result.top_courses && result.top_courses.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><GraduationCap className="w-3 h-3" /> Best Course Matches</h4>
                {result.top_courses.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-slate-900/50 border border-slate-800 rounded-lg px-3 py-2">
                    <span className="text-slate-200 font-medium">{c.course} — <span className="text-slate-400 font-normal">{c.university}</span></span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.chance === 'High' ? 'text-green-400 bg-green-500/10' : c.chance === 'Medium' ? 'text-yellow-400 bg-yellow-500/10' : 'text-red-400 bg-red-500/10'}`}>
                      {c.chance}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Weak Areas & Improvements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.weak_areas && result.weak_areas.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Weak Areas</h4>
                  {result.weak_areas.map((area, i) => (
                    <div key={i} className="text-xs text-slate-300 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">• {area}</div>
                  ))}
                </div>
              )}
              {result.improvements && result.improvements.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-green-400 flex items-center gap-1"><Target className="w-3 h-3" /> Action Plan</h4>
                  {result.improvements.map((tip, i) => (
                    <div key={i} className="text-xs text-slate-300 bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">• {tip}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
