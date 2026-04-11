/**
 * Settings UI - Shared primitives for settings panels
 * Toggle switches, sliders, segmented controls, cards, collapsibles, etc.
 * 
 * These are compact, settings-specific components distinct from the general UI library.
 * They use CSS custom properties for theming (var(--color-*)).
 */

import React, { useState } from 'react';
import { cn } from '@frameer/lib/design-system';
import { Loader2, Check, AlertCircle, ChevronDown } from 'lucide-react';

// ── Reusable className fragments ──────────────────────────────────────────────

export const sliderClass = [
  'settings-slider h-2 w-full cursor-pointer appearance-none rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-tertiary)]',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)]',
  '[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border-none [&::-webkit-slider-runnable-track]:bg-transparent',
  '[&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4.5 [&::-webkit-slider-thumb]:w-4.5',
  '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--color-surface-base)] [&::-webkit-slider-thumb]:bg-[var(--color-control-checked-bg)]',
  '[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer',
  '[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:border-none [&::-moz-range-track]:bg-transparent',
  '[&::-moz-range-thumb]:h-4.5 [&::-moz-range-thumb]:w-4.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2',
  '[&::-moz-range-thumb]:border-[var(--color-surface-base)] [&::-moz-range-thumb]:bg-[var(--color-control-checked-bg)]',
].join(' ');

export const settingsInputClass = cn(
  'w-full px-3 py-1.5 rounded-lg border text-sm',
  'bg-[var(--color-surface-inset)] border-[var(--color-border-default)]',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)]',
  'focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-fg)] focus:border-transparent',
);

// ── Settings Toggle Switch ────────────────────────────────────────────────────

export const SettingsToggle: React.FC<{
  enabled: boolean;
  onChange: (v: boolean) => void;
}> = ({ enabled, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    data-state={enabled ? 'checked' : 'unchecked'}
    onClick={() => onChange(!enabled)}
    className={cn(
      'settings-toggle relative h-[22px] w-10 rounded-full border transition-all duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)]',
      enabled
        ? 'border-[var(--color-control-checked-border)] bg-[var(--color-control-checked-bg)]'
        : 'border-[var(--color-control-unchecked-border)] bg-[var(--color-control-unchecked-bg)]',
    )}
  >
    <span
      className={cn(
        'settings-toggle-thumb absolute top-[3px] h-4 w-4 rounded-full border transition-transform duration-200',
        enabled
          ? 'bg-[var(--color-control-checked-fg)]'
          : 'bg-[var(--color-text-primary)]',
        enabled
          ? 'border-[var(--color-control-checked-fg)]'
          : 'border-[var(--color-control-unchecked-border)]',
        enabled ? 'left-[22px]' : 'left-[3px]',
      )}
    />
  </button>
);

// ── Toggle Row (label + optional description + toggle) ────────────────────────

export const SettingsToggleRow: React.FC<{
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, description, enabled, onChange }) => (
  <div className="flex items-center justify-between gap-4 py-1.5">
    <div className="min-w-0">
      <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
      {description && (
        <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{description}</p>
      )}
    </div>
    <SettingsToggle enabled={enabled} onChange={onChange} />
  </div>
);

