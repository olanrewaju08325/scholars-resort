import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Filter, 
  Calendar, Key, Tag, Sparkles, Database, FileText, Users, Trophy, Layers, 
  ArrowRight, CheckCircle, ShieldCheck, Download, AlertCircle, Wrench
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  previewEnvironmentCleanup, 
  executeEnvironmentCleanup 
} from '@/services/environmentCleanupService';
import type { 
  CleanupFilterOptions, 
  CleanupPreviewResult, 
  CleanupExecutionResult 
} from '@/services/environmentCleanupService';
import { toast } from 'sonner';

export const EnvironmentCleanupTab: React.FC = () => {
  const [options, setOptions] = useState<CleanupFilterOptions>({
    purgePlaceholderQuestions: true,
    purgeGuestSessions: true,
    purgeUnsubmittedSessions: true,
    purgeTestTournaments: true,
    purgeLocalIndexedDB: true,
    dateFilterEnabled: false,
    createdBeforeDate: new Date().toISOString().slice(0, 10),
    customKeywords: [],
  });

  const [keywordInput, setKeywordInput] = useState<string>('');
  const [preview, setPreview] = useState<CleanupPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  
  // Confirmation Modal
  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [executing, setExecuting] = useState<boolean>(false);
  const [lastExecution, setLastExecution] = useState<CleanupExecutionResult | null>(null);

  const runPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await previewEnvironmentCleanup(options);
      setPreview(res);
      toast.info(res.summaryMessage);
    } catch (err) {
      toast.error('Failed to run environment cleanup preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    runPreview();
  }, [options]);

  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim();
    if (!trimmed) return;
    if (options.customKeywords?.includes(trimmed)) return;
    
    setOptions(prev => ({
      ...prev,
      customKeywords: [...(prev.customKeywords || []), trimmed],
    }));
    setKeywordInput('');
  };

  const handleRemoveKeyword = (kw: string) => {
    setOptions(prev => ({
      ...prev,
      customKeywords: (prev.customKeywords || []).filter(k => k !== kw),
    }));
  };

  const handleExecuteCleanup = async () => {
    if (confirmInput !== 'PURGE-MOCK-DATA') {
      toast.error('Invalid confirmation code. Please enter PURGE-MOCK-DATA exactly.');
      return;
    }

    setExecuting(true);
    try {
      const res = await executeEnvironmentCleanup(options, confirmInput);
      setLastExecution(res);
      if (res.success) {
        toast.success(res.message);
        setIsConfirmOpen(false);
        setConfirmInput('');
        await runPreview();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Cleanup failed: ${err.message || err}`);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border border-rose-500/30 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Trash2 className="w-64 h-64 text-rose-500" />
        </div>

        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-rose-500/40 text-rose-400 bg-rose-500/10">
              Admin Maintenance Suite
            </Badge>
            <span className="text-xs text-slate-400 font-mono">
              Authorized Action Only
            </span>
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-white flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-rose-500" />
            Environment Mock Data Cleanup
          </h1>
          <p className="text-slate-300 text-sm max-w-2xl">
            Target and purge leftover development mock records, test user sessions, dummy questions, and demo tournament data based on flags or date ranges to ensure only live production data persists.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10">
          <Button 
            variant="outline" 
            onClick={runPreview} 
            disabled={previewLoading || executing}
            className="border-white/20 text-white hover:bg-white/10 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${previewLoading ? 'animate-spin' : ''}`} />
            Refresh Dry Run
          </Button>

          <Button 
            onClick={() => setIsConfirmOpen(true)} 
            disabled={!preview || preview.totalTargetedRecords === 0 || executing}
            className="bg-rose-600 hover:bg-rose-700 text-white gap-2 shadow-lg shadow-rose-600/20"
          >
            <Trash2 className="w-4 h-4" />
            Execute Purge ({preview?.totalTargetedRecords || 0})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Cleanup Filter Settings */}
        <div className="space-y-6">
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                Cleanup Target Filters
              </CardTitle>
              <CardDescription>
                Select which types of development mock records should be purged.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Question Bank Flag */}
              <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/40 border border-border/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Placeholder Questions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Purge questions containing test keywords ('mock', 'sample', 'lorem ipsum', etc.).
                  </p>
                </div>
                <Checkbox 
                  checked={options.purgePlaceholderQuestions} 
                  onCheckedChange={(val) => setOptions(p => ({ ...p, purgePlaceholderQuestions: !!val }))} 
                />
              </div>

              {/* Guest Sessions Flag */}
              <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/40 border border-border/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-500" />
                    Guest Exam Sessions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Delete anonymous guest exam sessions without associated student user accounts.
                  </p>
                </div>
                <Checkbox 
                  checked={options.purgeGuestSessions} 
                  onCheckedChange={(val) => setOptions(p => ({ ...p, purgeGuestSessions: !!val }))} 
                />
              </div>

              {/* In-Progress Test Sessions Flag */}
              <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/40 border border-border/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-500" />
                    Abandoned In-Progress Sessions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Purge stale test exam sessions abandoned in 'in_progress' state.
                  </p>
                </div>
                <Checkbox 
                  checked={options.purgeUnsubmittedSessions} 
                  onCheckedChange={(val) => setOptions(p => ({ ...p, purgeUnsubmittedSessions: !!val }))} 
                />
              </div>

              {/* Test Tournaments Flag */}
              <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/40 border border-border/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-purple-500" />
                    Test Tournaments
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Purge tournaments created with 'test', 'mock', or 'demo' titles.
                  </p>
                </div>
                <Checkbox 
                  checked={options.purgeTestTournaments} 
                  onCheckedChange={(val) => setOptions(p => ({ ...p, purgeTestTournaments: !!val }))} 
                />
              </div>

              {/* Local IndexedDB Flag */}
              <div className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/40 border border-border/40">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Database className="w-4 h-4 text-rose-500" />
                    Local Browser Cache
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Clear offline pending session store in local IndexedDB browser cache.
                  </p>
                </div>
                <Checkbox 
                  checked={options.purgeLocalIndexedDB} 
                  onCheckedChange={(val) => setOptions(p => ({ ...p, purgeLocalIndexedDB: !!val }))} 
                />
              </div>
            </CardContent>
          </Card>

          {/* Date Filter & Keyword Customization Card */}
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Cut-Off Date & Flag Keywords
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date Cutoff Checkbox */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Restrict Cut-Off Date</Label>
                <Checkbox 
                  checked={options.dateFilterEnabled} 
                  onCheckedChange={(val) => setOptions(p => ({ ...p, dateFilterEnabled: !!val }))} 
                />
              </div>

              {options.dateFilterEnabled && (
                <div className="space-y-2 pt-2">
                  <Label className="text-xs text-muted-foreground">Purge records created BEFORE date:</Label>
                  <Input 
                    type="date" 
                    value={options.createdBeforeDate} 
                    onChange={(e) => setOptions(p => ({ ...p, createdBeforeDate: e.target.value }))}
                    className="bg-background"
                  />
                </div>
              )}

              {/* Custom Keywords Input */}
              <div className="space-y-2 pt-4 border-t border-border/50">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  Custom Mock Flags / Keywords
                </Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g. temp-user, staging" 
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                    className="bg-background text-xs"
                  />
                  <Button size="sm" onClick={handleAddKeyword} variant="secondary" className="shrink-0 text-xs">
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {options.customKeywords?.map((kw) => (
                    <Badge 
                      key={kw} 
                      variant="secondary" 
                      className="gap-1 text-xs cursor-pointer hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                      onClick={() => handleRemoveKeyword(kw)}
                    >
                      {kw} <span className="text-rose-500">×</span>
                    </Badge>
                  ))}
                  {(!options.customKeywords || options.customKeywords.length === 0) && (
                    <span className="text-xs text-muted-foreground italic">No custom keywords added.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Dry Run Preview & Execution Results */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 bg-card/60">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Dry Run Preview Summary
                  </CardTitle>
                  <CardDescription>
                    Live count of records matching your target filters prior to execution.
                  </CardDescription>
                </div>
                {preview && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-sm font-mono px-3 py-1">
                    {preview.totalTargetedRecords} Records Flagged
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {previewLoading ? (
                <div className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                  Scanning database for development mock records...
                </div>
              ) : preview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {preview.tablePreviews.map((tp, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-bold text-foreground">{tp.table}</span>
                          <Badge 
                            variant="outline" 
                            className={tp.matchedCount > 0 ? 'text-rose-500 border-rose-500/30 bg-rose-500/10' : 'text-emerald-500 border-emerald-500/30'}
                          >
                            {tp.matchedCount} records
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{tp.description}</p>
                      </div>
                    ))}
                  </div>

                  {preview.totalTargetedRecords === 0 ? (
                    <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                      <h4 className="font-bold text-emerald-600 dark:text-emerald-400">Environment Clean!</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        No development mock records found matching the active target filters. Only production data persists.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                        <div>
                          <h5 className="text-sm font-bold text-amber-600 dark:text-amber-400">
                            Ready to execute cleanup
                          </h5>
                          <p className="text-xs text-muted-foreground">
                            Executing purge will permanently remove {preview.totalTargetedRecords} flagged development records.
                          </p>
                        </div>
                      </div>
                      <Button 
                        onClick={() => setIsConfirmOpen(true)}
                        className="bg-rose-600 hover:bg-rose-700 text-white shrink-0 text-xs"
                      >
                        Execute Purge
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Last Execution Log */}
          {lastExecution && (
            <Card className="border-border/50 bg-card/60">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  Latest Purge Execution Log
                </CardTitle>
                <CardDescription>
                  Audit log of the most recent cleanup operation performed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  {lastExecution.message}
                </div>

                <div className="space-y-2">
                  {lastExecution.details.map((d, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 text-xs">
                      <span className="font-mono font-semibold text-foreground">{d.table}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{d.deletedCount} deleted</span>
                        {d.status === 'success' ? (
                          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-[10px]">
                            SUCCESS
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/20 text-rose-500 border-rose-500/30 text-[10px]">
                            FAILED
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Security Confirmation Modal */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-md border-rose-500/40 bg-card">
          <DialogHeader>
            <DialogTitle className="text-rose-500 flex items-center gap-2 text-xl">
              <ShieldAlert className="w-6 h-6" /> Confirm Environment Purge
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              This action will permanently delete <strong className="text-foreground font-mono">{preview?.totalTargetedRecords || 0}</strong> development mock records from Supabase tables.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 space-y-1">
              <p className="font-bold">Security Token Required:</p>
              <p>Type <code className="bg-background px-1.5 py-0.5 rounded text-rose-300 font-mono">PURGE-MOCK-DATA</code> below to confirm execution.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Confirmation Token</Label>
              <Input 
                placeholder="PURGE-MOCK-DATA" 
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="font-mono text-center tracking-wider"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)} disabled={executing}>
              Cancel
            </Button>
            <Button 
              onClick={handleExecuteCleanup} 
              disabled={confirmInput !== 'PURGE-MOCK-DATA' || executing}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2"
            >
              {executing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {executing ? 'Purging Records...' : 'Confirm Permanent Purge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
