import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface ShortcutItem {
  key: string;
  description: string;
  category: 'Navigation' | 'CBT Exam' | 'General';
  action?: () => void;
}

export function useGlobalShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const isExamActive = location.pathname.startsWith('/exam');

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing into an input, textarea, contenteditable, or select element
    const activeEl = document.activeElement;
    const isInputActive =
      activeEl &&
      (activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        (activeEl as HTMLElement).isContentEditable);

    if (isInputActive) return;

    // Ignore with modifiers like Ctrl/Cmd/Alt unless Shift + ?
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;

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
  }, [navigate, isExamActive, showShortcutsHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    showShortcutsHelp,
    setShowShortcutsHelp
  };
}
