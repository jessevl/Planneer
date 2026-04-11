/**
 * @file pages.tsx
 * @description Parent route for /pages
 */
import { createFileRoute, Outlet, useMatch } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const PagesView = lazy(() => import('@/views/PagesView'));

export const Route = createFileRoute('/pages')({
  component: PagesLayout,
});

function PagesLayout() {
  // If we have a child route match (like /pages/:id), render the Outlet
  const childMatch = useMatch({ from: '/pages/$id', shouldThrow: false });

  if (childMatch) {
    return <Outlet />;
  }

  // Otherwise, render the pages list view
  return <Suspense fallback={null}><PagesView /></Suspense>;
}
