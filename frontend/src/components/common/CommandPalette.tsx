/**
 * @file CommandPalette.tsx
 * @description Global command palette / search modal (Cmd+K / Ctrl+K)
 * @app SHARED - Quick access to search, navigation, and actions
 * 
 * Features:
 * - Full-text search across tasks and pages
 * - Local-first search: shows local store matches instantly while FTS runs
 * - Quick actions (create task, create note, etc.)
 * - Keyboard navigation (arrows, enter, escape)
 * - Extensible command system
 * - Selection mode: can be used as a picker for internal links
 * 
 * Similar to Notion's Cmd+K or VS Code's Command Palette
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from '@tanstack/react-router';
import { 
  SearchIcon, 
  PlusIcon, 
  CheckIcon, 
  PagesIcon,
  HomeIcon,
  CalendarIcon,
  ClockIcon,
  ListChecksIcon,
  XIcon,
} from '@/components/common/Icons';
import { TaskCheckbox } from '@/components/ui';
import ItemIcon from '@/components/common/ItemIcon';
import MobileDrawer from '@/components/layout/MobileDrawer';
import { useLocalSearch } from '@/hooks/useLocalSearch';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { useTasksStore } from '@/stores/tasksStore';
import { useUIStore } from '@/stores/uiStore';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import { getTodayISO } from '@/lib/dateUtils';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';

// ============================================================================
// TYPES
// ============================================================================

type CommandCategory = 'search' | 'action' | 'navigation' | 'recent';

interface Command {
  id: string;
  category: CommandCategory;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  keywords?: string[];
  onSelect: () => void;
  shortcut?: string;
}

/** Selection result for when used as a picker */
export interface SearchSelection {
  type: 'task' | 'note';
  id: string;
  title: string;
  /** For tasks: completed status */
  completed?: boolean;
  /** For pages: icon emoji */
  icon?: string | null;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  /** 
   * Selection mode: when provided, hides navigation/actions and calls this 
   * callback instead of navigating. Used for InternalLink picker.
   */
  onSelect?: (selection: SearchSelection) => void;
  /** Filter to specific type when in selection mode */
  selectionFilter?: 'task' | 'note' | 'all';
  /** Custom placeholder text */
  placeholder?: string;
  /** Custom title for footer hint */
  footerHint?: string;
}

// ============================================================================
// KEYBOARD SHORTCUT DISPLAY
// ============================================================================
const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl';

const ShortcutBadge: React.FC<{ keys: string }> = ({ keys }) => (
  <span className="flex items-center gap-0.5 text-xs text-[var(--color-text-secondary)]">
    {keys.split('+').map((key, i) => (
      <kbd 
        key={i} 
        className="px-1.5 py-0.5 bg-[var(--color-surface-inset)] rounded text-[10px] font-medium"
      >
        {key === 'Mod' ? modKey : key}
      </kbd>
    ))}
  </span>
);

// ============================================================================
// RESULT ITEM COMPONENT
// ============================================================================
interface ResultItemProps {
  command: Command;
  isSelected: boolean;
  index: number;
  onClick: () => void;
  onMouseEnter: () => void;
}

