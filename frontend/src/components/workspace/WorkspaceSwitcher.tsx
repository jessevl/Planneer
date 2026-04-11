/**
 * @file WorkspaceSwitcher.tsx
 * @description Dropdown for switching between workspaces in the sidebar
 * @app SHARED - Sidebar component for workspace selection
 * 
 * Features:
 * - Shows current workspace name with dropdown trigger
 * - Lists all accessible workspaces with role indicators
 * - Quick action to create a new workspace
 * - Navigate to workspace settings
 * 
 * Uses portal to escape sidebar overflow constraints
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspaceStore, selectCurrentWorkspace, selectWorkspaces } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { Divider } from '@/components/ui';
import { MobileSheet } from '@/components/ui';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { ChevronDownIcon, PlusIcon, SettingsIcon, CheckIcon } from '@/components/common/Icons';
import { Users } from 'lucide-react';

interface WorkspaceSwitcherProps {
  onCreateWorkspace: () => void;
  onOpenSettings: () => void;
}

const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  onCreateWorkspace,
  onOpenSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const currentWorkspace = useWorkspaceStore(selectCurrentWorkspace);
  const workspaces = useWorkspaceStore(selectWorkspaces);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  const user = useAuthStore((s) => s.user);

  // Update dropdown position when opened (desktop only)
  useEffect(() => {
    if (!isMobile && isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isOpen, isMobile]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectWorkspace = useCallback((workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    setIsOpen(false);
  }, [setCurrentWorkspace]);

  const handleCreateNew = useCallback(() => {
    setIsOpen(false);
    onCreateWorkspace();
  }, [onCreateWorkspace]);

  const handleOpenSettings = useCallback(() => {
    setIsOpen(false);
    onOpenSettings();
  }, [onOpenSettings]);

  // If not authenticated, just show "Planneer"
  if (!user) {
    return (
      <h2 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">
        Planneer
      </h2>
    );
  }

  const displayName = currentWorkspace?.name || 'Select Workspace';

  // Shared workspace list content
  const workspaceListContent = (
    <>
      {/* Workspace list */}
      <div className={isMobile ? 'space-y-2' : 'py-1 max-h-64 overflow-y-auto'}>
        {!isMobile && (
          <div className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)] uppercase tracking-wide">
            Workspaces
          </div>
        )}
        {workspaces.map((ws) => (
          <button
            key={ws.id}
            onClick={() => handleSelectWorkspace(ws.id)}
            className={`w-full flex items-center gap-2.5 text-left transition-colors ${
              isMobile
                ? 'px-4 py-3 rounded-lg'
                : 'px-3 py-2'
            } ${
              ws.id === currentWorkspace?.id
                ? 'bg-[var(--color-interactive-bg)]'
                : 'hover:bg-[var(--color-surface-overlay)]'
            }`}
            role="option"
            aria-selected={ws.id === currentWorkspace?.id}
          >
            {/* Workspace color indicator */}
            <div
              className={`rounded flex-shrink-0 flex items-center justify-center text-white font-bold ${
                isMobile ? 'w-8 h-8 text-base' : 'w-6 h-6 text-sm'
              }`}
              style={{ backgroundColor: ws.color || '#3b82f6' }}
            >
              {ws.name.charAt(0).toUpperCase()}
            </div>

            {/* Workspace info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`font-medium text-[var(--color-text-primary)] truncate ${
                  isMobile ? 'text-base' : 'text-sm'
                }`}>
                  {ws.name}
                </span>
                {ws.role !== 'member' && (
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    {ws.role === 'owner' ? '(Owner)' : '(Admin)'}
                  </span>
                )}
              </div>
              {ws.description && (
                <p className="text-xs text-[var(--color-text-tertiary)] truncate">
                  {ws.description}
                </p>
              )}
            </div>

            {/* Selected indicator */}
            {ws.id === currentWorkspace?.id && (
              <CheckIcon className={`text-[var(--color-interactive-text-strong)] flex-shrink-0 ${
                isMobile ? 'w-5 h-5' : 'w-4 h-4'
              }`} />
            )}
          </button>
        ))}
      </div>

      {!isMobile && <Divider className="border-[var(--color-border-default)] !my-0" />}

      {/* Actions */}
      <div className={isMobile ? 'space-y-2 mt-4 pt-4 border-t border-[var(--color-border-default)]' : 'py-1'}>
        <button
          onClick={handleCreateNew}
          className={`w-full flex items-center gap-2.5 text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] transition-colors ${
            isMobile ? 'px-4 py-3 text-base rounded-lg' : 'px-3 py-2 text-sm'
          }`}
        >
          <PlusIcon className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          Create new workspace
        </button>

        {currentWorkspace && (
          <>
            <button
              onClick={handleOpenSettings}
              className={`w-full flex items-center gap-2.5 text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] transition-colors ${
                isMobile ? 'px-4 py-3 text-base rounded-lg' : 'px-3 py-2 text-sm'
              }`}
            >
              <SettingsIcon className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
              Workspace settings
            </button>

            {(currentWorkspace.role === 'owner' || currentWorkspace.role === 'admin') && (
              <button
                onClick={handleOpenSettings}
                className={`w-full flex items-center gap-2.5 text-left text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] transition-colors ${
                  isMobile ? 'px-4 py-3 text-base rounded-lg' : 'px-3 py-2 text-sm'
                }`}
              >
                <Users className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
                Manage members
              </button>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 rounded-md hover:bg-[var(--color-surface-overlay)] transition-colors group min-w-0 ${
          isMobile ? 'px-3 py-2.5' : 'px-1.5 py-1'
        }`}
        aria-label="Switch workspace"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Workspace icon/color indicator */}
        {currentWorkspace?.color ? (
          <div
            className={`rounded flex-shrink-0 flex items-center justify-center text-white font-bold ${
              isMobile ? 'w-7 h-7 text-sm' : 'w-5 h-5 text-xs'
            }`}
            style={{ backgroundColor: currentWorkspace.color }}
          >
            {currentWorkspace.name.charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className={`rounded bg-[var(--color-interactive-bg-strong)] flex-shrink-0 flex items-center justify-center text-white font-bold ${
            isMobile ? 'w-7 h-7 text-sm' : 'w-5 h-5 text-xs'
          }`}>
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Workspace name */}
        <span className={`font-semibold text-[var(--color-text-primary)] truncate ${
          isMobile ? 'text-base max-w-[180px]' : 'text-base max-w-[140px]'
        }`}>
          {displayName}
        </span>

        {/* Chevron */}
        <ChevronDownIcon
          className={`text-[var(--color-text-secondary)] flex-shrink-0 transition-transform ${
            isMobile ? 'w-5 h-5' : 'w-4 h-4'
          } ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Mobile: MobileSheet or Desktop: Dropdown menu */}
      {isMobile ? (
        <MobileSheet
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Workspaces"
        >
          <div className="p-4">
            {workspaceListContent}
          </div>
        </MobileSheet>
      ) : isOpen && (
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed w-72 bg-[var(--color-surface-base)] border border-[var(--color-border-default)] rounded-lg shadow-lg z-[1000] overflow-hidden"
            style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
          >
            {workspaceListContent}
          </div>,
          document.body
        )
      )}
    </>
  );
};

export default WorkspaceSwitcher;
