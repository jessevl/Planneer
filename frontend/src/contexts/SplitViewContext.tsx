/**
 * @file SplitViewContext.tsx
 * @description Store and context for managing split view state and actions
 * 
 * This module provides both:
 * 1. A Zustand store for global split view state (accessible anywhere)
 * 2. A React context for providing split view handlers
 * 
 * The store tracks which page is currently shown in a split view's left panel.
 * Components like the sidebar can check this to determine if creating a child
 * should open in the split view panel or navigate away.
 * 
 * Usage:
 * - PagesView and PageDetailView call `useSplitViewStore` to set the parent page ID
 *   and register handlers when they render a split view
 * - Sidebar checks the store to see if a page is the split view parent
 */
import React, { createContext, useContext, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import type { PageViewMode } from '@/types/page';

// ============================================================================
// ZUSTAND STORE FOR GLOBAL SPLIT VIEW STATE
// ============================================================================

interface SplitViewState {
  /** The page ID shown on the left side of the split view (if any) */
  parentPageId: string | null;
  /** Handler to create a child and open it in the split view right panel */
  onCreateChild: ((parentId: string | null, viewMode?: PageViewMode) => void) | null;
  /** Handler to navigate to a page in the split view right panel */
  onNavigateInSplitView: ((pageId: string) => void) | null;
  
  // Navigation history for split view right panel
  history: string[];
  historyIndex: number;
  canGoBack: boolean;
  canGoForward: boolean;
  
  // Actions
  setSplitViewState: (
    parentPageId: string | null,
    onCreateChild: ((parentId: string | null, viewMode?: PageViewMode) => void) | null,
    onNavigateInSplitView: ((pageId: string) => void) | null
  ) => void;
  clearSplitViewState: () => void;
  
  // Navigation actions
  pushToHistory: (pageId: string) => void;
  goBack: () => string | null;
  goForward: () => string | null;
  clearHistory: () => void;
}

export const useSplitViewStore = create<SplitViewState>((set, get) => ({
  parentPageId: null,
  onCreateChild: null,
  onNavigateInSplitView: null,
  
  // Navigation history
  history: [],
  historyIndex: -1,
  canGoBack: false,
  canGoForward: false,
  
  setSplitViewState: (parentPageId, onCreateChild, onNavigateInSplitView) => set({
    parentPageId,
    onCreateChild,
    onNavigateInSplitView,
  }),
  
  clearSplitViewState: () => set({
    parentPageId: null,
    onCreateChild: null,
    onNavigateInSplitView: null,
    history: [],
    historyIndex: -1,
    canGoBack: false,
    canGoForward: false,
  }),
  
  pushToHistory: (pageId: string) => {
    const { history, historyIndex } = get();
    
    // Don't add duplicate consecutive entries
    if (history[historyIndex] === pageId) {
      return;
    }
    
    // When pushing, discard forward history
    const newHistory = [...history.slice(0, historyIndex + 1), pageId];
    const newIndex = newHistory.length - 1;
    
    set({
      history: newHistory,
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: false,
    });
  },
  
  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return null;
    
    const newIndex = historyIndex - 1;
    set({
      historyIndex: newIndex,
      canGoBack: newIndex > 0,
      canGoForward: true,
    });
    
    return history[newIndex];
  },
  
  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return null;
    
    const newIndex = historyIndex + 1;
    set({
      historyIndex: newIndex,
      canGoBack: true,
      canGoForward: newIndex < history.length - 1,
    });
    
    return history[newIndex];
  },
  
  clearHistory: () => set({
    history: [],
    historyIndex: -1,
    canGoBack: false,
    canGoForward: false,
  }),
}));

// ============================================================================
// REACT CONTEXT (for backwards compatibility and cleaner component API)
// ============================================================================

interface SplitViewContextValue {
  /** The page ID shown on the left side of the split view (if any) */
  parentPageId: string | null;
  /** Handler to create a child and open it in the split view right panel */
  onCreateChild: ((parentId: string | null, viewMode?: PageViewMode) => void) | null;
  /** Handler to navigate to a page in the split view right panel */
  onNavigateInSplitView: ((pageId: string) => void) | null;
}

const SplitViewContext = createContext<SplitViewContextValue>({
  parentPageId: null,
  onCreateChild: null,
  onNavigateInSplitView: null,
});

interface SplitViewProviderProps {
  children: ReactNode;
  /** The page ID shown on the left side of the split view (null for root) */
  parentPageId: string | null;
  /** Handler to create a child and open it in the split view right panel */
  onCreateChild: (parentId: string | null, viewMode?: PageViewMode) => void;
  /** Handler to navigate to a page in the split view right panel */
  onNavigateInSplitView: (pageId: string) => void;
}

export function SplitViewProvider({
  children,
  parentPageId,
  onCreateChild,
  onNavigateInSplitView,
}: SplitViewProviderProps) {
  const setSplitViewState = useSplitViewStore((s) => s.setSplitViewState);
  const clearSplitViewState = useSplitViewStore((s) => s.clearSplitViewState);
  
  // Register split view state in the global store when this provider mounts
  // Only re-run when parentPageId changes (callbacks are stable via useCallback in parent)
  useEffect(() => {
    setSplitViewState(parentPageId, onCreateChild, onNavigateInSplitView);
    
    // Clear when unmounting
    return () => {
      clearSplitViewState();
    };
   
  }, [parentPageId, setSplitViewState, clearSplitViewState]);
  
  // Update callbacks when they change (without triggering cleanup)
  useEffect(() => {
    setSplitViewState(parentPageId, onCreateChild, onNavigateInSplitView);
  }, [parentPageId, onCreateChild, onNavigateInSplitView, setSplitViewState]);
  
  const value = useMemo(() => ({
    parentPageId,
    onCreateChild,
    onNavigateInSplitView,
  }), [parentPageId, onCreateChild, onNavigateInSplitView]);

  return (
    <SplitViewContext.Provider value={value}>
      {children}
    </SplitViewContext.Provider>
  );
}

/**
 * Hook to access split view context (for components inside the provider)
 * Returns the context value with parentPageId and handlers
 */
export function useSplitView(): SplitViewContextValue {
  return useContext(SplitViewContext);
}

/**
 * Hook to check if we're in a split view context
 */
export function useIsInSplitView(): boolean {
  const { parentPageId } = useContext(SplitViewContext);
  return parentPageId !== null;
}

/**
 * Hook to get a child creation handler that respects split view context
 * Uses the global store so it works from anywhere (like sidebar)
 * 
 * Returns a handler that:
 * - If creating a child of the split view parent page, uses split view navigation
 * - Otherwise, uses the provided fallback handler
 */
export function useSplitViewAwareCreateChild(
  fallbackHandler: (parentId: string | null, viewMode?: PageViewMode) => void
) {
  const parentPageId = useSplitViewStore((s) => s.parentPageId);
  const onCreateChild = useSplitViewStore((s) => s.onCreateChild);

  return useCallback((parentId: string | null, viewMode?: PageViewMode) => {
    // If creating a child of the split view parent page, use split view handler
    if (parentId && parentId === parentPageId && onCreateChild) {
      onCreateChild(parentId, viewMode);
    } else {
      // Otherwise, use the fallback (normal navigation)
      fallbackHandler(parentId, viewMode);
    }
  }, [parentPageId, onCreateChild, fallbackHandler]);
}
