import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Timer, BookOpen, Target, Sparkles, Layers, 
  Users, Zap, BookMarked, Compass, HardDrive, 
  Calendar, ChevronRight, Swords, GraduationCap, Download
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface HubModuleItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'exams' | 'revision' | 'tools';
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
  color: string;
  bg: string;
  border: string;
  path: string;
}

const HUB_MODULES: HubModuleItem[] = [
  // ─── 1. CORE CBT EXAMS ──────────────────────────────────────────────────────
  {
    id: 'cbt_exam',
    title: 'Full UTME Mock Exam',
    subtitle: '180 Questions • 2 Hours • 400 Marks • Exact real exam experience',
    category: 'exams',
    icon: Timer,
    badge: 'Real JAMB Exam',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'hover:border-emerald-500/40',
    path: '/cbt'
  },
  {
    id: 'practice_setup',
    title: 'Practice by Subject',
    subtitle: 'Solve past exam questions with instant step-by-step solutions',
    category: 'exams',
    icon: BookOpen,
    badge: 'By Subject',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    border: 'hover:border-blue-500/40',
    path: '/practice'
  },
  {
    id: 'topic_drill',
    title: 'Study by Topic',
    subtitle: 'Master difficult topics like Calculus, Organic Chem, or Concord',
    category: 'exams',
    icon: Target,
    badge: 'Topic Mastery',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    border: 'hover:border-purple-500/40',
    path: '/practice?mode=topic'
  },
  {
    id: 'speed_drill',
    title: 'Speed & Reflex Drill',
    subtitle: 'Rapid 30-second question sprints to master exam time pressure',
    category: 'exams',
    icon: Zap,
    badge: 'Time Sprint',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'hover:border-amber-500/40',
    path: '/practice?mode=speed'
  },

  // ─── 2. REVISION & SYLLABUS ────────────────────────────────────────────────
  {
    id: 'jamb_novel',
    title: 'JAMB Novel Hub',
    subtitle: 'Chapter summaries, character analysis & test questions for The Life Changer',
    category: 'revision',
    icon: BookMarked,
    badge: 'Official Novel',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    border: 'hover:border-indigo-500/40',
    path: '/novel-hub'
  },
  {
    id: 'weakness_drill',
    title: 'AI Weakness Clinic',
    subtitle: 'Pinpoint weak topics where you lost marks and fix them',
    category: 'revision',
    icon: Sparkles,
    badge: 'Smart Diagnostic',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'hover:border-rose-500/40',
    path: '/weakness'
  },
  {
    id: 'flashcards',
    title: 'Flashcards & Memory Cards',
    subtitle: 'Fast formula recall, historical dates, and vocabulary cards',
    category: 'revision',
    icon: Layers,
    badge: 'Active Recall',
    badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    color: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    border: 'hover:border-cyan-500/40',
    path: '/flashcards'
  },
  {
    id: 'study_plan',
    title: 'Study Planner & Timetable',
    subtitle: 'Daily target scheduler and complete JAMB syllabus checklist',
    category: 'revision',
    icon: Calendar,
    badge: 'Timetable',
    badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    border: 'hover:border-orange-500/40',
    path: '/plan'
  },

  // ─── 3. TOOLS & COMMUNITY ──────────────────────────────────────────────────
  {
    id: 'offline_packs',
    title: 'Offline Exam Packs',
    subtitle: 'Download past question packs to practice with zero internet data',
    category: 'tools',
    icon: Download,
    badge: 'Zero Data',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'hover:border-emerald-500/40',
    path: '/offline-packs'
  },
  {
    id: 'study_rooms',
    title: 'Peer Study Rooms',
    subtitle: 'Study in real-time alongside other UTME aspirants across Nigeria',
    category: 'tools',
    icon: Users,
    badge: 'Live Rooms',
    badgeColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
    color: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/10 dark:bg-violet-500/15',
    border: 'hover:border-violet-500/40',
    path: '/study-rooms'
  },
  {
    id: 'eligibility',
    title: 'Course & University Checker',
    subtitle: 'Check if your O\'Level & JAMB subjects qualify for your university course',
    category: 'tools',
    icon: GraduationCap,
    badge: 'Admissions',
    badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    color: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-500/10 dark:bg-teal-500/15',
    border: 'hover:border-teal-500/40',
    path: '/eligibility-checker'
  },
  {
    id: 'tournaments',
    title: 'Student Battle Arena',
    subtitle: 'Compete in head-to-head live UTME question battles with friends',
    category: 'tools',
    icon: Swords,
    badge: 'PvP Battles',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'hover:border-rose-500/40',
    path: '/tournaments'
  }
];

export const CbtHubGrid: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'exams' | 'revision' | 'tools'>('all');

  const filteredModules = selectedCategory === 'all'
    ? HUB_MODULES
    : HUB_MODULES.filter(m => m.category === selectedCategory);

  return (
    <div className="space-y-3.5">
      {/* Section Header & Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span>Practice & Exam Center</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose any exam simulation, revision tool, or study resource to begin.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {[
            { id: 'all', label: 'All Modules' },
            { id: 'exams', label: 'CBT Mocks' },
            { id: 'revision', label: 'Revision & Novel' },
            { id: 'tools', label: 'Tools & Offline' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === tab.id
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredModules.map((item) => (
          <Link
            key={item.id}
            to={item.path}
            className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
          >
            <Card className={`h-full border border-border/80 bg-card hover:bg-card/90 transition-all duration-200 shadow-xs hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] ${item.border}`}>
              <CardContent className="p-4 flex flex-col h-full justify-between gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor} whitespace-nowrap`}>
                      {item.badge}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
                    {item.subtitle}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs font-bold text-primary/80 group-hover:text-primary transition-colors border-t border-border/40">
                  <span>Open Module</span>
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
