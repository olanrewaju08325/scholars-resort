import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, Brain, TimerReset } from 'lucide-react';
import { toast } from 'sonner';

type TimerMode = 'focus' | 'break';

const FOCUS_TIME = 25 * 60;
const BREAK_TIME = 5 * 60;

export const PomodoroTimer = () => {
  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<TimerMode>('focus');
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      // Timer finished
      setIsActive(false);
      if (mode === 'focus') {
        toast.success("Focus session complete! Time for a short break.");
        setSessionsCompleted(s => s + 1);
        setMode('break');
        setTimeLeft(BREAK_TIME);
      } else {
        toast.success("Break is over! Ready to focus?");
        setMode('focus');
        setTimeLeft(FOCUS_TIME);
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, mode]);

  const toggleTimer = () => setIsActive(!isActive);
  
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'focus' ? FOCUS_TIME : BREAK_TIME);
  };

  const skipPhase = () => {
    setIsActive(false);
    if (mode === 'focus') {
      setMode('break');
      setTimeLeft(BREAK_TIME);
    } else {
      setMode('focus');
      setTimeLeft(FOCUS_TIME);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = mode === 'focus' 
    ? ((FOCUS_TIME - timeLeft) / FOCUS_TIME) * 100 
    : ((BREAK_TIME - timeLeft) / BREAK_TIME) * 100;

  return (
    <Card className="bg-card border-border shadow-sm overflow-hidden relative">
      {/* Background Progress */}
      <div 
        className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ease-linear ${mode === 'focus' ? 'bg-primary' : 'bg-green-500'}`} 
        style={{ width: `${progress}%` }} 
      />
      
      <CardContent className="p-6 flex flex-col items-center justify-center text-center">
        <div className="flex gap-2 mb-6">
          <Button 
            variant={mode === 'focus' ? 'default' : 'outline'} 
            size="sm" 
            className="rounded-full text-xs"
            onClick={() => { setMode('focus'); setTimeLeft(FOCUS_TIME); setIsActive(false); }}
          >
            <Brain className="w-3 h-3 mr-1.5" /> Focus
          </Button>
          <Button 
            variant={mode === 'break' ? 'default' : 'outline'} 
            size="sm" 
            className={`rounded-full text-xs ${mode === 'break' ? 'bg-green-500 hover:bg-green-600 text-white' : ''}`}
            onClick={() => { setMode('break'); setTimeLeft(BREAK_TIME); setIsActive(false); }}
          >
            <Coffee className="w-3 h-3 mr-1.5" /> Break
          </Button>
        </div>

        <div className="text-6xl md:text-7xl font-display font-extrabold tracking-tighter tabular-nums mb-8">
          {formatTime(timeLeft)}
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="rounded-full w-12 h-12" onClick={resetTimer}>
            <RotateCcw className="w-5 h-5" />
          </Button>
          
          <Button 
            size="lg" 
            className={`rounded-full w-16 h-16 shadow-lg ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/90'}`}
            onClick={toggleTimer}
          >
            {isActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
          </Button>
          
          <Button variant="outline" size="icon" className="rounded-full w-12 h-12" onClick={skipPhase}>
            <TimerReset className="w-5 h-5" />
          </Button>
        </div>
        
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-6">
          Sessions Completed Today: <span className="text-foreground">{sessionsCompleted}</span>
        </p>
      </CardContent>
    </Card>
  );
};
