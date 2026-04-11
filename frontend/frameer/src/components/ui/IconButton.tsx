import React from 'react';

type IconButtonVariant = 'default' | 'primary' | 'ghost';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  children: React.ReactNode;
}

const IconButton: React.FC<IconButtonProps> = ({
  variant = 'default',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border';
  
  const variants = {
    default: 'bg-[var(--color-surface-tertiary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border-[var(--color-border-default)]',
    primary: 'bg-[var(--color-control-checked-bg)] hover:brightness-110 text-[var(--color-control-checked-fg)] border-[var(--color-control-checked-border)]',
    ghost: 'bg-transparent hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border-transparent',
  };
  
  const sizes = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-xl',
  };
  
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default IconButton;
