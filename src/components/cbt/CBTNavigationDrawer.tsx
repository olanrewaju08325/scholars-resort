import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Flag, 
  CheckCircle2, 
  CircleDot, 
  HelpCircle, 
  Send, 
  ArrowRight, 
  Layers, 
  Grid3X3,
  Bookmark,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CBTNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  questions: any[];
  currentIdx: number;
  onSelectQuestion: (idx: number) => void;
  answers: Record<string, string>;
  flagged?: Record<number, boolean>;
  subjects?: string[];
  activeSubject?: string;
  onSelectSubject?: (subject: string) => void;
  onSubmitExam?: () => void;
  isPracticeMode?: boolean;
  correctAnswersMap?: Record<string, boolean>; // for practice mode review/correctness
}

export const CBTNavigationDrawer: React.FC<CBTNavigationDrawerProps> = ({
  isOpen,
  onClose,
  questions,
  currentIdx,
  onSelectQuestion,
  answers,
  flagged = {},
  subjects = [],
  activeSubject,
  onSelectSubject,
  onSubmitExam,
  isPracticeMode = false,
  correctAnswersMap = {}
}) => {
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('ALL');

  // Sync subject filter with active subject if provided
  useEffect(() => {
    if (activeSubject && subjects.includes(activeSubject)) {
      setSelectedSubjectFilter(activeSubject);
    }
  }, [activeSubject, subjects]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  // Derived statistics
  const totalQuestions = questions.length;
  const answeredCount = useMemo(() => {
    return questions.filter(q => !!answers[q.id]).length;
  }, [questions, answers]);

  const flaggedCount = useMemo(() => {
    return Object.values(flagged).filter(Boolean).length;
  }, [flagged]);

  const unansweredCount = Math.max(0, totalQuestions - answeredCount);
  const completionPercentage = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  // Filtered questions based on subject filter
  const displayedQuestionIndices = useMemo(() => {
    return questions.map((q, idx) => ({ q, idx })).filter(({ q }) => {
      if (selectedSubjectFilter === 'ALL') return true;
      return q.subject_name === selectedSubjectFilter;
    });
  }, [questions, selectedSubjectFilter]);

  // Find first unanswered question index
  const handleJumpToFirstUnanswered = () => {
    const firstUnansweredIdx = questions.findIndex(q => !answers[q.id]);
    if (firstUnansweredIdx >= 0) {
      onSelectQuestion(firstUnansweredIdx);
      onClose();
    }
  };

  // Find first flagged question index
  const handleJumpToFirstFlagged = () => {
    const firstFlaggedIdx = questions.findIndex((_, idx) => !!flagged[idx]);
    if (firstFlaggedIdx >= 0) {
      onSelectQuestion(firstFlaggedIdx);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            className="relative w-full max-w-3xl max-h-[88vh] md:max-h-[85vh] bg-card text-card-foreground rounded-t-3xl md:rounded-2xl shadow-2xl border border-border flex flex-col z-10 overflow-hidden"
          >
            {/* Mobile Drag Indicator */}
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mt-2.5 mb-1 md:hidden" />

            {/* Header */}
            <div className="p-4 md:p-5 border-b border-border bg-card flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Grid3X3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 id="drawer-title" className="font-bold text-base md:text-lg text-foreground flex items-center gap-2">
                    Question Navigator
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                      {answeredCount}/{totalQuestions}
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Tap any question number to jump immediately
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full text-muted-foreground hover:text-foreground h-9 w-9"
                aria-label="Close question navigator"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Progress & Stat Badges */}
            <div className="px-4 md:px-6 py-3 bg-muted/30 border-b border-border space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Progress Completion</span>
                <span className="text-primary font-bold">{completionPercentage}% Completed</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-primary rounded-full transition-all duration-300"
                  style={{ width: `${completionPercentage}%` }}
                />
              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Answered: {answeredCount}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold border border-red-500/20">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Flagged: {flaggedCount}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted text-muted-foreground text-xs font-semibold border border-border">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                  <span>Unanswered: {unansweredCount}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions & Subject Tabs */}
            <div className="px-4 md:px-6 py-2.5 border-b border-border bg-card flex flex-col gap-2">
              {/* Quick Jump Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {unansweredCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleJumpToFirstUnanswered}
                    className="h-8 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
                  >
                    Jump to First Unanswered
                  </Button>
                )}
                {flaggedCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleJumpToFirstFlagged}
                    className="h-8 text-xs font-medium border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 gap-1"
                  >
                    <Flag className="w-3.5 h-3.5 fill-red-500" />
                    Review Flagged ({flaggedCount})
                  </Button>
                )}
              </div>

              {/* Subject Tabs Filter (if multiple subjects exist) */}
              {subjects.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 hide-scrollbar">
                  <button
                    onClick={() => setSelectedSubjectFilter('ALL')}
                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      selectedSubjectFilter === 'ALL'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All Subjects ({totalQuestions})
                  </button>
                  {subjects.map((subj, idx) => {
                    const subjQuestions = questions.filter(q => q.subject_name === subj);
                    const subjAnswered = subjQuestions.filter(q => !!answers[q.id]).length;
                    const isSelected = selectedSubjectFilter === subj;

                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedSubjectFilter(subj);
                          if (onSelectSubject) onSelectSubject(subj);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'bg-muted/70 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <span>{subj}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                          {subjAnswered}/{subjQuestions.length}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Question Grid Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2.5">
                {displayedQuestionIndices.map(({ q, idx }) => {
                  const isAnswered = !!answers[q.id];
                  const isFlagged = !!flagged[idx];
                  const isCurrent = currentIdx === idx;

                  // Styling logic
                  let cellClass = "bg-muted/30 border-border text-muted-foreground hover:border-primary/50 hover:bg-muted/60";
                  
                  if (isCurrent) {
                    cellClass = "bg-primary text-primary-foreground font-extrabold border-primary ring-2 ring-primary/40 scale-105 shadow-md";
                  } else if (isPracticeMode && isAnswered && correctAnswersMap[q.id] !== undefined) {
                    // In practice mode review
                    if (correctAnswersMap[q.id]) {
                      cellClass = "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300 font-bold";
                    } else {
                      cellClass = "bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-300 font-bold";
                    }
                  } else if (isFlagged) {
                    cellClass = "bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400 font-bold";
                  } else if (isAnswered) {
                    cellClass = "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-semibold";
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        onSelectQuestion(idx);
                        onClose();
                      }}
                      className={`relative aspect-square rounded-xl border text-xs md:text-sm font-semibold flex flex-col items-center justify-center transition-all active:scale-95 ${cellClass}`}
                      title={`Question ${idx + 1}${isAnswered ? ' (Answered)' : ''}${isFlagged ? ' (Flagged)' : ''}`}
                    >
                      <span>{idx + 1}</span>

                      {/* Small Indicators */}
                      {isFlagged && !isCurrent && (
                        <div className="absolute top-1 right-1">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                        </div>
                      )}
                      {isAnswered && !isCurrent && !isFlagged && (
                        <div className="absolute bottom-1 right-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="p-3 md:p-4 border-t border-border bg-card flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-10 px-4 text-xs font-semibold"
              >
                Close Navigator
              </Button>

              {onSubmitExam && (
                <Button
                  onClick={() => {
                    onClose();
                    onSubmitExam();
                  }}
                  variant="destructive"
                  className="h-10 px-5 text-xs font-bold gap-1.5 shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  Submit Exam
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
