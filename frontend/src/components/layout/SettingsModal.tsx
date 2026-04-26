/**
 * @file SettingsModal.tsx
 * @description Full-featured settings modal with sidebar navigation
 *
 * Thin shell that handles:
 * - Portal rendering & mount animation
 * - Desktop sidebar + mobile menu/back navigation
 * - Section routing to extracted section components
 */
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { XIcon, TimerIcon, SettingsIcon, ChartIcon, TrashIcon, UserIcon, ChevronLeftIcon } from '@/components/common/Icons';
import { NavItem } from '@/components/ui';
import { Users, Building2, HardDrive, Download, Mic, ChevronRight } from 'lucide-react';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';

// Section components
import GeneralSettings from '@/components/settings/sections/GeneralSettings';
import AccountSettings from '@/components/settings/sections/AccountSettings';
import WorkspaceGeneralSettings from '@/components/settings/sections/WorkspaceGeneralSettings';
import WorkspaceMembersSettings from '@/components/settings/sections/WorkspaceMembersSettings';
import WorkspaceDataSettings from '@/components/settings/sections/WorkspaceDataSettings';
import WorkspaceDangerSettings from '@/components/settings/sections/WorkspaceDangerSettings';
import PomodoroSettings from '@/components/settings/sections/PomodoroSettings';
import StorageSettings from './StorageSettings';
import WhisperModelsSettings from './WhisperModelsSettings';
import ProductivityDashboard from '@/components/common/ProductivityDashboard';
import { useSettingsStore } from '@/stores/settingsStore';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SettingsSection =
  | 'general' | 'account' | 'storage' | 'ai-models'
  | 'workspace-general' | 'workspace-members' | 'workspace-data' | 'workspace-danger'
  | 'productivity' | 'pomodoro' | 'about';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
}

// ── Nav definition ────────────────────────────────────────────────────────────

interface NavItemDef { id: SettingsSection; label: string; icon: React.ReactNode; adminOnly?: boolean; }
interface NavGroup { title: string; items: NavItemDef[]; }

const navGroups: NavGroup[] = [
  {
    title: 'App',
    items: [
      { id: 'general', label: 'General', icon: <SettingsIcon className="w-5 h-5" /> },
      { id: 'account', label: 'Account', icon: <UserIcon className="w-5 h-5" /> },
      { id: 'storage', label: 'Storage & Offline', icon: <HardDrive className="w-5 h-5" /> },
      { id: 'ai-models', label: 'AI Transcription', icon: <Mic className="w-5 h-5" /> },
      { id: 'productivity', label: 'Productivity', icon: <ChartIcon className="w-5 h-5" /> },
      { id: 'pomodoro', label: 'Focus Timer', icon: <TimerIcon className="w-5 h-5" /> },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { id: 'workspace-general', label: 'Settings', icon: <Building2 className="w-5 h-5" /> },
      { id: 'workspace-members', label: 'Members', icon: <Users className="w-5 h-5" />, adminOnly: true },
      { id: 'workspace-data', label: 'Import / Export', icon: <Download className="w-5 h-5" /> },
      { id: 'workspace-danger', label: 'Danger Zone', icon: <TrashIcon className="w-5 h-5" /> },
    ],
  },
];

const getSectionLabel = (section: SettingsSection): string =>
  navGroups.flatMap((g) => g.items).find((i) => i.id === section)?.label || 'Settings';

