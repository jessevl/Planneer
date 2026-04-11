/**
 * @file ErrorBoundary.tsx
 * @description React Error Boundary for catching and displaying runtime errors
 * @app SHARED - Global error handling
 *
 * Catches JavaScript errors in child component tree and displays
 * a fallback UI instead of crashing the whole app.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { logError, toErrorInfo, ErrorInfo as ErrorInfoType } from '@/lib/errors';

interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Optional fallback component */
  fallback?: ReactNode;
  /** Optional callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show reset/refresh buttons. Default: true */
  showActions?: boolean;
  /** Context name for logging */
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfoType | null;
}

/**
 * Error Boundary component that catches runtime errors
 * 
 * @example
 * <ErrorBoundary context="TaskList" onError={trackError}>
 *   <TaskList />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorInfo: toErrorInfo(error),
    };
  }

  componentDidCatch(error: Error, reactErrorInfo: ErrorInfo): void {
    const { onError, context } = this.props;
    
    // Log the error
    logError(error, context || 'ErrorBoundary', {
      componentStack: reactErrorInfo.componentStack,
    });

    // Call optional callback
    onError?.(error, reactErrorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleRefresh = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showActions = true } = this.props;

    if (!hasError) {
      return children;
    }

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    // Default error UI
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/30 
                        flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
            Something went wrong
          </h2>

          {/* Message */}
          <p className="text-[var(--color-text-secondary)] mb-6">
            {errorInfo?.message || 'An unexpected error occurred'}
          </p>

          {/* Error details (dev mode) */}
          {import.meta.env.DEV && error && (
            <details className="mb-6 text-left">
              <summary className="cursor-pointer text-sm text-[var(--color-text-secondary)]
                                flex items-center gap-2 justify-center hover:text-[var(--color-text-primary)]">
                <Bug className="w-4 h-4" />
                Error details
              </summary>
              <pre className="mt-2 p-3 bg-[var(--color-surface-secondary)] rounded-md 
                            text-xs text-left overflow-auto max-h-48
                            text-[var(--color-text-secondary)]">
                {error.stack || error.message}
              </pre>
            </details>
          )}

          {/* Actions */}
          {showActions && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2
                         bg-[var(--color-interactive-bg-strong)] text-white rounded-md hover:brightness-110
                         transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-4 py-2
                         bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]
                         rounded-md hover:bg-[var(--color-surface-tertiary)]
                         transition-colors font-medium"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}

/**
 * Hook-style error boundary wrapper using a function component
 */
interface WithErrorBoundaryOptions {
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string;
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: WithErrorBoundaryOptions = {}
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <ErrorBoundary {...options}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `WithErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

export default ErrorBoundary;
