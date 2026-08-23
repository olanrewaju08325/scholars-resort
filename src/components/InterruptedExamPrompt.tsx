import React from 'react';
import { useInterruptedExamSession } from '@/hooks/useInterruptedExamSession';
import { Button } from '@/components/ui/button';
import { AlertCircle, Play, Trash2, Clock, CheckCircle2, BookOpen } from 'lucide-react';

export const InterruptedExamPrompt: React.FC = () => {
  const { interruptedSession, resumeSession, discardSession } = useInterruptedExamSession();

  if (!interruptedSession) return null;

  const answeredCount = Object.keys(interruptedSession.answers || {}).length;
  const totalCount = interruptedSession.questions?.length || 180;
  const minutesLeft = Math.floor(interruptedSession.timeLeft / 60);
  const secondsLeft = interruptedSession.timeLeft % 60;
  const timeFormatted = `${minutesLeft}m ${secondsLeft < 10 ? '0' : ''}${secondsLeft}s`;

  return (
    <div id="interrupted-exam-modal-overlay" className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-amber-400/40 dark:border-amber-500/30 animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-7 h-7 animate-bounce" />
          </div>
          <div>
            <h3 className="font-bold text-xl text-slate-900 dark:text-white">Unfinished CBT Exam Session</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              We detected an interrupted exam session that was prematurely closed or reloaded. Your progress and timer were preserved.
            </p>
          </div>
        </div>

        {/* Exam Snapshot Card */}
        <div className="my-5 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-primary" /> Exam Type
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-100">Official JAMB CBT Simulation</span>
          </div>

          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Answered Questions
            </span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {answeredCount} of {totalCount} completed
            </span>
          </div>

          <div className="flex items-center justify-between text-sm font-medium">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" /> Preserved Timer
            </span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {timeFormatted} remaining
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-3 mt-6">
          <Button
            id="discard-interrupted-exam-btn"
            variant="outline"
            onClick={discardSession}
            className="w-full sm:w-auto text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Discard Session
          </Button>

          <Button
            id="resume-interrupted-exam-btn"
            onClick={resumeSession}
            className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-600/20"
          >
            <Play className="w-4 h-4 mr-2 fill-white" />
            Resume Exam Now
          </Button>
        </div>

      </div>
    </div>
  );
};
