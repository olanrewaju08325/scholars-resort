import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Trash2, Loader2, X } from 'lucide-react';
import { Button } from './ui/button';

export interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  itemName?: string;
  isDeleting?: boolean;
  confirmText?: string;
  cancelText?: string;
}

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Deletion",
  description = "Are you sure you want to delete this item? This action will permanently remove it from the database.",
  itemName,
  isDeleting = false,
  confirmText = "Delete Item",
  cancelText = "Cancel"
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            onClick={() => !isDeleting && onClose()}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: '-48%' }}
            animate={{ opacity: 1, scale: 1, y: '-50%' }}
            exit={{ opacity: 0, scale: 0.95, y: '-48%' }}
            className="fixed left-[50%] top-[50%] z-50 grid w-[92%] max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-destructive/30 bg-card p-6 shadow-2xl rounded-2xl duration-200"
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground tracking-tight">
                  {title}
                </h3>
                {itemName && (
                  <p className="text-sm font-semibold text-destructive/90 bg-destructive/10 px-3 py-1 rounded-md max-w-full truncate my-1">
                    "{itemName}"
                  </p>
                )}
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-3 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isDeleting}
                className="w-full sm:w-auto h-9 text-xs font-semibold"
              >
                {cancelText}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onConfirm}
                disabled={isDeleting}
                className="w-full sm:w-auto h-9 text-xs font-bold gap-1.5 shadow-sm"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{confirmText}</span>
                  </>
                )}
              </Button>
            </div>

            <button
              onClick={() => !isDeleting && onClose()}
              disabled={isDeleting}
              className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
