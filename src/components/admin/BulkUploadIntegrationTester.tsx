import React, { useState, useEffect } from 'react';
import { 
  Play, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Layers, Database, 
  BookOpen, Clock, ShieldCheck, ArrowRight, Sparkles, Terminal, FileSpreadsheet
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BulkUploadIntegrationTester, type BulkImportTestReport } from '@/services/bulkUploadIntegrationTester';
import { OFFICIAL_JAMB_SUBJECTS } from '@/utils/subjectUtils';
import { toast } from 'sonner';

export const BulkUploadIntegrationTesterComponent: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('Economics');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [report, setReport] = useState<BulkImportTestReport | null>(null);
  const subjectList = OFFICIAL_JAMB_SUBJECTS.map(s => s.name);

  const handleRunTest = async () => {
    setIsRunning(true);
    toast.info(`Running End-to-End Bulk Upload & CBT Flow Test for ${selectedSubject}...`);
    try {
      const res = await BulkUploadIntegrationTester.runEndToEndTest(selectedSubject);
      setReport(res);
      if (res.overallPassed) {
        toast.success(`End-to-End Test Passed for ${selectedSubject}! All 7 verification stages passed.`);
      } else {
        toast.warning(`Integration Test completed with ${res.failedSteps} issue(s) detected.`);
      }
    } catch (err: any) {
      console.error('Integration test failed:', err);
      toast.error(`Integration test runner error: ${err.message || err}`);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    // Auto-run once for Economics on mount to give immediate feedback
    handleRunTest();
  }, []);

  return (
    <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-xl" id="bulk-upload-integration-tester">
      <CardHeader className="border-b border-slate-800/80 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-lg font-bold text-white">
                Bulk Upload & CBT Flow End-to-End Integration Suite
              </CardTitle>
            </div>
            <CardDescription className="text-slate-400 text-xs sm:text-sm">
              Automated multi-stage verification simulating bulk CSV/JSON ingestion, foreign-key relationships, Supabase queries, and practice session initialization.
            </CardDescription>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-48">
              <select 
                value={selectedSubject} 
                onChange={e => setSelectedSubject(e.target.value)} 
                disabled={isRunning}
                className="w-full bg-slate-950 border border-slate-800 text-xs font-semibold h-9 rounded-md px-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {subjectList.map(s => (
                  <option key={s} value={s} className="bg-slate-900 text-white">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <Button 
              onClick={handleRunTest} 
              disabled={isRunning}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-2 h-9 px-4 shrink-0 shadow-lg"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Testing Pipeline...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Run E2E Test Suite
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Status Summary Banner */}
        {report && (
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            report.overallPassed 
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200' 
              : 'bg-rose-950/40 border-rose-800/80 text-rose-200'
          }`}>
            <div className="flex items-center gap-3">
              {report.overallPassed ? (
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center shrink-0">
                  <XCircle className="w-6 h-6 text-rose-400" />
                </div>
              )}
              <div>
                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                  {report.overallPassed ? 'ALL INTEGRATION TESTS PASSED' : 'INTEGRATION FAILURES DETECTED'}
                  <Badge variant="outline" className={report.overallPassed ? 'border-emerald-500/50 text-emerald-300' : 'border-rose-500/50 text-rose-300'}>
                    {report.passedSteps}/{report.totalSteps} Steps Passed
                  </Badge>
                </h4>
                <p className="text-xs opacity-90 mt-0.5">
                  Target Subject: <strong className="text-white">{report.subjectTested}</strong> | UUID: <code className="text-[11px] font-mono bg-black/40 px-1.5 py-0.5 rounded">{report.subjectId || 'N/A'}</code>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="text-right">
                <span className="text-slate-400 block">Total Active Questions</span>
                <strong className="text-emerald-400 text-sm font-mono">{report.questionsInDbForSubject.toLocaleString()}</strong>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-right">
                <span className="text-slate-400 block">Topics Created</span>
                <strong className="text-indigo-400 text-sm font-mono">{report.topicsCountForSubject}</strong>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-right">
                <span className="text-slate-400 block">Execution Latency</span>
                <strong className="text-amber-400 text-sm font-mono">{report.totalDurationMs}ms</strong>
              </div>
            </div>
          </div>
        )}

        {/* Step-by-Step Execution Matrix */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            Verification Stages & Integrity Checks
          </h4>

          {report?.steps.map((step, idx) => (
            <div 
              key={idx}
              className={`p-3.5 rounded-lg border transition-all ${
                step.passed 
                  ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700' 
                  : 'bg-rose-950/30 border-rose-800/60 hover:border-rose-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {step.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">
                      {step.stepName}
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                      {step.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="bg-slate-900 text-slate-400 text-[10px] font-mono border-slate-800">
                    <Clock className="w-2.5 h-2.5 mr-1 text-slate-500" />
                    {step.durationMs}ms
                  </Badge>
                  <Badge className={`text-[10px] font-bold ${
                    step.passed 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {step.passed ? 'PASSED' : 'FAILED'}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Live Question Sample Preview */}
        {report && report.sampleRetrievedQuestions && report.sampleRetrievedQuestions.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              Live Database Question Stream Preview ({report.sampleRetrievedQuestions.length} sample items)
            </h4>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 font-mono text-[11px]">
              {report.sampleRetrievedQuestions.map((q, i) => (
                <div key={q.id || i} className="p-2 rounded bg-slate-900/60 border border-slate-800/60 flex items-start justify-between gap-2">
                  <div>
                    <span className="text-emerald-400 font-bold mr-2">Q{i + 1}:</span>
                    <span className="text-slate-200">{q.question_text}</span>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-400">
                      <span>Topic: <strong className="text-slate-300">{q.topics?.name || 'General'}</strong></span>
                      <span>Answer: <strong className="text-emerald-400">{q.correct_answer}</strong></span>
                      <span>Year: <strong className="text-amber-400">{q.year || '2025'}</strong></span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-slate-800 shrink-0">
                    ID: {q.id.slice(0, 8)}...
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
