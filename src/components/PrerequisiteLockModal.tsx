import React from 'react';
import { Lock, Award, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PrerequisiteLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTopicName: string;
  prerequisiteTopicName: string;
  prerequisiteNumber?: number;
  onStartPrerequisiteDrill?: () => void;
}

export const PrerequisiteLockModal: React.FC<PrerequisiteLockModalProps> = ({
  isOpen,
  onClose,
  targetTopicName,
  prerequisiteTopicName,
  prerequisiteNumber = 1,
  onStartPrerequisiteDrill
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md border-amber-500/30 bg-card shadow-2xl">
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3">
            <Lock className="w-6 h-6" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            Topic Locked 🔒
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1 leading-relaxed">
            You must master the prerequisite topic before unlocking <strong className="text-foreground">{targetTopicName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
          <div className="flex items-start gap-3">
            <Award className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Required Prerequisite (70%+ Mastery)
              </p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                Topic {prerequisiteNumber}: {prerequisiteTopicName}
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-500/15 flex items-center justify-between text-xs text-muted-foreground">
            <span>Pass Score Needed:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">70% or higher</span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Got It
          </Button>
          {onStartPrerequisiteDrill && (
            <Button
              onClick={() => {
                onClose();
                onStartPrerequisiteDrill();
              }}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1.5"
            >
              Practice Prerequisite
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
