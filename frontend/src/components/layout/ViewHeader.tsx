/**
 * @file ViewHeader.tsx
 * @description Header component for main content views
 * @app SHARED - Used by both Tasks App and Notes App views
 * 
 * Displays the header bar at the top of the main content area:
 * - Title and optional subtitle
 * - Sidebar toggle button (when sidebar is hidden)
 * - ViewSwitcher dropdown for view options
 * - Optional view layout toggle (list/kanban)
 * - Optional action button and additional actions
 * 
 * Used by:
 * - TasksView (Tasks App)
 * - NotesView (Notes App)
 * - SettingsPanel
 */
import React from 'react';
import { SidebarIcon, ListChecksIcon } from '../common/Icons';
import ViewSwitcherMobileWrapper from './ViewSwitcherMobileWrapper';
import type { ViewMode, GroupBy } from '../../types/view';
import { H2, TextSmall, IconButton, Button, Panel, Container, FlexGroup } from '@/components/ui';
import { useSelectionStore } from '@/stores/selectionStore';
import { cn } from '@/lib/design-system';

interface ViewHeaderProps {
  // Common props
  title: string;
  subtitle?: string | React.ReactNode;
  sidebarVisible?: boolean;
  onShowSidebar?: () => void;
  
  // View switcher props
  viewMode: ViewMode;
  groupBy: GroupBy;
  showCompleted: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onGroupByChange: (groupBy: GroupBy) => void;
  onShowCompletedChange: (show: boolean) => void;
  
  // Content type specific
  contentType?: 'tasks' | 'pages';
  sortBy?: 'updated' | 'created' | 'title';
  onSortByChange?: (sortBy: 'updated' | 'created' | 'title') => void;
  hasSections?: boolean;
  
  // View layout toggle (list/kanban) - rendered next to ViewSwitcher
  viewLayoutToggle?: React.ReactNode;
  
  // Action button
  actionButton?: {
    label: string;
    onClick: () => void;
  };
  
  // Additional actions (like Manage Sections)
  additionalActions?: React.ReactNode;
}

const ViewHeader: React.FC<ViewHeaderProps> = ({
  title,
  subtitle,
  sidebarVisible = true,
  onShowSidebar,
  viewMode,
  groupBy,
  showCompleted,
  onViewModeChange,
  onGroupByChange,
  onShowCompletedChange,
  contentType = 'tasks',
  sortBy,
  onSortByChange,
  hasSections = false,
  actionButton,
  additionalActions,
  viewLayoutToggle,
}) => {
  const { selectionMode, setSelectionMode, getSelectionCount } = useSelectionStore();
  const taskSelectionCount = getSelectionCount('task');

  return (
    <div className="sticky top-0 z-20">
      <div>
        <Container className="py-4">
          <FlexGroup justify="between">
            {/* Left side - Title and subtitle */}
            <FlexGroup gap="md">
              {!sidebarVisible && onShowSidebar && (
                <IconButton
                  onClick={onShowSidebar}
                  variant="ghost"
                  size="sm"
                  title="Show sidebar"
                  aria-label="Show sidebar"
                >
                  <SidebarIcon className="w-4 h-4" />
                </IconButton>
              )}
              <div>
                <H2 className="!text-2xl !md:text-2xl">
                  {title}
                </H2>
                {subtitle && (
                  <TextSmall className="mt-0.5">
                    {subtitle}
                  </TextSmall>
                )}
              </div>
            </FlexGroup>

            {/* Right side - Actions */}
            <FlexGroup gap="sm">
              {contentType === 'tasks' && (
                <IconButton
                  onClick={() => setSelectionMode(!selectionMode)}
                  variant={selectionMode ? 'primary' : 'ghost'}
                  size="sm"
                  title={selectionMode ? "Exit selection mode" : "Select tasks"}
                  className={cn(
                    selectionMode && "bg-[var(--color-accent-primary)] text-white hover:bg-[var(--color-accent-hover)]",
                    !selectionMode && taskSelectionCount > 0 && "text-[var(--color-accent-primary)]"
                  )}
                >
                  <ListChecksIcon className="w-4 h-4" />
                </IconButton>
              )}
              {additionalActions}
              {/* View layout toggle (list/card) - left of ViewSwitcher */}
              {viewLayoutToggle}
              <ViewSwitcherMobileWrapper
                viewMode={viewMode}
                groupBy={groupBy}
                showCompleted={showCompleted}
                onViewModeChange={onViewModeChange}
                onGroupByChange={onGroupByChange}
                onShowCompletedChange={onShowCompletedChange}
                contentType={contentType}
                sortBy={sortBy}
                onSortByChange={onSortByChange}
                hasSections={hasSections}
              />
              {actionButton && (
                <Button
                  onClick={actionButton.onClick}
                  variant="primary"
                  size="sm"
                >
                  {actionButton.label}
                </Button>
              )}
            </FlexGroup>
          </FlexGroup>
        </Container>
      </div>
    </div>
  );
};

export default ViewHeader;