// ── Main Component ────────────────────────────────────────────────────────────

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialSection = 'general' }) => {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [mounted, setMounted] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [mobileShowMenu, setMobileShowMenu] = useState(true);
  const isMobile = useIsMobile();
  const einkMode = useSettingsStore((s) => s.einkMode);

  useEffect(() => { setPortalContainer(document.body); }, []);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    }
    setMounted(false);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setActiveSection(initialSection);
      setMobileShowMenu(true);
    }
  }, [isOpen, initialSection]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  const handleMobileSectionSelect = useCallback((section: SettingsSection) => {
    setActiveSection(section);
    setMobileShowMenu(false);
  }, []);

  if (!isOpen || !portalContainer) return null;

  const renderSection = () => {
    switch (activeSection) {
      case 'general': return <GeneralSettings />;
      case 'account': return <AccountSettings onClose={onClose} />;
      case 'storage': return <StorageSettings />;
      case 'ai-models': return <WhisperModelsSettings />;
      case 'workspace-general': return <WorkspaceGeneralSettings />;
      case 'workspace-members': return <WorkspaceMembersSettings />;
      case 'workspace-data': return <WorkspaceDataSettings />;
      case 'workspace-danger': return <WorkspaceDangerSettings onClose={onClose} />;
      case 'productivity': return <ProductivityDashboard />;
      case 'pomodoro': return <PomodoroSettings />;
      default: return <GeneralSettings />;
    }
  };

  // ── Nav items (shared between mobile & desktop) ─────────────────────────────
  const renderNav = (onSelect: (id: SettingsSection) => void, mobile: boolean) => (
    <nav className={mobile ? 'p-2' : 'flex-1 p-2 overflow-y-auto'}>
      {navGroups.map((group, i) => (
        <div key={group.title} className={i > 0 ? (mobile ? 'mt-6' : 'mt-4') : ''}>
          <div className={`px-${mobile ? 3 : 2} py-${mobile ? 2 : 1.5} text-xs font-${mobile ? 'semibold' : 'medium'} text-[var(--color-text-tertiary)] uppercase tracking-wide`}>
            {group.title}
          </div>
          <div className={mobile ? 'space-y-1' : 'space-y-0.5'}>
            {group.items.map((item) =>
              mobile ? (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text-strong)]'
                      : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]'
                  }`}
                >
                  <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center">{item.icon}</span>
                  <span className="flex-1 font-medium">{item.label}</span>
                  <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                </button>
              ) : (
                <NavItem
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  isActive={activeSection === item.id}
                  einkMode={einkMode}
                  onClick={() => onSelect(item.id)}
                />
              )
            )}
          </div>
        </div>
      ))}
    </nav>
  );

  // ── Mobile: full-screen ─────────────────────────────────────────────────────
  if (isMobile) {
    return createPortal(
      <div
        className={`fixed inset-0 z-[260] bg-[var(--color-surface-base)] flex flex-col transition-opacity duration-200 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex-shrink-0 flex items-center h-14 px-4 border-b border-[var(--color-border-default)]">
          {mobileShowMenu ? (
            <>
              <h2 className="flex-1 text-lg font-semibold text-[var(--color-text-primary)]">Settings</h2>
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-surface-tertiary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]" aria-label="Close">
                <XIcon className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setMobileShowMenu(true)} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]" aria-label="Back">
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <h2 className="flex-1 text-lg font-semibold text-[var(--color-text-primary)]">{getSectionLabel(activeSection)}</h2>
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-[var(--color-surface-tertiary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]" aria-label="Close">
                <XIcon className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain pb-32">
          {mobileShowMenu ? renderNav(handleMobileSectionSelect, true) : <div className="p-4">{renderSection()}</div>}
        </div>
      </div>,
      portalContainer
    );
  }

  // ── Desktop: centered modal ─────────────────────────────────────────────────
  return createPortal(
      <div
        className={`fixed inset-0 z-[260] flex items-center justify-center transition-all duration-200 eink-modal-backdrop ${mounted ? 'bg-black/30 backdrop-blur-[2px]' : 'bg-black/0 backdrop-blur-0'}`}
      onClick={onClose}
    >
      <div
        className={`relative bg-[var(--color-surface-base)] rounded-2xl w-full max-w-3xl mx-4 shadow-2xl shadow-black/20 dark:shadow-black/40 transform transition-all duration-200 overflow-hidden border border-[var(--color-border-subtle)] eink-shell-surface eink-modal-surface ${mounted ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'}`}
        onClick={(e) => e.stopPropagation()}
        style={{ height: '70vh', maxHeight: '600px' }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[var(--color-surface-tertiary)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] eink-header-button" aria-label="Close">
          <XIcon className="w-4 h-4" />
        </button>
        <div className="flex h-full">
          <div className="w-52 bg-[var(--color-surface-secondary)] border-r border-[var(--color-border-default)] flex flex-col eink-shell-surface-secondary">
            <div className="p-4 border-b border-[var(--color-border-default)]">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Settings</h2>
            </div>
            {renderNav(setActiveSection, false)}
          </div>
          <div className="flex-1 overflow-y-auto p-6">{renderSection()}</div>
        </div>
      </div>
    </div>,
    portalContainer
  );
};

export default SettingsModal;
