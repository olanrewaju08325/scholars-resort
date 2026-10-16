import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Wifi, WifiOff, Download, RefreshCw, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { syncWithSupabase } from '@/lib/sync';
import { processSyncQueue } from '@/lib/syncQueue';

export const OfflineIndicator = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setJustReconnected(true);
      toast.success('Back online! Reconnecting to Scholars Resort cloud...');
      syncWithSupabase().catch(() => {});
      processSyncQueue().catch(() => {});
      const timer = setTimeout(() => setJustReconnected(false), 5000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetryConnection = async () => {
    setCheckingConnection(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/health', { method: 'HEAD', signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);

      if (res && res.ok) {
        setIsOffline(false);
        setJustReconnected(true);
        toast.success('Internet restored! Synced platform state.');
        syncWithSupabase().catch(() => {});
        processSyncQueue().catch(() => {});
        setTimeout(() => setJustReconnected(false), 4500);
      } else {
        setIsOffline(true);
        toast.info('Still offline. Your downloaded subjects & mock exams remain accessible in Downloads!');
      }
    } catch {
      setIsOffline(true);
      toast.info('Connection still unavailable. You can continue practicing in Offline Downloads.');
    } finally {
      setCheckingConnection(false);
    }
  };

  const isAlreadyInDownloads = location.pathname.startsWith('/offline-packs') || location.pathname.startsWith('/offline');

  return (
    <AnimatePresence>
      {/* 1. YouTube-Style Offline Bottom Floating Bar */}
      {isOffline && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 220 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-xl z-[9999]"
        >
          <div className="bg-slate-950 text-white border-2 border-amber-500/80 rounded-2xl p-3.5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <WifiOff className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5">
                  No Internet Connection <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">Offline Vault Active</span>
                </p>
                <p className="text-[11px] text-slate-300 line-clamp-1">
                  Access downloaded subjects, past questions & CBT exams seamlessly.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
              {!isAlreadyInDownloads && (
                <button
                  type="button"
                  onClick={() => navigate('/offline-packs')}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Downloads Hub</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleRetryConnection}
                disabled={checkingConnection}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                title="Retry network connection"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingConnection ? 'animate-spin text-amber-400' : ''}`} />
                <span>{checkingConnection ? 'Checking...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. YouTube-Style Reconnected Toast Bar */}
      {!isOffline && justReconnected && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-[9999]"
        >
          <div className="bg-slate-950 text-white border border-emerald-500/60 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-white flex items-center gap-1">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" /> Back Online
                </p>
                <p className="text-[11px] text-slate-400">All offline practice progress synchronized.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setJustReconnected(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
