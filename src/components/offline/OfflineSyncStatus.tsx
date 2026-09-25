import React, { useState, useEffect, useCallback } from 'react';
import { 
  CloudUpload, CheckCircle2, Wifi, WifiOff, RefreshCw, 
  Clock, AlertTriangle, ChevronDown, ChevronUp, Database, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  getSyncQueueDetails, 
  forceSyncQueue, 
  subscribeToSyncQueue, 
  type SyncQueueDetails 
} from '@/lib/syncQueue';
import { toast } from 'sonner';

interface OfflineSyncStatusProps {
  variant?: 'card' | 'compact' | 'banner';
  className?: string;
  showDetailsToggle?: boolean;
}

export const OfflineSyncStatus: React.FC<OfflineSyncStatusProps> = ({
  variant = 'card',
  className = '',
  showDetailsToggle = true
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [details, setDetails] = useState<SyncQueueDetails>({
    totalPending: 0,
    isSyncing: false,
    lastSyncedTimestamp: null,
    items: [],
    breakdown: {}
  });
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await getSyncQueueDetails();
      setDetails(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    refreshStatus();
    const unsubscribe = subscribeToSyncQueue(refreshStatus);

    const handleOnline = () => {
      setIsOnline(true);
      refreshStatus();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('scholar_sync_queue_changed', refreshStatus);

    const interval = setInterval(refreshStatus, 8000);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('scholar_sync_queue_changed', refreshStatus);
      clearInterval(interval);
    };
  }, [refreshStatus]);

  const handleForceSync = async () => {
    if (!isOnline) {
      toast.warning('You are currently offline. Connect to Wi-Fi or mobile data to sync queued changes.');
      return;
    }

    if (details.totalPending === 0) {
      toast.info('All records are already fully synced with Cloud database.');
      return;
    }

    setIsManualSyncing(true);
    toast.info('Initiating Cloud synchronization...');

    try {
      const result = await forceSyncQueue();
      await refreshStatus();
      if (result.synced > 0) {
        toast.success(`Successfully synchronized ${result.synced} offline record(s) to Cloud!`);
      } else if (result.failed > 0) {
        toast.error(`Sync partially failed: ${result.failed} record(s) will retry.`);
      }
    } catch (e: any) {
      toast.error('Sync error: ' + (e?.message || 'Network timeout'));
    } finally {
      setIsManualSyncing(false);
    }
  };

  const isSyncInProgress = details.isSyncing || isManualSyncing;

  // 1. Compact Variant (for top headers, status bars, and toolbars)
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <div className="flex items-center gap-1.5">
          <span 
            className={`w-2 h-2 rounded-full ${
              !isOnline ? 'bg-amber-500 animate-pulse' : 
              details.totalPending > 0 ? 'bg-blue-500 animate-pulse' : 
              'bg-emerald-500'
            }`} 
            aria-hidden="true" 
          />
          <span className="font-medium text-foreground">
            {!isOnline ? 'Offline' : details.totalPending > 0 ? `${details.totalPending} pending sync` : 'Synced'}
          </span>
        </div>

        {details.totalPending > 0 && isOnline && (
          <button
            onClick={handleForceSync}
            disabled={isSyncInProgress}
            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline ml-1"
            title="Force immediate sync to cloud"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncInProgress ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        )}
      </div>
    );
  }

  // 2. Banner Variant (e.g. at the top of study pages or offline mode indicator)
  if (variant === 'banner') {
    if (details.totalPending === 0 && isOnline) return null;

    return (
      <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs ${
        !isOnline 
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200' 
          : 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
      } ${className}`}>
        <div className="flex items-center gap-2.5">
          {!isOnline ? (
            <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <CloudUpload className={`w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 ${isSyncInProgress ? 'animate-bounce' : ''}`} />
          )}
          <div>
            <span className="font-bold">
              {!isOnline 
                ? 'Offline Mode Active' 
                : `${details.totalPending} local change(s) queued for sync`}
            </span>
            <span className="text-muted-foreground block text-[11px] mt-0.5">
              {!isOnline 
                ? 'Your answers, streaks, and mock scores are safely stored on device memory.' 
                : 'Data will upload automatically or you can trigger a manual sync now.'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleForceSync}
            disabled={!isOnline || isSyncInProgress || details.totalPending === 0}
            className="font-bold gap-1.5 h-8 text-xs bg-primary text-primary-foreground"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncInProgress ? 'animate-spin' : ''}`} />
            <span>Force Sync</span>
          </Button>
        </div>
      </div>
    );
  }

  // 3. Card Variant (Full-featured panel for dashboards and offline management)
  return (
    <Card className={`border border-border bg-card shadow-sm ${className}`}>
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
              !isOnline ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
              details.totalPending > 0 ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
              'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            }`}>
              {!isOnline ? (
                <WifiOff className="w-4 h-4" />
              ) : details.totalPending > 0 ? (
                <CloudUpload className={`w-4 h-4 ${isSyncInProgress ? 'animate-bounce' : ''}`} />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Background Sync Queue</h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                  {isOnline ? 'Connected' : 'Device Offline'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {details.totalPending === 0 ? 'All changes synced' : `${details.totalPending} pending upload`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleForceSync}
              disabled={!isOnline || isSyncInProgress || details.totalPending === 0}
              className={`font-bold gap-1.5 text-xs h-8 ${
                details.totalPending > 0 && isOnline 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncInProgress ? 'animate-spin' : ''}`} />
              <span>{isSyncInProgress ? 'Syncing...' : 'Force Sync'}</span>
            </Button>
          </div>
        </div>

        {/* Sync Telemetry Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
          <div className="bg-muted/40 border border-border/60 p-2.5 rounded-lg space-y-0.5">
            <span className="text-muted-foreground text-[11px] block">Queue Status</span>
            <span className="font-bold text-foreground flex items-center gap-1.5">
              {isSyncInProgress ? (
                <>
                  <RefreshCw className="w-3 h-3 text-blue-500 animate-spin" /> In Progress
                </>
              ) : details.totalPending > 0 ? (
                <>
                  <Clock className="w-3 h-3 text-amber-500" /> Waiting to Sync
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Up to Date
                </>
              )}
            </span>
          </div>

          <div className="bg-muted/40 border border-border/60 p-2.5 rounded-lg space-y-0.5">
            <span className="text-muted-foreground text-[11px] block">Unsynced Records</span>
            <span className="font-bold text-foreground">
              {details.totalPending} Operations
            </span>
          </div>

          <div className="bg-muted/40 border border-border/60 p-2.5 rounded-lg space-y-0.5 col-span-2 sm:col-span-1">
            <span className="text-muted-foreground text-[11px] block">Last Sync Event</span>
            <span className="font-bold text-foreground">
              {details.lastSyncedTimestamp 
                ? new Date(details.lastSyncedTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
                : 'Active this session'}
            </span>
          </div>
        </div>

        {/* Breakdown of pending types */}
        {details.totalPending > 0 && Object.keys(details.breakdown).length > 0 && (
          <div className="pt-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
              Pending Record Types
            </span>
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(details.breakdown).map(([type, count]) => {
                const label = 
                  type === 'exam_result' ? 'Exam Results' :
                  type === 'session_answer' ? 'Answer Logs' :
                  type === 'study_progress' ? 'Progress Records' :
                  type === 'daily_goal' ? 'Goal Updates' :
                  type === 'profile_update' ? 'Profile Data' : type;

                return (
                  <div key={type} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/80 text-foreground">
                    <span className="font-medium">{label}:</span>
                    <span className="font-bold text-primary">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expandable Technical Log Drawer */}
        {showDetailsToggle && details.items.length > 0 && (
          <div className="border-t border-border/60 pt-2.5">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Inspect Pending Sync Items ({details.items.length})</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDetails && (
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {details.items.map((item, idx) => (
                  <div key={item.id || idx} className="p-2 rounded bg-muted/30 border border-border/50 text-[11px] flex items-center justify-between gap-2">
                    <div className="truncate">
                      <span className="font-bold text-foreground uppercase">{item.table}</span>
                      <span className="text-muted-foreground ml-1.5">({item.action})</span>
                      {item.lastError && (
                        <span className="text-red-500 block truncate text-[10px] mt-0.5">
                          Retry error: {item.lastError}
                        </span>
                      )}
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                      item.status === 'syncing' ? 'bg-blue-500/20 text-blue-500 animate-pulse' :
                      item.status === 'failed' ? 'bg-red-500/20 text-red-500' :
                      'bg-amber-500/20 text-amber-500'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
