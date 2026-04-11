/**
 * @file handwritten.$id.tsx
 * @description Route for a specific handwritten notebook
 */
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const HandwrittenNotesView = lazy(() => import('@/views/HandwrittenNotesView'));

export const Route = createFileRoute('/handwritten/$id')({
  component: HandwrittenNotebookRoute,
});

function HandwrittenNotebookRoute() {
  const { id } = Route.useParams();
  return <Suspense fallback={null}><HandwrittenNotesView routePageId={id} /></Suspense>;
}