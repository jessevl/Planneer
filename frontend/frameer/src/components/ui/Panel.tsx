import React from 'react';
import { cn } from '@frameer/lib/design-system';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** Optional hex color for subtle tinting (e.g., #ef4444 for red) */
  tintColor?: string;
  /** Apply tint to entire panel or just the border/glow */
  tintMode?: 'full' | 'border' | 'glow';
  /** Padding variant */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Shadow variant */
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  /** Whether the panel is in a highlighted/active state (e.g. during drag over) */
  isHighlighted?: boolean;
  /** Whether to apply glassmorphism effect (backdrop blur) */
  glass?: boolean;
  /** Background color variant */
  bg?: 'white' | 'gray-50' | 'gray-100' | 'canvas' | 'none';
  /** Whether to show a border */
  border?: boolean;
  /** Whether the panel is sticky */
  sticky?: boolean;
  /** Hover effect */
  hover?: boolean;
  /** Interactive cursor */
  interactive?: boolean;
  /** Opacity level (e.g., "95", "90") - applied via Tailwind class */
  opacity?: string;
  /** Whether to show gradient background */
  gradient?: boolean;
  /** Blur level (e.g., "md", "lg") - applied via Tailwind class */
  blur?: string;
}

/**
 * Panel - Unified container component for cards, sections, and modals.
 * Replaces the legacy GlassmorphPanel and basic Panel.
 */
const Panel: React.FC<PanelProps> = ({ 
  children, 
  className = '',
  tintColor,
  tintMode = 'border',
  padding = 'md',
  shadow = 'none',
  isHighlighted = false,
  glass = false,
  bg = 'white',
  border = true,
  sticky = false,
  hover = false,
  interactive = false,
  opacity,
  gradient,
  blur,
  ...rest
}) => {
  const hasRounding = className.includes('rounded-');
  
  const paddingClasses = {
    none: '',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
  };

  const shadowClasses = {
    none: '',
    sm: 'shadow-sm shadow-black/5 dark:shadow-black/10',
    md: 'shadow-md shadow-black/5 dark:shadow-black/20',
    lg: 'shadow-lg shadow-black/10 dark:shadow-black/30',
  };

  const bgClasses = {
    white: 'bg-[var(--color-surface-primary)]',
    'gray-50': 'bg-[var(--color-surface-secondary)]',
    'gray-100': 'bg-[var(--color-surface-tertiary)]',
    canvas: 'bg-[var(--color-surface-primary)]',
    none: 'bg-transparent',
  };

  // Convert hex color to RGB for alpha transparency
  const hexToRgb = (hex: string): string | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : null;
  };

  const rgb = tintColor ? hexToRgb(tintColor) : null;
  
  const tintStyles = (() => {
    // Default border color if no tint is provided
    const defaultBorder = isHighlighted 
      ? 'rgba(59, 130, 246, 0.4)' // Subtle blue when highlighted
      : undefined;

    if (!rgb) {
      return { 
        ...(defaultBorder ? { borderColor: defaultBorder } : {}),
        ...(isHighlighted ? { backgroundColor: 'rgba(59, 130, 246, 0.05)' } : {})
      };
    }
    
    const alpha = isHighlighted ? 0.6 : 0.3;
    const bgAlpha = isHighlighted ? 0.08 : 0.04; // Subtle background tint
    
    const tintModes = {
      full: { 
        backgroundColor: `rgba(${rgb}, ${bgAlpha + 0.02})`, 
        borderColor: `rgba(${rgb}, ${alpha})` 
      },
      border: { 
        borderColor: `rgba(${rgb}, ${alpha})`, 
      },
      glow: { 
        backgroundColor: `rgba(${rgb}, ${bgAlpha})`,
        borderColor: `rgba(${rgb}, ${alpha + 0.1})`, 
      },
    };
    
    return tintModes[tintMode] || { borderColor: defaultBorder };
  })();

  // Build opacity class
  const opacityClass = opacity ? `bg-opacity-${opacity} dark:bg-opacity-${opacity}` : '';
  
  // Build blur class (for backdrop blur)
  const blurClass = blur ? `backdrop-blur-${blur}` : '';

  return (
    <div 
      className={cn(
        'relative transition-all duration-200',
        !hasRounding && 'rounded-xl',
        glass && 'backdrop-blur-xl',
        blurClass,
        gradient && 'bg-gradient-to-br from-[var(--color-surface-primary)] to-[var(--color-surface-secondary)]',
        !gradient && bgClasses[bg],
        border && 'border border-[var(--color-border-default)]',
        shadowClasses[shadow],
        sticky && 'sticky top-0 z-10',
        hover && 'hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-accent-fg)]',
        interactive && 'cursor-pointer',
        isHighlighted && 'ring-2 ring-[var(--color-accent-emphasis)]/20',
        paddingClasses[padding],
        opacityClass,
        className
      )}
      style={tintStyles}
      {...rest}
    >
      {children}
    </div>
  );
};

export default Panel;
