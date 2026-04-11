/**
 * @file GlassmorphPanel.tsx
 * @description Reusable glassmorphism panel component with optional color tinting
 * @app SHARED - Used for kanban columns, hero cards, and other elevated UI elements
 * 
 * Features:
 * - Beautiful frosted glass effect with backdrop blur
 * - Optional color tinting for headers/sections
 * - Consistent shadow and border styling
 * - Dark mode support
 * - Padding variants for different use cases
 */
import React from 'react';
import { cn } from '@frameer/lib/design-system';

export interface GlassmorphPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** Optional hex color for subtle tinting (e.g., #ef4444 for red) */
  tintColor?: string;
  /** Padding variant */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Show as a card with elevated shadow */
  elevated?: boolean;
  /** Apply tint to entire panel or just the border/glow */
  tintMode?: 'full' | 'border' | 'glow';
  /** Whether the panel is in a highlighted/active state (e.g. during drag over) */
  isHighlighted?: boolean;
}

/**
 * GlassmorphPanel - Beautiful frosted glass effect panel
 * 
 * Inspired by PageHero's glassmorphism effect, made reusable for kanban columns,
 * cards, and other elevated UI elements.
 * 
 * @example
 * <GlassmorphPanel tintColor="#ef4444" padding="md">
 *   <h3>Red-tinted section</h3>
 * </GlassmorphPanel>
 */
const GlassmorphPanel: React.FC<GlassmorphPanelProps> = ({
  children,
  className,
  tintColor,
  padding = 'md',
  elevated = true,
  tintMode = 'border',
  isHighlighted = false,
  ...props
}) => {
  const hasRounding = className?.includes('rounded-');

  const paddingClasses = {
    none: '',
    sm: 'p-2',
    md: 'p-4',
    lg: 'p-6',
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
      : 'rgba(156, 163, 175, 0.2)';

    if (!rgb) {
      return { 
        borderColor: defaultBorder,
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
        backgroundColor: `rgba(${rgb}, ${bgAlpha})`
      },
      glow: { 
        backgroundColor: `rgba(${rgb}, ${bgAlpha})`,
        borderColor: `rgba(${rgb}, ${alpha + 0.1})`, 
      },
    };
    
    return tintModes[tintMode] || { borderColor: defaultBorder };
  })();

  return (
    <div
      className={cn(
        // Base panel
        !hasRounding && 'rounded-xl',
        'transition-all duration-200',
        'bg-white dark:bg-[var(--color-surface-base)]',
        'border border-[var(--color-border-subtle)]',
        // Highlight state
        isHighlighted && 'ring-2 ring-[var(--color-interactive-ring)]/20',
        // Padding
        paddingClasses[padding],
        className
      )}
      style={tintStyles}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassmorphPanel;
