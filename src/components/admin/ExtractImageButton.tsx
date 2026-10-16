import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';

interface ExtractImageButtonProps {
  onExtract: (updateProgress: (status: string) => void) => Promise<void>;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const ExtractImageButton: React.FC<ExtractImageButtonProps> = ({
  onExtract,
  label = 'Extract Image Questions',
  disabled = false,
  className = ''
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>('');

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isProcessing || disabled) return;

    setIsProcessing(true);
    setProgressStatus('Starting extraction...');
    
    try {
      await onExtract((status) => setProgressStatus(status));
    } finally {
      setIsProcessing(false);
      setProgressStatus('');
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <Button
        type="button"
        onClick={handleClick}
        disabled={isProcessing || disabled}
        className={className}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            {label}
          </>
        )}
      </Button>
      {isProcessing && (
        <div className="text-[10px] text-muted-foreground font-mono truncate animate-pulse">
          {progressStatus}
        </div>
      )}
    </div>
  );
};
