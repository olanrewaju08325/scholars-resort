import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Timer, BookOpen, Target, Zap, BrainCircuit, BookMarked, 
  GraduationCap, Swords, Download, Layers, Users, Calendar,
  Sparkles, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface HubCardItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: string;
  color: string;
  bg: string;
  border: string;
  path: string;
}

const HUB_MODULES: HubCardItem[] = [
  {
    id: 'full_mock',
    title: 'Full UTME Mock',
    subtitle: '180 Questions • 2 Hours • Standard Exam',
    icon: Timer,
    badge: 'Standard CBT',
    badgeColor: 'bg-red-500/10 text-red-500 border-red-500/20',
    color: 'text-red-500',
    bg: 'bg-red-500/10 dark:bg-red-500/15',
    border: 'hover:border-red-500/40',
    path: '/cbt'
  },
  {
    id: 'subject_practice',
    title: 'Subject Practice',
    subtitle: 'Practice by subject with instant solutions',
    icon: BookOpen,
    badge: 'Past Qs',
    badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    border: 'hover:border-blue-500/40',
    path: '/practice?mode=subject'
  },
  {
    id: 'topic_drill',
    title: 'Topic Drill',
    subtitle: 'Master specific weak topics systematically',
    icon: Target,
    badge: 'Targeted',
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'hover:border-emerald-500/40',
    path: '/practice?mode=topic'
  },
  {
    id: 'speed_test',
    title: 'Speed Challenge',
    subtitle: '20 questions in 10 minutes • Build reflex',
    icon: Zap,
    badge: 'Timed',
    badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'hover:border-amber-500/40',
    path: '/practice?mode=speed'
  },
  {
    id: 'ai_tutor',
    title: 'AI Weakness Clinic',
    subtitle: 'AI diagnostics & step-by-step guidance',
    icon: BrainCircuit,
    badge: 'AI Smart',
    badgeColor: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10 dark:bg-purple-500/15',
    border: 'hover:border-purple-500/40',
    path: '/weakness'
  },
  {
    id: 'novel_hub',
    title: 'Literature & Books Hub',
    subtitle: 'Prescribed reading texts & chapter breakdowns',
    icon: BookMarked,
    badge: 'Prescribed Texts',
    badgeColor: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
    border: 'hover:border-indigo-500/40',
    path: '/novel-hub'
  },
  {
    id: 'tournaments',
    title: 'Tournaments & Arena',
    subtitle: 'Compete in live timed peer battles',
    icon: Swords,
    badge: 'Live PvP',
    badgeColor: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'hover:border-rose-500/40',
    path: '/tournaments'
  },
  {
    id: 'eligibility',
    title: 'Course Eligibility',
    subtitle: 'Check JAMB + O\'Level course requirements',
    icon: GraduationCap,
    badge: 'Admissions',
    badgeColor: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
    color: 'text-teal-500',
    bg: 'bg-teal-500/10 dark:bg-teal-500/15',
    border: 'hover:border-teal-500/40',
    path: '/eligibility-checker'
  },
  {
    id: 'flashcards',
    title: 'Flashcards & Memory',
    subtitle: 'Active recall cards for quick formula review',
    icon: Layers,
    badge: 'Recall',
    badgeColor: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    color: 'text-cyan-500',
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    border: 'hover:border-cyan-500/40',
    path: '/flashcards'
  },
  {
    id: 'study_rooms',
    title: 'Peer Study Rooms',
    subtitle: 'Study alongside other UTME aspirants',
    icon: Users,
    badge: 'Community',
    badgeColor: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10 dark:bg-violet-500/15',
    border: 'hover:border-violet-500/40',
    path: '/study-rooms'
  },
  {
    id: 'study_plan',
    title: 'Study Planner',
    subtitle: 'Daily target scheduler & syllabus checklist',
    icon: Calendar,
    badge: 'Planner',
    badgeColor: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    border: 'hover:border-orange-500/40',
    path: '/plan'
  },
  {
    id: 'offline_packs',
    title: 'Offline Packs',
    subtitle: 'Download exam packs for zero-data practice',
    icon: Download,
    badge: 'No Data',
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'hover:border-emerald-500/40',
    path: '/offline-packs'
  }
];

export const CbtHubGrid: React.FC = () => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" /> Practice & Exam Modules
        </h2>
        <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">
          Tap any card to begin instantly
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
        {HUB_MODULES.map((item) => (
          <Link
            key={item.id}
            to={item.path}
            className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
          >
            <Card className={`h-full border border-border/80 bg-card hover:bg-card/90 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${item.border}`}>
              <CardContent className="p-3 sm:p-4 flex flex-col h-full justify-between gap-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${item.bg} flex items-center justify-center shrink-0 transition-transform group-hover:scale-105`}>
                    <item.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${item.color}`} />
                  </div>
                  {item.badge && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${item.badgeColor} whitespace-nowrap`}>
                      {item.badge}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {item.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                    {item.subtitle}
                  </p>
                </div>

                <div className="pt-1 flex items-center justify-between text-[11px] font-semibold text-primary/80 group-hover:text-primary transition-colors border-t border-border/40">
                  <span>Start Module</span>
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