const ResultItem: React.FC<ResultItemProps> = ({ 
  command, 
  isSelected, 
  index,
  onClick, 
  onMouseEnter 
}) => {
  const isMobile = useIsMobile();
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      data-index={index}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
        isSelected 
          ? 'bg-[var(--color-interactive-bg)] text-[var(--color-interactive-text)]' 
          : 'hover:bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)]'
      }`}
    >
      <span className={`flex-shrink-0 w-5 h-5 ${isSelected ? 'text-[var(--color-interactive-text-strong)]' : 'text-[var(--color-text-secondary)]'}`}>
        {command.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{command.title}</div>
        {command.subtitle && (
          <div className="text-xs text-[var(--color-text-secondary)] truncate">
            {command.subtitle}
          </div>
        )}
      </div>
      {command.shortcut && !isMobile && <ShortcutBadge keys={command.shortcut} />}
    </button>
  );
};

// ============================================================================
// CATEGORY LABEL
// ============================================================================
const CategoryLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
    {children}
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const CommandPalette: React.FC<CommandPaletteProps> = ({ 
  isOpen, 
  onClose,
  onSelect,
  selectionFilter = 'all',
  placeholder,
  footerHint,
}) => {
  // Selection mode is when onSelect is provided
  const isSelectionMode = !!onSelect;
  const isMobile = useIsMobile();
  
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  const createPage = usePagesStore((s: PagesState) => s.createPage);
  const selectPage = usePagesStore((s: PagesState) => s.selectPage);
  const activepageId = usePagesStore((s: PagesState) => s.activePageId);
  const addTask = useTasksStore((s) => s.addTask);
  const createTaskInContext = useUIStore((s) => s.createTaskInContext);
  const openTaskInContext = useUIStore((s) => s.openTaskInContext);
  const pagesById = usePagesStore((s: PagesState) => s.pagesById);
  
  // Determine filter type for search
  const searchFilterType = selectionFilter === 'task' ? 'tasks' : selectionFilter === 'note' ? 'pages' : 'all';
  
  // Use shared local search hook
  const { tasks: mergedTasks, pages: mergedPages, isSearching } = useLocalSearch({
    query,
    filterType: searchFilterType,
    excludeDailyNotes: isSelectionMode, // Exclude daily notes in selection mode
    showOnEmpty: isSelectionMode, // Show results immediately in selection mode
    localLimit: isSelectionMode ? 8 : undefined,
  });
  
  // Wrap in an object for compatibility with existing code
  const mergedResults = useMemo(() => ({
    tasks: mergedTasks,
    pages: mergedPages,
  }), [mergedTasks, mergedPages]);
  
  
  // Animate on open
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    } else {
      setMounted(false);
      const t = setTimeout(() => {
        setShouldRender(false);
        setQuery('');
        setSelectedIndex(0);
      }, 300); // Match desktop transition duration
      return () => clearTimeout(t);
    }
  }, [isOpen]);
  
  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      // Use a small timeout to ensure the modal/drawer animation has started
      // and the element is actually visible and focusable.
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);
  
  // ============================================================================
  // ACTIONS / COMMANDS
  // ============================================================================
  const quickActions = useMemo((): Command[] => [
    {
      id: 'create-task',
      category: 'action',
      icon: <PlusIcon className="w-5 h-5" />,
      title: 'Create new task',
      subtitle: 'Add a task to your inbox',
      keywords: ['add', 'new', 'task', 'todo'],
      shortcut: 'Mod+Shift+T',
      onSelect: () => {
        navigate({ to: '/tasks/$filter', params: { filter: 'inbox' } });
        // Inbox: no defaults (no task page, no date)
        setTimeout(() => createTaskInContext(), 100);
        onClose();
      },
    },
    {
      id: 'create-page',
      category: 'action',
      icon: <PagesIcon className="w-5 h-5" />,
      title: 'Create new page',
      subtitle: 'Start a new page or document',
      keywords: ['add', 'new', 'note', 'page', 'document'],
      shortcut: 'Mod+Shift+N',
      onSelect: () => {
        const newPage = createPage({ title: 'Untitled', viewMode: 'note' });
        selectPage(newPage.id, true);
        navigate({ to: '/pages/$id', params: { id: newPage.id } });
        onClose();
      },
    },
  ], [navigate, createTaskInContext, createPage, selectPage, onClose]);
  
  const navigationCommands = useMemo((): Command[] => [
    {
      id: 'nav-home',
      category: 'navigation',
      icon: <HomeIcon className="w-5 h-5" />,
      title: 'Go to Home',
      keywords: ['home', 'dashboard'],
      onSelect: () => {
        navigate({ to: '/' });
        onClose();
      },
    },
    {
      id: 'nav-today',
      category: 'navigation',
      icon: <CalendarIcon className="w-5 h-5" />,
      title: 'Go to Today',
      subtitle: "View today's tasks",
      keywords: ['today', 'tasks', 'due'],
      onSelect: () => {
        navigate({ to: '/tasks/$filter', params: { filter: 'today' } });
        onClose();
      },
    },
    {
      id: 'nav-upcoming',
      category: 'navigation',
      icon: <ClockIcon className="w-5 h-5" />,
      title: 'Go to Upcoming',
      subtitle: 'View upcoming tasks',
      keywords: ['upcoming', 'scheduled', 'future'],
      onSelect: () => {
        navigate({ to: '/tasks/$filter', params: { filter: 'upcoming' } });
        onClose();
      },
    },
    {
      id: 'nav-pages',
      category: 'navigation',
      icon: <PagesIcon className="w-5 h-5" />,
      title: 'Go to Pages',
      subtitle: 'Browse all pages',
      keywords: ['pages', 'pages', 'documents'],
      onSelect: () => {
        navigate({ to: '/pages' });
        onClose();
      },
    },
    {
      id: 'nav-tasks',
      category: 'navigation',
      icon: <CheckIcon className="w-5 h-5" />,
      title: 'Go to Tasks',
      subtitle: 'View all tasks',
      keywords: ['tasks', 'todos', 'all'],
      onSelect: () => {
        navigate({ to: '/tasks/$filter', params: { filter: 'all' } });
        onClose();
      },
    },
  ], [navigate, onClose]);
  
  // ============================================================================
  // FILTERED / COMBINED RESULTS
  // ============================================================================
  
  // Helper to create selection for a task
  const makeTaskSelection = useCallback((task: Task): SearchSelection => ({
    type: 'task',
    id: task.id,
    title: task.title,
    completed: task.completed,
  }), []);
  
  // Helper to create selection for a page
  const makePageSelection = useCallback((page: Page): SearchSelection => ({
    type: 'note',
    id: page.id,
    title: page.title || 'Untitled',
    icon: page.icon,
  }), []);
  
  const allCommands = useMemo((): Command[] => {
    const commands: Command[] = [];
    const lowerQuery = query.toLowerCase().trim();
    
    // In selection mode, always show results (even without query)
    // In normal mode, only show search results when there's a query
    const showSearchResults = isSelectionMode
      ? (mergedResults.tasks.length > 0 || mergedResults.pages.length > 0)
      : (lowerQuery && (mergedResults.tasks.length > 0 || mergedResults.pages.length > 0));
    
    if (showSearchResults) {
      // Add task results
      mergedResults.tasks.forEach(task => {
        const collectionName = task.parentPageId ? pagesById[task.parentPageId]?.title : undefined;
        
        commands.push({
          id: `task-${task.id}`,
          category: 'search',
          icon: (
            <TaskCheckbox
              completed={task.completed}
              priority={task.priority || 'p4'}
              onChange={() => {}}
              size="sm"
              className="pointer-events-none"
            />
          ),
          title: task.title,
          subtitle: isSelectionMode 
            ? collectionName || 'Task' 
            : (task.completed ? 'Completed task' : (task.dueDate || 'Task')),
          onSelect: () => {
            if (isSelectionMode && onSelect) {
              onSelect(makeTaskSelection(task));
              onClose();
            } else {
              // Open the task in the editing modal
              onClose();
              setTimeout(() => openTaskInContext(task.id), 50);
            }
          },
        });
      });
      
      // Add note results
      mergedResults.pages.forEach(page => {
        commands.push({
          id: `note-${page.id}`,
          category: 'search',
          icon: (
            <ItemIcon
              type="note"
              icon={page.icon}
              color={page.color}
              size="sm"
            />
          ),
          title: page.title || 'Untitled',
          subtitle: page.excerpt || (page.viewMode === 'tasks' ? 'Tasks' : page.viewMode === 'collection' ? 'Collection' : 'Note'),
          onSelect: () => {
            if (isSelectionMode && onSelect) {
              onSelect(makePageSelection(page));
              onClose();
            } else {
              navigate({ to: '/pages/$id', params: { id: page.id } });
              onClose();
            }
          },
        });
      });
    }
    
    // Add "Create new" options when there's a query (both in selection mode and regular mode)
    if (lowerQuery) {
      // Always show create options when there's a query
      const shouldShowCreate = true;
      
      if (shouldShowCreate) {
        // Add "Create new task" option if filter allows tasks
        if (!isSelectionMode || selectionFilter === 'all' || selectionFilter === 'task') {
          commands.push({
            id: 'create-new-task',
            category: 'action',
            icon: (
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                <PlusIcon className="w-4 h-4 text-[var(--color-interactive-text-strong)]" />
              </span>
            ),
            title: `Create task "${query.trim()}"`,
            subtitle: 'New task in inbox',
            onSelect: async () => {
              // Create task immediately and return selection if in selection mode
              const title = query.trim();
              const newTaskId = await addTask({ title });
              if (isSelectionMode && newTaskId && onSelect) {
                onSelect({
                  type: 'task',
                  id: newTaskId,
                  title,
                  completed: false,
                });
              } else if (newTaskId) {
                // Navigate to inbox and open the task modal
                navigate({ to: '/tasks/$filter', params: { filter: 'inbox' } });
                setTimeout(() => openTaskInContext(newTaskId), 100);
              }
              onClose();
            },
          });
        }
        
        // Add "Create new page" option if filter allows pages
        if (!isSelectionMode || selectionFilter === 'all' || selectionFilter === 'note') {
          commands.push({
            id: 'create-new-page',
            category: 'action',
            icon: (
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                <PlusIcon className="w-4 h-4 text-green-500" />
              </span>
            ),
            title: `Create page "${query.trim()}"`,
            subtitle: activepageId ? 'New sub-page' : 'New page',
            onSelect: () => {
              // Create page as subpage if currently viewing a page
              const newPage = createPage({ 
                title: query.trim(), 
                viewMode: 'note',
                parentId: activepageId || undefined,
              });
              
              // Close first, then trigger selection after a tick to ensure
              // the new page is in the store before block insertion
              onClose();
              
              if (isSelectionMode && onSelect) {
                // Small delay to ensure page is in store and editor is ready
                setTimeout(() => {
                  onSelect({
                    type: 'note',
                    id: newPage.id,
                    title: newPage.title,
                    icon: newPage.icon,
                  });
                }, 50);
              } else {
                // Navigate to the new page
                selectPage(newPage.id, true);
                navigate({ to: '/pages/$id', params: { id: newPage.id } });
              }
            },
          });
        }
      }
    }
    
    // In selection mode without query, just return search results
    if (isSelectionMode) {
      return commands;
    }
    
    // Filter quick actions and navigation by query
    const matchesQuery = (cmd: Command): boolean => {
      if (!lowerQuery) return true;
      const titleMatch = cmd.title.toLowerCase().includes(lowerQuery);
      const subtitleMatch = cmd.subtitle?.toLowerCase().includes(lowerQuery);
      const keywordMatch = cmd.keywords?.some(k => k.includes(lowerQuery));
      return titleMatch || subtitleMatch || keywordMatch || false;
    };
    
    // Add matching quick actions
    const matchingActions = quickActions.filter(matchesQuery);
    commands.push(...matchingActions);
    
    // Add matching navigation commands (if not pure search)
    if (!lowerQuery || (mergedResults.tasks.length === 0 && mergedResults.pages.length === 0)) {
      const matchingNav = navigationCommands.filter(matchesQuery);
      commands.push(...matchingNav);
    }
    
    return commands;
  }, [query, mergedResults, quickActions, navigationCommands, navigate, onClose, isSelectionMode, onSelect, pagesById, makeTaskSelection, makePageSelection, activepageId, createPage, selectPage, addTask, selectionFilter]);
  
  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allCommands.length]);
  
  // ============================================================================
  // KEYBOARD NAVIGATION
  // ============================================================================
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, allCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (allCommands[selectedIndex]) {
          allCommands[selectedIndex].onSelect();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [allCommands, selectedIndex, onClose]);
  
  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);
  // Group commands by category for rendering (must be before early return for hooks rules)
  const searchResults = useMemo(() => allCommands.filter(c => c.category === 'search'), [allCommands]);
  const actionResults = useMemo(() => allCommands.filter(c => c.category === 'action'), [allCommands]);
  const navResults = useMemo(() => allCommands.filter(c => c.category === 'navigation'), [allCommands]);
  
  // For selection mode, further split search results into tasks and pages
  const taskSearchResults = useMemo(() => searchResults.filter(c => c.id.startsWith('task-')), [searchResults]);
  const pageSearchResults = useMemo(() => searchResults.filter(c => c.id.startsWith('note-')), [searchResults]);
  
  // Create index map for each command ID
  const commandIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    allCommands.forEach((cmd, idx) => map.set(cmd.id, idx));
    return map;
  }, [allCommands]);
  
  const getCommandIndex = useCallback((cmdId: string) => commandIndexMap.get(cmdId) ?? 0, [commandIndexMap]);
  
  // ============================================================================
  // RENDER
  // ============================================================================
  if (!shouldRender) return null;
  
  // Mobile: Use MobileDrawer for consistent sliding panel behavior
  if (isMobile) {
    return (
      <MobileDrawer
        isOpen={isOpen}
        onClose={onClose}
        position="bottom"
      >
        <div className="flex flex-col h-full w-full" onKeyDown={handleKeyDown}>
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-subtle)] flex-shrink-0">
            <SearchIcon className="w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder || (isSelectionMode ? "Search tasks and pages..." : "Search or type a command...")}
              className="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none text-base"
            />
            {isSearching && (
              <div className="w-4 h-4 border-2 border-[var(--color-interactive-border)] border-t-transparent rounded-full animate-spin" />
            )}
            <button
              onClick={onClose}
              className="p-1.5 -mr-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-md hover:bg-[var(--color-surface-secondary)]"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Results list - takes remaining space */}
          <div 
            ref={listRef}
            className={`flex-1 overflow-y-auto py-2 ${isMobile ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : ''}`}
          >
            {allCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                {query ? 'No results found' : (isSelectionMode ? 'No items available' : 'Start typing to search...')}
              </div>
            ) : (
              <>
                {/* Search results */}
                {searchResults.length > 0 && (
                  <div className="mb-2">
                    {isSelectionMode ? (
                      <>
                        {/* In selection mode, group by Tasks and Pages */}
                        {taskSearchResults.length > 0 && (selectionFilter === 'all' || selectionFilter === 'task') && (
                          <>
                            <CategoryLabel>Tasks</CategoryLabel>
                            {taskSearchResults.map((cmd) => {
                              const idx = getCommandIndex(cmd.id);
                              return (
                                <ResultItem
                                  key={cmd.id}
                                  command={cmd}
                                  isSelected={selectedIndex === idx}
                                  index={idx}
                                  onClick={cmd.onSelect}
                                  onMouseEnter={() => setSelectedIndex(idx)}
                                />
                              );
                            })}
                          </>
                        )}
                        {pageSearchResults.length > 0 && (selectionFilter === 'all' || selectionFilter === 'note') && (
                          <>
                            <CategoryLabel>Pages</CategoryLabel>
                            {pageSearchResults.map((cmd) => {
                              const idx = getCommandIndex(cmd.id);
                              return (
                                <ResultItem
                                  key={cmd.id}
                                  command={cmd}
                                  isSelected={selectedIndex === idx}
                                  index={idx}
                                  onClick={cmd.onSelect}
                                  onMouseEnter={() => setSelectedIndex(idx)}
                                />
                              );
                            })}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <CategoryLabel>Results</CategoryLabel>
                        {searchResults.map((cmd) => {
                          const idx = getCommandIndex(cmd.id);
                          return (
                            <ResultItem
                              key={cmd.id}
                              command={cmd}
                              isSelected={selectedIndex === idx}
                              index={idx}
                              onClick={cmd.onSelect}
                              onMouseEnter={() => setSelectedIndex(idx)}
                            />
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
                
                {/* Quick actions */}
                {actionResults.length > 0 && (
                  <div className="mb-2">
                    <CategoryLabel>Quick Actions</CategoryLabel>
                    {actionResults.map((cmd) => {
                      const idx = getCommandIndex(cmd.id);
                      return (
                        <ResultItem
                          key={cmd.id}
                          command={cmd}
                          isSelected={selectedIndex === idx}
                          index={idx}
                          onClick={cmd.onSelect}
                          onMouseEnter={() => setSelectedIndex(idx)}
                        />
                      );
                    })}
                  </div>
                )}
                
                {/* Navigation */}
                {navResults.length > 0 && (
                  <div>
                    <CategoryLabel>Navigation</CategoryLabel>
                    {navResults.map((cmd) => {
                      const idx = getCommandIndex(cmd.id);
                      return (
                        <ResultItem
                          key={cmd.id}
                          command={cmd}
                          isSelected={selectedIndex === idx}
                          index={idx}
                          onClick={cmd.onSelect}
                          onMouseEnter={() => setSelectedIndex(idx)}
                        />
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </MobileDrawer>
    );
  }
  
  // Desktop: Centered modal
  return createPortal(
    <div
      className={`fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] transition-all duration-300 ease-out eink-modal-backdrop ${
        mounted ? 'bg-black/40 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-0'
      }`}
      onClick={onClose}
    >
      <div
        className={`relative bg-[var(--color-surface-base)] rounded-xl w-full max-w-xl mx-4 shadow-2xl shadow-black/25 dark:shadow-black/50 border border-[var(--color-border-default)] overflow-hidden transform transition-all duration-300 ease-out eink-shell-surface ${
          mounted ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
        }`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border-default)]">
          <SearchIcon className="w-5 h-5 text-[var(--color-text-tertiary)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder || (isSelectionMode ? "Search tasks and pages..." : "Search or type a command...")}
            className="flex-1 bg-transparent text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none text-base"
          />
          {isSearching && (
            <div className="w-4 h-4 border-2 border-[var(--color-interactive-border)] border-t-transparent rounded-full animate-spin" />
          )}
          {!isMobile && <ShortcutBadge keys="Esc" />}
        </div>
        
        {/* Results list */}
        <div 
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto py-2"
        >
          {allCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
              {query ? 'No results found' : (isSelectionMode ? 'No items available' : 'Start typing to search...')}
            </div>
          ) : (
            <>
              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mb-2">
                  {isSelectionMode ? (
                    <>
                      {/* In selection mode, group by Tasks and Pages */}
                      {taskSearchResults.length > 0 && (selectionFilter === 'all' || selectionFilter === 'task') && (
                        <>
                          <CategoryLabel>Tasks</CategoryLabel>
                          {taskSearchResults.map((cmd) => {
                            const idx = getCommandIndex(cmd.id);
                            return (
                              <ResultItem
                                key={cmd.id}
                                command={cmd}
                                isSelected={selectedIndex === idx}
                                index={idx}
                                onClick={cmd.onSelect}
                                onMouseEnter={() => setSelectedIndex(idx)}
                              />
                            );
                          })}
                        </>
                      )}
                      {pageSearchResults.length > 0 && (selectionFilter === 'all' || selectionFilter === 'note') && (
                        <>
                          <CategoryLabel>Pages</CategoryLabel>
                          {pageSearchResults.map((cmd) => {
                            const idx = getCommandIndex(cmd.id);
                            return (
                              <ResultItem
                                key={cmd.id}
                                command={cmd}
                                isSelected={selectedIndex === idx}
                                index={idx}
                                onClick={cmd.onSelect}
                                onMouseEnter={() => setSelectedIndex(idx)}
                              />
                            );
                          })}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <CategoryLabel>Results</CategoryLabel>
                      {searchResults.map((cmd) => {
                        const idx = getCommandIndex(cmd.id);
                        return (
                          <ResultItem
                            key={cmd.id}
                            command={cmd}
                            isSelected={selectedIndex === idx}
                            index={idx}
                            onClick={cmd.onSelect}
                            onMouseEnter={() => setSelectedIndex(idx)}
                          />
                        );
                      })}
                    </>
                  )}
                </div>
              )}
              
              {/* Quick actions */}
              {actionResults.length > 0 && (
                <div className="mb-2">
                  <CategoryLabel>Quick Actions</CategoryLabel>
                  {actionResults.map((cmd) => {
                    const idx = getCommandIndex(cmd.id);
                    return (
                      <ResultItem
                        key={cmd.id}
                        command={cmd}
                        isSelected={selectedIndex === idx}
                        index={idx}
                        onClick={cmd.onSelect}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      />
                    );
                  })}
                </div>
              )}
              
              {/* Navigation */}
              {navResults.length > 0 && (
                <div>
                  <CategoryLabel>Navigation</CategoryLabel>
                  {navResults.map((cmd) => {
                    const idx = getCommandIndex(cmd.id);
                    return (
                      <ResultItem
                        key={cmd.id}
                        command={cmd}
                        isSelected={selectedIndex === idx}
                        index={idx}
                        onClick={cmd.onSelect}
                        onMouseEnter={() => setSelectedIndex(idx)}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer with hint */}
        {!isMobile && (
          <div className="px-4 py-2 border-t border-[var(--color-border-default)] bg-[var(--color-surface-secondary)] flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[var(--color-surface-inset)] rounded text-[10px]">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[var(--color-surface-inset)] rounded text-[10px]">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[var(--color-surface-inset)] rounded text-[10px]">esc</kbd>
              close
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CommandPalette;