import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cpu, RefreshCw, Zap, CheckCircle2 } from 'lucide-react';
import { fetchGroqTelemetry, type GroqTelemetryData } from '@/services/groqTelemetryService';

export const GroqLiveQuotaWidget: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [telemetry, setTelemetry] = useState<GroqTelemetryData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadQuotaData = async () => {
    setLoading(true);
    const data = await fetchGroqTelemetry();
    if (data) {
      setTelemetry(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadQuotaData();
    // Refresh real-time quota telemetry every 15 seconds
    const interval = setInterval(loadQuotaData, 15000);
    return () => clearInterval(interval);
  }, []);

  const remainingTokensRaw = telemetry?.quota?.remainingTokens;
  const limitTokensRaw = telemetry?.quota?.limitTokens;
  const resetTokens = telemetry?.quota?.resetTokens || '1m';

  const remainingTokensNum = remainingTokensRaw && !isNaN(Number(remainingTokensRaw)) ? Number(remainingTokensRaw) : null;
  const limitTokensNum = limitTokensRaw && !isNaN(Number(limitTokensRaw)) ? Number(limitTokensRaw) : null;

  // Calculate percentage remaining
  let pctRemaining = 100;
  if (remainingTokensNum !== null && limitTokensNum !== null && limitTokensNum > 0) {
    pctRemaining = Math.max(0, Math.min(100, Math.round((remainingTokensNum / limitTokensNum) * 100)));
  }

  const totalTokensUsed = telemetry?.totals?.totalTokens || 0;
  const totalRequests = telemetry?.totals?.totalRequests || 0;
  const avgLatency = telemetry?.totals?.avgLatencyMs || 0;

  return (
    <Card className={`bg-slate-900 border-slate-800 text-slate-100 shadow-md overflow-hidden relative ${className}`}>
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-primary to-amber-500" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                Groq AI Real-Time Quota
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Live Telemetry
                </span>
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Direct server-side API telemetry & token quota tracking
              </CardDescription>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadQuotaData}
            disabled={loading}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Token Quota Progress Bar */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-medium flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Remaining Token Quota
            </span>
            <span className="font-mono font-bold text-emerald-400">
              {remainingTokensNum !== null 
                ? `${remainingTokensNum.toLocaleString()} Tokens` 
                : remainingTokensRaw || 'Active / Unlimited'}
            </span>
          </div>

          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 ${
                pctRemaining < 20 ? 'bg-red-500' : pctRemaining < 50 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${pctRemaining}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
            <span>Limit: {limitTokensNum !== null ? limitTokensNum.toLocaleString() : limitTokensRaw || 'Dynamic'}</span>
            <span>Reset Window: {resetTokens}</span>
          </div>
        </div>

        {/* Dynamic Telemetry Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Total Used</div>
            <div className="text-sm font-bold font-mono text-primary mt-0.5">
              {totalTokensUsed.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Requests</div>
            <div className="text-sm font-bold font-mono text-blue-400 mt-0.5">
              {totalRequests.toLocaleString()}
            </div>
          </div>

          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Avg Latency</div>
            <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
              {avgLatency > 0 ? `${avgLatency}ms` : '<100ms'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
