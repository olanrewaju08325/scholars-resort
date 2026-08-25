import React, { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Timer, Flame, Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RoomTimerState } from '@/types/studyRoomTypes';

interface GroupTimerProps {
  timerState: RoomTimerState;
  onUpdateTimer: (action: 'start' | 'pause' | 'reset' | 'tick', duration?: number, remainingSeconds?: number) => void;
  isHost: boolean;
}

export const GroupTimer: React.FC<GroupTimerProps> = ({
  timerState,
  onUpdateTimer,
  isHost
}) => {
  const [seconds, setSeconds] = useState<number>(timerState.remainingSeconds);

  useEffect(() => {
    setSeconds(timerState.remainingSeconds);
  }, [timerState.remainingSeconds]);

  useEffect(() => {
    let interval: any = null;
    if (timerState.isRunning && seconds > 0) {
      interval = setInterval(() => {
        setSeconds((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            onUpdateTimer('pause');
            // Play completion chime
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
              gain.gain.setValueAtTime(0.3, ctx.currentTime);
              osc.start();
              osc.stop(ctx.currentTime + 1.2);
            } catch (_) {}
            return 0;
          }
          if (next % 5 === 0) {
            onUpdateTimer('tick', undefined, next);
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState.isRunning, seconds]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shadow-md ${
          timerState.isRunning ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-amber-400'
        }`}>
          <Timer className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Synchronized Group Timer
            </span>
            {timerState.isRunning && (
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-white mt-0.5">
            {formatTime(seconds)}
          </div>
        </div>
      </div>

      {/* Quick Timer Mode Selection */}
      <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => onUpdateTimer('reset', 1500)} // 25 min Pomodoro
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1"
        >
          <Flame className="w-3.5 h-3.5 text-amber-500" /> 25m Focus
        </button>

        <button
          onClick={() => onUpdateTimer('reset', 2400)} // 40 min UTME Sprint
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1"
        >
          <Timer className="w-3.5 h-3.5 text-blue-500" /> 40m UTME Sprint
        </button>

        <button
          onClick={() => onUpdateTimer('reset', 300)} // 5 min Break
          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1"
        >
          <Coffee className="w-3.5 h-3.5 text-emerald-500" /> 5m Break
        </button>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        {timerState.isRunning ? (
          <Button
            size="sm"
            onClick={() => onUpdateTimer('pause')}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
          >
            <Pause className="w-4 h-4 mr-1 fill-current" /> Pause
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => onUpdateTimer('start')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
          >
            <Play className="w-4 h-4 mr-1 fill-current" /> Start Focus
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => onUpdateTimer('reset', timerState.durationSeconds)}
          className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
