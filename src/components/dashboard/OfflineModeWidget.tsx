import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  HardDrive, Wifi, WifiOff, RefreshCw, CheckCircle2, 
  Trash2, Download, PlayCircle, Zap, Database, ArrowRight,
  BookOpen, Sparkles, Check
} from 'lucide-react';
import { 
  getDownloadedPacksAsync, 
  downloadSubjectPack, 
  deleteOfflinePack, 
  updateAllDownloadedPacks,
  type OfflinePack 
} from '@/lib/offlineStore';
import { OFFICIAL_JAMB_SUBJECTS, normalizeSubjectName } from '@/utils/subjectUtils';
import { useAuth } from '@/context/AuthContext';
import { OfflineSyncStatus } from '@/components/offline/OfflineSyncStatus';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';

export const OfflineModeWidget: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [downloadedPacks, setDownloadedPacks] = useState<Record<string, OfflinePack>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [togglingSubjectId, setTogglingSubjectId] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  const registeredSubjects = useMemo(() => {
    const list = profile?.utme_subjects || ['Use of English', 'Mathematics', 'Physics', 'Chemistry'];
    return list.map(name => {
      const canonical = normalizeSubjectName(name);
      const official = OFFICIAL_JAMB_SUBJECTS.find(s => s.name.toLowerCase() === canonical.toLowerCase());
      return {
        id: official?.id || name,
        name: canonical,
        category: official?.category || 'general'
      };
    });
  }, [profile?.utme_subjects]);

  const refreshPacks = async () => {
    try {
      const packs = await getDownloadedPacksAsync();
      setDownloadedPacks(packs);
    } catch (_) {}
  };

  useEffect(() => {
    setLoading(true);
    refreshPacks().finally(() => setLoading(false));

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Toggle individual subject offline mode (download if not saved, delete if saved)
  const handleToggleSubject = async (subjectId: string, subjectName: string, isCurrentlyEnabled: boolean) => {
    setTogglingSubjectId(subjectId);
    try {
      if (isCurrentlyEnabled) {
        deleteOfflinePack(subjectId);
        await refreshPacks();
        toast.info(`Removed offline pack for ${subjectName}`);
      } else {
        if (isOffline) {
          toast.error('Connect to internet briefly to download this subject pack.');
          return;
        }
        const pack = await downloadSubjectPack(subjectId, subjectName);
        await refreshPacks();
        toast.success(`Saved ${pack.questionsCount} offline questions for ${subjectName}!`);
      }
    } catch (e: any) {
      toast.error(`Operation failed: ${e.message}`);
    } finally {
      setTogglingSubjectId(null);
    }
  };

  // Batch download all 4 registered UTME subjects
  const handleBatchDownloadRegistered = async () => {
    if (isOffline) {
      toast.error('Connect to internet to download subject question banks.');
      return;
    }

    setBatchDownloading(true);
    setBatchProgress({ current: 0, total: registeredSubjects.length, name: 'Initializing...' });

    let count = 0;
    for (let i = 0; i < registeredSubjects.length; i++) {
      const sub = registeredSubjects[i];
      setBatchProgress({ current: i + 1, total: registeredSubjects.length, name: sub.name });
      try {
        await downloadSubjectPack(sub.id, sub.name);
        count++;
      } catch (err) {
        console.warn(`Failed downloading ${sub.name}:`, err);
      }
    }

    await refreshPacks();
    setBatchDownloading(false);
    setBatchProgress(null);
    toast.success(`Batch download complete: ${count} subjects saved for 100% offline practice!`);
  };

  // Compute summary stats
  const totalQuestionsStored = useMemo(() => {
    return Object.values(downloadedPacks).reduce((sum, p) => sum + (p.questionsCount || 0), 0);
  }, [downloadedPacks]);

  const enabledRegisteredCount = useMemo(() => {
    return registeredSubjects.filter(sub => {
      // Check by direct ID or normalized name
      return Object.values(downloadedPacks).some(
        p => p.subjectId === sub.id || normalizeSubjectName(p.subjectName || '') === normalizeSubjectName(sub.name)
      );
    }).length;
  }, [registeredSubjects, downloadedPacks]);

  const allRegisteredEnabled = enabledRegisteredCount === registeredSubjects.length && registeredSubjects.length > 0;

  return (
    <Card className="border border-border bg-card shadow-sm overflow-hidden">
      {/* Top Banner Accent */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-blue-950/70 to-slate-900 border-b border-border text-white space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <HardDrive className="w-4 h-4 text-primary" />
            <span className="uppercase tracking-wider">Offline Study Station</span>
            <span aria-hidden="true">·</span>
            <span className={isOffline ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
              {isOffline ? 'Offline Mode Active' : 'Cloud Connected'}
            </span>
          </div>

          <Link
            to="/offline-packs"
            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 text-slate-200 hover:text-white"
          >
            <span>Full Offline Manager</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div>
          <h3 className="text-xl font-extrabold font-display text-white">
            JAMB UTME Offline Question Hub
          </h3>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mt-1 leading-relaxed">
            Practice full mock exams without consuming mobile data. Toggle offline-enabled subjects to keep question banks stored directly on your phone or laptop.
          </p>
        </div>

        {/* Quick Resource Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          <div className="bg-slate-800/80 border border-slate-700/60 p-2.5 rounded-lg">
            <span className="text-slate-400 text-[11px] block">UTME Subjects Ready</span>
            <span className="text-lg font-black text-white">
              {enabledRegisteredCount} / {registeredSubjects.length}
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 p-2.5 rounded-lg">
            <span className="text-slate-400 text-[11px] block">Offline Questions</span>
            <span className="text-lg font-black text-emerald-400">
              {totalQuestionsStored.toLocaleString()} Qs
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 p-2.5 rounded-lg">
            <span className="text-slate-400 text-[11px] block">Offline Syllabus</span>
            <span className="text-lg font-black text-blue-400">
              Cached 100%
            </span>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/60 p-2.5 rounded-lg">
            <span className="text-slate-400 text-[11px] block">Device Engine</span>
            <span className="text-lg font-black text-slate-200">
              IndexedDB
            </span>
          </div>
        </div>
      </div>

      <CardContent className="p-5 sm:p-6 space-y-6">
        {/* Batch Action Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-muted/40 border border-border">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Registered UTME Combination
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allRegisteredEnabled 
                ? 'All 4 of your examination subjects are saved and ready for zero-data practice.'
                : 'Batch-download all 4 official subjects with one tap to enable full offline CBT mocks.'}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Button
              size="sm"
              onClick={handleBatchDownloadRegistered}
              disabled={isOffline || batchDownloading || allRegisteredEnabled}
              className={`font-bold gap-1.5 text-xs w-full sm:w-auto ${
                allRegisteredEnabled
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              }`}
            >
              {batchDownloading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : allRegisteredEnabled ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>
                {batchDownloading ? 'Downloading Bank...' : allRegisteredEnabled ? 'All Subjects Saved' : 'Batch Download 4 Subjects'}
              </span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/offline-packs')}
              className="font-bold gap-1.5 text-xs border-border"
            >
              <PlayCircle className="w-3.5 h-3.5 text-primary" />
              <span>Launch Simulator</span>
            </Button>
          </div>
        </div>

        {/* Batch Progress Bar if active */}
        {batchProgress && (
          <div className="p-3 rounded-lg bg-muted/60 border border-emerald-500/30 space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-foreground">
              <span>Downloading: {batchProgress.name}</span>
              <span>{batchProgress.current} / {batchProgress.total}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Subject Toggle Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold uppercase tracking-wider text-muted-foreground">
              Toggle Offline-Enabled Subjects
            </span>
            <span className="text-muted-foreground text-[11px]">
              Tap toggle to save or remove locally
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {registeredSubjects.map((sub) => {
              const matchedPack = Object.values(downloadedPacks).find(
                p => p.subjectId === sub.id || normalizeSubjectName(p.subjectName || '') === normalizeSubjectName(sub.name)
              );
              const isEnabled = Boolean(matchedPack && (matchedPack.questionsCount || 0) > 0);
              const isToggling = togglingSubjectId === sub.id;

              return (
                <div
                  key={sub.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isEnabled
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-border bg-card hover:border-border/80'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-foreground truncate">{sub.name}</span>
                      {isEnabled && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {isEnabled 
                        ? `${matchedPack?.questionsCount || 0} questions stored locally` 
                        : 'Not downloaded (Online required)'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle Switch */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isEnabled}
                      disabled={isToggling || (!isEnabled && isOffline)}
                      onClick={() => handleToggleSubject(sub.id, sub.name, isEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        isEnabled ? 'bg-emerald-600' : 'bg-muted'
                      } ${isToggling ? 'opacity-60 cursor-wait' : ''}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Embedded Sync Status Component */}
        <div className="pt-2">
          <OfflineSyncStatus variant="card" showDetailsToggle={true} />
        </div>
      </CardContent>
    </Card>
  );
};
