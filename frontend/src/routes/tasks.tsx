/**
 * @file tasks.tsx
 * @description Tasks layout route (/tasks) - renders child filter routes
 * @app TASKS - Task list layout
 */
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { useNavigationStore } from '@/stores/navigationStore';

export const Route = createFileRoute('/tasks')({
  beforeLoad: ({ location }) => {
    // Only redirect if we're exactly on /tasks (not /tasks/something)
    if (location.pathname === '/tasks') {
      const filter = useNavigationStore.getState().taskFilter || 'all';
      throw redirect({ to: '/tasks/$filter', params: { filter } });
    }
  },
  component: () => <Outlet />,
});
