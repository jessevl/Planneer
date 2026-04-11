/**
 * @file handwritten.tsx
 * @description Parent route for the handwritten notes library
 */
import { createFileRoute, Outlet, useMatch } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const HandwrittenNotesView = lazy(() => import('@/views/HandwrittenNotesView'));

export const Route = createFileRoute('/handwritten')({
  component: HandwrittenLayout,
});

function HandwrittenLayout() {
  const childMatch = useMatch({ from: '/handwritten/$id', shouldThrow: false });

  if (childMatch) {
    return <Outlet />;
  }

  return <Suspense fallback={null}><HandwrittenNotesView /></Suspense>;
}