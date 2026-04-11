/**
 * @file pages.$id.tsx
 * @description Unified page route (/pages/:id)
 * @app UNIFIED - Single page view (pages, collections, task collections)
 * 
 * All page types (viewMode: 'note', 'collection', 'tasks') render through this route.
 * 
 */
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const PagesView = lazy(() => import('@/views/PagesView'));

export const Route = createFileRoute('/pages/$id')({
  component: PageRoute,
});

function PageRoute() {
  const { id } = Route.useParams();
  return <Suspense fallback={null}><PagesView routePageId={id} /></Suspense>;
}
