import { Card, CardContent } from '@/components/ui/card';
import { 
  PlayCircle, BrainCircuit, Library, History, Bookmark, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';

const ACTIONS = [
  { icon: PlayCircle, label: 'Quick Quiz', color: 'text-blue-500', bg: 'bg-blue-500/10', link: '/cbt' },
  { icon: BrainCircuit, label: 'AI Tutor', color: 'text-purple-500', bg: 'bg-purple-500/10', link: '/ai-tutor' },
  { icon: Library, label: 'Library', color: 'text-green-500', bg: 'bg-green-500/10', link: '/library' },
  { icon: TrendingUp, label: 'Analytics', color: 'text-orange-500', bg: 'bg-orange-500/10', link: '/analytics' },
  { icon: Bookmark, label: 'Saved', color: 'text-pink-500', bg: 'bg-pink-500/10', link: '/bookmarks' },
  { icon: History, label: 'History', color: 'text-slate-500', bg: 'bg-slate-500/10', link: '/history' },
];

export const QuickActions = () => {
  return (
    <div>
      <h2 className="text-xl font-bold font-display mb-4">Quick Actions</h2>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {ACTIONS.map((action, i) => (
          <Link key={i} to={action.link} className="group">
            <Card className="h-full bg-card hover:bg-accent border-border transition-all duration-200 hover:shadow-md hover:-translate-y-1">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <span className="text-xs font-semibold text-foreground/80 group-hover:text-foreground">{action.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};
