/**
 * @file page.ts
 * @description Unified Page type definitions and related interfaces
 * @app UNIFIED PAGES - Core page data structures
 * 
 * Defines all types for the unified pages system where everything is a "Page":
 * 
 * Core types:
 * - Page: Main page interface with content, hierarchy, and display options
 * - PageViewMode: 'note' (note layout), 'collection' (collection layout), or 'tasks' (task board)
 *   Note: 'note' and 'collection' are layout variants of the same "Page" concept;
 *   'tasks' is a distinct "Task Board" concept
 * - ChildrenViewMode: How children are displayed (list, gallery, board, inline)
 * - Section: Kanban sections for task collections
 * 
 * Tree types:
 * - PageTreeNode: Hierarchical tree structure for sidebar
 * - PageBreadcrumb: Ancestor chain for navigation
 * 
 * Input types:
 * - CreatePageInput: Fields for creating new pages
 * - UpdatePageInput: Fields for updating existing pages
 * 
 * UNIFIED PAGES MODEL (Two Worlds):
 * - Pages with viewMode='note' are pages in "Note" layout (full editor primary)
 * - Pages with viewMode='collection' are pages in "Collection" layout (children as main focus)
 * - Pages with viewMode='tasks' are Task Boards (distinct concept for task management)
 */

/**
 * How children are displayed when viewing this page
 */
export type ChildrenViewMode = 'list' | 'gallery' | 'board' | 'inline' | 'table';

/**
 * How the page itself is displayed:
 * 
 * Two Worlds model:
 * - Pages: 'note' and 'collection' are layout variants of the same "Page" concept
 *   - 'note': Note layout — full editor is primary, children shown as compact list at bottom
 *   - 'collection': Collection layout — small content preview, children grid/list is primary focus
 * - Task Boards: 'tasks' is a distinct concept for task management
 *   - 'tasks': Task list/kanban view with optional description at top
 */
export type PageViewMode = 'note' | 'collection' | 'tasks';

/**
 * Filter options for All Pages view
 */
export type PageFilterType = 'all' | 'pages' | 'collections' | 'tasks' | 'daily';

/**
 * Sort options for page lists
 */
export type PageSortBy = 'updated' | 'created' | 'manual';
export type PageSortDirection = 'asc' | 'desc';

/**
 * Kanban section for task collection pages
 */
export interface Section {
  id: string;
  name: string;
  order: number;
  color?: string;
}

export interface PagePreviewLeaf {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  highlight?: boolean | string;
  href?: string;
}

export interface PagePreviewBlock {
  id: string;
  type:
    | 'paragraph'
    | 'heading-one'
    | 'heading-two'
    | 'heading-three'
    | 'blockquote'
    | 'callout'
    | 'code'
    | 'divider'
    | 'bulleted-list'
    | 'numbered-list'
    | 'todo-list';
  depth: number;
  checked?: boolean;
  children: PagePreviewLeaf[];
}

/**
 * Represents a page in the unified system.
 * Everything is a "Page" - workspaces, collections, wiki pages, daily notes, and task collections.
 */
export interface Page {
  // ============================================================================
  // IDENTITY
  // ============================================================================
  /** Unique identifier (e.g., "page_abc123") */
  id: string;
  /** Workspace ID this page belongs to (required for backend) */
  workspace?: string;

  // ============================================================================
  // CONTENT
  // ============================================================================
  /** Page title (e.g., "Recipes", "Meeting Notes", "Work") */
  title: string;
  /** Yoopta JSON string for page/collection content, null = empty */
  content: string | null;
  /** Plain text excerpt for list/card views (auto-generated from content) */
  excerpt: string | null;
  /** Compact rich preview blocks for metadata/card views (server-generated) */
  previewStructured?: PagePreviewBlock[] | null;
  /** Whether the page content is source-owned and not directly editable in Planneer. */
  isReadOnly?: boolean;
  /** External source identifier for mirrored/system pages. */
  sourceOrigin?: string | null;
  /** Source item type, such as root or notebook. */
  sourceItemType?: string | null;
  /** Stable external ID used during reconciliation. */
  sourceExternalId?: string | null;
  /** Original remote path for mirrored content. */
  sourcePath?: string | null;
  /** Last successful sync timestamp for mirrored content. */
  sourceLastSyncedAt?: string | null;
  /** Original creation timestamp from the mirrored source. */
  sourceCreatedAt?: string | null;
  /** Original modification timestamp from the mirrored source. */
  sourceModifiedAt?: string | null;
  /** Remote file size in bytes. */
  sourceContentLength?: string | null;
  /** Remote entity tag used for sync change detection. */
  sourceETag?: string | null;
  /** Number of pages in the mirrored PDF, extracted during sync. */
  sourcePageCount?: number | null;
  /** Backend-generated thumbnail filename (last page of PDF). */
  previewThumbnail?: string | null;

