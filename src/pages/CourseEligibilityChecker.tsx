import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, GraduationCap, CheckCircle2, AlertTriangle, BookOpen, Building2, HelpCircle, Sparkles, RefreshCw } from 'lucide-react';
import { fetchCourseEligibilityData, type CourseEligibilityItem } from '@/services/courseEligibilityService';
import { useLiveFetch } from '@/hooks/useLiveFetch';

export const CourseEligibilityChecker = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<CourseEligibilityItem | null>(null);

  const { data: coursesData, loading } = useLiveFetch<CourseEligibilityItem[]>(
    async () => {
      return await fetchCourseEligibilityData();
    },
    { contextName: 'CourseEligibilityCheckerData', fallbackData: [] }
  );

  const courseList = coursesData && coursesData.length > 0 ? coursesData : [];

  useEffect(() => {
    if (courseList.length > 0 && !selectedCourse) {
      setSelectedCourse(courseList[0]);
    } else if (courseList.length > 0 && selectedCourse) {
      const match = courseList.find(c => c.course === selectedCourse.course);
      if (match) setSelectedCourse(match);
    }
  }, [courseList]);

  const filteredCourses = courseList.filter(c =>
    c.course.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeCourse = selectedCourse || courseList[0];

  if (loading && courseList.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
        <span>Loading course eligibility database...</span>
      </div>
    );
  }

  if (!activeCourse) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        No course requirements configured in the academic database.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-8 rounded-2xl bg-gradient-to-r from-emerald-900/40 via-teal-900/30 to-blue-900/20 border border-emerald-500/30 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 uppercase tracking-wider">
          <GraduationCap className="w-3.5 h-3.5" /> Official JAMB Brochure & Brochure Checker
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-display text-foreground">
          JAMB Course Eligibility & O'Level Combination Checker
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          Verify your required 4 JAMB subjects, WAEC/NECO O'Level credit requirements, and university cut-off marks to prevent UTME subject disqualification.
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Search & Course Selector */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3.5" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search course (e.g. Law, Medicine)..."
              className="pl-9 bg-card border-border"
            />
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {filteredCourses.map((item, idx) => (
              <Card
                key={idx}
                onClick={() => setSelectedCourse(item)}
                className={`cursor-pointer border transition-all ${
                  activeCourse.course === item.course
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500/30'
                    : 'border-border bg-card hover:border-emerald-500/40'
                }`}
              >
                <CardContent className="p-4">
                  <p className="text-xs font-extrabold text-emerald-500 uppercase tracking-wider">{item.category}</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">{item.course}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Requirements Detail Display */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card shadow-xl">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    {activeCourse.category}
                  </span>
                  <CardTitle className="text-2xl font-bold font-display text-foreground mt-1">
                    {activeCourse.course}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Mandatory 4 JAMB Subjects */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" /> Required 4 JAMB/UTME Subjects
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {activeCourse.jambSubjects.map((sub, i) => (
                    <div key={i} className="p-2.5 rounded-lg bg-card border border-border text-center font-bold text-xs text-foreground shadow-sm">
                      {sub}
                    </div>
                  ))}
                </div>
              </div>

              {/* O'Level WAEC/NECO Credit Requirements */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Required O'Level Credit Passes (5 Minimum)
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeCourse.olevelCredits.map((c, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs font-semibold text-foreground bg-card p-2 rounded-lg border border-border">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Target Universities & Historic Cut-Off Marks */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-500 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" /> Historical University UTME Cut-off Marks
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeCourse.universities.map((u, i) => (
                    <div key={i} className="p-3 rounded-xl bg-card border border-border flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground truncate">{u.name}</span>
                      <span className="px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 font-extrabold text-xs shrink-0">
                        {u.cutoff}+ UTME
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expert Brochure Advice */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs space-y-1">
                <p className="font-extrabold flex items-center gap-1.5 uppercase">
                  <AlertTriangle className="w-4 h-4" /> Official Brochure Warning & Advice:
                </p>
                <p className="leading-relaxed font-medium">{activeCourse.advice}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
