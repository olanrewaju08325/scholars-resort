import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Cpu, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { AiUsageMonitoringService, type TokenQuotaStatus } from '@/services/aiUsageMonitoringService';

export function AiQuotaStatusModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [quota, setQuota] = useState<TokenQuotaStatus>(AiUsageMonitoringService.getQuotaStatus());

  useEffect(() => {
    const handleOpen = () => {
      setQuota(AiUsageMonitoringService.getQuotaStatus());
      setIsOpen(true);
    };

    window.addEventListener('open-ai-quota-modal', handleOpen);
    const unsubscribe = AiUsageMonitoringService.subscribe((status) => {
      setQuota(status);
    });

    return () => {
      window.removeEventListener('open-ai-quota-modal', handleOpen);
      unsubscribe();
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-card border-border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg font-bold font-display">AI Token Quota & Usage Health</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Real-time telemetry tracking your Groq AI model tokens, daily request allotments, and caching metrics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Status Banner */}
          <div className={`p-3 rounded-xl border flex items-center gap-2.5 ${
            quota.isLowQuota 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
          }`}>
            {quota.isLowQuota ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
            <div className="font-semibold">{quota.statusMessage}</div>
          </div>

          {/* Token Progress */}
          <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-primary" /> Token Budget Allocation
              </span>
              <span className="text-foreground">{quota.percentRemaining}% Remaining</span>
            </div>
            <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  quota.isLowQuota ? 'bg-amber-500' : 'bg-primary'
                }`}
                style={{ width: `${quota.percentRemaining}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{quota.tokensRemaining.toLocaleString()} tokens remaining</span>
              <span>{quota.totalTokenBudget.toLocaleString()} total monthly cap</span>
            </div>
          </div>

          {/* Daily Requests */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-muted/30 border border-border rounded-lg">
              <div className="text-muted-foreground text-[10px] uppercase font-bold">Calls Made Today</div>
              <div className="text-base font-bold text-foreground mt-0.5">{quota.callsMadeToday}</div>
              <div className="text-[10px] text-muted-foreground">of {quota.dailyCallBudget} daily cap</div>
            </div>

            <div className="p-2.5 bg-muted/30 border border-border rounded-lg">
              <div className="text-muted-foreground text-[10px] uppercase font-bold">Remaining Calls</div>
              <div className="text-base font-bold text-emerald-500 mt-0.5">{quota.callsRemaining}</div>
              <div className="text-[10px] text-muted-foreground">available for enrich / hints</div>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground bg-primary/5 p-2.5 rounded-lg border border-primary/10 leading-relaxed">
            💡 <strong>Zero-Cost Intelligence:</strong> Questions with explanations cached in Supabase or local storage consume <strong>0 tokens</strong>, ensuring uninterrupted study.
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => AiUsageMonitoringService.resetQuotaTracking()}
            className="text-xs text-muted-foreground hover:text-foreground gap-1 h-8"
          >
            <RefreshCw className="w-3 h-3" /> Reset Counters
          </Button>
          <Button size="sm" onClick={() => setIsOpen(false)} className="text-xs h-8">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
