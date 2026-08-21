import { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw, Trash2, 
  BookOpen, Link2, Play, Pause, FileQuestion, ArrowRight, ShieldCheck, Filter
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { logAdminActivity } from '@/services/adminActivityService';
import { toast } from 'sonner';

export interface OrphanItem {
  id: string;
  type: 'question' | 'literature';
  title: string;
  invalid_subject_id: string | null;
  created_at?: string;
  raw_data?: any;
}

export function OrphanedEntriesScanner() {
  const [scanning, setScanning] = useState(false);
  const [cronActive, setCronActive] = useState(true);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [orphans, setOrphans] = useState<OrphanItem[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedOrphanIds, setSelectedOrphanIds] = useState<string[]>([]);
  const [repairing, setRepairing] = useState(false);

  // Fetch subjects list for verification & repair assignment
  const fetchSubjects = useCallback(async () => {
    try {
      const { data } = await supabase.from('subjects').select('id, name').order('name');
      if (data && data.length > 0) {
        setSubjects(data);
        if (!selectedSubjectId) setSelectedSubjectId(data[0].id);
      }
    } catch (e) {
      console.warn('Failed to fetch subjects for orphan repair:', e);
    }
  }, [selectedSubjectId]);

  // Main Orphan Scanner Algorithm
  const runOrphanScan = useCallback(async (silent = false) => {
    setScanning(true);
    try {
      // 1. Get all valid subject IDs
      const { data: subData } = await supabase.from('subjects').select('id, name');
      const validSubjectIds = new Set((subData || []).map(s => s.id));
      if (subData && subData.length > 0) setSubjects(subData);

      const foundOrphans: OrphanItem[] = [];

      // 2. Scan Question Bank
      const { data: allQuestions } = await supabase
        .from('questions')
        .select('id, question_text, subject_id, created_at')
        .limit(500);

      if (allQuestions) {
        for (const q of allQuestions) {
          if (!q.subject_id || !validSubjectIds.has(q.subject_id)) {
            foundOrphans.push({
              id: q.id,
              type: 'question',
              title: q.question_text?.replace(/<[^>]*>/g, '').substring(0, 75) || 'Untitled Question',
              invalid_subject_id: q.subject_id || 'NULL_OR_MISSING',
              created_at: q.created_at,
              raw_data: q
            });
          }
        }
      }

      // 3. Scan Literature / Novel Bank questions or books
      try {
        const { data: litBooks } = await supabase
          .from('literature_books')
          .select('id, title, subject_id, category, created_at')
          .limit(100);

        if (litBooks) {
          for (const b of litBooks) {
            if (!b.subject_id || !validSubjectIds.has(b.subject_id)) {
              foundOrphans.push({
                id: b.id,
                type: 'literature',
                title: `[Book] ${b.title || 'Untitled Literary Entry'}`,
                invalid_subject_id: b.subject_id || 'MISSING_SUBJECT_LINK',
                created_at: b.created_at,
                raw_data: b
              });
            }
          }
        }
      } catch {
        // literature_books table may be handled in JSON or state
      }

      setOrphans(foundOrphans);
      setLastScanTime(new Date().toLocaleTimeString());

      if (!silent) {
        if (foundOrphans.length > 0) {
          toast.warning(`Scanner identified ${foundOrphans.length} orphaned entries without valid subjects.`);
        } else {
          toast.success('Database Audit Complete: No orphaned entries detected!');
        }
      }
    } catch (e) {
      console.error('Orphan scanner error:', e);
      if (!silent) toast.error('Orphan scanner encountered an error.');
    } finally {
      setScanning(false);
    }
  }, []);

  // Initialize and run periodic Cron task
  useEffect(() => {
    fetchSubjects();
    runOrphanScan(true);

    let cronInterval: any = null;
    if (cronActive) {
      // Background Cron task running every 2 minutes (120,000ms)
      cronInterval = setInterval(() => {
        runOrphanScan(true);
      }, 120000);
    }

    return () => {
      if (cronInterval) clearInterval(cronInterval);
    };
  }, [cronActive, fetchSubjects, runOrphanScan]);

  const handleSelectAll = () => {
    if (selectedOrphanIds.length === orphans.length) {
      setSelectedOrphanIds([]);
    } else {
      setSelectedOrphanIds(orphans.map(o => o.id));
    }
  };

  const toggleSelectOrphan = (id: string) => {
    setSelectedOrphanIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Re-assign selected orphans to valid subject
  const handleBatchRepair = async () => {
    if (!selectedSubjectId) {
      toast.error('Please select a target subject to link orphaned entries.');
      return;
    }
    const idsToRepair = selectedOrphanIds.length > 0 ? selectedOrphanIds : orphans.map(o => o.id);
    if (idsToRepair.length === 0) return;

    setRepairing(true);
    try {
      const qIds = orphans.filter(o => o.type === 'question' && idsToRepair.includes(o.id)).map(o => o.id);
      const litIds = orphans.filter(o => o.type === 'literature' && idsToRepair.includes(o.id)).map(o => o.id);

      if (qIds.length > 0) {
        await supabase.from('questions').update({ subject_id: selectedSubjectId }).in('id', qIds);
      }
      if (litIds.length > 0) {
        await supabase.from('literature_books').update({ subject_id: selectedSubjectId }).in('id', litIds);
      }

      logAdminActivity('REPAIR_ORPHANS', `Linked ${idsToRepair.length} orphaned entries to subject ID ${selectedSubjectId}`, 'orphan_scanner', { count: idsToRepair.length });
      toast.success(`Successfully repaired & linked ${idsToRepair.length} orphaned entries!`);
      
      setSelectedOrphanIds([]);
      await runOrphanScan(true);
    } catch (e) {
      console.error('Batch repair failed:', e);
      toast.error('Failed to repair orphaned entries.');
    } finally {
      setRepairing(false);
    }
  };

  // Batch delete selected orphans
  const handleBatchDelete = async () => {
    const idsToDelete = selectedOrphanIds.length > 0 ? selectedOrphanIds : orphans.map(o => o.id);
    if (idsToDelete.length === 0) return;

    if (!confirm(`Are you sure you want to permanently delete ${idsToDelete.length} orphaned entries?`)) return;

    setRepairing(true);
    try {
      const qIds = orphans.filter(o => o.type === 'question' && idsToDelete.includes(o.id)).map(o => o.id);
      const litIds = orphans.filter(o => o.type === 'literature' && idsToDelete.includes(o.id)).map(o => o.id);

      if (qIds.length > 0) {
        await supabase.from('questions').delete().in('id', qIds);
      }
      if (litIds.length > 0) {
        await supabase.from('literature_books').delete().in('id', litIds);
      }

      logAdminActivity('DELETE_ORPHANS', `Deleted ${idsToDelete.length} orphaned entries`, 'orphan_scanner', { count: idsToDelete.length });
      toast.success(`Deleted ${idsToDelete.length} orphaned records.`);
      
      setSelectedOrphanIds([]);
      await runOrphanScan(true);
    } catch (e) {
      console.error('Batch delete orphans failed:', e);
      toast.error('Failed to delete orphaned entries.');
    } finally {
      setRepairing(false);
    }
  };

  return (
    <Card className="bg-slate-900/60 backdrop-blur-md border-slate-800 text-slate-100 shadow-xl overflow-hidden">
      <CardHeader className="bg-slate-950/80 border-b border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-100">
            <ShieldAlert className="w-5 h-5 text-amber-400" /> Orphaned Entry Cleaner & Cron Audit
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">
            Detects and flags unlinked questions or literature entries missing valid Subject associations.
          </CardDescription>
        </div>

        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 cursor-pointer">
                <span className="text-xs font-semibold text-slate-300">Cron Daemon:</span>
                <button
                  type="button"
                  onClick={() => setCronActive(!cronActive)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${cronActive ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  aria-label="Toggle Automated Background Cron Audit"
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${cronActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                {cronActive ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                    <Play className="w-2.5 h-2.5 mr-1 fill-emerald-400" /> Active (2m)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-400 text-[10px]">
                    <Pause className="w-2.5 h-2.5 mr-1" /> Paused
                  </Badge>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Automated background daemon checks for unlinked database records every 2 minutes.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                onClick={() => runOrphanScan(false)} 
                disabled={scanning}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5 h-9 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
                {scanning ? 'Scanning...' : 'Run Audit'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Scan database immediately for questions or literary entries missing valid subject associations.
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Last Scan:</span>
            <span className="font-mono text-slate-200">{lastScanTime || 'Not run yet'}</span>
          </div>

          <div className="flex items-center gap-2">
            {orphans.length === 0 ? (
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 gap-1 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" /> 0 Orphans Flagged (Clean)
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 gap-1 text-xs font-bold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" /> {orphans.length} Orphaned Entry(ies) Detected
              </Badge>
            )}
          </div>
        </div>

        {/* Orphans Table / Action Panel */}
        {orphans.length > 0 && (
          <div className="space-y-3 pt-1">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-800/40 rounded-lg border border-slate-700/60">
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleSelectAll}
                  className="h-8 text-xs border-slate-700 text-slate-300"
                >
                  {selectedOrphanIds.length === orphans.length ? 'Deselect All' : `Select All (${orphans.length})`}
                </Button>
                {selectedOrphanIds.length > 0 && (
                  <span className="text-xs font-semibold text-amber-400">
                    {selectedOrphanIds.length} Selected
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Reassign To:</span>
                  <select 
                    value={selectedSubjectId} 
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-44 h-8 text-xs bg-slate-900 border border-slate-700 rounded-md text-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {subjects.map(sub => (
                      <option key={sub.id} value={sub.id} className="bg-slate-900 text-slate-200">
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm" 
                      onClick={handleBatchRepair}
                      disabled={repairing || selectedOrphanIds.length === 0}
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1"
                    >
                      <Link2 className="w-3.5 h-3.5" /> Re-link Subject
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Batch reassign all selected orphaned entries to the specified subject.
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={handleBatchDelete}
                      disabled={repairing || selectedOrphanIds.length === 0}
                      className="h-8 text-xs font-bold gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Bulk delete selected orphaned entries permanently from the database.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* List */}
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950">
              {orphans.map((item) => {
                const isSelected = selectedOrphanIds.includes(item.id);
                return (
                  <div 
                    key={item.id}
                    onClick={() => toggleSelectOrphan(item.id)}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => {}} 
                        className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 shrink-0"
                      />
                      <div className="shrink-0 p-1.5 rounded bg-slate-900 text-slate-400">
                        {item.type === 'question' ? <FileQuestion className="w-4 h-4 text-blue-400" /> : <BookOpen className="w-4 h-4 text-purple-400" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{item.title}</p>
                        <p className="text-[10px] text-red-400/90 font-mono flex items-center gap-1 mt-0.5">
                          <span>Unlinked Subject ID:</span>
                          <span className="bg-red-950/60 px-1.5 py-0.5 rounded border border-red-900/40">{item.invalid_subject_id}</span>
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-400 bg-amber-500/5">
                        {item.type.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
