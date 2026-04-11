'use client';

import React from 'react';
import { cn } from '@frameer/lib/design-system';

export interface ColorPickerProps {
  selectedColor: string;
  onChange: (color: string) => void;
  colors?: string[];
  className?: string;
}

const DEFAULT_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
  '#64748b', // slate
];

/**
 * ColorPicker - Color selection component
 * 
 * @example
 * <ColorPicker
 *   selectedColor={project.color}
 *   onChange={(color) => setProject({ ...task page, color })}
 * />
 */
const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onChange,
  colors = DEFAULT_COLORS,
  className,
}) => {
  return (
    <div className={cn('grid grid-cols-9 gap-2', className)}>
      {colors.map((color) => {
        const isSelected = color === selectedColor;
        
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              'w-9 h-9 rounded-full transition-all',
              'border-2',
              isSelected
                ? 'border-[var(--color-text-primary)] scale-110'
                : 'border-[var(--color-border-default)] hover:scale-105'
            )}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
            aria-pressed={isSelected}
          >
            {isSelected && (
              <svg
                className="w-5 h-5 mx-auto text-white drop-shadow-lg"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ColorPicker;
