import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Play, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import type { ActiveSessionCheckResult } from '@/services/examSessionValidator';

interface ActiveExamConflictDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCheckResult: ActiveSessionCheckResult | null;
  onResume: () => void;
  onDiscardAndProceed: () => void;
  isProcessing?: boolean;
}

export const ActiveExamConflictDialog: React.FC<ActiveExamConflictDialogProps> = ({
  isOpen,
  onClose,
  sessionCheckResult,
  onResume,
  onDiscardAndProceed,
  isProcessing = false
}) => {
  if (!isOpen || !sessionCheckResult) return null;

  const { summary, source } = sessionCheckResult;
  const minutesLeft = Math.floor((summary.timeLeft || 0) / 60);
  const secondsLeft = (summary.timeLeft || 0) % 60;
  const timeFormatted = summary.timeLeft > 0 ? `${minutesLeft}m ${secondsLeft < 10 ? '0' : ''}${secondsLeft}s` : 'Active on server';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isProcessing) onClose(); }}>
      <DialogContent className="max-w-md bg-card border-border text-foreground shadow-2xl p-6">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold font-display text-foreground">
                Incomplete Exam Detected
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                You have an active or unfinished exam session.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="my-3 p-3.5 bg-muted/40 border border-border rounded-xl space-y-2 text-xs">
          <div className="flex justify-between items-center text-muted-foreground">
            <span>Session Status</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              In-Progress ({source === 'supabase' ? 'Cloud Sync' : 'Device Storage'})
            </span>
          </div>

          {summary.totalCount > 0 && (
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Progress
              </span>
              <span className="font-medium text-foreground">
                {summary.answeredCount} / {summary.totalCount} questions
              </span>
            </div>
          )}

          {summary.timeLeft > 0 && (
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Timer
              </span>
              <span className="font-mono font-bold text-foreground">
                {timeFormatted} remaining
              </span>
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Would you like to resume where you left off, or discard the previous test and start your new session?
        </p>

        <div className="flex flex-col-reverse sm:flex-row items-center gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isProcessing}
            onClick={onDiscardAndProceed}
            className="w-full sm:w-1/2 text-xs h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Discard & Start New
          </Button>

          <Button
            type="button"
            disabled={isProcessing}
            onClick={onResume}
            className="w-full sm:w-1/2 text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            <Play className="w-3.5 h-3.5 mr-1.5 fill-white" /> Resume Previous
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
