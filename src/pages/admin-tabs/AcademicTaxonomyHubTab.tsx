import { useState } from 'react';
import { BookOpen, Layers, Compass, GraduationCap, Scissors, Sparkles } from 'lucide-react';
import { SubjectsTab } from './SubjectsTab';
import { SyllabusAdminTab } from './SyllabusAdminTab';
import { CareerGuideAdminTab } from './CareerGuideAdminTab';
import { CourseEligibilityAdminTab } from './CourseEligibilityAdminTab';
import { VisualQuestionDiagramStudio } from '@/components/admin/VisualQuestionDiagramStudio';
import { AdminErrorBoundary } from '@/components/AdminErrorBoundary';

type SubView = 'taxonomy' | 'syllabus' | 'career' | 'eligibility' | 'pdf-extractor';

export function AcademicTaxonomyHubTab() {
  const [activeTab, setActiveTabState] = useState<SubView>(() => {
    if (typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem('scholar_academic_hub_tab');
      if (saved === 'taxonomy' || saved === 'syllabus' || saved === 'career' || saved === 'eligibility' || saved === 'pdf-extractor') {
        return saved as SubView;
      }
    }
    return 'pdf-extractor'; // Default directly to extractor as requested by user priority
  });

  const setActiveTab = (tab: SubView) => {
    setActiveTabState(tab);
    try {
      sessionStorage.setItem('scholar_academic_hub_tab', tab);
    } catch {}
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" /> Academic Taxonomy Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure canonical UTME/JAMB subjects, topics, syllabus mappings, career prerequisites, and extract topic-based diagrams & questions directly from past question books.
          </p>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('taxonomy')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'taxonomy'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Subjects & Topics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pdf-extractor')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'pdf-extractor'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            <Scissors className="w-4 h-4" /> Topic & Diagram Extractor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('syllabus')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'syllabus'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Layers className="w-4 h-4" /> Dynamic Syllabus
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('career')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'career'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Compass className="w-4 h-4" /> Career Guide DB
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('eligibility')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'eligibility'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <GraduationCap className="w-4 h-4" /> Course Eligibility DB
          </button>
        </div>
      </div>

      {/* Render Active Sub-Module with Granular Error Boundaries */}
      <div className="min-w-0 w-full">
        {activeTab === 'taxonomy' && (
          <AdminErrorBoundary fallbackTitle="Subjects & Topics Taxonomy" moduleKey="subjects-taxonomy">
            <SubjectsTab />
          </AdminErrorBoundary>
        )}
        {activeTab === 'pdf-extractor' && (
          <AdminErrorBoundary fallbackTitle="PDF Topic & Diagram Extractor" moduleKey="pdf-extractor">
            <VisualQuestionDiagramStudio />
          </AdminErrorBoundary>
        )}
        {activeTab === 'syllabus' && (
          <AdminErrorBoundary fallbackTitle="Dynamic Syllabus & Learning Rules" moduleKey="syllabus-admin">
            <SyllabusAdminTab />
          </AdminErrorBoundary>
        )}
        {activeTab === 'career' && (
          <AdminErrorBoundary fallbackTitle="Career Guide Database" moduleKey="career-guide">
            <CareerGuideAdminTab />
          </AdminErrorBoundary>
        )}
        {activeTab === 'eligibility' && (
          <AdminErrorBoundary fallbackTitle="Course Eligibility Database" moduleKey="course-eligibility">
            <CourseEligibilityAdminTab />
          </AdminErrorBoundary>
        )}
      </div>
    </div>
  );
}
