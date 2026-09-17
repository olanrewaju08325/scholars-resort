import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, 
  CheckCircle2, 
  AlertCircle, 
  Target, 
  Sparkles, 
  BookOpen, 
  ArrowUpRight, 
  RotateCcw, 
  Filter, 
  ChevronRight, 
  ChevronDown, 
  Zap, 
  BrainCircuit, 
  HelpCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { MathText } from '@/components/MathText';
import { SmartMistakeEngine, type TopicMistakeSummary } from '@/services/smartMistakeEngine';
import { toast } from 'sonner';

export const LearningProgressDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [summaries, setSummaries] = useState<TopicMistakeSummary[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedMastery, setSelectedMastery] = useState<string>('all');
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const data = await SmartMistakeEngine.getTopicPerformanceSummaries();
      setSummaries(data);
    } catch (err) {
      toast.error('Failed to load learning progress metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();

    const handleReset = () => {
      fetchPerformanceData();
    };

    window.addEventListener('scholars_study_data_reset', handleReset);
    window.addEventListener('scholars_session_completed', handleReset);

    return () => {
      window.removeEventListener('scholars_study_data_reset', handleReset);
      window.removeEventListener('scholars_session_completed', handleReset);
    };
  }, []);

  // Filter subjects
  const subjectsList = Array.from(new Set(summaries.map(s => typeof s.subjectName === 'object' ? (s.subjectName as any)?.name : String(s.subjectName || '')))).filter(Boolean);

  const filteredSummaries = summaries.filter(s => {
    const sName = typeof s.subjectName === 'object' ? (s.subjectName as any)?.name : String(s.subjectName || '');
    if (selectedSubject !== 'all' && sName !== selectedSubject) return false;
    if (selectedMastery !== 'all' && s.masteryStatus.toLowerCase() !== selectedMastery.toLowerCase()) return false;
    return true;
  });

  // Global metrics calculation
  const totalAttempted = summaries.reduce((acc, s) => acc + s.totalAttempted, 0);
  const totalCorrect = summaries.reduce((acc, s) => acc + s.correctCount, 0);
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const masteredCount = summaries.filter(s => s.masteryStatus === 'Mastered').length;
  const needsReviewCount = summaries.filter(s => s.masteryStatus === 'Needs Review').length;
  const totalMissedItems = summaries.reduce((acc, s) => acc + s.missedCount, 0);

  const handleLaunchDrill = (topicSummary: TopicMistakeSummary) => {
    toast.info(`Launching targeted drill for ${topicSummary.topicName}...`);
    navigate('/practice/session', {
      state: {
        subjectName: topicSummary.subjectName,
        topicName: topicSummary.topicName,
        topicId: topicSummary.topicId,
        mode: 'weakness',
        retakeQuestions: topicSummary.missedQuestions.length > 0 ? topicSummary.missedQuestions : undefined
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-purple-500/10 to-blue-500/10 border border-primary/20 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Syllabus Analytics Engine</span>
          </div>
          <h2 className="text-2xl font-bold font-display text-foreground">Learning Progress & Remediation Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Non-technical, real-time performance tracking with automated sub-topic gap identification.
          </p>
        </div>

        <Button onClick={fetchPerformanceData} variant="outline" size="sm" className="shrink-0 gap-2 text-xs border-primary/30">
          <RotateCcw className="w-3.5 h-3.5" /> Refresh Analytics
        </Button>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Overall Accuracy</p>
              <p className="text-2xl sm:text-3xl font-display font-bold text-foreground mt-1">{overallAccuracy}%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{totalCorrect} correct of {totalAttempted} answered</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <BarChart2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Topics Mastered</p>
              <p className="text-2xl sm:text-3xl font-display font-bold text-emerald-600 dark:text-emerald-400 mt-1">{masteredCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">&ge; 75% accuracy threshold</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Needs Review</p>
              <p className="text-2xl sm:text-3xl font-display font-bold text-amber-600 dark:text-amber-400 mt-1">{needsReviewCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">&lt; 50% accuracy threshold</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <AlertCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Remediation Queue</p>
              <p className="text-2xl sm:text-3xl font-display font-bold text-rose-600 dark:text-rose-400 mt-1">{totalMissedItems}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Missed items ready to retake</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <Target className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Controls Bar */}
      <Card className="border-border bg-card shadow-xs">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground">
            <Filter className="w-4 h-4 text-primary" />
            <span>Filter Performance Table:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Subject Selector */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="bg-background border border-border text-foreground text-xs rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Subjects ({summaries.length} topics)</option>
              {subjectsList.map(subj => (
                <option key={subj} value={subj}>{subj}</option>
              ))}
            </select>

            {/* Mastery Status Selector */}
            <select
              value={selectedMastery}
              onChange={(e) => setSelectedMastery(e.target.value)}
              className="bg-background border border-border text-foreground text-xs rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Mastery Levels</option>
              <option value="mastered">Mastered (&ge; 75%)</option>
              <option value="developing">Developing (50% - 74%)</option>
              <option value="needs review">Needs Review (&lt; 50%)</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Main Performance Table */}
      <Card className="border-border bg-card shadow-xs overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20 pb-4">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> Syllabus Topic Performance Table
          </CardTitle>
          <CardDescription className="text-xs">
            Clear summary of attempted questions, accuracy percentage, identified sub-topic gaps, and direct remediation actions.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground flex items-center justify-center gap-2 text-sm">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Loading real-time performance metrics...
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              No performance records match your active filters. Complete a practice session or CBT test to generate topic analytics!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4">Subject & Syllabus Topic</th>
                    <th className="py-3 px-4 text-center">Attempted</th>
                    <th className="py-3 px-4 text-center">Accuracy %</th>
                    <th className="py-3 px-4">Mastery Level</th>
                    <th className="py-3 px-4">Sub-Topic Gap Analysis</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSummaries.map((summary) => {
                    const isExpanded = expandedTopicId === summary.topicId;
                    return (
                      <React.Fragment key={summary.topicId}>
                        <tr className="hover:bg-muted/20 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-foreground text-sm flex items-center gap-2">
                              {summary.topicName}
                            </div>
                            <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-sm font-medium">
                              {summary.subjectName}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono">
                            <span className="font-bold text-foreground">{summary.correctCount}</span>
                            <span className="text-muted-foreground">/{summary.totalAttempted}</span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <span className={`font-bold font-mono text-sm ${
                                summary.accuracyPercentage >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
                                summary.accuracyPercentage >= 50 ? 'text-amber-600 dark:text-amber-400' :
                                'text-rose-600 dark:text-rose-400'
                              }`}>
                                {summary.accuracyPercentage}%
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {summary.masteryStatus === 'Mastered' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Mastered
                              </span>
                            )}
                            {summary.masteryStatus === 'Developing' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center gap-1">
                                <Zap className="w-3 h-3" /> Developing
                              </span>
                            )}
                            {summary.masteryStatus === 'Needs Review' && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 inline-flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Needs Review
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            {summary.subtopics.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {summary.subtopics.map((st, i) => (
                                  <span key={i} className="text-[11px] bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded-md font-medium">
                                    {st.subtopicName} ({st.missedCount} missed)
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No identified gap</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {summary.missedQuestions.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedTopicId(isExpanded ? null : summary.topicId)}
                                  className="h-8 text-xs text-muted-foreground"
                                >
                                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                  {summary.missedQuestions.length} Items
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleLaunchDrill(summary)}
                                className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5 rounded-lg"
                              >
                                <Target className="w-3.5 h-3.5" /> Drill Similar
                              </Button>
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible Missed Items Detail Sub-Row */}
                        {isExpanded && (
                          <tr className="bg-muted/30">
                            <td colSpan={6} className="p-4 border-b border-border">
                              <div className="p-4 bg-card border border-border rounded-xl space-y-3">
                                <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5" /> Missed Questions for Remediation ({summary.topicName})
                                </h4>
                                <div className="space-y-2">
                                  {summary.missedQuestions.map((mq, idx) => (
                                    <div key={mq.id || idx} className="p-3 bg-muted/40 border border-border rounded-lg text-xs space-y-1">
                                      <p className="font-semibold text-foreground">
                                        <MathText text={`${idx + 1}. ${mq.questionText}`} />
                                      </p>
                                      <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                                        <span>Correct Option: <strong className="text-emerald-600 dark:text-emerald-400">{mq.correctAnswer}</strong></span>
                                        {mq.userAnswer && <span>Your Choice: <strong className="text-rose-500 line-through">{mq.userAnswer}</strong></span>}
                                      </div>
                                      {mq.explanation && (
                                        <div className="mt-1 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                                          <MathText text={mq.explanation} />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
