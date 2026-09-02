import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Compass, Plus, Trash2, Edit2, Save, RefreshCw, Layers } from 'lucide-react';
import { fetchCareerGuideData, saveCareerGuideData, type CareerCategory, type CareerCourse } from '@/services/careerGuideService';
import { useConfirm } from '@/hooks/useConfirm';

export function CareerGuideAdminTab() {
  const [categories, setCategories] = useState<CareerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { confirmAction, ConfirmElement } = useConfirm();

  // Add category state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  // Add / Edit Course state
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState<number | null>(null);
  const [courseName, setCourseName] = useState('');
  const [subjectsStr, setSubjectsStr] = useState('');
  const [requirements, setRequirements] = useState('');
  const [editingCourseIndex, setEditingCourseIndex] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchCareerGuideData();
      setCategories(data);
    } catch (err: any) {
      toast.error('Failed to load career guide data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveAll = async (updated: CareerCategory[]) => {
    setSaving(true);
    try {
      const res = await saveCareerGuideData(updated);
      if (res.success) {
        setCategories(updated);
        toast.success('Career guide database updated successfully in admin_settings.');
      } else {
        toast.error('Failed to update: ' + res.error);
      }
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required.');
      return;
    }
    const updated = [...categories, { category: newCategoryName.trim(), courses: [] }];
    handleSaveAll(updated);
    setNewCategoryName('');
    setAddingCategory(false);
  };

  const handleDeleteCategory = (index: number) => {
    confirmAction('Delete Career Category', 'Are you sure you want to delete this category and all its courses?', () => {
      const updated = categories.filter((_, i) => i !== index);
      handleSaveAll(updated);
    }, { destructive: true });
  };

  const handleSaveCourse = () => {
    if (selectedCategoryIndex === null) return;
    if (!courseName.trim() || !subjectsStr.trim() || !requirements.trim()) {
      toast.error('Course name, subjects (comma-separated), and requirements are required.');
      return;
    }

    const subList = subjectsStr.split(',').map(s => s.trim()).filter(Boolean);
    const updatedCourse: CareerCourse = {
      name: courseName.trim(),
      subjects: subList,
      requirements: requirements.trim()
    };

    const updated = [...categories];
    const targetCat = { ...updated[selectedCategoryIndex] };

    if (editingCourseIndex !== null) {
      targetCat.courses = targetCat.courses.map((c, i) => i === editingCourseIndex ? updatedCourse : c);
    } else {
      targetCat.courses = [...targetCat.courses, updatedCourse];
    }

    updated[selectedCategoryIndex] = targetCat;
    handleSaveAll(updated);

    // Reset form
    setCourseName('');
    setSubjectsStr('');
    setRequirements('');
    setEditingCourseIndex(null);
    setSelectedCategoryIndex(null);
  };

  const handleDeleteCourse = (catIdx: number, courseIdx: number) => {
    confirmAction('Delete Course', 'Are you sure you want to delete this course from the category?', () => {
      const updated = [...categories];
      updated[catIdx] = {
        ...updated[catIdx],
        courses: updated[catIdx].courses.filter((_, i) => i !== courseIdx)
      };
      handleSaveAll(updated);
    }, { destructive: true });
  };

  const startEditCourse = (catIdx: number, courseIdx: number) => {
    const course = categories[catIdx].courses[courseIdx];
    setSelectedCategoryIndex(catIdx);
    setEditingCourseIndex(courseIdx);
    setCourseName(course.name);
    setSubjectsStr(course.subjects.join(', '));
    setRequirements(course.requirements);
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-primary" /> Loading Career Guide Database...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ConfirmElement}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Compass className="w-5 h-5 text-primary" /> Career Guide & Discipline Manager
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage official JAMB course prerequisites, UTME subject combinations, and O'Level requirements in admin_settings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading || saving}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setAddingCategory(true)} className="font-semibold text-xs">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Category
          </Button>
        </div>
      </div>

      {addingCategory && (
        <Card className="bg-card border-primary/40">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-bold">Add New Career Category</h3>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Environmental Sciences"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                className="bg-background text-sm"
              />
              <Button size="sm" onClick={handleAddCategory} disabled={saving}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingCategory(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCategoryIndex !== null && (
        <Card className="bg-card border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">
              {editingCourseIndex !== null ? 'Edit Course' : 'Add Course'} to "{categories[selectedCategoryIndex]?.category}"
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">Course Name</label>
                <Input
                  placeholder="e.g. Radiography"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  className="bg-background text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">UTME Subjects (comma-separated)</label>
                <Input
                  placeholder="e.g. English, Biology, Chemistry, Physics"
                  value={subjectsStr}
                  onChange={e => setSubjectsStr(e.target.value)}
                  className="bg-background text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">O'Level & General Requirements</label>
              <Input
                placeholder="e.g. 5 O'Level credits including Math, English, Bio, Chem & Phys in max 2 sittings"
                value={requirements}
                onChange={e => setRequirements(e.target.value)}
                className="bg-background text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => {
                setSelectedCategoryIndex(null);
                setEditingCourseIndex(null);
                setCourseName('');
                setSubjectsStr('');
                setRequirements('');
              }}>Cancel</Button>
              <Button size="sm" onClick={handleSaveCourse} disabled={saving} className="font-semibold">
                <Save className="w-3.5 h-3.5 mr-1.5" /> Save Course
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories List */}
      <div className="space-y-4">
        {categories.map((cat, catIdx) => (
          <Card key={cat.category} className="bg-card border-border">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between border-b border-border/50">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <Layers className="w-4 h-4 text-primary" /> {cat.category}
                </CardTitle>
                <CardDescription className="text-xs">
                  {cat.courses.length} accredited disciplines configured
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs font-medium"
                  onClick={() => {
                    setSelectedCategoryIndex(catIdx);
                    setEditingCourseIndex(null);
                    setCourseName('');
                    setSubjectsStr('');
                    setRequirements('');
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Course
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={() => handleDeleteCategory(catIdx)}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {cat.courses.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  No courses in this category yet. Click "Add Course" above.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cat.courses.map((crs, crsIdx) => (
                    <div key={crs.name} className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-xs text-foreground">{crs.name}</h4>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEditCourse(catIdx, crsIdx)}
                            className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(catIdx, crsIdx)}
                            className="p-1 text-red-500 hover:text-red-600 rounded hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <span className="font-bold text-foreground">UTME: </span>
                        {crs.subjects.join(', ')}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-snug">
                        <span className="font-bold text-foreground">O'Level: </span>
                        {crs.requirements}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
