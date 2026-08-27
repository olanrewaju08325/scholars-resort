import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle, XCircle, RefreshCw, MessageSquare, Clock, Zap, Trophy, Home, RotateCcw, CheckCircle2, Target, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { callGroqAPI } from '@/services/aiService';
import { MathText } from '@/components/MathText';
import { triggerConfetti, playSuccessChime } from '@/lib/celebration';
import { generateExamResultPdf } from '@/lib/pdfExport';
import { exportPracticeReportPdf } from '@/lib/practiceReportExporter';

interface ResultsState {
  score?: number;
  total?: number;
  mode?: string;
  questions?: any[];
  answers?: Record<string, string>;
  timeSpentSeconds?: number;
}

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as ResultsState) || {};

  const { score = 0, total = 0, mode = 'Practice', questions = [], answers = {}, timeSpentSeconds = 0 } = state;

  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiResponses, setAiResponses] = useState<Record<string, string>>({});

  const { profile } = useAuth();
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [mistakesCount, setMistakesCount] = useState(0);

  useEffect(() => {
    if (percentage >= 70) {
      triggerConfetti();
      playSuccessChime();
    }
  }, [percentage]);

  // Auto-sync missed questions to the Smart Mistake Bank
  useEffect(() => {
    if (questions && questions.length > 0) {
      const missed = questions.filter(q => answers[q.id] && answers[q.id] !== q.correct_answer);
      if (missed.length > 0) {
        try {
          const existing = JSON.parse(localStorage.getItem('jamb_mistake_bank') || '[]');
          const combined = [...existing, ...missed];
          const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
          localStorage.setItem('jamb_mistake_bank', JSON.stringify(unique));
          setMistakesCount(unique.length);
        } catch (e) {
          console.warn('Mistake bank sync error:', e);
        }
      }
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem('jamb_mistake_bank') || '[]');
        setMistakesCount(stored.length);
      } catch {}
    }
  }, [questions, answers]);

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      if (mode.toLowerCase().includes('practice') || questions.length > 0) {
        // Collect topic breakdown from questions array
        const topicCounts: Record<string, { total: number; correct: number; subject: string }> = {};
        questions.forEach((q) => {
          const tName = q.topic_name || q.topics?.name || 'UTME Core Concept';
          const sName = q.subject_name || q.subjects?.name || 'General';
          const userAnswer = answers[q.id];
          const isCorrect = userAnswer === q.correct_answer;

          if (!topicCounts[tName]) {
            topicCounts[tName] = { total: 0, correct: 0, subject: sName };
          }
          topicCounts[tName].total += 1;
          if (isCorrect) topicCounts[tName].correct += 1;
        });

        const breakdown = Object.entries(topicCounts).map(([topicName, stats]) => {
          const acc = Math.round((stats.correct / stats.total) * 100);
          return {
            topicName,
            subjectName: stats.subject,
            totalAttempted: stats.total,
            correctCount: stats.correct,
            accuracyPercentage: acc,
            masteryStatus: (acc >= 75 ? 'Mastered' : acc >= 55 ? 'Satisfactory' : 'Needs Focus') as 'Mastered' | 'Satisfactory' | 'Needs Focus'
          };
        });

        await exportPracticeReportPdf({
          studentName: profile?.full_name || 'Candidate',
          studentEmail: profile?.email || 'student@scholarsresort.com',
          sessionTitle: `${mode} Diagnostic Report`,
          mode,
          date: new Date().toLocaleDateString('en-GB'),
          score,
          totalQuestions: total,
          percentageScore: percentage,
          timeSpentSeconds,
          topicBreakdown: breakdown.length > 0 ? breakdown : undefined
        });
      } else {
        await generateExamResultPdf({
          studentName: profile?.full_name || 'Candidate',
          examTitle: `${mode} Result Report`,
          score: percentage,
          totalQuestions: total,
          correctAnswers: score,
          accuracy: percentage,
          timeSpentFormatted: formatTime(timeSpentSeconds),
          date: new Date().toLocaleDateString()
        }, 'results-container');
      }
    } catch (e) {
      console.warn('PDF export failed:', e);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const avgTimePerQuestion = total > 0 ? Math.round(timeSpentSeconds / total) : 0;

  const getGrade = () => {
    if (percentage >= 80) return { label: 'Excellent!', color: 'text-emerald-400', bg: 'bg-emerald-500/10', Icon: Trophy };
    if (percentage >= 60) return { label: 'Good Job!', color: 'text-blue-400', bg: 'bg-blue-500/10', Icon: CheckCircle2 };
    if (percentage >= 40) return { label: 'Keep Trying!', color: 'text-amber-400', bg: 'bg-amber-500/10', Icon: Target };
    return { label: 'More Practice Needed', color: 'text-red-400', bg: 'bg-red-500/10', Icon: BookOpen };
  };

  const grade = getGrade();

  const handleAskAI = async (questionId: string, question: any) => {
    setAiLoading(prev => ({ ...prev, [questionId]: true }));
    try {
      const prompt = `Please explain this JAMB question in simple terms for a Nigerian student:

Question: ${question.question_text || question.question}
Options: ${question.options?.map((o: string, i: number) => `${String.fromCharCode(65+i)}. ${o}`).join(', ')}
Correct Answer: ${question.correct_answer}
Official Explanation: ${question.explanation || 'Not provided.'}

Give a short, clear explanation of WHY the correct answer is right, using a simple analogy or example if helpful.`;

      const content = await callGroqAPI([{ role: 'user', content: prompt }]);
      setAiResponses(prev => ({ ...prev, [questionId]: content || 'AI Tutor could not generate an explanation.' }));
    } catch (err) {
      setAiResponses(prev => ({ ...prev, [questionId]: 'Failed to reach AI Tutor. Please check your connection.' }));
    } finally {
      setAiLoading(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const getRetakeLink = () => {
    if (mode === 'Mock') return '/exam';
    return '/practice';
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-10">
        <Link to="/dashboard" className="flex items-center gap-2 text-xl font-bold font-display">
          <img src="/scholar.jpg" alt="Scholars Resort Logo" className="h-6 w-6 rounded-sm object-cover" />
          <span>Scholars Resort</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button onClick={handleDownloadPdf} disabled={downloadingPdf} variant="outline" size="sm" className="border-primary/30 text-primary">
            <Download className="h-4 w-4 mr-2" /> {downloadingPdf ? 'Exporting...' : 'Download PDF'}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={getRetakeLink()}><RotateCcw className="h-4 w-4 mr-2" /> Retake</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/dashboard"><Home className="h-4 w-4 mr-2" /> Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 container max-w-4xl mx-auto">
        {/* Hero Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`text-center mb-10 p-10 rounded-2xl border ${grade.bg} border-border shadow-2xl`}
        >
          <div className="flex justify-center mb-3"><grade.Icon className={`w-12 h-12 ${grade.color}`} /></div>
          <h1 className={`text-3xl font-display font-bold mb-1 ${grade.color}`}>{grade.label}</h1>
          <p className="text-muted-foreground text-sm mb-6">{mode}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-6xl font-display font-bold">{score}<span className="text-2xl text-muted-foreground">/{total}</span></div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Score</p>
            </div>
            <div className="h-16 w-px bg-border hidden sm:block" />
            <div className="text-center">
              <div className={`text-6xl font-display font-bold ${grade.color}`}>{percentage}%</div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Percentage</p>
            </div>
            {timeSpentSeconds > 0 && (
              <>
                <div className="h-16 w-px bg-border hidden sm:block" />
                <div className="text-center">
                  <div className="text-4xl font-display font-bold flex items-center gap-1">
                    <Clock className="w-6 h-6 text-muted-foreground" />
                    {formatTime(timeSpentSeconds)}
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Time Spent</p>
                </div>
              </>
            )}
          </div>
          {avgTimePerQuestion > 0 && (
            <div className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Zap className="w-4 h-4 text-amber-500" />
              Avg. {formatTime(avgTimePerQuestion)} per question
            </div>
          )}

          {/* Smart Mistake Bank Retake Action Callout */}
          {mistakesCount > 0 && (
            <div className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left">
                <h3 className="font-bold text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Smart Mistake Bank: {mistakesCount} Question{mistakesCount > 1 ? 's' : ''} Saved
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Drill only your missed questions until you achieve 100% mastery!
                </p>
              </div>
              <Button
                onClick={() => navigate('/practice/session', { state: { mode: 'mistakes' } })}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 px-4 rounded-lg shadow-sm whitespace-nowrap"
              >
                Retake {mistakesCount} Missed Questions
              </Button>
            </div>
          )}
        </motion.div>

        {/* Review Section */}
        {questions.length > 0 ? (
          <>
            <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" />
              Corrections & Explanations
            </h2>
            <div className="space-y-6">
              {questions.map((q, idx) => {
                const userAnswer = answers[q.id];
                const isCorrect = userAnswer === q.correct_answer;
                const wasSkipped = !userAnswer;
                return (
                  <Card key={q.id} className={`border-l-4 ${isCorrect ? 'border-l-green-500' : wasSkipped ? 'border-l-slate-500' : 'border-l-red-500'} border-border bg-card`}>
                    <CardHeader className="pb-3 border-b border-border">
                      <div className="flex justify-between items-start gap-4">
                        <CardTitle className="text-base leading-relaxed text-foreground">{idx + 1}. {q.question_text}</CardTitle>
                        <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isCorrect ? 'bg-green-500/20 text-green-400' : wasSkipped ? 'bg-slate-500/20 text-slate-400' : 'bg-red-500/20 text-red-400'}`}>
                          {isCorrect ? <><CheckCircle className="w-3 h-3" /> Correct</> : wasSkipped ? 'Skipped' : <><XCircle className="w-3 h-3" /> Wrong</>}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                        {(q.options || []).map((opt: string, i: number) => {
                          const label = String.fromCharCode(65 + i);
                          const isCorrectOpt = opt === q.correct_answer;
                          const isUserOpt = opt === userAnswer;
                          let cls = 'border-border bg-muted/20 text-foreground';
                          if (isCorrectOpt) cls = 'border-green-500 bg-green-500/10 text-green-300 font-semibold';
                          else if (isUserOpt && !isCorrectOpt) cls = 'border-red-500 bg-red-500/10 text-red-300 line-through';
                          return (
                            <div key={i} className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${cls}`}>
                              <span className="font-mono shrink-0">{label}.</span>
                              <span>{opt}</span>
                              {isCorrectOpt && <CheckCircle className="ml-auto w-4 h-4 text-green-500 shrink-0" />}
                              {isUserOpt && !isCorrectOpt && <XCircle className="ml-auto w-4 h-4 text-red-500 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                          <h4 className="font-semibold text-primary mb-2 flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4" /> Official Explanation
                          </h4>
                          <p className="text-sm text-foreground/80 leading-relaxed">{q.explanation}</p>
                        </div>
                      )}

                      {/* AI Tutor */}
                      <div className="mt-2">
                        {!aiResponses[q.id] && !aiLoading[q.id] && (
                          <Button variant="outline" size="sm" onClick={() => handleAskAI(q.id, q)} className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10 text-xs gap-2">
                            <MessageSquare className="h-3 w-3" /> Ask AI Tutor to explain differently
                          </Button>
                        )}
                        {aiLoading[q.id] && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
                            <RefreshCw className="h-4 w-4 animate-spin text-purple-500" />
                            AI Tutor is thinking...
                          </div>
                        )}
                        {aiResponses[q.id] && (
                          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4 mt-2">
                            <h4 className="font-semibold text-purple-400 mb-2 flex items-center gap-2 text-sm">
                              <MessageSquare className="h-4 w-4" /> AI Tutor Explanation
                            </h4>
                            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{aiResponses[q.id]}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Exam Completed!</h2>
            <p className="text-muted-foreground mb-6">Your results have been saved. Detailed review is available when you take exams through the full CBT simulator.</p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="outline"><Link to="/exam"><RotateCcw className="w-4 h-4 mr-2" />Take Another Exam</Link></Button>
              <Button asChild><Link to="/dashboard"><Home className="w-4 h-4 mr-2" />Dashboard</Link></Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Results;
