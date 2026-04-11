/**
 * @file RecurrenceSelector.tsx
 * @description Compact recurrence selector for task repeat patterns
 * @app TASKS APP ONLY
 * 
 * A streamlined dropdown for setting how tasks repeat.
 * Uses preset patterns with optional custom interval.
 * Mobile-responsive: shows MobileSheet on mobile, dropdown on desktop.
 */
'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import useClickOutside from '@/hooks/useClickOutside';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { Button, TextSmall } from '@/components/ui';
import { MobileSheet } from '@/components/ui';
import { DropdownItem } from '@/components/ui';
import { RepeatIcon, SettingsIcon } from '@/components/common/Icons';
import type { RecurrencePattern, RecurrenceType } from '@/types/task';
import { describeRecurrence, DAY_NAMES_SHORT } from '@/lib/recurrenceUtils';
import { getTodayISO } from '@/lib/dateUtils';
import { cn } from '@/lib/design-system';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface RecurrenceSelectorProps {
  value?: RecurrencePattern;
  onChange: (pattern: RecurrencePattern | undefined) => void;
  anchorDate?: string;
  className?: string;
  /** Whether this is rendered inside a modal (affects mobile styling) */
  inModal?: boolean;
  /** Whether the selector is disabled (e.g., no due date set) */
  disabled?: boolean;
  /** Custom trigger element */
  trigger?: React.ReactNode;
}

type QuickOption = {
  id: string;
  label: string;
  pattern: Partial<RecurrencePattern>;
};

