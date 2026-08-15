import React, { useState, useCallback } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export const useConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [dialogState, setDialogState] = useState({
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    destructive: false,
    onConfirm: () => {},
  });

  const confirmAction = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; destructive?: boolean }
  ) => {
    setDialogState({
      title,
      message,
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      destructive: options?.destructive || false,
      onConfirm: () => {
        setIsOpen(false);
        onConfirm();
      }
    });
    setIsOpen(true);
  }, []);

  const ConfirmElement = (
    <ConfirmDialog 
      isOpen={isOpen}
      title={dialogState.title}
      message={dialogState.message}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
      destructive={dialogState.destructive}
      onConfirm={dialogState.onConfirm}
      onCancel={() => setIsOpen(false)}
    />
  );

  return { confirmAction, ConfirmElement };
};
