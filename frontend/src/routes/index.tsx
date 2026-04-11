/**
 * @file index.tsx
 * @description Home route (/)
 * @app ROOT - Dashboard landing page
 */
import { createFileRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

const HomeView = lazy(() => import('@/views/HomeView'));

export const Route = createFileRoute('/')({
  component: () => <Suspense fallback={null}><HomeView /></Suspense>,
});
