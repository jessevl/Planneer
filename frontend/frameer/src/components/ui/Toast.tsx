/**
 * @file Toast.tsx
 * @description Toast notification system with undo support
 * 
 * Provides brief toast notifications with optional undo action
 * for destructive operations like delete, complete, etc.
 * 
 * Positioning:
 * - Mobile: Bottom right (avoid FAB)
 * - Desktop: Bottom center (avoid FAB overlap)
 */
import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { create } from 'zustand';
import { XIcon } from '@frameer/components/common/Icons';
import { CheckCircle, AlertCircle, Info, AlertTriangle, Undo2 } from 'lucide-react';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

// ============================================================================
// TOAST STORE
// ============================================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  /** Optional undo action */
  onUndo?: () => void;
  /** Optional custom action */
  action?: ToastAction;
  /** Duration in ms (default: 4000) */
  duration?: number;
  /** Whether the toast is dismissible */
  dismissible?: boolean;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastItem = {
      ...toast,
      id,
      duration: toast.duration ?? 4000,
      dismissible: toast.dismissible ?? true,
    };
    
    set({ toasts: [...get().toasts, newToast] });
    
    // Auto-remove after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, newToast.duration);
    }
    
    return id;
  },
  
  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  
  clearAll: () => {
    set({ toasts: [] });
  },
}));

// ============================================================================
// TOAST HELPERS
// ============================================================================

/**
 * Show a success toast
 */
export function toastSuccess(message: string, onUndo?: () => void) {
  return useToastStore.getState().addToast({
    type: 'success',
    message,
    onUndo,
  });
}

/**
 * Show an error toast
 */
export function toastError(message: string) {
  return useToastStore.getState().addToast({
    type: 'error',
    message,
    duration: 6000, // Errors stay longer
  });
}

/**
 * Show a warning toast
 */
export function toastWarning(message: string) {
  return useToastStore.getState().addToast({
    type: 'warning',
    message,
  });
}

/**
 * Show an info toast
 */
export function toastInfo(message: string) {
  return useToastStore.getState().addToast({
    type: 'info',
    message,
  });
}

/**
 * Show a success toast with a custom action button
 */
export function toastSuccessWithAction(
  message: string, 
  action: { label: string; onClick: () => void }
) {
  return useToastStore.getState().addToast({
    type: 'success',
    message,
    action,
    duration: 5000, // Give user time to see and click the action
  });
}

// ============================================================================
// TOAST COMPONENT
// ============================================================================

const typeConfig = {
  success: {
    icon: CheckCircle,
    bgClass: 'bg-[var(--color-success)]/10',
    borderClass: 'border border-[var(--color-success)]/15',
    iconClass: 'text-[var(--color-success)]',
    textClass: 'text-[var(--color-success)]',
  },
  error: {
    icon: AlertCircle,
    bgClass: 'bg-[var(--color-danger)]/10',
    borderClass: 'border border-[var(--color-danger)]/15',
    iconClass: 'text-[var(--color-danger)]',
    textClass: 'text-[var(--color-danger)]',
  },
  warning: {
    icon: AlertTriangle,
    bgClass: 'bg-[var(--color-warning)]/10',
    borderClass: 'border border-[var(--color-warning)]/15',
    iconClass: 'text-[var(--color-warning)]',
    textClass: 'text-[var(--color-warning)]',
  },
  info: {
    icon: Info,
    bgClass: 'bg-[var(--color-accent-muted)]',
    borderClass: 'border border-[var(--color-accent-emphasis)]/15',
    iconClass: 'text-[var(--color-accent-fg)]',
    textClass: 'text-[var(--color-accent-fg)]',
  },
};

interface ToastItemComponentProps {
  toast: ToastItem;
  onRemove: () => void;
}

const ToastItemComponent: React.FC<ToastItemComponentProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const config = typeConfig[toast.type];
  const IconComponent = config.icon;

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(onRemove, 150);
  }, [onRemove]);

  const handleUndo = useCallback(() => {
    toast.onUndo?.();
    handleRemove();
  }, [toast, handleRemove]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm
        ${config.bgClass} ${config.borderClass}
        transition-all duration-150 ease-out
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
        toast-enter
      `}
    >
      <IconComponent size={18} className={config.iconClass} strokeWidth={1.75} />
      
      <span className={`flex-1 text-sm font-medium ${config.textClass}`}>
        {toast.message}
      </span>

      {toast.onUndo && (
        <button
          onClick={handleUndo}
          className={`
            flex items-center gap-1 px-2 py-1 rounded text-xs font-medium
            hover:bg-black/5 dark:hover:bg-white/10 transition-colors
            ${config.textClass}
          `}
        >
          <Undo2 size={14} />
          Undo
        </button>
      )}

      {toast.action && (
        <button
          onClick={() => {
            toast.action?.onClick();
            handleRemove();
          }}
          className={`
            px-2 py-1 rounded text-xs font-medium
            hover:bg-black/5 dark:hover:bg-white/10 transition-colors
            ${config.textClass}
          `}
        >
          {toast.action.label}
        </button>
      )}

      {toast.dismissible && (
        <button
          onClick={handleRemove}
          className={`
            p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors
            ${config.iconClass}
          `}
          aria-label="Dismiss"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// ============================================================================
// TOAST CONTAINER
// ============================================================================

/**
 * Toast container - renders all active toasts
 * Should be included once at the app root level
 * 
 * Positioning:
 * - Mobile: Bottom right (safe area for FAB)
 * - Desktop: Bottom center (prevents FAB overlap)
 */
export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    setContainer(document.body);
  }, []);

  if (!container || toasts.length === 0) return null;

  return createPortal(
    <div 
      className={`fixed z-[150] flex flex-col gap-2 max-w-sm ${
        isMobile 
          ? 'bottom-4 right-4' 
          : 'bottom-4 left-1/2 -translate-x-1/2'
      }`}
      style={{ 
        paddingBottom: 'env(safe-area-inset-bottom)',
        ...(isMobile && { paddingRight: 'env(safe-area-inset-right)' }),
      }}
    >
      {toasts.map((toast) => (
        <ToastItemComponent
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>,
    container
  );
};

export default ToastContainer;
