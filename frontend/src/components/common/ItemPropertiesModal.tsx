/**
 * @file ItemPropertiesModal.tsx
 * @description Modal for editing page properties - title, icon, color, parent, viewMode
 * @app SHARED - Used across the app for page editing
 * 
 * A unified modal component for creating and editing pages.
 * Uses the AddTaskForm-style split panel layout:
 * - Left side: Icon preview and title
 * - Right side: Panel with properties (color, icon, viewMode, etc)
 * 
 * Features:
 * - Title editing
 * - Lucide icon picker (via IconPicker component) - beautiful, colorable icons
 * - Color selection from preset palette
 * - Page mode selection (note, collection, tasks)
 * - Favorite toggle
 * - Show children in sidebar toggle
 * - Delete action
 * - Dirty state tracking for unsaved changes protection
 * 
 * Also exports:
 * - StylizedNoteIcon, StylizedTaskIcon, StylizedCollectionIcon - themed SVG icons
 */
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Button, Input, Label, Modal, IconPicker, LucideIcon, MobileSheet, Popover, ModalFooter, Panel, PropertyRow, InlineTagInput } from '@/components/ui';
import { TrashIcon } from './Icons';
import { PenLine, Pin, FolderInput, Palette, PenTool, Sparkles, Tag } from 'lucide-react';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { useClickOutside } from '@/hooks';
import { cn } from '@/lib/design-system';
import PageModeToggle from './PageModeToggle';

// Simplified to just 'page'
export type ItemType = 'page';

export interface ItemData {
  id: string;
  title: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  /** Note-specific: viewMode for notes (page or collection) */
  viewMode?: string;
  /** Whether the page is pinned to the sidebar */
  isPinned?: boolean;
  /** Whether to show children in the sidebar tree */
  showChildrenInSidebar?: boolean;
  /** Comma-separated tags for the page */
  tags?: string;
  /** Existing tags in the workspace (for autocomplete) */
  existingTags?: string[];
  /** Number of child pages (for PageModeToggle counts) */
  childCount?: number;
  /** Number of tasks (for PageModeToggle counts) */
  taskCount?: number;
  /** Whether the page is source-owned and not editable. */
  isReadOnly?: boolean;
}

export interface ParentOption {
  id: string;
  title: string;
  icon: string | null;
  color: string | null;
  depth: number;
}

interface ItemPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Type of item being edited */
  itemType: ItemType;
  /** Item being edited - null for create mode */
  item: ItemData | null;
  /** Available items for parent selection (excludes self and descendants) */
  availableParents?: ParentOption[];
  /** Callback when saving changes */
  onSave: (data: {
    title: string;
    icon: string | null;
    color: string | null;
    parentId: string | null;
    viewMode?: string;
    isPinned?: boolean;
    showChildrenInSidebar?: boolean;
    tags?: string;
  }) => void;
  /** Callback for deletion */
  onDelete?: () => void;
  /** Callback for moving to another parent/collection */
  onMove?: () => void;
  /** Track dirty state */
  onDirtyChange?: (dirty: boolean) => void;
}

// Modern color palette
const PRESET_COLORS = [
  { color: '#ef4444', name: 'Red' },
  { color: '#f97316', name: 'Orange' },
  { color: '#eab308', name: 'Yellow' },
  { color: '#22c55e', name: 'Green' },
  { color: '#14b8a6', name: 'Teal' },
  { color: '#0ea5e9', name: 'Sky' },
  { color: '#3b82f6', name: 'Blue' },
  { color: '#6366f1', name: 'Indigo' },
  { color: '#8b5cf6', name: 'Violet' },
  { color: '#a855f7', name: 'Purple' },
  { color: '#ec4899', name: 'Pink' },
  { color: '#64748b', name: 'Slate' },
];

// Re-export stylized icons from dedicated file (for backwards compatibility)
export { StylizedNoteIcon, StylizedCollectionIcon, StylizedTaskIcon, StylizedDailyIcon } from './StylizedIcons';
// Also import locally for use within this file
import { StylizedNoteIcon, StylizedCollectionIcon, StylizedTaskIcon } from './StylizedIcons';

/**
 * ItemPropertiesModal - Modern unified modal for editing page properties
 */
