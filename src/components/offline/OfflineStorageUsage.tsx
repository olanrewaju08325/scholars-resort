import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Database, Trash2, HardDrive, RefreshCw, AlertTriangle, 
  CheckCircle2, ShieldCheck, PieChart, Layers, Info, Sparkles 
} from 'lucide-react';
import { 
  getOfflineStorageMetrics, 
  clearAllOfflinePacks, 
  clearCompletedOfflineSessions, 
  formatBytes, 
  type OfflineStorageMetrics 
} from '@/lib/offlineStore';
import { offlineDb } from '@/lib/offlineDb';
import { toast } from 'sonner';

interface OfflineStorageUsageProps {
  className?: string;
  onCacheCleared?: () => void;
  variant?: 'card' | 'compact';
}

export const OfflineStorageUsage: React.FC<OfflineStorageUsageProps> = ({
  className = '',
  onCacheCleared,
  variant = 'card'
}) => {
  const [metrics, setMetrics] = useState<OfflineStorageMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [clearTarget, setClearTarget] = useState<'packs' | 'history' | 'all'>('packs');

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await getOfflineStorageMetrics();
      setMetrics(data);
    } catch (err) {
      console.warn('[OfflineStorageUsage] Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 12000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleRequestPersistence = async () => {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        const isGranted = await navigator.storage.persist();
        if (isGranted) {
          toast.success('Persistent browser storage granted! Offline question packs will not be evicted by your browser.');
        } else {
          toast.info('Browser decided standard storage is sufficient for current usage.');
        }
        await fetchMetrics();
      } catch (err: any) {
        toast.error('Failed to request persistent storage: ' + err.message);
      }
    }
  };

  const executeClear = async () => {
    setIsClearing(true);
    try {
      const initialBytes = metrics?.totalEstimatedBytes || 0;

      if (clearTarget === 'packs' || clearTarget === 'all') {
        await clearAllOfflinePacks();
      }

      if (clearTarget === 'history' || clearTarget === 'all') {
        await clearCompletedOfflineSessions();
      }

      if (clearTarget === 'all') {
        try {
          await offlineDb.examSnapshots.clear();
          await offlineDb.customQuestions.clear();
        } catch (_) {}
      }

      await fetchMetrics();
      onCacheCleared?.();

      const reclaimed = formatBytes(initialBytes);
      toast.success(`Local cache cleared! Reclaimed ${reclaimed} of device storage.`);
      setShowConfirmModal(false);
    } catch (err: any) {
      toast.error('Failed to clear cache: ' + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  if (variant === 'compact') {
    return (
      <div className={`flex items-center justify-between p-3 rounded-xl border border-border bg-card text-xs ${className}`}>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <span className="font-bold text-foreground">IndexedDB Offline Storage:</span>
          <span className="text-muted-foreground font-mono">
            {metrics ? formatBytes(metrics.totalEstimatedBytes) : 'Calculating...'}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setClearTarget('packs');
            setShowConfirmModal(true);
          }}
          className="text-xs h-7 text-red-500 border-red-500/30 hover:bg-red-500/10 font-bold gap-1"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear Cache</span>
        </Button>
      </div>
    );
  }

  const totalUsedFormatted = metrics ? formatBytes(metrics.totalEstimatedBytes) : '0 B';
  const quotaFormatted = metrics ? formatBytes(metrics.quotaBytes) : '50 GB';
  const percentage = metrics ? Math.min(100, Math.max(0.2, metrics.percentageUsed)) : 0.5;

  return (
    <>
      <Card className={`border border-border bg-card shadow-sm ${className}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base font-bold font-display text-foreground flex items-center gap-2">
                  IndexedDB Storage Consumption
                  {metrics?.isPersistent && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1 border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" /> Persistent
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time visualization of browser IndexedDB storage utilized for offline UTME packs and exam logs.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={fetchMetrics}
                disabled={loading}
                className="h-8 text-xs font-bold gap-1 border-border"
                title="Refresh storage metrics"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setClearTarget('packs');
                  setShowConfirmModal(true);
                }}
                className="h-8 text-xs font-bold gap-1.5 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Local Cache</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Storage Meter Visual */}
          <div className="bg-muted/40 border border-border/70 p-4 rounded-xl space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-primary" /> Offline Data Used:
                <span className="font-mono text-primary text-sm font-extrabold ml-1">{totalUsedFormatted}</span>
              </span>
              <span className="text-muted-foreground font-mono">
                Browser Quota: {quotaFormatted}
              </span>
            </div>

            {/* Gauge bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700/80 h-3 rounded-full overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  percentage > 80 ? 'bg-red-500' :
                  percentage > 50 ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${Math.max(1, percentage)}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
              <span>{percentage < 0.1 ? '<0.1% Quota Used' : `${percentage.toFixed(1)}% Quota Used`}</span>
              {!metrics?.isPersistent && (
                <button
                  onClick={handleRequestPersistence}
                  className="text-primary hover:underline font-bold flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" /> Enable Permanent Storage
                </button>
              )}
            </div>
          </div>

          {/* Granular Category Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics?.categories.map((cat) => (
              <div key={cat.id} className="p-3 rounded-xl bg-card border border-border/80 flex flex-col justify-between space-y-1.5">
                <div className="flex items-start justify-between gap-1">
                  <span className="font-bold text-xs text-foreground truncate">{cat.name}</span>
                  <span className="text-xs font-mono font-extrabold text-primary shrink-0">
                    {formatBytes(cat.bytes)}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {cat.unitLabel}
                </div>
                <div className="text-[10px] text-muted-foreground/80 line-clamp-1">
                  {cat.description}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Modal for Clearing Cache */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Clear Local Storage Cache</h3>
                <p className="text-xs text-muted-foreground">Choose what offline data to remove from your device.</p>
              </div>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              <label 
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  clearTarget === 'packs' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40'
                }`}
                onClick={() => setClearTarget('packs')}
              >
                <div>
                  <span className="font-bold text-foreground block">Subject Question Packs Only</span>
                  <span className="text-muted-foreground text-[11px]">Deletes offline past question banks. Practice history will be preserved.</span>
                </div>
                <input 
                  type="radio" 
                  name="clear_target" 
                  checked={clearTarget === 'packs'} 
                  onChange={() => setClearTarget('packs')}
                  className="accent-primary"
                />
              </label>

              <label 
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  clearTarget === 'history' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40'
                }`}
                onClick={() => setClearTarget('history')}
              >
                <div>
                  <span className="font-bold text-foreground block">Offline Practice History Only</span>
                  <span className="text-muted-foreground text-[11px]">Clears completed offline session logs. Question packs remain intact.</span>
                </div>
                <input 
                  type="radio" 
                  name="clear_target" 
                  checked={clearTarget === 'history'} 
                  onChange={() => setClearTarget('history')}
                  className="accent-primary"
                />
              </label>

              <label 
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  clearTarget === 'all' ? 'border-red-500/60 bg-red-500/10' : 'border-border hover:bg-muted/40'
                }`}
                onClick={() => setClearTarget('all')}
              >
                <div>
                  <span className="font-bold text-red-600 dark:text-red-400 block">Purge All Offline Data</span>
                  <span className="text-muted-foreground text-[11px]">Full reset of question packs, snapshots, and local practice history.</span>
                </div>
                <input 
                  type="radio" 
                  name="clear_target" 
                  checked={clearTarget === 'all'} 
                  onChange={() => setClearTarget('all')}
                  className="accent-red-500"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmModal(false)}
                disabled={isClearing}
                className="text-xs font-bold"
              >
                Cancel
              </Button>
              <Button
                onClick={executeClear}
                disabled={isClearing}
                className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white gap-1.5"
              >
                {isClearing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isClearing ? 'Clearing Storage...' : 'Confirm & Clear'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
