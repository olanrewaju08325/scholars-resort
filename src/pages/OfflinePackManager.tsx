import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Download, Wifi, WifiOff, RefreshCw, CheckCircle2, Trash2, HardDrive, 
  Info, Sparkles, FileJson, History, Trophy, BarChart2, Clock, Calendar, 
  PlayCircle, Search, Filter, ShieldCheck, Zap, AlertCircle, Laptop,
  HelpCircle, ChevronRight, CheckCircle, Database, Check, Award, ArrowRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { 
  getDownloadedPacksAsync, 
  downloadSubjectPack, 
  deleteOfflinePack, 
  checkForPackUpdates, 
  checkForSubjectUpdate, 
  updateAllDownloadedPacks,
  getCompletedOfflineSessionsAsync, 
  clearCompletedOfflineSessions,
  saveCompletedOfflineSession,
  type CompletedOfflineSession, 
  type OfflinePack 
} from '@/lib/offlineStore';
import { exportOfflineDataAsJson } from '@/lib/offlineExport';
import { OFFICIAL_JAMB_SUBJECTS, normalizeSubjectName } from '@/utils/subjectUtils';
import { useAuth } from '@/context/AuthContext';
import { processSyncQueue, getPendingQueueCount } from '@/lib/syncQueue';
import { OfflineSyncStatus } from '@/components/offline/OfflineSyncStatus';
import { toast } from 'sonner';
import { useNavigate } from "react-router-dom";

