/**
 * @file sidepanelConfig.ts
 * @description Configuration-driven layout definitions for the unified sidepanel
 *
 * Determines which tabs are available and which is the default based on the
 * current route and page type. Edit SIDEPANEL_LAYOUTS to change sidepanel
 * behavior without touching component code.
 */
import type { UnifiedSidepanelTab } from '@/stores/navigationStore';
import type { Page } from '@/types/page';

// ─── Types ──────────────────────────────────────────────────────────────

export interface SidepanelLayout {
  /** Ordered list of visible tabs */
  tabs: UnifiedSidepanelTab[];
  /** Tab to auto-select when the user's persisted tab is unavailable */
  defaultTab: UnifiedSidepanelTab;
}

/**
 * Context key that selects the layout.
 * Resolved automatically from the current route and page.
 */
export type SidepanelContext =
  | 'tasks-route'
  | 'task-page'
  | 'note-page'
  | 'collection-page'
  | 'no-page';

// ─── Layout Config ──────────────────────────────────────────────────────

const SIDEPANEL_LAYOUTS: Record<SidepanelContext, SidepanelLayout> = {
  /** /tasks/ filter view — editor only, always */
  'tasks-route': {
    tabs: ['task-editor'],
    defaultTab: 'task-editor',
  },
  /** Page with viewMode='tasks' — graph, metadata, and editor */
  'task-page': {
    tabs: ['graph', 'metadata', 'task-editor'],
    defaultTab: 'task-editor',
  },
  /** Regular note page — graph, metadata, task overview */
  'note-page': {
    tabs: ['graph', 'metadata', 'task-overview'],
    defaultTab: 'graph',
  },
  /** Collection/folder page — same as note */
  'collection-page': {
    tabs: ['graph', 'metadata', 'task-overview'],
    defaultTab: 'graph',
  },
  /** Home, /pages/ list, or any route with no active page */
  'no-page': {
    tabs: ['task-overview'],
    defaultTab: 'task-overview',
  },
};

// ─── Resolvers ──────────────────────────────────────────────────────────

/** Determine sidepanel context from the current route pathname and page. */
export function resolveSidepanelContext(
  pathname: string,
  currentPage?: Page | null,
): SidepanelContext {
  if (pathname.startsWith('/tasks')) return 'tasks-route';
  if (currentPage?.viewMode === 'tasks') return 'task-page';
  if (currentPage?.viewMode === 'collection') return 'collection-page';
  if (currentPage) return 'note-page';
  return 'no-page';
}

/** Get the layout for a given context. */
export function getSidepanelLayout(context: SidepanelContext): SidepanelLayout {
  return SIDEPANEL_LAYOUTS[context];
}
