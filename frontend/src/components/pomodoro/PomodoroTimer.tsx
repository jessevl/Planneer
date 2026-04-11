/**
 * @file PomodoroTimer.tsx
 * @description Immersive Pomodoro timer component
 * @app SHARED - Used in Daily Journal view and Home view
 * 
 * A full-screen immersive timer experience featuring:
 * - Large countdown display (centered)
 * - Phase indicator (Work/Break/Long Break)
 * - Start/Pause/Reset controls
 * - Current focus task display
 * - Session progress indicators
 * - Floating task panel for task selection and completion
 * 
 * The timer uses the pomodoroStore for state management
 * and runs a client-side interval when active.
 */
'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePomodoroStore } from '@/stores/pomodoroStore';
import { useTasksStore } from '@/stores/tasksStore';
import { useIsMobile, useIsTouch } from '@frameer/hooks/useMobileDetection';
import { XIcon, PlayIcon, PauseIcon, SkipIcon, TimerIcon, CheckIcon, ChevronDownIcon } from '@/components/common/Icons';
import { Panel } from '@/components/ui';
import type { Task } from '@/types/task';

interface PomodoroTimerProps {
  /** Called when closing immersive mode */
  onClose?: () => void;
  /** Today's tasks to display in the timer */
  tasks?: Task[];
}

/**
 * Format seconds as MM:SS
 */
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Get phase display info
 */
