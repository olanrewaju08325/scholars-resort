import { Target, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function StudyGoals() {
  const goals = [
    { id: 1, title: 'Complete 50 Physics Questions', completed: true },
    { id: 2, title: 'Review Kinematics Mistakes', completed: true },
    { id: 3, title: 'Read Chemistry Chapter 4', completed: false },
    { id: 4, title: 'Score 70%+ in Daily Mini-Mock', completed: false },
  ];

  const completedCount = goals.filter(g => g.completed).length;
  const progress = Math.round((completedCount / goals.length) * 100);

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Daily Goals
          </CardTitle>
          <span className="text-sm font-semibold text-muted-foreground">{completedCount}/{goals.length}</span>
        </div>
        {/* Progress Bar */}
        <div className="w-full h-2 bg-muted rounded-full mt-3 overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {goals.map(goal => (
            <li key={goal.id} className="flex items-start gap-3">
              {goal.completed ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <span className={`text-sm ${goal.completed ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                {goal.title}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
