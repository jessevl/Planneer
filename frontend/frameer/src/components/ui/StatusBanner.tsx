/**
 * @file StatusBanner.tsx
 * @description Contextual status banners for pages and other content
 * @app SHARED - Reusable status messaging component
 * 
 * Provides consistent styling for different status types:
 * - offline: Content unavailable due to offline state
 * - warning: Content may be incomplete or have issues
 * - info: Informational messages
 * - error: Error states (use ErrorBanner for dismissible errors)
 * 
 * Follows the app's glass design system with subtle backgrounds
 * and consistent iconography.
 */
import React, { memo } from 'react';
import { WifiOff, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export type StatusBannerVariant = 'offline' | 'warning' | 'info' | 'error';

interface StatusBannerProps {
  /** The type of status to display */
  variant: StatusBannerVariant;
  /** Main message title */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional CSS classes */
  className?: string;
}

const variantConfig = {
  offline: {
    icon: WifiOff,
    containerClass: 'bg-[var(--color-surface-tertiary)]/80 border-[var(--color-border-default)]',
    iconClass: 'text-[var(--color-text-tertiary)]',
    titleClass: 'text-[var(--color-text-secondary)]',
    descClass: 'text-[var(--color-text-tertiary)]',
    actionClass: 'text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] hover:bg-[var(--color-surface-hover)]/80',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'bg-[var(--color-state-warning)]/10 border-[var(--color-state-warning)]/30',
    iconClass: 'text-[var(--color-state-warning)]',
    titleClass: 'text-[var(--color-state-warning)]',
    descClass: 'text-[var(--color-state-warning)]/80',
    actionClass: 'text-[var(--color-state-warning)] bg-[var(--color-state-warning)]/10 hover:bg-[var(--color-state-warning)]/20',
  },
  info: {
    icon: Info,
    containerClass: 'bg-[var(--color-accent-muted)] border-[var(--color-accent-emphasis)]/30',
    iconClass: 'text-[var(--color-accent-fg)]',
    titleClass: 'text-[var(--color-accent-fg)]',
    descClass: 'text-[var(--color-accent-fg)]/80',
    actionClass: 'text-[var(--color-accent-fg)] bg-[var(--color-accent-muted)] hover:bg-[var(--color-accent-emphasis)]/20',
  },
  error: {
    icon: AlertCircle,
    containerClass: 'bg-[var(--color-state-error)]/10 border-[var(--color-state-error)]/30',
    iconClass: 'text-[var(--color-state-error)]',
    titleClass: 'text-[var(--color-state-error)]',
    descClass: 'text-[var(--color-state-error)]/80',
    actionClass: 'text-[var(--color-state-error)] bg-[var(--color-state-error)]/10 hover:bg-[var(--color-state-error)]/20',
  },
};

/**
 * StatusBanner - Contextual status messages for content
 * 
 * @example
 * // Offline unavailable
 * <StatusBanner
 *   variant="offline"
 *   title="Content not available offline"
 *   description="Connect to the internet to view this note."
 * />
 * 
 * @example
 * // Partial content warning
 * <StatusBanner
 *   variant="warning"
 *   title="Content may be incomplete"
 *   description="Some content was synced via real-time updates but the full note hasn't been loaded."
 *   action={{ label: "Load full content", onClick: handleRefresh }}
 * />
 */
export const StatusBanner = memo<StatusBannerProps>(function StatusBanner({
  variant,
  title,
  description,
  action,
  className = '',
}) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div 
      className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm ${config.containerClass} ${className}`}
      role="status"
      aria-live="polite"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconClass}`} />
      
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${config.titleClass}`}>
          {title}
        </p>
        {description && (
          <p className={`text-sm mt-1 ${config.descClass}`}>
            {description}
          </p>
        )}
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${config.actionClass}`}
        >
          {action.label}
        </button>
      )}
    </div>
  );
});

export default StatusBanner;
