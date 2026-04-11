/**
 * @file SavedViewsBar.tsx
 * @description Saved views pills and add button for pages
 * @app PAGES - Used by task pages and collection pages
 * 
 * Displays saved view presets as pills that can be clicked to apply.
 * Saved views are stored directly on the page object.
 */
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/design-system';
import { Plus, MoreHorizontal, Trash2, Check, Edit2, Settings, Layout as LayoutIcon, Filter, AlertTriangle, Tag, CalendarDays, CheckSquare, Layers } from 'lucide-react';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { LucideIcon, ContextMenu, type ContextMenuItem } from '@/components/ui';
import { ListViewIcon, KanbanViewIcon, TableViewIcon } from '../common/Icons';
import type { PageSavedView, TaskViewConfig, CollectionViewConfig } from '@/types/savedView';
import { generateSavedViewId } from '@/types/savedView';
import type { Page } from '@/types/page';
import type { TaskFilterOptions, PageFilterOptions } from '@/types/view';
import { DEFAULT_TASK_FILTER_OPTIONS, DEFAULT_PAGE_FILTER_OPTIONS, isDefaultTaskFilterOptions, isDefaultPageFilterOptions } from '@/types/view';
import { Modal, ModalFooter, PropertyRow, Input, ColorPicker, IconPicker, Panel, Popover, MobileSheet, TagBadge } from './index';

// ============================================================================
// Types
// ============================================================================

interface SavedViewsBarProps {
  /** The page containing saved views */
  page: Page;
  /** 
   * Callback to update the page (saves changes to backend).
   * When a view is selected, includes the config to apply so parent can batch updates.
   */
  onUpdatePage: (
    updates: { savedViews?: PageSavedView[]; activeSavedViewId?: string | null },
    /** Optional config to apply - allows parent to batch view config with saved view update */
    configToApply?: TaskViewConfig | CollectionViewConfig | null
  ) => void;
  /** Current view configuration to save when creating new view */
  currentConfig: TaskViewConfig | CollectionViewConfig;
  /** All existing tags for tag filter suggestions */
  existingTags?: string[];
  /** Optional class name */
  className?: string;
}

// ============================================================================
// Pill Component
// ============================================================================

interface ViewPillProps {
  view: PageSavedView;
  isActive: boolean;
  isModified?: boolean;
  onClick: () => void;
  onDelete: () => void;
  onUpdate?: () => void;
  onEdit?: () => void;
}

const ViewPill: React.FC<ViewPillProps> = React.memo(({ view, isActive, isModified, onClick, onDelete, onUpdate, onEdit }) => {
  const contextMenuItems = useMemo((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    if (isActive && isModified && onUpdate) {
      items.push({
        id: 'save-changes',
        label: 'Save changes',
        icon: <Check className="w-4 h-4" />,
        onClick: onUpdate,
      });
    }

    items.push({
      id: 'edit',
      label: 'Edit',
      icon: <Edit2 className="w-4 h-4" />,
      divider: items.length > 0,
      onClick: () => onEdit?.(),
    });

    items.push({
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      variant: 'danger' as const,
      divider: true,
      onClick: onDelete,
    });

    return items;
  }, [isActive, isModified, onUpdate, onEdit, onDelete]);
  
  return (
    <ContextMenu items={contextMenuItems}>
      <div className="group relative flex items-center gap-0.5">
        <button
          onClick={onClick}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all',
            'border',
            isActive
              ? 'bg-[var(--color-interactive-bg)] border-[var(--color-interactive-border)] text-[var(--color-interactive-text)]'
              : 'bg-[var(--color-surface-base)] border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-subtle)]'
          )}
        >
          {view.icon && (
            <LucideIcon name={view.icon} className="w-3.5 h-3.5" />
          )}
          <span>{view.name}</span>
          {/* Fixed width container for checkmark/settings - shows settings on hover for all states */}
          <div className="w-4 h-4 flex items-center justify-center ml-0.5 relative">
            {/* Default state: checkmark when active, nothing when inactive */}
            <div className="group-hover:opacity-0 transition-opacity">
              {isActive && !isModified && (
                <Check className="w-3 h-3" />
              )}
              {isActive && isModified && (
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-interactive-bg-strong)] animate-pulse" title="Modified" />
              )}
            </div>
            {/* Hover state: settings icon for all pills */}
            <Settings 
              className="w-3 h-3 absolute inset-0 m-auto opacity-0 group-hover:opacity-60 transition-opacity cursor-pointer hover:opacity-100" 
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
            />
          </div>
        </button>
      </div>
    </ContextMenu>
  );
});
ViewPill.displayName = 'ViewPill';

