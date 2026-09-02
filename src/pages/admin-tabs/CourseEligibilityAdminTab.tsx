import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { GraduationCap, Plus, Trash2, Edit2, Save, RefreshCw, Building2 } from 'lucide-react';
import { fetchCourseEligibilityData, saveCourseEligibilityData, type CourseEligibilityItem, type UniversityCutoff } from '@/services/courseEligibilityService';
import { useConfirm } from '@/hooks/useConfirm';

export function CourseEligibilityAdminTab() {
  const [courses, setCourses] = useState<CourseEligibilityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [courseName, setCourseName] = useState('');
  const [category, setCategory] = useState('');
  const [jambSubjectsStr, setJambSubjectsStr] = useState('');
  const [olevelCreditsStr, setOlevelCreditsStr] = useState('');
  const [advice, setAdvice] = useState('');
  const [universities, setUniversities] = useState<UniversityCutoff[]>([
    { name: '', cutoff: 200 }
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCourseEligibilityData();
      setCourses(data);
    } catch (err: any) {
      toast.error('Failed to load course eligibility data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveAll = async (updated: CourseEligibilityItem[]) => {
    setSaving(true);
    try {
      const res = await saveCourseEligibilityData(updated);
      if (res.success) {
        setCourses(updated);
        toast.success('Course eligibility database updated successfully in admin_settings.');
      } else {
        toast.error('Failed to update: ' + res.error);
      }
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingIndex(null);
    setCourseName('');
    setCategory('Medical & Health Sciences');
    setJambSubjectsStr('');
    setOlevelCreditsStr('');
    setAdvice('');
    setUniversities([{ name: 'University of Lagos (UNILAG)', cutoff: 250 }]);
    setIsFormOpen(true);
  };

  const handleStartEdit = (idx: number) => {
    const item = courses[idx];
    setEditingIndex(idx);
    setCourseName(item.course);
    setCategory(item.category);
    setJambSubjectsStr(item.jambSubjects.join(', '));
    setOlevelCreditsStr(item.olevelCredits.join(', '));
    setAdvice(item.advice);
    setUniversities(item.universities && item.universities.length > 0 ? item.universities : [{ name: '', cutoff: 200 }]);
    setIsFormOpen(true);
  };

  const handleAddUniversityRow = () => {
    setUniversities([...universities, { name: '', cutoff: 200 }]);
  };

  const handleRemoveUniversityRow = (uIdx: number) => {
    setUniversities(universities.filter((_, i) => i !== uIdx));
  };

  const handleUniversityChange = (uIdx: number, field: 'name' | 'cutoff', val: any) => {
    const next = [...universities];
    next[uIdx] = { ...next[uIdx], [field]: field === 'cutoff' ? Number(val) : val };
    setUniversities(next);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim() || !category.trim() || !jambSubjectsStr.trim()) {
      toast.error('Course name, category, and JAMB subjects are required.');
      return;
    }

    const jambSubList = jambSubjectsStr.split(',').map(s => s.trim()).filter(Boolean);
    const olevelList = olevelCreditsStr.split(',').map(s => s.trim()).filter(Boolean);
    const validUnis = universities.filter(u => u.name.trim().length > 0);

    const newItem: CourseEligibilityItem = {
      course: courseName.trim(),
      category: category.trim(),
      jambSubjects: jambSubList,
      olevelCredits: olevelList,
      universities: validUnis,
      advice: advice.trim()
    };

    let updated: CourseEligibilityItem[];
    if (editingIndex !== null) {
      updated = courses.map((c, i) => i === editingIndex ? newItem : c);
    } else {
      updated = [...courses, newItem];
    }

    handleSaveAll(updated);
    setIsFormOpen(false);
  };

  const handleDeleteCourse = (idx: number) => {
    confirmAction('Delete Course Requirement', 'Are you sure you want to delete this course eligibility record?', () => {
      const updated = courses.filter((_, i) => i !== idx);
      handleSaveAll(updated);
    }, { destructive: true });
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-primary" /> Loading Course Eligibility Database...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <GraduationCap className="w-5 h-5 text-primary" /> Course Eligibility & Cutoff Manager
          </h2>
          <p className="text-xs text-muted-foreground">
            Configure institutional cutoff benchmarks, JAMB subject combinations, and O'Level prerequisites for candidate eligibility checks.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading || saving}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={handleOpenCreate} className="font-semibold text-xs">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Course Requirement
          </Button>
        </div>
      </div>

      {isFormOpen && (
        <Card className="bg-card border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">
              {editingIndex !== null ? 'Edit Course Eligibility Record' : 'Add New Course Eligibility Record'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Course Name</label>
                  <Input
                    placeholder="e.g. Architecture"
                    value={courseName}
                    onChange={e => setCourseName(e.target.value)}
                    className="bg-background text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Faculty / Category</label>
                  <Input
                    placeholder="e.g. Environmental Sciences"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="bg-background text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">JAMB Subjects (comma-separated)</label>
                <Input
                  placeholder="e.g. Use of English, Mathematics, Physics, Chemistry or Technical Drawing"
                  value={jambSubjectsStr}
                  onChange={e => setJambSubjectsStr(e.target.value)}
                  className="bg-background text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">O'Level Credits (comma-separated)</label>
                <Input
                  placeholder="e.g. English Language, Mathematics, Physics, Chemistry, Technical Drawing or Geography"
                  value={olevelCreditsStr}
                  onChange={e => setOlevelCreditsStr(e.target.value)}
                  className="bg-background text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Accredited Universities & Cutoffs</label>
                  <Button type="button" size="sm" variant="outline" className="h-6 text-[10px]" onClick={handleAddUniversityRow}>
                    <Plus className="w-3 h-3 mr-1" /> Add University
                  </Button>
                </div>
                {universities.map((u, uIdx) => (
                  <div key={uIdx} className="flex gap-2 items-center">
                    <Input
                      placeholder="University Name (e.g. UNILAG)"
                      value={u.name}
                      onChange={e => handleUniversityChange(uIdx, 'name', e.target.value)}
                      className="bg-background text-xs flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Cutoff (e.g. 260)"
                      value={u.cutoff}
                      onChange={e => handleUniversityChange(uIdx, 'cutoff', e.target.value)}
                      className="bg-background text-xs w-24"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 text-red-500 hover:text-red-600 hover:bg-red-500/10 p-1"
                      onClick={() => handleRemoveUniversityRow(uIdx)}
                      disabled={universities.length <= 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Academic Advice & Notes</label>
                <textarea
                  placeholder="e.g. Highly competitive. Mathematics and Physics are mandatory in JAMB."
                  value={advice}
                  onChange={e => setAdvice(e.target.value)}
                  className="w-full h-20 bg-background border border-border rounded-md p-2.5 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={saving} className="font-semibold">
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Save Record
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Course List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map((item, idx) => (
          <Card key={item.course} className="bg-card border-border">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/50">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">{item.course}</CardTitle>
                <CardDescription className="text-xs text-primary font-medium">{item.category}</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleStartEdit(idx)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteCourse(idx)}
                  className="p-1.5 text-red-500 hover:text-red-600 rounded hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <div>
                <span className="font-bold text-foreground">JAMB Subjects: </span>
                <span className="text-muted-foreground">{item.jambSubjects.join(', ')}</span>
              </div>
              <div>
                <span className="font-bold text-foreground">O'Level: </span>
                <span className="text-muted-foreground">{item.olevelCredits.join(', ')}</span>
              </div>
              {item.universities && item.universities.length > 0 && (
                <div className="pt-1">
                  <span className="font-bold text-foreground block mb-1">University Cutoffs:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.universities.map(u => (
                      <span key={u.name} className="px-2 py-0.5 rounded bg-muted text-[10px] font-medium text-foreground flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5 text-primary" /> {u.name}: <strong className="text-amber-500">{u.cutoff}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {item.advice && (
                <p className="text-[11px] text-muted-foreground italic pt-1 border-t border-border/40">
                  {item.advice}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
