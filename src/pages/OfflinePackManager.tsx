import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Wifi, WifiOff, RefreshCw, CheckCircle2, Trash2, HardDrive, Info, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDownloadedPacks, downloadSubjectPack, deleteOfflinePack, checkForPackUpdates, checkForSubjectUpdate } from '@/lib/offlineStore';
import type { OfflinePack } from '@/lib/offlineStore';
import { toast } from 'sonner';

export const OfflinePackManager = () => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [downloadedPacks, setDownloadedPacks] = useState<Record<string, OfflinePack>>({});
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    fetchInitialData();
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('subjects').select('id, name').order('name');
      setSubjects(data || []);
      const packs = getDownloadedPacks();
      setDownloadedPacks(packs);

      // Check updates in background if online
      if (navigator.onLine && Object.keys(packs).length > 0) {
        checkForPackUpdates().then(() => {
          setDownloadedPacks(getDownloadedPacks());
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Error loading offline packs:', err);
      setDownloadedPacks(getDownloadedPacks());
    }
    setLoading(false);
  };

  const handleCheckUpdates = async () => {
    if (isOffline) {
      toast.error('You are offline. Reconnect to check for new database questions.');
      return;
    }
    setCheckingUpdates(true);
    try {
      const { updatedSubjects } = await checkForPackUpdates();
      setDownloadedPacks(getDownloadedPacks());
      if (updatedSubjects.length > 0) {
        toast.success(`New questions found for ${updatedSubjects.length} subject(s)! Click "Update Pack" to download.`);
      } else {
        toast.info('All offline question packs are completely up to date!');
      }
    } catch (e: any) {
      toast.error('Failed to check for updates: ' + e.message);
    }
    setCheckingUpdates(false);
  };

  const handleDownload = async (subId: string, subName: string) => {
    setDownloadingId(subId);
    try {
      const pack = await downloadSubjectPack(subId, subName);
      setDownloadedPacks(getDownloadedPacks());
      toast.success(`Downloaded ${pack.questionsCount} questions for ${subName}! Ready for 100% offline practice.`);
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    }
    setDownloadingId(null);
  };

  const handleDelete = (subId: string, subName: string) => {
    deleteOfflinePack(subId);
    setDownloadedPacks(getDownloadedPacks());
    toast.info(`Removed offline pack for ${subName}`);
  };

  const handleDownloadAll = async () => {
    toast.info('Starting offline downloads for all subjects...');
    for (const sub of subjects) {
      try {
        await downloadSubjectPack(sub.id, sub.name);
      } catch (e) {}
    }
    setDownloadedPacks(getDownloadedPacks());
    toast.success('All subject question packs saved for offline CBT practice!');
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-8 rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900/40 border border-blue-500/30 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-slate-950 uppercase tracking-wider">
            <HardDrive className="w-3.5 h-3.5" /> TestDriller-Style Offline CBT Center
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
            isOffline ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-green-500/20 text-green-500 border border-green-500/30'
          }`}>
            {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            {isOffline ? 'Offline Mode Active' : 'Online Sync Connected'}
          </div>
        </div>
        <h1 className="text-3xl font-extrabold font-display text-foreground">
          Download Offline UTME CBT Question Packs
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Download past question packs to practice full 400-question JAMB CBT mock exams without internet or mobile data.
        </p>
        <div className="pt-2 flex flex-wrap gap-3">
          <Button onClick={handleDownloadAll} disabled={isOffline || loading} className="bg-primary hover:bg-primary/90 font-bold gap-2">
            <Download className="w-4 h-4" /> Download All Subject Packs
          </Button>
          <Button onClick={handleCheckUpdates} disabled={isOffline || checkingUpdates} variant="outline" className="font-bold gap-2 border-primary/40 text-primary hover:bg-primary/10">
            <RefreshCw className={`w-4 h-4 ${checkingUpdates ? 'animate-spin' : ''}`} /> Check For Updates
          </Button>
        </div>
      </div>

      {/* Guide Card */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-bold text-foreground">How Offline Practice Works:</p>
            <p>1. Download your required subject packs while connected to Wi-Fi or data.</p>
            <p>2. Once saved, you can take full timed CBT exam sessions anytime — even with Airplane Mode ON.</p>
            <p>3. Whenever you reconnect online, your exam scores auto-sync to your account leaderboard.</p>
          </div>
        </CardContent>
      </Card>

      {/* Subject Pack List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Available Subject Packs</h3>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading subjects...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjects.map((sub) => {
              const pack = downloadedPacks[sub.id];
              const isDownloaded = Boolean(pack);
              const hasUpdate = pack?.hasUpdate;

              return (
                <Card key={sub.id} className={`border transition-all ${
                  hasUpdate ? 'border-amber-500/60 bg-amber-500/10' : isDownloaded ? 'border-green-500/40 bg-green-500/5' : 'border-border bg-card'
                }`}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-foreground flex items-center gap-2">
                        {sub.name}
                        {isDownloaded && !hasUpdate && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {hasUpdate && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 uppercase animate-pulse flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Update Available
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isDownloaded 
                          ? `${pack.questionsCount} Questions Stored ${hasUpdate ? `(New batch of ${pack.remoteCount || ''} available!)` : ''}` 
                          : 'Not Downloaded Yet'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isDownloaded && !hasUpdate && (
                        <Button size="sm" variant="outline" onClick={() => handleDelete(sub.id, sub.name)} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      
                      {isDownloaded && hasUpdate && (
                        <Button
                          size="sm"
                          disabled={downloadingId === sub.id || isOffline}
                          onClick={() => handleDownload(sub.id, sub.name)}
                          className="font-bold gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950"
                        >
                          {downloadingId === sub.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          {downloadingId === sub.id ? 'Updating...' : 'Update Pack'}
                        </Button>
                      )}

                      {!isDownloaded && (
                        <Button
                          size="sm"
                          disabled={downloadingId === sub.id || isOffline}
                          onClick={() => handleDownload(sub.id, sub.name)}
                          className="font-bold gap-1 bg-primary text-primary-foreground"
                        >
                          {downloadingId === sub.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          {downloadingId === sub.id ? 'Saving...' : 'Download'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
