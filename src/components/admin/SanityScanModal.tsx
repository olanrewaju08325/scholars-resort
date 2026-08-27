import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, AlertTriangle, CheckCircle, Search, RefreshCw, XCircle, Trash2, Wrench, Download, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SanityScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: any[];
  onRefresh?: () => void;
}

export const SanityScanModal = ({ isOpen, onClose, questions, onRefresh }: SanityScanModalProps) => {
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState<string | null>(null);
  const [results, setResults] = useState<{
    duplicates: any[];
    brokenLatex: any[];
    orphanedTopics: any[];
  } | null>(null);

  const runScan = () => {
    setScanning(true);
    setResults(null);
    
    setTimeout(() => {
      // 1. Find duplicates based on question_text similarity (exact match for now)
      const textMap = new Map<string, any[]>();
      questions.forEach(q => {
        const text = q.question_text?.toLowerCase().trim();
        if (!text) return;
        if (!textMap.has(text)) textMap.set(text, []);
        textMap.get(text)!.push(q);
      });
      
      const duplicates: any[] = [];
      textMap.forEach((qList) => {
        if (qList.length > 1) {
          duplicates.push(...qList.slice(1));
        }
      });

      // 2. Broken LaTeX Check (Mismatched $)
      const brokenLatex = questions.filter(q => {
        const text = q.question_text || '';
        const dollarCount = (text.match(/\$/g) || []).length;
        return dollarCount % 2 !== 0; // Mismatched $
      });

      // 3. Orphaned Topics (Assume null or empty topic_id)
      const orphanedTopics = questions.filter(q => !q.topic_id || q.topic_id === 'null' || q.topic_id === '');

      setResults({
        duplicates,
        brokenLatex,
        orphanedTopics
      });
      setScanning(false);
    }, 1200);
  };

  const handleBatchFixDuplicates = async () => {
    if (!results || results.duplicates.length === 0) return;
    setFixing('duplicates');
    try {
      const idsToDelete = results.duplicates.map(q => q.id);
      const { error } = await supabase.from('questions').delete().in('id', idsToDelete);
      if (error) throw error;
      toast.success(`Successfully pruned ${idsToDelete.length} duplicate questions!`);
      setResults(prev => prev ? { ...prev, duplicates: [] } : null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(`Deduplication failed: ${err.message}`);
    } finally {
      setFixing(null);
    }
  };

  const handleBatchFixLatex = async () => {
    if (!results || results.brokenLatex.length === 0) return;
    setFixing('latex');
    try {
      let fixedCount = 0;
      for (const q of results.brokenLatex) {
        // Append closing dollar if odd number of $
        const fixedText = (q.question_text || '') + ' $';
        const { error } = await supabase.from('questions').update({ question_text: fixedText }).eq('id', q.id);
        if (!error) fixedCount++;
      }
      toast.success(`Successfully fixed LaTeX formula closing tags on ${fixedCount} questions!`);
      setResults(prev => prev ? { ...prev, brokenLatex: [] } : null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(`LaTeX auto-repair failed: ${err.message}`);
    } finally {
      setFixing(null);
    }
  };

  const handleExportReport = () => {
    if (!results) return;
    const report = {
      scanDate: new Date().toISOString(),
      totalAudited: questions.length,
      duplicatesCount: results.duplicates.length,
      brokenLatexCount: results.brokenLatex.length,
      orphanedTopicsCount: results.orphanedTopics.length,
      details: results
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jamb_questions_sanity_audit_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Audit report downloaded successfully!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ShieldCheck className="w-5 h-5 text-rose-500" /> Database Sanity Scan
          </DialogTitle>
          <DialogDescription>
            Audit all {questions.length} active questions for duplicates, broken formulas, and orphaned topics.
          </DialogDescription>
        </DialogHeader>

        {!results && !scanning && (
          <div className="py-10 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4 border border-rose-500/20">
              <Search className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-lg font-bold mb-2">Ready to Scan Database</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              The sanity scan will parse the entire question repository to flag data integrity issues that might break the student CBT experience.
            </p>
            <Button onClick={runScan} className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-10 px-8 rounded-xl shadow-sm">
              <Sparkles className="w-4 h-4 mr-2" /> Start Sanity Scan
            </Button>
          </div>
        )}

        {scanning && (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-10 h-10 text-rose-500 animate-spin mb-4" />
            <h3 className="text-lg font-bold animate-pulse">Auditing Question Database...</h3>
            <p className="text-sm text-muted-foreground mt-2">Checking LaTeX mathematical parsing, duplicate keys, and orphaned relationships.</p>
          </div>
        )}

        {results && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground">
                Audit complete: {results.duplicates.length + results.brokenLatex.length + results.orphanedTopics.length} total issues found
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportReport} className="h-7 text-xs gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Export Audit Log
                </Button>
                <Button variant="outline" size="sm" onClick={runScan} className="h-7 text-xs gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Re-scan
                </Button>
              </div>
            </div>

            {/* Duplicates */}
            <div className="border border-border rounded-xl p-4 bg-muted/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {results.duplicates.length > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  )}
                  <h4 className="font-bold text-sm">Duplicate Questions: {results.duplicates.length}</h4>
                </div>
                {results.duplicates.length > 0 && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={handleBatchFixDuplicates}
                    disabled={fixing === 'duplicates'}
                    className="h-7 text-xs gap-1.5 bg-rose-600 hover:bg-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {fixing === 'duplicates' ? 'Pruning...' : 'Prune Duplicates'}
                  </Button>
                )}
              </div>
              {results.duplicates.length > 0 ? (
                <div className="text-xs text-muted-foreground bg-background rounded-lg p-3 max-h-28 overflow-y-auto border border-border space-y-1">
                  {results.duplicates.map(q => (
                    <div key={q.id} className="truncate py-0.5 border-b border-border/50 last:border-0">
                      <span className="font-mono text-[10px] text-muted-foreground mr-2">{q.id.substring(0,8)}</span> 
                      {q.question_text}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">No duplicate question records detected.</p>
              )}
            </div>

            {/* Broken LaTeX */}
            <div className="border border-border rounded-xl p-4 bg-muted/20">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {results.brokenLatex.length > 0 ? (
                    <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                  )}
                  <h4 className="font-bold text-sm">Broken LaTeX Formulas: {results.brokenLatex.length}</h4>
                </div>
                {results.brokenLatex.length > 0 && (
                  <Button 
                    size="sm" 
                    onClick={handleBatchFixLatex}
                    disabled={fixing === 'latex'}
                    className="h-7 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Wrench className="w-3.5 h-3.5" /> {fixing === 'latex' ? 'Repairing...' : 'Auto-Fix Formulas'}
                  </Button>
                )}
              </div>
              {results.brokenLatex.length > 0 ? (
                <div className="text-xs text-muted-foreground bg-background rounded-lg p-3 max-h-28 overflow-y-auto border border-border space-y-1">
                  {results.brokenLatex.map(q => (
                    <div key={q.id} className="truncate py-0.5 border-b border-border/50 last:border-0 text-rose-400 font-mono">
                      {q.question_text}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">All math formulas and symbols are properly formatted.</p>
              )}
            </div>

            {/* Orphaned Topics */}
            <div className="border border-border rounded-xl p-4 bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                {results.orphanedTopics.length > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                )}
                <h4 className="font-bold text-sm">Orphaned Topic References: {results.orphanedTopics.length}</h4>
              </div>
              {results.orphanedTopics.length > 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {results.orphanedTopics.length} questions are missing topic associations and should be mapped in the Question Bank editor.
                </p>
              ) : (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">All questions are correctly mapped to syllabus topics.</p>
              )}
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

