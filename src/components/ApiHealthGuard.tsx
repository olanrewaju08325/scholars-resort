import React, { useEffect, useState } from 'react';
import { runApiHealthCheck, type ApiHealthReport } from '@/services/apiHealthCheck';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, RefreshCw, Sparkles, KeyRound, Database, Wifi } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ApiHealthGuardProps {
  children: React.ReactNode;
  requireGroq?: boolean;
}

export const ApiHealthGuard: React.FC<ApiHealthGuardProps> = ({ children, requireGroq = false }) => {
  const [report, setReport] = useState<ApiHealthReport | null>(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  const performCheck = async () => {
    setChecking(true);
    try {
      const rep = await runApiHealthCheck();
      setReport(rep);
    } catch {
      // Fallback
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    performCheck();
  }, []);

  if (checking && !report) {
    return <>{children}</>;
  }

  // If Groq key is strictly required for this specific view (e.g. AI Tutor dedicated area) and missing:
  if (requireGroq && report && !report.groqKeyValid) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-card rounded-2xl border border-border shadow-lg text-center space-y-5">
        <div className="w-14 h-14 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center mx-auto">
          <KeyRound className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold font-display text-foreground">GROQ AI API Key Required</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The AI features require a configured GROQ API key. You can easily add and save your key directly in the Admin Settings tab without touching any SQL files.
          </p>
        </div>

        <div className="p-4 bg-muted/40 rounded-xl border border-border/60 text-xs text-left text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            <span>Supabase Connection: <strong>Connected ({report.supabaseLatencyMs}ms)</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-blue-500" />
            <span>Realtime State: <strong>{report.realtimeState}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Storage Vault: <strong>IndexedDB Ready</strong></span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button onClick={() => navigate('/scholarresortadmin')} className="w-full sm:w-auto font-medium">
            <KeyRound className="w-4 h-4 mr-2" /> Open Admin Key Settings
          </Button>
          <Button variant="outline" onClick={performCheck} disabled={checking} className="w-full sm:w-auto">
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? 'animate-spin' : ''}`} /> Recheck Status
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

/**
 * Compact Health Badge component for displaying system status in Admin & Dev headers
 */
export const ApiHealthBadge: React.FC = () => {
  const [report, setReport] = useState<ApiHealthReport | null>(null);

  useEffect(() => {
    runApiHealthCheck().then(setReport).catch(() => {});
  }, []);

  if (!report) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border bg-muted/50 border-border">
      {report.isHealthy ? (
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>System Healthy</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Key Unconfigured</span>
        </span>
      )}
      <span className="text-muted-foreground">|</span>
      <span className="text-muted-foreground text-[11px] font-mono">
        Vault: {report.groqSource !== 'missing' ? report.groqSource : 'Empty'}
      </span>
    </div>
  );
};
