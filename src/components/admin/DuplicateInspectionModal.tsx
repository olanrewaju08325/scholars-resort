import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Trash2, CheckCircle, ShieldAlert, Sparkles, AlertCircle, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { type DuplicatePair } from '@/services/questionClassificationService';

interface DuplicateInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicatePairs: DuplicatePair[];
  onRefresh?: () => void;
}

export const DuplicateInspectionModal = ({
  isOpen,
  onClose,
  duplicatePairs,
  onRefresh
}: DuplicateInspectionModalProps) => {
  const [pairs, setPairs] = useState<DuplicatePair[]>(duplicatePairs);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const currentPair = pairs[currentIndex];

  const handlePruneQuestion = async (questionId: string, pairId: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.from('questions').delete().eq('id', questionId);
      if (error) throw error;

      toast.success(`Question ${questionId.substring(0, 8)} removed successfully.`);
      const remaining = pairs.filter(p => p.id !== pairId);
      setPairs(remaining);
      if (currentIndex >= remaining.length && remaining.length > 0) {
        setCurrentIndex(remaining.length - 1);
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(`Failed to prune question: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleKeepBoth = (pairId: string) => {
    const remaining = pairs.filter(p => p.id !== pairId);
    setPairs(remaining);
    toast.info('Skipped pair. Both questions retained.');
    if (currentIndex >= remaining.length && remaining.length > 0) {
      setCurrentIndex(remaining.length - 1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-card border-border text-card-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Copy className="w-5 h-5 text-amber-500" /> Duplicate Question Intelligence Inspector
          </DialogTitle>
          <DialogDescription>
            Side-by-side comparison of duplicate candidates. Inspect stems, options, and answers before taking action.
          </DialogDescription>
        </DialogHeader>

        {pairs.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mb-3" />
            <h3 className="text-lg font-bold">Zero Duplicates Remaining</h3>
            <p className="text-xs text-muted-foreground mt-1">All question stems in this set are unique and distinct!</p>
            <Button onClick={onClose} className="mt-4" size="sm">Close Inspector</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pair Navigator Bar */}
            <div className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-xl">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 font-mono">
                  Pair {currentIndex + 1} of {pairs.length}
                </span>
                <span className="text-muted-foreground">Similarity Score:</span>
                <span className="font-mono font-bold text-amber-500">{currentPair.similarityScore}%</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-muted uppercase font-bold text-muted-foreground">
                  {currentPair.matchType}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  disabled={currentIndex === 0} 
                  onClick={() => setCurrentIndex(prev => prev - 1)}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  disabled={currentIndex >= pairs.length - 1} 
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>

            {/* Side-by-Side Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Question A */}
              <div className="p-4 border border-border rounded-xl bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    Question A <span className="text-[10px] font-mono text-muted-foreground">({currentPair.questionA.id.substring(0, 8)})</span>
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground">{currentPair.questionA.subjectName}</span>
                </div>

                <p className="text-xs font-medium text-foreground bg-background p-3 rounded-lg border border-border min-h-[70px]">
                  {currentPair.questionA.text}
                </p>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground">Options:</span>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    {currentPair.questionA.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isCorrect = letter === currentPair.questionA.answer || opt === currentPair.questionA.answer;
                      return (
                        <div key={i} className={`p-1.5 rounded border text-[11px] ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 font-bold' : 'bg-background border-border text-muted-foreground'}`}>
                          {letter}) {opt}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    disabled={actionLoading}
                    onClick={() => handlePruneQuestion(currentPair.questionA.id, currentPair.id)}
                    className="w-full text-xs font-bold gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Question A
                  </Button>
                </div>
              </div>

              {/* Question B */}
              <div className="p-4 border border-border rounded-xl bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                    Question B <span className="text-[10px] font-mono text-muted-foreground">({currentPair.questionB.id.substring(0, 8)})</span>
                  </span>
                  <span className="text-[11px] font-semibold text-muted-foreground">{currentPair.questionB.subjectName}</span>
                </div>

                <p className="text-xs font-medium text-foreground bg-background p-3 rounded-lg border border-border min-h-[70px]">
                  {currentPair.questionB.text}
                </p>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-muted-foreground">Options:</span>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    {currentPair.questionB.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isCorrect = letter === currentPair.questionB.answer || opt === currentPair.questionB.answer;
                      return (
                        <div key={i} className={`p-1.5 rounded border text-[11px] ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 font-bold' : 'bg-background border-border text-muted-foreground'}`}>
                          {letter}) {opt}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    disabled={actionLoading}
                    onClick={() => handlePruneQuestion(currentPair.questionB.id, currentPair.id)}
                    className="w-full text-xs font-bold gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Question B
                  </Button>
                </div>
              </div>
            </div>

            {/* Global Inspector Action Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleKeepBoth(currentPair.id)}
                className="text-xs text-muted-foreground"
              >
                Keep Both Questions (Skip Pair)
              </Button>
              <Button size="sm" variant="outline" onClick={onClose} className="text-xs">
                Done Inspecting
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
