'use client';

/**
 * @file Icon.tsx
 * @description Standardized icon wrapper component for consistent styling
 * @app SHARED - Wrapper for Lucide icons ensuring consistent appearance
 * 
 * This component wraps Lucide icons with standardized stroke width and
 * sizing for visual consistency across the application.
 * 
 * Usage:
 * ```tsx
 * import { Icon } from '@frameer/components/ui';
 * import { Star, Heart, Check } from 'lucide-react';
 * 
 * <Icon icon={Star} />
 * <Icon icon={Heart} size="lg" className="text-red-500" />
 * <Icon icon={Check} size="sm" />
 * ```
 */

import React from 'react';
import { cn } from '@frameer/lib/design-system';
import { ICON_STROKE_WIDTH, ICON_SIZE_CLASSES, type IconSize } from '@frameer/lib/iconUtils';
import type { LucideIcon, LucideProps } from 'lucide-react';

export interface IconProps extends Omit<LucideProps, 'size'> {
  /** The Lucide icon component to render */
  icon: LucideIcon;
  /** Icon size preset */
  size?: IconSize;
  /** Additional CSS classes */
  className?: string;
  /** Override the standard stroke width (use sparingly) */
  strokeWidth?: number;
}

/**
 * Icon - Standardized wrapper for Lucide icons
 * 
 * Ensures all icons use consistent stroke width and sizing
 * across the application for visual harmony.
 */
export const Icon: React.FC<IconProps> = ({
  icon: IconComponent,
  size = 'default',
  className,
  strokeWidth = ICON_STROKE_WIDTH,
  ...props
}) => {
  return (
    <IconComponent
      className={cn(ICON_SIZE_CLASSES[size], className)}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
};

/**
 * Higher-order component to wrap a Lucide icon with standard props
 * 
 * Usage:
 * ```tsx
 * import { Star } from 'lucide-react';
 * const StandardStar = withStandardIcon(Star);
 * <StandardStar className="text-yellow-500" />
 * ```
 */
export function withStandardIcon(IconComponent: LucideIcon) {
  const WrappedIcon: React.FC<Omit<IconProps, 'icon'>> = (props) => (
    <Icon icon={IconComponent} {...props} />
  );
  WrappedIcon.displayName = `Standard${IconComponent.displayName || 'Icon'}`;
  return WrappedIcon;
}

export default Icon;