  // ============================================================================
  // TIMESTAMPS (PocketBase auto-generated field names)
  // ============================================================================
  /** ISO 8601 datetime (PocketBase auto-managed) */
  created: string;
  /** ISO 8601 datetime (PocketBase auto-managed) */
  updated: string;

  // ============================================================================
  // HIERARCHY
  // ============================================================================
  /** Parent page ID, null = root level */
  parentId: string | null;
  /** Position among siblings (0-based) */
  order: number;

  // ============================================================================
  // DISPLAY
  // ============================================================================
  /** Emoji or icon key (e.g., "🍳", "📚", "Briefcase") */
  icon: string | null;
  /** Hex color for theming the icon (e.g., "#3b82f6") */
  color: string | null;
  /** URL to cover image (future enhancement) */
  coverImage: string | null;
  /** CSS gradient string for cover (e.g., "linear-gradient(...)") */
  coverGradient: string | null;
  /** Attribution for cover image (e.g., "Photo by John Doe on Unsplash") */
  coverAttribution: string | null;
  /** Array of uploaded image filenames (for inline images in content) */
  images: string[];
  /** Array of uploaded file filenames (for PDFs and documents in content) */
  files?: string[];


  // ============================================================================
  // PAGE MODE
  // ============================================================================
  /**
   * How this page is displayed:
   * - 'note': Full editor primary, compact children at bottom
   * - 'collection': Small preview, children grid/list as main focus
   * - 'tasks': Task list/kanban with description header
   */
  viewMode: PageViewMode;

  // ============================================================================
  // CHILDREN DISPLAY MODE
  // ============================================================================
  /** How to display child pages when in collection mode or children section */
  childrenViewMode: ChildrenViewMode;

  // ============================================================================
  // COLLECTION VIEW PREFERENCES (saved per-collection)
  // ============================================================================
  /** Sort field for collection children */
  collectionSortBy?: 'updated' | 'created' | 'title';
  /** Sort direction for collection children */
  collectionSortDirection?: 'asc' | 'desc';
  /** Group by option for collection children */
  collectionGroupBy?: 'none' | 'date';
  /** Whether to show excerpts in collection/task views */
  showExcerpts?: boolean;
  /** Whether the page hero is in compact/minimal mode */
  heroCompact?: boolean;

  // ============================================================================
  // TASK COLLECTION FIELDS (viewMode === 'tasks')
  // ============================================================================
  /** Kanban sections for task organization */
  sections?: Section[];
  /** View mode for tasks: list, kanban, or table */
  tasksViewMode?: 'list' | 'kanban' | 'table';
  /** Group by option for task list */
  tasksGroupBy?: 'date' | 'priority' | 'section' | 'tag' | 'none' | 'parentPage';
  /** Whether to show completed tasks */
  showCompletedTasks?: boolean;
  /** Active filter options for task collection (JSON-encoded TaskFilterOptions) */
  tasksFilterOptions?: string;
  /** Active filter options for page collection (JSON-encoded PageFilterOptions) */
  collectionFilterOptions?: string;

  // ============================================================================
  // SAVED VIEWS (for task pages and collections)
  // ============================================================================
  /** Saved view presets for quick switching */
  savedViews?: import('./savedView').PageSavedView[];
  /** Currently active saved view ID (null = default view) */
  activeSavedViewId?: string | null;

  // ============================================================================
  // TAGS
  // ============================================================================
  /** Tags for this page (comma-separated, same format as task.tag) */
  tags?: string;

  // ============================================================================
  // SPECIAL TYPES
  // ============================================================================
  /** True if this is a daily journal entry */
  isDailyNote: boolean;
  /** YYYY-MM-DD format, only for daily notes */
  dailyNoteDate: string | null;

  // ============================================================================
  // SIDEBAR STATE
  // ============================================================================
  /** Whether children are shown in sidebar */
  isExpanded: boolean;
  /** Whether to show children in the sidebar tree (overrides default viewMode behavior) */
  showChildrenInSidebar?: boolean;
  /** Whether the page is pinned to the top of the sidebar */
  isPinned: boolean;
  /** Position among pinned items (0-based, only used when isPinned=true) */
  pinnedOrder: number;

  // ============================================================================
  // COMPUTED (from backend)
  // ============================================================================
  /** Number of direct children (maintained by backend hooks) */
  childCount: number;
}

/**
 * Breadcrumb item for navigation
 */
export interface PageBreadcrumb {
  id: string;
  title: string;
  icon: string | null;
  viewMode?: PageViewMode;
}

/**
 * Tree node representation for sidebar
 */
export interface PageTreeNode {
  page: Page;
  children: PageTreeNode[];
  depth: number;
}

/**
 * Filter options for page queries
 */
