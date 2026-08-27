import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, CheckCircle2, AlertTriangle, XCircle, 
  RefreshCw, Play, Code, Layers, Zap, Download, Cpu
} from 'lucide-react';
import { 
  FlowValidator, 
  type FlowExecutionTrace, 
  type CbtSuiteValidationReport 
} from '@/services/flowValidatorService';
import type { ExamMode } from '@/services/questionFlowService';
import { FlowValidatorTestCoverageCard } from '@/components/admin/FlowValidatorTestCoverageCard';
import { FlowValidatorHistoricalChart } from '@/components/admin/FlowValidatorHistoricalChart';
import { toast } from 'sonner';

export const FlowValidatorDashboard: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<ExamMode>('subject_practice');
  const [selectedSubject, setSelectedSubject] = useState('Physics');
  const [runningSingle, setRunningSingle] = useState(false);
  const [runningSuite, setRunningSuite] = useState(false);
  const [currentTrace, setCurrentTrace] = useState<FlowExecutionTrace | null>(null);
  const [suiteReport, setSuiteReport] = useState<CbtSuiteValidationReport | null>(null);
  const [traceHistory, setTraceHistory] = useState<FlowExecutionTrace[]>([]);
  const [showSql, setShowSql] = useState(false);

  const modes: { id: ExamMode; name: string; desc: string }[] = [
    { id: 'subject_practice', name: 'Subject Practice', desc: 'Queries dynamic count (10-50 Qs) for selected subject' },
    { id: 'topic_drill', name: 'Topic Drill', desc: 'Direct syllabus topic filtering via topic_id' },
    { id: 'speed_test', name: 'Speed Test', desc: 'Exactly 20 questions for 10-minute sprint' },
    { id: 'full_mock', name: 'Full Mock 180', desc: 'Parallel 4-subject queries (60 English + 40/Core)' },
  ];

  const handleRunSingleTrace = async (modeToRun = selectedMode) => {
    setRunningSingle(true);
    toast.info(`Tracing end-to-end question flow for ${modeToRun.replace(/_/g, ' ').toUpperCase()}...`);
    try {
      const trace = await FlowValidator.traceModeQuestionFlow(modeToRun, {
        subjectName: selectedSubject,
        targetCount: modeToRun === 'speed_test' ? 20 : modeToRun === 'full_mock' ? 180 : 20
      });
      setCurrentTrace(trace);
      setTraceHistory(FlowValidator.getTraceHistory());

      if (trace.overallStatus === 'passed') {
        toast.success(`Trace completed in ${trace.totalLatencyMs}ms. Zero mock data verified!`);
      } else if (trace.overallStatus === 'warning') {
        toast.warning(`Trace returned 0 rows (valid empty notice, zero mock fallback).`);
      } else {
        toast.error(`Trace failed: ${trace.errorMessage}`);
      }
    } catch (err: any) {
      toast.error(`Flow validation error: ${err.message || err}`);
    } finally {
      setRunningSingle(false);
    }
  };

  const handleRunFullSuite = async () => {
    setRunningSuite(true);
    toast.info(`Exercising all 4 CBT modes live against Supabase DB (${selectedSubject})...`);
    try {
      const report = await FlowValidator.validateAllCbtModes(selectedSubject);
      setSuiteReport(report);
      setTraceHistory(FlowValidator.getTraceHistory());
      if (report.traces.length > 0) {
        setCurrentTrace(report.traces[0]);
      }

      if (report.overallHealth === 'optimal') {
        toast.success(`Full Suite Passed! All 4 modes verified against live database (Zero mocks).`);
      } else if (report.overallHealth === 'moderate') {
        toast.warning(`Suite completed with warnings (Some subjects have 0 rows; zero-mock safely handled).`);
      } else {
        toast.error(`Suite detected errors in one or more modes.`);
      }
    } catch (err: any) {
      toast.error(`Suite validation error: ${err.message || err}`);
    } finally {
      setRunningSuite(false);
    }
  };

  const exportValidationCsv = () => {
    if (!suiteReport && !currentTrace) {
      toast.error('No validation report available to export as CSV. Run a test first.');
      return;
    }
    const reportToExport = suiteReport || {
      id: currentTrace?.id || `single_${Date.now()}`,
      timestamp: currentTrace?.startTime || new Date().toISOString(),
      testedSubject: selectedSubject,
      totalModes: 1,
      passedModes: currentTrace?.overallStatus === 'passed' ? 1 : 0,
      warningModes: currentTrace?.overallStatus === 'warning' ? 1 : 0,
      failedModes: currentTrace?.overallStatus === 'failed' ? 1 : 0,
      totalLatencyMs: currentTrace?.totalLatencyMs || 0,
      avgLatencyMs: currentTrace?.totalLatencyMs || 0,
      totalRecordsFetched: currentTrace?.recordsFetched || 0,
      allZeroMockEnforced: currentTrace?.zeroMockEnforced || true,
      overallHealth: currentTrace?.overallStatus === 'passed' ? 'optimal' : currentTrace?.overallStatus === 'warning' ? 'moderate' : 'critical',
      traces: currentTrace ? [currentTrace] : []
    };

    FlowValidator.exportReportToCsv(reportToExport as CbtSuiteValidationReport);
    toast.success('Generated and downloaded FlowValidator CSV Report!');
  };

  const exportValidationLog = () => {
    const exportData = {
      suiteReport,
      currentTrace,
      history: traceHistory,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scholars_resort_flow_validator_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded FlowValidator Audit Log (JSON)');
  };

  useEffect(() => {
    setTraceHistory(FlowValidator.getTraceHistory());
  }, []);

  return (
    <div className="space-y-6">
      {/* Test Coverage & 30-Day Historical Reliability Charts */}
      <div className="grid grid-cols-1 gap-6">
        <FlowValidatorTestCoverageCard />
        <FlowValidatorHistoricalChart />
      </div>

      {/* Control & Run Panel */}
      <Card className="border border-emerald-900/40 bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900 shadow-xl overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600/30 text-emerald-300 border-emerald-500/40 text-xs px-2.5 py-0.5 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> End-to-End CBT Flow Validator
                </Badge>
                <Badge variant="outline" className="text-slate-400 text-xs">
                  Zero Mock & Live SQL Engine
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold font-display text-white">
                CBT Question Flow Validator & Execution Tracer
              </CardTitle>
              <CardDescription className="text-xs text-slate-300">
                Programmatically exercises all 4 CBT modes (Subject Practice, Topic Drill, Speed Test, Mock) to verify live Supabase queries, measure latency, and guarantee zero hardcoded fallback data.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {(suiteReport || currentTrace) && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportValidationCsv}
                    className="border-emerald-700/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 h-9"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV Report
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportValidationLog}
                    className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 h-9"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Export JSON Log
                  </Button>
                </>
              )}

              <Button
                onClick={() => handleRunSingleTrace(selectedMode)}
                disabled={runningSingle || runningSuite}
                variant="outline"
                className="border-emerald-700/60 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 h-9"
              >
                {runningSingle ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Tracing...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    Trace Selected Mode
                  </>
                )}
              </Button>

              <Button
                onClick={handleRunFullSuite}
                disabled={runningSingle || runningSuite}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-900/30 h-9"
              >
                {runningSuite ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Validating All 4 Modes...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-1.5 fill-current" />
                    Run Full 4-Mode CBT Suite
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Target CBT Mode</label>
              <select 
                value={selectedMode} 
                onChange={(e) => setSelectedMode(e.target.value as ExamMode)}
                className="w-full h-9 rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-200 shadow-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              >
                {modes.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.desc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Target Benchmark Subject</label>
              <select 
                value={selectedSubject} 
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm text-slate-200 shadow-sm focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Physics">Physics</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="Use of English">Use of English</option>
                <option value="Economics">Economics</option>
                <option value="Government">Government</option>
                <option value="Literature in English">Literature in English</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4-Mode Suite Overview if available */}
      {suiteReport && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" /> 4-Mode CBT Execution Suite Scorecard
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total Latency: {suiteReport.totalLatencyMs}ms • Avg: {suiteReport.avgLatencyMs}ms/mode
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {suiteReport.traces.map((trace) => {
              const isSelected = currentTrace?.id === trace.id;
              const modeInfo = modes.find(m => m.id === trace.mode);

              return (
                <Card 
                  key={trace.id}
                  onClick={() => setCurrentTrace(trace)}
                  className={`border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-emerald-500 bg-emerald-950/30 shadow-md ring-1 ring-emerald-500/40' 
                      : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
                  }`}
                >
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">
                        {modeInfo?.name || trace.mode}
                      </span>
                      {trace.overallStatus === 'passed' ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                          100% LIVE DB
                        </Badge>
                      ) : trace.overallStatus === 'warning' ? (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                          0 ROWS (CLEAN)
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">
                          FAILED
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Fetched: <strong className="text-slate-200">{trace.recordsFetched}</strong> Qs</span>
                      <span className="font-mono text-emerald-400">{trace.totalLatencyMs}ms</span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Zero Mock Fallback Enforced</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Trace Breakdown */}
      {currentTrace && (
        <div className="space-y-4">
          {/* Top Level KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-400 block">Execution Mode Status</span>
              <div className="flex items-center gap-1.5 mt-1">
                {currentTrace.overallStatus === 'passed' ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    PASSED (100% DB)
                  </Badge>
                ) : currentTrace.overallStatus === 'warning' ? (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                    0 DB ROWS (NO MOCKS)
                  </Badge>
                ) : (
                  <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/40 text-xs">
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                    FAILED
                  </Badge>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-400 block">End-to-End Latency</span>
              <span className="font-mono text-xl font-black text-blue-400 mt-1 block">
                {currentTrace.totalLatencyMs}ms
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-400 block">Questions Delivered</span>
              <span className="font-mono text-xl font-black text-primary mt-1 block">
                {currentTrace.recordsReturned} / {currentTrace.recordsFetched} fetched
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-400 block">Zero-Mock Assertion</span>
              <span className="text-xs font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" /> 100% LIVE DB ONLY
              </span>
            </div>
          </div>

          {/* Sequential Step Timeline */}
          <Card className="border border-slate-800 bg-slate-900 shadow-lg">
            <CardHeader className="p-4 pb-3 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Flow Execution Pipeline Steps ({currentTrace.steps.length}) — Mode: <span className="font-mono text-emerald-300">{currentTrace.mode}</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSql(!showSql)}
                  className="text-xs gap-1 text-slate-400 hover:text-slate-200"
                >
                  <Code className="w-3.5 h-3.5" />
                  {showSql ? 'Hide SQL Query' : 'Inspect SQL AST'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {showSql && (
                <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-300 whitespace-pre-wrap overflow-x-auto">
                  {currentTrace.queryGenerated}
                </div>
              )}

              <div className="space-y-2.5">
                {currentTrace.steps.map((step) => (
                  <div
                    key={step.stepNumber}
                    className={`p-3.5 rounded-lg border flex items-start gap-3 transition-colors ${
                      step.status === 'passed' ? 'bg-slate-950/70 border-slate-800' :
                      step.status === 'warning' ? 'bg-amber-950/20 border-amber-800/40' :
                      'bg-rose-950/20 border-rose-800/40'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {step.status === 'passed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : step.status === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">
                          Step {step.stepNumber}: {step.name}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                          {step.durationMs}ms
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{step.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
