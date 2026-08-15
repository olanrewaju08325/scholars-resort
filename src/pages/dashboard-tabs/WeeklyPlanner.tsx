import { CalendarDays, BrainCircuit } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function WeeklyPlanner() {
  const weekDays = [
    { day: 'Mon', date: '12', status: 'completed', task: 'Physics Mocks' },
    { day: 'Tue', date: '13', status: 'completed', task: 'Chemistry Review' },
    { day: 'Wed', date: '14', status: 'today', task: 'Math Drills' },
    { day: 'Thu', date: '15', status: 'upcoming', task: 'English Comprehension' },
    { day: 'Fri', date: '16', status: 'upcoming', task: 'Full JAMB Mock' },
    { day: 'Sat', date: '17', status: 'upcoming', task: 'Review Weaknesses' },
    { day: 'Sun', date: '18', status: 'upcoming', task: 'Rest Day' },
  ];

  return (
    <Card className="shadow-sm border-border h-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" /> Weekly Planner
          </CardTitle>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded-md">This Week</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-end mb-6 gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {weekDays.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-2 min-w-[3rem]">
              <span className={`text-xs font-semibold ${d.status === 'today' ? 'text-primary' : 'text-muted-foreground'}`}>
                {d.day}
              </span>
              <div 
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-all
                  ${d.status === 'completed' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : ''}
                  ${d.status === 'today' ? 'bg-primary text-primary-foreground shadow-premium shadow-primary/30 scale-110' : ''}
                  ${d.status === 'upcoming' ? 'bg-muted text-muted-foreground border border-border/50' : ''}
                `}
              >
                {d.date}
              </div>
            </div>
          ))}
        </div>
        
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
          <h4 className="text-sm font-bold text-primary mb-1 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4" /> Today's Focus: Math Drills
          </h4>
          <p className="text-xs text-muted-foreground">
            You have scheduled 2 hours of Mathematics focusing on Calculus and Trigonometry.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
