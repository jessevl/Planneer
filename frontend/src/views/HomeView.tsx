/**
 * @file HomeView.tsx
 * @description Modern, gallery-focused dashboard with quick overview
 * @app SHARED - Default landing view for the unified app
 * 
 * Features:
 * - Recent pages gallery as the primary focus (like Notion, Craft)
 * - Favorites/pinned pages for quick access
 * - Agenda board for overdue, today, and tomorrow tasks
 * - Header quick actions for creating pages and tasks
 * 
 * Design principles:
 * - Content-first: show recent work prominently
 * - Quick access: favorites and quick create always visible
 * - Modern and delightful with animations
 * - Responsive: works great on mobile and desktop
 */
import React, { useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { getTodayISO, dayjs } from '../lib/dateUtils';
import { Container } from '@/components/ui';
import { 
  Calendar,
  History,
} from 'lucide-react';
import UnifiedHeader from '../components/layout/UnifiedHeader';
import PomodoroTimer from '../components/pomodoro/PomodoroTimer';
import InlineFocusTimer from '../components/pomodoro/InlineFocusTimer';

// New home components
import { RecentPagesGallery, FavoritesSection, TodaySectionsBoard } from '../components/home';

// Stores
import { useTasksStore, useTasks } from '../stores/tasksStore';
import { usePagesStore, useRecentPages, usePinnedPages, type PagesState } from '@/stores/pagesStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useUIStore } from '../stores/uiStore';
import { usePomodoroStore } from '../stores/pomodoroStore';
import { useAuthStore } from '../stores/authStore';

// Types
import type { Task } from '../types/task';

// Icons component
import { HomeIcon } from '../components/common/Icons';

// ============================================================================
// MAIN HOME VIEW
// ============================================================================
const HomeView: React.FC = () => {
  const navigate = useNavigate();

  // Sidebar
  const sidebarVisible = useNavigationStore((s) => s.sidebarVisible);
  const setSidebarVisible = useNavigationStore((s) => s.setSidebarVisible);
  const toggleSidebar = useCallback(() => setSidebarVisible(!sidebarVisible), [setSidebarVisible, sidebarVisible]);

  // Tasks
  const tasks = useTasks();
  const toggleComplete = useTasksStore((s) => s.toggleComplete);
  const todayISO = useMemo(() => getTodayISO(), []);

  // UI store
  const startEditingTask = useUIStore((s) => s.startEditingTask);
  const createTaskInContext = useUIStore((s) => s.createTaskInContext);

  // Pages - increased limit to show more in gallery
  const recentPages = useRecentPages(8);
  const pinnedPages = usePinnedPages();
  const pages = usePagesStore((s) => s.pagesById);
  const tasksById = useTasksStore((s) => s.tasksById);
  const taskPages = useMemo(() => {
    const taskParentIds = new Set(
      Object.values(tasksById).map(t => t.parentPageId).filter(Boolean)
    );
    return Object.values(pages).filter(
      p => p.viewMode === 'tasks' || taskParentIds.has(p.id)
    );
  }, [pages, tasksById]);
  const createPage = usePagesStore((s: PagesState) => s.createPage);
  const selectPage = usePagesStore((s: PagesState) => s.selectPage);

  // Pomodoro
  const isImmersive = usePomodoroStore((s) => s.isImmersive);
  const exitImmersive = usePomodoroStore((s) => s.exitImmersive);

  // Auth
  const user = useAuthStore((s) => s.user);
  const displayName = user?.name || user?.username || 'User';

  // Today's tasks
  const taskBuckets = useMemo(() => {
    const today = dayjs(todayISO).startOf('day');
    const sortedTasks = tasks
      .filter((task: Task) => !task.completed && Boolean(task.dueDate))
      .sort((a: Task, b: Task) => dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf());

    const overdue: Task[] = [];
    const todayTasks: Task[] = [];
    const tomorrowTasks: Task[] = [];

    sortedTasks.forEach((task) => {
      const dueDate = dayjs(task.dueDate).startOf('day');
      const dayOffset = dueDate.diff(today, 'day');

      if (dayOffset < 0) {
        overdue.push(task);
        return;
      }

      if (dayOffset === 0) {
        todayTasks.push(task);
        return;
      }

      if (dayOffset === 1) {
        tomorrowTasks.push(task);
      }
    });

    return {
      overdue,
      today: todayTasks,
      tomorrow: tomorrowTasks,
    };
  }, [tasks, todayISO]);

  const todayTasks = useMemo(
    () => [...taskBuckets.overdue, ...taskBuckets.today],
    [taskBuckets.overdue, taskBuckets.today],
  );

  // Handlers
  const handleCreatePage = useCallback(() => {
    const newPage = createPage({ title: 'Untitled', viewMode: 'note' });
    selectPage(newPage.id, true);
    navigate({ to: '/pages/$id', params: { id: newPage.id } });
  }, [createPage, selectPage, navigate]);

  const handleViewAllTasks = useCallback(() => {
    navigate({ to: '/tasks/$filter', params: { filter: 'today' } });
  }, [navigate]);

  const handleViewUpcomingTasks = useCallback(() => {
    navigate({ to: '/tasks/$filter', params: { filter: 'upcoming' } });
  }, [navigate]);

  const handleViewAllPages = useCallback(() => {
    navigate({ to: '/pages' });
  }, [navigate]);

  const handlePageClick = useCallback((pageId: string) => {
    selectPage(pageId);
    navigate({ to: '/pages/$id', params: { id: pageId } });
  }, [selectPage, navigate]);

  const getParentPage = useCallback((page: { parentId?: string | null }) => {
    if (!page.parentId) return null;
    return pages[page.parentId] ?? null;
  }, [pages]);

  const handleCreateChildPage = useCallback((parentId: string) => {
    const newPage = createPage({ title: 'Untitled', parentId, viewMode: 'note' });
    selectPage(newPage.id, true);
    navigate({ to: '/pages/$id', params: { id: newPage.id } });
  }, [createPage, selectPage, navigate]);

  const handleCreateTask = useCallback((parentPageId: string) => {
    createTaskInContext({ defaultTaskPageId: parentPageId });
  }, [createTaskInContext]);

  const handleQuickCreateTask = useCallback(() => {
    createTaskInContext();
  }, [createTaskInContext]);

  const handleTaskClick = useCallback((taskId: string) => {
    startEditingTask(taskId);
  }, [startEditingTask]);

  const handleToggleComplete = useCallback((taskId: string) => {
    toggleComplete(taskId);
  }, [toggleComplete]);

  // Formatted date
  const todayFormatted = useMemo(() => dayjs(todayISO).format('dddd, MMMM D'), [todayISO]);

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = dayjs().hour();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto home-gradient">
        {/* Header - sticky, floats over content when scrolling */}
        <UnifiedHeader
          sidebarVisible={sidebarVisible}
          onToggleSidebar={toggleSidebar}
          rootLabel="Home"
          rootIcon={<HomeIcon className="w-4 h-4" />}
          desktopWidthClassName="mx-auto max-w-[1400px]"
          additionalActionsLeft={
            <InlineFocusTimer todayTasks={todayTasks} variant="header" size="sm" />
          }
        />

        <Container className="mx-auto max-w-[1400px] pt-[calc(var(--header-height)+1.25rem)] py-2 px-4 pb-32 md:pb-12">
          
          {/* Hero Section - Compact */}
          <div className="relative mb-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
                  {greeting}, <span className="text-[var(--color-accent-primary)]">{displayName}</span>
                </h1>
                <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-primary)] px-3 py-1 text-sm text-[var(--color-text-secondary)]">
                  <Calendar className="w-4 h-4 text-[var(--color-accent-primary)]" />
                  {todayFormatted}
                </p>
              </div>
            </div>
          </div>

          {/* Recent Pages Gallery - Primary focus */}
          <RecentPagesGallery
            pages={recentPages}
            getParentPage={getParentPage}
            onPageClick={handlePageClick}
            onCreatePage={handleCreatePage}
            onViewAll={handleViewAllPages}
            title="Recent"
            icon={<History className="w-5 h-5 text-[var(--color-accent-primary)]" />}
            emptyTitle="No pages yet"
            emptyDescription="Create your first page to get started"
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
            <div className="lg:col-span-2">
              <TodaySectionsBoard
                overdueTasks={taskBuckets.overdue}
                todayTasks={taskBuckets.today}
                tomorrowTasks={taskBuckets.tomorrow}
                todayISO={todayISO}
                taskPages={taskPages}
                onToggleComplete={handleToggleComplete}
                onTaskClick={handleTaskClick}
                onViewTodayTasks={handleViewAllTasks}
                onCreateTask={handleQuickCreateTask}
              />
            </div>

            <div className="lg:col-span-1">
              <FavoritesSection
                pages={pinnedPages}
                onPageClick={handlePageClick}
                onCreateChild={handleCreateChildPage}
                onCreateTask={handleCreateTask}
              />
            </div>
          </div>

        </Container>
      </div>

      {/* Immersive Pomodoro Timer */}
      {isImmersive && <PomodoroTimer onClose={exitImmersive} tasks={todayTasks} />}
    </div>
  );
};

export default HomeView;
