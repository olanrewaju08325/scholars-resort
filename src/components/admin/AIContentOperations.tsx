import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Play, Layers, FileText, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { validateContentForEnrichment, processBatchEnrichment, type MissingFieldsSummary } from '@/services/batchEnrichmentService';
import { toast } from 'sonner';

export const AIContentOperations: React.FC = () => {
  const [step, setStep] = useState<'validate' | 'review' | 'processing' | 'complete'>('validate');
  const [summary, setSummary] = useState<MissingFieldsSummary | null>(null);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, batchNo: 0, statusMessage: 'Idle' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);

  const runValidation = async () => {
    setLoadingValidation(true);
    try {
      const data = await validateContentForEnrichment();
      setSummary(data);
      setSelectedIds(data.items.map(i => i.id));
      setStep('review');
      toast.success(`Data validation complete: Found ${data.totalIncomplete} items requiring enrichment.`);
    } catch (err: any) {
      toast.error(`Validation error: ${err.message}`);
    } finally {
      setLoadingValidation(false);
    }
  };

  useEffect(() => {
    runValidation();
  }, []);

  const handleToggleSelectAll = () => {
    if (!summary) return;
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      setSelectedIds(summary.items.map(i => i.id));
      setSelectAll(true);
    }
  };

  const handleToggleItem = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleExportCsv = () => {
    if (!summary || summary.items.length === 0) {
      toast.error('No validated content items to export.');
      return;
    }
    const headers = 'id,question_text,missing_explanation,missing_topic,missing_subject\n';
    const rows = summary.items.map(i => 
      `"${i.id}","${i.question_text.replace(/"/g, '""')}","${i.missing_explanation}","${i.missing_topic}","${i.missing_subject}"`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `validated_content_missing_fields_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Validated content list exported to CSV successfully!');
  };

  const startBatchExecution = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least one item to enrich.');
      return;
    }

    setStep('processing');
    setProcessing(true);

    const result = await processBatchEnrichment(selectedIds, prog => {
      setProgress(prog);
    });

    setProcessing(false);
    if (result.success) {
      setStep('complete');
      toast.success(`Successfully auto-enriched ${result.processedCount} questions in batches of 20!`);
    } else {
      toast.error(`Enrichment encountered issues: ${result.errors.join(', ')}`);
      setStep('review');
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-primary/10 rounded-lg text-primary">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-white">AI Content Operations Hub</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregates AI Enrich, Batch Enrich, and Auto-Enrich into an asynchronous 20-by-20 queue with pre-execution validation.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={runValidation}
          disabled={loadingValidation || processing}
          variant="outline"
          className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs h-9 gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loadingValidation ? 'animate-spin' : ''}`} /> Re-Scan Database
        </Button>
      </div>

      {/* Multi-Step Workflow Progress Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className={`p-3 rounded-lg border ${step === 'validate' || step === 'review' ? 'bg-primary/10 border-primary text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
            <div className="text-xs font-bold uppercase tracking-wider">Step 1</div>
            <div className="text-sm font-semibold mt-0.5">Data Validation & Summary</div>
          </div>
          <div className={`p-3 rounded-lg border ${step === 'processing' ? 'bg-primary/10 border-primary text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
            <div className="text-xs font-bold uppercase tracking-wider">Step 2</div>
            <div className="text-sm font-semibold mt-0.5">20-by-20 Async Queue Processing</div>
          </div>
          <div className={`p-3 rounded-lg border ${step === 'complete' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
            <div className="text-xs font-bold uppercase tracking-wider">Step 3</div>
            <div className="text-sm font-semibold mt-0.5">Enrichment Verified & Synced</div>
          </div>
        </div>
      </div>

      {/* Step Content */}
      {step === 'review' && summary && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Total Incomplete Items</div>
              <div className="text-2xl font-bold text-white mt-1">{summary.totalIncomplete}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Missing Explanations</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{summary.missingExplanations}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Missing Topics</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{summary.missingTopics}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="text-xs text-slate-400">Missing Subjects</div>
              <div className="text-2xl font-bold text-purple-400 mt-1">{summary.missingSubjects}</div>
            </div>
          </div>

          {/* Validation Summary Table & Scope Approval */}
          <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" /> Pre-Execution Validation Summary
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  Review missing required fields and approve the batch AI processing scope before queue execution.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleExportCsv}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs h-8 gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" /> Export CSV
                </Button>
                <Button
                  onClick={handleToggleSelectAll}
                  variant="outline"
                  size="sm"
                  className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs h-8"
                >
                  {selectAll ? <CheckSquare className="w-3.5 h-3.5 mr-1" /> : <Square className="w-3.5 h-3.5 mr-1" />}
                  {selectAll ? 'Deselect All' : 'Select All'}
                </Button>
                <Button
                  onClick={startBatchExecution}
                  disabled={selectedIds.length === 0}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8 px-4 gap-1.5"
                >
                  <Play className="w-3.5 h-3.5" /> Approve & Start Batch (20/batch)
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {summary.items.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-medium">All questions are fully enriched with explanations, topics, and subjects!</p>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-3 w-10 text-center">Select</th>
                        <th className="p-3">Question Text</th>
                        <th className="p-3 w-32 text-center">Missing Explanation</th>
                        <th className="p-3 w-28 text-center">Missing Topic</th>
                        <th className="p-3 w-28 text-center">Missing Subject</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {summary.items.map(item => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3 text-center">
                              <button onClick={() => handleToggleItem(item.id)} className="text-primary">
                                {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-600" />}
                              </button>
                            </td>
                            <td className="p-3 text-slate-200 font-medium truncate max-w-md">{item.question_text}</td>
                            <td className="p-3 text-center">
                              {item.missing_explanation ? <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">Missing</span> : <span className="text-slate-500">OK</span>}
                            </td>
                            <td className="p-3 text-center">
                              {item.missing_topic ? <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold">Missing</span> : <span className="text-slate-500">OK</span>}
                            </td>
                            <td className="p-3 text-center">
                              {item.missing_subject ? <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-semibold">Missing</span> : <span className="text-slate-500">OK</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </CardCard>
        </div>
      )}

      {step === 'processing' && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-sm p-8 text-center space-y-6">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-bold">Processing Asynchronous Enrichment Queue (20 items/batch)</h3>
            <p className="text-xs text-slate-400">{progress.statusMessage}</p>
          </div>
          <div className="max-w-md mx-auto w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
            <div
              className="bg-primary h-3 transition-all duration-300"
              style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
            ></div>
          </div>
          <div className="text-xs font-mono text-slate-400">
            Processed {progress.current} of {progress.total} items
          </div>
        </Card>
      )}

      {step === 'complete' && (
        <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-sm p-8 text-center space-y-5">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-xl font-bold">Batch AI Enrichment Completed Successfully!</h3>
            <p className="text-xs text-slate-400">All selected content fields have been automatically populated, reviewed, and synchronized with Supabase.</p>
          </div>
          <Button
            onClick={() => { setStep('validate'); runValidation(); }}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 px-6 gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Run Another Validation Scan
          </Button>
        </Card>
      )}
    </div>
  );
};