// ============================================================================
// View Editor Modal
// ============================================================================

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

interface ViewEditorModalProps {
  initialName?: string;
  initialIcon?: string | null;
  initialColor?: string | null;
  title: string;
  config: TaskViewConfig | CollectionViewConfig;
  onSave: (name: string, icon: string | null, color: string | null, config: TaskViewConfig | CollectionViewConfig) => void;
  onClose: () => void;
  onDelete?: () => void;
  /** All existing tags for tag filter suggestions */
  existingTags?: string[];
}

/** Summarize filter state for display in PropertyRow */
function getFilterSummary(config: TaskViewConfig | CollectionViewConfig): string {
  if ('showCompleted' in config) {
    // Task config
    const opts = config.filterOptions;
    if (!opts || isDefaultTaskFilterOptions(opts)) return 'None';
    const parts: string[] = [];
    if (opts.priorities.length > 0) parts.push(`${opts.priorities.join(', ')} priority`);
    if (opts.tags.length > 0) parts.push(`${opts.tags.length} tag${opts.tags.length > 1 ? 's' : ''}`);
    if (opts.dueDateFilter !== 'all') {
      const labels: Record<string, string> = { has_due: 'Has due date', no_due: 'No due date', overdue: 'Overdue' };
      parts.push(labels[opts.dueDateFilter] || opts.dueDateFilter);
    }
    return parts.join(', ') || 'None';
  } else {
    // Collection config
    const opts = (config as CollectionViewConfig).filterOptions;
    if (!opts || isDefaultPageFilterOptions(opts)) return 'None';
    const parts: string[] = [];
    if (opts.filterBy !== 'all') parts.push(opts.filterBy.charAt(0).toUpperCase() + opts.filterBy.slice(1));
    if (opts.tags.length > 0) parts.push(`${opts.tags.length} tag${opts.tags.length > 1 ? 's' : ''}`);
    return parts.join(', ') || 'None';
  }
}

