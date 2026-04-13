/**
 * @file common/index.ts
 * @description Barrel exports for common components
 */
export { default as CalendarPicker } from './CalendarPicker';
export { default as ConfirmDeleteModal } from './ConfirmDeleteModal';
export { default as ConfirmDiscardModal } from './ConfirmDiscardModal';
export { ErrorBoundary, withErrorBoundary } from './ErrorBoundary';
export * from './Icons';
export { default as ItemIcon } from './ItemIcon';
export { StylizedNoteIcon, StylizedCollectionIcon, StylizedTaskIcon, StylizedDailyIcon } from './StylizedIcons';
export { default as PageTypeDropdown } from './PageTypeDropdown';
export { default as TreeSidebarItem } from './TreeSidebarItem';
export type { TreeSidebarItemProps, TreeItemType } from './TreeSidebarItem';
export { default as DueTimelineStrip } from './DueTimelineStrip';

