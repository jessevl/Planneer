/**
 * @file SidebarHeader.tsx
 * @description Unified sidebar account and workspace menu trigger
 * @app SHARED - Reusable footer control for sidebar workspace and account actions
 *
 * Features:
 * - One shared trigger for both expanded and rail sidebar variants
 * - Unified dropdown/sheet with workspace switching, sync state, and account actions
 * - Account-first header with direct access to account settings and logout
 * - Consistent behavior across desktop and mobile
 */
import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Check,
  AlertCircle,
  Loader2,
  ChevronDown,
  Plus,
  Settings,
  LogOut,
  User,
} from 'lucide-react';
import { useWorkspaceStore, selectCurrentWorkspace, selectWorkspaces } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore, computeSyncDisplayState, type SyncDisplayState } from '@/stores/syncStore';
import { pb } from '@/lib/pocketbase';
import { MobileSheet } from '@/components/ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { cn } from '@/lib/design-system';
import type { SettingsSection } from './SettingsModal';

// ============================================================================
// TYPES
// ============================================================================
interface SidebarHeaderProps {
  onCreateWorkspace: () => void;
  onOpenSettings: (section: SettingsSection) => void;
  triggerVariant?: 'expanded' | 'rail';
}

type SyncConfig = {
  icon: typeof Cloud;
  label: string;
  color: string;
  dotColor: string;
  animate?: boolean;
};

