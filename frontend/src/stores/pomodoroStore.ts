/**
 * @file pomodoroStore.ts
 * @description Pomodoro timer state management with Zustand
 * @app SHARED - Focus timer integrated with Daily Journal
 * 
 * Manages:
 * - Timer state (running/paused/idle, time remaining)
 * - Current focus task
 * - Timer settings
 * - Immersive mode toggle
 * 
 * Note: Sessions are NOT persisted to avoid excessive user tracking.
 * The timer is purely local and ephemeral.
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { 
  PomodoroSettings, 
  TimerStatus, 
  TimerPhase 
} from '@/types/pomodoro';

interface PomodoroState {
  // Timer State
  status: TimerStatus;
  phase: TimerPhase;
  timeRemaining: number; // seconds
  sessionsCompleted: number; // work sessions in current cycle
  
  // Current Focus
  focusTaskId: string | null;
  focusTaskTitle: string | null;
  
  // Immersive Mode
  isImmersive: boolean;
  
  // Settings
  settings: PomodoroSettings;
  
  // Actions - Timer Control
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  skipPhase: () => void;
  tick: () => void; // Called every second by interval
  
  // Actions - Focus Task
  setFocusTask: (taskId: string | null, taskTitle: string | null) => void;
  clearFocusTask: () => void;
  
  // Actions - Immersive Mode
  enterImmersive: () => void;
  exitImmersive: () => void;
  toggleImmersive: () => void;
  
  // Actions - Settings
  updateSettings: (settings: Partial<PomodoroSettings>) => void;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  breakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartWork: false,
};


export const usePomodoroStore = create<PomodoroState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        status: 'idle',
        phase: 'work',
        timeRemaining: DEFAULT_SETTINGS.workDuration * 60,
        sessionsCompleted: 0,
        focusTaskId: null,
        focusTaskTitle: null,
        isImmersive: false,
        settings: DEFAULT_SETTINGS,

        // Timer Control
        startTimer: () => {
          const { status, phase, settings } = get();
          if (status === 'running') return;
          
          // If idle, reset time for current phase
          if (status === 'idle') {
            const duration = phase === 'work' 
              ? settings.workDuration 
              : phase === 'break' 
                ? settings.breakDuration 
                : settings.longBreakDuration;
            set({ timeRemaining: duration * 60 });
          }
          
          set({ status: 'running', isImmersive: true }, false, 'startTimer');
        },

        pauseTimer: () => {
          set({ status: 'paused' }, false, 'pauseTimer');
        },

        resumeTimer: () => {
          const { status } = get();
          if (status !== 'paused') return;
          set({ status: 'running' }, false, 'resumeTimer');
        },

        resetTimer: () => {
          const { settings } = get();
          set({
            status: 'idle',
            phase: 'work',
            timeRemaining: settings.workDuration * 60,
            sessionsCompleted: 0,
          }, false, 'resetTimer');
        },

        skipPhase: () => {
          const { phase, sessionsCompleted, settings } = get();
          
          if (phase === 'work') {
            // Skipping work - go to break
            const newSessionsCompleted = sessionsCompleted + 1;
            const isLongBreak = newSessionsCompleted >= settings.sessionsBeforeLongBreak;
            const nextPhase = isLongBreak ? 'longBreak' : 'break';
            const duration = isLongBreak ? settings.longBreakDuration : settings.breakDuration;
            
            set({
              phase: nextPhase,
              timeRemaining: duration * 60,
              sessionsCompleted: isLongBreak ? 0 : newSessionsCompleted,
              status: settings.autoStartBreaks ? 'running' : 'idle',
            }, false, 'skipPhase/toBreak');
          } else {
            // Skipping break - go to work
            set({
              phase: 'work',
              timeRemaining: settings.workDuration * 60,
              status: settings.autoStartWork ? 'running' : 'idle',
            }, false, 'skipPhase/toWork');
          }
        },

        tick: () => {
          const { status, timeRemaining, phase, sessionsCompleted, settings } = get();
          
          if (status !== 'running') return;
          
          if (timeRemaining <= 1) {
            // Timer completed!
            if (phase === 'work') {
              // Work session completed
              const newSessionsCompleted = sessionsCompleted + 1;
              const isLongBreak = newSessionsCompleted >= settings.sessionsBeforeLongBreak;
              const nextPhase = isLongBreak ? 'longBreak' : 'break';
              const duration = isLongBreak ? settings.longBreakDuration : settings.breakDuration;
              
              set({
                phase: nextPhase,
                timeRemaining: duration * 60,
                sessionsCompleted: isLongBreak ? 0 : newSessionsCompleted,
                status: settings.autoStartBreaks ? 'running' : 'paused',
              }, false, 'tick/workComplete');
            } else {
              // Break completed - go back to work
              set({
                phase: 'work',
                timeRemaining: settings.workDuration * 60,
                status: settings.autoStartWork ? 'running' : 'paused',
              }, false, 'tick/breakComplete');
            }
          } else {
            set({ timeRemaining: timeRemaining - 1 }, false, 'tick');
          }
        },

        // Focus Task
        setFocusTask: (taskId, taskTitle) => {
          set({ focusTaskId: taskId, focusTaskTitle: taskTitle }, false, 'setFocusTask');
        },

        clearFocusTask: () => {
          set({ focusTaskId: null, focusTaskTitle: null }, false, 'clearFocusTask');
        },

        // Immersive Mode
        enterImmersive: () => set({ isImmersive: true }, false, 'enterImmersive'),
        exitImmersive: () => set({ isImmersive: false }, false, 'exitImmersive'),
        toggleImmersive: () => set((state) => ({ isImmersive: !state.isImmersive }), false, 'toggleImmersive'),

        // Settings
        updateSettings: (newSettings) => {
          const { settings, status, phase } = get();
          const updated = { ...settings, ...newSettings };
          
          // If idle, update timeRemaining to match new duration
          if (status === 'idle') {
            const duration = phase === 'work' 
              ? updated.workDuration 
              : phase === 'break' 
                ? updated.breakDuration 
                : updated.longBreakDuration;
            set({ settings: updated, timeRemaining: duration * 60 }, false, 'updateSettings');
          } else {
            set({ settings: updated }, false, 'updateSettings');
          }
        },
      }),
      {
        name: 'planneer-pomodoro',
        partialize: (state) => ({
          settings: state.settings,
        }),
        skipHydration: true,
      }
    ),
    { name: 'PomodoroStore' }
  )
);

// Selectors
export const selectIsTimerActive = (state: PomodoroState) => state.status === 'running';
export const selectTimeRemaining = (state: PomodoroState) => state.timeRemaining;
export const selectPhase = (state: PomodoroState) => state.phase;
