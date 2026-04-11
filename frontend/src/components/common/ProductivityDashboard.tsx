/**
 * @file ProductivityDashboard.tsx
 * @description Productivity dashboard with task-based activity tracking
 * @app SHARED - Settings modal productivity section
 * 
 * Features:
 * - GitHub-style contribution heatmap based on tasks completed
 * - Task completion stats (today/week/month)
 * - Simple streak tracking based on task completion
 * - No invasive tracking - uses only existing task data
 * 
 * Inspired by: GitHub contributions, simple analytics
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import { useTasksStore } from '@/stores/tasksStore';
import { usePagesStore } from '@/stores/pagesStore';
import { getTodayISO } from '@/lib/dateUtils';
import { getCompletedTasksInRange } from '@/api/tasksApi';
import { Flame, CheckCircle2, Calendar, FileText, TrendingUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/design-system';

// ============================================================================
// TYPES
// ============================================================================

interface DayData {
  date: string;
  tasksCompleted: number;
  level: 0 | 1 | 2 | 3 | 4; // 0 = no activity, 4 = most activity
}

interface ProductivityData {
  // Task stats
  todayTasks: number;
  weekTasks: number;
  monthTasks: number;
  yearTasks: number;
  pendingTasks: number;
  // Page stats
  totalPages: number;
  recentPages: number; // pages created/edited in last 30 days
  // Streak
  currentStreak: number;
  longestStreak: number;
  // Heatmap data
  heatmapData: DayData[];
  // Best day
  bestDayTasks: number;
  bestDayDate: string | null;
}

type TimePeriod = 'week' | 'month' | 'year';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getActivityLevel = (tasks: number, maxTasks: number): 0 | 1 | 2 | 3 | 4 => {
  if (tasks === 0) return 0;
  const ratio = tasks / Math.max(maxTasks, 1);
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Stat card with icon and value */
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: 'default' | 'success' | 'warning' | 'accent';
  className?: string;
}> = ({ icon, label, value, subtitle, color = 'default', className }) => {
  const colorClasses = {
    default: 'text-[var(--color-text-primary)]',
    success: 'text-green-600 dark:text-green-400',
    warning: 'text-amber-600 dark:text-amber-400',
    accent: 'text-[var(--color-interactive-text-strong)]',
  };

  return (
    <div className={cn(
      'bg-[var(--color-surface-inset)] rounded-xl p-4',
      className
    )}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[var(--color-text-tertiary)]">{icon}</span>
        <span className="text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className={cn('text-2xl font-bold', colorClasses[color])}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
          {subtitle}
        </div>
      )}
    </div>
  );
};

/** Streak display with celebration */
const StreakDisplay: React.FC<{ streak: number; longestStreak: number }> = ({ streak, longestStreak }) => {
  if (streak === 0 && longestStreak === 0) return null;

  const isNewRecord = streak >= longestStreak && streak > 1;
  
  const getStreakEmoji = () => {
    if (isNewRecord && streak >= 7) return '🏆';
    if (streak >= 30) return '🔥';
    if (streak >= 7) return '⚡';
    if (streak >= 3) return '✨';
    return '🌱';
  };

  const getMessage = () => {
    if (streak >= 30) return "On fire!";
    if (streak >= 14) return "Two weeks strong!";
    if (streak >= 7) return "Week streak!";
    if (streak >= 3) return "Building momentum";
    if (streak >= 1) return "Keep going!";
    return longestStreak > 0 ? `Best: ${longestStreak} days` : "";
  };

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl p-4',
      isNewRecord 
        ? 'bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 dark:from-amber-500/25 dark:via-orange-500/25 dark:to-rose-500/25'
        : 'bg-[var(--color-surface-inset)]'
    )}>
      <span className="text-2xl">{getStreakEmoji()}</span>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-[var(--color-text-primary)]">
            {streak} day{streak !== 1 ? 's' : ''}
          </span>
          {isNewRecord && (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              New record!
            </span>
          )}
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">
          {getMessage()}
        </div>
      </div>
      {longestStreak > streak && (
        <div className="text-right">
          <div className="text-xs text-[var(--color-text-tertiary)]">Best</div>
          <div className="text-sm font-medium text-[var(--color-text-secondary)]">{longestStreak}d</div>
        </div>
      )}
    </div>
  );
};

