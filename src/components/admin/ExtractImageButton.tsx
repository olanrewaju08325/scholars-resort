import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExtractImageButtonProps {
  onExtract: (
    updateProgress: (status: string, currentChunk?: number, totalChunks?: number) => void
  ) => Promise<void>;
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
  const [currentChunk, setCurrentChunk] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const handleClick = async (e: React.MouseEvent) => {
    console.log('[Diagnostic Lifecycle] 1. ExtractImageButton click triggered', {
      target: e.target,
      currentTarget: e.currentTarget,
      defaultPreventedBefore: e.defaultPrevented
    });

    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent?.preventDefault?.();
    e.nativeEvent?.stopImmediatePropagation?.();

    console.log('[Diagnostic Lifecycle] 2. preventDefault enforced. defaultPreventedAfter:', e.defaultPrevented);

    if (isProcessing || disabled) {
      console.log('[Diagnostic Lifecycle] Extraction aborted: already processing or disabled.');
      return;
    }

    setIsProcessing(true);
    setProgressStatus('Initializing extraction...');
    setCurrentChunk(0);
    setTotalChunks(0);
    setProgressPercent(5);

    const updateProgress = (status: string, curr?: number, total?: number) => {
      console.log('[Diagnostic Lifecycle] 3. Chunking Progress Update:', { status, curr, total });
      setProgressStatus(status);
      if (typeof curr === 'number' && typeof total === 'number' && total > 0) {
        setCurrentChunk(curr);
        setTotalChunks(total);
        const calculated = Math.min(100, Math.max(5, Math.round((curr / total) * 100)));
        setProgressPercent(calculated);
      }
    };

    try {
      console.log('[Diagnostic Lifecycle] 4. Starting onExtract execution...');
      await onExtract(updateProgress);
      console.log('[Diagnostic Lifecycle] 5. onExtract execution completed successfully.');
      setProgressPercent(100);
      setProgressStatus('Extraction completed successfully.');
    } catch (err: any) {
      console.error('[Diagnostic Lifecycle] Extraction error encountered:', err);
      toast.error(err?.message || 'Extraction encountered an error. Please try again.');
      setProgressStatus('Extraction halted on error.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full max-w-md">
      <Button
        type="button"
        onClick={handleClick}
        disabled={isProcessing || disabled}
        className={className}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {totalChunks > 0 ? `Processing Chunk ${currentChunk} of ${totalChunks}...` : 'Processing...'}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            {label}
          </>
        )}
      </Button>

      {isProcessing && (
        <div className="space-y-1.5 p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs">
          <div className="flex items-center justify-between text-muted-foreground font-medium">
            <span className="truncate pr-2">{progressStatus}</span>
            {totalChunks > 0 && (
              <span className="shrink-0 font-mono font-bold text-primary">
                Chunk {currentChunk}/{totalChunks} ({progressPercent}%)
              </span>
            )}
          </div>
          <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
