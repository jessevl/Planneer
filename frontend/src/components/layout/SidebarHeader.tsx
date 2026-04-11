/**
 * @file SidebarHeader.tsx
 * @description Unified sidebar header with workspace, sync, and settings in one panel
 * @app SHARED - Single entry point for all sidebar context controls
 *
 * Features:
 * - Single row showing workspace name + sync status indicator
 * - Click to expand unified panel with:
 *   - Workspace list and switching
 *   - Sync status details
 *   - Quick access to settings
 *   - User account info (future)
 * - Consistent styling and behavior
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Users,
  X,
  LogOut,
  User,
} from 'lucide-react';
import { useWorkspaceStore, selectCurrentWorkspace, selectWorkspaces } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { useSyncStore, computeSyncDisplayState, type SyncDisplayState } from '@/stores/syncStore';
import { pb } from '@/lib/pocketbase';
import { Divider } from '@/components/ui';
import { MobileSheet } from '@/components/ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { CheckIcon, UserIcon } from '@/components/common/Icons';
import type { SettingsSection } from './SettingsModal';

// ============================================================================
// TYPES
// ============================================================================
interface SidebarHeaderProps {
  onCreateWorkspace: () => void;
  onOpenSettings: (section: SettingsSection) => void;
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
}) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });
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

  // Position panel below trigger
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen]);

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

  const panelContent = (
    <div className="flex flex-col h-full">
      {/* ============================================ */}
      {/* SYNC STATUS SECTION */}
      {/* ============================================ */}
      <div className={`text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider ${isMobile ? 'px-4 pt-4 pb-2' : 'px-3 pt-3 pb-1'}`}>
        Sync Status
      </div>
      <div className={`flex items-center justify-between bg-[var(--color-surface-base)] border-b border-[var(--color-border-default)] ${isMobile ? 'px-4 py-3' : 'px-3 py-2'}`}>
        <div className="flex items-center gap-2">
          <div className={`${isMobile ? 'w-2.5 h-2.5' : 'w-2 h-2'} rounded-full ${config.dotColor} ${config.animate ? 'animate-pulse' : ''}`} />
          <span className={`${isMobile ? 'text-base' : 'text-sm'} font-medium ${config.color}`}>{config.label}</span>
          <span className={`${isMobile ? 'text-sm' : 'text-xs'} text-[var(--color-text-secondary)]`}>
            {formatTime(syncState.lastSyncAt)}
          </span>
        </div>

        {(displayState === 'error' || displayState === 'pending') && syncState.isOnline && (
          <button
            onClick={handleRetrySync}
            disabled={syncState.isSyncing}
            className={`${isMobile ? 'p-2' : 'p-1'} rounded-md text-[var(--color-interactive-text-strong)] hover:bg-[var(--color-interactive-bg)] disabled:opacity-50 transition-colors`}
            title="Sync now"
          >
            {syncState.isSyncing ? (
              <Loader2 className={isMobile ? 'w-5 h-5 animate-spin' : 'w-4 h-4 animate-spin'} />
            ) : (
              <RefreshCw className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
            )}
          </button>
        )}
      </div>

      {/* Sync errors/pending details */}
      {(syncState.errors.length > 0 || (syncState.pendingCount > 0 && displayState !== 'error')) && (
        <div className={`bg-[var(--color-surface-inset)] border-b border-[var(--color-border-default)] ${isMobile ? 'px-4 py-2.5' : 'px-3 py-1.5'}`}>
          {syncState.errors.length > 0 ? (
            <div className="flex items-center justify-between">
              <span className={`${isMobile ? 'text-sm' : 'text-xs'} font-medium text-red-600 dark:text-red-400 truncate mr-2`}>
                {syncState.errors[0]?.message}
              </span>
              <button
                onClick={syncState.clearErrors}
                className={`${isMobile ? 'text-sm' : 'text-xs'} text-red-500 hover:underline flex-shrink-0`}
              >
                Clear
              </button>
            </div>
          ) : (
            <span className={`${isMobile ? 'text-sm' : 'text-xs'} text-amber-700 dark:text-amber-400`}>
              {syncState.pendingCount} pending change{syncState.pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* WORKSPACES SECTION */}
      {/* ============================================ */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className={`text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider ${isMobile ? 'px-4 pt-4 pb-2' : 'px-3 pt-3 pb-1'}`}>
          Workspaces
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => handleSelectWorkspace(ws.id)}
              className={`w-full flex items-center gap-2.5 transition-colors group ${isMobile ? 'px-4 py-4' : 'px-3 py-2'} ${
                ws.id === currentWorkspace?.id
                  ? 'bg-[var(--color-interactive-bg)]'
                  : 'hover:bg-[var(--color-surface-overlay)]'
              }`}
              role="option"
              aria-selected={ws.id === currentWorkspace?.id}
            >
              {/* Workspace icon */}
              <div
                className={`${isMobile ? 'w-8 h-8 text-xs' : 'w-6 h-6 text-[10px]'} rounded flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm transition-transform group-hover:scale-105`}
                style={{ backgroundColor: ws.color || '#3b82f6' }}
              >
                {ws.name.charAt(0).toUpperCase()}
              </div>

              {/* Workspace info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`${isMobile ? 'text-base' : 'text-sm'} ${ws.id === currentWorkspace?.id ? 'font-semibold text-[var(--color-interactive-text)]' : 'font-medium text-[var(--color-text-primary)]'} truncate`}>
                    {ws.name}
                  </span>
                </div>
              </div>

              {/* Selected indicator */}
              {ws.id === currentWorkspace?.id && (
                <Check className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-[var(--color-interactive-text-strong)] flex-shrink-0`} />
              )}
            </button>
          ))}
        </div>
      </div>

      <Divider className="!my-0" />

      {/* ============================================ */}
      {/* ACTIONS SECTION */}
      {/* ============================================ */}
      <div className={`bg-[var(--color-surface-inset)] ${isMobile ? 'py-2' : 'py-1.5'}`}>
        {/* Create workspace */}
        <button
          onClick={handleCreateNew}
          className={`w-full flex items-center gap-2.5 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-overlay)] transition-colors ${isMobile ? 'px-4 py-4 text-base' : 'px-3 py-2 text-sm'}`}
        >
          <Plus className={isMobile ? 'w-5 h-5 text-[var(--color-text-secondary)]' : 'w-4 h-4 text-[var(--color-text-secondary)]'} />
          Create workspace
        </button>

        {/* Workspace settings */}
        {currentWorkspace && (
          <button
            onClick={() => handleOpenSettings('workspace-general')}
            className={`w-full flex items-center gap-2.5 text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-overlay)] transition-colors ${isMobile ? 'px-4 py-4 text-base' : 'px-3 py-2 text-sm'}`}
          >
            <Users className={isMobile ? 'w-5 h-5 text-[var(--color-text-secondary)]' : 'w-4 h-4 text-[var(--color-text-secondary)]'} />
            Workspace settings
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Trigger Row */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-3 rounded-lg font-medium
          glass-item-subtle text-[var(--color-text-primary)] eink-shell-surface
          transition-all duration-200 group
          ${isMobile ? 'px-4 py-3' : 'w-full px-3 py-1.5'}
          ${isOpen ? 'glass-item' : ''}
        `}
        aria-label="Open sidebar menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {/* Workspace icon */}
        <div
          className={`${isMobile ? 'w-7 h-7 text-sm' : 'w-6 h-6 text-[10px]'} rounded flex-shrink-0 flex items-center justify-center text-white font-bold shadow-sm transition-transform group-hover:scale-105`}
          style={{ backgroundColor: currentWorkspace?.color || '#3b82f6' }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>

        {/* Workspace name */}
        <div className="flex-1 min-w-0">
          <span className={`w-full text-left ${isMobile ? 'text-base' : 'text-sm'} font-semibold text-[var(--color-text-primary)] truncate leading-tight block`}>
            {displayName}
          </span>
        </div>

        {/* Sync status dot */}
        <div className="relative flex items-center gap-1.5">
          {/* Sync indicator */}
          <div
            className={`${isMobile ? 'w-2 h-2' : 'w-1.5 h-1.5'} rounded-full ${config.dotColor} ${
              config.animate ? 'animate-pulse' : ''
            }`}
            title={config.label}
          />

          {/* Badge for pending/error */}
          {showSyncBadge && (
            <span
              className={`flex items-center justify-center ${isMobile ? 'min-w-[18px] h-[18px] text-[10px]' : 'min-w-[14px] h-3.5 text-[8px]'} px-1 font-bold rounded-full ${
                displayState === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {displayState === 'error' ? '!' : syncState.pendingCount > 9 ? '9+' : syncState.pendingCount}
            </span>
          )}
        </div>

        {/* Chevron */}
        <ChevronDown
          className={`${isMobile ? 'w-5 h-5' : 'w-3.5 h-3.5'} text-[var(--color-text-secondary)] flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Unified Panel */}
      {isMobile ? (
        <MobileSheet
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Account & Workspace"
        >
          <div className="pb-6 h-[70vh]">
            {panelContent}
          </div>
        </MobileSheet>
      ) : isOpen && (
        createPortal(
          <div
            ref={panelRef}
            className="fixed w-64 bg-[var(--color-surface-base)] border border-[var(--color-border-default)] rounded-xl shadow-2xl z-[1000] overflow-hidden animate-in fade-in zoom-in-95 duration-100 eink-shell-surface"
            style={{ 
              top: panelPosition.top, 
              left: panelPosition.left,
              maxHeight: 'calc(100vh - 100px)'
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
