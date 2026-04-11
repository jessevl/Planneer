/**
 * @file useRouterNavigation.ts
 * @description Router navigation utilities hook for programmatic navigation
 * @app SHARED - Used throughout the app for navigation actions
 * 
 * Provides type-safe navigation functions and location helpers.
 * Use <Link> components for UI navigation, use these functions for
 * programmatic navigation in callbacks and effects.
 */
import { useNavigate, useLocation } from '@tanstack/react-router';
import type { TaskFilter } from '@/stores/navigationStore';

export function useRouterNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  
  return {
    // Programmatic navigation functions
    goHome: () => navigate({ to: '/' }),
    
    goToTasks: (filter: TaskFilter = 'upcoming') => 
      navigate({ to: '/tasks/$filter', params: { filter } }),
    
    goToProject: (id: string) => 
      navigate({ to: '/tasks/$filter', params: { filter: id } }),
    
    goToNotes: () => 
      navigate({ to: '/pages' }),
    
    goToNote: (id: string) => 
      navigate({ to: '/pages/$id', params: { id } }),
    
    // Current location helpers
    pathname: location.pathname,
    isHome: location.pathname === '/',
    isTasksView: location.pathname.startsWith('/tasks'),
    isTaskPageView: location.pathname.startsWith('/taskPages'),
    isNotesView: location.pathname.startsWith('/pages'),
    
    // Get current filter/id from URL
    getCurrentTaskFilter: (): TaskFilter | null => {
      const match = location.pathname.match(/^\/tasks\/(\w+)/);
      return match ? (match[1] as TaskFilter) : null;
    },
    
    getCurrentProjectId: (): string | null => {
      const match = location.pathname.match(/^\/tasks\/([^/]+)/);
      return match ? match[1] : null;
    },
    
    getCurrentNoteId: (): string | null => {
      const match = location.pathname.match(/^\/pages\/([^/]+)/);
      return match ? match[1] : null;
    },
  };
}

// Type for the return value
export type RouterNavigation = ReturnType<typeof useRouterNavigation>;
