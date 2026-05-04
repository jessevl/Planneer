/**
 * @file PageEditor.tsx
 * @description Rich text editor component using Yoopta editor and Zustand store
 * @app PAGES - Core page editing component
 * 
 * SIMPLIFIED ARCHITECTURE:
 * - Store owns all draft state (draftTitle, draftContent as JSON string)
 * - Editor maintains parsed YooptaContentValue for Yoopta library
 * - Single source of truth: store's draftContent
 * - Editor syncs TO store on changes, syncs FROM store on page switch
 * 
 * Features:
 * - Block-based editing (paragraphs, headings, lists, code, etc.)
 * - Slash commands for quick block insertion
 * - Floating toolbar for text formatting
 * - Auto-save with dirty state tracking
 */
'use client';

import React, { useEffect, useMemo, useState, useCallback, useRef, useReducer, DragEvent } from 'react';
import { createPortal } from 'react-dom';
import type { PageViewMode } from '../../types/page';
import { useShallow } from 'zustand/react/shallow';
import YooptaEditor, { YooptaContentValue, YooptaOnChangeOptions, Elements, Blocks, generateId, buildBlockData, type YooEditor, type RenderBlockProps } from '@yoopta/editor';
import { createPlanneerEditor, type PlanneerEditor } from '@/lib/createPlanneerEditor';
import { Transforms, Editor as SlateEditor, Range } from 'slate';
import { BlockDndContext, SortableBlock } from '@yoopta/ui/block-dnd';
import { useEditorRowLayout, ROW_LAYOUT_KEY, injectRowLayout, getGroupColumns } from '@/hooks/useEditorRowLayout';
import SideDropIndicator from './SideDropIndicator';
import ColumnResizeHandle from './ColumnResizeHandle';
import type { DropPending } from './SideDropIndicator';
import VerticalDropIndicator from './VerticalDropIndicator';
import { SelectionBox } from '@yoopta/ui/selection-box';
import Paragraph from '@yoopta/paragraph';
import Blockquote from '@yoopta/blockquote';
import Callout from '@yoopta/callout';
import Divider from '@yoopta/divider';
import { HeadingOne, HeadingTwo, HeadingThree } from '@yoopta/headings';
import { BulletedList, NumberedList, TodoList } from '@yoopta/lists';
import { Bold, Italic, Underline, Strike, Highlight, CodeMark } from '@yoopta/marks';
import Tabs from '@yoopta/tabs';
// Core active plugins (lists/tabs/todo/callout/code) use local element maps.
// See src/plugins/yoopta/renderers/LocalPluginUI.tsx.
import { CustomTodoListElements, LocalCalloutUI, LocalListsUI, LocalTabsUI } from '@/plugins/yoopta/renderers';
import { EditorSlashMenu, EditorFloatingToolbar, EditorFloatingBlockActions } from '@/plugins/yoopta/editor-ui';
import MobileEditorToolbar from './MobileEditorToolbar';
import MobileActionMenu from './MobileActionMenu';
import { 
  InternalLink, 
  AdvancedTablePlugin,
  TableOfContentsPlugin,
  CustomImagePlugin,
  ImageCommands,
  BookmarkPlugin,
  PdfPlugin,
  ScribblePlugin,
  TranscriptionPlugin,
  ExcalidrawPlugin,
} from '@/plugins/yoopta';
import CommandPalette, { type SearchSelection } from '@/components/common/CommandPalette';
import { StatusBanner, TagPickerMenu } from '@/components/ui';
import { cn } from '@/lib/design-system';
import { getRightInsetStyle } from '@/lib/layout';
import PageHero from './PageHero';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { useDeleteConfirmStore } from '@/stores/deleteConfirmStore';
import { useUIStore } from '@/stores/uiStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { useIsMobile, useIsTabletDevice } from '@frameer/hooks/useMobileDetection';
import { withErrorBoundary } from '@/components/common/ErrorBoundary';
import { PageContentError } from '@/lib/errors';
import { syncEngine } from '@/lib/syncEngine/index';
import { processImageForUpload } from '@/lib/imageUtils';
import { uploadPageImage, removePageImage } from '@/api/pagesApi';
import { PageEditorProvider } from '@/contexts';
import { isGranularKey } from '@/lib/crdt';
import { focusBlockAtOrder } from '@/plugins/yoopta/utils/focusBlockAtOrder';
import { insertBlockAtCurrentPath, insertBlockWithFocus } from '@/plugins/yoopta/utils/insertBlockWithFocus';
import {
  applyBlockMarkdownShortcut,
  applyInlineMarkdownShortcut,
  getCurrentSlateContext as getYooptaCurrentSlateContext,
} from '@/plugins/yoopta/utils/markdownShortcutCommands';
import { limitSizes } from '@/plugins/yoopta/image/limitSizes';
import type { ImagePluginOptions } from '@/plugins/yoopta/image/types';

interface PageEditorProps {
  pageId: string | null;
  created?: string;
  updated?: string;
  onCancel: () => void;
  onDeletePage?: (id: string, cascade?: boolean) => void;
  triggerDelete?: boolean;
  onDeleteComplete?: () => void;
  hideActions?: boolean;
  hideBorder?: boolean;
  icon?: string | null;
  color?: string | null;
  coverImage?: string | null;
  coverGradient?: string | null;
  coverAttribution?: string | null;
  onIconClick?: () => void;
  viewMode?: PageViewMode;
  /** If true, focus editor content instead of title on create (for daily pages with pre-filled titles) */
  isDailyNote?: boolean;
  /** If true, hide the hero section (cover, title, metadata) */
  hideHero?: boolean;
  /** If true, do not automatically focus the editor or title */
  disableAutoFocus?: boolean;
  /** If true, the editor is in read-only mode */
  readOnly?: boolean;
  /** Page tags (comma-separated) for hero display */
  tags?: string | null;
  /** Hero compact mode */
  compact?: boolean;
  /** Callback to toggle hero compact mode */
  onToggleCompact?: (compact: boolean) => void;
  /** Callback when tags are changed */
  onTagsChange?: (tags: string) => void;
  /** Tag suggestions for autocomplete */
  tagSuggestions?: string[];
  /** Optional right inset for hero/content wrappers to stay clear of a floating sidebar. */
  contentRightInsetPx?: number;
}

// Base plugins that don't need dynamic configuration
// Use our custom TodoList render instead of shadcn's ListsUI.TodoList.
// The shadcn render's onMouseDown+Elements.updateElement approach is sluggish
// on rapid clicks; our custom render uses onClick and local token styling
// and CSS-only styling via design-system tokens.
const ThemedTodoList = TodoList.extend({ elements: CustomTodoListElements });

// Extend BulletedList with themed render for explicit list-disc class.
// Stock BulletedList renders bare <ul><li> with no classes; it relies
// entirely on CSS rules for bullet markers, which Safari can miss when a
// block type conversion coincides with a React re-render.
const ThemedBulletedList = BulletedList.extend({ elements: LocalListsUI.BulletedList });

// Extend stock Callout with local element renders.
// Keeps built-in block options UI (callout theme)
// while avoiding external theme utility class coupling.
const ThemedCallout = Callout.extend({ elements: LocalCalloutUI });

// Extend NumberedList with themed render that uses useNumberListCount hook
// for proper sequential numbering across blocks (stock renders each block as
// a separate <ol> starting at 1).
const ThemedNumberedList = NumberedList.extend({ elements: LocalListsUI.NumberedList });

// Extend headless plugins with themed renders. Stock plugins render plain <div>
// wrappers without styling — the themed versions provide proper visual UI.
const ThemedTabs = Tabs.extend({ elements: LocalTabsUI as any });

const basePlugins = [
  Paragraph, HeadingOne, HeadingTwo, HeadingThree,
  Blockquote, ThemedCallout, Divider,
  ThemedBulletedList, ThemedNumberedList, ThemedTodoList,
  AdvancedTablePlugin,
  TableOfContentsPlugin,
  BookmarkPlugin,
  PdfPlugin,
  ScribblePlugin,
  TranscriptionPlugin,
  ExcalidrawPlugin,
  ThemedTabs,
];

const MARKS = [Bold, Italic, CodeMark, Underline, Strike, Highlight];

type InlineTagPickerState = {
  blockId: string;
  path: number[];
  startOffset: number;
  endOffset: number;
  query: string;
  top: number;
  left: number;
  highlightedIndex: number;
};

function normalizeTagValue(tag: string): string {
  return tag.trim().replace(/^#+/, '').replace(/\s+/g, ' ');
}

function tagKey(tag: string): string {
  return normalizeTagValue(tag).toLowerCase();
}

/**
 * Wrapper around BlockDndContext that forces re-renders when the editor
 * emits 'change'.  Without this, BlockDndContext only re-renders when
 * PageEditor re-renders — but PageEditor uses useShallow on isDirty which
 * stays true after the first edit, so it stops re-rendering.  Because
 * BlockDndContext never re-renders, its internal
 *   useMemo(() => Object.keys(editor.children).sort(...), [editor.children])
 * returns a stale block list.  Chrome accidentally re-evaluates the memo;
 * Safari correctly caches it, so new blocks never enter SortableContext and
 * never appear in the DOM.
 *
 * By subscribing to editor.on('change') here we force BlockDndContext to
 * re-render.  Yoopta's applyTransforms uses Immer, so editor.children is a
 * new reference after each operation — useMemo detects the change and
 * recomputes the sorted items list.
 */
const ForceUpdateBlockDndContext = React.memo(({ editor, children }: { editor: YooEditor; children: React.ReactNode }) => {
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const handler = () => forceRender();
    editor.on('change', handler);
    return () => { editor.off('change', handler); };
  }, [editor]);
  return <BlockDndContext editor={editor}>{children}</BlockDndContext>;
});
ForceUpdateBlockDndContext.displayName = 'ForceUpdateBlockDndContext';