// ============================================================================
// SYNC STATUS CONFIG
// ============================================================================
const syncConfig: Record<SyncDisplayState, SyncConfig> = {
  synced: {
    icon: Cloud,
    label: 'Synced',
    color: 'text-green-600 dark:text-green-400',
    dotColor: 'bg-green-500',
  },
  syncing: {
    icon: Loader2,
    label: 'Syncing...',
    color: 'text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500',
    animate: true,
  },
  pending: {
    icon: RefreshCw,
    label: 'Pending',
    color: 'text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500',
  },
  offline: {
    icon: CloudOff,
    label: 'Offline',
    color: 'text-[var(--color-text-secondary)]',
    dotColor: 'bg-[var(--color-text-tertiary)]',
  },
  error: {
    icon: AlertCircle,
    label: 'Sync Error',
    color: 'text-red-600 dark:text-red-400',
    dotColor: 'bg-red-500',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  onCreateWorkspace,
  onOpenSettings,
  triggerVariant = 'expanded',
}) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{ bottom: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Workspace state
  const currentWorkspace = useWorkspaceStore(selectCurrentWorkspace);
  const workspaces = useWorkspaceStore(selectWorkspaces);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const { user, logout } = useAuthStore(useShallow((s) => ({ user: s.user, logout: s.logout })));

  // Sync state
  const syncState = useSyncStore(
    useShallow((s) => ({
      pendingCount: s.pendingCount,
      errors: s.errors,
      lastSyncAt: s.lastSyncAt,
      isOnline: s.isOnline,
      isSyncing: s.isSyncing,
      triggerSync: s.triggerSync,
      clearErrors: s.clearErrors,
    }))
  );
  const displayState = computeSyncDisplayState(useSyncStore.getState());
  const config = syncConfig[displayState];
  const SyncIcon = config.icon;

  const calculatePanelPosition = useCallback(() => {
    if (!triggerRef.current) return null;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const sidebarElement = triggerRef.current.closest('aside');
    const sidebarRect = sidebarElement?.getBoundingClientRect() ?? triggerRect;
    const panelWidth = 352;
    const sidebarGap = 10;
    const viewportInset = 12;
    const preferredLeft = sidebarRect.right + sidebarGap;
    const maxLeft = window.innerWidth - panelWidth - viewportInset;

    return {
      bottom: viewportInset,
      left: Math.max(viewportInset, Math.min(preferredLeft, maxLeft)),
    };
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || isMobile) return;
    setPanelPosition(calculatePanelPosition());
  }, [calculatePanelPosition, isMobile, isOpen, triggerVariant]);

  useEffect(() => {
    if (!isOpen || isMobile) return;

    const handleWindowChange = () => {
      setPanelPosition(calculatePanelPosition());
    };

    window.addEventListener('resize', handleWindowChange);
    window.addEventListener('scroll', handleWindowChange, true);
    return () => {
      window.removeEventListener('resize', handleWindowChange);
      window.removeEventListener('scroll', handleWindowChange, true);
    };
  }, [calculatePanelPosition, isMobile, isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handlers
  const handleSelectWorkspace = useCallback(
    (workspaceId: string) => {
      setCurrentWorkspace(workspaceId);
      setIsOpen(false);
    },
    [setCurrentWorkspace]
  );

  const handleCreateNew = useCallback(() => {
    setIsOpen(false);
    onCreateWorkspace();
  }, [onCreateWorkspace]);

  const handleOpenSettings = useCallback(
    (section: SettingsSection) => {
      setIsOpen(false);
      onOpenSettings(section);
    },
    [onOpenSettings]
  );

  const handleRetrySync = useCallback(async () => {
    try {
      await syncState.triggerSync();
    } catch (e) {
      console.error('Sync retry failed:', e);
    }
  }, [syncState]);

  const handleLogout = useCallback(() => {
    setIsOpen(false);
    logout();
  }, [logout]);

  const handleToggleOpen = useCallback(() => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    if (!isMobile) {
      setPanelPosition(calculatePanelPosition());
    }

    setIsOpen(true);
  }, [calculatePanelPosition, isMobile, isOpen]);

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  // If not authenticated, just show app name
  if (!user) {
    return (
      <div className="flex items-center h-12 px-1.5">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">
          Planneer
        </h2>
      </div>
    );
  }

  const displayName = currentWorkspace?.name || 'Select Workspace';
  const showSyncBadge = syncState.pendingCount > 0 || displayState === 'error';
  const userName = user.name || user.email || 'Account';
  const userEmail = user.email || 'Signed in';
  const userAvatarUrl = user.avatar ? pb.files.getUrl(user, user.avatar) : null;

  const panelContent = (
    <div className="flex max-h-[min(74vh,520px)] min-h-0 flex-col overflow-hidden rounded-[28px] bg-[color-mix(in_srgb,var(--color-surface-base)_97%,transparent)] text-[var(--color-text-primary)] backdrop-blur-xl">
      <div className="border-b border-[var(--color-border-default)]/75 px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => handleOpenSettings('account')}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-1 py-1 text-left transition-colors hover:bg-[var(--color-surface-secondary)]"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-accent-muted)] text-[var(--color-accent-fg)]">
              {userAvatarUrl ? (
                <img src={userAvatarUrl} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{userName}</div>
              <div className="truncate text-xs text-[var(--color-text-secondary)]">{userEmail}</div>
            </div>
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleOpenSettings('general')}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border-default)]/80 bg-[var(--color-surface-base)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text-primary)]"
              aria-label="Open settings"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--color-border-default)]/80 bg-[var(--color-surface-base)] px-2.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-red-300 hover:text-red-600 dark:hover:border-red-500/25 dark:hover:text-red-300"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Workspaces</div>
            <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">Switch context without loosing your work.</div>
          </div>
          <button
            type="button"
            onClick={handleCreateNew}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-base)] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            aria-label="Create workspace"
            title="Create workspace"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1 overflow-y-auto pr-1">
          {workspaces.map((ws) => {
            const isCurrent = ws.id === currentWorkspace?.id;
            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => handleSelectWorkspace(ws.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200',
                  isCurrent
                    ? 'border-[var(--color-border-emphasis)] bg-[color-mix(in_srgb,var(--color-accent-muted)_76%,transparent)] shadow-[0_14px_32px_-28px_rgba(15,23,42,0.42)]'
                    : 'border-transparent bg-transparent hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-secondary)]'
                )}
                role="option"
                aria-selected={isCurrent}
              >
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: ws.color || '#3b82f6' }}
                >
                  {ws.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate text-sm font-medium', isCurrent ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-primary)]')}>
                    {ws.name}
                  </div>
                  {isCurrent ? (
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium', config.color, 'bg-[var(--color-surface-base)]/80')}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor, config.animate ? 'animate-pulse' : '')} />
                        {config.label}
                      </span>
                      <span className="truncate">Last sync {formatTime(syncState.lastSyncAt)}</span>
                    </div>
                  ) : (
                    <div className="truncate text-xs text-[var(--color-text-secondary)]">Switch workspace</div>
                  )}
                  {isCurrent && syncState.errors.length > 0 ? (
                    <div className="mt-1 truncate text-xs text-red-600 dark:text-red-300">{syncState.errors[0]?.message}</div>
                  ) : null}
                </div>
                {isCurrent ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenSettings('workspace-general');
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border-default)]/80 bg-[var(--color-surface-base)]/90 text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text-primary)]"
                      aria-label="Open workspace settings"
                      title="Workspace settings"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                    {(displayState === 'error' || displayState === 'pending') && syncState.isOnline ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRetrySync();
                        }}
                        disabled={syncState.isSyncing}
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--color-border-default)]/80 bg-[var(--color-surface-base)]/90 text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-emphasis)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                        aria-label="Sync workspace"
                        title="Sync now"
                      >
                        {syncState.isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      </button>
                    ) : null}
                    <Check className="h-4 w-4 flex-shrink-0 text-[var(--color-accent-fg)]" />
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {triggerVariant === 'rail' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggleOpen}
          className={cn(
            'group relative flex h-11 w-11 items-center justify-center rounded-[1.35rem] border border-[var(--color-border-default)]/80 bg-[color-mix(in_srgb,var(--color-surface-base)_88%,transparent)] text-[var(--color-text-primary)] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.5)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-emphasis)] hover:bg-[var(--color-surface-secondary)]',
            isOpen ? 'border-[var(--color-border-emphasis)] bg-[var(--color-surface-secondary)]' : ''
          )}
          aria-label="Open account and workspace menu"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-2xl text-[11px] font-bold text-white"
            style={{ backgroundColor: currentWorkspace?.color || '#3b82f6' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--color-surface-base)] bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] shadow-sm">
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt={userName} className="h-full w-full object-cover" />
            ) : (
              <User className="h-2.5 w-2.5" />
            )}
          </span>
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-surface-base)] shadow-sm',
              config.dotColor,
              config.animate ? 'animate-pulse' : ''
            )}
            aria-hidden="true"
          />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggleOpen}
          className={cn(
            'flex w-full items-center gap-3 rounded-[22px] border border-[var(--color-border-default)]/80 bg-[color-mix(in_srgb,var(--color-surface-base)_88%,transparent)] px-3 py-2.5 text-left text-[var(--color-text-primary)] shadow-[0_16px_30px_-28px_rgba(15,23,42,0.52)] transition-all duration-200 hover:border-[var(--color-border-emphasis)] hover:bg-[var(--color-surface-secondary)]',
            isOpen ? 'border-[var(--color-border-emphasis)] bg-[var(--color-surface-secondary)]' : ''
          )}
          aria-label="Open account and workspace menu"
          aria-expanded={isOpen}
          aria-haspopup="menu"
        >
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: currentWorkspace?.color || '#3b82f6' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{displayName}</div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span className="truncate">{userName}</span>
              <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium', config.color)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor, config.animate ? 'animate-pulse' : '')} />
                {config.label}
              </span>
            </div>
          </div>
          {showSyncBadge ? (
            <span className={cn(
              'flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-1 text-[10px] font-bold',
              displayState === 'error' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
            )}>
              {displayState === 'error' ? '!' : syncState.pendingCount > 9 ? '9+' : syncState.pendingCount}
            </span>
          ) : null}
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent-muted)] text-[var(--color-accent-fg)]">
            {userAvatarUrl ? (
              <img src={userAvatarUrl} alt={userName} className="h-full w-full object-cover" />
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </div>
          <ChevronDown className={cn('h-4 w-4 flex-shrink-0 text-[var(--color-text-secondary)] transition-transform duration-200', isOpen ? 'rotate-180' : '')} />
        </button>
      )}

      {/* Unified Panel */}
      {isMobile ? (
        <MobileSheet
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Account & Workspace"
        >
          <div className="pb-6 h-[72vh]">
            {panelContent}
          </div>
        </MobileSheet>
      ) : isOpen && panelPosition && (
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[1000] w-[22rem] overflow-hidden rounded-[30px] border border-[var(--color-border-default)]/80 shadow-[0_32px_90px_-36px_rgba(15,23,42,0.58)] eink-shell-surface"
            style={{ 
              bottom: panelPosition.bottom,
              left: panelPosition.left,
              maxHeight: 'calc(100vh - 32px)'
            }}
          >
            {panelContent}
          </div>,
          document.body
        )
      )}
    </>
  );
};

export default SidebarHeader;
