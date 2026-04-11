/**
 * @file viewModeConfig.tsx
 * @description Shared page mode configuration for consistent UI across dropdowns
 * 
 * Three distinct page modes:
 * - "Note" for writing and rich-text content
 * - "Collection" for organizing and browsing child pages
 * - "Tasks" for task management with lists and kanban
 */
import React from 'react';
import { 
  StylizedNoteIcon, 
  StylizedCollectionIcon, 
  StylizedTaskIcon 
} from '@/components/common/StylizedIcons';
import type { PageViewMode } from '@/types/page';

export interface ViewModeOption {
  value: PageViewMode;
  label: string;
  description?: string;
  icon: React.FC<{ className?: string; color?: string | null; size?: 'sm' | 'md' | 'lg' }>;
}

/** All view modes (used internally for full config) */
export const viewModeOptions: ViewModeOption[] = [
  { value: 'note', label: 'Note', description: 'Write and organize content', icon: StylizedNoteIcon },
  { value: 'collection', label: 'Collection', description: 'Organize and browse pages', icon: StylizedCollectionIcon },
  { value: 'tasks', label: 'Tasks', description: 'Manage tasks with lists and kanban', icon: StylizedTaskIcon },
];

/** Creation options: Note (default), Collection, or Tasks */
export const createPageOptions: ViewModeOption[] = [
  { value: 'note', label: 'Note', description: 'Write and organize content', icon: StylizedNoteIcon },
  { value: 'collection', label: 'Collection', description: 'Organize and browse pages', icon: StylizedCollectionIcon },
  { value: 'tasks', label: 'Tasks', description: 'Manage tasks with lists and kanban', icon: StylizedTaskIcon },
];
