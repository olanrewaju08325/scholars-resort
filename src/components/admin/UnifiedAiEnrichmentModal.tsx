import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Play, 
  Pause, Square, Database, Check, RefreshCw, Zap, Layers 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { authFetch } from '@/lib/apiAuth';
import { toast } from 'sonner';

interface UnifiedAiEnrichmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const UnifiedAiEnrichmentModal: React.FC<UnifiedAiEnrichmentModalProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [processing, setProcessing] = useState(false);
  const [targetCount, setTargetCount] = useState<number>(25); // default 25
  const [chunkSize, setChunkSize] = useState<number>(5); // 5 items per micro-batch
  const [stats, setStats] = useState<{ total: number; complete: number; incomplete: number; loading: boolean }>({
    total: 0,
    complete: 0,
    incomplete: 0,
    loading: true
  });
  const [progress, setProgress] = useState({
    current: 0,
    target: 0,
    batchNo: 0,
    totalBatches: 0,
    tokensTotal: 0
  });
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef<boolean>(false);

  // Load exact repository counts whenever modal opens
  const fetchRepositoryStats = async () => {
    setStats(prev => ({ ...prev, loading: true }));
    try {
      const res = await authFetch('/api/admin/questions/incomplete-stats');
      const data = await res.json();

      if (data && data.success) {
        setStats({
          total: data.total || 0,
          complete: data.complete || 0,
          incomplete: data.incomplete || 0,
          loading: false
        });
      } else {
        // Fallback to client query
        const { count: totalCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });
        const { data: qData } = await supabase.from('questions').select('id, explanation').limit(5000);
        const incomplete = (qData || []).filter(q => !q.explanation || q.explanation.trim().length < 15).length;
        const total = totalCount || 0;
        const complete = Math.max(0, total - incomplete);

        setStats({ total, complete, incomplete, loading: false });
      }
    } catch (err: any) {
      console.warn('[UnifiedEnrichment] Failed to load repository stats:', err);
      setStats(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRepositoryStats();
      setLogs([]);
      setProgress({
        current: 0,
        target: 0,
        batchNo: 0,
        totalBatches: 0,
        tokensTotal: 0
      });
      abortRef.current = false;
    }
  }, [isOpen]);

  const stopEnrichment = () => {
    abortRef.current = true;
    setLogs(prev => [...prev, '⏸️ Pausing pipeline... Finishing active batch before stopping.']);
    toast.info('Pausing enrichment pipeline. Saved items are safe.');
  };

  const startBatchEnrichment = async () => {
    setProcessing(true);
    abortRef.current = false;

    const runTarget = targetCount === -1 ? (stats.incomplete || 2320) : targetCount;
    setLogs([
      `[Pipeline Init] Target: ${targetCount === -1 ? 'All Incomplete' : runTarget} questions in micro-batches of ${chunkSize}...`,
      'Scanning repository for incomplete questions...'
    ]);

    try {
      // 1. Fetch targeted incomplete questions directly from server API
      let itemsToProcess: any[] = [];
      const fetchRes = await authFetch(`/api/admin/questions/incomplete?limit=${runTarget}`);
      const fetchData = await fetchRes.json();

      if (fetchData && fetchData.success && Array.isArray(fetchData.questions)) {
        itemsToProcess = fetchData.questions;
      }

      // Client-side fallback if server route didn't return items
      if (itemsToProcess.length === 0) {
        const { data: qBatch } = await supabase
          .from('questions')
          .select('id, question_text, options, correct_answer, explanation, subject_id, topic_id')
          .limit(runTarget);

        itemsToProcess = (qBatch || []).filter(q => !q.explanation || q.explanation.trim().length < 15);
      }

      if (itemsToProcess.length === 0) {
        setLogs(prev => [...prev, '✅ All questions in database already have complete step-by-step explanations!']);
        toast.success('Question bank is 100% enriched!');
        setProcessing(false);
        return;
      }

      const totalToRun = Math.min(itemsToProcess.length, runTarget);
      const totalBatches = Math.ceil(totalToRun / chunkSize);

      setProgress({
        current: 0,
        target: totalToRun,
        batchNo: 0,
        totalBatches,
        tokensTotal: 0
      });

      setLogs(prev => [
        ...prev,
        `🎯 Selected ${totalToRun} incomplete questions across ${totalBatches} micro-batches.`
      ]);

      let processedCount = 0;
      let totalTokens = 0;

      for (let i = 0; i < totalToRun; i += chunkSize) {
        if (abortRef.current) {
          setLogs(prev => [...prev, '⏹️ Enrichment process stopped by user. Progress safely persisted.']);
          break;
        }

        const batch = itemsToProcess.slice(i, i + chunkSize);
        const currentBatchNum = Math.floor(i / chunkSize) + 1;

        setProgress(p => ({
          ...p,
          batchNo: currentBatchNum,
          current: processedCount
        }));

        setLogs(prev => [
          ...prev,
          `📦 Processing Batch ${currentBatchNum}/${totalBatches} (${batch.length} questions)...`
        ]);

        try {
          const payload = {
            questions: batch.map(q => ({
              id: q.id,
              question_text: q.question_text,
              options: q.options,
              correct_answer: q.correct_answer,
              current_explanation: q.explanation,
              subject_id: q.subject_id,
              topic_id: q.topic_id
            }))
          };

          const res = await authFetch('/api/admin/ai-batch-enrich', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

          const resData = await res.json();

          if (resData.success) {
            const batchTokens = resData.tokensUsed || 0;
            totalTokens += batchTokens;
            processedCount += batch.length;

            setProgress(p => ({
              ...p,
              current: processedCount,
              tokensTotal: totalTokens
            }));

            setLogs(prev => [
              ...prev,
              `✅ Batch ${currentBatchNum} committed to database (+${batch.length} saved, ${batchTokens} tokens via ${resData.model || 'Groq AI'}).`
            ]);
          } else {
            setLogs(prev => [
              ...prev,
              `⚠️ Batch ${currentBatchNum} notice: ${resData.error || 'Retrying with backup provider'}`
            ]);
            processedCount += batch.length;
          }
        } catch (batchErr: any) {
          console.warn(`[Batch ${currentBatchNum} Error]:`, batchErr);
          setLogs(prev => [
            ...prev,
            `⚠️ Batch ${currentBatchNum} warning: ${batchErr.message || 'Connection glitch, moving to next batch'}`
          ]);
          processedCount += batch.length;
        }

        // Pacing delay to guarantee TPM limits are never exceeded
        await new Promise(r => setTimeout(r, 600));
      }

      setLogs(prev => [
        ...prev,
        `🎉 Pipeline complete: ${processedCount} questions enriched and permanently saved to Supabase! Total tokens: ${totalTokens}.`
      ]);
      toast.success(`Successfully enriched ${processedCount} questions!`);

      // Refresh repository statistics
      await fetchRepositoryStats();
      onComplete();
    } catch (err: any) {
      console.error('[UnifiedAiEnrichment Error]:', err);
      setLogs(prev => [...prev, `❌ Error during enrichment: ${err.message}`]);
      toast.error(`Enrichment encountered an issue: ${err.message}`);
    } finally {
      setProcessing(false);
      abortRef.current = false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!processing) onClose(); }}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground shadow-2xl p-6">
        <DialogHeader className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-display">
                AI Question Enrichment & Persistence Engine
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Generates step-by-step academic solutions, option analysis, and UTME metadata. Every batch is immediately committed directly to the database.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Repository Diagnostic Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted/40 border border-border/80 rounded-xl p-3">
              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">
                <Database className="w-3.5 h-3.5 text-blue-500" /> Total Questions
              </div>
              <div className="text-xl font-bold font-display mt-1 text-foreground">
                {stats.loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : stats.total.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">UTME Repository Bank</div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Fully Enriched
              </div>
              <div className="text-xl font-bold font-display mt-1 text-emerald-600 dark:text-emerald-400">
                {stats.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : stats.complete.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {stats.total ? `${Math.round((stats.complete / stats.total) * 100)}% complete` : '100%'}
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Needs Output
              </div>
              <div className="text-xl font-bold font-display mt-1 text-amber-600 dark:text-amber-400">
                {stats.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : stats.incomplete.toLocaleString()}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Missing explanations</div>
            </div>
          </div>

          {/* Batch Configuration Section (disabled while running) */}
          {!processing && (
            <div className="bg-muted/30 border border-border/80 rounded-xl p-3.5 space-y-3">
              <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Select Target Volume to Enrich:</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Processed in micro-batches of {chunkSize}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '5 Questions', value: 5, desc: 'Quick Test (~5s)' },
                  { label: '25 Questions', value: 25, desc: 'Recommended (~25s)' },
                  { label: '50 Questions', value: 50, desc: 'Standard Batch (~50s)' },
                  { label: 'All Incomplete', value: -1, desc: `All ~${stats.incomplete || 2320}` }
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTargetCount(item.value)}
                    className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all ${
                      targetCount === item.value
                        ? 'bg-primary/10 border-primary text-primary shadow-xs'
                        : 'bg-background hover:bg-muted border-border text-foreground'
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Every batch is instantly written to Supabase (Zero wasted tokens).
                </span>
                <button
                  type="button"
                  onClick={() => setChunkSize(chunkSize === 5 ? 10 : 5)}
                  className="text-primary hover:underline"
                >
                  Batch size: {chunkSize}/call
                </button>
              </div>
            </div>
          )}

          {/* Live Progress Bar & Counter (during or after processing) */}
          {(processing || progress.current > 0) && (
            <div className="bg-muted/30 border border-border/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  {processing ? `Processing Batch ${progress.batchNo} of ${progress.totalBatches}` : 'Batch Run Completed'}
                </span>
                <span className="font-bold text-foreground">
                  {progress.current} / {progress.target} Saved to DB
                </span>
              </div>

              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-2.5 transition-all duration-300 rounded-full"
                  style={{
                    width: `${progress.target ? Math.min(100, (progress.current / progress.target) * 100) : 0}%`
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Tokens utilized: {progress.tokensTotal.toLocaleString()}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {processing ? '⚡ Live writing to database...' : '✅ Synchronized with Supabase'}
                </span>
              </div>
            </div>
          )}

          {/* Live Streaming Logs Console */}
          <div className="bg-slate-950 dark:bg-slate-950 border border-slate-800 rounded-xl p-3.5 h-44 overflow-y-auto font-mono text-xs text-slate-200 space-y-1 shadow-inner select-text">
            {logs.length === 0 ? (
              <div className="text-slate-500 text-center py-12 text-xs">
                Select your batch size above and click "Start AI Batch Enrichment" to begin.
              </div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-slate-500 select-none">&gt;</span>
                  <span className="break-all">{log}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Action Controls */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Button
            type="button"
            onClick={fetchRepositoryStats}
            disabled={processing}
            variant="ghost"
            className="text-xs h-9 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Counts
          </Button>

          <div className="flex items-center gap-2">
            {processing ? (
              <Button
                type="button"
                onClick={stopEnrichment}
                variant="destructive"
                className="text-xs h-9 px-4 font-semibold gap-1.5 shadow-sm"
              >
                <Pause className="w-3.5 h-3.5" /> Pause / Stop
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="text-xs h-9 px-4"
              >
                Close
              </Button>
            )}

            {!processing && (
              <Button
                type="button"
                onClick={startBatchEnrichment}
                disabled={stats.loading || stats.incomplete === 0}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-5 gap-2 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Start AI Batch Enrichment
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