const QUICK_OPTIONS: QuickOption[] = [
  { id: 'daily', label: 'Daily', pattern: { type: 'daily', interval: 1 } },
  { id: 'weekdays', label: 'Weekdays', pattern: { type: 'weekly', interval: 1, weekDays: [1, 2, 3, 4, 5] } },
  { id: 'weekly', label: 'Weekly', pattern: { type: 'weekly', interval: 1 } },
  { id: 'biweekly', label: 'Every 2 weeks', pattern: { type: 'weekly', interval: 2 } },
  { id: 'monthly', label: 'Monthly', pattern: { type: 'monthly', interval: 1, monthlyType: 'dayOfMonth' } },
  { id: 'yearly', label: 'Yearly', pattern: { type: 'yearly', interval: 1 } },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const RecurrenceSelector: React.FC<RecurrenceSelectorProps> = ({
  value,
  onChange,
  anchorDate,
  className = '',
  inModal = false,
  disabled = false,
  trigger,
}) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'quick' | 'custom'>('quick');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Custom state
  const [customInterval, setCustomInterval] = useState(value?.interval || 2);
  const [customType, setCustomType] = useState<RecurrenceType>(value?.type || 'daily');
  const [customWeekDays, setCustomWeekDays] = useState<number[]>(value?.weekDays || []);

  useClickOutside([{ ref: containerRef, onOutside: () => { setIsOpen(false); setMode('quick'); } }]);

  const effectiveAnchor = anchorDate || getTodayISO();

  // Match current value to a quick option
  const matchedOption = useMemo(() => {
    if (!value) return null;
    return QUICK_OPTIONS.find(opt => {
      const p = opt.pattern;
      if (p.type !== value.type || p.interval !== value.interval) return false;
      if (p.weekDays && value.weekDays) {
        return p.weekDays.length === value.weekDays.length && 
               p.weekDays.every(d => value.weekDays!.includes(d));
      }
      return !p.weekDays && (!value.weekDays || value.weekDays.length === 0);
    })?.id || 'custom';
  }, [value]);

  const selectQuickOption = useCallback((opt: QuickOption) => {
    flushSync(() => {
      onChange({
        ...opt.pattern,
        type: opt.pattern.type!,
        interval: opt.pattern.interval!,
        endType: 'never',
        anchorDate: effectiveAnchor,
        completedCount: 0,
      } as RecurrencePattern);
    });
    setIsOpen(false);
  }, [onChange, effectiveAnchor]);

  const handleCustomSave = useCallback(() => {
    const pattern: RecurrencePattern = {
      type: customType,
      interval: customInterval,
      endType: 'never',
      anchorDate: effectiveAnchor,
      completedCount: 0,
    };
    if (customType === 'weekly' && customWeekDays.length > 0) {
      pattern.weekDays = customWeekDays;
    }
    if (customType === 'monthly') {
      pattern.monthlyType = 'dayOfMonth';
    }
    flushSync(() => {
      onChange(pattern);
    });
    setIsOpen(false);
    setMode('quick');
  }, [customType, customInterval, customWeekDays, effectiveAnchor, onChange]);

  const clearRecurrence = useCallback(() => {
    flushSync(() => {
      onChange(undefined);
    });
    setIsOpen(false);
  }, [onChange]);

  const openCustom = useCallback(() => {
    if (value) {
      setCustomInterval(value.interval);
      setCustomType(value.type);
      setCustomWeekDays(value.weekDays || []);
    }
    setMode('custom');
  }, [value]);

  const toggleWeekDay = (day: number) => {
    setCustomWeekDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a, b) => a - b)
    );
  };

  // Shared content for both mobile and desktop
  const renderQuickOptions = (mobile: boolean) => (
    <>
      {QUICK_OPTIONS.map(opt => (
        mobile ? (
          <button
            key={opt.id}
            type="button"
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); selectQuickOption(opt); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); selectQuickOption(opt); }}
            className={cn(
              'w-full px-4 py-3 text-left flex items-center justify-between text-base',
              matchedOption === opt.id 
                ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text-strong)]' 
                : 'text-[var(--color-text-primary)]'
            )}
          >
            <span>{opt.label}</span>
            {matchedOption === opt.id && (
              <svg className="w-5 h-5 text-[var(--color-interactive-text-strong)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ) : (
          <DropdownItem
            key={opt.id}
            active={matchedOption === opt.id}
            onClick={() => selectQuickOption(opt)}
          >
            {opt.label}
          </DropdownItem>
        )
      ))}
    </>
  );

  const renderCustomConfig = (mobile: boolean) => (
    <div className={mobile ? "p-4 space-y-4" : "p-3 space-y-3"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className={mobile ? "text-base font-semibold" : "text-sm font-semibold"}>Custom repeat</span>
        <button
          type="button"
          onClick={() => setMode('quick')}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          ← Back
        </button>
      </div>

      {/* Interval row */}
      <div className="flex items-center gap-2">
        <span className={mobile ? "text-base text-[var(--color-text-secondary)]" : "text-sm text-[var(--color-text-secondary)]"}>Every</span>
        <input
          type="number"
          min={1}
          max={99}
          value={customInterval}
          onChange={(e) => setCustomInterval(Math.max(1, parseInt(e.target.value) || 1))}
          className={cn(
            "text-center border border-[var(--color-border-default)] rounded-lg bg-[var(--color-surface-base)] focus:outline-none focus:border-[var(--color-interactive-border)]",
            mobile ? "w-16 h-10 px-2 text-base" : "w-12 h-8 px-2 text-sm"
          )}
        />
        <select
          value={customType}
          onChange={(e) => setCustomType(e.target.value as RecurrenceType)}
          className={cn(
            "border border-[var(--color-border-default)] rounded-lg bg-[var(--color-surface-base)] focus:outline-none focus:border-[var(--color-interactive-border)]",
            mobile ? "h-10 px-3 text-base" : "h-8 px-2 text-sm"
          )}
        >
          <option value="daily">{customInterval === 1 ? 'day' : 'days'}</option>
          <option value="weekly">{customInterval === 1 ? 'week' : 'weeks'}</option>
          <option value="monthly">{customInterval === 1 ? 'month' : 'months'}</option>
          <option value="yearly">{customInterval === 1 ? 'year' : 'years'}</option>
        </select>
      </div>

      {/* Weekday pills (weekly only) */}
      {customType === 'weekly' && (
        <div className="flex gap-1 justify-center">
          {DAY_NAMES_SHORT.map((day, i) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleWeekDay(i)}
              className={cn(
                'font-semibold rounded-full transition-all',
                mobile ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs',
                customWeekDays.includes(i)
                  ? 'bg-[var(--color-interactive-bg-strong)] text-white shadow-sm'
                  : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)]'
              )}
            >
              {day.charAt(0)}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size={mobile ? "md" : "sm"} onClick={() => setMode('quick')}>
          Cancel
        </Button>
        <Button variant="primary" size={mobile ? "md" : "sm"} onClick={handleCustomSave}>
          Apply
        </Button>
      </div>
    </div>
  );

  const renderClearOption = (mobile: boolean) => (
    value && (
      mobile ? (
        <div className="border-t border-[var(--color-border-subtle)]">
          <button
            type="button"
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); clearRecurrence(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearRecurrence(); }}
            className="w-full px-4 py-3 text-left flex items-center gap-3 text-base text-red-600 dark:text-red-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="font-medium">Clear Repeat</span>
          </button>
        </div>
      ) : (
        <div className="border-t border-[var(--color-border-subtle)] p-1.5">
          <button
            type="button"
            onClick={clearRecurrence}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Clear</span>
          </button>
        </div>
      )
    )
  );

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {trigger ? (
        <div onClick={() => !disabled && setIsOpen(!isOpen)}>
          {trigger}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          title={disabled ? 'Set a due date first to enable repeat' : undefined}
          className={cn(
            'flex items-center gap-1.5 font-medium transition-all bg-transparent rounded-xl w-full text-sm',
            isMobile && inModal ? 'px-3 py-3' : 'px-2.5 py-1.5',
            disabled && 'text-[var(--color-text-disabled)] cursor-not-allowed opacity-50',
            !disabled && value && 'text-[var(--color-interactive-text-strong)]',
            !disabled && !value && 'text-[var(--color-text-secondary)]'
          )}
        >
          <RepeatIcon className={isMobile && inModal ? "w-5 h-5" : "w-4 h-4"} />
          <span className={isMobile && inModal ? "flex-1 text-left truncate" : ""}>{value ? describeRecurrence(value) : 'Repeat'}</span>
        </button>
      )}

      {/* Mobile: MobileSheet */}
      {isMobile && isOpen ? (
        <MobileSheet
          isOpen={isOpen}
          onClose={() => { setIsOpen(false); setMode('quick'); }}
          title={mode === 'custom' ? 'Custom Repeat' : 'Set Repeat'}
        >
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {mode === 'quick' ? (
              <>
                <div className="flex flex-col p-2">
                  {renderQuickOptions(true)}
                  <button
                    type="button"
                    onClick={() => setMode('custom')}
                    className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 text-[var(--color-text-primary)]"
                  >
                    <SettingsIcon className="w-5 h-5 opacity-60" />
                    <span className="text-base font-medium">Custom...</span>
                  </button>
                </div>
                <div className="p-2">
                  {renderClearOption(true)}
                </div>
              </>
            ) : (
              renderCustomConfig(true)
            )}
          </div>
        </MobileSheet>
      ) : !isMobile && isOpen ? (
        /* Desktop: Dropdown */
        <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-[var(--color-surface-primary)] border border-[var(--color-border-default)] rounded-xl shadow-lg overflow-hidden">
          {mode === 'quick' ? (
            <>
              <div className="p-1.5">
                {renderQuickOptions(false)}
                <button
                  type="button"
                  onClick={() => setMode('custom')}
                  className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]"
                >
                  <SettingsIcon className="w-4 h-4 opacity-60" />
                  <span className="text-sm font-medium">Custom...</span>
                </button>
              </div>
              <div className="border-t border-[var(--color-border-subtle)] p-1.5">
                {renderClearOption(false)}
              </div>
            </>
          ) : (
            renderCustomConfig(false)
          )}
        </div>
      ) : null}
    </div>
  );
};


export default RecurrenceSelector;
