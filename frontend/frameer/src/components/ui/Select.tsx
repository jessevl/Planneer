import React from 'react';
import { cn } from '@frameer/lib/design-system';

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'minimal';
}

const Select: React.FC<SelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  className = '',
  size = 'md',
  variant = 'default'
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const variantClasses = {
    default: 'bg-[var(--color-surface-primary)] border border-[var(--color-border-default)] hover:border-[var(--color-accent-fg)]',
    ghost: 'bg-transparent hover:bg-[var(--color-surface-hover)] border-transparent hover:border-[var(--color-border-default)]',
    minimal: 'bg-transparent border-transparent hover:bg-[var(--color-surface-secondary)]'
  };

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'rounded-xl font-medium text-[var(--color-text-primary)] transition-colors cursor-pointer focus:outline-none focus:border-[var(--color-accent-fg)]',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {placeholder && !value && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default Select;
