import { lazy, Suspense } from 'react';
import { createFileRoute } from '@tanstack/react-router';

const TestEditorPage = lazy(() => import('@/views/TestEditorView'));

export const Route = createFileRoute('/test-editor')({
  component: () => <Suspense fallback={null}><TestEditorPage /></Suspense>,
});
