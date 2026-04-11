'use client';

import React from 'react';
import { cn } from '@frameer/lib/design-system';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Checkbox - Standardized checkbox component
 * 
 * @example
 * <Checkbox 
 *   checked={task.completed} 
 *   onChange={(checked) => handleToggle(checked)}
 *   size="md"
 * />
 */
const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  className,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const iconSize = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        sizeClasses[size],
        'rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0',
        checked
          ? 'bg-[var(--color-control-checked-bg)] border-[var(--color-control-checked-border)] text-[var(--color-control-checked-fg)]'
          : 'bg-[var(--color-control-unchecked-bg)] border-[var(--color-control-unchecked-border)] hover:border-[var(--color-stone-500)]',
        disabled && 'opacity-50 cursor-not-allowed',
        !disabled && 'cursor-pointer',
        className
      )}
      aria-label={checked ? 'Uncheck' : 'Check'}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && (
        <svg
          width={iconSize[size]}
          height={iconSize[size]}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
};

export default Checkbox;
