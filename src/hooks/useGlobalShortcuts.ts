import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

export interface ShortcutItem {
  key: string;
  description: string;
  category: 'Navigation' | 'CBT Exam' | 'General' | 'Quick Actions';
  action?: () => void;
}

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const isExamActive = location.pathname.startsWith('/exam');

  // Focus Trap Handler for active Modals & Dialogs
  const handleModalFocusTrap = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    // Find any visible open modal/dialog container
    const activeModal = document.querySelector('[role="dialog"], [data-state="open"], .modal-open, .focus-trap-active');
    if (!activeModal) return;

    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([-tabindex="-1"])';
    const focusables = Array.from(activeModal.querySelectorAll<HTMLElement>(focusableSelector))
      .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);

    if (focusables.length === 0) return;

    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];

    if (e.shiftKey) {
      // Shift + Tab: if on first element, cycle to last
      if (document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      }
    } else {
      // Tab: if on last element, cycle to first
      if (document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check focus trap first
    handleModalFocusTrap(e);

    // Ignore if user is typing into an input, textarea, contenteditable, or select element
    const activeEl = document.activeElement;
    const isInputActive =
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        (activeEl as HTMLElement).isContentEditable);

    if (isInputActive) return;

    const isAuthRoute = ['/login', '/signup', '/forgot-password', '/reset-password', '/onboarding'].some(p => location.pathname.startsWith(p));
    if (isAuthRoute) return;

    const key = e.key || '';
    if (!key) return;

    // Quick Practice shortcut: Alt+P or Ctrl+Shift+P
    if ((e.altKey && key.toLowerCase() === 'p') || (e.ctrlKey && e.shiftKey && key.toLowerCase() === 'p')) {
      e.preventDefault();
      toast.info('Starting Quick Practice...');
      navigate('/practice');
      return;
    }

    // Review Mistakes shortcut: Alt+R or Ctrl+Shift+R
    if ((e.altKey && key.toLowerCase() === 'r') || (e.ctrlKey && e.shiftKey && key.toLowerCase() === 'r')) {
      e.preventDefault();
      toast.info('Opening Weakness & Mistakes Review...');
      navigate('/weakness');
      return;
    }

    // Focus Lock toggle shortcut: Ctrl+Shift+F
    if (e.ctrlKey && e.shiftKey && key.toLowerCase() === 'f') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('scholars:toggle-focus-lock'));
      return;
    }

    // Ignore single key shortcuts if modifier keys like Ctrl/Cmd/Alt are held
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Open Shortcut Help with '?' or 'Shift+/'
    if (key === '?' || (e.shiftKey && key === '/')) {
      e.preventDefault();
      setShowShortcutsHelp(prev => !prev);
      return;
    }

    if (key === 'Escape' && showShortcutsHelp) {
      e.preventDefault();
      setShowShortcutsHelp(false);
      return;
    }

    // If on exam page, defer single-key navigation to exam's custom handler
    if (isExamActive) return;

    // Global navigation shortcuts
    switch (key.toLowerCase()) {
      case 'd':
        e.preventDefault();
        navigate('/dashboard');
        break;
      case 'e':
        e.preventDefault();
        navigate('/cbt');
        break;
      case 'p':
        e.preventDefault();
        navigate('/practice');
        break;
      case 'l':
        e.preventDefault();
        navigate('/library');
        break;
      case 'n':
        e.preventDefault();
        navigate('/novel-hub');
        break;
      case 'w':
        e.preventDefault();
        navigate('/weakness');
        break;
      case 't':
        e.preventDefault();
        navigate('/tournaments');
        break;
      case 'm':
        e.preventDefault();
        navigate('/mocks');
        break;
      default:
        break;
    }
  }, [navigate, isExamActive, showShortcutsHelp, handleModalFocusTrap]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    showShortcutsHelp,
    setShowShortcutsHelp,
    shortcutsCatalog: [
      { key: 'Alt + P', description: 'Start Quick Practice Session', category: 'Quick Actions' },
      { key: 'Alt + R', description: 'Review Weaknesses & Mistakes', category: 'Quick Actions' },
      { key: 'Ctrl + Shift + F', description: 'Toggle Focus Lock (Anti-Cheat)', category: 'CBT Exam' },
      { key: 'Shift + ?', description: 'Show Keyboard Shortcuts Guide', category: 'General' },
      { key: 'Tab / Shift + Tab', description: 'Focus-Trap Navigation inside Modals', category: 'General' },
      { key: 'D', description: 'Go to Dashboard', category: 'Navigation' },
      { key: 'E', description: 'Go to CBT Center', category: 'Navigation' },
      { key: 'P', description: 'Go to Practice Setup', category: 'Navigation' },
      { key: 'W', description: 'Go to Weakness Drills', category: 'Navigation' }
    ] as ShortcutItem[]
  };
}
