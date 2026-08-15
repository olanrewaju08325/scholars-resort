import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Pause, RotateCcw, Coffee, Book } from 'lucide-react';
import { toast } from 'sonner';

export const PomodoroTimer = () => {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'work' | 'break'>('work');
  
  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
  };

  const switchMode = (newMode: 'work' | 'break') => {
    setMode(newMode);
    setIsActive(false);
    setTimeLeft(newMode === 'work' ? 25 * 60 : 5 * 60);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      // Timer finished
      setIsActive(false);
      if (mode === 'work') {
        toast.success("Focus session completed! Take a 5-minute break.");
        switchMode('break');
      } else {
        toast.info("Break is over! Ready to focus again?");
        switchMode('work');
      }
      
      // Play a simple ping sound if available
      try {
         const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
         audio.play().catch(e => console.log('Audio playback blocked'));
      } catch (e) {}
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, mode]);

  const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  const progress = mode === 'work' 
    ? ((25 * 60 - timeLeft) / (25 * 60)) * 100 
    : ((5 * 60 - timeLeft) / (5 * 60)) * 100;

  return (
    <Card className="bg-slate-950/50 backdrop-blur-md border-slate-800 text-slate-100 relative overflow-hidden">
      {/* Background Progress Ring Blur */}
      <div 
        className={`absolute top-0 left-0 h-1 transition-all duration-1000 ease-linear ${mode === 'work' ? 'bg-red-500' : 'bg-green-500'}`}
        style={{ width: `${progress}%` }} 
      />

      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode === 'work' ? <Book className="w-5 h-5 text-red-500" /> : <Coffee className="w-5 h-5 text-green-500" />}
            Study Timer
          </div>
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1">
             <button 
               onClick={() => switchMode('work')} 
               className={`text-[10px] px-2 py-1 rounded-md font-bold transition-colors ${mode === 'work' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
             >
               FOCUS
             </button>
             <button 
               onClick={() => switchMode('break')} 
               className={`text-[10px] px-2 py-1 rounded-md font-bold transition-colors ${mode === 'break' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
             >
               BREAK
             </button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center pt-4 pb-6">
        <div className={`text-6xl font-black font-mono tracking-tighter mb-6 ${mode === 'work' ? 'text-white drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-white drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]'}`}>
          {minutes}:{seconds}
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            onClick={toggleTimer} 
            size="lg" 
            className={`w-32 rounded-xl font-bold border-0 shadow-lg ${
              mode === 'work' 
                ? isActive ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25'
                : isActive ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-500/25'
            }`}
          >
            {isActive ? (
              <><Pause className="w-5 h-5 mr-2 fill-current" /> Pause</>
            ) : (
              <><Play className="w-5 h-5 mr-2 fill-current" /> Start</>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={resetTimer} 
            className="w-12 h-12 rounded-xl border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
