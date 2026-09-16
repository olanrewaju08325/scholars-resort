import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Play, RefreshCw, ShieldCheck, Database, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { runReferralFlowDiagnostic, type ReferralDiagnosticReport } from '@/services/referralDiagnostic';

export function ReferralDiagnosticTester() {
  const { user, profile } = useAuth();
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<ReferralDiagnosticReport | null>(null);
  const [showDbResult, setShowDbResult] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRunDiagnostics = async () => {
    setTesting(true);
    setReport(null);
    setShowDbResult(false);

    try {
      const result = await runReferralFlowDiagnostic({
        userId: user?.id,
        profile: profile
      });
      setReport(result);

      if (result.success) {
        toast.success(`Referral verification complete: 100% passed for ${result.referralCode}!`);
      } else {
        toast.warning("Referral diagnostic completed with warnings. Check logs below.");
      }
    } catch (err: any) {
      toast.error(`Diagnostic execution failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleCopyDbResult = () => {
    if (!report?.databaseResult) return;
    navigator.clipboard.writeText(JSON.stringify(report.databaseResult, null, 2));
    setCopied(true);
    toast.success("Database result copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-card text-card-foreground border border-border shadow-sm rounded-2xl overflow-hidden mb-6">
      <CardHeader className="bg-muted/40 p-5 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <CardTitle className="text-base font-bold font-display">
                Referral Flow Diagnostic Suite
              </CardTitle>
              {report !== null && (
                <Badge className={report.success ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}>
                  {report.success ? "ALL CHECKS PASSED (100%)" : "DIAGNOSTIC WARNINGS"}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Automated end-to-end verification helper: tests referral code generation, mock attribution tracking, and queries the database for verification.
            </CardDescription>
          </div>

          <Button
            onClick={handleRunDiagnostics}
            disabled={testing}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 gap-1.5 shadow-sm shrink-0"
          >
            {testing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Running Verification...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Referral Diagnostics
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {!report && !testing ? (
          <div className="text-center py-6 text-muted-foreground text-xs bg-muted/20 border border-dashed border-border rounded-xl">
            Click "Run Referral Diagnostics" to execute the diagnostic helper function and log database attribution results.
          </div>
        ) : testing ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-xs space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            <p className="font-medium text-foreground">Executing automated referral flow test...</p>
            <p className="text-[11px]">Generating code &bull; Dispatching mock student &bull; Querying database attribution</p>
          </div>
        ) : report ? (
          <div className="space-y-4">
            {/* Step Logs */}
            <div className="space-y-2.5 font-mono text-xs">
              {report.steps.map((log, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                    log.status === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                      : log.status === 'failed'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-900 dark:text-rose-200'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {log.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : log.status === 'failed' ? (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    ) : (
                      <RefreshCw className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-bold block">{log.step}</span>
                      <span className="text-[11px] opacity-90 mt-0.5 block">{log.detail}</span>
                    </div>
                  </div>

                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider shrink-0">
                    {log.status}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Database Attribution Payload Verification Block */}
            {report.databaseResult && (
              <div className="mt-4 border border-border rounded-xl overflow-hidden bg-card">
                <button
                  type="button"
                  onClick={() => setShowDbResult(!showDbResult)}
                  className="w-full flex items-center justify-between p-3 bg-muted/30 hover:bg-muted/50 text-xs font-semibold transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" />
                    <span>Database Verification Record (Click to {showDbResult ? 'Collapse' : 'Inspect'})</span>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      JSON Payload
                    </Badge>
                  </div>
                  {showDbResult ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showDbResult && (
                  <div className="p-3 bg-slate-950 text-slate-100 dark:bg-black font-mono text-[11px] relative border-t border-border overflow-x-auto">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                      <span className="text-slate-400 text-[10px]">VERIFIED DATABASE RECORD:</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopyDbResult}
                        className="h-6 px-2 text-[10px] text-slate-300 hover:text-white hover:bg-slate-800"
                      >
                        {copied ? <Check className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
                        {copied ? 'Copied' : 'Copy JSON'}
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(report.databaseResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
