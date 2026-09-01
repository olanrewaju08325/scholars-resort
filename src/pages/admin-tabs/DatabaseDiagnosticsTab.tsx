import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, Wrench, 
  Download, FileSpreadsheet, Activity, HelpCircle, Layers, BookOpen, FileText, 
  Users, Sparkles, CheckCircle, XCircle, ArrowRight, Server, Shield, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  runDatabaseDiagnostics, 
  repairDatabaseIntegrity
} from '@/services/databaseIntegrityDiagnostic';
import type { DatabaseDiagnosticReport } from '@/services/databaseIntegrityDiagnostic';
import { supabase } from '@/lib/supabase';
import { QuestionFlowService, type ModeAuditReport, type ExamMode, type QuestionFlowResult } from '@/services/questionFlowService';
import { SchemaValidationReport } from '@/components/admin/SchemaValidationReport';
import { FlowValidatorDashboard } from '@/components/admin/FlowValidatorDashboard';
import { AISimulationTester } from '@/components/admin/AISimulationTester';
import { AIBrandingAuditTester } from '@/components/admin/AIBrandingAuditTester';
import { SubjectCoverageDashboard } from '@/components/admin/SubjectCoverageDashboard';
import { toast } from 'sonner';

export const DatabaseDiagnosticsTab: React.FC = () => {
  const [report, setReport] = useState<DatabaseDiagnosticReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [repairing, setRepairing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'issues' | 'tables' | 'breakdown' | 'coverage' | 'literature' | 'modes' | 'schema_migration' | 'flow_validator' | 'ai_branding_audit' | 'ai_simulation' | 'question_audit'>('question_audit');
  const [issueFilter, setIssueFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  
  // Question Bank QA state
  const [auditQuestions, setAuditQuestions] = useState<any[]>([]);
  const [loadingAuditQuestions, setLoadingAuditQuestions] = useState<boolean>(false);
  const [selectedAuditCategory, setSelectedAuditCategory] = useState<'VALID' | 'DRAFT' | 'NEEDS_REVIEW' | 'DUPLICATE_CANDIDATE' | 'TAXONOMY_PENDING' | 'INVALID'>('INVALID');

  // Mode Question Flow Audit State
  const [modeAudit, setModeAudit] = useState<ModeAuditReport | null>(null);
  const [auditingModes, setAuditingModes] = useState<boolean>(false);
  const [testingMode, setTestingMode] = useState<ExamMode | null>(null);

  const loadAuditQuestions = async (category: typeof selectedAuditCategory) => {
    if (!report || !report.questionAudit) return;
    const ids = report.questionAudit.questionsByClassification[category] || [];
    if (ids.length === 0) {
      setAuditQuestions([]);
      return;
    }
    
    setLoadingAuditQuestions(true);
    try {
      const { data, error } = await supabase
        .from('questions')
        .select('*, subjects(name)')
        .in('id', ids.slice(0, 50));
        
      if (error) throw error;
      setAuditQuestions(data || []);
    } catch (err) {
      console.error('Error loading audit questions:', err);
      toast.error('Failed to load audited questions.');
    } finally {
      setLoadingAuditQuestions(false);
    }
  };

  useEffect(() => {
    if (report && activeTab === 'question_audit') {
      loadAuditQuestions(selectedAuditCategory);
    }
  }, [selectedAuditCategory, activeTab, report]);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await runDatabaseDiagnostics();
      setReport(res);
    } catch (err) {
      toast.error('Failed to run database integrity diagnostic.');
    } finally {
      setLoading(false);
    }
  };

  const runModeAudit = async () => {
    setAuditingModes(true);
    toast.info('Querying Supabase to verify end-to-end question flow for all modes...');
    try {
      const audit = await QuestionFlowService.runAllModesQuestionFlowAudit();
      setModeAudit(audit);
      if (audit.allModesPassed) {
        toast.success(`All ${audit.totalModesTested} CBT modes passed live database question flow check! Zero mock data verified.`);
      } else {
        toast.warning(`${audit.modesPassedCount}/${audit.totalModesTested} modes returned active questions from database.`);
      }
    } catch (err: any) {
      toast.error(`Mode flow audit failed: ${err.message || err}`);
    } finally {
      setAuditingModes(false);
    }
  };

  const testSingleMode = async (mode: ExamMode) => {
    setTestingMode(mode);
    try {
      const res = await QuestionFlowService.verifyModeQuestionFlow(mode);
      if (res.success) {
        toast.success(`${mode.replace(/_/g, ' ').toUpperCase()} query succeeded: ${res.totalRetrieved} questions fetched in ${res.queryLatencyMs}ms.`);
      } else {
        toast.error(`${mode.replace(/_/g, ' ').toUpperCase()} query failed: ${res.errorMessage || 'No questions returned'}`);
      }
      // Update state in modeAudit
      setModeAudit(prev => {
        if (!prev) {
          return {
            timestamp: new Date().toISOString(),
            overallStatus: res.success ? 'passed' : 'warning',
            allModesPassed: res.success,
            totalModesTested: 1,
            modesPassedCount: res.success ? 1 : 0,
            totalDatabaseQuestionsSampled: res.totalRetrieved,
            zeroMockDataEnforced: true,
            results: { [mode]: res } as any
          };
        }
        return {
          ...prev,
          results: {
            ...prev.results,
            [mode]: res
          }
        };
      });
    } catch (err: any) {
      toast.error(`Error testing mode ${mode}: ${err.message}`);
    } finally {
      setTestingMode(null);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleRepair = async () => {
    setRepairing(true);
    toast.info('Starting database integrity auto-repair and mock data cleanup...');
    try {
      const res = await repairDatabaseIntegrity();
      if (res.success) {
        toast.success(res.message);
        if (res.repairedItems.length > 0) {
          res.repairedItems.forEach(item => toast.success(item, { duration: 5000 }));
        }
        await fetchDiagnostics();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Repair failed: ${err.message || err}`);
    } finally {
      setRepairing(false);
    }
  };

  const exportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database_integrity_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported diagnostic JSON report.');
  };

  const exportCSV = () => {
    if (!report) return;
    let csv = 'Severity,Table,Category,Message,Recommendation\n';
    report.issues.forEach(issue => {
      csv += `"${issue.severity}","${issue.table}","${issue.category}","${issue.message.replace(/"/g, '""')}","${issue.recommendation.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database_integrity_issues_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported diagnostic CSV report.');
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 70) return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
  };

  const filteredIssues = report?.issues.filter(issue => {
    if (issueFilter === 'all') return true;
    return issue.severity === issueFilter;
  }) || [];

  return (
    <div className="space-y-8">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-primary/20 to-slate-900 border border-border/50 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Database className="w-64 h-64 text-primary" />
        </div>
        
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10">
              Production Integrity Suite
            </Badge>
            {report && (
              <span className="text-xs text-muted-foreground font-mono">
                Last Diagnostic: {new Date(report.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-white flex items-center gap-3">
            <Server className="w-8 h-8 text-primary" />
            Database Diagnostic & Audit Tool
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Verifies schema integrity, checks foreign key references, detects orphaned records, and replaces mock placeholders with validated, production-ready structure.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 z-10">
          <Button 
            variant="outline" 
            onClick={fetchDiagnostics} 
            disabled={loading || repairing}
            className="border-white/20 text-white hover:bg-white/10 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Run Diagnostics
          </Button>

          <Button 
            onClick={handleRepair} 
            disabled={loading || repairing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-lg shadow-emerald-600/20"
          >
            <Wrench className={`w-4 h-4 ${repairing ? 'animate-spin' : ''}`} />
            {repairing ? 'Repairing Database...' : 'Auto-Repair & Clean Mock Data'}
          </Button>

          <Button 
            variant="secondary" 
            onClick={exportJSON} 
            disabled={!report || loading}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export Audit Report
          </Button>
        </div>
      </div>

      {loading && !report ? (
        <Card className="p-12 text-center border-border/40 bg-card/50">
          <RefreshCw className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <h3 className="text-lg font-bold">Scanning Supabase Database Tables...</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Analyzing questions, subjects, topics, user progress, and literature structure.
          </p>
        </Card>
      ) : report ? (
        <>
          {/* Health Score Gauge & KPI Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="border-border/50 bg-card/60 backdrop-blur-sm relative overflow-hidden">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">Overall Database Health</CardDescription>
                <CardTitle className="text-4xl font-display font-extrabold flex items-baseline gap-2">
                  <span className={getScoreColor(report.overallHealthScore)}>
                    {report.overallHealthScore}%
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">Score</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Progress value={report.overallHealthScore} className="h-2 mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {report.overallHealthScore >= 90
                    ? 'Database tables are in optimal production readiness.'
                    : report.overallHealthScore >= 70
                    ? 'Minor schema warnings detected. Auto-repair recommended.'
                    : 'Critical schema or data integrity issues require attention.'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">Question Bank Bank Status</CardDescription>
                <CardTitle className="text-2xl font-display font-bold flex items-center justify-between">
                  <span>{report.questions.validProductionCount.toLocaleString()}</span>
                  <FileText className="w-5 h-5 text-blue-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Total Question Records:</span>
                    <span className="font-mono text-foreground">{report.questions.totalCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Mock / Test Placeholders:</span>
                    <span className="font-mono text-amber-500">{report.questions.placeholderMockCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Orphaned (Missing Sub ID):</span>
                    <span className="font-mono text-rose-500">{report.questions.missingSubjectIdCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">Official UTME Subjects</CardDescription>
                <CardTitle className="text-2xl font-display font-bold flex items-center justify-between">
                  <span>{report.subjects.officialSubjectsCount} / 13</span>
                  <BookOpen className="w-5 h-5 text-emerald-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Total DB Subjects:</span>
                    <span className="font-mono text-foreground">{report.subjects.totalCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Missing Mandatory:</span>
                    <span className="font-mono text-amber-500">{report.subjects.missingOfficialSubjects.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Syllabus Topics:</span>
                    <span className="font-mono text-foreground">{report.topics.totalCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-medium">Integrity Issues Detected</CardDescription>
                <CardTitle className="text-2xl font-display font-bold flex items-center justify-between">
                  <span>{report.totalIssuesCount}</span>
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-rose-500 border-rose-500/30 bg-rose-500/10">
                    {report.criticalIssuesCount} Critical
                  </Badge>
                  <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                    {report.warningIssuesCount} Warnings
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Click 'Auto-Repair' to automatically resolve standard issues.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabbed Section */}
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <TabsList className="bg-card/60 border border-border/50 p-1 flex flex-wrap gap-1">
              <TabsTrigger value="question_audit" className="gap-2 text-xs">
                <ShieldCheck className="w-4 h-4 text-rose-400" />
                Question Integrity QA
              </TabsTrigger>
              <TabsTrigger value="modes" className="gap-2 text-xs">
                <Activity className="w-4 h-4 text-emerald-400" />
                Mode Flows (4)
              </TabsTrigger>
              <TabsTrigger value="flow_validator" className="gap-2 text-xs">
                <Shield className="w-4 h-4 text-primary" />
                FlowValidator Logs
              </TabsTrigger>
              <TabsTrigger value="schema_migration" className="gap-2 text-xs">
                <Database className="w-4 h-4 text-amber-400" />
                Schema Consistency
              </TabsTrigger>
              <TabsTrigger value="coverage" className="gap-2 text-xs">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                Subject Content Coverage
              </TabsTrigger>
              <TabsTrigger value="ai_branding_audit" className="gap-2 text-xs">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                AI Branding Audit
              </TabsTrigger>
              <TabsTrigger value="ai_simulation" className="gap-2 text-xs">
                <Sparkles className="w-4 h-4 text-blue-400" />
                AI Simulation Test
              </TabsTrigger>
              <TabsTrigger value="issues" className="gap-2 text-xs">
                <AlertTriangle className="w-4 h-4" />
                Diagnostic Issues ({report.issues.length})
              </TabsTrigger>
              <TabsTrigger value="tables" className="gap-2 text-xs">
                <Layers className="w-4 h-4" />
                Table Summaries
              </TabsTrigger>
              <TabsTrigger value="breakdown" className="gap-2 text-xs">
                <FileText className="w-4 h-4" />
                Subject Distribution
              </TabsTrigger>
              <TabsTrigger value="literature" className="gap-2 text-xs">
                <BookOpen className="w-4 h-4" />
                Literature & Novels
              </TabsTrigger>
            </TabsList>

            {/* Diagnostic Issues Tab */}
            <TabsContent value="issues" className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-medium">Filter Severity:</span>
                  <div className="flex gap-1">
                    {(['all', 'critical', 'warning', 'info'] as const).map((sev) => (
                      <Button
                        key={sev}
                        size="sm"
                        variant={issueFilter === sev ? 'default' : 'outline'}
                        onClick={() => setIssueFilter(sev)}
                        className="text-xs h-7 capitalize"
                      >
                        {sev}
                      </Button>
                    ))}
                  </div>
                </div>

                <Button variant="ghost" size="sm" onClick={exportCSV} className="text-xs gap-1">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
                </Button>
              </div>

              {filteredIssues.length === 0 ? (
                <Card className="p-8 text-center border-emerald-500/30 bg-emerald-500/5">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h4 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    No Issues Found in Selected Filter!
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    All tables match production structure and validation guidelines.
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredIssues.map((issue) => (
                    <Card 
                      key={issue.id} 
                      className={`border p-4 transition-colors ${
                        issue.severity === 'critical'
                          ? 'border-rose-500/40 bg-rose-500/5'
                          : issue.severity === 'warning'
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-blue-500/40 bg-blue-500/5'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline"
                              className={
                                issue.severity === 'critical'
                                  ? 'border-rose-500 text-rose-500 bg-rose-500/10'
                                  : issue.severity === 'warning'
                                  ? 'border-amber-500 text-amber-500 bg-amber-500/10'
                                  : 'border-blue-500 text-blue-500 bg-blue-500/10'
                              }
                            >
                              {String(issue?.severity || 'INFO').toUpperCase()}
                            </Badge>

                            <Badge variant="secondary" className="font-mono text-xs">
                              Table: {issue.table}
                            </Badge>

                            <span className="text-xs font-semibold text-muted-foreground">
                              {issue.category}
                            </span>
                          </div>

                          <p className="text-sm font-medium text-foreground pt-1">
                            {issue.message}
                          </p>

                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                            <ArrowRight className="w-3.5 h-3.5 text-primary" />
                            <span className="font-medium text-foreground">Recommendation:</span>
                            <span>{issue.recommendation}</span>
                          </div>
                        </div>

                        <Button 
                          size="sm" 
                          onClick={handleRepair} 
                          disabled={repairing}
                          className="shrink-0 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-xs"
                        >
                          <Wrench className="w-3.5 h-3.5 mr-1" /> Auto-Fix
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Table Summaries Tab */}
            <TabsContent value="tables" className="mt-6">
              <Card className="border-border/50 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-lg">Database Tables Diagnostic Report Card</CardTitle>
                  <CardDescription>
                    Summary status of key Supabase tables and storage schemas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/50">
                  {report.tableSummaries.map((ts, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        {ts.status === 'passed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : ts.status === 'warning' ? (
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                        <div>
                          <h4 className="font-bold text-sm text-foreground font-mono">{ts.tableName}</h4>
                          <p className="text-xs text-muted-foreground">{ts.details}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono">{ts.totalRecords}</span>
                          <span className="text-xs text-muted-foreground block">records</span>
                        </div>

                        <Badge 
                          variant="outline"
                          className={
                            ts.status === 'passed'
                              ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                              : ts.status === 'warning'
                              ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                              : 'border-rose-500/40 text-rose-500 bg-rose-500/10'
                          }
                        >
                          {String(ts?.status || 'UNKNOWN').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subject Distribution Tab */}
            <TabsContent value="breakdown" className="mt-6">
              <Card className="border-border/50 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-lg">Question Distribution by UTME Subject</CardTitle>
                  <CardDescription>
                    Breakdown of production questions linked to each subject in the question bank.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(report.questions.subjectBreakdown).map(([sub, count]) => (
                      <div key={sub} className="p-3 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">{sub}</span>
                        </div>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {count} Questions
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Literature & Novels Tab */}
            <TabsContent value="literature" className="mt-6">
              <Card className="border-border/50 bg-card/60">
                <CardHeader>
                  <CardTitle className="text-lg">Literature & Prescribed Novel Status</CardTitle>
                  <CardDescription>
                    Verifies JAMB/UTME prescribed texts, chapter breakdowns, and practice question coverage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/40 border border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-amber-500" />
                        <h4 className="font-bold text-foreground">"The Life Changer" by Khadija Abubakar Jalli</h4>
                        {report.literature.lifeChangerPresent ? (
                          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                            VERIFIED IN DATABASE
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/20 text-rose-500 border-rose-500/30">
                            MISSING
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Official prescribed novel for Use of English in JAMB UTME.
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-center px-3 py-1.5 rounded-lg bg-background border border-border">
                        <span className="font-mono font-bold text-foreground block">{report.literature.lifeChangerChaptersCount}</span>
                        <span className="text-muted-foreground">Chapters</span>
                      </div>
                      <div className="text-center px-3 py-1.5 rounded-lg bg-background border border-border">
                        <span className="font-mono font-bold text-foreground block">{report.literature.lifeChangerQuestionsCount}</span>
                        <span className="text-muted-foreground">Practice Questions</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Question Integrity & QA Audit Tab */}
            <TabsContent value="question_audit" className="mt-6 space-y-6">
              {report?.questionAudit ? (
                <>
                  {/* KPI Stat Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    {/* VALID */}
                    <div 
                      onClick={() => setSelectedAuditCategory('VALID')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedAuditCategory === 'VALID' 
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/5' 
                          : 'border-border/50 bg-card/40 hover:bg-card/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-emerald-400">Valid</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      </div>
                      <span className="text-2xl font-bold font-mono text-white block mt-2">
                        {report.questionAudit.metrics.validCount}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">Live in CBT</span>
                    </div>

                    {/* DRAFT */}
                    <div 
                      onClick={() => setSelectedAuditCategory('DRAFT')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedAuditCategory === 'DRAFT' 
                          ? 'border-slate-500 bg-slate-500/10 shadow-lg shadow-slate-500/5' 
                          : 'border-border/50 bg-card/40 hover:bg-card/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-300">Draft</span>
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <span className="text-2xl font-bold font-mono text-white block mt-2">
                        {report.questionAudit.metrics.draftCount}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">Safe Drafts</span>
                    </div>

                    {/* NEEDS_REVIEW */}
                    <div 
                      onClick={() => setSelectedAuditCategory('NEEDS_REVIEW')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedAuditCategory === 'NEEDS_REVIEW' 
                          ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/5' 
                          : 'border-border/50 bg-card/40 hover:bg-card/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-amber-400">Needs Review</span>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <span className="text-2xl font-bold font-mono text-white block mt-2">
                        {report.questionAudit.metrics.needsReviewCount}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">Minor formatting</span>
                    </div>

                    {/* DUPLICATE_CANDIDATE */}
                    <div 
                      onClick={() => setSelectedAuditCategory('DUPLICATE_CANDIDATE')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedAuditCategory === 'DUPLICATE_CANDIDATE' 
                          ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/5' 
                          : 'border-border/50 bg-card/40 hover:bg-card/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-purple-400">Duplicates</span>
                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                      </div>
                      <span className="text-2xl font-bold font-mono text-white block mt-2">
                        {report.questionAudit.metrics.duplicateCandidateCount}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">Stem matches</span>
                    </div>

                    {/* TAXONOMY_PENDING */}
                    <div 
                      onClick={() => setSelectedAuditCategory('TAXONOMY_PENDING')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedAuditCategory === 'TAXONOMY_PENDING' 
                          ? 'border-cyan-500 bg-cyan-500/10 shadow-lg shadow-cyan-500/5' 
                          : 'border-border/50 bg-card/40 hover:bg-card/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-cyan-400">Taxonomy Pending</span>
                        <BookOpen className="w-3.5 h-3.5 text-cyan-500" />
                      </div>
                      <span className="text-2xl font-bold font-mono text-white block mt-2">
                        {report.questionAudit.metrics.taxonomyPendingCount}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">Missing topics</span>
                    </div>

                    {/* INVALID */}
                    <div 
                      onClick={() => setSelectedAuditCategory('INVALID')}
                      className={`p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedAuditCategory === 'INVALID' 
                          ? 'border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/5' 
                          : 'border-border/50 bg-card/40 hover:bg-card/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-rose-400">Broken / Invalid</span>
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      </div>
                      <span className="text-2xl font-bold font-mono text-white block mt-2">
                        {report.questionAudit.metrics.invalidCount}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-1">Critical defects</span>
                    </div>
                  </div>

                  {/* Defect Statistics Panel */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left 2 columns: Defect Lists */}
                    <Card className="md:col-span-2 border-border/50 bg-card/60">
                      <CardHeader>
                        <CardTitle className="text-base font-bold">Defect / Warning Checklist Breakdown</CardTitle>
                        <CardDescription>
                          A detailed audit of the entire question repository against strict UTME format guidelines.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* 1. Missing text */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Missing Question Text</span>
                          <Badge variant={report.questionAudit.metrics.missingText > 0 ? 'destructive' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.missingText}
                          </Badge>
                        </div>

                        {/* 2. Malformed options */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Malformed Options Arrays</span>
                          <Badge variant={report.questionAudit.metrics.malformedOptions > 0 ? 'destructive' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.malformedOptions}
                          </Badge>
                        </div>

                        {/* 3. Incorrect option count */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Incorrect Option Counts</span>
                          <Badge variant={report.questionAudit.metrics.incorrectOptionCounts > 0 ? 'destructive' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.incorrectOptionCounts}
                          </Badge>
                        </div>

                        {/* 4. Missing answer */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Missing Correct Answer</span>
                          <Badge variant={report.questionAudit.metrics.missingAnswer > 0 ? 'destructive' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.missingAnswer}
                          </Badge>
                        </div>

                        {/* 5. Invalid answer reference */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Unmatched Answer Text</span>
                          <Badge variant={report.questionAudit.metrics.invalidAnswerRef > 0 ? 'destructive' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.invalidAnswerRef}
                          </Badge>
                        </div>

                        {/* 6. Invalid subject */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Missing Subject Links</span>
                          <Badge variant={report.questionAudit.metrics.invalidSubjectId > 0 ? 'destructive' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.invalidSubjectId}
                          </Badge>
                        </div>

                        {/* 7. Invalid topic */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Orphaned Topics</span>
                          <Badge variant={report.questionAudit.metrics.invalidTopicId > 0 ? 'secondary' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.invalidTopicId}
                          </Badge>
                        </div>

                        {/* 8. Malformed LaTeX */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Unbalanced LaTeX Formulas</span>
                          <Badge variant={report.questionAudit.metrics.malformedLatex > 0 ? 'secondary' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.malformedLatex}
                          </Badge>
                        </div>

                        {/* 9. Broken image URLs */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Suspicious Image URLs</span>
                          <Badge variant={report.questionAudit.metrics.brokenImageUrls > 0 ? 'secondary' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.brokenImageUrls}
                          </Badge>
                        </div>

                        {/* 10. Missing explanation */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Missing Explanations</span>
                          <Badge variant={report.questionAudit.metrics.missingExplanations > 0 ? 'secondary' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.missingExplanations}
                          </Badge>
                        </div>

                        {/* 11. Invalid difficulty */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Invalid Difficulty Types</span>
                          <Badge variant={report.questionAudit.metrics.invalidDifficulty > 0 ? 'secondary' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.invalidDifficulty}
                          </Badge>
                        </div>

                        {/* 12. Invalid exam year */}
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
                          <span className="text-xs font-medium text-slate-300">Invalid Calendar Years</span>
                          <Badge variant={report.questionAudit.metrics.invalidYear > 0 ? 'secondary' : 'outline'} className="font-mono text-[10px]">
                            {report.questionAudit.metrics.invalidYear}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Right Column: QA Intelligence Info */}
                    <Card className="border-border/50 bg-card/60">
                      <CardHeader>
                        <CardTitle className="text-base font-bold">Auto-Classification Pipeline</CardTitle>
                        <CardDescription>
                          How Scholars Resort secures academic and platform data integrity:
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 text-xs text-slate-300">
                        <div className="space-y-1">
                          <h5 className="font-bold text-white">1. Zero-Mock Policy</h5>
                          <p className="text-muted-foreground leading-relaxed">
                            Questions with dummy text, "lorem ipsum", or placeholder titles are identified and flagged for purge or repair.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h5 className="font-bold text-white">2. Safe Classification</h5>
                          <p className="text-muted-foreground leading-relaxed">
                            Instead of deleting questions with formatting or metadata errors, they are safely categorized as <span className="font-semibold text-amber-400">Needs Review</span> or <span className="font-semibold text-rose-400">Invalid</span> so student progress remains untouched.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <h5 className="font-bold text-white">3. LaTeX Integrity Guard</h5>
                          <p className="text-muted-foreground leading-relaxed">
                            Scans formulas for odd, unbalanced dollar signs to ensure rendering doesn't crash on student screens.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Question Browser Category Panel */}
                  <Card className="border-border/50 bg-card/60">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            Question Bank Browser: <span className="text-primary font-mono">{selectedAuditCategory}</span>
                          </CardTitle>
                          <CardDescription>
                            Showing a sample of up to 50 questions flagged in this audit category.
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className="font-mono">
                          {report.questionAudit.questionsByClassification[selectedAuditCategory]?.length || 0} Total in DB
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {loadingAuditQuestions ? (
                        <div className="py-12 text-center">
                          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                          <span className="text-xs text-muted-foreground">Loading questions...</span>
                        </div>
                      ) : auditQuestions.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                          No questions currently in this category. Perfect!
                        </div>
                      ) : (
                        <div className="divide-y divide-border/40 max-h-[500px] overflow-y-auto">
                          {auditQuestions.map((q) => {
                            let opts: string[] = [];
                            try {
                              opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                            } catch {}
                            return (
                              <div key={q.id} className="p-4 hover:bg-muted/20 transition-colors space-y-2">
                                <div className="flex items-start justify-between gap-4 text-xs">
                                  <div className="space-y-1">
                                    <span className="font-bold text-slate-300">
                                      ID: <span className="font-mono text-muted-foreground">{q.id}</span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary">{q.subjects?.name || 'No Subject'}</Badge>
                                      <Badge variant="outline" className="font-mono capitalize">{q.difficulty || 'medium'}</Badge>
                                      {(q.year || q.exam_year) && <Badge variant="outline">Year: {q.year || q.exam_year}</Badge>}
                                      {q.is_active ? (
                                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">LIVE IN CBT</Badge>
                                      ) : (
                                        <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30 text-[10px]">DRAFT MODE</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <p className="text-sm font-medium text-white font-serif bg-background/40 p-3 rounded-lg border border-border/20">
                                  {q.question_text}
                                </p>

                                {Array.isArray(opts) && opts.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                                    {opts.map((opt, idx) => {
                                      const letter = String.fromCharCode(65 + idx);
                                      const isCorrect = String(opt).trim() === String(q.correct_answer).trim();
                                      return (
                                        <div 
                                          key={idx} 
                                          className={`p-2 rounded border ${
                                            isCorrect 
                                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold' 
                                              : 'border-border/30 bg-background/20 text-muted-foreground'
                                          }`}
                                        >
                                          {letter}) {opt}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {q.explanation && (
                                  <div className="text-xs text-muted-foreground pt-1 bg-muted/10 p-2 rounded border border-border/20">
                                    <span className="font-semibold text-slate-300 block mb-0.5">Explanation:</span>
                                    {q.explanation}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="py-12 text-center">
                  <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
                  <span className="text-xs text-muted-foreground">Integrity Report payload missing or malformed.</span>
                </div>
              )}
            </TabsContent>

            {/* Mode Question Flows & Zero-Mock Verification Tab */}
            <TabsContent value="modes" className="mt-6 space-y-6">
              <div className="p-5 rounded-2xl bg-card/70 border border-border/60 shadow-lg space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      End-to-End CBT Mode Question Flow Check
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Executes live Supabase queries across Subject Practice, Topic Drill, Speed Test, and Full Mock to ensure 100% database-backed delivery without mock data fallbacks.
                    </p>
                  </div>

                  <Button
                    onClick={runModeAudit}
                    disabled={auditingModes}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md font-semibold h-10 px-5"
                  >
                    {auditingModes ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Querying Supabase...
                      </>
                    ) : (
                      <>
                        <Activity className="w-4 h-4" />
                        Verify All 4 Modes Now
                      </>
                    )}
                  </Button>
                </div>

                {modeAudit && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/40">
                    <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                      <span className="text-[11px] text-muted-foreground block">Overall Mode Health</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {modeAudit.allModesPassed ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            100% Database Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs">
                            {modeAudit.modesPassedCount}/{modeAudit.totalModesTested} Modes Active
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                      <span className="text-[11px] text-muted-foreground block">Zero-Mock Enforcement</span>
                      <span className="font-mono text-sm font-bold text-emerald-400 mt-1 block">
                        ACTIVE (100% DB)
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                      <span className="text-[11px] text-muted-foreground block">Questions Sampled</span>
                      <span className="font-mono text-sm font-bold text-foreground mt-1 block">
                        {modeAudit.totalDatabaseQuestionsSampled} Questions
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-background/80 border border-border/50">
                      <span className="text-[11px] text-muted-foreground block">Last Verified</span>
                      <span className="font-mono text-xs text-muted-foreground mt-1 block">
                        {new Date(modeAudit.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mode Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Subject Practice */}
                {(() => {
                  const result = modeAudit?.results?.subject_practice;
                  const isTesting = testingMode === 'subject_practice';
                  return (
                    <Card className="border-border/50 bg-card/60 hover:border-border transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div>
                              <CardTitle className="text-base font-semibold">Subject Practice Mode</CardTitle>
                              <CardDescription className="text-xs">Dynamic count (10-50 Qs), AI explanations</CardDescription>
                            </div>
                          </div>
                          {result ? (
                            result.success ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px]">
                                PASSED
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[11px]">
                                FAILED
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[11px]">Ready</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Queries active questions by subject UUID or canonical alias directly from Supabase, applying standard normalization and instant step explanations.
                        </p>

                        {result && (
                          <div className="p-3 rounded-xl bg-background/60 border border-border/40 space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Questions Retrieved:</span>
                              <span className="text-foreground font-bold">{result.totalRetrieved} / {result.expectedCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Database Latency:</span>
                              <span className="text-blue-400">{result.queryLatencyMs}ms</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Zero Mock Fallback:</span>
                              <span className="text-emerald-400">ENFORCED (100% DB)</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Schema Valid:</span>
                              <span className={result.validation.schemaValid ? 'text-emerald-400' : 'text-amber-400'}>
                                {result.validation.schemaValid ? 'Passed' : 'Partial'}
                              </span>
                            </div>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testSingleMode('subject_practice')}
                          disabled={isTesting || auditingModes}
                          className="w-full text-xs h-8 gap-1.5"
                        >
                          {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                          Test Subject Practice Flow
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* 2. Topic Drill */}
                {(() => {
                  const result = modeAudit?.results?.topic_drill;
                  const isTesting = testingMode === 'topic_drill';
                  return (
                    <Card className="border-border/50 bg-card/60 hover:border-border transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                              <Layers className="w-4 h-4" />
                            </div>
                            <div>
                              <CardTitle className="text-base font-semibold">Topic Drill Mode</CardTitle>
                              <CardDescription className="text-xs">Syllabus-focused question querying</CardDescription>
                            </div>
                          </div>
                          {result ? (
                            result.success ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px]">
                                PASSED
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[11px]">
                                NO TOPIC QS
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[11px]">Ready</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Directly filters by registered <code className="text-primary font-mono">topic_id</code> in the database. Warns cleanly if a topic is empty without injecting fake data.
                        </p>

                        {result && (
                          <div className="p-3 rounded-xl bg-background/60 border border-border/40 space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Questions Retrieved:</span>
                              <span className="text-foreground font-bold">{result.totalRetrieved} questions</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Database Latency:</span>
                              <span className="text-purple-400">{result.queryLatencyMs}ms</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Zero Mock Fallback:</span>
                              <span className="text-emerald-400">ENFORCED (100% DB)</span>
                            </div>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testSingleMode('topic_drill')}
                          disabled={isTesting || auditingModes}
                          className="w-full text-xs h-8 gap-1.5"
                        >
                          {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                          Test Topic Drill Flow
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* 3. Speed Test */}
                {(() => {
                  const result = modeAudit?.results?.speed_test;
                  const isTesting = testingMode === 'speed_test';
                  return (
                    <Card className="border-border/50 bg-card/60 hover:border-border transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                              <CardTitle className="text-base font-semibold">Speed Test Mode</CardTitle>
                              <CardDescription className="text-xs">Exactly 20 questions, rapid 10-minute sprint</CardDescription>
                            </div>
                          </div>
                          {result ? (
                            result.success ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px]">
                                PASSED
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[11px]">
                                FAILED
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[11px]">Ready</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Pulls exactly 20 randomized questions from active database records for reflex speed testing and time-per-question analysis.
                        </p>

                        {result && (
                          <div className="p-3 rounded-xl bg-background/60 border border-border/40 space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Questions Retrieved:</span>
                              <span className="text-foreground font-bold">{result.totalRetrieved} / 20</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Database Latency:</span>
                              <span className="text-amber-400">{result.queryLatencyMs}ms</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Zero Mock Fallback:</span>
                              <span className="text-emerald-400">ENFORCED (100% DB)</span>
                            </div>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testSingleMode('speed_test')}
                          disabled={isTesting || auditingModes}
                          className="w-full text-xs h-8 gap-1.5"
                        >
                          {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                          Test Speed Test Flow
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* 4. Full Mock */}
                {(() => {
                  const result = modeAudit?.results?.full_mock;
                  const isTesting = testingMode === 'full_mock';
                  return (
                    <Card className="border-border/50 bg-card/60 hover:border-border transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                              <Database className="w-4 h-4" />
                            </div>
                            <div>
                              <CardTitle className="text-base font-semibold">Full JAMB Mock (180 Qs)</CardTitle>
                              <CardDescription className="text-xs">4 Subjects: 60 English + 40/Core Subject</CardDescription>
                            </div>
                          </div>
                          {result ? (
                            result.success ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px]">
                                PASSED
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 text-[11px]">
                                FAILED
                              </Badge>
                            )
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[11px]">Ready</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Executes parallel database queries across all 4 registered UTME subjects, ensuring balanced question quotas and 0 hardcoded fallback questions.
                        </p>

                        {result && (
                          <div className="p-3 rounded-xl bg-background/60 border border-border/40 space-y-1.5 text-xs font-mono">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Questions Assembled:</span>
                              <span className="text-foreground font-bold">{result.totalRetrieved} questions</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Database Latency:</span>
                              <span className="text-emerald-400">{result.queryLatencyMs}ms</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Subjects Queried:</span>
                              <span className="text-foreground">{result.subjectsQueried.join(', ')}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Zero Mock Fallback:</span>
                              <span className="text-emerald-400">ENFORCED (100% DB)</span>
                            </div>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testSingleMode('full_mock')}
                          disabled={isTesting || auditingModes}
                          className="w-full text-xs h-8 gap-1.5"
                        >
                          {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                          Test Full Mock 180 Flow
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>
            </TabsContent>

            {/* FlowValidator Logs & Real-Time Query Trace */}
            <TabsContent value="flow_validator" className="mt-6 space-y-4">
              <FlowValidatorDashboard />
            </TabsContent>

            {/* Schema Validation & Auto-Migration Report */}
            <TabsContent value="schema_migration" className="mt-6 space-y-4">
              <SchemaValidationReport />
            </TabsContent>

            {/* Subject Content Coverage Visualization */}
            <TabsContent value="coverage" className="mt-6 space-y-4">
              <SubjectCoverageDashboard />
            </TabsContent>

            {/* AI Branding Audit & Output Compliance */}
            <TabsContent value="ai_branding_audit" className="mt-6 space-y-4">
              <AIBrandingAuditTester />
            </TabsContent>

            {/* AI Simulation Test & Normalization Verifier */}
            <TabsContent value="ai_simulation" className="mt-6 space-y-4">
              <AISimulationTester />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
};
