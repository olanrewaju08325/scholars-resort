import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Wifi, WifiOff, RefreshCw, CheckCircle2, Trash2, HardDrive, Info, Sparkles, FileJson, History, Trophy, BarChart2, Clock, Calendar, PlayCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDownloadedPacks, downloadSubjectPack, deleteOfflinePack, checkForPackUpdates, checkForSubjectUpdate, getCompletedOfflineSessions, type CompletedOfflineSession } from '@/lib/offlineStore';
import type { OfflinePack } from '@/lib/offlineStore';
import { exportOfflineDataAsJson } from '@/lib/offlineExport';
import { toast } from 'sonner';
import { useNavigate } from "react-router-dom";

export const OfflinePackManager = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [downloadedPacks, setDownloadedPacks] = useState<Record<string, OfflinePack>>({});
  const [completedSessions, setCompletedSessions] = useState<CompletedOfflineSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [activeTab, setActiveTab] = useState<'packs' | 'history'>('packs');

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

      const history = getCompletedOfflineSessions();
      setCompletedSessions(history);

      // Check updates in background if online
      if (navigator.onLine && Object.keys(packs).length > 0) {
        checkForPackUpdates().then(() => {
          setDownloadedPacks(getDownloadedPacks());
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Error loading offline packs:', err);
      setDownloadedPacks(getDownloadedPacks());
      setCompletedSessions(getCompletedOfflineSessions());
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-primary text-primary-foreground uppercase tracking-wider">
            <HardDrive className="w-3.5 h-3.5" /> Scholars Resort Offline CBT Center
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
          <Button onClick={() => exportOfflineDataAsJson()} variant="outline" className="font-bold gap-2 border-border text-foreground hover:bg-muted">
            <FileJson className="w-4 h-4 text-emerald-500" /> Export Data Backup (JSON)
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab('packs')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'packs'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <HardDrive className="w-4 h-4" /> Subject Question Packs
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4" /> Local Practice History & Metrics ({completedSessions.length})
        </button>
      </div>

      {activeTab === 'packs' ? (
        <>
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
                            <>
                              <Button size="sm" variant="outline" onClick={() => navigate(`/practice?mode=subject&subjectId=${sub.id}`)} className="font-bold gap-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 border-green-500/30">
                                <PlayCircle className="w-4 h-4" /> Start Offline
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDelete(sub.id, sub.name)} className="text-red-500 border-red-500/30 hover:bg-red-500/10">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
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
        </>
      ) : (
        /* Local Practice Session History & Metrics View */
        <div className="space-y-6">
          {/* Key Offline Performance Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Offline Sessions</p>
                  <p className="text-2xl font-extrabold text-foreground">{completedSessions.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Average Score %</p>
                  <p className="text-2xl font-extrabold text-foreground">
                    {completedSessions.length > 0
                      ? Math.round(completedSessions.reduce((acc, s) => acc + s.percentageScore, 0) / completedSessions.length)
                      : 0}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Highest Offline Score</p>
                  <p className="text-2xl font-extrabold text-foreground">
                    {completedSessions.length > 0
                      ? Math.round(Math.max(...completedSessions.map(s => s.percentageScore)))
                      : 0}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Questions Solved</p>
                  <p className="text-2xl font-extrabold text-foreground">
                    {completedSessions.reduce((acc, s) => acc + s.totalQuestions, 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Session History */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Local Session Logs</h3>
            {completedSessions.length === 0 ? (
              <Card className="border-border bg-card p-8 text-center space-y-2">
                <History className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
                <p className="font-bold text-foreground">No offline session history found yet</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Complete CBT Mock Exams or Practice Drills while offline or online. Your session metrics will be stored here automatically for zero-data review!
                </p>
                <Button onClick={() => navigate('/practice')} className="mt-2 bg-primary text-primary-foreground font-bold text-xs">
                  Start Practice Session Now
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {completedSessions.map((session, idx) => {
                  const minutesSpent = Math.floor(session.timeSpentSeconds / 60);
                  const secondsSpent = session.timeSpentSeconds % 60;
                  const formattedDate = new Date(session.completedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <Card key={session.id || idx} className="border-border bg-card hover:border-primary/40 transition-all shadow-sm">
                      <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-primary/10 text-primary border border-primary/20">
                              {session.mode}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {formattedDate}
                            </span>
                          </div>
                          <p className="font-bold text-foreground text-sm">
                            Score: {session.score} / {session.totalQuestions} ({Math.round(session.percentageScore)}%)
                          </p>
                          {session.subjects && session.subjects.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Subjects: {session.subjects.join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-4 self-end sm:self-center">
                          <div className="text-right">
                            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                              <Clock className="w-3 h-3 text-primary" /> {minutesSpent}m {secondsSpent}s
                            </span>
                            <span className={`text-xs font-bold ${
                              session.percentageScore >= 70 ? 'text-emerald-500' : session.percentageScore >= 50 ? 'text-amber-500' : 'text-red-500'
                            }`}>
                              {session.percentageScore >= 70 ? 'Excellent' : session.percentageScore >= 50 ? 'Good Effort' : 'Needs Review'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