const ItemPropertiesModal: React.FC<ItemPropertiesModalProps> = ({
  isOpen,
  onClose,
  itemType,
  item,
  onSave,
  onDelete,
  onMove,
  onDirtyChange,
}) => {
  const isMobile = useIsMobile();
  const isReadOnly = item?.isReadOnly ?? false;
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<string>('note');
  const [isPinned, setIsPinned] = useState(false);
  const [showChildrenInSidebar, setShowChildrenInSidebar] = useState(true);
  const [tags, setTags] = useState<string>('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const colorPickerRef = useRef<HTMLDivElement>(null);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useClickOutside([
    { ref: colorPickerRef, onOutside: () => setShowColorPicker(false) },
    { ref: iconPickerRef, onOutside: () => setShowIconPicker(false) },
  ]);

  // Edit mode if item exists AND has a non-empty id
  const isEditing = !!item && !!item.id;
  const itemLabel = 'Page';

  // Reset form when modal opens or item changes
  useEffect(() => {
    if (isOpen) {
      if (item) {
        setTitle(item.title);
        setIcon(item.icon);
        setColor(item.color);
        setViewMode(item.viewMode || 'note');
        setIsPinned(item.isPinned ?? false);
        setShowChildrenInSidebar(item.showChildrenInSidebar ?? (item.viewMode === 'note'));
        setTags(item.tags || '');
        // Close pickers when modal reopens
        setShowColorPicker(false);
        setShowIconPicker(false);
      } else {
        setTitle('');
        setIcon(null);
        // Set default color based on view mode / item type
        const defaultColor = '#3b82f6';
        setColor(defaultColor);
        setViewMode('note');
        setIsPinned(false);
        setShowChildrenInSidebar(true);
        setTags('');
        setShowColorPicker(false);
        setShowIconPicker(false);
      }
      onDirtyChange?.(false);
    }
  }, [isOpen, item, itemType, onDirtyChange]);

  // Track dirty state
  useEffect(() => {
    if (!isOpen) return;
    
    const hasChanges = item
      ? title !== item.title || 
        icon !== item.icon || 
        color !== item.color || 
          (!isReadOnly && viewMode !== (item.viewMode || 'note')) || 
        isPinned !== (item.isPinned ?? false) ||
        showChildrenInSidebar !== (item.showChildrenInSidebar ?? (item.viewMode === 'note')) ||
        tags !== (item.tags || '')
      : title.trim().length > 0;
    
    onDirtyChange?.(hasChanges);
  }, [isOpen, item, title, icon, color, viewMode, isPinned, showChildrenInSidebar, tags, onDirtyChange, isReadOnly]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    onSave({
      title: isReadOnly ? (item?.title ?? title.trim()) : title.trim(),
      icon,
      color,
      parentId: item?.parentId ?? null,
      viewMode: isReadOnly ? item?.viewMode : viewMode,
      isPinned,
      showChildrenInSidebar,
      tags,
    });
    onDirtyChange?.(false);
    onClose();
  };

  const handleCancel = () => {
    onDirtyChange?.(false);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  const handleSelectEmoji = (emoji: string | null) => {
    setIcon(emoji);
  };

  const handleSelectColor = (newColor: string) => {
    setColor(newColor);
    // Icon is preserved - user can have both color and icon
  };

  // Render the current icon preview
  const renderIconPreview = () => {
    if (icon) {
      // Render Lucide icon by name
      return <LucideIcon name={icon} className="w-7 h-7" style={{ color: color || '#64748b' }} />;
    }
    // For pages, choose default based on viewMode
    if (itemType === 'page') {
      switch (viewMode) {
        case 'collection':
          return <StylizedCollectionIcon color={color} size="lg" />;
        case 'tasks':
          return <StylizedTaskIcon color={color} size="lg" />;
        case 'note':
        default:
          return <StylizedNoteIcon color={color} size="lg" />;
      }
    }

    // Default page icon
    return <StylizedTaskIcon color={color} size="lg" />;
  };

  if (!isOpen) return null;

  // Get the selected color name for display
  const selectedColorName = PRESET_COLORS.find(c => c.color === color)?.name || 'Custom';

  // Form actions with glass/glow styling (matches AddTaskForm)
  const formActions = (
    <ModalFooter
      onCancel={handleCancel}
      onSubmit={() => {}} // Handled by form onSubmit
      onDelete={isEditing && onDelete ? handleDelete : undefined}
      submitLabel={isEditing ? 'Save' : 'Create'}
      submitDisabled={!title.trim()}
      formId="item-properties-form"
    />
  );

  // Page type display for the properties sidebar
  const getPageTypeLabel = () => {
    switch (viewMode) {
      case 'note': return 'Note';
      case 'collection': return 'Collection';
      case 'tasks': return 'Tasks';
      default: return 'Note';
    }
  };

  // Mobile: Uses a flat form layout
  if (isMobile) {
    const mobileFormContent = (
      <form id="item-properties-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Icon Preview + Title Row */}
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border-default)] transition-all flex-shrink-0"
            style={{ 
              borderColor: !icon ? `${color}40` : undefined,
              backgroundColor: !icon ? `${color}10` : undefined,
            }}
          >
            {renderIconPreview()}
          </div>
          <div className="flex-1">
            <Input
              id="item-title"
              type="text"
              value={title}
              onChange={(e) => !isReadOnly && setTitle(e.target.value)}
              placeholder={`${itemLabel} name...`}
              autoFocus
              readOnly={isReadOnly}
              className="text-lg font-semibold border-0 bg-transparent px-0 focus:ring-0 placeholder:text-[var(--color-text-tertiary)]"
            />
          </div>
          {isEditing && onMove && (
            <button
              type="button"
              onClick={() => { onClose(); onMove(); }}
              className="flex-shrink-0 p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
              title="Move to another parent"
            >
              <FolderInput className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Properties Section */}
        <div className="w-auto -mx-4 px-4 py-4 border-t border-[var(--color-border-default)] mt-4">
          <div className="px-1 mb-3 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">Properties</div>
          
          <div className="flex flex-col gap-2">
            {/* Color */}
            <div className="relative">
              <PropertyRow
                label="Color"
                icon={
                  <div
                    className="w-4 h-4 rounded-full border border-white/50 shadow-sm"
                    style={{ backgroundColor: color || '#3b82f6' }}
                  />
                }
                value={selectedColorName}
                onClick={() => { setShowColorPicker(!showColorPicker); setShowIconPicker(false); }}
                active={showColorPicker}
              />
              {showColorPicker && (
                <MobileSheet isOpen={showColorPicker} onClose={() => setShowColorPicker(false)} title="Select Color">
                  <div className="p-4 grid grid-cols-6 gap-3">
                    {PRESET_COLORS.map(({ color: c, name }) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => { handleSelectColor(c); setShowColorPicker(false); }}
                        className={cn(
                          "w-10 h-10 rounded-xl transition-all",
                          color === c && "ring-2 ring-offset-2 ring-[var(--color-text-primary)] ring-offset-[var(--color-surface-base)]"
                        )}
                        style={{ backgroundColor: c }}
                        title={name}
                      >
                        {color === c && (
                          <svg className="w-5 h-5 m-auto text-white drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </MobileSheet>
              )}
            </div>

            {/* Icon */}
            <div className="relative">
              <PropertyRow
                label="Icon"
                icon={icon ? <LucideIcon name={icon} className="w-4 h-4" style={{ color: color || '#6b7280' }} /> : <Sparkles className="w-4 h-4" />}
                value={icon ? icon : undefined}
                onClick={() => { setShowIconPicker(!showIconPicker); setShowColorPicker(false); }}
                active={showIconPicker}
              />
              {showIconPicker && (
                <MobileSheet isOpen={showIconPicker} onClose={() => setShowIconPicker(false)} title="Select Icon">
                  <div className="p-4">
                    <IconPicker
                      selectedIcon={icon}
                      onChange={(iconName) => {
                        handleSelectEmoji(iconName);
                        setShowIconPicker(false);
                      }}
                      allowClear
                      previewColor={color || undefined}
                    />
                  </div>
                </MobileSheet>
              )}
            </div>

            {/* Page Mode */}
            {!isReadOnly && <div className="relative">
              <div className="px-1 mt-3 mb-2 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">Page mode</div>
              <PageModeToggle
                currentMode={(viewMode as 'note' | 'collection' | 'tasks') || 'note'}
                onModeChange={(mode) => setViewMode(mode)}
                childCount={item?.childCount ?? 0}
                taskCount={item?.taskCount ?? 0}
                variant="card"
              />
            </div>}

            {/* Favorite */}
            {isEditing && (
              <>
                <PropertyRow
                  label="Pin as favorite"
                  icon={<Pin className={cn("w-4 h-4", isPinned && "rotate-45")} />}
                  value={isPinned ? 'On' : 'Off'}
                  onClick={() => setIsPinned(!isPinned)}
                  active={isPinned}
                />
                <PropertyRow
                  label="Show Subpages"
                  icon={<FolderInput className="w-4 h-4" />}
                  value={showChildrenInSidebar ? 'On' : 'Off'}
                  onClick={() => setShowChildrenInSidebar(!showChildrenInSidebar)}
                  active={showChildrenInSidebar}
                />
                <div className="px-1 mt-4 mb-2 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">Tags</div>
                <div className="relative">
                  <div className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all group border",
                    tags
                      ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/20"
                      : "hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border-transparent"
                  )}>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <div className={cn("transition-colors", tags ? "text-[var(--color-accent-primary)]" : "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-primary)]")}>
                        <Tag className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium">Tags</span>
                    </div>
                    <div className="flex-1 flex items-center justify-end ml-4 min-w-0">
                      <InlineTagInput
                        value={tags}
                        onChange={setTags}
                        existingTags={item?.existingTags || []}
                        placeholder="Add tags..."
                        isMulti={true}
                        className="!border-0 !bg-transparent !p-0 !shadow-none justify-end text-sm"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {formActions}
      </form>
    );

    return (
      <MobileSheet
        isOpen={isOpen}
        onClose={handleCancel}
        title={isEditing ? `Edit ${itemLabel}` : `Create ${itemLabel}`}
        maxHeight="90vh"
      >
        <div className="p-4">
          {mobileFormContent}
        </div>
      </MobileSheet>
    );
  }

  // Desktop: Split panel layout (like AddTaskForm)
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={isEditing ? `Edit ${itemLabel}` : `Create ${itemLabel}`}
      size="2xl"
      footer={formActions}
    >
      <form id="item-properties-form" onSubmit={handleSubmit}>
        <div className="flex flex-row gap-0 items-stretch min-h-[300px]">
          {/* Left Column: Icon Preview + Title */}
          <div className="w-1/2 flex flex-col py-4 pr-4 pl-0">
            <div className="flex-1">
              {/* Large Icon Preview */}
              <div className="flex flex-col items-center justify-center mb-6 pt-4">
                <div 
                  className="w-20 h-20 flex items-center justify-center rounded-2xl bg-[var(--color-surface-secondary)] border-2 border-[var(--color-border-default)] transition-all"
                  style={{ 
                    borderColor: !icon ? `${color}40` : undefined,
                    backgroundColor: !icon ? `${color}10` : undefined,
                  }}
                >
                  <div className="scale-150">{renderIconPreview()}</div>
                </div>
              </div>

              {/* Title Input - Textarea for multiline */}
              <div className="mb-4">
                <textarea
                  id="item-title"
                  value={title}
                  onChange={(e) => !isReadOnly && setTitle(e.target.value)}
                  onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                  placeholder={`${itemLabel} name...`}
                  autoFocus
                  rows={2}
                  readOnly={isReadOnly}
                  className="w-full text-xl font-bold text-center border-0 bg-transparent focus:ring-0 focus:outline-none focus:border-0 placeholder:text-[var(--color-text-tertiary)] resize-none"
                />
              </div>

              {/* Move button */}
              {isEditing && onMove && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => { onClose(); onMove(); }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)] transition-colors"
                  >
                    <FolderInput className="w-4 h-4" />
                    <span>Move to...</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Properties (Panel) */}
          <Panel 
            padding="none" 
            shadow="sm"
            className="w-1/2 border-l border-[var(--color-border-default)] rounded-2xl bg-[var(--color-surface-inset)]"
          >
            <div className="space-y-1 h-full p-4">
              <div className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">Properties</div>
              
              {/* Color */}
              <div className="relative" ref={colorPickerRef}>
                <PropertyRow
                  label="Color"
                  icon={
                    <div
                      className="w-4 h-4 rounded-full border border-white/50 shadow-sm"
                      style={{ backgroundColor: color || '#3b82f6' }}
                    />
                  }
                  value={selectedColorName}
                  onClick={() => { setShowColorPicker(!showColorPicker); setShowIconPicker(false); }}
                  active={showColorPicker}
                />
                {showColorPicker && (
                  <Popover width="xl" position="left" className="p-3">
                    <div className="grid grid-cols-6 gap-2">
                      {PRESET_COLORS.map(({ color: c, name }) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => { handleSelectColor(c); setShowColorPicker(false); }}
                          className={cn(
                            "w-8 h-8 rounded-lg transition-all hover:scale-110",
                            color === c && "ring-2 ring-offset-2 ring-[var(--color-text-primary)] ring-offset-[var(--color-surface-base)]"
                          )}
                          style={{ backgroundColor: c }}
                          title={name}
                        >
                          {color === c && (
                            <svg className="w-4 h-4 m-auto text-white drop-shadow-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </Popover>
                )}
              </div>

              {/* Icon */}
              <div className="relative" ref={iconPickerRef}>
                <PropertyRow
                  label="Icon"
                  icon={icon ? <LucideIcon name={icon} className="w-4 h-4" style={{ color: color || '#6b7280' }} /> : <Sparkles className="w-4 h-4" />}
                  value={icon ? icon : undefined}
                  onClick={() => { setShowIconPicker(!showIconPicker); setShowColorPicker(false); }}
                  active={showIconPicker}
                />
                {showIconPicker && (
                  <Popover width="2xl" position="left" className="p-3 w-80">
                    <IconPicker
                      selectedIcon={icon}
                      onChange={(iconName) => {
                        handleSelectEmoji(iconName);
                        if (iconName === null) {
                          setShowIconPicker(false);
                        }
                      }}
                      allowClear
                      previewColor={color || undefined}
                    />
                  </Popover>
                )}
              </div>

              {/* Page Mode */}
              {!isReadOnly && <div className="mt-3">
                <div className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">Page mode</div>
                <div className="px-1">
                  <PageModeToggle
                    currentMode={(viewMode as 'note' | 'collection' | 'tasks') || 'note'}
                    onModeChange={(mode) => setViewMode(mode)}
                    childCount={item?.childCount ?? 0}
                    taskCount={item?.taskCount ?? 0}
                    variant="card"
                  />
                </div>
              </div>}

              {/* Sidebar Options (edit mode only) */}
              {isEditing && (
                <div className="mt-3">
                  <div className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">Sidebar</div>
                  <PropertyRow
                    label="Pin as favorite"
                    icon={<Pin className={cn("w-4 h-4", isPinned && "rotate-45")} />}
                    value={isPinned ? 'On' : 'Off'}
                    onClick={() => setIsPinned(!isPinned)}
                    active={isPinned}
                  />
                  <PropertyRow
                    label="Show Subpages"
                    icon={<FolderInput className="w-4 h-4" />}
                    value={showChildrenInSidebar ? 'On' : 'Off'}
                    onClick={() => setShowChildrenInSidebar(!showChildrenInSidebar)}
                    active={showChildrenInSidebar}
                  />
                </div>
              )}
              {isEditing && (
                <div className="mt-3">
                  <div className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">Tags</div>
                  <div className="relative">
                    <div className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all group border",
                      tags
                        ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/20"
                        : "hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border-transparent"
                    )}>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className={cn("transition-colors", tags ? "text-[var(--color-accent-primary)]" : "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-primary)]")}>
                          <Tag className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium">Tags</span>
                      </div>
                      <div className="flex-1 flex items-center justify-end ml-4 min-w-0">
                        <InlineTagInput
                          value={tags}
                          onChange={setTags}
                          existingTags={item?.existingTags || []}
                          placeholder="Add tags..."
                          isMulti={true}
                          className="!border-0 !bg-transparent !p-0 !shadow-none justify-end text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </form>
    </Modal>
  );
};

export default ItemPropertiesModal;
