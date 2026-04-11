import React from 'react';
import { Play, Clock } from 'lucide-react';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { Button } from '@/components/ui';
import { cn } from '@/lib/design-system';
import type { Task } from '@/types/task';

interface InlineFocusTimerProps {
  todayTasks: Task[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'header';
}

const InlineFocusTimer: React.FC<InlineFocusTimerProps> = ({ 
  todayTasks, 
  className, 
  size = 'md',
  variant = 'default'
}) => {
  const status = usePomodoroStore((s) => s.status);
  const phase = usePomodoroStore((s) => s.phase);
  const timeRemaining = usePomodoroStore((s) => s.timeRemaining);
  const focusTaskTitle = usePomodoroStore((s) => s.focusTaskTitle);
  const enterImmersive = usePomodoroStore((s) => s.enterImmersive);
  const startTimer = usePomodoroStore((s) => s.startTimer);
  const setFocusTask = usePomodoroStore((s) => s.setFocusTask);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleQuickStart = () => {
    if (todayTasks.length > 0 && !focusTaskTitle) {
      const firstTask = todayTasks.find(t => !t.completed);
      if (firstTask) {
        setFocusTask(firstTask.id, firstTask.title);
      }
    }
    startTimer();
  };

  const isActive = status === 'running' || status === 'paused';
  const phaseColor = phase === 'work' ? 'rose' : phase === 'break' ? 'emerald' : 'blue';

  if (!isActive) {
    return (
      <Button
        onClick={handleQuickStart}
        size={size}
        variant={variant === 'ghost' || variant === 'header' ? 'ghost' : 'primary'}
        className={cn(
          variant === 'default' && "shadow-lg shadow-rose-500/20 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 border-none text-white",
          variant === 'ghost' && "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 !border-rose-200 dark:!border-rose-500/30",
          variant === 'header' && "text-rose-600 dark:text-rose-400 hover:bg-white/60 dark:hover:bg-white/10 rounded-full border-none bg-transparent",
          className
        )}
      >
        <Play className={cn("w-4 h-4", size !== 'sm' && "sm:mr-2", size === 'sm' && "mr-1")} />
        <span>Start Focus</span>
      </Button>
    );
  }

  return (
    <Button
      onClick={enterImmersive}
      variant="ghost"
      size={size}
      className={cn(
        'backdrop-blur-sm border-2 rounded-full',
        variant === 'header' && 'border-none bg-white/40 dark:bg-white/5',
        phaseColor === 'rose' && 'border-rose-500/50 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-500/10',
        phaseColor === 'emerald' && 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/10',
        phaseColor === 'blue' && 'border-blue-500/50 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-500/10',
        className
      )}
    >
      <Clock className={cn('w-4 h-4 mr-2', isActive && 'animate-pulse')} />
      <span className="font-mono font-bold mr-2">{formatTime(timeRemaining)}</span>
      <span className="text-xs opacity-80 uppercase tracking-wider">
        {phase === 'work' ? 'Focusing' : 'Break'}
      </span>
    </Button>
  );
};

export default InlineFocusTimer;