export const OfflinePackManager = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [downloadedPacks, setDownloadedPacks] = useState<Record<string, OfflinePack>>({});
  const [completedSessions, setCompletedSessions] = useState<CompletedOfflineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [updateAllProgress, setUpdateAllProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [activeTab, setActiveTab] = useState<'packs' | 'station' | 'history' | 'software-guide'>('packs');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isSyncingPending, setIsSyncingPending] = useState<boolean>(false);

  // Standalone Offline CBT Station state
  const [stationSubject, setStationSubject] = useState<string>('');
  const [stationMode, setStationMode] = useState<'subject_drill' | 'full_mock' | 'past_questions'>('subject_drill');
  const [stationQuestionCount, setStationQuestionCount] = useState<number>(20);
  const [stationTimerMinutes, setStationTimerMinutes] = useState<number>(20);

  useEffect(() => {
    fetchInitialData();
    refreshPendingQueue();

    const handleOnline = () => {
      setIsOffline(false);
      refreshPendingQueue();
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshPendingQueue = async () => {
    try {
      const count = await getPendingQueueCount();
      setPendingSyncCount(count);
    } catch (_) {}
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch available subjects from Supabase with fallback to official JAMB taxonomy
      let dbSubjects: any[] = [];
      try {
        const { data } = await supabase.from('subjects').select('id, name, category').order('name');
        if (data && data.length > 0) {
          dbSubjects = data;
        }
      } catch (e) {
        console.warn('Network error fetching remote subjects list:', e);
      }

      // Merge DB subjects with OFFICIAL_JAMB_SUBJECTS to ensure no subject is ever missing
      const mergedMap = new Map<string, any>();
      OFFICIAL_JAMB_SUBJECTS.forEach(s => {
        mergedMap.set(s.name.toLowerCase().trim(), {
          id: s.id,
          name: s.name,
          category: s.category,
          icon: s.icon
        });
      });

      dbSubjects.forEach(s => {
        const norm = s.name.toLowerCase().trim();
        const existing = mergedMap.get(norm);
        mergedMap.set(norm, {
          id: s.id,
          name: s.name,
          category: s.category || existing?.category || 'general',
          icon: existing?.icon || 'BookOpen'
        });
      });

      const fullSubjectList = Array.from(mergedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      setSubjects(fullSubjectList);
      
      // Set default station subject
      if (fullSubjectList.length > 0) {
        setStationSubject(fullSubjectList[0].id);
      }

      // 2. Load downloaded packs and offline sessions from IndexedDB
      const packs = await getDownloadedPacksAsync();
      setDownloadedPacks(packs);

      const history = await getCompletedOfflineSessionsAsync();
      setCompletedSessions(history);

      // Check updates in background if connected online
      if (navigator.onLine && Object.keys(packs).length > 0) {
        checkForPackUpdates().then(async () => {
          const updated = await getDownloadedPacksAsync();
          setDownloadedPacks(updated);
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Error during offline initial data load:', err);
      const fallbackPacks = await getDownloadedPacksAsync();
      setDownloadedPacks(fallbackPacks);
      const fallbackHistory = await getCompletedOfflineSessionsAsync();
      setCompletedSessions(fallbackHistory);
    }
    setLoading(false);
  };

  const handleCheckUpdates = async () => {
    if (isOffline) {
      toast.error('You are currently offline. Connect to Wi-Fi or mobile data to check for newly published questions.');
      return;
    }
    setCheckingUpdates(true);
    try {
      const { updatedSubjects } = await checkForPackUpdates();
      const refreshed = await getDownloadedPacksAsync();
      setDownloadedPacks(refreshed);
      if (updatedSubjects.length > 0) {
        toast.success(`New questions found for ${updatedSubjects.length} subject(s)! Tap "Update Pack" to download.`);
      } else {
        toast.info('All offline question packs are up to date with the latest Cloud bank.');
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
      const refreshed = await getDownloadedPacksAsync();
      setDownloadedPacks(refreshed);
      toast.success(`Successfully saved ${pack.questionsCount} questions for ${subName}! Ready for 100% offline practice.`);
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    }
    setDownloadingId(null);
  };

  const handleDelete = async (subId: string, subName: string) => {
    deleteOfflinePack(subId);
    const refreshed = await getDownloadedPacksAsync();
    setDownloadedPacks(refreshed);
    toast.info(`Removed offline pack for ${subName}`);
  };

  const handleUpdateAll = async () => {
    if (isOffline) {
      toast.error('Connect to internet to update all offline packs.');
      return;
    }
    setIsUpdatingAll(true);
    setUpdateAllProgress({ current: 0, total: Object.keys(downloadedPacks).length || 1, name: 'Starting...' });
    try {
      const { updatedCount, errors } = await updateAllDownloadedPacks((current, total, name) => {
        setUpdateAllProgress({ current, total, name });
      });
      const refreshed = await getDownloadedPacksAsync();
      setDownloadedPacks(refreshed);
      if (errors.length > 0) {
        toast.warning(`Updated ${updatedCount} pack(s). Some had errors: ${errors.join(', ')}`);
      } else {
        toast.success(`All ${updatedCount} subject packs successfully updated and verified!`);
      }
    } catch (e: any) {
      toast.error('Update all failed: ' + e.message);
    }
    setIsUpdatingAll(false);
    setUpdateAllProgress(null);
  };

  // 1-Click Offline Setup Wizard: Downloads user's registered UTME subjects
  const handleQuickStudentSetup = async () => {
    if (isOffline) {
      toast.error('Please connect to internet briefly to perform the 1-click initial setup.');
      return;
    }

    const registeredSubs: string[] = profile?.utme_subjects || [
      'Use of English', 'Mathematics', 'Physics', 'Chemistry'
    ];

    toast.info(`Setting up 100% Offline Mode for: ${registeredSubs.join(', ')}...`);
    setIsUpdatingAll(true);

    let count = 0;
    for (let i = 0; i < registeredSubs.length; i++) {
      const sName = registeredSubs[i];
      const matched = subjects.find(s => s.name.toLowerCase() === sName.toLowerCase()) || { id: sName, name: sName };
      setUpdateAllProgress({ current: i + 1, total: registeredSubs.length, name: sName });
      try {
        await downloadSubjectPack(matched.id, matched.name);
        count++;
      } catch (e) {
        console.warn(`Failed downloading ${sName}:`, e);
      }
    }

    const refreshed = await getDownloadedPacksAsync();
    setDownloadedPacks(refreshed);
    setIsUpdatingAll(false);
    setUpdateAllProgress(null);
    toast.success(`1-Click Setup Complete! Saved ${count} subject packs. You can now use the app 100% offline without internet!`);
  };

  const handleManualSync = async () => {
    if (isOffline) {
      toast.warning('You are currently offline. Connect to Wi-Fi to sync pending results.');
      return;
    }
    setIsSyncingPending(true);
    try {
      await processSyncQueue();
      await refreshPendingQueue();
      toast.success('Offline study history synchronized to Cloud leaderboard!');
    } catch (e: any) {
      toast.error('Sync error: ' + e.message);
    }
    setIsSyncingPending(false);
  };

  // Filtered Subject List
  const filteredSubjects = useMemo(() => {
    return subjects.filter(sub => {
      const matchesSearch = sub.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = 
        selectedCategory === 'all' ? true :
        selectedCategory === 'downloaded' ? Boolean(downloadedPacks[sub.id]) :
        selectedCategory === 'has_update' ? Boolean(downloadedPacks[sub.id]?.hasUpdate) :
        sub.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [subjects, searchQuery, selectedCategory, downloadedPacks]);

  // Total stats
  const totalQuestionsStored = useMemo(() => {
    return Object.values(downloadedPacks).reduce((sum, p) => sum + (p.questionsCount || 0), 0);
  }, [downloadedPacks]);

  const downloadedCount = Object.keys(downloadedPacks).length;
  const updatesAvailableCount = Object.values(downloadedPacks).filter(p => p.hasUpdate).length;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Top Banner & Control Station */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950/80 to-slate-900 border border-blue-500/30 text-white shadow-xl space-y-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-primary text-primary-foreground uppercase tracking-wider shadow-sm">
            <HardDrive className="w-4 h-4" /> Scholars Resort Standalone Offline Studio
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border shadow-sm ${
              isOffline 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}>
              {isOffline ? <WifiOff className="w-3.5 h-3.5 animate-pulse" /> : <Wifi className="w-3.5 h-3.5" />}
              {isOffline ? 'Offline Mode (Zero Data Consumption)' : 'Cloud Connected'}
            </div>

            {pendingSyncCount > 0 && (
              <Button 
                size="sm" 
                onClick={handleManualSync} 
                disabled={isOffline || isSyncingPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 h-8"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPending ? 'animate-spin' : ''}`} />
                Sync {pendingSyncCount} Pending Records
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-white">
            JAMB UTME Offline Question Packs & Simulator
          </h1>
          <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
            Download complete subject past question packs directly to your device storage. Practice full 400-mark CBT exams and topic drills with <strong>100% zero internet connection</strong>, preserving battery and avoiding network lag.
          </p>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 p-3 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Offline Packs Saved</div>
            <div className="text-xl font-black text-white mt-0.5">{downloadedCount} / {subjects.length || 24}</div>
          </div>
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 p-3 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Local Questions Stored</div>
            <div className="text-xl font-black text-emerald-400 mt-0.5">{totalQuestionsStored.toLocaleString()} Qs</div>
          </div>
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 p-3 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Updates Available</div>
            <div className={`text-xl font-black mt-0.5 ${updatesAvailableCount > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
              {updatesAvailableCount} Packs
            </div>
          </div>
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700/60 p-3 rounded-xl">
            <div className="text-slate-400 text-xs font-medium">Local Exams Taken</div>
            <div className="text-xl font-black text-blue-400 mt-0.5">{completedSessions.length} Sessions</div>
          </div>
        </div>

        {/* Top Actions Row */}
        <div className="pt-2 flex flex-wrap gap-2.5 items-center">
          <Button 
            onClick={handleQuickStudentSetup} 
            disabled={isOffline || isUpdatingAll} 
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold gap-2 shadow-md"
          >
            <Zap className="w-4 h-4" /> 1-Click Offline Setup (My 4 Subjects)
          </Button>

          {downloadedCount > 0 && (
            <Button 
              onClick={handleUpdateAll} 
              disabled={isOffline || isUpdatingAll} 
              variant="outline" 
              className="font-bold gap-2 border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${isUpdatingAll ? 'animate-spin' : ''}`} /> 
              {isUpdatingAll ? 'Updating All Packs...' : 'Update All Saved Packs'}
            </Button>
          )}

          <Button 
            onClick={handleCheckUpdates} 
            disabled={isOffline || checkingUpdates} 
            variant="outline" 
            className="font-bold gap-2 border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${checkingUpdates ? 'animate-spin' : ''}`} /> 
            Check For Question Updates
          </Button>

          <Button 
            onClick={() => exportOfflineDataAsJson()} 
            variant="outline" 
            className="font-bold gap-2 border-slate-600 bg-slate-800/80 text-white hover:bg-slate-700 ml-auto"
          >
            <FileJson className="w-4 h-4 text-emerald-400" /> Export JSON Backup
          </Button>
        </div>

        {/* Update Progress Indicator */}
        {updateAllProgress && (
          <div className="bg-slate-800/90 border border-emerald-500/40 p-3.5 rounded-xl space-y-2">
            <div className="flex justify-between text-xs font-bold text-emerald-300">
              <span>Downloading & Syncing: {updateAllProgress.name}</span>
              <span>{updateAllProgress.current} / {updateAllProgress.total}</span>
            </div>
            <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300 rounded-full" 
                style={{ width: `${(updateAllProgress.current / updateAllProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Background Synchronization Queue Monitor */}
      <OfflineSyncStatus variant="card" showDetailsToggle={true} />

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('packs')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'packs'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <HardDrive className="w-4 h-4" /> Subject Question Packs ({downloadedCount}/{subjects.length})
        </button>

        <button
          onClick={() => setActiveTab('station')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'station'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <PlayCircle className="w-4 h-4 text-emerald-500" /> Standalone Offline CBT Station
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4" /> Local Practice History ({completedSessions.length})
        </button>

        <button
          onClick={() => setActiveTab('software-guide')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === 'software-guide'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Laptop className="w-4 h-4 text-blue-500" /> Desktop & Offline Software Setup
        </button>
      </div>

      {/* TAB 1: SUBJECT QUESTION PACKS */}
      {activeTab === 'packs' && (
        <div className="space-y-6">
          {/* Quick Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search subject (e.g. Physics, English)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All Subjects' },
                { id: 'downloaded', label: `Downloaded (${downloadedCount})` },
                { id: 'has_update', label: `Updates Ready (${updatesAvailableCount})` },
                { id: 'compulsory', label: 'Compulsory' },
                { id: 'sciences', label: 'Sciences' },
                { id: 'commercial', label: 'Commercial' },
                { id: 'arts', label: 'Arts' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Cards Grid */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              Loading offline subject packs...
            </div>
          ) : filteredSubjects.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <HardDrive className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
              <h3 className="font-bold text-foreground">No subjects match your filter</h3>
              <p className="text-xs text-muted-foreground mt-1">Try searching for a different subject name or category.</p>
              <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }} className="mt-3">
                Reset Filters
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSubjects.map((sub) => {
                const pack = downloadedPacks[sub.id];
                const isDownloaded = Boolean(pack);
                const hasUpdate = Boolean(pack?.hasUpdate);
                const isDownloadingThis = downloadingId === sub.id;

                return (
                  <Card key={sub.id} className={`border transition-all flex flex-col justify-between ${
                    hasUpdate 
                      ? 'border-amber-500/60 bg-amber-500/5 shadow-md ring-1 ring-amber-500/20' 
                      : isDownloaded 
                      ? 'border-emerald-500/40 bg-emerald-500/5 shadow-sm' 
                      : 'border-border bg-card hover:border-primary/40'
                  }`}>
                    <CardContent className="p-5 space-y-4">
                      {/* Subject Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-base text-foreground">{sub.name}</span>
                            {isDownloaded && !hasUpdate && (
                              <span className="p-0.5 rounded-full bg-emerald-500/20 text-emerald-500" title="Downloaded & Offline Ready">
                                <CheckCircle2 className="w-4 h-4" />
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {sub.category || 'JAMB Subject'}
                          </span>
                        </div>

                        {hasUpdate && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-slate-950 uppercase animate-pulse flex items-center gap-1 shrink-0">
                            <Sparkles className="w-3 h-3" /> Update Ready
                          </span>
                        )}
                      </div>

                      {/* Status Info */}
                      <div className="bg-background/80 border border-border/80 rounded-xl p-3 space-y-1 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Local Questions:</span>
                          <span className="font-bold text-foreground">
                            {isDownloaded ? `${pack.questionsCount} Questions` : 'Not Downloaded'}
                          </span>
                        </div>
                        {isDownloaded && (
                          <div className="flex justify-between text-muted-foreground text-[11px]">
                            <span>Last Download:</span>
                            <span>{new Date(pack.downloadedAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        {hasUpdate && (
                          <div className="flex justify-between text-amber-500 font-bold text-[11px] pt-0.5">
                            <span>Cloud Bank Total:</span>
                            <span>{pack.remoteCount || ''} Questions available</span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="pt-1 flex items-center gap-2 flex-wrap">
                        {isDownloaded ? (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => navigate(`/practice?mode=subject&subjectId=${sub.id}`)} 
                              className="font-bold gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex-1"
                            >
                              <PlayCircle className="w-3.5 h-3.5" /> Practice
                            </Button>

                            <Button 
                              size="sm" 
                              disabled={isDownloadingThis || isOffline} 
                              onClick={() => handleDownload(sub.id, sub.name)} 
                              className={`font-bold gap-1 px-3 ${
                                hasUpdate 
                                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm' 
                                  : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                              }`}
                              title="Refresh / update questions for this subject from Cloud"
                            >
                              {isDownloadingThis ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              {isDownloadingThis ? 'Updating...' : hasUpdate ? 'Update' : 'Refresh'}
                            </Button>

                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleDelete(sub.id, sub.name)} 
                              className="text-red-500 hover:bg-red-500/10 px-2.5"
                              title="Delete local pack"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button 
                            size="sm" 
                            disabled={isDownloadingThis || isOffline} 
                            onClick={() => handleDownload(sub.id, sub.name)} 
                            className="font-bold gap-1.5 bg-primary text-primary-foreground w-full shadow-sm"
                          >
                            {isDownloadingThis ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            {isDownloadingThis ? 'Downloading Pack...' : 'Download Offline Pack'}
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
      )}

      {/* TAB 2: STANDALONE OFFLINE CBT STATION */}
      {activeTab === 'station' && (
        <div className="space-y-6">
          <Card className="border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 shadow-md">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold font-display">Instant Standalone Offline CBT Launcher</CardTitle>
                  <CardDescription>
                    Directly launch simulated CBT mock exams using your stored question packs. Works 100% offline without sending any network queries.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {downloadedCount === 0 ? (
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                  <p className="font-bold text-foreground">You haven't downloaded any offline question packs yet.</p>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Download at least 1 subject pack from the Subject Packs tab or tap 1-Click Setup to begin taking offline exams.
                  </p>
                  <Button onClick={() => setActiveTab('packs')} className="bg-primary font-bold">
                    Go to Subject Packs
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Configuration */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                        Select Subject Pack
                      </label>
                      <select 
                        value={stationSubject}
                        onChange={(e) => setStationSubject(e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm font-bold text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                      >
                        {Object.values(downloadedPacks).map((p) => (
                          <option key={p.subjectId} value={p.subjectId}>
                            {p.subjectName} ({p.questionsCount} Questions Ready)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                        Practice Mode
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'subject_drill', label: 'Subject Drill' },
                          { id: 'full_mock', label: 'Full Mock' },
                          { id: 'past_questions', label: 'Past Papers' },
                        ].map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setStationMode(m.id as any)}
                            className={`p-3 rounded-xl text-xs font-bold border text-center transition-all ${
                              stationMode === m.id
                                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                : 'border-border bg-card text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                          Questions Count
                        </label>
                        <select
                          value={stationQuestionCount}
                          onChange={(e) => setStationQuestionCount(Number(e.target.value))}
                          className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm font-bold text-foreground"
                        >
                          <option value={10}>10 Questions</option>
                          <option value={20}>20 Questions (Standard)</option>
                          <option value={40}>40 Questions (UTME Set)</option>
                          <option value={60}>60 Questions (Use of English)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                          Timer (Minutes)
                        </label>
                        <select
                          value={stationTimerMinutes}
                          onChange={(e) => setStationTimerMinutes(Number(e.target.value))}
                          className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-sm font-bold text-foreground"
                        >
                          <option value={10}>10 Minutes (Speed)</option>
                          <option value={20}>20 Minutes</option>
                          <option value={30}>30 Minutes</option>
                          <option value={60}>60 Minutes (Standard)</option>
                          <option value={120}>120 Minutes (Full Exam)</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <Button 
                        onClick={() => {
                          const targetSubject = stationSubject || Object.keys(downloadedPacks)[0];
                          if (!targetSubject) {
                            toast.error('Please select a subject pack.');
                            return;
                          }
                          navigate(`/practice?mode=subject&subjectId=${targetSubject}&count=${stationQuestionCount}&timer=${stationTimerMinutes}`);
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold gap-2 h-12 text-base shadow-md"
                      >
                        <PlayCircle className="w-5 h-5" /> Launch Standalone Offline Exam
                      </Button>
                    </div>
                  </div>

                  {/* Right Column: Features & Highlights */}
                  <div className="bg-card border border-border p-5 rounded-xl space-y-4">
                    <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" /> Offline CBT Engine Guarantees
                    </h4>

                    <div className="space-y-3 text-xs text-muted-foreground">
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                          ✓
                        </div>
                        <p><strong>Zero Network Latency:</strong> All questions, options, and explanations load instantaneously from device memory.</p>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                          ✓
                        </div>
                        <p><strong>Battery Power Saving:</strong> Cellular antennas shut down in Airplane mode, saving up to 40% battery during 2-hour exams.</p>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                          ✓
                        </div>
                        <p><strong>Auto-Sync Progress:</strong> Your score, accuracy, and study streaks are safely stored and synced automatically once you reconnect.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: LOCAL PRACTICE HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-foreground">Completed Offline Practice Sessions</h3>
              <p className="text-xs text-muted-foreground">Detailed logs of exams completed while operating offline.</p>
            </div>

            {completedSessions.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  if (window.confirm('Clear all local offline practice history?')) {
                    await clearCompletedOfflineSessions();
                    setCompletedSessions([]);
                    toast.info('Local history cleared.');
                  }
                }}
                className="text-red-500 border-red-500/30 hover:bg-red-500/10 text-xs font-bold gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear History
              </Button>
            )}
          </div>

          {completedSessions.length === 0 ? (
            <Card className="p-10 text-center border-dashed">
              <History className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-40" />
              <h4 className="font-bold text-foreground">No Offline Sessions Logged Yet</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Take a practice test while offline or in airplane mode to view your performance logs and score breakdowns here.
              </p>
              <Button onClick={() => setActiveTab('station')} size="sm" className="mt-4 font-bold bg-primary">
                Take Offline Practice Test
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {completedSessions.map((session, idx) => (
                <Card key={session.id || idx} className="border-border bg-card hover:border-primary/30 transition-all">
                  <CardContent className="p-4 flex items-center justify-between flex-wrap gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{session.mode || 'CBT Practice'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          session.percentageScore >= 70 ? 'bg-emerald-500/20 text-emerald-500' :
                          session.percentageScore >= 50 ? 'bg-blue-500/20 text-blue-500' :
                          'bg-amber-500/20 text-amber-500'
                        }`}>
                          {session.percentageScore}% Score
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" /> {new Date(session.completedAt).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> {Math.round((session.timeSpentSeconds || 0) / 60)} mins
                        </span>
                        <span>{session.score} / {session.totalQuestions} Correct</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate('/cbt')} className="text-xs font-bold">
                        View CBT Analytics
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DESKTOP & OFFLINE SOFTWARE SETUP */}
      {activeTab === 'software-guide' && (
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Laptop className="w-5 h-5 text-primary" /> How Scholars Resort Functions Like Desktop CBT Software
              </CardTitle>
              <CardDescription>
                Install the application as a standalone desktop or mobile software app for seamless offline study.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold">
                    1
                  </div>
                  <h4 className="font-bold text-sm text-foreground">Install App (PWA)</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    On Chrome or Edge, click the <strong>Install</strong> icon in the address bar (or on mobile tap "Add to Home Screen"). This installs the app natively on your computer or phone.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
                    2
                  </div>
                  <h4 className="font-bold text-sm text-foreground">Download Subject Packs</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tap <strong>1-Click Offline Setup</strong> to download your 4 registered UTME subjects. All questions and diagrams are stored in IndexedDB.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold">
                    3
                  </div>
                  <h4 className="font-bold text-sm text-foreground">Fly Offline Anytime</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Turn off Wi-Fi or turn on Airplane mode! Launch the app from your desktop or home screen and practice full JAMB mock exams anytime, anywhere.
                  </p>
                </div>
              </div>

              {/* Troubleshooting & Technical Storage Summary */}
              <div className="p-4 rounded-xl bg-background border border-border space-y-3">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-500" /> Device Storage Diagnostics
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                    <span className="text-muted-foreground block">Storage Engine:</span>
                    <span className="font-bold text-foreground">Browser IndexedDB (Dexie.js)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                    <span className="text-muted-foreground block">Storage Quota Limit:</span>
                    <span className="font-bold text-foreground">Up to 50 GB (Browser Native)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
                    <span className="text-muted-foreground block">Sync Background Queue:</span>
                    <span className="font-bold text-emerald-500">Auto-Active on Reconnect</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
