import React from 'react';
import { useGlobalShortcuts } from '@/hooks/useGlobalShortcuts';
import { GlobalShortcutsModal } from './GlobalShortcutsModal';

export const GlobalShortcutsHandler: React.FC = () => {
  const { showShortcutsHelp, setShowShortcutsHelp } = useGlobalShortcuts();

  return (
    <GlobalShortcutsModal
      isOpen={showShortcutsHelp}
      onClose={() => setShowShortcutsHelp(false)}
    />
  );
};
