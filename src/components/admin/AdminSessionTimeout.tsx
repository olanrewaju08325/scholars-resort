import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldAlert, Clock, LogOut, RefreshCw, Lock, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface AdminSessionTimeoutProps {
  /** Timeout threshold in minutes (default: 15 mins) */
  timeoutMinutes?: number;
  /** Warning period before logout in seconds (default: 60 secs) */
  warningSeconds?: number;
}

export const AdminSessionTimeout: React.FC<AdminSessionTimeoutProps> = ({
  timeoutMinutes = 15,
  warningSeconds = 60
}) => {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(warningSeconds);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = warningSeconds * 1000;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Activity listener to reset idle clock
  const handleUserActivity = useCallback(() => {
    if (!isWarningOpen) {
      setLastActivityTime(Date.now());
    }
  }, [isWarningOpen]);

  // Handle Logout Execution
  const triggerTimeoutLogout = useCallback(async () => {
    try {
      toast.error('Session expired due to inactivity for administrative security.', {
        duration: 6000,
        icon: <Lock className="w-5 h-5 text-red-500" />
      });
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Failed to logout on session timeout:', err);
    }
  }, [signOut, navigate]);

  // Reset Session Idle Clock
  const extendSession = () => {
    setIsWarningOpen(false);
    setSecondsRemaining(warningSeconds);
    setLastActivityTime(Date.now());
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    toast.success('Admin session extended successfully.', { duration: 2500 });
  };

  // Activity listeners attachment
  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
    };
  }, [handleUserActivity]);

  // Main Idle Check Effect
  useEffect(() => {
    const checkInactivity = () => {
      const now = Date.now();
      const timeInactive = now - lastActivityTime;

      // 1. Time to show warning
      if (timeInactive >= (timeoutMs - warningMs) && !isWarningOpen) {
        setIsWarningOpen(true);
        const remaining = Math.max(0, Math.ceil((timeoutMs - timeInactive) / 1000));
        setSecondsRemaining(remaining);
      }

      // 2. Time expired
      if (timeInactive >= timeoutMs) {
        triggerTimeoutLogout();
      }
    };

    timerRef.current = setInterval(checkInactivity, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lastActivityTime, timeoutMs, warningMs, isWarningOpen, triggerTimeoutLogout]);

  // Warning Countdown Effect
  useEffect(() => {
    if (isWarningOpen) {
      countdownIntervalRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!);
            triggerTimeoutLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isWarningOpen, triggerTimeoutLogout]);

  return (
    <>
      {/* Session Protection Active Badge in Footer or Status */}
      <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-muted-foreground px-2 py-1 rounded-md bg-muted/40 border border-border">
        <Lock className="w-3 h-3 text-emerald-500" />
        <span>Auto-Lock: <strong>{timeoutMinutes}m</strong></span>
      </div>

      {/* Warning Modal Backdrop & Dialog */}
      {isWarningOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-card border-2 border-amber-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-card-foreground">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 shrink-0">
                <AlertTriangle className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                  Session Expiration Warning
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  For administrative security on shared devices, your session will automatically terminate due to inactivity.
                </p>
              </div>
            </div>

            {/* Countdown Display */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-center space-y-1">
              <span className="text-xs uppercase font-semibold text-amber-600 dark:text-amber-400 tracking-wider">
                Automatic Security Logout In
              </span>
              <div className="text-4xl font-extrabold font-mono text-amber-500 tracking-tight">
                {secondsRemaining}s
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={triggerTimeoutLogout}
                className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Log Out Now
              </Button>
              
              <Button
                onClick={extendSession}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs gap-1.5 shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Stay Logged In
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