const appendImageCacheBust = (src: string) => {
  if (!src || src.startsWith('blob:')) return src;
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}v=${Date.now()}`;
};

/**
 * Apply remote content into the editor using granular block-level updates.
 *
 * Why not just `editor.setEditorValue()`?
 * It creates NEW Slate editors for every block and replaces `blockEditorsMap`.
 * But each block-renderer caches its Slate editor via `useMemo`, so old
 * blocks keep the stale editor and never re-render.
 *
 * Architecture mirrors @yoopta/collaboration:
 *  - New/deleted blocks → `editor.insertBlock` / `editor.deleteBlock`
 *  - Content changes → Slate `Transforms` on the EXISTING Slate editor
 *    (same pattern as collaboration's `fallbackFullFragmentReplace`).
 *  - Meta + value sync → batched via `editor.applyTransforms` with
 *    `validatePaths: true` so block orders are normalized atomically.
 *    Individual `updateBlock` calls use `validatePaths: false` internally,
 *    which skips order normalization and creates intermediate states with
 *    duplicate orders during reorder. Batching avoids this.
 */
function applyRemoteContentToEditor(
  editor: YooEditor,
  newParsed: YooptaContentValue,
): void {
  const currentValue = editor.getEditorValue();
  const currentIds = new Set(Object.keys(currentValue));
  const newIds = new Set(Object.keys(newParsed));

  // Wrap in withoutSavingHistory so remote changes don't pollute undo/redo
  editor.withoutSavingHistory(() => {

    // 1. Delete removed blocks
    for (const blockId of currentIds) {
      if (!newIds.has(blockId)) {
        try { editor.deleteBlock({ blockId }); }
        catch (err) { console.warn('[PageEditor] Remote delete failed', blockId, err); }
      }
    }

    // 2. Insert new blocks (sorted by order so positions are correct)
    const newEntries = [...newIds]
      .filter(id => !currentIds.has(id))
      .map(id => ({ id, block: newParsed[id] as any }))
      .sort((a, b) => a.block.meta.order - b.block.meta.order);

    for (const { id, block } of newEntries) {
      try {
        editor.insertBlock(block.type, {
          at: block.meta.order,
          focus: false,
          blockData: { id, value: block.value, meta: block.meta } as any,
        });
      } catch (err) { console.warn('[PageEditor] Remote insert failed', id, err); }
    }

    // 3. Update existing blocks — collect ops for a single atomic batch.
    //    This mirrors @yoopta/collaboration which batches structural changes
    //    via applyTransforms rather than individual updateBlock calls.
     
    const ops: Array<Record<string, any>> = [];

    for (const blockId of newIds) {
      if (!currentIds.has(blockId)) continue;
      const oldBlock = currentValue[blockId] as any;
      const newBlock = newParsed[blockId] as any;
      if (!oldBlock || !newBlock) continue;

      // 3a. Meta changes (order/depth/align)
      if (JSON.stringify(oldBlock.meta) !== JSON.stringify(newBlock.meta)) {
        ops.push({
          type: 'set_block_meta',
          id: blockId,
          properties: newBlock.meta,
          prevProperties: oldBlock.meta,
        });
      }

      // 3b. Content changes via Slate Transforms on the existing editor
      if (JSON.stringify(oldBlock.value) !== JSON.stringify(newBlock.value)) {
        const slateEditor = editor.blockEditorsMap[blockId];
        if (!slateEditor) continue;
        try {
          // Update the Slate editor directly (triggers Slate React re-render).
          // Same approach as @yoopta/collaboration's fallbackFullFragmentReplace.
          SlateEditor.withoutNormalizing(slateEditor, () => {
            for (let i = slateEditor.children.length - 1; i >= 0; i--) {
              Transforms.removeNodes(slateEditor, { at: [i] });
            }
            const nodes = newBlock.value as SlateEditor['children'];
            for (let i = 0; i < nodes.length; i++) {
              Transforms.insertNodes(slateEditor, nodes[i], { at: [i] });
            }
          });
          // Sync Yoopta's Immer state to match Slate immediately.
          // Without this, editor.getEditorValue() returns stale content
          // until the async Slate onValueChange → postTask fires.
          ops.push({
            type: 'set_block_value',
            id: blockId,
            value: newBlock.value,
          });
        } catch (err) { console.warn('[PageEditor] Remote content update failed', blockId, err); }
      }
    }

    // Apply all meta + value changes atomically in one batch.
    // validatePaths: true appends a validate_block_paths op that
    // normalizes orders to sequential 0, 1, 2, ... after all changes.
    if (ops.length > 0) {
      try {
        editor.applyTransforms(ops as any, { validatePaths: true });
      } catch (err) { console.warn('[PageEditor] Remote batch applyTransforms failed', err); }
    }
  });
}

/** Default empty Yoopta content structure */
const DEFAULT_YOOPTA_CONTENT: YooptaContentValue = {
  'block-1': {
    id: 'block-1',
    type: 'Paragraph',
    meta: { order: 0, depth: 0 },
    value: [
      {
        id: 'element-1',
        type: 'paragraph',
        children: [{ text: '' }],
        props: { nodeType: 'block' },
      },
    ],
  },
};

/** 
 * Parse JSON content and validate it's proper Yoopta format.
 * Throws PageContentError if content is malformed.
 */
function parseContent(content: unknown): YooptaContentValue {
  // Empty content is valid - use default
  if (!content) {
    return DEFAULT_YOOPTA_CONTENT;
  }
  
  // Accept either serialized JSON (string) or already-parsed object payloads.
  // Yoopta/sync paths may provide either representation depending on source.
  let parsed: unknown = content;
  if (typeof content === 'string') {
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new PageContentError('Page content is not valid JSON. The data may be corrupted or from an incompatible version.');
    }
  }
  
  // Validate it's an object
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new PageContentError('Page content format is invalid. Expected editor block structure.');
  }
  
  const entries = Object.entries(parsed);
  
  // Empty object is valid - use default
  if (entries.length === 0) {
    return DEFAULT_YOOPTA_CONTENT;
  }
  
  // Validate each block has required structure
  const validBlocks: Record<string, unknown> = {};
  
  for (const [key, block] of entries) {
    // Skip granular table keys (Option C)
    if (isGranularKey(key)) continue;
    // Skip row layout metadata (column layout state)
    if (key === ROW_LAYOUT_KEY) continue;
    
    if (!block || typeof block !== 'object') {
      throw new PageContentError(`Page content block "${key}" is invalid.`);
    }
    
    const b = block as Record<string, unknown>;
    
    if (!b.type || typeof b.type !== 'string') {
      // Skip blocks with missing/invalid type instead of crashing — they may be
      // leftover phantom entries (e.g. key "undefined") from a prior corrupt save.
      console.warn(`[PageEditor] Skipping invalid content block at key "${key}": missing type`);
      continue;
    }
    
    if (!Array.isArray(b.value) || b.value.length === 0) {
      throw new PageContentError(`Page content block "${key}" is missing content data.`);
    }
    
    // Check first element has children
    const firstElement = b.value[0] as Record<string, unknown> | undefined;
    if (!firstElement || !Array.isArray(firstElement.children)) {
      throw new PageContentError(`Page content block "${key}" has invalid structure.`);
    }
    
    validBlocks[key] = block;
  }
  
  return validBlocks as YooptaContentValue;
}

const PageEditor: React.FC<PageEditorProps> = ({
  pageId,
  created,
  updated,
  onCancel,
  onDeletePage,
  triggerDelete = false,
  onDeleteComplete,
  hideActions = false,
  hideBorder = false,
  icon = null,
  color = null,
  coverImage = null,
  coverGradient = null,
  coverAttribution = null,
  onIconClick,
  viewMode,
  isDailyNote = false,
  hideHero = false,
  disableAutoFocus = false,
  readOnly = false,
  tags = null,
  compact,
  onToggleCompact,
  onTagsChange,
  tagSuggestions,
  contentRightInsetPx = 0,
}) => {
  // === STORE STATE (single source of truth) ===
  // Combined selectors to reduce subscriptions.
  // NOTE: draftContent is deliberately NOT subscribed here. Subscribing to it
  // causes PageEditor to re-render on every keystroke, which in Safari disrupts
  // the focus/selection timing of Yoopta's focusBlock (requestAnimationFrame +
  // window.getSelection).  Instead we read draftContent via getState() only
  // where we actually need the value (initialValue, contentVersion effect, docSize).
  const {
    draftTitle,
    activePageId,
    isContentLoading,
    contentUnavailableOffline,
    contentMayBeIncomplete,
    isDirty,
    contentVersion,
    isNewlyCreated,
  } = usePagesStore(useShallow((s: PagesState) => ({
    draftTitle: s.draftTitle,
    activePageId: s.activePageId,
    isContentLoading: s.isContentLoading,
    contentUnavailableOffline: s.contentUnavailableOffline,
    contentMayBeIncomplete: s.contentMayBeIncomplete,
    isDirty: s.isDirty,
    contentVersion: s.contentVersion,
    isNewlyCreated: s.isNewlyCreated,
  })));
  
  // Actions don't need shallow comparison (stable references)
  const setDraftTitle = usePagesStore((s: PagesState) => s.setDraftTitle);
  const setDraftContent = usePagesStore((s: PagesState) => s.setDraftContent);
  const saveCurrentPage = usePagesStore((s: PagesState) => s.saveCurrentPage);
  const clearNewlyCreated = usePagesStore((s: PagesState) => s.clearNewlyCreated);
  const updatePage = usePagesStore((s: PagesState) => s.updatePage);
  const pagesById = usePagesStore((s: PagesState) => s.pagesById);
  
  const requestDelete = useDeleteConfirmStore((s) => s.requestDelete);
  
  // Mobile detection
  const isMobile = useIsMobile();
  const isTabletDevice = useIsTabletDevice();
  const usesPortableEditorToolbar = isMobile || isTabletDevice;
  
  // Global editor focus state (for FAB text formatting button)
  const setPageEditorFocused = useUIStore((s) => s.setPageEditorFocused);
  const setActiveTextMarks = useUIStore((s) => s.setActiveTextMarks);

  // === LOCAL STATE (minimal - only what Yoopta needs) ===
  // In v6, plugins and marks are passed to createYooptaEditor at creation time.
  const initialValue = useMemo((): YooptaContentValue => {
    if (activePageId === pageId) {
      if (isContentLoading) return DEFAULT_YOOPTA_CONTENT;
      // Read draftContent via getState() — not subscribed to avoid re-renders
      const currentDraftContent = usePagesStore.getState().draftContent;
      return parseContent(currentDraftContent);
    }
    const page = pagesById[pageId || ''];
    if (!page || !page.content) return DEFAULT_YOOPTA_CONTENT;
    return parseContent(page.content);
   
  }, []);

  // These refs must be declared before the editor useState so the
  // createPlanneerEditor factory can capture them in its closures.
  const isApplyingRemoteRef = useRef(false);
  const dropPendingRef = useRef<DropPending | null>(null);

  const [editor] = useState(() => {
    // Build plugins with image upload handler inline
    const imageUploadHandler = async (file: File) => {
      if (!pageId) {
        throw new Error('Cannot upload image: page not saved yet');
      }
      try {
        const processed = await processImageForUpload(file);
        if (navigator.onLine) {
          const result = await uploadPageImage(pageId, processed.file, processed.width, processed.height);
          return { src: appendImageCacheBust(result.src), alt: result.alt, sizes: result.sizes };
        } else {
          const queued = await syncEngine.queueImageUpload(processed.file, pageId);
          return {
            src: queued.blobUrl,
            alt: processed.filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
            sizes: { width: queued.width, height: queued.height },
          };
        }
      } catch (error) {
        console.error('[PageEditor] Image upload failed:', error);
        throw error;
      }
    };

    const ImagePlugin = CustomImagePlugin.extend({
      lifecycle: {
        onDestroy: (editor: any, blockId: string) => {
          try {
            const imageElement = Elements.getElement(editor, { blockId, type: 'image' });
            const src = imageElement?.props?.src;
            if (src && pageId) {
              const urlParts = src.split('/');
              const filename = urlParts[urlParts.length - 1];
              if (filename && !filename.startsWith('http')) {
                const cleanFilename = filename.split('?')[0];
                removePageImage(pageId, cleanFilename).catch((err) => {
                  console.error('[PageEditor] Failed to remove image:', err);
                });
              }
            }
          } catch (err) {
            console.error('[PageEditor] Error in image onDestroy:', err);
          }
        },
      },
      options: {
        onUpload: imageUploadHandler,
        accept: 'image/jpeg,image/png,image/gif,image/webp',
        maxSizes: { maxWidth: 896, maxHeight: 1600 },
      },
    });

    const allPlugins = [
      ...basePlugins,
      ImagePlugin,
      InternalLink,
    ];

    return createPlanneerEditor(
      {
        plugins: allPlugins as any,
        marks: MARKS,
        value: initialValue,
        readOnly,
      },
      { dropPendingRef, isApplyingRemoteRef },
    );
  });

  // Sync readOnly prop changes into the editor instance.
  // In Yoopta v6, readOnly is set at creation time via createYooptaEditor().
  // When the prop changes (e.g., page becomes the active page), we must
  // update the editor's readOnly property directly.
  useEffect(() => {
    if (editor.readOnly !== readOnly) {
      editor.readOnly = readOnly;
    }
  }, [editor, readOnly]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploadingDrop, setIsUploadingDrop] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [isLinkPickerOpen, setIsLinkPickerOpen] = useState(false);
  const [isMobileActionMenuOpen, setIsMobileActionMenuOpen] = useState(false);
  const [inlineTagPicker, setInlineTagPicker] = useState<InlineTagPickerState | null>(null);
  // Track placeholder block to replace when inserting custom void blocks.
  const blockToDeleteRef = useRef<string | undefined>(undefined);
  const dragCounter = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  // Track if action menu is open to close on scroll
  const actionMenuOpenRef = useRef(false);
  // Track if YooptaEditor component is mounted (to prevent focus on unmounted editor)
  const editorMountedRef = useRef(false);
  // Guard: suppress handleChange during programmatic setEditorValue calls
  // (remote SSE sync, initial load).  Without this, setEditorValue fires
  // Yoopta's onChange → handleChange → setDraftContent → isDirty=true, which
  // blocks subsequent remote updates and triggers unnecessary save round-trips.
  // (declared above useState — see isApplyingRemoteRef)
  // Coalesce rapid Yoopta onChange events to avoid serializing full document
  // JSON on every keystroke/toggle (this is expensive on large pages).
  const pendingDraftValueRef = useRef<YooptaContentValue | null>(null);
  const pendingDraftIdleRef = useRef<number | null>(null);
  const pendingDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineTagRefreshRafRef = useRef<number | null>(null);

  const currentPageTags = useMemo(() => {
    if (!tags) return [] as string[];
    return tags
      .split(',')
      .map((tag) => normalizeTagValue(tag))
      .filter(Boolean);
  }, [tags]);

  const pageTagUniverse = useMemo(
    () => Array.from(new Set([...(tagSuggestions ?? []), ...currentPageTags])).sort(),
    [currentPageTags, tagSuggestions],
  );

  const inlineTagOptions = useMemo(() => {
    if (!inlineTagPicker) return [] as string[];

    const selectedKeys = new Set(currentPageTags.map(tagKey));
    const query = inlineTagPicker.query.trim().toLowerCase();
    const uniqueSuggestions: string[] = [];
    const seen = new Set<string>();

    for (const suggestion of tagSuggestions ?? []) {
      const normalized = normalizeTagValue(suggestion);
      const normalizedKey = tagKey(normalized);
      if (!normalized || seen.has(normalizedKey) || selectedKeys.has(normalizedKey)) continue;
      if (query && !normalized.toLowerCase().includes(query)) continue;
      uniqueSuggestions.push(normalized);
      seen.add(normalizedKey);
    }

    return uniqueSuggestions;
  }, [currentPageTags, inlineTagPicker, tagSuggestions]);

  const canCreateInlineTag = useMemo(() => {
    if (!inlineTagPicker) return false;
    const normalized = normalizeTagValue(inlineTagPicker.query);
    if (!normalized) return false;

    const existingKeys = new Set([
      ...currentPageTags.map(tagKey),
      ...(tagSuggestions ?? []).map(tagKey),
    ]);

    return !existingKeys.has(tagKey(normalized));
  }, [currentPageTags, inlineTagPicker, tagSuggestions]);

  const getCurrentSlateContext = useCallback(() => {
    return getYooptaCurrentSlateContext(editor);
  }, [editor]);

  // === COLUMN LAYOUT ===
  const { colMeta, colMetaRef, gridPositions, initFromContent, addToRow, addBlockToColumn, removeFromRow, resizeColumns, prevBlockIdsRef, skipAutoJoinRef, restoreLayoutFromDraft, trackBlockChanges } = useEditorRowLayout(editor);
  // dropPendingRef declared above useState — see createPlanneerEditor refs
  /** Store rendered block content for the anchor rendering pattern */
  const columnBlockContentRef = useRef(new Map<string, React.ReactNode>());

  // Monkey-patches (toggleBlock, moveBlock, isRemoteSlateOp) are applied
  // inside createPlanneerEditor(). See src/lib/createPlanneerEditor.ts.

  // Initialize column layout from content on mount
  useEffect(() => {
    const currentDraft = usePagesStore.getState().draftContent;
    if (currentDraft) restoreLayoutFromDraft(currentDraft);
  }, [restoreLayoutFromDraft, pageId]);

  /** Persist column layout into draft content */
  const persistColumnLayout = useCallback(() => {
    const currentValue = editor.getEditorValue();
    const contentWithLayout = injectRowLayout(
      currentValue as unknown as Record<string, unknown>,
      colMetaRef.current,
    );
    setDraftContent(JSON.stringify(contentWithLayout));
  }, [editor, colMetaRef, setDraftContent]);

  /**
   * Clear Slate editor selections before column layout operations.
   * Moving blocks can leave stale Slate paths (e.g. [1,0]) that cause
   * "Cannot find a descendant at path" errors when Slate re-renders.
   */
  const clearSlateSelections = useCallback(() => {
    try {
      // Blur any focused contenteditable to force Slate selection clear
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.closest('[data-yoopta-block]')) {
        active.blur();
      }
      // Also deselect via Yoopta's path API
      editor.setPath({ current: null });
    } catch {
      // Ignore — best-effort
    }
  }, [editor]);

  // Handle new-column drop (supports multi-block drag)
  const handleNewColumn = useCallback(
    (draggedBlockIds: string[], targetBlockId: string, side: 'left' | 'right') => {
      clearSlateSelections();
      for (const id of draggedBlockIds) {
        addToRow(id, targetBlockId, side);
      }
      persistColumnLayout();
    },
    [addToRow, persistColumnLayout, clearSlateSelections],
  );

  // Handle into-column drop (drag an existing block into a column, supports multi-block)
  const handleColumnInsert = useCallback(
    (draggedBlockIds: string[], targetBlockId: string, groupId: string, columnIndex: number, position: 'above' | 'below') => {
      clearSlateSelections();

      // Insert each dragged block sequentially; after the first insertion,
      // subsequent blocks are appended after the previously inserted one so
      // they appear in the same order as the selection.
      let lastInsertedId: string | undefined;

      for (const draggedBlockId of draggedBlockIds) {
        if (lastInsertedId) {
          // subsequent blocks go right after the previously inserted one
          addBlockToColumn(draggedBlockId, groupId, columnIndex, { afterBlockId: lastInsertedId });
        } else if (position === 'above') {
          addBlockToColumn(draggedBlockId, groupId, columnIndex, { beforeBlockId: targetBlockId });
        } else {
          addBlockToColumn(draggedBlockId, groupId, columnIndex, { afterBlockId: targetBlockId });
        }

        // Move the block in content order to be within the group's range
        const meta = colMetaRef.current;
        const targetBlock = editor.children[targetBlockId];
        if (targetBlock) {
          const dest = position === 'above' ? targetBlock.meta.order : targetBlock.meta.order + 1;
          try {
            (editor as PlanneerEditor).originalMoveBlock(draggedBlockId, dest);
          } catch {
            // Slate selection may reference stale paths after block moves
          }
        }

        lastInsertedId = draggedBlockId;
      }

      persistColumnLayout();
    },
    [addBlockToColumn, editor, colMetaRef, persistColumnLayout, clearSlateSelections],
  );

  // Handle removing blocks from columns (drag to full-width area, supports multi-block)
  const handleRemoveFromColumn = useCallback(
    (blockIds: string[], preferBefore = false) => {
      clearSlateSelections();
      // Capture the current minimum order of the group BEFORE removing from it,
      // so we know where to place the block if the user dropped it above the group.
      let targetOrder: number | null = null;
      if (preferBefore && blockIds.length > 0) {
        const groupId = colMetaRef.current.blocks[blockIds[0]]?.groupId;
        if (groupId) {
          const groupOrders = Object.entries(editor.children)
            .filter(([id]) => colMetaRef.current.blocks[id]?.groupId === groupId && !blockIds.includes(id))
            .map(([, block]) => (block as any).meta.order as number);
          if (groupOrders.length > 0) {
            targetOrder = Math.min(...groupOrders);
          }
        }
      }
      for (const id of blockIds) {
        removeFromRow(id);
      }
      // If the pointer was above the group, move the block before the group
      if (targetOrder !== null) {
        for (const id of blockIds) {
          try {
            editor.moveBlock(id, targetOrder);
          } catch (err) {
            console.warn('[PageEditor] moveBlock after column remove failed', id, err);
          }
        }
      }
      persistColumnLayout();
    },
    [editor, colMetaRef, removeFromRow, persistColumnLayout, clearSlateSelections],
  );


  
  // Track the pageId we're currently editing to detect switches
  // This prevents showing stale content during navigation
  const [mountedForPageId, setMountedForPageId] = useState<string | null>(pageId);
  
  // Reset mounted state when pageId prop changes
  useEffect(() => {
    if (pageId !== mountedForPageId) {
      setMountedForPageId(pageId);
    }
  }, [pageId, mountedForPageId]);
  
  // Track editor focus using Yoopta's native events
  // This avoids DOM event interception that causes mobile keyboard issues
  useEffect(() => {
    if (!usesPortableEditorToolbar) return;
    
    let blurTimeout: ReturnType<typeof setTimeout>;
    
    const handleFocus = () => {
      clearTimeout(blurTimeout);
      setIsEditorFocused(true);
      setPageEditorFocused(true);
    };
    
    const handleBlur = () => {
      // Debounce blur to allow focus to move between blocks during Enter key
      blurTimeout = setTimeout(() => {
        setIsEditorFocused(false);
        // We don't automatically setPageEditorFocused(false) here anymore
        // because the FAB's "Close" button handles the explicit dismissal.
      }, 150);
    };
    
    editor.on('focus', handleFocus);
    editor.on('blur', handleBlur);
    
    // If editor is already focused on mount, sync the state
    // We use a small timeout to ensure the store is ready
    const syncTimeout = setTimeout(() => {
      if (editor.isFocused?.()) {
        handleFocus();
      }
    }, 50);
    
    return () => {
      clearTimeout(syncTimeout);
      clearTimeout(blurTimeout);
      editor.off('focus', handleFocus);
      editor.off('blur', handleBlur);
      // Only clear global focus on unmount
      setPageEditorFocused(false);
    };
  }, [editor, setPageEditorFocused, usesPortableEditorToolbar]);

  // Fallback: Ensure global focus state is synced when the window/document gains focus
  // or when the user taps the editor container
  useEffect(() => {
    if (!usesPortableEditorToolbar) return;

    const syncFocus = () => {
      const activeEl = document.activeElement;
      const isEditorActive = activeEl?.closest('.yoopta-editor') || activeEl?.getAttribute('contenteditable') === 'true';
      if (isEditorActive) {
        setPageEditorFocused(true);
      }
    };

    window.addEventListener('focus', syncFocus, true);
    document.addEventListener('touchstart', syncFocus, { passive: true });
    
    return () => {
      window.removeEventListener('focus', syncFocus, true);
      document.removeEventListener('touchstart', syncFocus);
    };
  }, [setPageEditorFocused, usesPortableEditorToolbar]);
  
  // Track active text marks on selection change
  useEffect(() => {
    if (!usesPortableEditorToolbar) return;
    
    const updateActiveMarks = () => {
      try {
        const activeMarks = new Set<string>();
        
        // Check each format to see if it's active
        const formats = ['bold', 'italic', 'underline', 'strike'];
        formats.forEach(format => {
          const formatHandler = editor.formats[format];
          if (formatHandler && typeof formatHandler.isActive === 'function') {
            if (formatHandler.isActive()) {
              activeMarks.add(format);
            }
          }
        });
        
        setActiveTextMarks(activeMarks);
      } catch (err) {
        // Ignore errors - mark tracking is non-critical
      }
    };
    
    // Update on selection change
    editor.on('change', updateActiveMarks);
    
    // Initial update
    updateActiveMarks();
    
    return () => {
      editor.off('change', updateActiveMarks);
      setActiveTextMarks(new Set());
    };
  }, [editor, setActiveTextMarks, usesPortableEditorToolbar]);

  // Listen for FAB format events on handheld editor devices.
  useEffect(() => {
    if (!usesPortableEditorToolbar) return;
    
    const handleFormat = (e: CustomEvent<{ format: string }>) => {
      try {
        const format = e.detail.format;
        const formatHandler = editor.formats[format];
        if (formatHandler && typeof formatHandler.toggle === 'function') {
          formatHandler.toggle();
        }
      } catch (err) {
        console.error('[PageEditor] Failed to apply format from FAB:', err);
      }
    };
    
    const handleInsert = (e: CustomEvent<{ blockType: string }>) => {
      try {
        const blockType = e.detail.blockType;
        if (blockType === 'slash') {
          // Trigger action menu
          handleOpenMobileActionMenu();
        } else {
          insertBlockAtCurrentPath(editor, blockType, {
            scrollContainer: scrollContainerRef.current,
          });
        }
      } catch (err) {
        console.error('[PageEditor] Failed to insert block from FAB:', err);
      }
    };
    
    window.addEventListener('fab-format', handleFormat as EventListener);
    window.addEventListener('fab-insert', handleInsert as EventListener);
    
    return () => {
      window.removeEventListener('fab-format', handleFormat as EventListener);
      window.removeEventListener('fab-insert', handleInsert as EventListener);
    };
  }, [editor, usesPortableEditorToolbar]);

  // Derive title from store's draftTitle or page object
  const displayTitle = useMemo(() => {
    if (activePageId === pageId) return draftTitle;
    return pagesById[pageId || '']?.title ?? '';
  }, [activePageId, pageId, draftTitle, pagesById]);

  // Show loading if content is loading OR if we don't have content for this page yet
  const isLoading = useMemo(() => {
    if (activePageId === pageId) return isContentLoading;
    if (!pageId) return false;
    const page = pagesById[pageId];
    return !page || page.content === undefined; // content is undefined if not fetched yet
  }, [activePageId, pageId, isContentLoading, pagesById]);

  // Sync remote content updates (SSE) into the v6 editor via setEditorValue
  // In v6, there's no `value` prop — we must push updates imperatively
  //
  // IMPORTANT: draftContent is NOT in the dependency array — it's read from
  // the store via getState() so that local keystrokes don't re-trigger this
  // effect.  Only contentVersion changes (remote update) or initial content
  // load completion should trigger a setEditorValue call.
  const initialContentVersionRef = useRef(contentVersion);
  const initialContentLoadedRef = useRef(!isContentLoading);
  useEffect(() => {
    // Handle initial content load completion:
    // If the editor mounted while content was still loading (isContentLoading=true),
    // the editor was initialized with DEFAULT_YOOPTA_CONTENT. When loading finishes,
    // we need to push the real content into the editor.
    // IMPORTANT: Use applyRemoteContentToEditor (granular block-level updates) instead of
    // editor.setEditorValue() which creates NEW Slate editors that block renderers don't
    // pick up due to useMemo caching. This was causing the first block to appear empty
    // on mobile (PWA) where the race between mount and content load is more pronounced.
    if (!initialContentLoadedRef.current && !isContentLoading) {
      initialContentLoadedRef.current = true;
      const currentDraftContent = usePagesStore.getState().draftContent;
      if (activePageId === pageId && currentDraftContent !== null && currentDraftContent !== undefined) {
        try {
          const parsed = parseContent(currentDraftContent);
          isApplyingRemoteRef.current = true;
          applyRemoteContentToEditor(editor, parsed);
          isApplyingRemoteRef.current = false;
          restoreLayoutFromDraft(currentDraftContent);
        } catch (err) {
          isApplyingRemoteRef.current = false;
          console.error('[PageEditor] Failed to set initial content after load:', err);
        }
      }
      return;
    }

    // Skip the initial mount (editor was created with the initial value)
    if (contentVersion === initialContentVersionRef.current) return;
    // Mark this version as processed so we don't re-apply on unrelated re-renders
    initialContentVersionRef.current = contentVersion;
    
    // Content was updated remotely (SSE) — sync into editor
    const currentDraftContent = usePagesStore.getState().draftContent;
    if (activePageId === pageId && !isContentLoading && currentDraftContent !== null && currentDraftContent !== undefined) {
      try {
        const parsed = parseContent(currentDraftContent);
        isApplyingRemoteRef.current = true;
        applyRemoteContentToEditor(editor, parsed);
        isApplyingRemoteRef.current = false;
        restoreLayoutFromDraft(currentDraftContent);
      } catch (err) {
        isApplyingRemoteRef.current = false;
        console.error('[PageEditor] Failed to sync remote content update:', err);
      }
    }
   
  }, [contentVersion, activePageId, pageId, isContentLoading, editor, restoreLayoutFromDraft]);

  // Hydration safety net: when the page becomes active and loading completes,
  // ensure the editor receives the latest draft content at least once.
  // This covers route flows where the editor mounted before selectPage finished.
  const hydratedPageRef = useRef<string | null>(null);
  useEffect(() => {
    if (activePageId !== pageId || isContentLoading || !pageId) {
      if (activePageId !== pageId) {
        hydratedPageRef.current = null;
      }
      return;
    }

    if (hydratedPageRef.current === pageId) return;

    const currentDraftContent = usePagesStore.getState().draftContent;
    if (currentDraftContent === null || currentDraftContent === undefined) return;

    try {
      const parsed = parseContent(currentDraftContent);
      isApplyingRemoteRef.current = true;
      applyRemoteContentToEditor(editor, parsed);
      hydratedPageRef.current = pageId;
      restoreLayoutFromDraft(currentDraftContent);
    } catch (err) {
      console.error('[PageEditor] Failed hydration sync after page activation:', err);
    } finally {
      isApplyingRemoteRef.current = false;
    }
  }, [activePageId, pageId, isContentLoading, editor, restoreLayoutFromDraft]);

  // === DRAG AND DROP HANDLERS ===
  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    
    // Check if files are being dragged
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    
    if (dragCounter.current === 0) {
      setIsDraggingFile(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDraggingFile(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0 || !pageId) return;

    setIsUploadingDrop(true);

    try {
      for (const file of imageFiles) {
        // Process and upload the image
        const processed = await processImageForUpload(file);
        let result: { src: string; alt?: string; sizes?: { width: number; height: number } };
        
        if (navigator.onLine) {
          result = await uploadPageImage(pageId, processed.file, processed.width, processed.height);
          result = { ...result, src: appendImageCacheBust(result.src) };
        } else {
          const queued = await syncEngine.queueImageUpload(processed.file, pageId);
          result = {
            src: queued.blobUrl,
            alt: processed.filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
            sizes: { width: queued.width, height: queued.height },
          };
        }

        const maxSizes = (editor.plugins.Image.options as ImagePluginOptions | undefined)?.maxSizes;
        const normalizedSizes = result.sizes && maxSizes
          ? limitSizes(result.sizes, {
              width: maxSizes.maxWidth ?? result.sizes.width,
              height: maxSizes.maxHeight ?? result.sizes.height,
            })
          : result.sizes;
        
        // Use Yoopta's ImageCommands to properly insert the image block
        ImageCommands.insertImage(editor, {
          props: {
            src: result.src,
            alt: result.alt || '',
            sizes: normalizedSizes,
          },
        });
      }
    } catch (error) {
      console.error('[PageEditor] Drop upload failed:', error);
    } finally {
      setIsUploadingDrop(false);
    }
  }, [pageId, editor]);

  // Handle internal link selection from our custom action menu
  const handleActionMenuInternalLink = useCallback((blockIdToDelete?: string) => {
    blockToDeleteRef.current = blockIdToDelete;
    setIsLinkPickerOpen(true);
  }, []);

  // Handler for slash menu "Columns": replaces the current block with two
  // side-by-side paragraph blocks using the column layout system.
  const handleColumnsInsert = useCallback((blockIdToReplace?: string) => {
    const blocks = editor.getEditorValue();
    const sorted = Object.values(blocks).sort((a: any, b: any) => a.meta.order - b.meta.order);
    const replaceBlock = blockIdToReplace ? blocks[blockIdToReplace] : null;
    const insertAt = replaceBlock ? (replaceBlock as any).meta.order : sorted.length;

    // Delete the placeholder block (the one with "/" text)
    if (blockIdToReplace) {
      try { editor.deleteBlock({ blockId: blockIdToReplace }); } catch { /* ignore */ }
    }

    // Insert two paragraph blocks with placeholder text.
    // Skip auto-join for both blocks — each insertBlock fires handleChange synchronously
    // which resets skipColumnAutoJoinRef, so we must re-set it immediately before each call.
    const leftBlockId = generateId();
    const rightBlockId = generateId();

    skipAutoJoinRef.current = true;
    editor.insertBlock('Paragraph', {
      at: insertAt,
      focus: false,
      blockData: {
        id: leftBlockId,
        type: 'Paragraph',
        value: [{ id: generateId(), type: 'paragraph', children: [{ text: 'Column 1' }], props: { nodeType: 'block' } }],
        meta: { order: insertAt, depth: 0 },
      } as any,
    });

    skipAutoJoinRef.current = true;
    editor.insertBlock('Paragraph', {
      at: insertAt + 1,
      focus: false,
      blockData: {
        id: rightBlockId,
        type: 'Paragraph',
        value: [{ id: generateId(), type: 'paragraph', children: [{ text: 'Column 2' }], props: { nodeType: 'block' } }],
        meta: { order: insertAt + 1, depth: 0 },
      } as any,
    });

    // Group them as a row
    addToRow(rightBlockId, leftBlockId, 'right');

    // Focus the left block
    setTimeout(() => {
      try { editor.focusBlock(leftBlockId); } catch { /* ignore */ }
    }, 50);
  }, [editor, addToRow]);
  
  // Handler to open mobile action menu
  const handleOpenMobileActionMenu = useCallback(() => {
    setIsMobileActionMenuOpen(true);
  }, []);

  const handleInsertBlock = useCallback((blockType: string) => {
    if (blockType === 'InternalLink') {
      handleActionMenuInternalLink();
      return;
    }

    if (blockType === 'Columns') {
      handleColumnsInsert();
      return;
    }

    try {
      insertBlockAtCurrentPath(editor, blockType, {
        scrollContainer: scrollContainerRef.current,
      });
    } catch (err) {
      console.error('[PageEditor] Failed to insert block directly:', err);
    }
  }, [editor, handleActionMenuInternalLink, handleColumnsInsert]);

  // Close action menu on scroll (standard UX pattern for floating menus)
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      // Check if action menu is open by looking for the portal element
      const actionMenuPortal = document.getElementById('yoo-action-menu-list-portal');
      if (actionMenuPortal && actionMenuPortal.children.length > 0) {
        // Dispatch Escape key to close the menu
        const escapeEvent = new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true,
        });
        document.activeElement?.dispatchEvent(escapeEvent);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Track when YooptaEditor is mounted/unmounted to prevent focus on unmounted editor
  useEffect(() => {
    editorMountedRef.current = true;
    return () => {
      editorMountedRef.current = false;
    };
  }, [contentVersion, pageId]);

  // Safari undo/redo fix: Prevent native beforeinput events that bypass
  // Yoopta's custom history stack. Safari fires beforeinput with inputType
  // 'historyUndo'/'historyRedo' which performs a native contenteditable
  // undo BEFORE Yoopta's keydown handler can intercept Cmd+Z. This causes
  // undo to silently fail. Preventing these events lets Yoopta's document-
  // level keydown listener correctly call editor.undo()/editor.redo().
  useEffect(() => {
    const el = editorAreaRef.current;
    if (!el) return;

    const handleBeforeInput = (e: InputEvent) => {
      if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
        e.preventDefault();
      }
    };

    el.addEventListener('beforeinput', handleBeforeInput as EventListener);
    return () => el.removeEventListener('beforeinput', handleBeforeInput as EventListener);
  }, []);

  // Auto-focus editor for existing pages to prevent caret jump on first click
  // Skip auto-focus if user is currently editing the title (for new pages)
  useEffect(() => {
    if (disableAutoFocus || readOnly) return;
    
    if (pageId === activePageId && !isNewlyCreated && !isEditingTitle) {
      // Existing page: focus editor immediately to prevent caret jump
      if (!isContentLoading) {
        setTimeout(() => {
          // Safety check: ensure editor is mounted and has children before focusing
          if (editorMountedRef.current && editor.children && Object.keys(editor.children).length > 0) {
            editor.focus();
          }
        }, 0);
      }
    }
  }, [pageId, activePageId, isNewlyCreated, isEditingTitle, isContentLoading, editor, disableAutoFocus]);

  // Auto-focus title for newly created pages
  // Only react if this editor is for the active page (prevents parent editor from stealing focus)
  useEffect(() => {
    if (disableAutoFocus || readOnly) return;

    if (isNewlyCreated && pageId === activePageId) {
      if (isDailyNote) {
        // Daily pages have pre-filled titles, focus the editor content instead
        setTimeout(() => {
          // Safety check: ensure editor is mounted and has children before focusing
          if (editorMountedRef.current && editor.children && Object.keys(editor.children).length > 0) {
            editor.focus();
          }
        }, 0);
      } else {
        // Regular new page: focus title input
        setIsEditingTitle(true);
      }
      clearNewlyCreated();
    }
  }, [isNewlyCreated, pageId, activePageId, isDailyNote, editor, clearNewlyCreated, disableAutoFocus]);

  // === AUTO-SAVE ===
  const { triggerSave } = useAutoSave({
    onSave: saveCurrentPage,
    hasChanges: isDirty,
    onSaveComplete: () => {},
    debounceMs: 1000,
    intervalMs: 5000,
  });

  const flushPendingDraftContent = useCallback(() => {
    if (pendingDraftTimeoutRef.current) {
      clearTimeout(pendingDraftTimeoutRef.current);
      pendingDraftTimeoutRef.current = null;
    }
    pendingDraftIdleRef.current = null;

    const pendingValue = pendingDraftValueRef.current;
    if (!pendingValue) return;

    pendingDraftValueRef.current = null;
    // Sanitize: remove any blocks with invalid IDs or missing types that could
    // have slipped into the editor state (e.g. from a Yoopta internal race).
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(pendingValue)) {
      if (!k || k === ROW_LAYOUT_KEY) continue;
      const block = v as Record<string, unknown>;
      if (typeof block?.type !== 'string') {
        console.warn(`[PageEditor] Dropping invalid block at key "${k}" during draft flush`);
        continue;
      }
      sanitized[k] = v;
    }
    // Inject column layout metadata so it persists with the content JSON
    const contentWithLayout = injectRowLayout(
      sanitized,
      colMetaRef.current,
    );
    const newContent = JSON.stringify(contentWithLayout);

    // Deduplicate: skip if content matches what's already in the store.
    // Yoopta's Slate blocks can emit async echoes after remote apply.
    const currentDraft = usePagesStore.getState().draftContent;
    if (newContent === currentDraft) return;

    setDraftContent(newContent);
  }, [setDraftContent]);

  const schedulePendingDraftFlush = useCallback(() => {
    if (pendingDraftIdleRef.current !== null || pendingDraftTimeoutRef.current) {
      return;
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      pendingDraftIdleRef.current = window.requestIdleCallback(
        () => flushPendingDraftContent(),
        { timeout: 120 },
      );
      return;
    }

    pendingDraftTimeoutRef.current = setTimeout(() => {
      flushPendingDraftContent();
    }, 0);
  }, [flushPendingDraftContent]);

  useEffect(() => {
    return () => {
      if (pendingDraftIdleRef.current !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(pendingDraftIdleRef.current);
      }
      if (pendingDraftTimeoutRef.current) {
        clearTimeout(pendingDraftTimeoutRef.current);
      }
      pendingDraftIdleRef.current = null;
      pendingDraftTimeoutRef.current = null;
      pendingDraftValueRef.current = null;
      if (inlineTagRefreshRafRef.current !== null) {
        cancelAnimationFrame(inlineTagRefreshRafRef.current);
      }
    };
  }, []);

  const closeInlineTagPicker = useCallback(() => {
    setInlineTagPicker((prev) => (prev === null ? prev : null));
  }, []);

  const refreshInlineTagPicker = useCallback(() => {
    if (!onTagsChange || readOnly) {
      setInlineTagPicker((prev) => (prev === null ? prev : null));
      return;
    }

    const context = getCurrentSlateContext();
    if (!context) {
      setInlineTagPicker((prev) => (prev === null ? prev : null));
      return;
    }

    const { blockId, slateEditor } = context;
    const selection = slateEditor.selection;
    if (!selection || !Range.isCollapsed(selection)) {
      setInlineTagPicker((prev) => (prev === null ? prev : null));
      return;
    }

    const node = SlateEditor.node(slateEditor, selection.anchor.path);
    const textNode = node[0] as { text?: string };
    if (!textNode || typeof textNode.text !== 'string') {
      setInlineTagPicker((prev) => (prev === null ? prev : null));
      return;
    }

    const textBeforeCursor = textNode.text.slice(0, selection.anchor.offset);
    const hashIndex = textBeforeCursor.lastIndexOf('#');
    if (hashIndex < 0) {
      setInlineTagPicker((prev) => (prev === null ? prev : null));
      return;
    }

    if (hashIndex > 0 && !/\s/.test(textBeforeCursor[hashIndex - 1])) {
      setInlineTagPicker((prev) => (prev === null ? prev : null));
      return;
    }

    const query = textBeforeCursor.slice(hashIndex + 1);
    if (/\s/.test(query)) {
      setInlineTagPicker((prev) => (prev === null ? prev : null));
      return;
    }

    const domSelection = window.getSelection();
    if (!domSelection || domSelection.rangeCount === 0) {
      setInlineTagPicker((prev) => (prev === null ? prev : null));
      return;
    }

    const range = domSelection.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    const editorRect = editorAreaRef.current?.getBoundingClientRect();
    if (!editorRect) {
      setInlineTagPicker((prev) => (prev === null ? prev : null));
      return;
    }

    const nextTop = rect.bottom + 10;
    const nextLeft = Math.max(8, rect.left - 8);

    setInlineTagPicker((prev) => {
      const nextHighlightedIndex = prev && prev.query === query ? prev.highlightedIndex : 0;
      const nextState: InlineTagPickerState = {
        blockId,
        path: selection.anchor.path,
        startOffset: hashIndex,
        endOffset: selection.anchor.offset,
        query,
        top: nextTop,
        left: nextLeft,
        highlightedIndex: nextHighlightedIndex,
      };

      if (
        prev &&
        prev.blockId === nextState.blockId &&
        prev.startOffset === nextState.startOffset &&
        prev.endOffset === nextState.endOffset &&
        prev.query === nextState.query &&
        prev.left === nextState.left &&
        prev.top === nextState.top &&
        prev.highlightedIndex === nextState.highlightedIndex &&
        prev.path.length === nextState.path.length &&
        prev.path.every((value, index) => value === nextState.path[index])
      ) {
        return prev;
      }

      return nextState;
    });
  }, [editorAreaRef, getCurrentSlateContext, onTagsChange, readOnly]);

  const scheduleInlineTagPickerRefresh = useCallback(() => {
    if (inlineTagRefreshRafRef.current !== null) {
      cancelAnimationFrame(inlineTagRefreshRafRef.current);
    }

    inlineTagRefreshRafRef.current = requestAnimationFrame(() => {
      inlineTagRefreshRafRef.current = null;
      refreshInlineTagPicker();
    });
  }, [refreshInlineTagPicker]);

  const commitInlineTag = useCallback((rawTag: string) => {
    if (!onTagsChange || !inlineTagPicker) return;

    const normalizedTag = normalizeTagValue(rawTag);
    if (!normalizedTag) {
      setInlineTagPicker((prev) => (prev === null ? prev : null));
      return;
    }

    const mergedTags = [...currentPageTags];
    if (!mergedTags.some((tag) => tagKey(tag) === tagKey(normalizedTag))) {
      mergedTags.push(normalizedTag);
      onTagsChange(mergedTags.join(', '));
    }

    const slateEditor = editor.blockEditorsMap[inlineTagPicker.blockId];
    if (slateEditor) {
      Transforms.select(slateEditor, {
        anchor: { path: inlineTagPicker.path, offset: inlineTagPicker.startOffset },
        focus: { path: inlineTagPicker.path, offset: inlineTagPicker.endOffset },
      });
      Transforms.delete(slateEditor);
    }

    setInlineTagPicker((prev) => (prev === null ? prev : null));
  }, [currentPageTags, editor.blockEditorsMap, inlineTagPicker, onTagsChange]);

  const tryApplyInlineMarkdownShortcut = useCallback(
    (trailingText: string) => applyInlineMarkdownShortcut(editor, trailingText),
    [editor],
  );

  const tryApplyBlockMarkdownShortcut = useCallback(
    () => applyBlockMarkdownShortcut(editor),
    [editor],
  );

  useEffect(() => {
    if (!inlineTagPicker) return;

    const maxIndex = inlineTagOptions.length + (canCreateInlineTag ? 1 : 0) - 1;
    if (maxIndex < 0) {
      if (inlineTagPicker.highlightedIndex !== 0) {
        setInlineTagPicker((prev) => (prev ? { ...prev, highlightedIndex: 0 } : prev));
      }
      return;
    }

    if (inlineTagPicker.highlightedIndex > maxIndex) {
      setInlineTagPicker((prev) => (prev ? { ...prev, highlightedIndex: maxIndex } : prev));
    }
  }, [canCreateInlineTag, inlineTagOptions.length, inlineTagPicker]);

  useEffect(() => {
    if (!isEditorFocused) {
      setInlineTagPicker(null);
    }
  }, [isEditorFocused]);

  // === HANDLERS ===
  const handleChange = useCallback((newValue: YooptaContentValue, _options: YooptaOnChangeOptions) => {
    // Skip if this change was triggered by a programmatic setEditorValue
    // (remote SSE sync or initial content load). Saving remote content back
    // as a local edit would set isDirty=true and block later remote updates.
    if (isApplyingRemoteRef.current) return;

    // Auto-propagate column membership for Enter key / new blocks
    trackBlockChanges(newValue as unknown as Record<string, unknown>);

    pendingDraftValueRef.current = newValue;
    schedulePendingDraftFlush();
    scheduleInlineTagPickerRefresh();
  }, [scheduleInlineTagPickerRefresh, schedulePendingDraftFlush, trackBlockChanges]);

  useEffect(() => {
    if (readOnly || !isEditorFocused) return;

    const handleSelectionRefresh = () => {
      scheduleInlineTagPickerRefresh();
    };

    document.addEventListener('selectionchange', handleSelectionRefresh);
    window.addEventListener('resize', handleSelectionRefresh);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionRefresh);
      window.removeEventListener('resize', handleSelectionRefresh);
    };
  }, [isEditorFocused, readOnly, scheduleInlineTagPickerRefresh]);

  // Handle internal link selection from picker
  const handleInternalLinkSelect = useCallback((selection: SearchSelection) => {
    // Build element using Yoopta's expected structure
    const elementData = {
      id: generateId(),
      type: 'internal-link',
      children: [{ text: '' }],
      props: {
        nodeType: 'void' as const,
        linkType: selection.type,
        linkedId: selection.id,
        title: selection.title,
        completed: selection.completed ?? false,
        icon: selection.icon ?? null,
      },
    };
    
    // Build block data using Yoopta's helper
    const blockData = buildBlockData({
      type: 'InternalLink',
      value: [elementData],
    });
    
    // Get the block to delete (the one with "/" or "@" text)
    const blockIdToDelete = blockToDeleteRef.current;
    blockToDeleteRef.current = undefined;
    
    // Insert the new block at the same position as the old one
    if (blockIdToDelete) {
      // Get the old block's position
      const oldBlock = editor.getBlock({ id: blockIdToDelete });
      const atPosition = oldBlock?.meta?.order ?? editor.path.current;
      
      try {
        // Insert the new block - don't focus void blocks (causes Slate error)
        Blocks.insertBlock(editor, blockData.type, {
          at: atPosition,
          focus: false,
          blockData,
        });
      } catch (err) {
        console.error('[PageEditor] Error inserting block', err);
      }
      
      try {
        // Delete the old block (which is now after our new block)
        Blocks.deleteBlock(editor, { blockId: blockIdToDelete });
      } catch (err) {
        console.error('[PageEditor] Error deleting old block', err);
      }
    } else {
      try {
        // Fallback: just insert at current position - don't focus void blocks
        Blocks.insertBlock(editor, blockData.type, {
          focus: false,
          blockData,
        });
      } catch (err) {
        console.error('[PageEditor] Error inserting block (fallback)', err);
      }
    }
    
    setIsLinkPickerOpen(false);
    
    // Get the editor content immediately after block operations
    // The insertion/deletion have already happened synchronously above
    const currentContent = editor.getEditorValue();
    
    if (currentContent) {
      const contentStr = JSON.stringify(currentContent);
      setDraftContent(contentStr);
      
      // CRITICAL: Save immediately to IndexedDB to prevent SSE race condition
      // The SSE handler uses IndexedDB content for merge, not the store's draftContent.
      // Without this, an SSE update from another tab could overwrite the new block.
      // Use setTimeout(0) to let React process the state update first
      setTimeout(() => {
        saveCurrentPage();
      }, 0);
    }
  }, [editor, setDraftContent, saveCurrentPage]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setDraftTitle(newTitle);
  }, [setDraftTitle]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsEditingTitle(false);
      // Focus the editor after pressing Enter on title
      // Small delay to ensure title input has blurred
      setTimeout(() => {
        // Safety check: ensure editor is mounted and has children before focusing
        if (editorMountedRef.current && editor.children && Object.keys(editor.children).length > 0) {
          editor.focus();
        }
      }, 0);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingTitle(false);
    }
  }, [editor]);

  const handleDeleteClick = useCallback(() => {
    if (!onDeletePage || !pageId) return;
    const page = pagesById[pageId];
    const childCount = page?.childCount || 0;
    requestDelete({
      itemType: 'page',
      count: 1,
      hasChildren: childCount > 0,
      childCount,
      onConfirm: (cascade: boolean) => {
        onDeletePage(pageId, cascade);
        onCancel();
      },
    });
  }, [requestDelete, onDeletePage, pageId, onCancel, pagesById]);

  const handleSave = useCallback(() => {
    triggerSave();
  }, [triggerSave]);

  // Handle external delete trigger
  useEffect(() => {
    if (triggerDelete && onDeletePage) {
      handleDeleteClick();
      onDeleteComplete?.();
    }
  }, [triggerDelete, onDeletePage, onDeleteComplete, handleDeleteClick]);

  // Handle @ key to trigger internal link picker
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (inlineTagPicker) {
      const totalOptions = inlineTagOptions.length + (canCreateInlineTag ? 1 : 0);

      if (e.key === 'ArrowDown' && totalOptions > 0) {
        e.preventDefault();
        e.stopPropagation();
        setInlineTagPicker((prev) => prev ? {
          ...prev,
          highlightedIndex: Math.min(prev.highlightedIndex + 1, totalOptions - 1),
        } : prev);
        return;
      }

      if (e.key === 'ArrowUp' && totalOptions > 0) {
        e.preventDefault();
        e.stopPropagation();
        setInlineTagPicker((prev) => prev ? {
          ...prev,
          highlightedIndex: Math.max(prev.highlightedIndex - 1, 0),
        } : prev);
        return;
      }

      if ((e.key === 'Enter' || e.key === 'Tab') && totalOptions > 0) {
        e.preventDefault();
        e.stopPropagation();

        if (inlineTagPicker.highlightedIndex < inlineTagOptions.length) {
          commitInlineTag(inlineTagOptions[inlineTagPicker.highlightedIndex]);
        } else if (canCreateInlineTag) {
          commitInlineTag(inlineTagPicker.query);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeInlineTagPicker();
        return;
      }

      if (e.key === ' ') {
        closeInlineTagPicker();
      }
    }

    if (e.key === ' ' && tryApplyBlockMarkdownShortcut()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if ((e.key === ' ' || e.key === '.' || e.key === ',' || e.key === '!' || e.key === '?' || e.key === ';' || e.key === ':') && tryApplyInlineMarkdownShortcut(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Tab / Shift+Tab to indent/outdent list blocks (bulleted, numbered, todo)
    if (e.key === 'Tab') {
      const currentOrder = editor.path.current;
      if (currentOrder !== null && currentOrder !== undefined) {
        const currentBlock = Object.values(editor.getEditorValue()).find(
          (block) => block?.meta?.order === currentOrder,
        ) as any;

        const listTypes = new Set(['BulletedList', 'NumberedList', 'TodoList']);
        const isListBlock = currentBlock && listTypes.has(currentBlock.type);

        if (isListBlock) {
          e.preventDefault();
          e.stopPropagation();

          const currentDepth = Number(currentBlock.meta?.depth ?? 0);
          const nextDepth = e.shiftKey
            ? Math.max(0, currentDepth - 1)
            : Math.min(6, currentDepth + 1);

          if (nextDepth !== currentDepth) {
            editor.applyTransforms(
              [
                {
                  type: 'set_block_meta',
                  id: currentBlock.id,
                  properties: { ...currentBlock.meta, depth: nextDepth },
                  prevProperties: currentBlock.meta,
                },
              ] as any,
              { validatePaths: true },
            );
          }
          return;
        }
      }
    }

    // Check for @ key (Shift + 2)
    if (e.key === '@' || (e.shiftKey && e.key === '2')) {
      e.preventDefault();
      e.stopPropagation();
      
      // Get current block to delete when inserting link
      const currentBlockId = editor.path.current !== null 
        ? Object.values(editor.getEditorValue()).find(b => b.meta?.order === editor.path.current)?.id
        : undefined;
      
      blockToDeleteRef.current = currentBlockId;
      setIsLinkPickerOpen(true);
    }
  }, [canCreateInlineTag, closeInlineTagPicker, commitInlineTag, editor, inlineTagOptions, inlineTagPicker, tryApplyBlockMarkdownShortcut, tryApplyInlineMarkdownShortcut]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, handleSave]);

  // Calculate document size for display
  // Read draftContent via getState() — not subscribed to avoid re-renders.
  // Recalculates when isDirty changes (edit start/save) which is sufficient.
  const docSize = useMemo(() => {
    const currentDraftContent = usePagesStore.getState().draftContent;
    const content = activePageId === pageId ? currentDraftContent : (pagesById[pageId || '']?.content ?? '');
    const bytes = new Blob([content]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
   
  }, [activePageId, pageId, isDirty, pagesById]);

  // Show loading if content is loading OR if we don't have content for this page yet
  // (isLoading is now a memoized value above)

  // Wrap each block with SortableBlock for drag-and-drop reordering (v6)
  // Column groups use an "anchor" pattern: the last block in content order
  // renders a flex container holding all blocks in the group, achieving true
  // independent vertical stacking per column (not table-like row alignment).
  const renderBlock = useCallback(({ children, blockId }: RenderBlockProps) => {
    const pos = gridPositions.get(blockId);
    const meta = colMetaRef.current;
    const entry = meta.blocks[blockId];

    // Normal block (not in a column group)
    if (!entry || !pos?.groupId) {
      return (
        <SortableBlock id={blockId} useDragHandle className="col-span-full">
          <div data-column-block-id={blockId}>{children}</div>
        </SortableBlock>
      );
    }

    // Column block: store rendered content in ref for the anchor to read
    const blockContent = (
      <div key={blockId} data-column-block-id={blockId} style={{ minHeight: 24 }}>
        <SortableBlock id={blockId} useDragHandle>{children}</SortableBlock>
      </div>
    );
    columnBlockContentRef.current.set(blockId, blockContent);

    if (pos.isGroupAnchor) {
      // This is the anchor: render the full column group as a flex container
      const group = meta.groups[entry.groupId];
      if (!group) return blockContent; // fallback

      const groupColumns = getGroupColumns(meta, entry.groupId);
      const sortedColIndices = [...groupColumns.keys()].sort((a, b) => a - b);

      return (
        <div
          style={{
            gridColumn: '1 / -1',
            gridRow: pos.gridRow,
            display: 'flex',
            marginTop: 4,
            marginBottom: 4,
          }}
          data-column-group-container={entry.groupId}
        >
          {sortedColIndices.map((colIdx) => {
            const colBlockIds = groupColumns.get(colIdx) ?? [];
            return (
              <React.Fragment key={colIdx}>
                {colIdx > 0 && (
                  <ColumnResizeHandle
                    groupId={entry.groupId}
                    leftColIndex={colIdx - 1}
                    columnWidths={group.columnWidths}
                    onResize={resizeColumns}
                    onResizeEnd={persistColumnLayout}
                  />
                )}
                <div
                  style={{
                    flex: group.columnWidths[colIdx] ?? (1 / group.columnCount),
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                  }}
                  data-column-group={entry.groupId}
                  data-column-index={colIdx}
                >
                  {colBlockIds.map(id => columnBlockContentRef.current.get(id))}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      );
    }

    // Non-anchor: hidden from grid flow (content is rendered by the anchor)
    return <div style={{ display: 'none' }} />;
  }, [gridPositions, colMetaRef, resizeColumns, persistColumnLayout]);

  return (
    <PageEditorProvider pageId={pageId}>
    <div className={cn("flex-1 flex flex-col", !hideHero && "h-full", hideHero && "relative z-10")}>
      <div ref={scrollContainerRef} className={cn("flex-1 relative", !hideHero && "overflow-y-auto scrollbar-thin", hideHero && "overflow-visible")}>
        {/* Integrated hero with cover + title */}
        {!hideHero && (
          <PageHero
            pageId={pageId}
            title={displayTitle}
            isEditingTitle={isEditingTitle}
            onTitleChange={handleTitleChange}
            onTitleEditStart={() => setIsEditingTitle(true)}
            onTitleEditEnd={() => setIsEditingTitle(false)}
            onTitleKeyDown={handleTitleKeyDown}
            coverImage={coverImage}
            coverGradient={coverGradient}
            coverAttribution={coverAttribution}
            editableCover={true}
            onCoverChange={(newCover: string | null) => {
              if (pageId) updatePage(pageId, { coverImage: newCover });
            }}
            created={created}
            updated={updated}
            docSize={docSize}
            hasChanges={activePageId === pageId ? isDirty : false}
            onDelete={onDeletePage ? handleDeleteClick : undefined}
            hideActions={hideActions}
            icon={icon}
            color={color}
            onIconClick={onIconClick}
            viewMode={viewMode}
            isDailyNote={isDailyNote}
            onMarkHasChanges={() => {}}
            tags={tags}
            compact={compact}
            onToggleCompact={onToggleCompact}
            onTagsChange={onTagsChange}
            tagSuggestions={tagSuggestions}
            contentRightInsetPx={contentRightInsetPx}
          />
        )}

        <div
          className="w-full"
          style={!hideHero ? getRightInsetStyle(contentRightInsetPx) : undefined}
        >
          <div
            className={cn(
              "max-w-5xl mx-auto px-4 md:px-6 pb-32 md:pb-6",
              hideHero && "max-w-none px-0 md:px-0 pb-0 md:pb-0"
            )}
          >
          {/* Status banners for offline states */}
          {!hideHero && contentUnavailableOffline && (
            <StatusBanner
              variant="offline"
              title="Content not available offline"
              description="This page's content hasn't been cached locally yet. Connect to the internet to load and view the full content."
              className="mb-4 mx-4 md:mx-0"
            />
          )}
          {!hideHero && !contentUnavailableOffline && contentMayBeIncomplete && (
            <StatusBanner
              variant="warning"
              title="Content may be incomplete"
              description="Only recent edits have been synced. Some content from before you started the app may be missing. Connect to the internet to load the full page."
              className="mb-4 mx-4 md:mx-0"
            />
          )}
          
          <div 
            ref={editorAreaRef}
            data-testid="page-editor-surface"
            className={cn(
              "py-6 min-h-[600px] relative",
              hideHero && "px-1 py-2 min-h-0 bg-transparent dark:bg-transparent shadow-none overflow-y-auto scrollbar-thin"
            )}
            onKeyDown={handleEditorKeyDown}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drop zone overlay */}
            {isDraggingFile && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--color-interactive-bg)] border-2 border-dashed border-[var(--color-interactive-border)] rounded-lg pointer-events-none">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-2 text-[var(--color-interactive-text-strong)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-lg font-medium text-[var(--color-interactive-text-strong)]">Drop image here</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">Image will be uploaded and inserted</p>
                </div>
              </div>
            )}
            
            {/* Upload progress overlay */}
            {isUploadingDrop && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--color-surface-overlay)] rounded-lg">
                <div className="text-center">
                  <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-[var(--color-interactive-text-strong)]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">Uploading image...</p>
                </div>
              </div>
            )}

            {inlineTagPicker && !readOnly && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed z-[9999] w-72 max-w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-surface-base)_96%,white)] shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl"
                style={{
                  top: inlineTagPicker.top,
                  left: inlineTagPicker.left,
                }}
              >
                <div className="border-b border-[var(--color-border-subtle)] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                  Page tags
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  <TagPickerMenu
                    suggestions={inlineTagOptions}
                    currentTags={currentPageTags}
                    highlightedIndex={inlineTagPicker.highlightedIndex}
                    canCreate={canCreateInlineTag}
                    query={inlineTagPicker.query}
                    existingTags={pageTagUniverse}
                    contextKey={pageId ? `page-tags-${pageId}` : undefined}
                    onSelectTag={commitInlineTag}
                    onCreateTag={commitInlineTag}
                  />
                </div>
              </div>,
              document.body,
            )}
            
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-[var(--color-text-secondary)]">
                <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading content...
              </div>
            ) : (
              <>
              <div className="yoopta-editor-container">
                <ForceUpdateBlockDndContext editor={editor}>
                  <VerticalDropIndicator />
                  <SideDropIndicator
                    dropPendingRef={dropPendingRef}
                    onNewColumn={handleNewColumn}
                    onColumnInsert={handleColumnInsert}
                    onRemoveFromColumn={handleRemoveFromColumn}
                    colMetaRef={colMetaRef}
                  />
                  <YooptaEditor
                    editor={editor}
                    onChange={handleChange}
                    autoFocus={!pageId && !readOnly}
                    placeholder={readOnly ? "" : "Start typing or press '/' for commands..."}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(12, 1fr)',
                      columnGap: '0.5rem',
                    }}
                    renderBlock={readOnly ? undefined : renderBlock}
                  >
                    {/* v6: UI components rendered as children */}
                    {!isMobile && !readOnly && !isTabletDevice && (
                      <>
                        <EditorSlashMenu
                          onInternalLinkClick={handleActionMenuInternalLink}
                          onColumnsClick={handleColumnsInsert}
                          colMetaRef={colMetaRef}
                        />
                        <EditorFloatingToolbar />
                        <EditorFloatingBlockActions colMetaRef={colMetaRef} />
                        <SelectionBox selectionBoxElement={editorAreaRef} />
                      </>
                    )}
                  </YooptaEditor>
                </ForceUpdateBlockDndContext>
              </div>
              {/* Trailing click area: always inserts a new paragraph at the end.
                  Mirrors Notion's behavior of clicking below content to add text. */}
              {!readOnly && !hideHero && (
                <div
                  data-testid="page-editor-trailing-space"
                  className="min-h-[120px] cursor-text"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    try {
                      const blocks = editor.getEditorValue();
                      const sorted = Object.values(blocks)
                        .filter((b: any) => (b as any).id !== ROW_LAYOUT_KEY)
                        .sort((a: any, b: any) => a.meta.order - b.meta.order);
                      const insertAt = sorted.length;
                      // Prevent handleChange from auto-joining this block into a column
                      skipAutoJoinRef.current = true;
                      insertBlockWithFocus(editor, 'Paragraph', {
                        order: insertAt,
                        scrollContainer: scrollContainerRef.current,
                      });
                    } catch {
                      // Fallback: just insert at what we assume is the end
                      editor.insertBlock('Paragraph', { focus: true });
                    }
                  }}
                />
              )}
              </>
            )}
          </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Editor Toolbar - sticky bottom formatting bar */}
      <MobileEditorToolbar 
        editor={editor} 
        isEditorFocused={isEditorFocused} 
        onSlashCommand={handleOpenMobileActionMenu}
        onInternalLinkClick={() => setIsLinkPickerOpen(true)}
        onInsertBlock={handleInsertBlock}
      />
      
      {/* Mobile Action Menu - full-screen sheet for inserting blocks */}
      {usesPortableEditorToolbar && (
        <MobileActionMenu
          isOpen={isMobileActionMenuOpen}
          onClose={() => setIsMobileActionMenuOpen(false)}
          editor={editor}
          onInternalLinkClick={handleActionMenuInternalLink}
        />
      )}
      
      {/* Internal Link Picker Modal - uses CommandPalette in selection mode */}
      <CommandPalette
        isOpen={isLinkPickerOpen}
        onClose={() => setIsLinkPickerOpen(false)}
        onSelect={handleInternalLinkSelect}
        selectionFilter="all"
        placeholder="Search tasks and pages to link..."
      />
    </div>
    </PageEditorProvider>
  );
};

// Wrap with ErrorBoundary to catch content parsing errors
export default withErrorBoundary(PageEditor, { context: 'PageEditor' });
