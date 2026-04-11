import React from 'react';
import { cn } from '@frameer/lib/design-system';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  /** Enhanced hover with lift and shadow effect */
  hoverLift?: boolean;
  glass?: boolean;
  opacity?: 'subtle' | 'light' | 'medium' | 'heavy';
  onClick?: () => void;
}

/**
 * Card component using semantic design tokens.
 * 
 * Tokens used:
 * - surface-primary: main card background (white/dark default)
 * - border-subtle: card border
 * - surface-hover: hover background
 * - accent-primary: hover border accent
 */
const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hover = false,
  hoverLift = false,
  glass = false, // Deprecated
  opacity = 'medium',
  onClick 
}) => {
  const baseClasses = 'rounded-xl border bg-[var(--color-surface-primary)] border-[var(--color-border-subtle)]';
  const hoverClasses = hover 
    ? 'hover:border-[var(--color-accent-primary)] hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors duration-200' 
    : '';
  const hoverLiftClasses = hoverLift
    ? 'card-hover cursor-pointer'
    : '';
  
  return (
    <div
      className={cn(baseClasses, hoverClasses, hoverLiftClasses, className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
