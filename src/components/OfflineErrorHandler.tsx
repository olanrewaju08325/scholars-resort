import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, CloudUpload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getFailedNetworkLogsCount, clearFailedNetworkLogs, logFailedNetworkRequest } from '@/lib/offlineRequestLogger';
import { syncPendingOperations, getPendingOperationsCount } from '@/services/offlineSyncService';
import { processSyncQueue, getPendingQueueCount } from '@/lib/syncQueue';
import { toast } from 'sonner';

export const OfflineErrorHandler: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [failedLogsCount, setFailedLogsCount] = useState(0);
  const [pendingOpsCount, setPendingOpsCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const checkCounts = async () => {
    const logsCount = await getFailedNetworkLogsCount();
    const opsCount = await getPendingOperationsCount();
    const queueCount = await getPendingQueueCount();
    const totalPending = logsCount + opsCount + queueCount;

    setFailedLogsCount(logsCount);
    setPendingOpsCount(totalPending);

    if ((totalPending > 0 || !navigator.onLine) && !isDismissed) {
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  };

  useEffect(() => {
    checkCounts();
    const interval = setInterval(checkCounts, 5000);

    const handleOnline = () => {
      setIsOffline(false);
      setIsDismissed(false);
      toast.success('Network connection restored!', { id: 'network-restored' });
      checkCounts();
    };

    const handleOffline = () => {
      setIsOffline(true);
      setIsDismissed(false);
      logFailedNetworkRequest(window.location.href, 'GET', 'Client went offline');
      toast.warning('You are currently offline. CBT questions & answers are preserved in local storage.', { id: 'network-offline' });
      checkCounts();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isDismissed]);

  const handleRetrySync = async () => {
    if (!navigator.onLine) {
      toast.warning('Still offline. Please check your internet connection before retrying.');
      return;
    }

    setIsSyncing(true);
    toast.loading('Synchronizing offline queue to Supabase...', { id: 'retry-sync' });

    try {
      // 1. Flush pending admin offline operations
      await syncPendingOperations();

      // 2. Flush pending student session sync queue
      await processSyncQueue();

      // 3. Clear failed network logs
      await clearFailedNetworkLogs();

      await checkCounts();
      setShowBanner(false);
      toast.success('All pending offline operations successfully synchronized!', { id: 'retry-sync' });
    } catch (err: any) {
      toast.error('Sync completed with warnings: ' + (err?.message || 'Check logs'), { id: 'retry-sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!showBanner || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-4 left-4 md:left-6 z-[70] max-w-sm w-[calc(100vw-2rem)] sm:w-88 pointer-events-auto"
      >
        <div className={`p-3.5 rounded-2xl border shadow-xl backdrop-blur-md transition-all flex flex-col gap-2.5 ${
          isOffline 
            ? 'bg-amber-950/90 text-amber-100 border-amber-500/50' 
            : 'bg-card/95 text-card-foreground border-emerald-500/50'
        }`}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl font-bold shrink-0 ${
                isOffline ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-500'
              }`}>
                {isOffline ? <WifiOff className="w-4 h-4 animate-pulse" /> : <CloudUpload className="w-4 h-4" />}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-extrabold flex items-center gap-1.5">
                  {isOffline ? 'Offline Mode Active' : 'Network Restored - Queue Ready'}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    isOffline ? 'bg-amber-500/30 text-amber-300' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {pendingOpsCount}
                  </span>
                </h4>
                <p className="text-[11px] opacity-80 leading-tight">
                  {isOffline 
                    ? 'Changes cached locally in IndexedDB.' 
                    : `${pendingOpsCount} offline update(s) ready to sync.`}
                </p>
              </div>
            </div>

            <button 
              onClick={() => setIsDismissed(true)} 
              className="p-1 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Dismiss banner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
            <Button
              size="sm"
              onClick={handleRetrySync}
              disabled={isSyncing || isOffline}
              className={`h-7 text-xs font-bold gap-1.5 rounded-xl shadow-xs px-3 ${
                isOffline 
                  ? 'bg-amber-600/50 text-amber-200 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
