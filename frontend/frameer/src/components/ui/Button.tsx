import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

/**
 * Button component using semantic design tokens.
 * 
 * Tokens used:
 * - Primary: accent colors (amber in light, blue in dark)
 * - Secondary: surface-secondary, border-default
 * - Ghost: transparent with surface-hover on hover
 * - Danger: danger-fg colors
 */
const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border';
  
  // Using semantic token CSS variables for automatic light/dark mode switching
  const variants = {
    primary: [
      'bg-[var(--color-button-primary-bg)]',
      'hover:bg-[var(--color-button-primary-bg-hover)]',
      'text-[var(--color-button-primary-text)]',
      'border-[var(--color-button-primary-bg)]',
      'hover:border-[var(--color-button-primary-bg-hover)]',
    ].join(' '),
    secondary: [
      'bg-[var(--color-button-secondary-bg)]',
      'hover:bg-[var(--color-button-secondary-bg-hover)]',
      'text-[var(--color-button-secondary-text)]',
      'border-[var(--color-button-secondary-border)]',
    ].join(' '),
    ghost: [
      'bg-transparent',
      'hover:bg-[var(--color-button-ghost-bg-hover)]',
      'text-[var(--color-button-ghost-text)]',
      'hover:text-[var(--color-button-ghost-text-hover)]',
      'border-transparent',
      'hover:border-[var(--color-border-subtle)]',
    ].join(' '),
    danger: [
      'bg-[var(--color-danger-fg)]',
      'hover:bg-red-700',
      'text-white',
      'border-[var(--color-danger-fg)]',
      'hover:border-red-700',
    ].join(' '),
    'danger-outline': [
      'bg-transparent',
      'hover:bg-[var(--color-danger-bg)]',
      'text-[var(--color-danger-fg)]',
      'border-[var(--color-danger-border)]',
      'hover:border-[var(--color-danger-fg)]',
    ].join(' '),
    glass: [
      'bg-white/40 dark:bg-white/5',
      'hover:bg-white/60 dark:hover:bg-white/10',
      'text-[var(--color-text-primary)]',
      'border-white/50 dark:border-white/10',
      'backdrop-blur-md',
    ].join(' '),
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-full',
    md: 'px-4 py-2 text-base rounded-full',
    lg: 'px-6 py-3 text-lg rounded-full',
  };
  
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
