/**
 * @file tasks.$filter.tsx
 * @description Tasks with filter route (/tasks/:filter)
 * @app TASKS - Task list with inbox/today/upcoming/all filter OR task page (page ID)
 * 
 * The filter param can be either:
 * - A standard filter: 'inbox', 'today', 'upcoming', 'all'
 * - A page ID (UUID) for task pages (pages with viewMode='tasks')
 */
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const TasksView = lazy(() => import('@/views/TasksView'));
import type { TaskFilter } from '@/stores/navigationStore';

// Valid filter values
const validFilters = ['inbox', 'today', 'upcoming', 'all'] as const;

export const Route = createFileRoute('/tasks/$filter')({
  parseParams: (params) => {
    // If the filter is a UUID (page ID), keep it as-is for task page view
    // Otherwise validate it as a standard filter
    const isPageId = params.filter.length > 15; // UUIDs are longer than filter names
    return {
      filter: isPageId 
        ? params.filter 
        : (validFilters.includes(params.filter as TaskFilter) 
            ? params.filter 
            : 'upcoming') as TaskFilter,
    };
  },
  component: TasksFilterView,
});

function TasksFilterView() {
  const { filter } = Route.useParams();
  
  // Determine if this is a task page view (UUID) or standard filter
  const isPageId = filter.length > 15;
  
  if (isPageId) {
    // Task page view
    return <Suspense fallback={null}><TasksView routeTaskPageId={filter} /></Suspense>;
  } else {
    // Standard filter view
    return <Suspense fallback={null}><TasksView routeFilter={filter as TaskFilter} /></Suspense>;
  }
}