/** Filter editing sub-component for ViewEditorModal */
const FilterEditor: React.FC<{
  config: TaskViewConfig | CollectionViewConfig;
  onChange: (config: TaskViewConfig | CollectionViewConfig) => void;
  /** All existing tags for tag filter suggestions */
  existingTags?: string[];
}> = ({ config, onChange, existingTags = [] }) => {
  const isTask = 'showCompleted' in config;
  // Track which popover is open (mutual exclusion)
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside the filter editor
  useEffect(() => {
    if (!openPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPopover(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openPopover]);
  
  if (isTask) {
    const taskConfig = config as TaskViewConfig;
    const opts = taskConfig.filterOptions || DEFAULT_TASK_FILTER_OPTIONS;
    
    const togglePriority = (p: 'High' | 'Medium' | 'Low') => {
      const newPriorities = opts.priorities.includes(p) 
        ? opts.priorities.filter(x => x !== p) 
        : [...opts.priorities, p];
      onChange({ ...taskConfig, filterOptions: { ...opts, priorities: newPriorities } });
    };
    
    const cycleDueDate = () => {
      const options: TaskFilterOptions['dueDateFilter'][] = ['all', 'has_due', 'no_due', 'overdue'];
      const idx = options.indexOf(opts.dueDateFilter);
      setOpenPopover(null);
      onChange({ ...taskConfig, filterOptions: { ...opts, dueDateFilter: options[(idx + 1) % options.length] } });
    };

    const clearFilters = () => {
      setOpenPopover(null);
      onChange({ ...taskConfig, filterOptions: { ...DEFAULT_TASK_FILTER_OPTIONS } });
    };

    const toggleTaskTag = (tag: string) => {
      const current = opts.tags;
      const next = current.includes(tag) ? current.filter(x => x !== tag) : [...current, tag];
      onChange({ ...taskConfig, filterOptions: { ...opts, tags: next } });
    };

    return (
      <div className="space-y-2" ref={containerRef}>
        {/* Priority filter */}
        <div className="relative">
          <PropertyRow
            label="Priority"
            icon={<AlertTriangle className="w-4 h-4" />}
            value={opts.priorities.length === 0 ? 'All' : opts.priorities.join(', ')}
            onClick={() => setOpenPopover(openPopover === 'priority' ? null : 'priority')}
            active={openPopover === 'priority'}
          />
          {openPopover === 'priority' && (
            <Popover width="md" position="left" padding="sm">
              <div className="space-y-0.5">
                {(['High', 'Medium', 'Low'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePriority(p)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-1.5 text-sm rounded-md transition-colors',
                      opts.priorities.includes(p)
                        ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)] font-medium'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                    )}
                  >
                    <span>{p}</span>
                    {opts.priorities.includes(p) && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </Popover>
          )}
        </div>

        {/* Tag filter */}
        {existingTags.length > 0 && (
          <div className="relative">
            <PropertyRow
              label="Tags"
              icon={<Tag className="w-4 h-4" />}
              value={opts.tags.length === 0 ? 'All' : `${opts.tags.length} selected`}
              onClick={() => setOpenPopover(openPopover === 'tags' ? null : 'tags')}
              active={openPopover === 'tags'}
            />
            {openPopover === 'tags' && (
              <Popover width="lg" position="left" padding="sm">
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                  {existingTags.map(tag => (
                    <TagBadge
                      key={tag}
                      tag={tag}
                      compact
                      onClick={() => toggleTaskTag(tag)}
                      className={cn(
                        'cursor-pointer transition-opacity',
                        opts.tags.includes(tag) ? 'ring-2 ring-[var(--color-interactive-bg-strong)] ring-offset-1' : 'opacity-70 hover:opacity-100'
                      )}
                    />
                  ))}
                </div>
              </Popover>
            )}
          </div>
        )}
        
        {/* Due date filter */}
        <PropertyRow
          label="Due Date"
          icon={<CalendarDays className="w-4 h-4" />}
          value={opts.dueDateFilter === 'all' ? 'All' : opts.dueDateFilter === 'has_due' ? 'Has due date' : opts.dueDateFilter === 'no_due' ? 'No due date' : 'Overdue'}
          onClick={cycleDueDate}
        />

        {/* Show completed */}
        <PropertyRow
          label="Show Completed"
          icon={<CheckSquare className="w-4 h-4" />}
          value={taskConfig.showCompleted ? 'Yes' : 'No'}
          onClick={() => { setOpenPopover(null); onChange({ ...taskConfig, showCompleted: !taskConfig.showCompleted }); }}
        />
        
        {/* Clear all filters */}
        {!isDefaultTaskFilterOptions(opts) && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  } else {
    const collConfig = config as CollectionViewConfig;
    const opts = collConfig.filterOptions || DEFAULT_PAGE_FILTER_OPTIONS;
    
    const cycleFilterBy = () => {
      const options: PageFilterOptions['filterBy'][] = ['all', 'notes', 'collections', 'tasks'];
      const idx = options.indexOf(opts.filterBy);
      setOpenPopover(null);
      onChange({ ...collConfig, filterOptions: { ...opts, filterBy: options[(idx + 1) % options.length] } });
    };

    const clearFilters = () => {
      setOpenPopover(null);
      onChange({ ...collConfig, filterOptions: { ...DEFAULT_PAGE_FILTER_OPTIONS } });
    };

    const toggleTag = (tag: string) => {
      const current = opts.tags;
      const next = current.includes(tag) ? current.filter(x => x !== tag) : [...current, tag];
      onChange({ ...collConfig, filterOptions: { ...opts, tags: next } });
    };
    
    return (
      <div className="space-y-2" ref={containerRef}>
        <PropertyRow
          label="Type Filter"
          icon={<Layers className="w-4 h-4" />}
          value={opts.filterBy === 'all' ? 'All types' : opts.filterBy.charAt(0).toUpperCase() + opts.filterBy.slice(1)}
          onClick={cycleFilterBy}
        />

        {/* Tag filter */}
        {existingTags.length > 0 && (
          <div className="relative">
            <PropertyRow
              label="Tags"
              icon={<Tag className="w-4 h-4" />}
              value={opts.tags.length === 0 ? 'All' : `${opts.tags.length} selected`}
              onClick={() => setOpenPopover(openPopover === 'tags' ? null : 'tags')}
              active={openPopover === 'tags'}
            />
            {openPopover === 'tags' && (
              <Popover width="lg" position="left" padding="sm">
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                  {existingTags.map(tag => (
                    <TagBadge
                      key={tag}
                      tag={tag}
                      compact
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        'cursor-pointer transition-opacity',
                        opts.tags.includes(tag) ? 'ring-2 ring-[var(--color-interactive-bg-strong)] ring-offset-1' : 'opacity-70 hover:opacity-100'
                      )}
                    />
                  ))}
                </div>
              </Popover>
            )}
          </div>
        )}
        
        {!isDefaultPageFilterOptions(opts) && (
          <button
            type="button"
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  }
};

const ViewEditorModal: React.FC<ViewEditorModalProps> = ({ 
  initialName = '', 
  initialIcon = 'Bookmark', 
  initialColor = '#3b82f6',
  title,
  config,
  onSave, 
  onClose,
  onDelete,
  existingTags = [],
}) => {
  const isMobile = useIsMobile();
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState<string | null>(initialIcon);
  const color = initialColor || '#3b82f6'; // Color is now read-only, not editable
  const [localConfig, setLocalConfig] = useState(config);
  const [showIconPicker, setShowIconPicker] = useState(false);
  
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), icon, color, localConfig);
      onClose();
    }
  };

  // Mobile layout content
  const mobileContent = (
    <div className="p-4 space-y-4">
      {/* Icon Preview + Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="w-12 h-12 flex items-center justify-center rounded-xl bg-[var(--color-surface-secondary)] border-2 border-[var(--color-border-default)]"
        >
          {icon ? (
            <LucideIcon name={icon} className="w-6 h-6" style={{ color: color || '#64748b' }} />
          ) : (
            <LayoutIcon className="w-6 h-6" style={{ color: color || '#64748b' }} />
          )}
        </button>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="View name..."
          autoFocus
          className="flex-1 text-lg font-semibold border-0 bg-transparent focus:ring-0 placeholder:text-[var(--color-text-tertiary)] text-[var(--color-text-primary)]"
        />
      </div>

      {/* Icon Picker */}
      {showIconPicker && (
        <div className="rounded-xl bg-[var(--color-surface-inset)] p-3">
          <IconPicker
            selectedIcon={icon}
            onChange={(iconName) => {
              setIcon(iconName);
              setShowIconPicker(false);
            }}
            allowClear
            previewColor={color || undefined}
          />
        </div>
      )}

      {/* View Settings */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          View Settings
        </div>
        
        <PropertyRow
          label="Layout"
          icon={localConfig.viewMode === 'kanban' ? <KanbanViewIcon className="w-4 h-4" /> : localConfig.viewMode === 'table' ? <TableViewIcon className="w-4 h-4" /> : <ListViewIcon className="w-4 h-4" />}
          value={localConfig.viewMode === 'kanban' ? 'Gallery' : localConfig.viewMode === 'table' ? 'Table' : 'List'}
          onClick={() => {
            const modes: ('list' | 'kanban' | 'table')[] = ['list', 'kanban', 'table'];
            const currentIndex = modes.indexOf(localConfig.viewMode as any);
            const nextMode = modes[(currentIndex + 1) % modes.length];
            setLocalConfig({ ...localConfig, viewMode: nextMode } as any);
          }}
        />
        
        <PropertyRow
          label="Group By"
          icon={<LayoutIcon className="w-4 h-4" />}
          value={localConfig.groupBy === 'date' ? 'Date' : localConfig.groupBy === 'priority' ? 'Priority' : localConfig.groupBy === 'section' ? 'Section' : 'None'}
          onClick={() => {
            let nextGroupBy: any = 'none';
            if ('showCompleted' in localConfig) {
              const groups: any[] = ['none', 'date', 'priority', 'section'];
              const currentIndex = groups.indexOf(localConfig.groupBy);
              nextGroupBy = groups[(currentIndex + 1) % groups.length];
            } else {
              nextGroupBy = localConfig.groupBy === 'none' ? 'date' : 'none';
            }
            setLocalConfig({ ...localConfig, groupBy: nextGroupBy } as any);
          }}
        />
      </div>

      {/* Filter Settings */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Filters
        </div>
        <FilterEditor config={localConfig} onChange={(c) => setLocalConfig(c)} existingTags={existingTags} />
      </div>

      {/* Actions */}
      <div className="pt-4 space-y-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full py-3 px-4 bg-[var(--color-interactive-bg-strong)] text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save View
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-full py-3 px-4 text-red-600 dark:text-red-400 font-medium rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Delete View
          </button>
        )}
      </div>
    </div>
  );

  // Mobile: Use MobileSheet
  if (isMobile) {
    return (
      <MobileSheet
        isOpen={true}
        onClose={onClose}
        title={title}
      >
        {mobileContent}
      </MobileSheet>
    );
  }

  // Desktop: Use Modal
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={title}
      size="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <div /> // Spacer when no delete button
          )}
          <ModalFooter
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitLabel="Save View"
            submitDisabled={!name.trim()}
          />
        </div>
      }
    >
      <form onSubmit={handleSubmit}>
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
                  <div className="scale-150">
                    {icon ? (
                      <LucideIcon name={icon} className="w-7 h-7" style={{ color: color || '#64748b' }} />
                    ) : (
                      <LayoutIcon className="w-7 h-7" style={{ color: color || '#64748b' }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Title Input */}
              <div className="mb-4">
                <textarea
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                  placeholder="View name..."
                  autoFocus
                  rows={2}
                  className="w-full text-xl font-bold text-center border-0 bg-transparent focus:ring-0 focus:outline-none focus:border-0 placeholder:text-[var(--color-text-tertiary)] resize-none text-[var(--color-text-primary)]"
                />
              </div>
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
              
              {/* Icon */}
              <div className="relative">
                <PropertyRow
                  label="Icon"
                  icon={icon ? <LucideIcon name={icon} className="w-4 h-4" style={{ color: color || '#6b7280' }} /> : <LayoutIcon className="w-4 h-4" />}
                  value={icon || undefined}
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  active={showIconPicker}
                />
                {showIconPicker && (
                  <Popover width="2xl" position="left" className="p-3 w-80">
                    <IconPicker
                      selectedIcon={icon}
                      onChange={(iconName) => {
                        setIcon(iconName);
                        if (iconName === null) setShowIconPicker(false);
                      }}
                      allowClear
                      previewColor={color || undefined}
                    />
                  </Popover>
                )}
              </div>

              <div className="mt-3">
                <div className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">View Settings</div>
                
                <PropertyRow
                  label="Layout"
                  icon={localConfig.viewMode === 'kanban' ? <KanbanViewIcon className="w-4 h-4" /> : localConfig.viewMode === 'table' ? <TableViewIcon className="w-4 h-4" /> : <ListViewIcon className="w-4 h-4" />}
                  value={localConfig.viewMode === 'kanban' ? 'Gallery' : localConfig.viewMode === 'table' ? 'Table' : 'List'}
                  onClick={() => {
                    const modes: ('list' | 'kanban' | 'table')[] = ['list', 'kanban', 'table'];
                    const currentIndex = modes.indexOf(localConfig.viewMode as any);
                    const nextMode = modes[(currentIndex + 1) % modes.length];
                    setLocalConfig({ ...localConfig, viewMode: nextMode } as any);
                  }}
                />
                
                <PropertyRow
                  label="Group By"
                  icon={<LayoutIcon className="w-4 h-4" />}
                  value={localConfig.groupBy === 'date' ? 'Date' : localConfig.groupBy === 'priority' ? 'Priority' : localConfig.groupBy === 'section' ? 'Section' : 'None'}
                  onClick={() => {
                    let nextGroupBy: any = 'none';
                    if ('showCompleted' in localConfig) {
                      // Task config
                      const groups: any[] = ['none', 'date', 'priority', 'section'];
                      const currentIndex = groups.indexOf(localConfig.groupBy);
                      nextGroupBy = groups[(currentIndex + 1) % groups.length];
                    } else {
                      // Collection config
                      nextGroupBy = localConfig.groupBy === 'none' ? 'date' : 'none';
                    }
                    setLocalConfig({ ...localConfig, groupBy: nextGroupBy } as any);
                  }}
                />
              </div>

              {/* Filter Settings */}
              <div className="mt-3">
                <div className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-disabled)] uppercase tracking-widest">Filters</div>
                <FilterEditor config={localConfig} onChange={(c) => setLocalConfig(c)} existingTags={existingTags} />
              </div>
            </div>
          </Panel>
        </div>
      </form>
    </Modal>
  );
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Deep equality check for view configurations.
 * Handles nested objects and arrays (e.g., filterOptions with priorities/tags arrays).
 */
const isConfigEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item: any, i: number) => isConfigEqual(item, b[i]));
  }
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => isConfigEqual(a[key], b[key]));
  }
  return a === b;
};

// Export ViewEditorModal for use in other components (e.g., mobile sheet)
export { ViewEditorModal };
export type { ViewEditorModalProps };

export const SavedViewsBar: React.FC<SavedViewsBarProps> = React.memo(({
  page,
  onUpdatePage,
  currentConfig,
  existingTags = [],
  className,
}) => {
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [editingView, setEditingView] = useState<PageSavedView | null>(null);
  
  const savedViews = page.savedViews || [];
  const activeViewId = page.activeSavedViewId;
  const activeView = savedViews.find(v => v.id === activeViewId);
  
  // Check if current config differs from active view config
  const isModified = activeView && !isConfigEqual(activeView.config, currentConfig);
  
  // Auto-save changes when modified
  useEffect(() => {
    if (isModified && activeView) {
      const timer = setTimeout(() => {
        const newViews = savedViews.map(v => 
          v.id === activeView.id 
            ? { ...v, config: currentConfig } 
            : v
        );
        onUpdatePage({ savedViews: newViews });
      }, 1000); // 1s debounce for auto-save
      
      return () => clearTimeout(timer);
    }
  }, [isModified, activeView?.id, currentConfig, savedViews, onUpdatePage]);

  // Handle pill click
  const handlePillClick = useCallback((view: PageSavedView) => {
    const isCurrentlyActive = activeViewId === view.id;
    
    if (isCurrentlyActive) {
      // Deactivate - go back to default (pass null config to indicate deselection)
      onUpdatePage({ activeSavedViewId: null }, null);
    } else {
      // Activate this view - pass config so parent can batch the update
      onUpdatePage({ activeSavedViewId: view.id }, view.config);
    }
  }, [activeViewId, onUpdatePage]);
  
  // Handle delete
  const handleDelete = useCallback((view: PageSavedView) => {
    const newViews = savedViews.filter(v => v.id !== view.id);
    const updates: { savedViews: PageSavedView[]; activeSavedViewId?: string | null } = { 
      savedViews: newViews 
    };
    
    // If this was the active view, clear selection
    if (activeViewId === view.id) {
      updates.activeSavedViewId = null;
    }
    
    // Pass null config since we're just deleting
    onUpdatePage(updates, null);
  }, [savedViews, activeViewId, onUpdatePage]);

  // Handle update existing view config
  const handleUpdateViewConfig = useCallback(() => {
    if (!activeView) return;
    
    const newViews = savedViews.map(v => 
      v.id === activeView.id 
        ? { ...v, config: currentConfig } 
        : v
    );
    
    onUpdatePage({ savedViews: newViews });
  }, [savedViews, activeView, currentConfig, onUpdatePage]);

  // Handle rename/icon/color change
  const handleRenameView = useCallback((name: string, icon: string | null, color: string | null, config: TaskViewConfig | CollectionViewConfig) => {
    if (!editingView) return;
    
    const newViews = savedViews.map(v => 
      v.id === editingView.id 
        ? { ...v, name, icon, color, config } 
        : v
    );
    
    // If editing the active view, also apply the updated config to live state
    const isEditingActiveView = activeViewId === editingView.id;
    onUpdatePage(
      { savedViews: newViews },
      isEditingActiveView ? config : undefined
    );
    setEditingView(null);
  }, [savedViews, editingView, activeViewId, onUpdatePage]);
  
  // Handle add new
  const handleAddNew = useCallback((name: string, icon: string | null, color: string | null, config: TaskViewConfig | CollectionViewConfig) => {
    const newView: PageSavedView = {
      id: generateSavedViewId(),
      name,
      order: savedViews.length,
      icon,
      color,
      config,
    };
    
    const newViews = [...savedViews, newView];
    
    // Save and activate the new view - pass config so parent can batch the update
    onUpdatePage({ 
      savedViews: newViews,
      activeSavedViewId: newView.id 
    }, newView.config);
  }, [savedViews, onUpdatePage]);
  
  return (
    <>
      <div className={cn('flex items-center gap-1.5 flex-wrap', className)}>
        {savedViews.map((view) => (
          <div key={view.id} className="group">
            <ViewPill
              view={view}
              isActive={activeViewId === view.id}
              isModified={activeViewId === view.id ? isModified : false}
              onClick={() => handlePillClick(view)}
              onDelete={() => handleDelete(view)}
              onUpdate={handleUpdateViewConfig}
              onEdit={() => setEditingView(view)}
            />
          </div>
        ))}
        
        {/* Add button */}
        <button
          onClick={() => setShowAddPopover(true)}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-all',
            'border border-dashed border-[var(--color-border-default)]',
            'text-[var(--color-text-secondary)]',
            'hover:border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]'
          )}
          title="Save current view"
        >
          <Plus className="w-4 h-4" />
          <span>Save View</span>
        </button>
      </div>
      
      {showAddPopover && (
        <ViewEditorModal
          title="Save Current View"
          config={currentConfig}
          onSave={handleAddNew}
          onClose={() => setShowAddPopover(false)}
          existingTags={existingTags}
        />
      )}

      {editingView && (
        <ViewEditorModal
          title="Edit View"
          initialName={editingView.name}
          initialIcon={editingView.icon}
          initialColor={editingView.color}
          config={editingView.config}
          onSave={handleRenameView}
          onClose={() => setEditingView(null)}
          onDelete={() => handleDelete(editingView)}
          existingTags={existingTags}
        />
      )}
    </>
  );
});

SavedViewsBar.displayName = 'SavedViewsBar';

export default SavedViewsBar;
