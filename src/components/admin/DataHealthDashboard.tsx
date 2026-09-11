import React, { useState, useEffect } from 'react';
import { 
  Database, AlertTriangle, CheckCircle2, RefreshCw, Layers, 
  ChevronDown, ChevronUp, Search, Sparkles, Filter, Wrench,
  BookOpen, HelpCircle, ArrowRight, ShieldCheck, FileSpreadsheet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface SubjectTopicAudit {
  id: string;
  name: string;
  questionCount: number;
}

export interface SubjectHealthReport {
  subjectId: string;
  subjectName: string;
  totalQuestions: number;
  categorizedInTopics: number;
  unassignedQuestions: number;
  topicCount: number;
  topics: SubjectTopicAudit[];
  hasInconsistency: boolean;
  explanationCoveragePercent: number;
  isActive: boolean;
}

export const DataHealthDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [subjectsHealth, setSubjectsHealth] = useState<SubjectHealthReport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'inconsistent' | 'healthy'>('all');
  const [expandedSubjectIds, setExpandedSubjectIds] = useState<Set<string>>(new Set());

  const fetchSubjectHealthData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all subjects
      const { data: subjects, error: subjErr } = await supabase
        .from('subjects')
        .select('id, name, is_active')
        .order('name');

      if (subjErr) throw subjErr;

      // 2. Fetch all topics
      const { data: topics, error: topErr } = await supabase
        .from('topics')
        .select('id, subject_id, name')
        .order('name');

      if (topErr) throw topErr;

      // 3. Fetch all questions using paginated queries to bypass 1000-row limit
      let allQuestions: Array<{ id: string; subject_id: string; topic_id: string | null; explanation: string | null }> = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data: qBatch, error: qErr } = await supabase
          .from('questions')
          .select('id, subject_id, topic_id, explanation')
          .range(from, from + pageSize - 1);

        if (qErr) {
          console.warn('Questions fetch notice in DataHealthDashboard:', qErr.message);
          break;
        }

        if (!qBatch || qBatch.length === 0) break;
        allQuestions = allQuestions.concat(qBatch);
        if (qBatch.length < pageSize) break;
        from += pageSize;
      }

      // Group questions by subject and topic
      const questionsBySubject = new Map<string, typeof allQuestions>();
      const questionsByTopic = new Map<string, number>();

      allQuestions.forEach(q => {
        if (q.subject_id) {
          const list = questionsBySubject.get(q.subject_id) || [];
          list.push(q);
          questionsBySubject.set(q.subject_id, list);
        }
        if (q.topic_id) {
          questionsByTopic.set(q.topic_id, (questionsByTopic.get(q.topic_id) || 0) + 1);
        }
      });

      // Build Health Reports per Subject
      const reports: SubjectHealthReport[] = (subjects || []).map(sub => {
        const subQuestions = questionsBySubject.get(sub.id) || [];
        const subTopics = (topics || []).filter(t => t.subject_id === sub.id);

        const topicAudits: SubjectTopicAudit[] = subTopics.map(t => ({
          id: t.id,
          name: t.name,
          questionCount: questionsByTopic.get(t.id) || 0
        })).sort((a, b) => b.questionCount - a.questionCount);

        const totalQuestions = subQuestions.length;
        const validTopicIds = new Set(subTopics.map(t => t.id));
        const categorizedCount = subQuestions.filter(q => q.topic_id && validTopicIds.has(q.topic_id)).length;
        const unassigned = Math.max(0, totalQuestions - categorizedCount);
        const hasInconsistency = unassigned > 0;

        const withExpl = subQuestions.filter(q => q.explanation && String(q.explanation).trim().length > 0).length;
        const explanationCoverage = totalQuestions > 0 ? (withExpl / totalQuestions) * 100 : 0;

        return {
          subjectId: sub.id,
          subjectName: sub.name,
          totalQuestions,
          categorizedInTopics: categorizedCount,
          unassignedQuestions: unassigned,
          topicCount: subTopics.length,
          topics: topicAudits,
          hasInconsistency,
          explanationCoveragePercent: Math.round(explanationCoverage),
          isActive: sub.is_active ?? true
        };
      });

      setSubjectsHealth(reports);
    } catch (err: any) {
      console.error('Failed to load subject health data:', err);
      toast.error('Could not load data health audit: ' + (err.message || 'Database error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjectHealthData();
  }, []);

  const toggleExpand = (subjectId: string) => {
    setExpandedSubjectIds(prev => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const handleReconcileSubject = async (subject: SubjectHealthReport) => {
    setReconcilingId(subject.subjectId);
    try {
      toast.loading(`Reconciling unassigned questions for ${subject.subjectName}...`, { id: 'reconcile-toast' });

      // Check or create default topic
      let defaultTopicId = subject.topics[0]?.id;
      if (!defaultTopicId) {
        const { data: newTopic, error: topErr } = await supabase
          .from('topics')
          .insert({
            subject_id: subject.subjectId,
            name: `${subject.subjectName} - General & Core Concepts`
          })
          .select('id')
          .single();

        if (topErr || !newTopic) throw new Error(topErr?.message || 'Failed to create topic');
        defaultTopicId = newTopic.id;
      }

      // Update unassigned questions for this subject
      const { error: updateErr } = await supabase
        .from('questions')
        .update({ topic_id: defaultTopicId })
        .eq('subject_id', subject.subjectId)
        .is('topic_id', null);

      if (updateErr) throw updateErr;

      toast.success(`Successfully reconciled questions for ${subject.subjectName}!`, { id: 'reconcile-toast' });
      await fetchSubjectHealthData();
    } catch (err: any) {
      toast.error('Reconciliation failed: ' + err.message, { id: 'reconcile-toast' });
    } finally {
      setReconcilingId(null);
    }
  };

  const filteredSubjects = subjectsHealth.filter(sub => {
    const matchesSearch = sub.subjectName.toLowerCase().includes(searchQuery.toLowerCase());
    if (filterMode === 'inconsistent') return matchesSearch && sub.hasInconsistency;
    if (filterMode === 'healthy') return matchesSearch && !sub.hasInconsistency;
    return matchesSearch;
  });

  const totalMonitoredSubjects = subjectsHealth.length;
  const totalDbQuestions = subjectsHealth.reduce((acc, s) => acc + s.totalQuestions, 0);
  const totalCategorizedQuestions = subjectsHealth.reduce((acc, s) => acc + s.categorizedInTopics, 0);
  const totalInconsistencies = subjectsHealth.reduce((acc, s) => acc + s.unassignedQuestions, 0);
  const inconsistentSubjectsCount = subjectsHealth.filter(s => s.hasInconsistency).length;

  return (
    <div className="space-y-6">
      {/* Top Metrics Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="border-border bg-card/50 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Questions</p>
                <h3 className="text-2xl sm:text-3xl font-bold font-display mt-1 text-foreground">
                  {totalDbQuestions.toLocaleString()}
                </h3>
              </div>
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20">
                <Database className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              Across <span className="font-semibold text-foreground">{totalMonitoredSubjects}</span> curriculum subjects
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categorized in Topics</p>
                <h3 className="text-2xl sm:text-3xl font-bold font-display mt-1 text-emerald-500">
                  {totalCategorizedQuestions.toLocaleString()}
                </h3>
              </div>
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 border border-emerald-500/20">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {totalDbQuestions > 0 ? `${((totalCategorizedQuestions / totalDbQuestions) * 100).toFixed(1)}% topic aligned` : '0%'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Inconsistent / Unassigned</p>
                <h3 className={`text-2xl sm:text-3xl font-bold font-display mt-1 ${totalInconsistencies > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {totalInconsistencies.toLocaleString()}
                </h3>
              </div>
              <div className={`p-2.5 rounded-xl border ${totalInconsistencies > 0 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                {totalInconsistencies > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {inconsistentSubjectsCount > 0 ? `${inconsistentSubjectsCount} subject(s) need topic link` : 'All subjects fully balanced'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card/50 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Curriculum Schema</p>
                <h3 className="text-2xl sm:text-3xl font-bold font-display mt-1 text-foreground">
                  {subjectsHealth.reduce((acc, s) => acc + s.topicCount, 0)} <span className="text-xs font-normal text-muted-foreground">topics</span>
                </h3>
              </div>
              <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-500 border border-purple-500/20">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Avg {totalMonitoredSubjects > 0 ? (subjectsHealth.reduce((acc, s) => acc + s.topicCount, 0) / totalMonitoredSubjects).toFixed(1) : 0} topics/subject
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Control Bar & Filter */}
      <Card className="border-border bg-card/40 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Data Health & Subject Topic Consistency Audit
              </CardTitle>
              <CardDescription className="text-xs">
                Audits that total imported questions match the exact sum of questions categorized under your 23+ topics per subject.
              </CardDescription>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={fetchSubjectHealthData} 
              disabled={loading}
              className="gap-1.5 h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Audit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search subject by name..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto bg-muted/40 p-1 rounded-lg border border-border/60">
              <Button
                size="sm"
                variant={filterMode === 'all' ? 'default' : 'ghost'}
                onClick={() => setFilterMode('all')}
                className="h-7 text-xs px-3"
              >
                All ({subjectsHealth.length})
              </Button>
              <Button
                size="sm"
                variant={filterMode === 'inconsistent' ? 'default' : 'ghost'}
                onClick={() => setFilterMode('inconsistent')}
                className="h-7 text-xs px-3 gap-1"
              >
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                Inconsistent ({inconsistentSubjectsCount})
              </Button>
              <Button
                size="sm"
                variant={filterMode === 'healthy' ? 'default' : 'ghost'}
                onClick={() => setFilterMode('healthy')}
                className="h-7 text-xs px-3 gap-1"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Balanced ({subjectsHealth.length - inconsistentSubjectsCount})
              </Button>
            </div>
          </div>

          {/* Subjects Table */}
          <div className="rounded-xl border border-border/70 overflow-hidden bg-background">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground font-semibold">
                    <th className="py-3 px-4">Subject Name</th>
                    <th className="py-3 px-4 text-center">Total Questions</th>
                    <th className="py-3 px-4 text-center">In Topics (23+ Units)</th>
                    <th className="py-3 px-4 text-center">Consistency Status</th>
                    <th className="py-3 px-4 text-center">Explanations</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        {loading ? 'Scanning questions across subjects and topics...' : 'No subjects matched your filter criteria.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSubjects.map(sub => {
                      const isExpanded = expandedSubjectIds.has(sub.subjectId);
                      return (
                        <React.Fragment key={sub.subjectId}>
                          <tr className={`hover:bg-muted/20 transition-colors ${sub.hasInconsistency ? 'bg-amber-500/[0.02]' : ''}`}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-sm">{sub.subjectName}</span>
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                  {sub.topicCount} topics
                                </Badge>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-center font-semibold text-foreground">
                              {sub.totalQuestions.toLocaleString()}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <span className="font-semibold text-foreground">{sub.categorizedInTopics.toLocaleString()}</span>
                              <span className="text-muted-foreground text-[11px] ml-1">
                                ({sub.totalQuestions > 0 ? ((sub.categorizedInTopics / sub.totalQuestions) * 100).toFixed(0) : 0}%)
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center">
                              {sub.hasInconsistency ? (
                                <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10 text-[11px] gap-1 font-medium">
                                  <AlertTriangle className="w-3 h-3" />
                                  {sub.unassignedQuestions} Unassigned
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 text-[11px] gap-1 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  100% Balanced
                                </Badge>
                              )}
                            </td>

                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-purple-500 rounded-full" 
                                    style={{ width: `${sub.explanationCoveragePercent}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-mono text-muted-foreground">{sub.explanationCoveragePercent}%</span>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {sub.hasInconsistency && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleReconcileSubject(sub)}
                                    disabled={reconcilingId === sub.subjectId}
                                    className="h-7 text-[11px] text-amber-500 border-amber-500/30 hover:bg-amber-500/10 gap-1 px-2"
                                  >
                                    <Wrench className="w-3 h-3" />
                                    Reconcile
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleExpand(sub.subjectId)}
                                  className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1 px-2"
                                >
                                  {isExpanded ? (
                                    <>Collapse <ChevronUp className="w-3.5 h-3.5" /></>
                                  ) : (
                                    <>Topics ({sub.topicCount}) <ChevronDown className="w-3.5 h-3.5" /></>
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Topic Hierarchy Breakdown */}
                          {isExpanded && (
                            <tr className="bg-muted/10">
                              <td colSpan={6} className="p-4 border-t border-b border-border/50">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                                      <Layers className="w-4 h-4 text-primary" />
                                      Detailed Syllabus Topic Categorization for {sub.subjectName}
                                    </span>
                                    <span className="text-muted-foreground">
                                      Sum of Categorized Questions: <strong className="text-foreground">{sub.categorizedInTopics}</strong> / {sub.totalQuestions}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {sub.topics.length === 0 ? (
                                      <p className="text-xs text-muted-foreground col-span-full py-2">
                                        No topics registered yet for this subject.
                                      </p>
                                    ) : (
                                      sub.topics.map(t => {
                                        const share = sub.totalQuestions > 0 ? ((t.questionCount / sub.totalQuestions) * 100).toFixed(1) : '0';
                                        return (
                                          <div 
                                            key={t.id} 
                                            className="p-2.5 rounded-lg border border-border/60 bg-background/80 flex items-center justify-between text-xs"
                                          >
                                            <span className="font-medium text-foreground truncate max-w-[200px]" title={t.name}>
                                              {t.name}
                                            </span>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                              <Badge variant="secondary" className="font-mono text-[11px] px-1.5">
                                                {t.questionCount} Qs
                                              </Badge>
                                              <span className="text-[10px] text-muted-foreground">{share}%</span>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
