/**
 * @file SyncStatusIndicator.tsx
 * @description Visual indicator for sync status with expandable details panel
 * @app SHARED - Shows sync state in sidebar/header
 *
 * Features:
 * - Visual indicator of sync state (synced, syncing, pending, offline, error)
 * - Click to expand and see pending items
 * - Retry sync button when there are errors
 * - Compact design that fits with workspace switcher
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Loader2,
  FileText,
  CheckSquare,
  FolderOpen,
  X
} from 'lucide-react';
import { useSyncStore, computeSyncDisplayState, type SyncDisplayState } from '@/stores/syncStore';
import { getPendingOperations, type SyncOperation } from '@/lib/offlineDb';
import { getCurrentWorkspaceIdOrNull } from '@/stores/workspaceStore';

interface SyncStatusIndicatorProps {
  /** Show in compact mode (icon only) */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

const statusConfig: Record<SyncDisplayState, {
  icon: typeof Cloud;
  label: string;
  color: string;
  bgColor: string;
  animate?: boolean;
}> = {
  synced: {
    icon: Cloud,
    label: 'Synced',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  syncing: {
    icon: Loader2,
    label: 'Syncing...',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    animate: true,
  },
  pending: {
    icon: RefreshCw,
    label: 'Pending',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
  offline: {
    icon: CloudOff,
    label: 'Offline',
    color: 'text-[var(--color-text-secondary)]',
    bgColor: 'bg-[var(--color-surface-secondary)]',
  },
  error: {
    icon: AlertCircle,
    label: 'Sync Error',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
};

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ 
  compact = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [pendingOps, setPendingOps] = useState<SyncOperation[]>([]);
  const [isLoadingOps, setIsLoadingOps] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Get all needed state
  const state = useSyncStore();
  const { pendingCount, triggerSync, clearErrors, errors, lastSyncAt, isOnline, isSyncing } = state;
  const displayState = computeSyncDisplayState(state);
  const config = statusConfig[displayState];
  const Icon = config.icon;

  // Load pending operations when expanded
  useEffect(() => {
    if (isExpanded && pendingCount > 0) {
      setIsLoadingOps(true);
      const workspaceId = getCurrentWorkspaceIdOrNull();
      if (workspaceId) {
        getPendingOperations(workspaceId)
          .then(setPendingOps)
          .finally(() => setIsLoadingOps(false));
      } else {
        setIsLoadingOps(false);
      }
    }
  }, [isExpanded, pendingCount]);

  // Update panel position
  useEffect(() => {
    if (isExpanded && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Position below the button, but check if it would overflow
      const panelHeight = 400; // Approximate max height
      const top = rect.bottom + 4;
      const wouldOverflow = top + panelHeight > window.innerHeight;
      
      setPanelPosition({
        top: wouldOverflow ? rect.top - panelHeight - 4 : top,
        left: Math.max(8, rect.left - 280 + rect.width), // Align right edge with button
      });
    }
  }, [isExpanded]);

  // Close on click outside
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  // Close on escape
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExpanded(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const handleRetrySync = useCallback(async () => {
    try {
      await triggerSync();
    } catch (e) {
      console.error('Sync retry failed:', e);
    }
  }, [triggerSync]);

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  // Get operation icon
  const getOperationIcon = (collection: string) => {
    switch (collection) {
      case 'tasks':
        return CheckSquare;
      case 'pages':
        return FileText;
      case 'taskPages':
        return FolderOpen;
      default:
        return FileText;
    }
  };

  const showBadge = pendingCount > 0 || displayState === 'error';

  if (compact) {
    return (
      <>
        {/* Compact trigger button */}
        <button
          ref={triggerRef}
          onClick={() => setIsExpanded(!isExpanded)}
          className={`relative p-1.5 rounded-md transition-colors ${config.bgColor} hover:opacity-80 ${className}`}
          aria-label={`Sync status: ${config.label}`}
          aria-expanded={isExpanded}
        >
          <Icon 
            className={`w-4 h-4 ${config.color} ${config.animate ? 'animate-spin' : ''}`} 
          />
          
          {/* Badge for pending count or error */}
          {showBadge && (
            <span className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-3.5 px-1 text-[9px] font-medium rounded-full ${
              displayState === 'error' 
                ? 'bg-red-500 text-white' 
                : 'bg-amber-500 text-white'
            }`}>
              {displayState === 'error' ? '!' : pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>

        {/* Expanded panel */}
        {isExpanded && createPortal(
          <div
            ref={panelRef}
            className="fixed w-80 bg-[var(--color-surface-base)] border border-[var(--color-border-default)] rounded-lg shadow-lg z-[1000] overflow-hidden"
            style={{ top: panelPosition.top, left: panelPosition.left }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface-inset)] border-b border-[var(--color-border-default)]">
              <div className="flex items-center gap-2">
                <Icon 
                  className={`w-5 h-5 ${config.color} ${config.animate ? 'animate-spin' : ''}`}
                />
                <span className="font-medium text-[var(--color-text-primary)]">
                  {config.label}
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded hover:bg-[var(--color-surface-overlay)]"
              >
                <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </button>
            </div>

            {/* Connection status */}
            <div className="px-4 py-2 flex items-center gap-2 text-sm border-b border-[var(--color-border-default)]">
              {isOnline ? (
                <>
                  <Cloud className="w-4 h-4 text-green-500" />
                  <span className="text-[var(--color-text-secondary)]">Connected</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-4 h-4 text-amber-500" />
                  <span className="text-[var(--color-text-secondary)]">Offline - changes saved locally</span>
                </>
              )}
              <span className="ml-auto text-xs text-[var(--color-text-secondary)]">
                {formatTime(lastSyncAt)}
              </span>
            </div>

            {/* Errors section */}
            {errors.length > 0 && (
              <div className="border-b border-[var(--color-border-default)]">
                <div className="px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">
                    {errors.length} error{errors.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={clearErrors}
                    className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  >
                    Clear all
                  </button>
                </div>
                <div className="max-h-24 overflow-y-auto">
                  {errors.slice(0, 3).map((error) => (
                    <div
                      key={error.id}
                      className="px-4 py-2 text-sm text-[var(--color-text-secondary)] bg-red-50 dark:bg-red-900/20"
                    >
                      {error.message}
                    </div>
                  ))}
                  {errors.length > 3 && (
                    <div className="px-4 py-1 text-xs text-[var(--color-text-secondary)]">
                      +{errors.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pending operations */}
            {pendingCount > 0 && (
              <div className="border-b border-[var(--color-border-default)]">
                <div className="px-4 py-2">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                    Pending changes ({pendingCount})
                  </span>
                </div>
                
                {isLoadingOps ? (
                  <div className="px-4 py-3 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" />
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto">
                    {pendingOps.slice(0, 8).map((op) => {
                      const OpIcon = getOperationIcon(op.collection);
                      return (
                        <div
                          key={op.id}
                          className="px-4 py-2 flex items-center gap-3 hover:bg-[var(--color-surface-secondary)]"
                        >
                          <OpIcon className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--color-text-primary)] truncate">
                              {op.operation === 'create' ? 'New ' : op.operation === 'delete' ? 'Delete ' : 'Update '}
                              {op.collection.slice(0, -1)}
                            </p>
                          </div>
                          {op.attempts > 0 && (
                            <span className="text-xs text-amber-500">
                              retry {op.attempts}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {pendingOps.length > 8 && (
                      <div className="px-4 py-2 text-xs text-[var(--color-text-secondary)] text-center">
                        +{pendingOps.length - 8} more pending
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Synced state */}
            {displayState === 'synced' && pendingCount === 0 && errors.length === 0 && (
              <div className="px-4 py-4 flex flex-col items-center justify-center text-center">
                <Check className="w-8 h-8 text-green-500 mb-2" />
                <p className="text-sm text-[var(--color-text-primary)]">
                  All changes synced
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Your data is up to date
                </p>
              </div>
            )}

            {/* Actions */}
            {(displayState === 'error' || displayState === 'pending') && isOnline && (
              <div className="px-4 py-3 bg-[var(--color-surface-inset)]">
                <button
                  onClick={handleRetrySync}
                  disabled={isSyncing}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-[var(--color-interactive-bg-strong)] hover:brightness-110 rounded-md disabled:opacity-50 transition-colors"
                >
                  {isSyncing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Sync now
                    </>
                  )}
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
      </>
    );
  }

  // Non-compact version (full button with label)
  return (
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${config.color} ${config.bgColor} hover:opacity-80 ${className}`}
      title={errors.length > 0 ? errors[0]?.message : undefined}
    >
      <Icon className={`w-4 h-4 ${config.animate ? 'animate-spin' : ''}`} />
      <span className="font-medium">{config.label}</span>
      {pendingCount > 0 && (
        <span className="text-xs opacity-75">({pendingCount})</span>
      )}
    </button>
  );
};

export default SyncStatusIndicator;
