import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, CheckCircle2, CloudUpload, AlertTriangle, ShieldCheck } from 'lucide-react';
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

  const checkCounts = async () => {
    const logsCount = await getFailedNetworkLogsCount();
    const opsCount = await getPendingOperationsCount();
    const queueCount = await getPendingQueueCount();
    const totalPending = logsCount + opsCount + queueCount;

    setFailedLogsCount(logsCount);
    setPendingOpsCount(totalPending);

    if (totalPending > 0 || !navigator.onLine) {
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
      toast.success('Network connection restored! Tap Retry Synchronization to flush pending queue.', { id: 'network-restored' });
      checkCounts();
    };

    const handleOffline = () => {
      setIsOffline(true);
      logFailedNetworkRequest(window.location.href, 'GET', 'Client went offline');
      toast.warning('You are currently offline. Changes will be saved locally to IndexedDB.', { id: 'network-offline' });
      checkCounts();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetrySync = async () => {
    if (!navigator.onLine) {
      toast.warning('Still offline. Please check your internet connection before retrying.');
      return;
    }

    setIsSyncing(true);
    toast.loading('Synchronizing offline IndexedDB queue to Supabase...', { id: 'retry-sync' });

    try {
      // 1. Flush pending admin offline operations
      await syncPendingOperations();

      // 2. Flush pending student session sync queue
      await processSyncQueue();

      // 3. Clear failed network logs
      await clearFailedNetworkLogs();

      await checkCounts();
      toast.success('All pending offline operations & network logs successfully synchronized!', { id: 'retry-sync' });
    } catch (err: any) {
      toast.error('Sync completed with warnings: ' + (err?.message || 'Check logs'), { id: 'retry-sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        className="fixed bottom-4 right-4 z-50 max-w-md w-[calc(100vw-2rem)]"
      >
        <div className={`p-4 rounded-2xl border shadow-2xl backdrop-blur-md transition-all flex flex-col gap-3 ${
          isOffline 
            ? 'bg-amber-950/90 text-amber-100 border-amber-500/50' 
            : 'bg-card/95 text-card-foreground border-emerald-500/50'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl font-bold shrink-0 ${
                isOffline ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-500'
              }`}>
                {isOffline ? <WifiOff className="w-5 h-5 animate-pulse" /> : <CloudUpload className="w-5 h-5" />}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-extrabold flex items-center gap-1.5">
                  {isOffline ? 'Offline Mode Active' : 'Network Restored - Queue Ready'}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    isOffline ? 'bg-amber-500/30 text-amber-300' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {pendingOpsCount} Pending
                  </span>
                </h4>
                <p className="text-[11px] opacity-80 leading-tight">
                  {isOffline 
                    ? 'Actions are automatically cached in IndexedDB until connection returns.' 
                    : `${pendingOpsCount} offline update(s) stored in IndexedDB awaiting sync.`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
            <Button
              size="sm"
              onClick={handleRetrySync}
              disabled={isSyncing || isOffline}
              className={`h-8 text-xs font-bold gap-1.5 rounded-xl shadow-xs ${
                isOffline 
                  ? 'bg-amber-600/50 text-amber-200 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Retry Synchronization'}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
