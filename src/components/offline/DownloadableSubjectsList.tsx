import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  HardDrive, Download, RefreshCw, CheckCircle2, Trash2, 
  Search, PlayCircle, Sparkles, AlertCircle, Zap, Check, 
  Clock, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { 
  downloadSubjectPack, 
  deleteOfflinePack, 
  calculatePackSize, 
  formatBytes,
  getPackStaleness,
  isPackStale,
  STALE_PACK_DAYS_THRESHOLD,
  type OfflinePack 
} from '@/lib/offlineStore';
import { normalizeSubjectName } from '@/utils/subjectUtils';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export interface SubjectItem {
  id: string;
  name: string;
  category?: string;
  icon?: string;
}

interface DownloadableSubjectsListProps {
  subjects: SubjectItem[];
  downloadedPacks: Record<string, OfflinePack>;
  onPacksUpdated: () => void;
  isOffline: boolean;
  cloudSubjectCounts?: Record<string, number>;
  className?: string;
}

export const DownloadableSubjectsList: React.FC<DownloadableSubjectsListProps> = ({
  subjects,
  downloadedPacks,
  onPacksUpdated,
  isOffline,
  cloudSubjectCounts = {},
  className = ''
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Track sync progress per subject id: { status: string; percent: number }
  const [syncProgressMap, setSyncProgressMap] = useState<Record<string, { status: string; percent: number }>>({});
  const [isBatchOperating, setIsBatchOperating] = useState<boolean>(false);

  // Student registered subjects
  const registeredSubjectNames = useMemo(() => {
    return (profile?.utme_subjects || ['Use of English', 'Mathematics', 'Physics', 'Chemistry'])
      .map(s => normalizeSubjectName(s).toLowerCase().trim());
  }, [profile?.utme_subjects]);

  // Find corresponding pack for a subject
  const getSubjectPack = (sub: SubjectItem): OfflinePack | null => {
    if (downloadedPacks[sub.id]) return downloadedPacks[sub.id];
    const norm = normalizeSubjectName(sub.name).toLowerCase().trim();
    return Object.values(downloadedPacks).find(
      p => normalizeSubjectName(p.subjectName || '').toLowerCase().trim() === norm
    ) || null;
  };

  // Compute stale packs count
  const stalePacksCount = useMemo(() => {
    return Object.values(downloadedPacks).filter(p => isPackStale(p)).length;
  }, [downloadedPacks]);

  // Filter subjects based on query & category
  const filteredSubjects = useMemo(() => {
    return subjects.filter(sub => {
      const normName = sub.name.toLowerCase();
      const matchesSearch = normName.includes(searchQuery.toLowerCase());
      const pack = getSubjectPack(sub);
      const isDownloaded = Boolean(pack && (pack.questionsCount || 0) > 0);
      const hasUpdate = Boolean(pack?.hasUpdate);
      const isStale = Boolean(isDownloaded && isPackStale(pack));

      const matchesCategory = 
        selectedCategory === 'all' ? true :
        selectedCategory === 'downloaded' ? isDownloaded :
        selectedCategory === 'stale' ? isStale :
        selectedCategory === 'has_update' ? hasUpdate :
        selectedCategory === 'registered' ? registeredSubjectNames.includes(normName) :
        sub.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [subjects, searchQuery, selectedCategory, downloadedPacks, registeredSubjectNames]);

  // Handle Switch Toggle for an individual subject
  const handleToggle = async (sub: SubjectItem, shouldEnable: boolean) => {
    const pack = getSubjectPack(sub);

    if (shouldEnable) {
      if (isOffline) {
        toast.error('Connect to internet to download this subject question bank.');
        return;
      }

      setSyncProgressMap(prev => ({
        ...prev,
        [sub.id]: { status: 'Fetching questions...', percent: 25 }
      }));

      try {
        setSyncProgressMap(prev => ({
          ...prev,
          [sub.id]: { status: 'Compiling questions & options...', percent: 60 }
        }));

        const downloaded = await downloadSubjectPack(sub.id, sub.name);

        setSyncProgressMap(prev => ({
          ...prev,
          [sub.id]: { status: 'Saved to IndexedDB', percent: 100 }
        }));

        onPacksUpdated();
        toast.success(`Saved ${downloaded.questionsCount} questions for ${sub.name} (${formatBytes(calculatePackSize(downloaded))})`);

        setTimeout(() => {
          setSyncProgressMap(prev => {
            const next = { ...prev };
            delete next[sub.id];
            return next;
          });
        }, 1200);
      } catch (err: any) {
        toast.error(`Download failed: ${err.message}`);
        setSyncProgressMap(prev => {
          const next = { ...prev };
          delete next[sub.id];
          return next;
        });
      }
    } else {
      // Toggle OFF: Delete pack
      const targetId = pack?.subjectId || sub.id;
      deleteOfflinePack(targetId);
      onPacksUpdated();
      toast.info(`Removed offline pack for ${sub.name}`);
    }
  };

  // Batch toggle: Enable all registered 4 UTME subjects
  const handleEnableRegisteredSubjects = async () => {
    if (isOffline) {
      toast.error('Connect to internet to download your 4 registered subjects.');
      return;
    }

    setIsBatchOperating(true);
    toast.info('Downloading question packs for your 4 registered UTME subjects...');

    for (const subName of registeredSubjectNames) {
      const matched = subjects.find(s => normalizeSubjectName(s.name).toLowerCase().trim() === subName);
      if (matched) {
        setSyncProgressMap(prev => ({
          ...prev,
          [matched.id]: { status: 'Downloading...', percent: 50 }
        }));
        try {
          await downloadSubjectPack(matched.id, matched.name);
          setSyncProgressMap(prev => ({
            ...prev,
            [matched.id]: { status: 'Done', percent: 100 }
          }));
        } catch (_) {}
      }
    }

    onPacksUpdated();
    setIsBatchOperating(false);
    setSyncProgressMap({});
    toast.success('Your 4 registered UTME subjects are ready for 100% offline practice!');
  };

  // Refresh All Stale Packs
  const handleRefreshAllStale = async () => {
    if (isOffline) {
      toast.error('Connect to internet to refresh stale question packs.');
      return;
    }

    const staleList = subjects.filter(sub => {
      const pack = getSubjectPack(sub);
      return pack && isPackStale(pack);
    });

    if (staleList.length === 0) {
      toast.info('No stale packs detected. All downloaded packs are within the 14-day freshness window.');
      return;
    }

    setIsBatchOperating(true);
    toast.info(`Refreshing ${staleList.length} stale pack(s) from Cloud question bank...`);

    let count = 0;
    for (const sub of staleList) {
      setSyncProgressMap(prev => ({
        ...prev,
        [sub.id]: { status: 'Refreshing...', percent: 50 }
      }));
      try {
        await downloadSubjectPack(sub.id, sub.name);
        count++;
        setSyncProgressMap(prev => ({
          ...prev,
          [sub.id]: { status: 'Refreshed', percent: 100 }
        }));
      } catch (e) {
        console.warn(`Failed refreshing ${sub.name}:`, e);
      }
    }

    onPacksUpdated();
    setIsBatchOperating(false);
    setSyncProgressMap({});
    toast.success(`Successfully refreshed ${count} stale pack(s) to latest Cloud question state!`);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 14-Day Stale Packs Prompt Banner */}
      {stalePacksCount > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="font-bold text-sm block text-amber-900 dark:text-amber-100">
                {stalePacksCount} Question Pack{stalePacksCount > 1 ? 's are' : ' is'} Outdated (&gt;14 Days Old)
              </span>
              <p className="text-amber-800 dark:text-amber-300 text-xs mt-0.5 leading-relaxed max-w-2xl">
                Question banks were downloaded more than {STALE_PACK_DAYS_THRESHOLD} days ago. Past question explanations and syllabus additions may have been updated in the Cloud. Refreshing will ensure your offline practice is completely current.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <Button
              size="sm"
              onClick={handleRefreshAllStale}
              disabled={isOffline || isBatchOperating}
              className="font-bold text-xs bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto gap-1.5 shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBatchOperating ? 'animate-spin' : ''}`} />
              <span>Refresh {stalePacksCount} Stale Pack{stalePacksCount > 1 ? 's' : ''}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Header Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search subjects by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <Button
            size="sm"
            onClick={handleEnableRegisteredSubjects}
            disabled={isOffline || isBatchOperating}
            className="h-9 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-xs"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Enable My 4 UTME Subjects</span>
          </Button>

          {selectedCategory !== 'all' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedCategory('all')}
              className="h-9 text-xs font-bold"
            >
              Reset Filter
            </Button>
          )}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'All Subjects' },
          { id: 'registered', label: 'My Registered 4' },
          { id: 'downloaded', label: 'Downloaded' },
          ...(stalePacksCount > 0 ? [{ id: 'stale', label: `Stale (${stalePacksCount}) ⚠️` }] : []),
          { id: 'has_update', label: 'Updates Ready' },
          { id: 'compulsory', label: 'Compulsory' },
          { id: 'sciences', label: 'Sciences' },
          { id: 'commercial', label: 'Commercial' },
          { id: 'arts', label: 'Arts' },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-primary text-primary-foreground shadow-xs'
                : cat.id === 'stale'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Granular Subjects List with Switch Components */}
      {filteredSubjects.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <HardDrive className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
          <h4 className="font-bold text-foreground text-sm">No subjects found</h4>
          <p className="text-xs text-muted-foreground mt-1">Try clearing your search query or switching filters.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredSubjects.map((sub) => {
            const pack = getSubjectPack(sub);
            const isEnabled = Boolean(pack && (pack.questionsCount || 0) > 0);
            const hasUpdate = Boolean(pack?.hasUpdate);
            const progress = syncProgressMap[sub.id];
            const isSyncingThis = Boolean(progress);

            const cloudCount = 
              cloudSubjectCounts[sub.id] || 
              cloudSubjectCounts[sub.name] || 
              cloudSubjectCounts[normalizeSubjectName(sub.name)] || 
              cloudSubjectCounts[normalizeSubjectName(sub.name).toLowerCase()] || 
              0;
            const hasMoreCloudQuestions = isEnabled && cloudCount > 0 && (pack?.questionsCount || 0) < cloudCount;
            const effectiveHasUpdate = Boolean((pack?.hasUpdate && (pack?.questionsCount || 0) < cloudCount) || hasMoreCloudQuestions);

            // Compute Staleness (>14 days threshold)
            const staleness = getPackStaleness(pack, STALE_PACK_DAYS_THRESHOLD);
            const isStale = isEnabled && staleness.isStale;

            // Compute file size
            const packSizeBytes = isEnabled && pack ? calculatePackSize(pack) : 0;
            const fileSizeDisplay = isEnabled 
              ? formatBytes(packSizeBytes)
              : '~1.2 MB est.';

            return (
              <Card 
                key={sub.id}
                className={`border transition-all ${
                  isSyncingThis ? 'border-primary/60 bg-primary/5 shadow-md' :
                  isStale ? 'border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/30' :
                  effectiveHasUpdate ? 'border-amber-500/50 bg-amber-500/5 ring-1 ring-amber-500/20' :
                  isEnabled ? 'border-emerald-500/40 bg-emerald-500/5' :
                  'border-border bg-card hover:border-border/80'
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-foreground truncate">{sub.name}</span>
                        {isEnabled && !effectiveHasUpdate && !isStale && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                        {isStale && (
                          <span 
                            className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 uppercase shrink-0 flex items-center gap-1"
                            title={`Downloaded ${staleness.daysAgo} days ago. Refreshing is recommended after 14 days.`}
                          >
                            <Clock className="w-3 h-3 text-amber-500" /> Stale ({staleness.daysAgo}d old)
                          </span>
                        )}
                        {effectiveHasUpdate && !isStale && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-slate-950 uppercase shrink-0 animate-pulse">
                            {hasMoreCloudQuestions ? `+${cloudCount - (pack?.questionsCount || 0)} in Cloud` : 'Update'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span className="capitalize">{sub.category || 'General'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[11px] font-semibold text-foreground">
                          {fileSizeDisplay}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {isEnabled 
                            ? (cloudCount > 0 && cloudCount !== pack?.questionsCount 
                                ? `${pack?.questionsCount} / ${cloudCount} Qs stored` 
                                : `${pack?.questionsCount} Qs stored`)
                            : (cloudCount > 0 ? `${cloudCount} Qs available` : 'Not downloaded')}
                        </span>
                        {isEnabled && staleness.downloadedDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className={isStale ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                              {staleness.daysAgo === 0 ? 'Downloaded today' : `Downloaded ${staleness.daysAgo}d ago`}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Switch Component */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={isEnabled}
                        disabled={isSyncingThis || (!isEnabled && isOffline)}
                        onCheckedChange={(checked) => handleToggle(sub, checked)}
                        aria-label={`Toggle offline download for ${sub.name}`}
                      />
                    </div>
                  </div>

                  {/* Visual Sync Progress Indicator */}
                  {isSyncingThis && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-[11px] font-bold text-primary">
                        <span className="flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          {progress.status}
                        </span>
                        <span>{progress.percent}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-300 rounded-full"
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Quick Action Footer for Downloaded Subjects */}
                  {isEnabled && !isSyncingThis && (
                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs flex-wrap gap-2">
                      <div className="text-[11px] text-muted-foreground">
                        {isStale ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Pack &gt;14 days old. Tap Refresh for latest questions.
                          </span>
                        ) : effectiveHasUpdate ? (
                          <span className="text-amber-500 font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> New questions in cloud
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Pack is fresh & ready offline
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        {(isStale || effectiveHasUpdate) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggle(sub, true)}
                            disabled={isOffline}
                            className={`h-7 text-[11px] font-bold gap-1 ${
                              isStale
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20'
                            }`}
                          >
                            <RefreshCw className="w-3 h-3" /> {isStale ? 'Refresh Pack' : 'Update'}
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/practice?mode=subject&subjectId=${sub.id}`)}
                          className="h-7 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1 px-2"
                        >
                          <PlayCircle className="w-3.5 h-3.5" /> Practice
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