const getPhaseInfo = (phase: 'work' | 'break' | 'longBreak') => {
  switch (phase) {
    case 'work':
      return { label: 'Focus Time', color: 'text-rose-500', bg: 'bg-rose-500/10', ring: 'ring-rose-500/30' };
    case 'break':
      return { label: 'Short Break', color: 'text-emerald-500', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/30' };
    case 'longBreak':
      return { label: 'Long Break', color: 'text-blue-500', bg: 'bg-blue-500/10', ring: 'ring-blue-500/30' };
  }
};

const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ onClose, tasks = [] }) => {
  // Store state
  const status = usePomodoroStore((s) => s.status);
  const phase = usePomodoroStore((s) => s.phase);
  const timeRemaining = usePomodoroStore((s) => s.timeRemaining);
  const sessionsCompleted = usePomodoroStore((s) => s.sessionsCompleted);
  const focusTaskId = usePomodoroStore((s) => s.focusTaskId);
  const focusTaskTitle = usePomodoroStore((s) => s.focusTaskTitle);
  const settings = usePomodoroStore((s) => s.settings);
  
  // Store actions
  const startTimer = usePomodoroStore((s) => s.startTimer);
  const pauseTimer = usePomodoroStore((s) => s.pauseTimer);
  const resumeTimer = usePomodoroStore((s) => s.resumeTimer);
  const resetTimer = usePomodoroStore((s) => s.resetTimer);
  const skipPhase = usePomodoroStore((s) => s.skipPhase);
  const tick = usePomodoroStore((s) => s.tick);
  const exitImmersive = usePomodoroStore((s) => s.exitImmersive);
  const setFocusTask = usePomodoroStore((s) => s.setFocusTask);
  const clearFocusTask = usePomodoroStore((s) => s.clearFocusTask);

  // Task completion
  const toggleComplete = useTasksStore((s) => s.toggleComplete);

  // Mobile detection
  const isMobile = useIsMobile();
  const isTouch = useIsTouch();

  // Task panel visibility - start collapsed on mobile to not block timer
  const [taskPanelOpen, setTaskPanelOpen] = useState(!isMobile);

  // Filter incomplete tasks
  const incompleteTasks = tasks.filter(t => !t.completed);

  // Run timer interval
  useEffect(() => {
    if (status !== 'running') return;
    
    const interval = setInterval(() => {
      tick();
    }, 1000);
    
    return () => clearInterval(interval);
  }, [status, tick]);

  // Handle close
  const handleClose = useCallback(() => {
    exitImmersive();
    onClose?.();
  }, [exitImmersive, onClose]);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (status === 'running') {
          pauseTimer();
        } else if (status === 'paused') {
          resumeTimer();
        } else {
          startTimer();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, startTimer, pauseTimer, resumeTimer, handleClose]);

  // Handle task click (select as focus)
  const handleTaskClick = (task: Task) => {
    if (focusTaskId === task.id) {
      clearFocusTask();
    } else {
      setFocusTask(task.id, task.title);
    }
  };

  // Handle task completion
  const handleCompleteTask = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    toggleComplete(taskId);
    // If completing the focused task, clear focus
    if (focusTaskId === taskId) {
      clearFocusTask();
    }
  };

  const phaseInfo = getPhaseInfo(phase);
  const progress = 1 - (timeRemaining / (
    phase === 'work' 
      ? settings.workDuration * 60 
      : phase === 'break' 
        ? settings.breakDuration * 60 
        : settings.longBreakDuration * 60
  ));

  // Calculate stroke dasharray for circular progress
  const circumference = 2 * Math.PI * 140; // radius 140
  const strokeDashoffset = circumference * (1 - progress);

  const content = (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-[var(--color-surface-base)]">
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors rounded-lg hover:bg-[var(--color-surface-overlay)] z-10"
        style={{ top: 'calc(env(safe-area-inset-top) + 1rem)' }}
        aria-label="Close timer"
      >
        <XIcon className="w-5 h-5" />
      </button>

      {/* Main centered content */}
      <div className="flex flex-col items-center">
        {/* Phase indicator */}
        <div className={`mb-6 px-4 py-1.5 rounded-full ${phaseInfo.bg}`}>
          <span className={`text-sm font-medium ${phaseInfo.color}`}>
            {phaseInfo.label}
          </span>
        </div>

        {/* Timer circle - responsive sizing */}
        <div className="relative mb-6">
          {/* Background circle */}
          <svg className="w-56 h-56 sm:w-72 sm:h-72 transform -rotate-90" viewBox="0 0 288 288">
            <circle
              cx="144"
              cy="144"
              r="130"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className="text-[var(--color-border-default)]"
            />
            {/* Progress circle */}
            <circle
              cx="144"
              cy="144"
              r="130"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              className={phaseInfo.color}
              style={{
                strokeDasharray: 2 * Math.PI * 130,
                strokeDashoffset: (2 * Math.PI * 130) * (1 - progress),
                transition: 'stroke-dashoffset 0.5s ease-out',
              }}
            />
          </svg>
          
          {/* Time display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl sm:text-6xl font-bold text-[var(--color-text-primary)] tabular-nums tracking-tight">
              {formatTime(timeRemaining)}
            </span>
            {focusTaskTitle && (
              <span className="mt-2 sm:mt-3 text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-40 sm:max-w-48 truncate text-center px-4">
                {focusTaskTitle}
              </span>
            )}
          </div>
        </div>

        {/* Session dots */}
        <div className="flex gap-2 mb-6">
          {Array.from({ length: settings.sessionsBeforeLongBreak }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i < sessionsCompleted 
                  ? 'bg-rose-500' 
                  : 'bg-[var(--color-border-default)]'
              }`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Reset button */}
          <button
            onClick={resetTimer}
            className="p-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] rounded-full transition-colors"
            aria-label="Reset timer"
          >
            <TimerIcon className="w-5 h-5" />
          </button>

          {/* Play/Pause button */}
          <button
            onClick={() => {
              if (status === 'running') {
                pauseTimer();
              } else if (status === 'paused') {
                resumeTimer();
              } else {
                startTimer();
              }
            }}
            className={`p-5 rounded-full transition-all shadow-lg ${
              status === 'running'
                ? 'bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)] text-[var(--color-text-primary)]'
                : 'bg-rose-500 hover:bg-rose-600 text-white'
            }`}
            aria-label={status === 'running' ? 'Pause' : 'Start'}
          >
            {status === 'running' ? (
              <PauseIcon className="w-7 h-7" />
            ) : (
              <PlayIcon className="w-7 h-7" />
            )}
          </button>

          {/* Skip button */}
          <button
            onClick={skipPhase}
            className="p-2.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] rounded-full transition-colors"
            aria-label="Skip to next phase"
          >
            <SkipIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Keyboard hint - hidden on touch devices */}
        {!isTouch && (
          <div className="mt-6 text-xs text-[var(--color-text-tertiary)]">
            Press <kbd className="px-1.5 py-0.5 bg-[var(--color-surface-overlay)] rounded text-[var(--color-text-tertiary)]">Space</kbd> to {status === 'running' ? 'pause' : 'start'} · <kbd className="px-1.5 py-0.5 bg-[var(--color-surface-overlay)] rounded text-[var(--color-text-tertiary)]">Esc</kbd> to close
          </div>
        )}
      </div>

      {/* Floating task panel - responsive positioning */}
      <div className={`absolute ${isMobile ? 'bottom-24 left-4 right-4' : 'bottom-6 right-6 w-80'}`}>
        <Panel className="shadow-xl border border-[var(--color-border-default)] overflow-hidden">
          {/* Panel header */}
          <button
            onClick={() => setTaskPanelOpen(!taskPanelOpen)}
            className="w-full flex items-center justify-between p-3 hover:bg-[var(--color-surface-secondary)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckIcon className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                Today's Tasks
              </span>
              {incompleteTasks.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] rounded">
                  {incompleteTasks.length}
                </span>
              )}
            </div>
            <ChevronDownIcon className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform ${taskPanelOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Task list */}
          {taskPanelOpen && (
            <div className="border-t border-[var(--color-border-subtle)] max-h-64 overflow-y-auto">
              {incompleteTasks.length === 0 ? (
                <div className="p-4 text-center text-[var(--color-text-secondary)] text-sm">
                  All tasks completed! 🎉
                </div>
              ) : (
                <div className="p-2">
                  {incompleteTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(task)}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                        focusTaskId === task.id
                          ? 'bg-rose-50 dark:bg-rose-500/10'
                          : 'hover:bg-[var(--color-surface-secondary)]'
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={(e) => handleCompleteTask(e, task.id)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors hover:border-green-500 hover:bg-green-500/10 ${
                          focusTaskId === task.id
                            ? 'border-rose-400 dark:border-rose-500'
                            : 'border-[var(--color-border-default)]'
                        }`}
                      >
                        <CheckIcon className="w-3 h-3 text-transparent hover:text-green-500" />
                      </button>
                      
                      {/* Task title */}
                      <span className={`text-sm flex-1 truncate ${
                        focusTaskId === task.id
                          ? 'text-rose-700 dark:text-rose-300 font-medium'
                          : 'text-[var(--color-text-primary)]'
                      }`}>
                        {task.title}
                      </span>

                      {/* Focus indicator */}
                      {focusTaskId === task.id && (
                        <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">
                          Focusing
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default PomodoroTimer;
