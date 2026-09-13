import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2, 
  Trash2, Cpu, Zap, Activity, Info 
} from 'lucide-react';
import { authFetch } from '@/lib/apiAuth';
import { toast } from 'sonner';

interface TokenConsumptionAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TokenConsumptionAuditModal: React.FC<TokenConsumptionAuditModalProps> = ({
  isOpen,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [auditData, setAuditData] = useState<{
    summary?: {
      totalDbEntriesAudited: number;
      totalDbLoggedTokens: number;
      totalVerifiedProviderTokens: number;
      discrepancyCount: number;
      wastedTokenAmount: number;
      healthStatus: string;
    };
    discrepancies?: Array<{
      id: string;
      createdAt: string;
      feature: string;
      provider: string;
      promptTokens: number;
      completionTokens: number;
      loggedTotalTokens: number;
      issueReason: string;
    }>;
  } | null>(null);

  const runAudit = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/token-consumption-audit');
      const data = await res.json();

      if (data && data.success) {
        setAuditData(data);
        if (data.summary?.discrepancyCount === 0) {
          toast.success('Token Audit Complete: All ai_usage token records perfectly match Groq API logs!');
        } else {
          toast.warning(`Found ${data.summary?.discrepancyCount} token log discrepancies.`);
        }
      } else {
        toast.error(data.error || 'Token audit failed');
      }
    } catch (err: any) {
      toast.error('Token audit error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const reconcileDiscrepancies = async () => {
    setReconciling(true);
    try {
      const res = await authFetch('/api/admin/token-consumption-audit/reconcile', {
        method: 'POST'
      });
      const data = await res.json();

      if (data && data.success) {
        toast.success(data.message || 'Token usage successfully reconciled!');
        await runAudit();
      } else {
        toast.error(data.error || 'Reconciliation failed');
      }
    } catch (err: any) {
      toast.error('Reconciliation error: ' + err.message);
    } finally {
      setReconciling(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runAudit();
    }
  }, [isOpen]);

  const summary = auditData?.summary;
  const discrepancies = auditData?.discrepancies || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!loading && !reconciling) onClose(); }}>
      <DialogContent className="max-w-3xl bg-card border-border text-foreground shadow-2xl p-6">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-display">
                Token Consumption Audit & Discrepancy Utility
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Validates database ai_usage entries against Groq provider responses. Flags unfulfilled token burns and eliminates billing inaccuracies.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-muted/40 border border-border/80 rounded-xl p-3">
              <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-blue-500" /> Audited Logs
              </div>
              <div className="text-xl font-bold font-display mt-1">
                {loading ? '...' : (summary?.totalDbEntriesAudited || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Database Entries</div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified Tokens
              </div>
              <div className="text-xl font-bold font-display mt-1 text-emerald-600 dark:text-emerald-400">
                {loading ? '...' : (summary?.totalVerifiedProviderTokens || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Valid Provider Output</div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Discrepancies
              </div>
              <div className="text-xl font-bold font-display mt-1 text-amber-600 dark:text-amber-400">
                {loading ? '...' : summary?.discrepancyCount || 0}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Unfulfilled Entries</div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <div className="text-[11px] text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" /> Wasted Tokens
              </div>
              <div className="text-xl font-bold font-display mt-1 text-red-600 dark:text-red-400">
                {loading ? '...' : (summary?.wastedTokenAmount || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Purgeable Discrepancy</div>
            </div>
          </div>

          {/* Discrepancies Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                Flagged Token Log Discrepancies ({discrepancies.length})
              </span>
              {summary && summary.discrepancyCount > 0 && (
                <Button
                  type="button"
                  onClick={reconcileDiscrepancies}
                  disabled={reconciling}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs h-7 px-3 font-semibold gap-1.5 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {reconciling ? 'Reconciling...' : 'Auto-Reconcile Token Discrepancies'}
                </Button>
              )}
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl max-h-56 overflow-y-auto">
              {discrepancies.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-200">Zero Token Discrepancies Detected</p>
                  <p className="text-[11px] text-slate-400">
                    All token consumption records in ai_usage accurately correspond to verified Groq API provider responses.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs font-mono text-slate-300">
                  <thead className="bg-slate-900 border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                    <tr>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Feature</th>
                      <th className="py-2 px-3">Prompt Tok</th>
                      <th className="py-2 px-3">Comp Tok</th>
                      <th className="py-2 px-3">Logged Total</th>
                      <th className="py-2 px-3">Audit Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {discrepancies.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-900/50">
                        <td className="py-2 px-3 text-slate-400">
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant="outline" className="text-[10px] bg-indigo-950 text-indigo-300 border-indigo-800">
                            {item.feature}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-amber-400">{item.promptTokens}</td>
                        <td className="py-2 px-3 text-red-400 font-bold">{item.completionTokens}</td>
                        <td className="py-2 px-3 font-bold">{item.loggedTotalTokens}</td>
                        <td className="py-2 px-3 text-[11px] text-red-300">
                          {item.issueReason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button
            type="button"
            onClick={runAudit}
            disabled={loading || reconciling}
            variant="ghost"
            className="text-xs h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Re-Scan Audit
          </Button>

          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="text-xs h-9 px-4"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
