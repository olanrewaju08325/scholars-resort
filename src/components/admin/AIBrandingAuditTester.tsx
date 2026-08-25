import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, Sparkles, CheckCircle2, AlertTriangle, XCircle, 
  RefreshCw, Play, ShieldAlert, FileText, Download, Code2, 
  BrainCircuit, Check, Terminal, Eye, Layers, Lock, Zap
} from 'lucide-react';
import { 
  AIBrandingAuditService, 
  ACADEMIC_AUDIT_TEST_CASES, 
  type AIBrandingAuditReport, 
  type SingleAuditResult,
  type AcademicAuditTestCase 
} from '@/services/aiBrandingAuditService';
import { toast } from 'sonner';

export const AIBrandingAuditTester: React.FC = () => {
  const [runningAll, setRunningAll] = useState(false);
  const [runningSingleId, setRunningSingleId] = useState<string | null>(null);
  const [report, setReport] = useState<AIBrandingAuditReport | null>(null);
  const [activeResult, setActiveResult] = useState<SingleAuditResult | null>(null);
  const [showRawOutput, setShowRawOutput] = useState(false);

  const handleRunFullAudit = async () => {
    setRunningAll(true);
    toast.info('Triggering automated AI Branding Audit across academic subjects...');
    try {
      const res = await AIBrandingAuditService.runFullBrandingAudit();
      setReport(res);
      if (res.results.length > 0) {
        setActiveResult(res.results[0]);
      }
      if (res.status === 'passed') {
        toast.success(`Branding Audit Passed! Score: ${res.overallScore}% (${res.brandComplianceRating})`);
      } else {
        toast.warning(`Branding Audit completed with ${res.totalViolations} item(s) to review.`);
      }
    } catch (err: any) {
      toast.error(`Audit failed to complete: ${err.message}`);
    } finally {
      setRunningAll(false);
    }
  };

  const handleRunSingle = async (testCase: AcademicAuditTestCase) => {
    setRunningSingleId(testCase.id);
    toast.info(`Running audit test for ${testCase.category}: ${testCase.title}...`);
    try {
      const res = await AIBrandingAuditService.auditSingleTestCase(testCase);
      setActiveResult(res);
      
      // Update in existing report if present
      if (report) {
        const updatedResults = report.results.map(r => r.testCaseId === res.testCaseId ? res : r);
        const exists = updatedResults.some(r => r.testCaseId === res.testCaseId);
        const finalResults = exists ? updatedResults : [...updatedResults, res];
        const overallScore = Math.round(finalResults.reduce((acc, r) => acc + r.score, 0) / finalResults.length);
        
        setReport({
          ...report,
          overallScore,
          results: finalResults
        });
      } else {
        setReport({
          id: `audit_${Date.now()}`,
          timestamp: new Date().toISOString(),
          overallScore: res.score,
          status: res.passed ? 'passed' : 'warning',
          totalTests: 1,
          passedTests: res.passed ? 1 : 0,
          failedTests: res.passed ? 0 : 1,
          totalViolations: res.violations.length,
          averageLatencyMs: res.latencyMs,
          brandComplianceRating: res.passed ? '100% Brand Compliant' : 'Needs Review',
          results: [res],
          summary: {
            zeroVendorMentions: res.zeroExternalVendors,
            zeroExternalApiLeaks: !res.violations.some(v => v.type === 'external_api_leak'),
            zeroMockDataFound: res.zeroMockData,
            scholarsResortIdentityVerified: res.brandPersonaMaintained
          }
        });
      }

      if (res.passed) {
        toast.success(`Passed audit for ${testCase.title} (${res.score}%)`);
      } else {
        toast.warning(`Identified ${res.violations.length} issue(s) in response format.`);
      }
    } catch (err: any) {
      toast.error(`Test execution failed: ${err.message}`);
    } finally {
      setRunningSingleId(null);
    }
  };

  const exportAuditReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scholars_resort_ai_branding_audit_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded AI Branding Audit Report (JSON)');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="border border-purple-800/40 bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 shadow-xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/40 text-xs px-2.5 py-0.5 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Automated AI Branding & Output Auditor
                </Badge>
                <Badge variant="outline" className="text-slate-400 text-xs">
                  Zero Mock Data & Anti-Leakage Verified
                </Badge>
              </div>
              <h2 className="text-2xl font-bold font-display text-white">
                Scholars Resort AI Branding Audit
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl">
                Automatically triggers the AI Academic Engine with varied UTME queries across Mathematics, Sciences, English, and Commercial subjects. Verifies that output adheres 100% to Scholars Resort brand guidelines with zero external API mentions, zero vendor watermarks, and zero mock data.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {report && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={exportAuditReport}
                  className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                >
                  <Download className="w-4 h-4 mr-2" /> Export Audit Log
                </Button>
              )}
              <Button
                onClick={handleRunFullAudit}
                disabled={runningAll || runningSingleId !== null}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-lg shadow-purple-900/30"
              >
                {runningAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Running Full Audit...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2 fill-current" /> Run Full AI Branding Audit
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Scorecard if report available */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className={`border ${report.overallScore >= 90 ? 'bg-emerald-950/20 border-emerald-800/40' : report.overallScore >= 75 ? 'bg-amber-950/20 border-amber-800/40' : 'bg-rose-950/20 border-rose-800/40'}`}>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Brand Compliance Score</div>
              <div className="text-3xl font-extrabold text-white flex items-center gap-2">
                {report.overallScore}%
                {report.overallScore >= 90 ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-400" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">{report.brandComplianceRating}</p>
            </CardContent>
          </Card>

          <Card className="border bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Zero External Vendor Tags</div>
              <div className="text-3xl font-extrabold text-white flex items-center gap-2">
                {report.summary.zeroVendorMentions ? (
                  <span className="text-emerald-400 flex items-center gap-1.5 text-2xl font-bold">
                    <ShieldCheck className="w-5 h-5" /> 100% Clean
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1.5 text-2xl font-bold">
                    <ShieldAlert className="w-5 h-5" /> Detected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">No Myschool, Pass.ng, or Prep50 tags</p>
            </CardContent>
          </Card>

          <Card className="border bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Zero External API Leaks</div>
              <div className="text-3xl font-extrabold text-white flex items-center gap-2">
                {report.summary.zeroExternalApiLeaks ? (
                  <span className="text-emerald-400 flex items-center gap-1.5 text-2xl font-bold">
                    <Lock className="w-5 h-5" /> Protected
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1.5 text-2xl font-bold">
                    <AlertTriangle className="w-5 h-5" /> Leaked
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">No OpenAI, Gemini, or Groq references</p>
            </CardContent>
          </Card>

          <Card className="border bg-slate-900 border-slate-800">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Zero Mock / Dummy Data</div>
              <div className="text-3xl font-extrabold text-white flex items-center gap-2">
                {report.summary.zeroMockDataFound ? (
                  <span className="text-emerald-400 flex items-center gap-1.5 text-2xl font-bold">
                    <Check className="w-5 h-5" /> Authentic
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1.5 text-2xl font-bold">
                    <AlertTriangle className="w-5 h-5" /> Flagged
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">No placeholder or boilerplate stubs</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Test Cases Grid & Detailed Inspection Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Academic Test Cases */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" /> Standard Academic Test Cases
            </h3>
            <span className="text-xs text-muted-foreground">{ACADEMIC_AUDIT_TEST_CASES.length} suites</span>
          </div>

          <div className="space-y-2.5">
            {ACADEMIC_AUDIT_TEST_CASES.map((tc) => {
              const res = report?.results.find(r => r.testCaseId === tc.id);
              const isSelected = activeResult?.testCaseId === tc.id;
              const isRunning = runningSingleId === tc.id;

              return (
                <Card 
                  key={tc.id}
                  onClick={() => res && setActiveResult(res)}
                  className={`border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-purple-500 bg-purple-950/30 shadow-md ring-1 ring-purple-500/40' 
                      : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
                  }`}
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-700 bg-slate-800/80 text-slate-300">
                            {tc.category}
                          </Badge>
                          <h4 className="text-sm font-semibold text-slate-200 truncate">{tc.title}</h4>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {tc.query}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {res ? (
                          <Badge className={`text-xs font-bold ${res.passed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'}`}>
                            {res.score}% {res.passed ? 'PASS' : 'WARN'}
                          </Badge>
                        ) : null}

                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={runningAll || isRunning}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRunSingle(tc);
                          }}
                          className="h-7 px-2 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-950/40"
                        >
                          {isRunning ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Play className="w-3 h-3 mr-1 fill-current" /> Test
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Right Column: Live Audit Inspection Result */}
        <div className="lg:col-span-7 space-y-4">
          {activeResult ? (
            <Card className="border border-slate-800 bg-slate-900 shadow-lg">
              <CardHeader className="p-5 pb-3 border-b border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-purple-600/30 text-purple-300 border-purple-500/40 text-xs">
                        {activeResult.category}
                      </Badge>
                      <span className="text-xs text-slate-400">Latency: {activeResult.latencyMs}ms</span>
                      <span className="text-xs text-slate-400">• ~{activeResult.tokensEstimated} tokens</span>
                    </div>
                    <CardTitle className="text-lg font-bold font-display text-white">
                      {activeResult.title}
                    </CardTitle>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRawOutput(!showRawOutput)}
                      className="h-8 text-xs border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      <Code2 className="w-3.5 h-3.5 mr-1.5" />
                      {showRawOutput ? 'View Formatted' : 'View Raw'}
                    </Button>
                    <Badge className={`text-xs px-3 py-1 font-bold ${activeResult.passed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'}`}>
                      {activeResult.score}% {activeResult.passed ? 'COMPLIANT' : 'VIOLATION DETECTED'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                {/* Brand Audit Rule Checkpoints */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className={`p-2.5 rounded-lg border text-center ${activeResult.brandPersonaMaintained ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-rose-950/20 border-rose-800/40'}`}>
                    <div className="text-[11px] font-bold text-slate-300">Scholars Resort Persona</div>
                    <div className={`text-xs font-semibold mt-1 flex items-center justify-center gap-1 ${activeResult.brandPersonaMaintained ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {activeResult.brandPersonaMaintained ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {activeResult.brandPersonaMaintained ? 'Verified' : 'Misaligned'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border text-center ${activeResult.zeroExternalVendors ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-rose-950/20 border-rose-800/40'}`}>
                    <div className="text-[11px] font-bold text-slate-300">Zero Vendor Tags</div>
                    <div className={`text-xs font-semibold mt-1 flex items-center justify-center gap-1 ${activeResult.zeroExternalVendors ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {activeResult.zeroExternalVendors ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {activeResult.zeroExternalVendors ? 'Clean (0)' : 'Detected'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border text-center ${activeResult.zeroMockData ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-rose-950/20 border-rose-800/40'}`}>
                    <div className="text-[11px] font-bold text-slate-300">Zero Mock / Dummy</div>
                    <div className={`text-xs font-semibold mt-1 flex items-center justify-center gap-1 ${activeResult.zeroMockData ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {activeResult.zeroMockData ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                      {activeResult.zeroMockData ? '100% Authentic' : 'Flagged'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border text-center ${activeResult.pedagogicalQuality ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-amber-950/20 border-amber-800/40'}`}>
                    <div className="text-[11px] font-bold text-slate-300">Pedagogical Depth</div>
                    <div className={`text-xs font-semibold mt-1 flex items-center justify-center gap-1 ${activeResult.pedagogicalQuality ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {activeResult.pedagogicalQuality ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      {activeResult.pedagogicalQuality ? 'High Standard' : 'Basic'}
                    </div>
                  </div>
                </div>

                {/* Violation Alerts if any */}
                {activeResult.violations.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4" /> Detected Branding Violations ({activeResult.violations.length})
                    </h5>
                    <div className="space-y-1.5">
                      {activeResult.violations.map((v, idx) => (
                        <div key={idx} className="p-2.5 rounded-md bg-rose-950/30 border border-rose-800/50 flex items-start gap-2.5 text-xs text-rose-200">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-rose-300">[{v.type.toUpperCase()}]</span> {v.description} (Matched term: <code className="bg-rose-900/60 px-1 py-0.5 rounded font-mono text-rose-100">{v.term}</code>)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response Output Inspector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-purple-400" /> AI Response Payload
                    </h5>
                    <span className="text-xs text-slate-500">Rendered with Markdown & Math support</span>
                  </div>

                  {showRawOutput ? (
                    <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-96">
                      {activeResult.cleanResponse}
                    </pre>
                  ) : (
                    <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-slate-200 leading-relaxed overflow-y-auto max-h-96 whitespace-pre-line">
                      {activeResult.cleanResponse}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center">
              <BrainCircuit className="w-12 h-12 text-purple-400/50 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-200">No Audit Test Selected</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Click <strong>"Run Full AI Branding Audit"</strong> or select an individual academic test case on the left to trigger the verification pipeline.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
