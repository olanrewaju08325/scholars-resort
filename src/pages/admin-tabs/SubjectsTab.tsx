import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, BarChart, Plus, CheckCircle, XCircle, Sparkles, RefreshCw, 
  Trash2, Award, Calendar, Layers, Check, AlertCircle, ShieldCheck, GitMerge, Pencil
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ensureAllJambSubjectsInDatabase, normalizeSubjectName, unifyDatabaseSubjects } from '@/utils/subjectUtils';
import { useConfirm } from '@/hooks/useConfirm';

export const SubjectsTab = () => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [subjectStats, setSubjectStats] = useState<Array<{ id: string; name: string; count: number; percentage: number; is_official?: boolean; yearsCount?: number; yearsList?: string[] }>>([]);
  const [totalQuestionsInDb, setTotalQuestionsInDb] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectIcon, setNewSubjectIcon] = useState('');
  const [adding, setAdding] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Year Modal Config State
  const [yearModalOpen, setYearModalOpen] = useState(false);
  const [selectedSubjectForYear, setSelectedSubjectForYear] = useState<{ id: string; name: string } | null>(null);
  const [targetYearToApply, setTargetYearToApply] = useState('2025');
  const [applyingYear, setApplyingYear] = useState(false);

  // Merge Duplicate Subjects State
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [sourceSubjectId, setSourceSubjectId] = useState('');
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [merging, setMerging] = useState(false);

  // Edit/Rename Subject State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string; icon?: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [renaming, setRenaming] = useState(false);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      // Auto seed missing subjects and unify duplicates
      await ensureAllJambSubjectsInDatabase();
      await unifyDatabaseSubjects();

      const { data: subData } = await supabase.from('subjects').select('*').order('name');
      const loadedSubjects = subData || [];
      setSubjects(loadedSubjects);

      let countsMap: Record<string, number> = {};
      let yearsMap: Record<string, string[]> = {};
      let totalQs = 0;
      let usedServerCounts = false;

      // Try server-side counts first
      try {
        const response = await fetch('/api/admin/subject-counts');
        if (response.ok) {
          const resData = await response.json();
          if (resData.success && resData.counts) {
            countsMap = resData.counts;
            yearsMap = resData.years || {};
            totalQs = Object.values(countsMap).reduce((a, b) => a + b, 0);
            usedServerCounts = true;
            console.log('[SubjectsTab] Successfully fetched accurate server-side question counts!');
          }
        }
      } catch (apiErr) {
        console.warn('[SubjectsTab] Server-side counts API unavailable, falling back to client-side counting:', apiErr);
      }

      // Fallback: Fetch questions and calculate counts client-side (legacy code)
      if (!usedServerCounts) {
        // Fetch ALL dynamic questions without row caps (up to 50,000 records)
        const { data: qData, count: totalDbCount } = await supabase
          .from('questions')
          .select('id, subject_id, exam_year, subjects(id, name)', { count: 'exact' })
          .limit(50000);

        totalQs = totalDbCount || qData?.length || 0;

        loadedSubjects.forEach(s => {
          countsMap[s.id] = 0;
        });

        const tempYearsMap: Record<string, Set<string>> = {};
        loadedSubjects.forEach(s => {
          tempYearsMap[s.id] = new Set<string>();
        });

        if (qData) {
          qData.forEach((q: any) => {
            const rawSub = q.subjects?.name || q.subject_id;
            const canonical = normalizeSubjectName(rawSub || '');
            const exYear = q.exam_year || '';

            // Find matching subject by ID or canonical name
            const matchedSub = loadedSubjects.find(s => 
              s.id === q.subject_id || normalizeSubjectName(s.name) === canonical
            );

            if (matchedSub) {
              countsMap[matchedSub.id] = (countsMap[matchedSub.id] || 0) + 1;
              if (exYear) {
                if (!tempYearsMap[matchedSub.id]) tempYearsMap[matchedSub.id] = new Set<string>();
                tempYearsMap[matchedSub.id].add(String(exYear));
              }
            }
          });
        }

        // Convert sets to arrays
        Object.entries(tempYearsMap).forEach(([subId, set]) => {
          yearsMap[subId] = Array.from(set).sort().reverse();
        });
      }

      setTotalQuestionsInDb(totalQs);

      const stats = loadedSubjects.map((s: any) => {
        const count = countsMap[s.id] || 0;
        const percentage = totalQs > 0 ? Math.round((count / totalQs) * 100) : 0;
        const yearsArray = yearsMap[s.id] || [];
        return { 
          id: s.id, 
          name: s.name, 
          count, 
          percentage, 
          is_official: s.is_official ?? true,
          yearsCount: yearsArray.length,
          yearsList: yearsArray
        };
      });

      setSubjectStats(stats);
    } catch (err) {
      console.warn('Error loading subjects:', err);
    }
    setLoading(false);
  }, []);

  const handleSeedAllSubjects = async () => {
    setSeeding(true);
    try {
      await ensureAllJambSubjectsInDatabase();
      const res = await unifyDatabaseSubjects();
      if (res.updatedCount > 0) {
        toast.success(`Seeded JAMB subjects & standardized ${res.updatedCount} question records!`);
      } else {
        toast.success('Successfully seeded and verified all official UTME JAMB subjects!');
      }
      await fetchSubjects();
    } catch {
      toast.error('Failed to seed subjects.');
    }
    setSeeding(false);
  };

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName) return;
    setAdding(true);
    const { error } = await supabase.from('subjects').insert({
      name: newSubjectName,
      icon: newSubjectIcon || 'book',
      is_active: true,
      is_official: true
    });
    if (!error) {
      toast.success(`Subject "${newSubjectName}" added as an Official Offering!`);
      setNewSubjectName('');
      setNewSubjectIcon('');
      fetchSubjects();
    } else {
      toast.error('Failed to add subject.');
    }
    setAdding(false);
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('subjects').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      toast.success(`Subject ${!currentStatus ? 'activated' : 'deactivated'}.`);
      fetchSubjects();
    }
  };

  const toggleOfficial = async (id: string, currentIsOfficial: boolean, subjectName: string) => {
    const nextOfficial = !currentIsOfficial;
    const { error } = await supabase.from('subjects').update({ is_official: nextOfficial }).eq('id', id);
    if (!error) {
      toast.success(`"${subjectName}" is now ${nextOfficial ? 'marked as Official Platform Offering' : 'marked as Elective'}`);
      setSubjects(prev => prev.map(s => s.id === id ? { ...s, is_official: nextOfficial } : s));
      setSubjectStats(prev => prev.map(s => s.id === id ? { ...s, is_official: nextOfficial } : s));
    } else {
      toast.error('Failed to update official offering status');
    }
  };

  const handleDeleteSubject = (subjectId: string, subjectName: string, questionCount: number) => {
    confirmAction(
      "Confirm Subject Deletion",
      `Are you sure you want to permanently delete "${subjectName}"? ${
        questionCount > 0 
          ? `Warning: ${questionCount} questions are linked to this subject. Deleting this subject will un-assign those questions.`
          : 'This action cannot be undone.'
      }`,
      async () => {
        try {
          const { error } = await supabase.from('subjects').delete().eq('id', subjectId);
          if (error) throw error;

          toast.success(`Subject "${subjectName}" deleted successfully!`);
          fetchSubjects();
        } catch (err: any) {
          toast.error(`Failed to delete subject: ${err.message}`);
        }
      }
    );
  };

  const handleApplyYearToSubject = async () => {
    if (!selectedSubjectForYear || !targetYearToApply) return;
    setApplyingYear(true);
    try {
      // Find all matching question IDs for this subject
      const canonical = normalizeSubjectName(selectedSubjectForYear.name);
      const { data: qList } = await supabase
        .from('questions')
        .select('id, subject_id, subjects(id, name)')
        .limit(50000);

      const targetIds: string[] = [];
      if (qList) {
        qList.forEach((q: any) => {
          const rawSub = q.subjects?.name || q.subject_id;
          if (q.subject_id === selectedSubjectForYear.id || normalizeSubjectName(rawSub || '') === canonical) {
            targetIds.push(q.id);
          }
        });
      }

      if (targetIds.length === 0) {
        toast.info(`No questions found to update for ${selectedSubjectForYear.name}`);
        setYearModalOpen(false);
        setApplyingYear(false);
        return;
      }

      // Bulk update exam_year in chunks
      const chunkSize = 100;
      let updated = 0;
      for (let i = 0; i < targetIds.length; i += chunkSize) {
        const chunk = targetIds.slice(i, i + chunkSize);
        await supabase
          .from('questions')
          .update({ exam_year: targetYearToApply })
          .in('id', chunk);
        updated += chunk.length;
      }

      toast.success(`Successfully assigned Year ${targetYearToApply} to ${updated} questions in ${selectedSubjectForYear.name}!`);
      setYearModalOpen(false);
      fetchSubjects();
    } catch (err: any) {
      toast.error(`Failed to assign year: ${err.message}`);
    } finally {
      setApplyingYear(false);
    }
  };

  const handleMergeSubjects = async () => {
    if (!sourceSubjectId || !targetSubjectId) {
      toast.error('Please select both a source duplicate subject and a target primary subject.');
      return;
    }
    if (sourceSubjectId === targetSubjectId) {
      toast.error('Source subject and target subject cannot be the same.');
      return;
    }

    const sourceObj = subjects.find(s => s.id === sourceSubjectId);
    const targetObj = subjects.find(s => s.id === targetSubjectId);

    if (!sourceObj || !targetObj) return;

    confirmAction(
      "Confirm Subject Merge",
      `Are you sure you want to merge "${sourceObj.name}" into "${targetObj.name}"? All associated questions, topics, and study materials will be remapped to "${targetObj.name}", and "${sourceObj.name}" will be deleted.`,
      async () => {
        setMerging(true);
        try {
          // 1. Remap questions
          const sourceCanonical = normalizeSubjectName(sourceObj.name);
          const { data: qList } = await supabase
            .from('questions')
            .select('id, subject_id, subjects(id, name)')
            .limit(50000);

          const qToUpdate: string[] = [];
          if (qList) {
            qList.forEach((q: any) => {
              const rawSub = q.subjects?.name || q.subject_id;
              if (
                q.subject_id === sourceSubjectId || 
                normalizeSubjectName(rawSub || '') === sourceCanonical
              ) {
                qToUpdate.push(q.id);
              }
            });
          }

          if (qToUpdate.length > 0) {
            const chunkSize = 100;
            for (let i = 0; i < qToUpdate.length; i += chunkSize) {
              const chunk = qToUpdate.slice(i, i + chunkSize);
              await supabase
                .from('questions')
                .update({ 
                  subject_id: targetSubjectId
                })
                .in('id', chunk);
            }
          }

          // 2. Remap materials
          await supabase
            .from('materials')
            .update({ subject_id: targetSubjectId })
            .eq('subject_id', sourceSubjectId);

          // 3. Remap library_materials
          await supabase
            .from('library_materials')
            .update({ subject_id: targetSubjectId })
            .eq('subject_id', sourceSubjectId);

          // 4. Remap topics
          await supabase
            .from('topics')
            .update({ subject_id: targetSubjectId })
            .eq('subject_id', sourceSubjectId);

          // 5. Delete source duplicate subject
          await supabase.from('subjects').delete().eq('id', sourceSubjectId);

          toast.success(`Successfully merged "${sourceObj.name}" into "${targetObj.name}" and remapped ${qToUpdate.length} questions!`);
          setMergeModalOpen(false);
          setSourceSubjectId('');
          setTargetSubjectId('');
          fetchSubjects();
        } catch (err: any) {
          toast.error(`Merge failed: ${err.message}`);
        } finally {
          setMerging(false);
        }
      }
    );
  };

  const handleOpenEditModal = (sub: { id: string; name: string; icon?: string }) => {
    setEditingSubject(sub);
    setEditName(sub.name);
    setEditIcon(sub.icon || '');
    setEditModalOpen(true);
  };

  const handleSaveEditSubject = async () => {
    if (!editingSubject || !editName.trim()) return;
    setRenaming(true);
    try {
      const { error } = await supabase
        .from('subjects')
        .update({ name: editName.trim(), icon: editIcon.trim() || 'book' })
        .eq('id', editingSubject.id);

      if (error) throw error;

      toast.success(`Subject renamed to "${editName.trim()}"!`);
      setEditModalOpen(false);
      setEditingSubject(null);
      fetchSubjects();
    } catch (err: any) {
      toast.error(`Failed to update subject: ${err.message}`);
    } finally {
      setRenaming(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {ConfirmElement}

      {/* Merge Duplicate Subjects Modal */}
      {mergeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-2 text-purple-400">
              <GitMerge className="w-6 h-6" />
              <h3 className="text-lg font-bold">Merge Duplicate Subjects</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Consolidate duplicate subjects into a single primary ID. All associated questions, study materials, topics, and library resources will be automatically remapped to the target primary subject before deleting the duplicate.
            </p>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-red-400">1. Select Duplicate Subject to Merge & Remove:</label>
                <select
                  value={sourceSubjectId}
                  onChange={(e) => setSourceSubjectId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-xs text-slate-200 focus:ring-1 focus:ring-purple-500 outline-none"
                >
                  <option value="">-- Choose Duplicate Source Subject --</option>
                  {subjects.map(s => {
                    const st = subjectStats.find(x => x.id === s.id);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({st?.count || 0} Qs)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-emerald-400">2. Select Primary Target Subject (Kept):</label>
                <select
                  value={targetSubjectId}
                  onChange={(e) => setTargetSubjectId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-xs text-slate-200 focus:ring-1 focus:ring-purple-500 outline-none"
                >
                  <option value="">-- Choose Primary Target Subject --</option>
                  {subjects.map(s => {
                    const st = subjectStats.find(x => x.id === s.id);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({st?.count || 0} Qs) {s.is_official ? '★ Official' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setMergeModalOpen(false)}
                disabled={merging}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleMergeSubjects} 
                disabled={merging || !sourceSubjectId || !targetSubjectId || sourceSubjectId === targetSubjectId}
                className="bg-purple-600 hover:bg-purple-700 text-white gap-2 font-bold"
              >
                {merging ? <RefreshCw className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                Execute Merge & Remap
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subject Modal */}
      {editModalOpen && editingSubject && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-2 text-primary">
              <Pencil className="w-5 h-5" />
              <h3 className="text-lg font-bold">Edit Subject Details</h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Subject Display Name:</label>
                <Input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-sm"
                  placeholder="Subject Name"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Icon Key (Lucide icon):</label>
                <Input
                  type="text"
                  value={editIcon}
                  onChange={(e) => setEditIcon(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs font-mono"
                  placeholder="e.g. book, calculator, atom"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setEditModalOpen(false)}
                disabled={renaming}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSaveEditSubject} 
                disabled={renaming || !editName.trim()}
                className="gap-2 font-bold"
              >
                {renaming ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Set Exam Year Dialog */}
      {yearModalOpen && selectedSubjectForYear && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 text-slate-100 shadow-2xl">
            <div className="flex items-center gap-2 text-primary">
              <Calendar className="w-6 h-6" />
              <h3 className="text-lg font-bold">Configure Subject Exam Year</h3>
            </div>
            <p className="text-xs text-slate-400">
              Bulk assign an official UTME/JAMB Exam Year (e.g. 2025, 2024, 2023) to questions under <strong className="text-white">{selectedSubjectForYear.name}</strong>.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Target UTME Exam Year:</label>
              <Input
                type="text"
                placeholder="e.g. 2025"
                value={targetYearToApply}
                onChange={(e) => setTargetYearToApply(e.target.value)}
                className="bg-slate-950 border-slate-800 font-mono text-sm"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['2025', '2024', '2023', '2022', '2021', '2020'].map(yr => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setTargetYearToApply(yr)}
                    className={`px-2.5 py-1 text-xs rounded font-mono transition-colors border ${
                      targetYearToApply === yr 
                        ? 'bg-primary text-black border-primary font-bold' 
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setYearModalOpen(false)}
                disabled={applyingYear}
              >
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleApplyYearToSubject} 
                disabled={applyingYear || !targetYearToApply}
                className="gap-2 font-bold"
              >
                {applyingYear ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Assign Exam Year
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display text-slate-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" /> Official Platform Subjects & Question Mapping
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage official UTME offerings, eliminate orphan question counts, set exam years, and purge inactive subjects.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMergeModalOpen(true)}
            className="text-xs font-bold border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-1.5"
          >
            <GitMerge className="w-3.5 h-3.5" />
            Merge Duplicate Subjects
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSeedAllSubjects}
            disabled={seeding}
            className="text-xs font-bold border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
          >
            {seeding ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Sync & Seed Official UTME Subjects
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Subject List & Management */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="w-5 h-5 text-emerald-400" /> Platform Offerings ({subjects.length})
              </CardTitle>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                DB Total: {totalQuestionsInDb.toLocaleString()} Qs
              </span>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Add new subjects, set official offering status, or purge duplicate subject entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            <form onSubmit={handleAddSubject} className="flex gap-2">
              <Input 
                placeholder="New Subject Name (e.g. Further Mathematics)" 
                value={newSubjectName}
                onChange={e => setNewSubjectName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-xs flex-1"
                required
              />
              <Input 
                placeholder="Icon" 
                value={newSubjectIcon}
                onChange={e => setNewSubjectIcon(e.target.value)}
                className="bg-slate-950 border-slate-800 w-24 text-xs font-mono"
              />
              <Button type="submit" disabled={adding} size="sm" className="font-bold text-xs gap-1">
                <Plus className="w-4 h-4" /> Add
              </Button>
            </form>

            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2 divide-y divide-slate-800/40">
              {loading ? (
                <div className="text-center text-slate-500 py-8 text-xs font-mono">
                  Standardizing and loading database subjects...
                </div>
              ) : subjects.length === 0 ? (
                <div className="text-center text-slate-500 py-8 text-xs font-mono">No subjects found.</div>
              ) : subjects.map(s => {
                const stat = subjectStats.find(st => st.id === s.id);
                const qCount = stat?.count || 0;
                const isOfficial = s.is_official ?? true;

                return (
                  <div key={s.id} className="pt-2.5 pb-1.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleStatus(s.id, s.is_active)}
                        title={s.is_active ? 'Click to deactivate subject' : 'Click to activate subject'}
                      >
                        {s.is_active ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                      </button>

                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-slate-200 truncate">{s.name}</span>
                          {isOfficial && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5 shrink-0">
                              <Award className="w-3 h-3" /> OFFICIAL
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          {qCount.toLocaleString()} Qs {stat?.yearsList && stat.yearsList.length > 0 ? `• Years: ${stat.yearsList.slice(0, 3).join(', ')}${stat.yearsList.length > 3 ? '...' : ''}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Edit / Rename Subject Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                            onClick={() => handleOpenEditModal(s)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rename or edit subject icon</TooltipContent>
                      </Tooltip>

                      {/* Set Year Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 gap-1 font-mono"
                            onClick={() => {
                              setSelectedSubjectForYear({ id: s.id, name: s.name });
                              setYearModalOpen(true);
                            }}
                          >
                            <Calendar className="w-3.5 h-3.5 text-primary" /> Set Year
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Assign UTME exam year (e.g. 2025) to questions under {s.name}</TooltipContent>
                      </Tooltip>

                      {/* Toggle Official Offering Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className={`h-8 px-2 text-xs font-mono gap-1 ${
                              isOfficial ? 'text-amber-400 hover:bg-amber-500/10' : 'text-slate-500 hover:text-slate-200'
                            }`}
                            onClick={() => toggleOfficial(s.id, isOfficial, s.name)}
                          >
                            <Award className="w-3.5 h-3.5" />
                            {isOfficial ? 'Official' : 'Make Official'}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isOfficial ? 'Unmark as official platform subject' : 'Mark as official platform offering'}
                        </TooltipContent>
                      </Tooltip>

                      {/* Delete Subject Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                            onClick={() => handleDeleteSubject(s.id, s.name, qCount)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete this subject from database</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Question Counts & Distribution */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-sm flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart className="w-5 h-5 text-emerald-400" /> Complete Question Distribution ({totalQuestionsInDb.toLocaleString()} Qs)
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Exact live question counts and percentages calculated across all 2,696+ database records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center text-slate-500 py-12 text-xs font-mono">
                Calculating exact database question distribution...
              </div>
            ) : subjectStats.length === 0 ? (
              <div className="text-center text-slate-500 py-12 text-xs font-mono">
                No subjects or questions stored yet.
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-2">
                {subjectStats.map((stat, idx) => {
                  const colors = [
                    'bg-primary', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 
                    'bg-purple-500', 'bg-indigo-500', 'bg-rose-500', 'bg-cyan-500', 'bg-teal-500'
                  ];
                  const colorClass = colors[idx % colors.length];
                  return (
                    <div key={stat.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-200 flex items-center gap-1.5">
                          {stat.name}
                          {stat.is_official && <span className="text-[10px] text-amber-400 font-mono">★</span>}
                        </span>
                        <span className="text-primary font-mono">{stat.count.toLocaleString()} Qs ({stat.percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                        <div 
                          className={`${colorClass} h-full transition-all duration-500`} 
                          style={{ width: `${Math.max(stat.percentage, stat.count > 0 ? 1 : 0)}%` }} 
                        />
                      </div>
                      {stat.yearsList && stat.yearsList.length > 0 && (
                        <p className="text-[10px] text-slate-500 font-mono">
                          Recorded Exam Years: {stat.yearsList.join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