/** GitHub-style contribution heatmap */
const ContributionHeatmap: React.FC<{
  data: DayData[];
  period: TimePeriod;
}> = ({ data, period }) => {
  // Generate grid based on period
  const weeks = useMemo(() => {
    const numWeeks = period === 'year' ? 52 : period === 'month' ? 5 : 1;
    const today = dayjs();
    const result: DayData[][] = [];
    
    // Build weeks array (each week is a column)
    for (let w = numWeeks - 1; w >= 0; w--) {
      const weekStart = today.subtract(w, 'week').startOf('week');
      const week: DayData[] = [];
      
      for (let d = 0; d < 7; d++) {
        const date = weekStart.add(d, 'day');
        const dateStr = date.format('YYYY-MM-DD');
        const dayData = data.find(d => d.date === dateStr);
        
        week.push(dayData || {
          date: dateStr,
          tasksCompleted: 0,
          level: 0,
        });
      }
      result.push(week);
    }
    
    return result;
  }, [data, period]);

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
  
  const levelColors = {
    0: 'bg-[var(--color-surface-inset)]',
    1: 'bg-green-200 dark:bg-green-900/60',
    2: 'bg-green-400 dark:bg-green-700/80',
    3: 'bg-green-500 dark:bg-green-600',
    4: 'bg-green-600 dark:bg-green-500',
  };

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-[3px]">
        {/* Day labels */}
        <div className="flex flex-col gap-[3px] pr-2">
          {dayLabels.map((label, i) => (
            <div 
              key={i} 
              className="h-[11px] text-[10px] text-[var(--color-text-tertiary)] flex items-center justify-end"
            >
              {label}
            </div>
          ))}
        </div>
        
        {/* Weeks grid */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-[3px]">
            {week.map((day, dayIdx) => {
              const isFuture = dayjs(day.date).isAfter(dayjs());
              return (
                <div
                  key={dayIdx}
                  className={cn(
                    'w-[11px] h-[11px] rounded-sm transition-all hover:ring-2 hover:ring-offset-1 hover:ring-green-400/50 ring-offset-[var(--color-surface-base)]',
                    levelColors[day.level],
                    isFuture && 'opacity-20 pointer-events-none'
                  )}
                  title={isFuture ? '' : `${dayjs(day.date).format('MMM D, YYYY')}: ${day.tasksCompleted} task${day.tasksCompleted !== 1 ? 's' : ''} completed`}
                />
              );
            })}
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-[var(--color-text-tertiary)]">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map(level => (
          <div
            key={level}
            className={cn('w-[11px] h-[11px] rounded-sm', levelColors[level as 0 | 1 | 2 | 3 | 4])}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
};

/** Period selector tabs */
const PeriodTabs: React.FC<{
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}> = ({ value, onChange }) => {
  const periods: { id: TimePeriod; label: string }[] = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' },
  ];

  return (
    <div className="flex gap-1 bg-[var(--color-surface-inset)] rounded-lg p-1">
      {periods.map(p => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            value === p.id
              ? 'bg-[var(--color-surface-base)] text-[var(--color-text-primary)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ProductivityDashboard: React.FC = () => {
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ProductivityData | null>(null);

  // Store data
  const tasksById = useTasksStore(s => s.tasksById);
  const pagesById = usePagesStore(s => s.pagesById);

  const todayISO = getTodayISO();

  // Compute productivity data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    
    const today = dayjs(todayISO);
    const weekStart = today.startOf('week').format('YYYY-MM-DD');
    const monthStart = today.startOf('month').format('YYYY-MM-DD');
    const yearStart = today.subtract(1, 'year').format('YYYY-MM-DD');
    const thirtyDaysAgo = today.subtract(30, 'day').format('YYYY-MM-DD');
    
    try {
      // Fetch completed tasks for the year
      const yearTasks = await getCompletedTasksInRange(yearStart, todayISO);
      
      // Group tasks by completion date
      const tasksByDate: Record<string, number> = {};
      yearTasks.forEach(task => {
        if (task.completedAt) {
          const date = task.completedAt.split('T')[0];
          tasksByDate[date] = (tasksByDate[date] || 0) + 1;
        }
      });

      // Calculate streaks
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      
      // Check today and backwards
      for (let i = 0; i <= 365; i++) {
        const date = today.subtract(i, 'day').format('YYYY-MM-DD');
        const tasksOnDay = tasksByDate[date] || 0;
        
        if (tasksOnDay > 0) {
          tempStreak++;
          if (i === 0 || (i === 1 && currentStreak === 0)) {
            currentStreak = tempStreak;
          }
        } else {
          if (i === 0) {
            // Check if yesterday had activity (streak continues if we haven't missed today yet)
            const yesterday = today.subtract(1, 'day').format('YYYY-MM-DD');
            if (tasksByDate[yesterday] > 0) {
              // Allow today to not have tasks yet
              continue;
            }
          }
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 0;
          if (i > 1 && currentStreak === 0) {
            // No current streak if we missed yesterday
            break;
          }
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);

      // Build heatmap data
      const maxTasksPerDay = Math.max(...Object.values(tasksByDate), 1);
      const heatmapData: DayData[] = [];
      
      for (let i = 364; i >= 0; i--) {
        const date = today.subtract(i, 'day').format('YYYY-MM-DD');
        const tasksCompleted = tasksByDate[date] || 0;
        
        heatmapData.push({
          date,
          tasksCompleted,
          level: getActivityLevel(tasksCompleted, maxTasksPerDay),
        });
      }

      // Find best day
      const bestEntry = Object.entries(tasksByDate)
        .sort(([, a], [, b]) => b - a)[0];

      // Calculate pending tasks
      const allTasks = Object.values(tasksById);
      const pendingTasks = allTasks.filter(t => !t.completed).length;

      // Calculate period stats
      const todayTasks = yearTasks.filter(t => 
        t.completedAt?.startsWith(todayISO)
      ).length;
      const weekTasks = yearTasks.filter(t => 
        t.completedAt && t.completedAt >= weekStart
      ).length;
      const monthTasks = yearTasks.filter(t => 
        t.completedAt && t.completedAt >= monthStart
      ).length;

      // Page stats
      const allPages = Object.values(pagesById);
      const totalPages = allPages.length;
      const recentPages = allPages.filter(p => {
        const updated = p.updated || p.created;
        return updated && updated >= thirtyDaysAgo;
      }).length;

      setData({
        todayTasks,
        weekTasks,
        monthTasks,
        yearTasks: yearTasks.length,
        pendingTasks,
        totalPages,
        recentPages,
        currentStreak,
        longestStreak,
        heatmapData,
        bestDayTasks: bestEntry ? bestEntry[1] : 0,
        bestDayDate: bestEntry ? bestEntry[0] : null,
      });
    } catch (error) {
      console.error('Failed to load productivity data:', error);
    }
    
    setIsLoading(false);
  }, [tasksById, pagesById, todayISO]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
            Activity
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Loading your stats...
          </p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-[var(--color-surface-inset)] rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-24 bg-[var(--color-surface-inset)] rounded-xl" />
            <div className="h-24 bg-[var(--color-surface-inset)] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
            Activity
          </h3>
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Your task completion activity
          </p>
        </div>
        <PeriodTabs value={period} onChange={setPeriod} />
      </div>

      {/* Streak Display */}
      <StreakDisplay streak={data.currentStreak} longestStreak={data.longestStreak} />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label={period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'This Year'}
          value={period === 'week' ? data.weekTasks : period === 'month' ? data.monthTasks : data.yearTasks}
          subtitle={data.todayTasks > 0 ? `${data.todayTasks} today` : 'None today yet'}
          color="success"
        />
        <StatCard
          icon={<Flame size={16} />}
          label="Pending"
          value={data.pendingTasks}
          subtitle={data.pendingTasks > 0 ? 'tasks to do' : 'All caught up!'}
          color={data.pendingTasks > 10 ? 'warning' : 'default'}
        />
        <StatCard
          icon={<FileText size={16} />}
          label="Pages"
          value={data.totalPages}
          subtitle={`${data.recentPages} active this month`}
          color="accent"
        />
        <StatCard
          icon={<Sparkles size={16} />}
          label="Best Day"
          value={`${data.bestDayTasks} tasks`}
          subtitle={data.bestDayDate ? dayjs(data.bestDayDate).format('MMM D') : 'No data yet'}
        />
      </div>

      {/* Activity Heatmap */}
      <div className="bg-[var(--color-surface-inset)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={16} className="text-[var(--color-text-tertiary)]" />
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">
            Task Completion Activity
          </span>
        </div>
        <ContributionHeatmap data={data.heatmapData} period={period} />
      </div>

      {/* Insights - only show if meaningful data exists */}
      {(data.yearTasks > 0 || data.currentStreak > 0) && (
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 dark:from-green-500/15 dark:to-emerald-500/15 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Insights
            </span>
          </div>
          <div className="text-sm text-[var(--color-text-secondary)] space-y-1">
            {data.currentStreak >= 7 && (
              <p>🎯 Amazing! You've completed tasks for {data.currentStreak} days straight.</p>
            )}
            {data.currentStreak >= 3 && data.currentStreak < 7 && (
              <p>⚡ Great momentum! {7 - data.currentStreak} more days to a week streak.</p>
            )}
            {data.weekTasks > 0 && (
              <p>📊 Averaging {Math.round(data.weekTasks / 7 * 10) / 10} tasks per day this week.</p>
            )}
            {data.pendingTasks === 0 && data.yearTasks > 0 && (
              <p>✨ Inbox zero! You're all caught up.</p>
            )}
            {data.currentStreak === 0 && data.longestStreak > 0 && (
              <p>💪 Complete a task today to start a new streak!</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductivityDashboard;
