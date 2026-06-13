/**
 * @file IconColorPicker.tsx
 * @description Combined color swatch grid + Lucide icon picker for page icon/color editing
 * @app SHARED - Used by PageHero and PageMetaPanel
 *
 * Renders a compact color palette followed by a collapsible icon picker
 * (the curated Lucide icon set). The currently-selected color tints the
 * preview icon for visual continuity with the rest of the app.
 */
import React from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { IconPicker, LucideIcon } from '@/components/ui';
import { cn } from '@/lib/design-system';

export const ICON_PRESET_COLORS: { color: string; name: string }[] = [
  { color: '#ef4444', name: 'Red' },
  { color: '#f97316', name: 'Orange' },
  { color: '#eab308', name: 'Yellow' },
  { color: '#22c55e', name: 'Green' },
  { color: '#14b8a6', name: 'Teal' },
  { color: '#0ea5e9', name: 'Sky' },
  { color: '#3b82f6', name: 'Blue' },
  { color: '#6366f1', name: 'Indigo' },
  { color: '#8b5cf6', name: 'Violet' },
  { color: '#a855f7', name: 'Purple' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#64748b', name: 'Slate' },
];

export interface IconColorPickerProps {
  icon: string | null;
  color: string | null;
  /** Combined change handler — receives the next (icon, color) pair. */
  onChange: (icon: string | null, color: string | null) => void;
  /** When set, automatically closes the icon sub-picker after a selection. */
  onIconSelected?: () => void;
}

const IconColorPicker: React.FC<IconColorPickerProps> = ({
  icon,
  color,
  onChange,
  onIconSelected,
}) => {
  const [showIconSubPicker, setShowIconSubPicker] = React.useState(false);

  return (
    <div className="px-2 py-2 w-[280px]">
      <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2 px-1">Color</p>
      <div className="grid grid-cols-6 gap-1.5 px-1 mb-3">
        {ICON_PRESET_COLORS.map(({ color: c, name }) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(icon ?? null, c)}
            className={cn(
              'w-7 h-7 rounded-lg transition-all hover:scale-110',
              color === c && 'ring-2 ring-offset-1 ring-[var(--color-text-primary)] ring-offset-[var(--color-surface-base)]'
            )}
            style={{ backgroundColor: c }}
            title={name}
          >
            {color === c && (
              <svg className="w-3.5 h-3.5 m-auto text-white drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}
      </div>
      <div className="h-px bg-[var(--color-border-default)] -mx-2 mb-2" />
      <button
        type="button"
        onClick={() => setShowIconSubPicker((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors',
          showIconSubPicker
            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
        )}
      >
        <div className="flex items-center gap-2.5">
          {icon ? (
            <LucideIcon name={icon} className="w-4 h-4" style={{ color: color || '#6b7280' }} />
          ) : (
            <Sparkles className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          )}
          <span>Icon</span>
        </div>
        <div className="flex items-center gap-1 text-[var(--color-text-tertiary)]">
          <span className="text-xs">{icon || 'Auto'}</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform', showIconSubPicker && 'rotate-180')} />
        </div>
      </button>
      {showIconSubPicker && (
        <div className="py-1 px-0.5">
          <IconPicker
            selectedIcon={icon ?? null}
            onChange={(iconName) => {
              onChange(iconName, color ?? null);
              if (iconName !== null) {
                setShowIconSubPicker(false);
                onIconSelected?.();
              }
            }}
            allowClear
            previewColor={color || undefined}
            compact
          />
        </div>
      )}
    </div>
  );
};

export default IconColorPicker;
