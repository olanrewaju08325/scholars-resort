import React from 'react';
import { Loader2, Sparkles, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DataLoadingProps {
  message?: string;
  subtext?: string;
  variant?: 'card' | 'fullscreen' | 'inline' | 'table';
}

export const DataLoading: React.FC<DataLoadingProps> = ({
  message = 'Loading live data from Scholars Cloud...',
  subtext = 'Syncing your UTME prep performance and progress...',
  variant = 'card'
}) => {
  if (variant === 'fullscreen') {
    return (
      <div className="min-h-[70vh] w-full flex flex-col items-center justify-center p-6 bg-background">
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-lg">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
        <div className="flex items-center gap-2 text-primary font-medium text-xs uppercase tracking-widest mb-1">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Scholars CBT Engine
        </div>
        <h3 className="text-xl font-bold font-display text-foreground text-center mb-2">
          {message}
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-8">
          {subtext}
        </p>

        {/* Skeleton Card Preview */}
        <div className="w-full max-w-md space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl bg-card border border-border" />
          <Skeleton className="h-12 w-3/4 mx-auto rounded-xl bg-card border border-border" />
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-center gap-3 py-8 px-4 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="space-y-3 py-6">
        <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-xl animate-pulse">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <div className="space-y-1 flex-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  // Default 'card' variant
  return (
    <Card className="border border-border bg-card shadow-sm rounded-2xl overflow-hidden p-6 w-full">
      <CardContent className="flex flex-col items-center justify-center py-10 text-center space-y-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
          <div className="relative w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-md">
            <BookOpen className="w-6 h-6 animate-bounce text-primary" />
          </div>
        </div>

        <div className="space-y-1.5 max-w-md">
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wider">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching Live Records
          </div>
          <h4 className="text-base font-bold text-foreground font-display">{message}</h4>
          <p className="text-xs text-muted-foreground">{subtext}</p>
        </div>

        <div className="w-full max-w-sm space-y-2 pt-2">
          <Skeleton className="h-3 w-full rounded-full bg-muted/60" />
          <Skeleton className="h-3 w-2/3 mx-auto rounded-full bg-muted/60" />
        </div>
      </CardContent>
    </Card>
  );
};

export default DataLoading;
