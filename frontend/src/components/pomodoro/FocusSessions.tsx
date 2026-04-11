/**
 * @file FocusSessions.tsx
 * @description Focus session components for Daily Journal
 * @app SHARED - Pomodoro integration with Daily Journal
 * 
 * Contains:
 * - FocusSessionCard: Compact start timer card
 * 
 * Note: Session tracking has been removed to respect user privacy.
 * The timer is purely local and ephemeral - no sessions are persisted.
 */
'use client';

import React from 'react';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import type { Task } from '@/types/task';
import { TimerIcon, PlayIcon } from '@/components/common/Icons';
import { Panel, Button } from '@/components/ui';

interface FocusSessionCardProps {
  /** Tasks for today (to select a focus task) */
  todayTasks?: Task[];
  /** Called to open task selector */
  onSelectTask?: () => void;
}

/**
 * FocusSessionCard - Compact card to start a focus session
 */
export const FocusSessionCard: React.FC<FocusSessionCardProps> = ({
  todayTasks = [],
  onSelectTask,
}) => {
  const status = usePomodoroStore((s) => s.status);
  const phase = usePomodoroStore((s) => s.phase);
  const timeRemaining = usePomodoroStore((s) => s.timeRemaining);
  const focusTaskTitle = usePomodoroStore((s) => s.focusTaskTitle);
  const enterImmersive = usePomodoroStore((s) => s.enterImmersive);
  const startTimer = usePomodoroStore((s) => s.startTimer);
  const setFocusTask = usePomodoroStore((s) => s.setFocusTask);

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get phase color
  const getPhaseColor = () => {
    if (phase === 'work') return 'text-rose-500';
    if (phase === 'break') return 'text-emerald-500';
    return 'text-blue-500';
  };

  // Quick task selection (first incomplete task)
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

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${phase === 'work' ? 'bg-rose-500/10' : phase === 'break' ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
            <TimerIcon className={`w-5 h-5 ${getPhaseColor()}`} />
          </div>
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">
              {isActive ? (
                <span className="flex items-center gap-2">
                  <span className={getPhaseColor()}>{formatTime(timeRemaining)}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {phase === 'work' ? 'Focus' : phase === 'break' ? 'Break' : 'Long Break'}
                  </span>
                </span>
              ) : (
                'Focus Timer'
              )}
            </h3>
            {focusTaskTitle ? (
              <p className="text-sm text-[var(--color-text-secondary)] truncate max-w-48">
                {focusTaskTitle}
              </p>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {todayTasks.filter(t => !t.completed).length} tasks for today
              </p>
            )}
          </div>
        </div>
        
        <Button
          onClick={isActive ? enterImmersive : handleQuickStart}
          variant={isActive ? 'secondary' : 'primary'}
          size="sm"
          className="gap-1.5"
        >
          <PlayIcon className="w-4 h-4" />
          {isActive ? 'Resume' : 'Start Focus'}
        </Button>
      </div>
    </Panel>
  );
};

export default FocusSessionCard;
