import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, RefreshCw, Bookmark, Share2, Lightbulb, Check } from 'lucide-react';
import { useDailyMotivation } from '@/hooks/useDailyMotivation';
import { toast } from 'sonner';

export const DailyStudyTip = () => {
  const { motivation, loading, generateNewMotivation } = useDailyMotivation();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleCopy = () => {
    if (!motivation) return;
    navigator.clipboard.writeText(`💡 Daily UTME Strategy: "${motivation.quote}" — ${motivation.author}`);
    setCopied(true);
    toast.success('Tip copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBookmark = () => {
    setSaved(!saved);
    toast.success(saved ? 'Tip removed from bookmarks' : 'Tip saved to your study notes!');
  };

  if (loading && !motivation) {
    return (
      <Card className="bg-card text-card-foreground border-border shadow-md p-4 text-center text-xs text-muted-foreground">
        Loading fresh academic strategy...
      </Card>
    );
  }

  return (
    <Card className="bg-card text-card-foreground border-border shadow-md opacity-100 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10" />
      
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 text-amber-500 dark:text-amber-400 rounded-lg">
              <Lightbulb className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
              Daily High-Yield Study Tip
            </span>
            <span className="text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
              {motivation?.category || 'UTME Strategy'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleBookmark}
              title="Bookmark Tip"
            >
              <Bookmark className={`w-3.5 h-3.5 ${saved ? 'fill-amber-500 text-amber-500' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              title="Copy Tip"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={generateNewMotivation}
              disabled={loading}
              title="Generate / Load Next Tip"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-500' : ''}`} />
            </Button>
          </div>
        </div>

        <p className="text-sm font-medium text-foreground/90 leading-relaxed">
          "{motivation?.quote}"
        </p>

        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-amber-500/10">
          <span className="flex items-center gap-1 text-xs">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span className="font-semibold text-foreground/80">{motivation?.author}</span>
          </span>
          <span className="font-mono text-[10px] bg-muted/50 px-2 py-0.5 rounded border border-border/50">
            {motivation?.focus || 'All Subjects'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

