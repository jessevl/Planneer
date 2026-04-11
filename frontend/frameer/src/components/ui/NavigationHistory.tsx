/**
 * @file NavigationHistory.tsx
 * @description Browser-like back/forward navigation buttons
 * 
 * Uses the browser's native history API directly for reliable navigation.
 * Tracks navigation position using history.state to know when back/forward is possible.
 */
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@frameer/lib/design-system';

const NAV_INDEX_KEY = '__navIndex';

/**
 * Get the current navigation index from history state
 */
function getNavIndex(): number {
  return (window.history.state?.[NAV_INDEX_KEY] as number) ?? 0;
}

/**
 * Hook to track and control browser navigation history
 * Uses native browser history API with state tracking for reliable back/forward
 */
export function useNavigationHistory() {
  const [currentIndex, setCurrentIndex] = React.useState(getNavIndex);
  const [maxIndex, setMaxIndex] = React.useState(getNavIndex);
  
  // Initialize history state with navigation index if not present
  React.useEffect(() => {
    const state = window.history.state ?? {};
    if (state[NAV_INDEX_KEY] === undefined) {
      window.history.replaceState({ ...state, [NAV_INDEX_KEY]: 0 }, '');
      setCurrentIndex(0);
      setMaxIndex(0);
    }
  }, []);
  
  // Listen for popstate (browser back/forward or our buttons)
  React.useEffect(() => {
    const handler = (event: PopStateEvent) => {
      const index = event.state?.[NAV_INDEX_KEY] ?? 0;
      setCurrentIndex(index);
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  
  // Patch pushState to track navigation index
  React.useEffect(() => {
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    
    window.history.pushState = function(state: any, title: string, url?: string | URL | null) {
      const newIndex = getNavIndex() + 1;
      const newState = { ...state, [NAV_INDEX_KEY]: newIndex };
      setCurrentIndex(newIndex);
      setMaxIndex(newIndex); // New navigation clears forward history
      return originalPushState(newState, title, url);
    };
    
    window.history.replaceState = function(state: any, title: string, url?: string | URL | null) {
      // Preserve existing nav index on replace
      const currentNavIndex = getNavIndex();
      const newState = { ...state, [NAV_INDEX_KEY]: currentNavIndex };
      return originalReplaceState(newState, title, url);
    };
    
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);
  
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < maxIndex;
  
  const goBack = React.useCallback(() => {
    if (currentIndex > 0) {
      window.history.back();
    }
  }, [currentIndex]);
  
  const goForward = React.useCallback(() => {
    if (currentIndex < maxIndex) {
      window.history.forward();
    }
  }, [currentIndex, maxIndex]);
  
  return {
    canGoBack,
    canGoForward,
    goBack,
    goForward,
  };
}

// Legacy export for compatibility - no longer needed but keep for existing imports
export const useNavigationHistoryStore = { getState: () => ({ canGoBack: false, canGoForward: false }) };

// ============================================================================
// NAVIGATION BUTTONS COMPONENT
// ============================================================================

interface NavigationHistoryButtonsProps {
  className?: string;
  size?: 'sm' | 'md';
}

export const NavigationHistoryButtons: React.FC<NavigationHistoryButtonsProps> = ({
  className,
  size = 'sm',
}) => {
  const { canGoBack, goBack } = useNavigationHistory();
  
  const iconSize = size === 'sm' ? 16 : 20;
  const buttonSize = size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        onClick={goBack}
        disabled={!canGoBack}
        title="Go back"
        className={cn(
          'flex items-center justify-center rounded-full transition-all',
          buttonSize,
          canGoBack 
            ? 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]' 
            : 'text-[var(--color-text-disabled)] cursor-not-allowed'
        )}
      >
        <ChevronLeft size={iconSize} strokeWidth={1.75} />
      </button>
    </div>
  );
};

export default NavigationHistoryButtons;

