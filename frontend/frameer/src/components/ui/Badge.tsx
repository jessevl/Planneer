import React from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'secondary';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'default',
  className = '' 
}) => {
  const variants = {
    default: 'bg-[var(--color-surface-primary)]/50 text-[var(--color-text-secondary)] border-[var(--color-border-subtle)]',
    secondary: 'bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]',
    primary: 'bg-[var(--color-accent-muted)] text-[var(--color-accent-fg)] border-[var(--color-accent-emphasis)]/30',
    success: 'bg-[var(--color-state-success)]/20 text-[var(--color-state-success)] border-[var(--color-state-success)]/30',
    warning: 'bg-[var(--color-state-warning)]/20 text-[var(--color-state-warning)] border-[var(--color-state-warning)]/30',
    danger: 'bg-[var(--color-state-error)]/20 text-[var(--color-state-error)] border-[var(--color-state-error)]/30',
  };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold tracking-wide backdrop-blur-xl border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
