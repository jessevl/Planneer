/**
 * @file graph.tsx
 * @description Workspace graph route (/graph)
 * @app SHARED - Dedicated relationship graph view
 */
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const GraphView = lazy(() => import('@/views/GraphView'));

interface GraphSearchParams {
  selected?: string;
}

export const Route = createFileRoute('/graph')({
  component: () => <Suspense fallback={null}><GraphView /></Suspense>,
  validateSearch: (search: Record<string, unknown>): GraphSearchParams => {
    return {
      selected: typeof search.selected === 'string' ? search.selected : undefined,
    };
  },
});