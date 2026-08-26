import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, AlertTriangle, Lock, EyeOff, Play } from 'lucide-react';

interface FocusLockOverlayProps {
  isOpen: boolean;
  warnings: number;
  maxWarnings?: number;
  onResume: () => void;
  isCompromised?: boolean;
}

export const FocusLockOverlay: React.FC<FocusLockOverlayProps> = ({
  isOpen,
  warnings,
  maxWarnings = 3,
  onResume,
  isCompromised = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
      <Card className="w-full max-w-md bg-card border-border shadow-2xl text-card-foreground">
        <CardHeader className="text-center pb-2">
          <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-2 text-amber-500">
            {isCompromised ? <ShieldAlert className="w-8 h-8 text-destructive animate-bounce" /> : <Lock className="w-7 h-7" />}
          </div>
          <CardTitle className="text-lg font-bold">
            {isCompromised ? 'Anti-Cheat Violation Detected' : 'Exam Session Auto-Paused'}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Focus Lock detected that you left or switched away from the active exam window.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-2 text-center">
          <div className="p-3.5 rounded-xl bg-muted/60 border border-border/80 space-y-1">
            <div className="text-xs text-muted-foreground font-medium">Window Violation Count</div>
            <div className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {warnings} / {maxWarnings}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isCompromised ? (
                <span className="text-destructive font-semibold">Exceeded maximum allowed window focus breaks.</span>
              ) : (
                <span>Switching tabs {maxWarnings - warnings} more time(s) will automatically submit your exam.</span>
              )}
            </div>
          </div>

          <div className="text-left space-y-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/40">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <EyeOff className="w-3.5 h-3.5 text-amber-500" /> Focus Lock Anti-Cheat Rules:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li>Do not open new browser tabs or secondary applications.</li>
              <li>Right-clicking, copying, and pasting are strictly disabled.</li>
              <li>AI Tutor features are suspended during active exam lock.</li>
            </ul>
          </div>

          <Button
            onClick={onResume}
            className="w-full gap-2 font-bold"
            variant={isCompromised ? 'destructive' : 'default'}
          >
            <Play className="w-4 h-4 fill-current" />
            {isCompromised ? 'Submit Exam & Exit' : 'I Understand — Resume Exam'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
