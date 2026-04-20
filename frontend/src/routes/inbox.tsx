/**
 * @file inbox.tsx
 * @description Inbox route for unfiled parentless pages
 */
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const PagesView = lazy(() => import('@/views/PagesView'));

export const Route = createFileRoute('/inbox')({
  component: () => <Suspense fallback={null}><PagesView mode="inbox" /></Suspense>,
});