export interface PageFilter {
  parentId?: string | null;
  isDailyNote?: boolean;
  viewMode?: PageViewMode;
  searchQuery?: string;
}

/**
 * Input for creating a new page
 */
export interface CreatePageInput {
  title: string;
  content?: string | null;
  parentId?: string | null;
  order?: number;
  icon?: string | null;
  color?: string | null;
  viewMode?: PageViewMode;
  childrenViewMode?: ChildrenViewMode;
  isDailyNote?: boolean;
  dailyNoteDate?: string | null;
  showChildrenInSidebar?: boolean;
  // Task collection specific
  sections?: Section[];
  tasksViewMode?: 'list' | 'kanban' | 'table';
  tasksGroupBy?: 'date' | 'priority' | 'section' | 'none' | 'parentPage' | 'tag';
  // Tags
  tags?: string;
}

/**
 * Input for updating a page
 */
export interface UpdatePageInput {
  title?: string;
  content?: string | null;
  parentId?: string | null;
  order?: number;
  icon?: string | null;
  color?: string | null;
  coverImage?: string | null;
  coverGradient?: string | null;
  coverAttribution?: string | null;
  showChildrenInSidebar?: boolean;
  viewMode?: PageViewMode;
  childrenViewMode?: ChildrenViewMode;
  isExpanded?: boolean;
  isPinned?: boolean;
  pinnedOrder?: number;
  // Collection view preferences
  collectionSortBy?: 'updated' | 'created' | 'title';
  collectionSortDirection?: 'asc' | 'desc';
  collectionGroupBy?: 'none' | 'date';
  // Task collection specific
  sections?: Section[];
  tasksViewMode?: 'list' | 'kanban' | 'table';
  tasksGroupBy?: 'date' | 'priority' | 'section' | 'none' | 'parentPage' | 'tag';
  showCompletedTasks?: boolean;
  showExcerpts?: boolean;
  // Hero compact mode preference
  heroCompact?: boolean;
  // Saved views
  savedViews?: import('./savedView').PageSavedView[];
  activeSavedViewId?: string | null;
  // Tags for page
  tags?: string;
  // Filter options for task/collection pages (JSON-encoded)
  tasksFilterOptions?: string;
  collectionFilterOptions?: string;
}

/**
 * Default values for new pages
 */
export const DEFAULT_PAGE_VALUES: Partial<Page> = {
  content: null,
  excerpt: null,
  previewStructured: null,
  isReadOnly: false,
  sourceOrigin: null,
  sourceItemType: null,
  sourceExternalId: null,
  sourcePath: null,
  sourceLastSyncedAt: null,
  sourceCreatedAt: null,
  sourceModifiedAt: null,
  sourceContentLength: null,
  sourceETag: null,
  sourcePageCount: null,
  previewThumbnail: null,
  parentId: null,
  order: 0,
  icon: null,
  color: null,
  coverImage: null,
  coverGradient: null,
  coverAttribution: null,
  images: [],
  viewMode: 'note',
  childrenViewMode: 'list',
  isDailyNote: false,
  dailyNoteDate: null,
  isExpanded: false,
  isPinned: false,
  pinnedOrder: 0,
  childCount: 0,
};

/**
 * Default values for new task collection pages
 */
export const DEFAULT_TASK_COLLECTION_VALUES: Partial<Page> = {
  ...DEFAULT_PAGE_VALUES,
  viewMode: 'tasks',
  sections: [],
  tasksViewMode: 'list',
  tasksGroupBy: 'date',
  showCompletedTasks: false,
};

// ============================================================================
// BACKWARD COMPATIBILITY (temporary, will be removed)
// ============================================================================
// These type aliases help with gradual migration from notes to pages

/** @deprecated Use Page instead */
export type Note = Page;
/** @deprecated Use PageViewMode instead */
export type NoteViewMode = PageViewMode;
/** @deprecated Use PageTreeNode instead */
export type NoteTreeNode = PageTreeNode;
/** @deprecated Use PageBreadcrumb instead */
export type NoteBreadcrumb = PageBreadcrumb;
/** @deprecated Use PageFilter instead */
export type NoteFilter = PageFilter;
/** @deprecated Use CreatePageInput instead */
export type CreateNoteInput = CreatePageInput;
/** @deprecated Use UpdatePageInput instead */
export type UpdateNoteInput = UpdatePageInput;
/** @deprecated Use PageFilterType instead */
export type NoteFilterType = PageFilterType;
/** @deprecated Use PageSortBy instead */
export type NoteSortBy = PageSortBy;
/** @deprecated Use PageSortDirection instead */
export type NoteSortDirection = PageSortDirection;
/** @deprecated Use DEFAULT_PAGE_VALUES instead */
export const DEFAULT_NOTE_VALUES = DEFAULT_PAGE_VALUES;
