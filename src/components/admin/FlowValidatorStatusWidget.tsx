import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, CheckCircle2, AlertTriangle, XCircle, 
  RefreshCw, Play, Download, Zap, BookOpen, Layers, Award, Clock
} from 'lucide-react';
import { FlowValidator, type CbtSuiteValidationReport } from '@/services/flowValidatorService';
import type { ExamMode } from '@/services/questionFlowService';
import { toast } from 'sonner';

interface FlowValidatorStatusWidgetProps {
  onOpenFullValidator?: () => void;
}

export const FlowValidatorStatusWidget: React.FC<FlowValidatorStatusWidgetProps> = ({
  onOpenFullValidator
}) => {
  const [report, setReport] = useState<CbtSuiteValidationReport | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);

  const loadSavedReport = () => {
    const latest = FlowValidator.getLatestReport();
    if (latest) {
      setReport(latest);
      setLastRunTime(new Date(latest.timestamp).toLocaleTimeString());
    }
  };

  useEffect(() => {
    loadSavedReport();
    // Run automated 24-hour cron check if needed
    FlowValidator.init24HourCron('Use of English');
  }, []);

  const handleRunQuickCheck = async () => {
    setIsValidating(true);
    toast.info('Validating live database flow across all 4 CBT modes...');
    try {
      const res = await FlowValidator.validateAllCbtModes('Use of English');
      setReport(res);
      setLastRunTime(new Date(res.timestamp).toLocaleTimeString());
      localStorage.setItem('scholars_latest_flow_report', JSON.stringify(res));
      localStorage.setItem('scholars_last_flow_validator_run', Date.now().toString());

      if (res.overallHealth === 'optimal') {
        toast.success(`Flow check passed! Live DB queries verified for all 4 modes (${res.totalLatencyMs}ms).`);
      } else if (res.overallHealth === 'moderate') {
        toast.warning('Flow check completed with warnings.');
      } else {
        toast.error('Flow check detected failures in one or more modes.');
      }
    } catch (err: any) {
      toast.error(`Validation failed: ${err.message || err}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleExportCsv = () => {
    if (!report) {
      toast.error('No validation report to export. Run a check first.');
      return;
    }
    FlowValidator.exportReportToCsv(report);
    toast.success('Downloaded FlowValidator CSV report!');
  };

  const getModeIcon = (mode: ExamMode) => {
    switch (mode) {
      case 'subject_practice':
        return <BookOpen className="w-4 h-4 text-emerald-400" />;
      case 'topic_drill':
        return <Layers className="w-4 h-4 text-sky-400" />;
      case 'speed_test':
        return <Zap className="w-4 h-4 text-amber-400" />;
      case 'full_mock':
        return <Award className="w-4 h-4 text-purple-400" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getModeLabel = (mode: ExamMode) => {
    switch (mode) {
      case 'subject_practice':
        return 'Subject Practice';
      case 'topic_drill':
        return 'Topic Drill';
      case 'speed_test':
        return 'Speed Test (20Q)';
      case 'full_mock':
        return 'Full Mock (180Q)';
      default:
        return mode;
    }
  };

  const defaultModes: ExamMode[] = ['subject_practice', 'topic_drill', 'speed_test', 'full_mock'];

  return (
    <Card className="border border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 via-card to-card shadow-md">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-base font-bold font-display flex items-center gap-2">
                FlowValidator Engine Status
                {report && (
                  <Badge 
                    variant="outline" 
                    className={
                      report.overallHealth === 'optimal'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px]'
                        : report.overallHealth === 'moderate'
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px]'
                        : 'bg-red-500/10 text-red-500 border-red-500/30 text-[10px]'
                    }
                  >
                    {String(report.overallHealth || 'HEALTHY').toUpperCase()}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                Zero-Mock verification & live query validation across 4 CBT engine modes
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-8 text-xs gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleRunQuickCheck}
              disabled={isValidating}
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isValidating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Verify Modes
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Real-time Mode Icons Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {defaultModes.map((modeKey) => {
            const trace = report?.traces.find(t => t.mode === modeKey);
            const status = trace ? trace.overallStatus : 'idle';
            const latency = trace ? `${trace.totalLatencyMs}ms` : '--';
            const rows = trace ? trace.recordsFetched : 0;

            return (
              <div
                key={modeKey}
                className={`p-3 rounded-lg border transition-all ${
                  status === 'passed'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : status === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : status === 'failed'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-border/60 bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getModeIcon(modeKey)}
                    <span className="text-xs font-bold text-foreground truncate max-w-[100px]">
                      {getModeLabel(modeKey)}
                    </span>
                  </div>
                  {status === 'passed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : status === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : status === 'failed' ? (
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{latency}</span>
                  <span>{rows > 0 ? `${rows} live Qs` : status === 'idle' ? 'Ready' : '0 rows'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Telemetry Summary Bar */}
        <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Clock className="w-3.5 h-3.5 text-primary" />
              {lastRunTime ? `Last Verified: ${lastRunTime}` : 'Automated 24h Cron Active'}
            </span>
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Zero Mock Data Enforced
            </span>
          </div>

          {report && (
            <span className="font-mono text-[11px]">
              Total Latency: <strong className="text-foreground">{report.totalLatencyMs}ms</strong> • Fetched:{' '}
              <strong className="text-foreground">{report.totalRecordsFetched} records</strong>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
