import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, HardDrive, RefreshCw, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useLocation } from 'react-router-dom';
import { processSyncQueue, getPendingQueueCount } from '@/lib/syncQueue';
import { toast } from 'sonner';

export const YouTubeOfflineVault: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkQueue = async () => {
      try {
        const count = await getPendingQueueCount();
        setPendingCount(count);
      } catch {}
    };

    const handleOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      checkQueue();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    checkQueue();

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleSyncAndRefresh = async () => {
    setIsSyncing(true);
    try {
      const result = await processSyncQueue();
      toast.success(`Synced ${result.synced} offline items back to cloud! Refreshing data...`);
      setWasOffline(false);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (e: any) {
      toast.error(`Sync error: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const isAlreadyOnDownloads = location.pathname.startsWith('/offline-packs');

  // Case 1: Currently Offline (YouTube Style Offline Vault Notification)
  if (isOffline) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-slideUp">
        <div className="bg-slate-900/95 border border-amber-500/40 text-slate-100 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <WifiOff className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Offline Security Mode
              </div>
              <p className="text-xs text-slate-300 font-medium truncate">
                No internet connection detected
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Just like YouTube, your downloaded past questions, offline mock station, and saved notes remain 100% accessible with full security.
          </p>

          {!isAlreadyOnDownloads && (
            <Button
              type="button"
              size="sm"
              onClick={() => navigate('/offline-packs')}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs h-9 rounded-xl shadow-md gap-1.5 w-full"
            >
              <HardDrive className="w-4 h-4" /> Go to Offline Downloads Vault
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Case 2: Just Came Back Online (YouTube Style "Back Online - Click to Refresh & Sync")
  if (wasOffline || pendingCount > 0) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 animate-slideUp">
        <div className="bg-slate-900/95 border border-emerald-500/40 text-slate-100 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Back Online
              </div>
              <p className="text-xs text-slate-300 font-medium">
                {pendingCount > 0 ? `${pendingCount} offline activities ready to sync` : 'Internet reconnected'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSyncAndRefresh}
              disabled={isSyncing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl shadow-md gap-1.5 flex-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Refresh & Sync Data'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setWasOffline(false)}
              className="text-xs text-slate-400 hover:text-white h-9 px-3"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
