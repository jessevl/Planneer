/**
 * @file CalendarPicker.tsx
 * @description Shared calendar date picker component
 * @app SHARED - Used by both Tasks App and Notes App
 * 
 * A reusable calendar picker that displays a month grid for date selection.
 * Used throughout the app for:
 * - Task due date selection (Tasks App)
 * - Daily note date navigation (Notes App)
 * - Any date input fields
 * 
 * Features:
 * - Quick date shortcuts (Today, Tomorrow, Weekend) with icons
 * - Month navigation (prev/next)
 * - Today highlighting
 * - Selected date highlighting
 * - Clear date option
 * 
 * Note: This component renders just the calendar grid without a container.
 * The parent component should provide the container/popover styling.
 */
import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Button, H3 } from '../ui';
import { cn } from '@/lib/design-system';
import { JournalCalendarIcon, HomeIcon } from './Icons';

// Sunrise icon for tomorrow
const SunriseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M4.93 19.07l2.83-2.83M12 18v4M17.24 17.24l2.83 2.83M18 12h4M19.07 4.93l-2.83 2.83" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);

interface CalendarPickerProps {
  value?: string | null; // ISO date
  onChange: (iso: string) => void;
  onClear?: () => void; // callback to remove the date
  startMonth?: string; // ISO date for initial month
}

const CalendarPicker: React.FC<CalendarPickerProps> = ({ value, onChange, onClear, startMonth }) => {
  const [calendarMonth, setCalendarMonth] = useState(() => startMonth ? dayjs(startMonth).startOf('month') : dayjs().startOf('month'));

  // regenerate cells when month changes
  const cells = useMemo(() => {
    const start = calendarMonth.startOf('month');
    const startDay = start.day();
    // compute the first cell (start of the first week that includes the 1st)
    const firstCell = start.subtract(startDay, 'day');
    const arr: React.ReactNode[] = [];
    // show 6 weeks = 42 cells
    for (let i = 0; i < 42; i++) {
      const day = firstCell.add(i, 'day');
      const iso = day.format('YYYY-MM-DD');
      const inMonth = day.month() === calendarMonth.month();
      const isSelected = value === iso;
      const isToday = day.isSame(dayjs(), 'day');
      
      const buttonClasses = cn(
        'w-full aspect-square rounded-lg md:text-xs text-sm font-medium transition-all',
        isSelected 
            ? 'bg-[var(--color-interactive-bg-strong)] text-white shadow-sm' 
            : isToday 
              ? 'bg-[var(--color-interactive-bg)] border border-[var(--color-interactive-border)] text-[var(--color-interactive-text-strong)]' 
              : 'hover:bg-[var(--color-surface-overlay)]',
        inMonth ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-disabled)]'
      );
      
      arr.push(
        <button 
          key={iso} 
          type="button" 
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange(iso);
          }}
          className={buttonClasses}
        >
          {day.date()}
        </button>
      );
    }
    return arr;
  }, [calendarMonth, value, onChange]);

  // Quick date options
  const quickDates = useMemo(() => {
    const today = dayjs();
    const tomorrow = today.add(1, 'day');
    // Next weekend: find the coming Saturday (day 6)
    const daysUntilSaturday = (6 - today.day() + 7) % 7 || 7; // If today is Saturday, go to next Saturday
    const nextWeekend = today.add(daysUntilSaturday, 'day');
    
    return [
      { label: 'Today', date: today, icon: 'calendar' as const },
      { label: 'Tomorrow', date: tomorrow, icon: 'sunrise' as const },
      { label: 'Weekend', date: nextWeekend, icon: 'home' as const },
    ];
  }, []);

  return (
    <div className="w-full md:max-w-[240px] mx-auto md:px-0 px-4">
      {/* Quick date shortcuts - horizontal and compact */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {quickDates.map(({ label, date, icon }) => {
          const iso = date.format('YYYY-MM-DD');
          const isSelected = value === iso;
          return (
            <button
              key={label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(iso);
                setCalendarMonth(date.startOf('month'));
              }}
              className={cn(
                'flex items-center justify-center gap-1.5 md:py-1.5 md:px-2 py-2.5 px-3 rounded-lg md:text-xs text-sm font-medium transition-all',
                isSelected
                  ? 'bg-[var(--color-interactive-bg-strong)] text-white shadow-sm'
                  : 'bg-[var(--color-surface-tertiary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] border border-transparent hover:border-[var(--color-border-subtle)]'
              )}
            >
              {icon === 'calendar' && <JournalCalendarIcon className="md:w-3.5 md:h-3.5 w-4 h-4" date={date.date()} />}
              {icon === 'sunrise' && <SunriseIcon className="md:w-3.5 md:h-3.5 w-4 h-4" />}
              {icon === 'home' && <HomeIcon className="md:w-3.5 md:h-3.5 w-4 h-4" />}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-1.5 px-1">
        <H3 className="md:!text-[11px] !text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">{calendarMonth.format('MMMM YYYY')}</H3>
        <div className="flex items-center gap-0.5">
          <button 
            type="button"
            className="md:w-5 md:h-5 w-8 h-8 rounded-md hover:bg-[var(--color-surface-overlay)] flex items-center justify-center md:text-xs text-base transition-all" 
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCalendarMonth(m => m.subtract(1, 'month'));
            }}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button 
            type="button" 
            className="md:w-5 md:h-5 w-8 h-8 rounded-md hover:bg-[var(--color-surface-overlay)] flex items-center justify-center md:text-[10px] text-sm font-bold transition-all" 
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCalendarMonth(dayjs().startOf('month'));
            }}
            aria-label="Go to current month"
            title="Today"
          >
            •
          </button>
          <button 
            type="button"
            className="md:w-5 md:h-5 w-8 h-8 rounded-md hover:bg-[var(--color-surface-overlay)] flex items-center justify-center md:text-xs text-base transition-all" 
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setCalendarMonth(m => m.add(1, 'month'));
            }}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>
      {onClear && value && (
        <div className="mb-1.5 px-1">
          <Button
            variant="secondary"
            size="sm"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClear();
            }}
            className="w-full md:!text-[10px] !text-xs md:!py-0.5 !py-2 md:!h-6 !h-9 !text-red-600 hover:!bg-red-50 dark:hover:!bg-red-950 !border-red-100 dark:!border-red-900/50"
          >
            Clear Date
          </Button>
        </div>
      )}
      <div className="grid grid-cols-7 md:gap-0.5 gap-1 md:text-[9px] text-[11px] text-center text-[var(--color-text-disabled)] mb-0.5 font-bold uppercase tracking-tighter">
        {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 md:gap-0.5 gap-1">
        {cells}
      </div>
    </div>
  );
};

export default CalendarPicker;
