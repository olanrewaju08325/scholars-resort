import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  DataHealthAuditService, 
  type DataHealthAuditReport, 
  type DataHealthIssue,
  type SubjectHealthBreakdown 
} from '@/services/dataHealthAuditService';
import { 
  ShieldCheck, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Wrench, 
  Sparkles, 
  BookOpen, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  FileText,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface DataHealthReportCardProps {
  onRefetchQuestions?: () => void;
  className?: string;
}

export const DataHealthReportCard: React.FC<DataHealthReportCardProps> = ({ 
  onRefetchQuestions,
  className = '' 
}) => {
  const [report, setReport] = useState<DataHealthAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixingOrphans, setFixingOrphans] = useState(false);
  const [enrichingExplanations, setEnrichingExplanations] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ current: number; total: number } | null>(null);
  const [showSubjectBreakdown, setShowSubjectBreakdown] = useState(false);
  const [showFieldGuide, setShowFieldGuide] = useState(false);

  const runAudit = async () => {
    setLoading(true);
    try {
      const data = await DataHealthAuditService.runAudit();
      setReport(data);
    } catch (err: any) {
      toast.error('Data health scan failed: ' + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  const handleFixOrphans = async () => {
    setFixingOrphans(true);
    try {
      const result = await DataHealthAuditService.autoFixOrphanedTopics();
      if (result.success) {
        toast.success(result.message);
        await runAudit();
        onRefetchQuestions?.();
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error('Failed to fix orphaned topics: ' + err.message);
    } finally {
      setFixingOrphans(false);
    }
  };

  const handleEnrichExplanations = async () => {
    setEnrichingExplanations(true);
    setEnrichProgress({ current: 0, total: 10 });
    try {
      const result = await DataHealthAuditService.autoGenerateMissingExplanations(10, (curr, tot) => {
        setEnrichProgress({ current: curr, total: tot });
      });
      if (result.success) {
        toast.success(`Generated explanations for ${result.updatedCount} questions!`);
        await runAudit();
        onRefetchQuestions?.();
      } else {
        toast.info('No explanations could be generated.');
      }
    } catch (err: any) {
      toast.error('AI explanation generation failed: ' + err.message);
    } finally {
      setEnrichingExplanations(false);
      setEnrichProgress(null);
    }
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'warning':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'critical':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    }
  };

  return (
    <Card id="data-health-report-card" className={`border-border bg-card text-card-foreground shadow-sm ${className}`}>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              Database Quality & Data Health Audit
              {report && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(report.status)}`}>
                  {report.status.toUpperCase()} ({report.overallScore}/100)
                </span>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              Audit for orphaned questions (missing parent topics), schema foreign key links & missing explanations before student CBT drills.
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            id="audit-field-guide-toggle-btn"
            variant="outline"
            size="sm"
            onClick={() => setShowFieldGuide(!showFieldGuide)}
            className="text-xs h-8 gap-1"
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-400" />
            Field Guide
          </Button>

          <Button
            id="run-data-audit-btn"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={runAudit}
            className="text-xs h-8 gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Auditing...' : 'Re-scan DB'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Metric Overview Grid */}
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/80">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Questions</div>
              <div className="text-xl font-bold font-mono mt-1 text-foreground">{report.totalQuestions.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-500 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" /> {report.healthyQuestionsCount} practice-ready
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${report.orphanedQuestionsCount > 0 ? 'bg-amber-500/5 border-amber-500/30' : 'bg-muted/40 border-border/80'}`}>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Orphaned Questions</div>
              <div className={`text-xl font-bold font-mono mt-1 ${report.orphanedQuestionsCount > 0 ? 'text-amber-400' : 'text-foreground'}`}>
                {report.orphanedQuestionsCount}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {report.orphanedQuestionsCount > 0 ? 'Missing parent topic link' : 'All questions linked'}
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${report.missingExplanationCount > 0 ? 'bg-blue-500/5 border-blue-500/30' : 'bg-muted/40 border-border/80'}`}>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Missing Explanations</div>
              <div className={`text-xl font-bold font-mono mt-1 ${report.missingExplanationCount > 0 ? 'text-blue-400' : 'text-foreground'}`}>
                {report.missingExplanationCount}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {report.missingExplanationCount > 0 ? 'Need detailed steps' : '100% complete'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border border-border/80">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Curriculum Schema</div>
              <div className="text-xl font-bold font-mono mt-1 text-foreground">
                {report.totalSubjects} <span className="text-xs font-normal text-muted-foreground">subs</span> / {report.totalTopics} <span className="text-xs font-normal text-muted-foreground">topics</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Verified database relations</div>
            </div>
          </div>
        )}

        {/* Action Panel if Issues Detected */}
        {report && (report.orphanedQuestionsCount > 0 || report.missingExplanationCount > 0) && (
          <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-blue-500/10 border border-amber-500/30 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-foreground">Recommended Database Consistency Fixes</span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Students require every question to belong to a verified <code className="text-primary font-mono text-[11px]">subject_id</code> and <code className="text-primary font-mono text-[11px]">topic_id</code> for topic drills and adaptive mastery tracking.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {report.orphanedQuestionsCount > 0 && (
                <Button
                  id="auto-fix-orphaned-topics-btn"
                  size="sm"
                  variant="default"
                  disabled={fixingOrphans}
                  onClick={handleFixOrphans}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 gap-1.5 shadow-sm"
                >
                  {fixingOrphans ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                  Auto-Fix {report.orphanedQuestionsCount} Orphaned Questions
                </Button>
              )}

              {report.missingExplanationCount > 0 && (
                <Button
                  id="auto-generate-explanations-btn"
                  size="sm"
                  variant="outline"
                  disabled={enrichingExplanations}
                  onClick={handleEnrichExplanations}
                  className="bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border-purple-800/60 text-xs h-8 gap-1.5"
                >
                  {enrichingExplanations ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {enrichProgress ? `Enriching (${enrichProgress.current}/${enrichProgress.total})...` : 'Generating AI Explanations...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      AI Generate Batch Explanations (10 sample)
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Detailed Issues List */}
        {report && report.issues.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Detected Inconsistencies ({report.issues.length})</span>
            </div>

            <div className="space-y-2">
              {report.issues.map(issue => (
                <div 
                  key={issue.id} 
                  className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                    issue.severity === 'critical' 
                      ? 'bg-rose-500/5 border-rose-500/20 text-rose-300' 
                      : issue.severity === 'warning' 
                      ? 'bg-amber-500/5 border-amber-500/20 text-amber-300' 
                      : 'bg-blue-500/5 border-blue-500/20 text-blue-300'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {issue.severity === 'critical' ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    ) : issue.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <HelpCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold text-foreground">{issue.title} ({issue.count})</div>
                      <p className="text-muted-foreground text-[11px] mt-0.5">{issue.description}</p>
                    </div>
                  </div>

                  {issue.canAutoFix && issue.type === 'missing_topic' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={fixingOrphans}
                      onClick={handleFixOrphans}
                      className="text-xs h-7 shrink-0 border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                    >
                      {issue.fixActionName || 'Auto-Fix'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible Subject Breakdown */}
        {report && report.subjectBreakdowns.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowSubjectBreakdown(!showSubjectBreakdown)}
              className="w-full flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border/60 text-xs font-medium text-foreground transition-colors"
            >
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Subject Curriculum & Topic Coverage Breakdown ({report.subjectBreakdowns.length} subjects)
              </span>
              {showSubjectBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showSubjectBreakdown && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 animate-in fade-in">
                {report.subjectBreakdowns.map(sb => (
                  <div key={sb.subjectId} className="p-2.5 rounded-lg bg-card border border-border/80 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{sb.subjectName}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{sb.totalQuestions} Qs</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Topics registered: <strong className="text-foreground">{sb.topicsCount}</strong></span>
                      {sb.orphanedNoTopicCount > 0 ? (
                        <span className="text-amber-400 font-semibold">{sb.orphanedNoTopicCount} unlinked</span>
                      ) : (
                        <span className="text-emerald-400">✓ 100% linked</span>
                      )}
                    </div>
                    {sb.missingExplanationCount > 0 && (
                      <div className="text-[10px] text-blue-400">
                        {sb.missingExplanationCount} questions missing explanation
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Field Guide & Schema Mapping Documentation */}
        {showFieldGuide && (
          <div className="p-4 bg-muted/20 border border-border/80 rounded-xl space-y-3 text-xs animate-in fade-in">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-400" /> Explanation & Column Schema Field Guide
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">UTME Content Standard v2.4</span>
            </div>

            <div className="space-y-2 text-muted-foreground leading-relaxed">
              <div>
                <strong className="text-foreground font-semibold">1. Question Explanations:</strong>
                <p className="mt-0.5 text-[11px]">
                  Explanations provide instant pedagogical feedback to students when they submit an answer in Practice Drills or CBT Mocks.
                  Include mathematical steps, chemical equations, or syllabus references directly in the <code className="text-primary font-mono text-[10px]">explanation</code> CSV column.
                </p>
              </div>

              <div>
                <strong className="text-foreground font-semibold">2. Verified Subject & Topic Links:</strong>
                <p className="mt-0.5 text-[11px]">
                  Each question record is mapped to a foreign-key <code className="text-primary font-mono text-[10px]">subject_id</code> in the <code className="font-mono text-[10px]">subjects</code> table, and a <code className="text-primary font-mono text-[10px]">topic_id</code> in the <code className="font-mono text-[10px]">topics</code> table. The importer performs server-side pre-validation to resolve or auto-register missing curriculum entities.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded bg-card border border-border/60">
                  <span className="text-foreground font-semibold block">Accepted CSV Explanation Headers:</span>
                  <span className="text-muted-foreground font-mono text-[10px]">explanation, rationale, solution, sol, reason</span>
                </div>
                <div className="p-2 rounded bg-card border border-border/60">
                  <span className="text-foreground font-semibold block">Accepted CSV Topic Headers:</span>
                  <span className="text-muted-foreground font-mono text-[10px]">topic, topic_name, subtopic, category, syllabus_unit</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
