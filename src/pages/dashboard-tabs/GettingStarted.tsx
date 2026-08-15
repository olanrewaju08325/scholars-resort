import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, X, BookOpen, Users, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export const GettingStarted = () => {
  const [isVisible, setIsVisible] = useState(true);
  
  const { profile } = useAuth();
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Complete your first practice session', icon: <BookOpen className="w-5 h-5 text-blue-400" />, done: false, link: '/practice/setup' },
    { id: 2, title: 'Link a Guardian Account', icon: <Users className="w-5 h-5 text-green-400" />, done: false, link: '/dashboard/guardian' },
    { id: 3, title: 'Explore the Help Center', icon: <HelpCircle className="w-5 h-5 text-purple-400" />, done: true, link: '/help' },
  ]);

  useEffect(() => {
    const dismissed = localStorage.getItem('hide_getting_started');
    if (dismissed === 'true') {
      setIsVisible(false);
      return;
    }

    const checkRealProgress = async () => {
      if (!profile) return;
      
      const { count: examCount } = await supabase.from('exam_sessions').select('*', { count: 'exact', head: true }).eq('user_id', profile.id);
      const { count: linkCount } = await supabase.from('guardian_links').select('*', { count: 'exact', head: true }).eq('student_id', profile.id).eq('status', 'active');
      
      setTasks([
        { id: 1, title: 'Complete your first practice session', icon: <BookOpen className="w-5 h-5 text-blue-400" />, done: (examCount || 0) > 0, link: '/practice/setup' },
        { id: 2, title: 'Link a Guardian Account', icon: <Users className="w-5 h-5 text-green-400" />, done: (linkCount || 0) > 0, link: '/dashboard/guardian' },
        { id: 3, title: 'Explore the Help Center', icon: <HelpCircle className="w-5 h-5 text-purple-400" />, done: true, link: '/help' },
      ]);
    };
    checkRealProgress();
  }, [profile]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('hide_getting_started', 'true');
  };

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  if (!isVisible) return null;

  const completedCount = tasks.filter(t => t.done).length;
  const progressPercent = Math.round((completedCount / tasks.length) * 100);

  return (
    <Card className="bg-slate-900 border-primary/30 shadow-lg relative overflow-hidden mb-8">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
      
      <button 
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-full p-1 transition-colors"
        aria-label="Dismiss checklist"
      >
        <X className="w-4 h-4" />
      </button>

      <CardHeader className="pb-4">
        <CardTitle className="text-xl text-white flex items-center gap-2">
          Getting Started
        </CardTitle>
        <CardDescription className="text-slate-400">
          Complete these quick steps to get the most out of Scholars Resort.
        </CardDescription>
        
        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs font-medium text-slate-400 mb-1">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-primary h-2 transition-all duration-500 ease-out" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} className={`flex items-center justify-between p-3 rounded-lg border ${task.done ? 'bg-slate-950/50 border-slate-800 opacity-75' : 'bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors'}`}>
              <div className="flex items-center gap-3">
                <button onClick={() => toggleTask(task.id)} className="focus:outline-none transition-transform hover:scale-110 active:scale-95">
                  {task.done ? (
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-500" />
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-slate-900 rounded-md">
                    {task.icon}
                  </div>
                  <span className={`font-medium ${task.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                    {task.title}
                  </span>
                </div>
              </div>
              
              {!task.done && (
                <Link to={task.link}>
                  <Button variant="ghost" size="sm" className="text-xs hover:bg-slate-700">
                    Go 
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
