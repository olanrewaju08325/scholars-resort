import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Keyboard, Navigation, Award, BookOpen, Clock, CheckSquare, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GlobalShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalShortcutsModal: React.FC<GlobalShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  const navShortcuts = [
    { key: 'D', label: 'Dashboard', desc: 'Jump to student home dashboard' },
    { key: 'E', label: 'CBT Exam Center', desc: 'Start UTME mocks & past questions' },
    { key: 'P', label: 'Practice Drills', desc: 'Custom topic-by-topic setup' },
    { key: 'L', label: 'Digital Library', desc: 'Study notes, PDFs, revision materials' },
    { key: 'N', label: 'JAMB Novel Hub', desc: 'Official UTME Literature summaries' },
    { key: 'W', label: 'Targeted Weakness Drills', desc: 'Focus on low-accuracy topics' },
    { key: 'T', label: 'Tournaments', desc: 'Live scholar competitions' },
    { key: 'M', label: 'Weekly Mocks', desc: 'JAMB nationwide scheduled exams' },
  ];

  const examShortcuts = [
    { key: 'A / B / C / D', label: 'Select Option', desc: 'Choose corresponding answer' },
    { key: 'N / ➔', label: 'Next Question', desc: 'Advance to subsequent question' },
    { key: 'P / ⬅', label: 'Previous Question', desc: 'Return to previous question' },
    { key: 'F', label: 'Flag Question', desc: 'Bookmark for review later' },
    { key: 'C', label: 'Jamb Calculator', desc: 'Toggle standard CBT calculator' },
    { key: 'M', label: 'Audio Cues', desc: 'Mute / enable timer chimes' },
    { key: 'S', label: 'Submit Exam', desc: 'Open final confirmation dialog' },
    { key: '?', label: 'Help / Legend', desc: 'Toggle keyboard shortcuts guide' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border shadow-2xl p-6 rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
                Keyboard Shortcuts
                <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                  Power User
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Press any of the single keys below when not typing in an input field.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          {/* Navigation Section */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
              <Navigation className="w-3.5 h-3.5 text-primary" /> Global Navigation
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {navShortcuts.map(s => (
                <div
                  key={s.key}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/60 hover:bg-muted/70 transition-colors"
                >
                  <span className="text-xs text-foreground font-medium">{s.label}</span>
                  <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-background text-primary border border-border shadow-sm rounded-md">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>

          {/* Exam Environment Section */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-3">
              <Clock className="w-3.5 h-3.5 text-emerald-500" /> CBT Exam Controls
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {examShortcuts.map(s => (
                <div
                  key={s.key}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 border border-border/60 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="text-xs text-foreground font-medium">{s.label}</span>
                    <span className="text-[10px] text-muted-foreground">{s.desc}</span>
                  </div>
                  <kbd className="px-2.5 py-1 text-xs font-mono font-bold bg-background text-emerald-600 border border-emerald-500/30 shadow-sm rounded-md ml-2 shrink-0">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span>Press <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border text-[11px] font-mono">?</kbd> anytime to toggle this helper</span>
          <span>Press <kbd className="px-1.5 py-0.5 bg-muted rounded border border-border text-[11px] font-mono">ESC</kbd> to close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
