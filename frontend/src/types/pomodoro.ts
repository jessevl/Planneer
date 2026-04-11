/**
 * @file pomodoro.ts
 * @description Pomodoro timer type definitions
 * @app SHARED - Used by Daily Journal and Tasks
 * 
 * Defines types for the Pomodoro timer feature.
 * Note: Sessions are not persisted - the timer is purely local and ephemeral.
 */

/** Timer settings */
export interface PomodoroSettings {
  /** Work session duration in minutes (default: 25) */
  workDuration: number;
  /** Short break duration in minutes (default: 5) */
  breakDuration: number;
  /** Long break duration in minutes (default: 15) */
  longBreakDuration: number;
  /** Number of work sessions before long break (default: 4) */
  sessionsBeforeLongBreak: number;
  /** Auto-start breaks after work sessions */
  autoStartBreaks: boolean;
  /** Auto-start work after breaks */
  autoStartWork: boolean;
}

/** Current timer state */
export type TimerStatus = 'idle' | 'running' | 'paused';
export type TimerPhase = 'work' | 'break' | 'longBreak';
