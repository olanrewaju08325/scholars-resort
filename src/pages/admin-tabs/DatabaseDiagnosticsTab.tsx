import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Database, ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw, Wrench, 
  Download, FileSpreadsheet, Activity, HelpCircle, Layers, BookOpen, FileText, 
  Users, Sparkles, CheckCircle, XCircle, ArrowRight, Server, Shield
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
import { toast } from 'sonner';

export const DatabaseDiagnosticsTab: React.FC = () => {
  const [report, setReport] = useState<DatabaseDiagnosticReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [repairing, setRepairing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'issues' | 'tables' | 'breakdown' | 'literature'>('issues');
  const [issueFilter, setIssueFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

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
            <TabsList className="bg-card/60 border border-border/50 p-1">
              <TabsTrigger value="issues" className="gap-2">
                <AlertTriangle className="w-4 h-4" />
                Diagnostic Issues ({report.issues.length})
              </TabsTrigger>
              <TabsTrigger value="tables" className="gap-2">
                <Layers className="w-4 h-4" />
                Table Summaries
              </TabsTrigger>
              <TabsTrigger value="breakdown" className="gap-2">
                <FileText className="w-4 h-4" />
                Subject Distribution
              </TabsTrigger>
              <TabsTrigger value="literature" className="gap-2">
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
                              {issue.severity.toUpperCase()}
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
                          {ts.status.toUpperCase()}
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
          </Tabs>
        </>
      ) : null}
    </div>
  );
};
