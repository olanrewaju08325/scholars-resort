import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  BookOpen, CheckCircle, XCircle, RefreshCw, MessageSquare, 
  Clock, Zap, Trophy, Home, RotateCcw, CheckCircle2, Target, 
  Download, Star, Sparkles, Flame, Award, ShieldCheck, Filter, PlayCircle 
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useAuth } from '@/context/AuthContext';
import { ExplanationCacheService } from '@/services/explanationCacheService';
import { MathText } from '@/components/MathText';
import { triggerConfetti, playSuccessChime } from '@/lib/celebration';
import { generateExamResultPdf } from '@/lib/pdfExport';
import { exportPracticeReportPdf } from '@/lib/practiceReportExporter';
import { ContentNormalizer } from '@/utils/ContentNormalizer';
import { cleanQuestionText } from '@/utils/questionUtils';
import { normalizeToCanonicalSubjectName } from '@/utils/subjectTaxonomy';

interface ResultsState {
  score?: number;
  total?: number;
  mode?: string;
  questions?: any[];
  answers?: Record<string, string>;
  timeSpentSeconds?: number;
  achievements?: Array<{ title: string; description: string; icon: string; xp?: number }>;
  xpEarned?: number;
}

const Results = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as ResultsState) || {};

  const { 
    score = 0, 
    total = 0, 
    mode = 'Practice', 
    questions = [], 
    answers = {}, 
    timeSpentSeconds = 0,
    achievements: stateAchievements,
    xpEarned = 0
  } = state;

  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiResponses, setAiResponses] = useState<Record<string, string>>({});
  const [reviewFilter, setReviewFilter] = useState<'all' | 'missed' | 'correct' | 'skipped'>('all');

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

  // Render icon helper for positive achievements
  const renderAchievementIcon = (iconName: string) => {
    const cls = "w-4 h-4 text-amber-500";
    switch (iconName) {
      case 'Star': return <Star className={cls} />;
      case 'Target': return <Target className="w-4 h-4 text-emerald-500" />;
      case 'Zap': return <Zap className="w-4 h-4 text-amber-500" />;
      case 'Flame': return <Flame className="w-4 h-4 text-orange-500" />;
      case 'RotateCcw': return <RotateCcw className="w-4 h-4 text-rose-500" />;
      case 'BookOpen': return <BookOpen className="w-4 h-4 text-blue-500" />;
      case 'Trophy': return <Trophy className={cls} />;
      default: return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
  };

  // Derive accomplishments the user ACTUALLY achieved in this session
  const effectiveAchievements = stateAchievements && stateAchievements.length > 0
    ? stateAchievements
    : (() => {
        const list: Array<{ title: string; description: string; icon: string; xp?: number }> = [];
        const baseCalculatedXp = 30 + Math.round((percentage / 100) * 40);

        list.push({
          title: `${mode} Completed`,
          description: `Successfully finished all ${total || questions.length || 0} questions in this session`,
          icon: 'CheckCircle2',
          xp: xpEarned || baseCalculatedXp
        });

        if (percentage >= 90) {
          list.push({
            title: 'Mastery Accuracy (90%+)',
            description: `Outstanding accuracy of ${percentage}% reached!`,
            icon: 'Star',
            xp: 50
          });
        } else if (percentage >= 70) {
          list.push({
            title: 'High Achiever (70%+)',
            description: `Strong performance reaching ${percentage}% target score!`,
            icon: 'Target',
            xp: 30
          });
        } else if (score > 0) {
          list.push({
            title: 'Topic Progress',
            description: `Answered ${score} question${score > 1 ? 's' : ''} correctly`,
            icon: 'BookOpen',
            xp: 20
          });
        }

        if (timeSpentSeconds > 0 && total > 0 && (timeSpentSeconds / total) <= 50) {
          list.push({
            title: 'Speed Precision',
            description: `Averaged under ${Math.round(timeSpentSeconds / total)}s per question`,
            icon: 'Zap',
            xp: 25
          });
        }

        if (profile?.streak_days && profile.streak_days > 0) {
          list.push({
            title: `${profile.streak_days}-Day Active Streak`,
            description: 'Maintained continuous daily study momentum',
            icon: 'Flame',
            xp: 15
          });
        }

        return list;
      })();

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      if (mode.toLowerCase().includes('practice') || questions.length > 0) {
        // Collect topic breakdown from questions array
        const topicCounts: Record<string, { total: number; correct: number; subject: string }> = {};
        questions.forEach((q) => {
          const tName = q.topic_name || q.topics?.name || 'UTME Core Concept';
          const rawSName = q.subject_name || q.subjects?.name || 'Use of English';
          const sName = normalizeToCanonicalSubjectName(rawSName);
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
      const explanation = await ExplanationCacheService.getExplanation({
        questionId,
        questionText: cleanQuestionText(question.question_text || question.question),
        correctAnswer: question.correct_answer,
        selectedAnswer: answers[questionId],
        existingExplanation: question.explanation,
        options: question.options
      });
      setAiResponses(prev => ({ ...prev, [questionId]: explanation }));
    } catch (err) {
      setAiResponses(prev => ({ ...prev, [questionId]: 'Failed to retrieve AI Tutor explanation. Please check your connection.' }));
    } finally {
      setAiLoading(prev => ({ ...prev, [questionId]: false }));
    }
  };

  // Filter lists
  const missedList = questions.filter(q => answers[q.id] && answers[q.id] !== q.correct_answer);
  const correctList = questions.filter(q => answers[q.id] === q.correct_answer);
  const skippedList = questions.filter(q => !answers[q.id]);

  const displayedQuestions = questions.filter(q => {
    const userAnswer = answers[q.id];
    const isCorrect = userAnswer === q.correct_answer;
    const wasSkipped = !userAnswer;
    if (reviewFilter === 'missed') return !isCorrect && !wasSkipped;
    if (reviewFilter === 'correct') return isCorrect;
    if (reviewFilter === 'skipped') return wasSkipped;
    return true;
  });

  const handleRetakeExactSession = () => {
    if (mode.toLowerCase().includes('cbt') || mode.toLowerCase().includes('mock') || mode.toLowerCase().includes('exam')) {
      navigate('/exam', { state: { retakeQuestions: questions } });
    } else {
      navigate('/practice/session', { state: { retakeQuestions: questions } });
    }
  };

  const handleRetakeMissedQuestions = () => {
    if (missedList.length > 0) {
      navigate('/practice/session', { state: { retakeQuestions: missedList, mode: 'mistakes' } });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 sticky top-0 z-10">
        <Link to="/dashboard" className="flex items-center gap-2 text-lg sm:text-xl font-bold font-display">
          <img src="/scholar.jpg" alt="Scholars Resort Logo" className="h-6 w-6 rounded-sm object-cover" />
          <span>Scholars Resort</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button onClick={handleDownloadPdf} disabled={downloadingPdf} variant="outline" size="sm" className="border-primary/30 text-primary h-8 sm:h-9 text-xs">
            <Download className="h-3.5 w-3.5 mr-1.5" /> <span className="hidden sm:inline">{downloadingPdf ? 'Exporting...' : 'Download PDF'}</span>
          </Button>
          <Button onClick={handleRetakeExactSession} variant="outline" size="sm" className="h-8 sm:h-9 text-xs">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-primary" /> Retake Exact Exam
          </Button>
          <Button asChild size="sm" className="h-8 sm:h-9 text-xs">
            <Link to="/dashboard"><Home className="h-3.5 w-3.5 mr-1.5" /> Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6 md:p-10 container max-w-4xl mx-auto">
        {/* Hero Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`text-center mb-8 p-6 sm:p-10 rounded-2xl border ${grade.bg} border-border shadow-2xl`}
        >
          <div className="flex justify-center mb-3"><grade.Icon className={`w-12 h-12 ${grade.color}`} /></div>
          <h1 className={`text-2xl sm:text-3xl font-display font-bold mb-1 ${grade.color}`}>{grade.label}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mb-6">{mode}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
            <div className="text-center">
              <div className="text-5xl sm:text-6xl font-display font-bold">{score}<span className="text-2xl text-muted-foreground">/{total}</span></div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Score</p>
            </div>
            <div className="h-16 w-px bg-border hidden sm:block" />
            <div className="text-center">
              <div className={`text-5xl sm:text-6xl font-display font-bold ${grade.color}`}>{percentage}%</div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Percentage</p>
            </div>
            {timeSpentSeconds > 0 && (
              <>
                <div className="h-16 w-px bg-border hidden sm:block" />
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-display font-bold flex items-center justify-center gap-1">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    {formatTime(timeSpentSeconds)}
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Time Spent</p>
                </div>
              </>
            )}
          </div>
          {avgTimePerQuestion > 0 && (
            <div className="mt-4 text-xs sm:text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Zap className="w-4 h-4 text-amber-500" />
              Avg. {formatTime(avgTimePerQuestion)} per question
            </div>
          )}

          {/* Retake & Mistake Drill Actions Bar */}
          <div className="mt-6 pt-6 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={handleRetakeExactSession}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 rounded-xl shadow-xs flex items-center justify-center gap-2 text-xs sm:text-sm"
            >
              <RotateCcw className="w-4 h-4" /> Retake This Exact Session ({questions.length} Qs)
            </Button>

            {missedList.length > 0 ? (
              <Button
                onClick={handleRetakeMissedQuestions}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold h-11 rounded-xl shadow-xs flex items-center justify-center gap-2 text-xs sm:text-sm"
              >
                <Target className="w-4 h-4" /> Retake {missedList.length} Missed Questions
              </Button>
            ) : (
              <Button
                asChild
                variant="outline"
                className="w-full border-border h-11 rounded-xl text-xs sm:text-sm font-medium"
              >
                <Link to="/exam">
                  <PlayCircle className="w-4 h-4 mr-1.5 text-emerald-500" /> Start New CBT Mock
                </Link>
              </Button>
            )}
          </div>
        </motion.div>

        {/* Session Achievements & Milestones Earned (Showing ONLY what student achieved) */}
        {effectiveAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-10"
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                    Session Achievements & Milestones
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Accomplishments unlocked based on your performance in this session
                  </p>
                </div>
              </div>
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-bold px-2.5 py-1">
                {effectiveAchievements.length} Earned
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {effectiveAchievements.map((ach, i) => (
                <div 
                  key={i} 
                  className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10 shadow-xs flex items-start gap-3 transition-all hover:border-amber-500/40"
                >
                  <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 shrink-0">
                    {renderAchievementIcon(ach.icon)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-xs text-foreground truncate">{ach.title}</h4>
                      {ach.xp ? (
                        <span className="bg-amber-500 text-slate-950 text-[10px] px-1.5 py-0.5 rounded-full font-extrabold uppercase shrink-0">
                          +{ach.xp} XP
                        </span>
                      ) : (
                        <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                          Earned
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {ach.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Review Section */}
        {questions.length > 0 ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-bold flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-primary" />
                  Corrections & Review Hub
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Detailed step-by-step solutions with KaTeX mathematical formulas & chemistry structures
                </p>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl border border-border self-start sm:self-auto overflow-x-auto">
                <button
                  onClick={() => setReviewFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reviewFilter === 'all' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  All ({questions.length})
                </button>
                <button
                  onClick={() => setReviewFilter('missed')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reviewFilter === 'missed' ? 'bg-rose-500 text-white shadow-xs' : 'text-rose-500/80 hover:text-rose-600'}`}
                >
                  Missed ({missedList.length})
                </button>
                <button
                  onClick={() => setReviewFilter('correct')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reviewFilter === 'correct' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-600/80 hover:text-emerald-700'}`}
                >
                  Correct ({correctList.length})
                </button>
                <button
                  onClick={() => setReviewFilter('skipped')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reviewFilter === 'skipped' ? 'bg-slate-700 text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Skipped ({skippedList.length})
                </button>
              </div>
            </div>

            <div className="space-y-6">
              {displayedQuestions.map((q, idx) => {
                const originalIdx = questions.findIndex(item => item.id === q.id);
                const userAnswer = answers[q.id];
                const isCorrect = userAnswer === q.correct_answer;
                const wasSkipped = !userAnswer;
                return (
                  <Card key={q.id} className={`border-l-4 ${isCorrect ? 'border-l-green-500' : wasSkipped ? 'border-l-slate-500' : 'border-l-red-500'} border-border bg-card shadow-xs`}>
                    <CardHeader className="pb-3 border-b border-border">
                      <div className="flex justify-between items-start gap-4">
                        <CardTitle className="text-base leading-relaxed text-foreground">
                          <span className="font-bold mr-1.5 text-primary">{originalIdx >= 0 ? originalIdx + 1 : idx + 1}.</span>
                          <MathText text={cleanQuestionText(q.question_text || q.question)} />
                        </CardTitle>
                        <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${isCorrect ? 'bg-green-500/20 text-green-600 dark:text-green-400' : wasSkipped ? 'bg-slate-500/20 text-slate-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                          {isCorrect ? <><CheckCircle className="w-3.5 h-3.5" /> Correct</> : wasSkipped ? 'Skipped' : <><XCircle className="w-3.5 h-3.5" /> Incorrect</>}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
                        {(q.options || []).map((opt: any, i: number) => {
                          const label = String.fromCharCode(65 + i);
                          const optText = ContentNormalizer.cleanOptionText(opt);
                          const optRaw = typeof opt === 'object' && opt !== null ? (opt.text || opt.value || opt.id || '') : String(opt || '');
                          const isCorrectOpt = optText === q.correct_answer || optRaw === q.correct_answer || (typeof opt === 'object' && opt?.id === q.correct_answer) || (label === q.correct_answer);
                          const isUserOpt = optText === userAnswer || optRaw === userAnswer || (typeof opt === 'object' && opt?.id === userAnswer) || (label === userAnswer);
                          let cls = 'border-border bg-muted/20 text-foreground';
                          if (isCorrectOpt) cls = 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300 font-semibold';
                          else if (isUserOpt && !isCorrectOpt) cls = 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 line-through';
                          return (
                            <div key={i} className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${cls}`}>
                              <span className="font-mono font-bold shrink-0">{label}.</span>
                              <span className="break-words flex-1">
                                <MathText text={optText} />
                              </span>
                              {isCorrectOpt && <CheckCircle className="ml-auto w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />}
                              {isUserOpt && !isCorrectOpt && <XCircle className="ml-auto w-4 h-4 text-red-500 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4">
                          <h4 className="font-bold text-primary mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                            <CheckCircle className="h-4 w-4 text-emerald-500" /> Syllabus Correction & Rationale
                          </h4>
                          <div className="text-sm text-foreground/90 leading-relaxed">
                            <MathText text={q.explanation} />
                          </div>
                        </div>
                      )}

                      {/* AI Tutor Explanation with Zero-Token Permanent Cache */}
                      <div className="mt-2">
                        {!aiResponses[q.id] && !aiLoading[q.id] && !q.explanation && (
                          <Button variant="outline" size="sm" onClick={() => handleAskAI(q.id, q)} className="text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 text-xs gap-2 rounded-lg">
                            <MessageSquare className="h-3.5 h-3.5" /> Explain step-by-step
                          </Button>
                        )}
                        {!aiResponses[q.id] && !aiLoading[q.id] && q.explanation && (
                          <Button variant="outline" size="sm" onClick={() => handleAskAI(q.id, q)} className="text-purple-600 dark:text-purple-400 border-purple-500/30 hover:bg-purple-500/10 text-xs gap-2 rounded-lg">
                            <Sparkles className="h-3.5 w-3.5" /> Get deeper breakdown
                          </Button>
                        )}
                        {aiLoading[q.id] && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-purple-500/5 rounded-lg border border-purple-500/20">
                            <RefreshCw className="h-4 w-4 animate-spin text-purple-500" />
                            Retrieving verified tutor breakdown...
                          </div>
                        )}
                        {aiResponses[q.id] && (
                          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mt-2">
                            <h4 className="font-bold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-2 text-xs uppercase tracking-wider">
                              <Sparkles className="h-4 w-4" /> AI Tutor Explanation (Saved to Database)
                            </h4>
                            <div className="text-sm text-foreground/90 leading-relaxed">
                              <MathText text={aiResponses[q.id]} />
                            </div>
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
