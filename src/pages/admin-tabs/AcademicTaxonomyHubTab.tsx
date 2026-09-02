import { useState } from 'react';
import { BookOpen, Layers, Compass, GraduationCap } from 'lucide-react';
import { SubjectsTab } from './SubjectsTab';
import { SyllabusAdminTab } from './SyllabusAdminTab';
import { CareerGuideAdminTab } from './CareerGuideAdminTab';
import { CourseEligibilityAdminTab } from './CourseEligibilityAdminTab';

type SubView = 'taxonomy' | 'syllabus' | 'career' | 'eligibility';

export function AcademicTaxonomyHubTab() {
  const [activeTab, setActiveTab] = useState<SubView>('taxonomy');

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Sub-Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" /> Academic Taxonomy Hub
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure canonical UTME/JAMB subjects, topics, syllabus mappings, career prerequisites, and institutional cutoff benchmarks.
          </p>
        </div>

        {/* Sub-Tabs Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 rounded-xl border border-border">
          <button
            onClick={() => setActiveTab('taxonomy')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'taxonomy'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <BookOpen className="w-4 h-4" /> Subjects, Topics & Subtopics
          </button>
          <button
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

      {/* Render Active Sub-Module */}
      <div className="min-w-0 w-full">
        {activeTab === 'taxonomy' && <SubjectsTab />}
        {activeTab === 'syllabus' && <SyllabusAdminTab />}
        {activeTab === 'career' && <CareerGuideAdminTab />}
        {activeTab === 'eligibility' && <CourseEligibilityAdminTab />}
      </div>
    </div>
  );
}
