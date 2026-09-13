import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, 
  Search, Download, Zap, Database, Terminal, ShieldCheck, 
  Cpu, Copy, Check, Eye, Trash2, ArrowUpDown, Filter, Sparkles, X, ChevronRight, HelpCircle
} from 'lucide-react';
import { 
  AiUsageDiagnosticService, 
  type AiUsageLogRow, 
  type AiUsageDiagnosticSummary 
} from '@/services/aiUsageDiagnosticService';
import { TokenConsumptionAuditModal } from './TokenConsumptionAuditModal';
import { toast } from 'sonner';

interface AIEnrichmentDiagnosticProps {
  className?: string;
  isCompact?: boolean;
}

export const AIEnrichmentDiagnostic: React.FC<AIEnrichmentDiagnosticProps> = ({ 
  className = '',
  isCompact = false
}) => {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [logs, setLogs] = useState<AiUsageLogRow[]>([]);
  const [summary, setSummary] = useState<AiUsageDiagnosticSummary | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [featureFilter, setFeatureFilter] = useState<string>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [limit, setLimit] = useState<number>(100);
  const [autoRefreshSecs, setAutoRefreshSecs] = useState<number>(5);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  // Detail Modal / Inspector
  const [selectedRow, setSelectedRow] = useState<AiUsageLogRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationPrompt, setSimulationPrompt] = useState('Generate a 1-sentence JAMB Physics tip regarding kinetic energy formulas with formula LaTeX.');
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [showSimPanel, setShowSimPanel] = useState(false);

  const loadLogs = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await AiUsageDiagnosticService.fetchLogs({
        limit,
        status: statusFilter,
        feature: featureFilter,
        provider: providerFilter,
        search: searchQuery
      });

      if (res.success) {
        setLogs(res.rows);
        setSummary(res.summary);
        setTotalCount(res.total_count);
        setLastUpdated(new Date().toLocaleTimeString());
      } else {
        if (!silent) toast.error(res.error || 'Failed to fetch ai_usage diagnostic logs');
      }
    } catch (err: any) {
      if (!silent) toast.error('Error: ' + err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [limit, statusFilter, featureFilter, providerFilter, searchQuery]);

  // Initial load and filter change
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshSecs <= 0) return;
    const interval = setInterval(() => {
      loadLogs(true);
    }, autoRefreshSecs * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshSecs, loadLogs]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const res = await AiUsageDiagnosticService.runSimulation(simulationPrompt);
      if (res.success && res.log) {
        setSimulationResult(res);
        toast.success('Simulation verified! Live deduction logged to ai_usage.');
        await loadLogs(true);
      } else {
        toast.error(res.error || 'Simulation request failed');
      }
    } catch (err: any) {
      toast.error('Simulation error: ' + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleClearSimulationLogs = async () => {
    if (!window.confirm('Clear diagnostic simulation records from ai_usage?')) return;
    try {
      const res = await AiUsageDiagnosticService.clearSimulationLogs();
      if (res.success) {
        toast.success(res.message || 'Simulation logs purged.');
        await loadLogs();
      } else {
        toast.error(res.error || 'Purge failed');
      }
    } catch (err: any) {
      toast.error('Purge error: ' + err.message);
    }
  };

  const exportCSV = () => {
    if (logs.length === 0) {
      toast.error('No logs to export');
      return;
    }
    const headers = ['ID', 'Timestamp', 'Provider', 'Feature', 'Prompt Tokens', 'Completion Tokens', 'Total Tokens', 'Yield %', 'Status Verification', 'Verdict', 'Est Cost (USD)'];
    const csvRows = logs.map(l => [
      l.id,
      new Date(l.created_at).toISOString(),
      l.provider,
      l.feature,
      l.prompt_tokens,
      l.completion_tokens,
      l.total_tokens,
      `${l.yield_ratio_percent}%`,
      l.status_verification,
      `"${(l.verification_verdict || '').replace(/"/g, '""')}"`,
      `$${l.estimated_cost_usd}`
    ]);

    const csvContent = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ai_usage_diagnostic_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported AI diagnostic logs to CSV');
  };

  const exportJSON = () => {
    if (logs.length === 0) {
      toast.error('No logs to export');
      return;
    }
    const blob = new Blob([JSON.stringify({ summary, logs }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ai_usage_diagnostic_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported AI diagnostic logs to JSON');
  };

  const renderStatusBadge = (row: AiUsageLogRow) => {
    switch (row.status_verification) {
      case 'verified_success':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30 gap-1 text-[11px] font-mono font-medium">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Verified Success
          </Badge>
        );
      case 'prompt_only_aborted':
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border-amber-500/30 gap-1 text-[11px] font-mono font-medium">
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Prompt Only / Aborted
          </Badge>
        );
      case 'zero_tokens':
      default:
        return (
          <Badge className="bg-slate-500/15 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 border-slate-500/30 gap-1 text-[11px] font-mono font-medium">
            <XCircle className="w-3 h-3 text-slate-500" /> Zero Deduction
          </Badge>
        );
    }
  };

  const renderFeatureBadge = (feature: string) => {
    const f = (feature || '').toLowerCase();
    if (f.includes('batch_enrich')) {
      return <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[10px] font-mono uppercase">Batch CSV Enrich</span>;
    }
    if (f.includes('single_enrich') || f.includes('question_enrich')) {
      return <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10px] font-mono uppercase">Single Q Enrich</span>;
    }
    if (f.includes('simulation')) {
      return <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-mono uppercase">Live Simulation</span>;
    }
    if (f.includes('chat')) {
      return <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-[10px] font-mono uppercase">Groq Chat</span>;
    }
    return <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 text-[10px] font-mono uppercase">{feature || 'Inference'}</span>;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                AI Enrichment Diagnostic & Token Deduction Audit
              </h2>
              <p className="text-xs text-muted-foreground">
                Authoritative verification proving tokens are deducted exclusively for actual generated completions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          {/* Live indicator & Auto refresh */}
          <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border border-border text-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-muted-foreground text-[11px]">Auto-Refresh:</span>
            <select
              value={autoRefreshSecs}
              onChange={e => setAutoRefreshSecs(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value={0}>Off</option>
              <option value={3}>3s</option>
              <option value={5}>5s</option>
              <option value={15}>15s</option>
              <option value={30}>30s</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadLogs()}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAuditModal(true)}
            className="h-8 gap-1.5 text-xs bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            Token Consumption Audit
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSimPanel(!showSimPanel)}
            className="h-8 gap-1.5 text-xs bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary font-medium"
          >
            <Zap className="w-3.5 h-3.5" />
            {showSimPanel ? 'Hide Simulation' : 'Live Simulation Test'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            className="h-8 gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Live Simulation Panel */}
      {showSimPanel && (
        <Card className="border-primary/30 bg-primary/5 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2 text-primary">
                <Sparkles className="w-4 h-4" /> Run Live Deduction Diagnostic Simulation
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowSimPanel(false)}
                className="h-6 w-6 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </CardTitle>
            <CardDescription className="text-xs">
              Dispatches a live request to Groq API, logs token telemetry to the authoritative <code className="text-primary font-mono font-bold">ai_usage</code> table, and instantly displays row-by-row status verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={simulationPrompt}
                onChange={e => setSimulationPrompt(e.target.value)}
                placeholder="Enter test prompt for live verification..."
                className="text-xs font-mono bg-background"
              />
              <Button
                size="sm"
                onClick={handleRunSimulation}
                disabled={isSimulating}
                className="gap-2 shrink-0"
              >
                {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isSimulating ? 'Processing...' : 'Execute Test'}
              </Button>
            </div>

            {simulationResult && simulationResult.log && (
              <div className="p-3 bg-background/80 rounded-lg border border-border text-xs space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-emerald-500 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> {simulationResult.message}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    Latency: {simulationResult.log.latency_ms}ms
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1 text-center font-mono text-[11px]">
                  <div className="bg-muted p-1.5 rounded">
                    <span className="text-muted-foreground block text-[10px]">Prompt Tokens</span>
                    <span className="font-bold text-foreground">{simulationResult.log.prompt_tokens}</span>
                  </div>
                  <div className="bg-muted p-1.5 rounded">
                    <span className="text-muted-foreground block text-[10px]">Completion Tokens</span>
                    <span className="font-bold text-emerald-500">{simulationResult.log.completion_tokens}</span>
                  </div>
                  <div className="bg-muted p-1.5 rounded">
                    <span className="text-muted-foreground block text-[10px]">Total Deducted</span>
                    <span className="font-bold text-primary">{simulationResult.log.total_tokens}</span>
                  </div>
                </div>
                {simulationResult.log.response_preview && (
                  <div className="p-2 bg-muted/50 rounded border border-border/50 text-[11px] italic text-muted-foreground">
                    "{simulationResult.log.response_preview}"
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border shadow-xs">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Token Volume</p>
                  <h3 className="text-2xl font-bold font-display mt-1 text-foreground">
                    {summary.total_tokens.toLocaleString()}
                  </h3>
                </div>
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Database className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border/50 pt-2">
                <span>Prompt: {summary.total_prompt_tokens.toLocaleString()}</span>
                <span className="text-emerald-500 font-semibold">Output: {summary.total_completion_tokens.toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-xs">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Deduction Success Rate</p>
                  <h3 className="text-2xl font-bold font-display mt-1 text-emerald-500 flex items-center gap-1.5">
                    {summary.success_rate_percent}%
                  </h3>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border/50 pt-2">
                <span>Verified: {summary.success_count}</span>
                <span>Total: {summary.total_rows_sampled}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-xs">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Aborted / Zero Output</p>
                  <h3 className={`text-2xl font-bold font-display mt-1 ${summary.failed_count === 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {summary.failed_count}
                  </h3>
                </div>
                <div className={`p-2 rounded-lg ${summary.failed_count === 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border/50 pt-2">
                <span>Zero Deductions: {summary.zero_token_count}</span>
                <span className="text-emerald-500 font-medium">{summary.failed_count === 0 ? '0 Wasted Tokens' : 'Review rows'}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-xs">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Audit Integrity Verdict</p>
                  <h3 className="text-sm font-bold font-mono mt-2 text-foreground flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{summary.overall_integrity}</span>
                  </h3>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground border-t border-border/50 pt-2 truncate">
                Last checked: {lastUpdated || 'Just now'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="bg-card border-border shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search by Log UUID, feature or provider..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                <span>Status:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="bg-background border border-input rounded-md px-2 py-1 text-xs text-foreground focus:outline-hidden"
                >
                  <option value="all">All Statuses</option>
                  <option value="verified_success">Verified Success Only</option>
                  <option value="prompt_only_aborted">Prompt Only / Aborted</option>
                  <option value="zero_tokens">Zero Deductions</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Feature:</span>
                <select
                  value={featureFilter}
                  onChange={e => setFeatureFilter(e.target.value)}
                  className="bg-background border border-input rounded-md px-2 py-1 text-xs text-foreground focus:outline-hidden"
                >
                  <option value="all">All Features</option>
                  <option value="batch_enrich">Batch CSV Enrich</option>
                  <option value="single_enrich">Single Q Enrich</option>
                  <option value="groq_chat">Groq Chat</option>
                  <option value="diagnostic_simulation">Diagnostic Simulation</option>
                  <option value="client_telemetry">Client Telemetry</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Limit:</span>
                <select
                  value={limit}
                  onChange={e => setLimit(Number(e.target.value))}
                  className="bg-background border border-input rounded-md px-2 py-1 text-xs text-foreground focus:outline-hidden"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw AI Usage Table */}
      <Card className="bg-card border-border shadow-xs">
        <CardHeader className="py-3 px-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              Raw <code className="text-primary font-mono">ai_usage</code> Database Log Stream ({logs.length} / {totalCount} total)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSimulationLogs}
                className="h-7 text-xs text-muted-foreground hover:text-red-500 gap-1"
                title="Purge test simulation logs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Purge Test Logs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs font-mono space-y-2">
              <p>No log records match the current filter criteria.</p>
              <Button size="sm" variant="outline" onClick={() => { setStatusFilter('all'); setFeatureFilter('all'); setSearchQuery(''); }}>
                Reset Filters
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] border-b border-border">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Log ID</th>
                    <th className="p-3">Pipeline Action</th>
                    <th className="p-3 text-right">Prompt</th>
                    <th className="p-3 text-right">Completion</th>
                    <th className="p-3 text-right">Total Tokens</th>
                    <th className="p-3 text-center">Yield</th>
                    <th className="p-3">Status Verification</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {logs.map((row) => (
                    <tr 
                      key={row.id} 
                      onClick={() => setSelectedRow(row)}
                      className="hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        <div className="font-sans font-medium text-foreground text-xs">
                          {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(row.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-[11px] font-mono">
                            {row.id.slice(0, 8)}...
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(row.id, row.id);
                            }}
                            className="text-muted-foreground hover:text-foreground p-0.5"
                            title="Copy UUID"
                          >
                            {copiedId === row.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        {renderFeatureBadge(row.feature)}
                      </td>

                      <td className="p-3 text-right text-cyan-600 dark:text-cyan-400 font-medium">
                        {row.prompt_tokens.toLocaleString()}
                      </td>

                      <td className="p-3 text-right font-medium">
                        <span className={row.completion_tokens > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-muted-foreground'}>
                          {row.completion_tokens.toLocaleString()}
                        </span>
                      </td>

                      <td className="p-3 text-right font-bold text-foreground">
                        {row.total_tokens.toLocaleString()}
                      </td>

                      <td className="p-3 text-center">
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {row.yield_ratio_percent}%
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {renderStatusBadge(row)}
                        </div>
                      </td>

                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRow(row);
                          }}
                          className="h-7 w-7 p-0"
                          title="View detailed JSON inspection"
                        >
                          <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row Detail Inspector Modal */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <h3 className="font-bold font-display text-base text-foreground">
                  AI Token Deduction Proof & Row Audit
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRow(null)}
                className="h-7 w-7 p-0 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-5 space-y-4 font-mono text-xs">
              
              {/* Verdict Card */}
              <div className={`p-3.5 rounded-lg border ${
                selectedRow.is_valid_deduction 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' 
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
              }`}>
                <div className="flex items-start gap-2">
                  {selectedRow.is_valid_deduction ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-bold text-sm">
                      {selectedRow.is_valid_deduction ? 'Verified Legitimate Token Deduction' : 'Deduction Anomaly / Zero Output'}
                    </h4>
                    <p className="mt-1 text-xs opacity-90 font-sans">
                      {selectedRow.verification_verdict}
                    </p>
                  </div>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 bg-muted/60 rounded-lg border border-border">
                  <span className="text-muted-foreground text-[10px] uppercase block">Prompt Tokens</span>
                  <span className="text-base font-bold text-cyan-600 dark:text-cyan-400">{selectedRow.prompt_tokens}</span>
                </div>
                <div className="p-2.5 bg-muted/60 rounded-lg border border-border">
                  <span className="text-muted-foreground text-[10px] uppercase block">Output Tokens</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{selectedRow.completion_tokens}</span>
                </div>
                <div className="p-2.5 bg-muted/60 rounded-lg border border-border">
                  <span className="text-muted-foreground text-[10px] uppercase block">Total Deducted</span>
                  <span className="text-base font-bold text-foreground">{selectedRow.total_tokens}</span>
                </div>
                <div className="p-2.5 bg-muted/60 rounded-lg border border-border">
                  <span className="text-muted-foreground text-[10px] uppercase block">Output Yield</span>
                  <span className="text-base font-bold text-primary">{selectedRow.yield_ratio_percent}%</span>
                </div>
              </div>

              {/* Mathematical Proof */}
              <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Log Record UUID:</span>
                  <span className="text-foreground select-all">{selectedRow.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pipeline Action:</span>
                  <span className="text-foreground uppercase">{selectedRow.feature}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Provider:</span>
                  <span className="text-foreground uppercase">{selectedRow.provider}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recorded Timestamp:</span>
                  <span className="text-foreground">{new Date(selectedRow.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                  <span className="text-muted-foreground">Mathematical Equation:</span>
                  <span className="text-emerald-500 font-bold">
                    {selectedRow.prompt_tokens} (prompt) + {selectedRow.completion_tokens} (output) = {selectedRow.total_tokens} (total)
                  </span>
                </div>
              </div>

              {/* Raw JSON viewer */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-muted-foreground font-semibold">Raw Database Record (JSON)</span>
                  <button
                    onClick={() => handleCopy(JSON.stringify(selectedRow, null, 2), 'raw-json')}
                    className="text-primary hover:underline text-[11px] flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy JSON
                  </button>
                </div>
                <pre className="p-3 bg-slate-950 text-slate-200 rounded-lg border border-slate-800 text-[11px] overflow-x-auto max-h-48 font-mono">
                  {JSON.stringify(selectedRow, null, 2)}
                </pre>
              </div>

            </div>

            <div className="p-4 border-t border-border flex justify-end bg-card">
              <Button size="sm" onClick={() => setSelectedRow(null)}>
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Token Consumption Audit Modal */}
      <TokenConsumptionAuditModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
      />

    </div>
  );
};
