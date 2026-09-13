import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { AIEnrichmentDiagnostic } from './AIEnrichmentDiagnostic';
import { Activity } from 'lucide-react';

interface AIEnrichmentDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AIEnrichmentDiagnosticModal: React.FC<AIEnrichmentDiagnosticModalProps> = ({
  isOpen,
  onClose
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto p-6 bg-card border-border">
        <DialogHeader className="pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold font-display">
            <Activity className="w-5 h-5 text-primary" />
            AI Enrichment Diagnostic & Token Proof
          </DialogTitle>
          <DialogDescription className="text-xs">
            Live inspection of raw <code className="text-primary font-mono">ai_usage</code> database telemetry verifying whether token deductions represent actual successful completions.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <AIEnrichmentDiagnostic />
        </div>
      </DialogContent>
    </Dialog>
  );
};