// ── Segmented Control ─────────────────────────────────────────────────────────

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented-control settings-segmented-control inline-flex gap-0.5 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          data-selected={value === opt.value}
          data-state={value === opt.value ? 'checked' : 'unchecked'}
          className={cn(
            'segmented-control-option settings-segmented-control-option rounded-lg border border-transparent px-3 py-1.5 text-sm font-medium transition-all',
            value === opt.value
              ? 'bg-[var(--color-surface-base)] text-[var(--color-text-primary)] border-[var(--color-border-default)] shadow-sm'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Slider Row ────────────────────────────────────────────────────────────────

export const SliderRow: React.FC<{
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (v: number) => string;
  onChange: (v: number) => void;
}> = ({ label, description, value, min, max, step = 1, unit = '', formatValue, onChange }) => (
  <div className="py-1.5">
    <div className="flex items-center justify-between mb-1.5">
      <div className="min-w-0">
        <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
        {description && (
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{description}</p>
        )}
      </div>
      <span className="text-xs font-mono text-[var(--color-text-tertiary)] ml-3 flex-shrink-0">
        {formatValue ? formatValue(value) : `${value}${unit}`}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className={sliderClass}
    />
  </div>
);

// ── Settings Section Header ─────────────────────────────────────────────────

export const SettingsSectionHeader: React.FC<{
  title: string;
  description?: string;
}> = ({ title, description }) => (
  <div className="pt-1 pb-0.5">
    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
      {title}
    </h4>
    {description && (
      <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{description}</p>
    )}
  </div>
);

// ── Separator ─────────────────────────────────────────────────────────────────

export const SettingsSeparator: React.FC = () => (
  <div className="border-t border-[var(--color-border-subtle)] my-1" />
);

// ── Settings Card Wrapper ─────────────────────────────────────────────────────

export const SettingsCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn('bg-[var(--color-surface-secondary)] rounded-xl p-3', className)}>
    {children}
  </div>
);

// ── Status Message (error / success banner) ───────────────────────────────────

export const SettingsStatusMessage: React.FC<{
  type: 'error' | 'success';
  message: string;
}> = ({ type, message }) => (
  <div
    className={cn(
      'flex items-center gap-2 p-2.5 rounded-lg text-sm',
      type === 'error'
        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
        : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    )}
  >
    {type === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}
    {message}
  </div>
);

// ── Collapsible Section ───────────────────────────────────────────────────────

export const SettingsCollapsible: React.FC<{
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, description, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[var(--color-border-subtle)] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <div>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{title}</span>
          {description && (
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{description}</p>
          )}
        </div>
        <ChevronDown
          size={16}
          className={cn(
            'text-[var(--color-text-tertiary)] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && <div className="px-3 pt-3 pb-3 space-y-3 border-t border-[var(--color-border-subtle)]">{children}</div>}
    </div>
  );
};

// ── Save Button ───────────────────────────────────────────────────────────────

export const SettingsSaveButton: React.FC<{
  saving: boolean;
  success: boolean;
  onClick: () => void;
  label?: string;
}> = ({ saving, success, onClick, label = 'Save' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={saving}
    className={cn(
      'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all',
      'bg-[var(--color-accent-primary)] text-white',
      'hover:bg-[var(--color-accent-hover)]',
      'disabled:opacity-50 disabled:cursor-not-allowed',
    )}
  >
    {saving ? <Loader2 size={14} className="animate-spin" /> : success ? <Check size={14} /> : null}
    {saving ? 'Saving…' : success ? 'Saved!' : label}
  </button>
);

// ── Action Button (for maintenance operations etc.) ───────────────────────────

export const SettingsActionButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon: React.ReactNode;
  loadingIcon?: React.ReactNode;
  label: string;
  variant?: 'default' | 'danger';
  className?: string;
}> = ({ onClick, disabled, loading, icon, loadingIcon, label, variant = 'default', className }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    className={cn(
      'flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
      variant === 'danger'
        ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
        : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      className,
    )}
  >
    {loading ? (loadingIcon || <Loader2 size={14} className="animate-spin" />) : icon}
    {label}
  </button>
);

// ── Number Input (compact) ────────────────────────────────────────────────────

export const SettingsNumberInput: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  className?: string;
}> = ({ value, min, max, onChange, className }) => (
  <input
    type="number"
    min={min}
    max={max}
    value={value}
    onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || min)))}
    className={cn(
      'w-16 px-2 py-1 rounded-md border text-sm text-right',
      'bg-[var(--color-surface-primary)] text-[var(--color-text-primary)] border-[var(--color-border-default)]',
      className,
    )}
  />
);

// ── Utility ───────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
