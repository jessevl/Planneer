/**
 * @file actionMenuData.ts
 * @description Shared block type data and utilities for Yoopta action menus
 * @app NOTES APP ONLY - Used by EditorSlashMenu and MobileActionMenu
 * 
 * Centralizes block definitions to avoid duplication between desktop and mobile menus.
 */
import React from 'react';
import {
  TypeIcon,
  ListViewIcon,
  CheckIcon,
  QuoteIcon,
  LightbulbIcon,
  MinusIcon,
  ChevronRightIcon,
  TableIcon,
  PinIcon,
  ImageIcon,
  TableOfContentsIcon,
  BookmarkIcon,
  DocumentIcon,
  MicIcon,
  LayoutIcon,
  WhiteboardIcon,
  ColumnsIcon,
} from '@/components/common/Icons';

// ============================================================================
// TYPES
// ============================================================================

export interface BlockOption {
  type: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  group: string;
  shortcut?: string;
}

export interface BlockGroup {
  label: string;
  items: BlockOption[];
}

// ============================================================================
// BLOCK OPTIONS DATA
// ============================================================================

export const BLOCK_OPTIONS: BlockOption[] = [
  // Basic blocks
  { type: 'Paragraph', title: 'Text', description: 'Plain text block', icon: <TypeIcon className="w-5 h-5" />, group: 'Basic blocks' },
  { type: 'HeadingOne', title: 'Heading 1', description: 'Large heading', icon: <span className="font-bold text-sm">H1</span>, group: 'Basic blocks', shortcut: '#' },
  { type: 'HeadingTwo', title: 'Heading 2', description: 'Medium heading', icon: <span className="font-bold text-sm">H2</span>, group: 'Basic blocks', shortcut: '##' },
  { type: 'HeadingThree', title: 'Heading 3', description: 'Small heading', icon: <span className="font-bold text-sm">H3</span>, group: 'Basic blocks', shortcut: '###' },
  { type: 'BulletedList', title: 'Bulleted list', description: 'Create a list with bullets', icon: <ListViewIcon className="w-5 h-5" />, group: 'Basic blocks', shortcut: '-' },
  { type: 'NumberedList', title: 'Numbered list', description: 'Create a numbered list', icon: <span className="text-sm font-mono font-medium">1.</span>, group: 'Basic blocks', shortcut: '1.' },
  { type: 'TodoList', title: 'To-do list', description: 'Track tasks with checkboxes', icon: <CheckIcon className="w-5 h-5" />, group: 'Basic blocks', shortcut: '[]' },
  
  // Content
  { type: 'Blockquote', title: 'Quote', description: 'Capture a quote', icon: <QuoteIcon className="w-5 h-5" />, group: 'Content' },
  { type: 'Callout', title: 'Callout', description: 'Highlight important info', icon: <LightbulbIcon className="w-5 h-5" />, group: 'Content' },
  { type: 'Divider', title: 'Divider', description: 'Visual separator', icon: <MinusIcon className="w-5 h-5" />, group: 'Content' },
  { type: 'AdvancedTable', title: 'Table', description: 'Table with colors, sorting & formulas', icon: <TableIcon className="w-5 h-5" />, group: 'Content' },
  { type: 'TableOfContents', title: 'Table of Contents', description: 'Navigate document headings', icon: <TableOfContentsIcon className="w-5 h-5" />, group: 'Content' },
  { type: 'Tabs', title: 'Tabs', description: 'Tabbed content panels', icon: <LayoutIcon className="w-5 h-5" />, group: 'Content' },
  { type: 'Whiteboard', title: 'Whiteboard', description: 'Draw and diagram', icon: <WhiteboardIcon className="w-5 h-5" />, group: 'Content' },
  { type: 'Columns', title: 'Columns', description: 'Side-by-side block layout', icon: <ColumnsIcon className="w-5 h-5" />, group: 'Content' },

  // Links & Media
  { type: 'InternalLink', title: 'Link to Page', description: 'Link to another page', icon: <PinIcon className="w-5 h-5" />, group: 'Links & Media' },
  { type: 'Bookmark', title: 'Bookmark', description: 'Save a link as visual bookmark', icon: <BookmarkIcon className="w-5 h-5" />, group: 'Links & Media' },
  { type: 'Image', title: 'Image', description: 'Upload or embed an image', icon: <ImageIcon className="w-5 h-5" />, group: 'Links & Media' },
  { type: 'BooxPageEmbed', title: 'BOOX Page', description: 'Embed a page from a synced BOOX notebook', icon: <DocumentIcon className="w-5 h-5" />, group: 'Links & Media' },
  // Temporarily disabled until fully implemented and styled:
  // Video, File, Embed
  { type: 'Pdf', title: 'PDF (Alpha)', description: 'Embed a PDF document', icon: <DocumentIcon className="w-5 h-5" />, group: 'Links & Media' },
  { type: 'Transcription', title: 'Voice Transcription (Alpha)', description: 'Record and transcribe speech with AI', icon: <MicIcon className="w-5 h-5" />, group: 'Links & Media' },
];

export const GROUP_ORDER = ['Basic blocks', 'Content', 'Links & Media'] as const;

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Group block options by category
 */
export function groupBlockOptions(options: BlockOption[]): Map<string, BlockOption[]> {
  const groups = new Map<string, BlockOption[]>();
  
  for (const group of GROUP_ORDER) {
    groups.set(group, []);
  }
  
  for (const option of options) {
    const groupItems = groups.get(option.group);
    if (groupItems) {
      groupItems.push(option);
    }
  }
  
  return groups;
}

/**
 * Get icon for a block type from our options
 */
export function getBlockIcon(type: string): React.ReactNode | undefined {
  return BLOCK_OPTIONS.find(o => o.type === type)?.icon;
}

/**
 * Get shortcut for a block type
 */
export function getBlockShortcut(type: string): string | undefined {
  return BLOCK_OPTIONS.find(o => o.type === type)?.shortcut;
}
