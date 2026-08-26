import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface FocusLockOptions {
  enabled?: boolean;
  maxWarnings?: number;
  onCompromised?: () => void;
  onWarning?: (warningCount: number) => void;
}

export function useFocusLock({
  enabled = true,
  maxWarnings = 3,
  onCompromised,
  onWarning
}: FocusLockOptions = {}) {
  const [isLocked, setIsLocked] = useState<boolean>(enabled);
  const [warnings, setWarnings] = useState<number>(0);
  const [isCompromised, setIsCompromised] = useState<boolean>(false);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const warningsRef = useRef(0);

  // Sync state
  useEffect(() => {
    setIsLocked(enabled);
  }, [enabled]);

  // Handle Focus Lock Toggle event from keyboard shortcut (Ctrl+Shift+F)
  useEffect(() => {
    const handleToggle = () => {
      setIsLocked(prev => {
        const next = !prev;
        toast.info(next ? 'Focus Lock Enabled (Anti-Cheat Active)' : 'Focus Lock Disabled');
        return next;
      });
    };

    window.addEventListener('scholars:toggle-focus-lock', handleToggle);
    return () => window.removeEventListener('scholars:toggle-focus-lock', handleToggle);
  }, []);

  // Broadcast focus lock status to suppress AI Tutor & floaters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('scholars:focus-mode', { detail: { active: isLocked } }));
      window.dispatchEvent(new CustomEvent('scholars:ai-tutor-lock', { detail: { locked: isLocked } }));
    }
  }, [isLocked]);

  const handleTabSwitch = useCallback(() => {
    if (!isLocked || isCompromised) return;

    warningsRef.current += 1;
    const currentCount = warningsRef.current;
    setWarnings(currentCount);

    if (onWarning) onWarning(currentCount);

    if (currentCount >= maxWarnings) {
      setIsCompromised(true);
      toast.error('Session Compromised! Tab switching limit exceeded.', { duration: 6000 });
      if (onCompromised) onCompromised();
    } else {
      setShowWarningModal(true);
      toast.warning(`Anti-Cheat Warning (${currentCount}/${maxWarnings}): Do not leave the exam window!`, {
        duration: 5000
      });
    }
  }, [isLocked, isCompromised, maxWarnings, onCompromised, onWarning]);

  // Prevent right click, copy/paste, text selection, and window blur
  useEffect(() => {
    if (!isLocked) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast.warning('Right-click disabled in Focus Lock mode');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+U, Ctrl+A, F12, Ctrl+Shift+I/J
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (
        (isCmdOrCtrl && ['c', 'v', 'x', 'u', 'a', 'p', 's'].includes(key)) ||
        key === 'f12' ||
        (isCmdOrCtrl && e.shiftKey && ['i', 'j', 'c'].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        toast.warning('Copy, paste, and Developer Inspection are disabled during active exams');
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleTabSwitch();
      }
    };

    const handleWindowBlur = () => {
      handleTabSwitch();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    // Add user-select none class to body
    document.body.classList.add('select-none');

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.body.classList.remove('select-none');
    };
  }, [isLocked, handleTabSwitch]);

  const resetWarnings = () => {
    warningsRef.current = 0;
    setWarnings(0);
    setIsCompromised(false);
    setShowWarningModal(false);
  };

  return {
    isLocked,
    warnings,
    isCompromised,
    showWarningModal,
    setShowWarningModal,
    resetWarnings,
    setIsLocked
  };
}
