/**
 * @file ErrorBanner.tsx
 * @description Dismissible error banner for showing API/sync errors to users
 * @app SHARED - Can be used anywhere in the app
 */
import React from 'react';
import { X, AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  details?: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  message,
  details,
  onDismiss,
  onRetry,
}) => {
  return (
    <div className="bg-[var(--color-state-error)]/10 border-b border-[var(--color-state-error)]/30 px-4 py-3">
      <div className="flex items-start gap-3 max-w-4xl mx-auto">
        <AlertTriangle className="w-5 h-5 text-[var(--color-state-error)] flex-shrink-0 mt-0.5" />
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-state-error)]">
            {message}
          </p>
          {details && (
            <p className="mt-1 text-xs text-[var(--color-state-error)]/80 font-mono truncate">
              {details}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium
                       text-[var(--color-state-error)] bg-[var(--color-state-error)]/10
                       hover:bg-[var(--color-state-error)]/20 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
          
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 text-[var(--color-state-error)] hover:text-[var(--color-state-error)]/80
                       rounded transition-colors"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorBanner;
