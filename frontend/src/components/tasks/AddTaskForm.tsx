/**
 * @file AddTaskForm.tsx
 * @description Form component for creating and editing tasks
 * @app TASKS APP ONLY - Core task management component
 * 
 * A versatile form that handles both task creation and editing modes.
 * 
 * Features:
 * - Title with inline autocomplete suggestions (dates, priorities, projects)
 * - Description field (expandable)
 * - Due date picker with CalendarPicker
 * - Priority selector (Low/Medium/High)
 * - Project assignment dropdown
 * - Section assignment (when task page has sections)
 * - Smart defaults based on current view (e.g., Today view defaults to today's date)
 * 
 * The form tracks dirty state and reports it via onDirtyChange prop
 * to enable unsaved changes protection.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import useClickOutside from '../../hooks/useClickOutside';
import { useIsMobile } from '@frameer/hooks/useMobileDetection';
import dayjs from 'dayjs';
import { CalendarIcon, ChevronDownIcon, TrashIcon, ChevronRightIcon } from '../common/Icons';
import type { Task, Subtask, RecurrencePattern } from '@/types/task';
import RecurrenceSelector from './RecurrenceSelector';
import type { Page } from '@/types/page';
import CalendarPicker from '../common/CalendarPicker';
import { priorityClasses } from '../../lib/design-system';
import { MobileSheet } from '@/components/ui';
import { FRIENDLY_DATES, friendlyToISO, getTokenAt, dateSuggestionFor, mapPriorityToken } from '../../lib/suggestions';
import type { View } from '../../lib/selectors';
import { Button, Text, TextSmall, Popover, LucideIcon, InlineTagInput, Panel, ModalFooter, PropertyRow } from '../ui';
import SubtaskList from './SubtaskList';
import { inline } from '../../lib/layout';
import { useTasksStore } from '@/stores/tasksStore';
import { usePagesStore } from '@/stores/pagesStore';
import { StylizedTaskIcon } from '@/components/common/StylizedIcons';
import { collectAllTags, collectTagsScoped } from '@/lib/tagUtils';
import { describeRecurrence } from '@/lib/recurrenceUtils';
import { formatRelativeDate } from '@/lib/dateUtils';
import { cn } from '@/lib/design-system';
import { Layers, Tag, Repeat, Calendar, Flag, ChevronRight, ChevronDown, Trash2, X, Link2 } from 'lucide-react';
import { useBacklinks } from '@/hooks/useBacklinks';
import { useNavigate } from '@tanstack/react-router';
import { useUIStore } from '@/stores/uiStore';

import ItemIcon from '@/components/common/ItemIcon';

/** Helper component for rendering task page icon - Lucide icon or fallback task icon */
const ProjectIcon: React.FC<{ icon?: string | null; color?: string | null; className?: string }> = ({ icon, color, className = "w-4 h-4" }) => {
  if (icon) {
    return <LucideIcon name={icon} className={className} style={color ? { color } : undefined} />;
  }
  // Pass `className` through so the fallback stylized icon aligns with Lucide icons
  return <StylizedTaskIcon color={color || undefined} className={className} />;
};

// Task collections are now Page type with viewMode='tasks'
type TaskCollection = Page;

interface AddTaskFormProps {
  // edit mode
  onSaveTask?: (task: Task) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  /** Called after successful task creation (for closing modals, etc.) */
  onTaskCreated?: () => void;
  taskPages?: TaskCollection[];
  initialTask?: Task | null;
  mode?: 'create' | 'edit';
  // report whether the form has unsaved changes
  onDirtyChange?: (dirty: boolean) => void;
  // the current selected task page id from the sidebar (if any) so the form can default to it
  selectedTaskPageId?: string | null;
  currentView?: View;
  /** Default due date override (e.g., for DailyJournalView) */
  defaultDueDate?: string;
  /** Default section ID (for kanban column creation) */
  defaultSection?: string;
  /** Default tag (for kanban tag column creation) */
  defaultTag?: string;
  /** Default priority (for kanban priority column creation) */
  defaultPriority?: 'Low' | 'Medium' | 'High';
  /** Layout mode: 'single-column' for sidebar pane, 'two-column' for modal (default) */
  layout?: 'single-column' | 'two-column';
}

const PRIORITY_LEVELS = ['Low', 'Medium', 'High'] as const;

// Import character limits from config
import { FORM_VALIDATION } from '@/lib/config';
const TITLE_MAX_LENGTH = FORM_VALIDATION.TASK_TITLE_MAX_LENGTH;
const DESCRIPTION_MAX_LENGTH = FORM_VALIDATION.TASK_DESCRIPTION_MAX_LENGTH;

  const AddTaskForm: React.FC<AddTaskFormProps> = ({ onSaveTask, onCancel, onDelete, onTaskCreated, taskPages = [], initialTask = null, mode = 'create', onDirtyChange, selectedTaskPageId = null, currentView = 'all', defaultDueDate, defaultSection, defaultTag, defaultPriority, layout = 'two-column' }) => {
  // Get addTask and all tasks from store for create mode
  const addTask = useTasksStore((state) => state.addTask);
  const tasksById = useTasksStore((state) => state.tasksById);
  const pagesById = usePagesStore((state) => state.pagesById);
  const allTasks = Object.values(tasksById);
  
  // Helper: get parent title for a task page (one level breadcrumb)
  const getParentTitle = useCallback((page: TaskCollection): string | null => {
    if (!page.parentId) return null;
    const parent = pagesById[page.parentId];
    return parent?.title || null;
  }, [pagesById]);
  
  const [title, setTitle] = useState(initialTask?.title ?? '');
  const [description, setDescription] = useState(initialTask?.description ?? '');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High' | ''>((initialTask?.priority as 'Low' | 'Medium' | 'High' | undefined) ?? defaultPriority ?? '');
  const [dueDate, setDueDate] = useState(initialTask?.dueDate ?? defaultDueDate ?? '');
  const [parentPageId, setParentPageId] = useState(initialTask?.parentPageId ?? '');
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialTask?.subtasks ?? []);

  const [sectionId, setSectionId] = useState(initialTask?.sectionId ?? defaultSection ?? '');
  const [recurrence, setRecurrence] = useState<RecurrencePattern | undefined>(initialTask?.recurrence);
  const [tag, setTag] = useState(initialTask?.tag ?? defaultTag ?? '');
  const [caret, setCaret] = useState(0);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [dropdownIndex, setDropdownIndex] = useState(0);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(false);
  const rootRef = useRef<HTMLFormElement | null>(null);
  const priorityRef = useRef<HTMLDivElement | null>(null);
  const dueRef = useRef<HTMLDivElement | null>(null);
  const projectRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  // Mobile detection
  const isMobile = useIsMobile();

  // Auto-resize title and description textareas
  useEffect(() => {
    // Title resize
    const titleEl = titleRef.current;
    if (titleEl) {
      titleEl.style.height = 'auto';
      titleEl.style.height = titleEl.scrollHeight + 'px';
    }

    // Description resize
    const descEl = descriptionRef.current;
    if (descEl) {
      descEl.style.height = 'auto';
      // Start at 1 line (approx 24px), expand as needed
      descEl.style.height = descEl.scrollHeight + 'px';
    }
  }, [title, description]);

  // Reset form when initialTask changes (important for split view)
  useEffect(() => {
    setTitle(initialTask?.title ?? '');
    setDescription(initialTask?.description ?? '');
    setPriority((initialTask?.priority as 'Low' | 'Medium' | 'High' | undefined) ?? defaultPriority ?? '');
    setDueDate(initialTask?.dueDate ?? defaultDueDate ?? '');
    setParentPageId(initialTask?.parentPageId ?? '');
    setSubtasks(initialTask?.subtasks ?? []);
    setSectionId(initialTask?.sectionId ?? defaultSection ?? '');
    setRecurrence(initialTask?.recurrence);
    setTag(initialTask?.tag ?? defaultTag ?? '');
    setExpanded(false);
  }, [initialTask, defaultPriority, defaultDueDate, defaultSection, defaultTag]);

  // derive initial snapshot for dirty checking (including subtasks, recurrence, and tag)
  const initialSnapshot = useMemo(() => ({
    title: initialTask?.title ?? '',
    description: initialTask?.description ?? '',
    priority: initialTask?.priority ?? '',
    dueDate: initialTask?.dueDate ?? '',
    parentPageId: initialTask?.parentPageId ?? '',
    sectionId: initialTask?.sectionId ?? '',
    subtasks: initialTask?.subtasks ?? [],
    recurrence: initialTask?.recurrence,
    tag: initialTask?.tag ?? ''
  }), [initialTask]);

  // If the parent passed a selectedTaskPageId (the sidebar selection), use it as the default parent page for new tasks
  useEffect(() => {
    if (initialTask?.parentPageId) return; // editing keeps its own parent page
    if (mode !== 'create') return;
    // Parent page default: prefer sidebar selection, else inbox (no parent page)
    if (selectedTaskPageId) {
      const sel = taskPages.find(p => p.id === selectedTaskPageId);
      if (sel) setParentPageId(sel.id);
    }
    // Date default: when creating from 'today' or 'upcoming' view, default dueDate to today
    if (currentView === 'today' || currentView === 'upcoming') {
      const today = dayjs().format('YYYY-MM-DD');
      setDueDate(today);
      // momentary flash to indicate autofill
      setFlashDue(true);
      setTimeout(() => setFlashDue(false), 600);
    }
  }, [initialTask, mode, selectedTaskPageId, taskPages, currentView]);

  // flash indicators that appear briefly after autofill
  const [flashDue, setFlashDue] = useState(false);
  const [flashPrio, setFlashPrio] = useState(false);
  const [flashProject, setFlashProject] = useState(false);

  const dueStatus = useMemo(() => {
    if (!dueDate) return 'none';
    const iso = dayjs(dueDate);
    const daysAway = iso.startOf('day').diff(dayjs().startOf('day'), 'day');
    if (daysAway < 0) return 'overdue';
    if (daysAway === 0) return 'today';
    return 'future';
  }, [dueDate]);

  const flashDueClass = flashDue ? (dueStatus === 'overdue' ? 'ring-2 ring-red-200 ring-offset-1' : dueStatus === 'today' ? 'ring-2 ring-green-200 ring-offset-1' : 'ring-2 ring-indigo-200 ring-offset-1') : '';

  const flashPrioClass = flashPrio ? (priority === 'High' ? 'ring-2 ring-red-200 ring-offset-1' : priority === 'Medium' ? 'ring-2 ring-orange-200 ring-offset-1' : 'ring-2 ring-blue-200 ring-offset-1') : '';

  const currentProject = useMemo(() => taskPages.find(p => p.id === parentPageId), [taskPages, parentPageId]);
  const projectColor = currentProject?.color;
  // use Tailwind ring classes for a consistent glow; set --tw-ring-color to the task page color (with alpha)
  const projectRingStyle = flashProject && projectColor ? ({ ...( { ['--tw-ring-color']: `${projectColor}33` } as unknown as React.CSSProperties) }) : undefined;

  // Get available sections for the current task page (if any)
  const availableSections = useMemo(() => currentProject?.sections || [], [currentProject]);
  const currentSection = useMemo(() => availableSections.find(s => s.id === sectionId), [availableSections, sectionId]);

  // Collect tags scoped to the current parent page (or all if in inbox/all view)
  const scopedTags = useMemo(() => collectTagsScoped(allTasks, parentPageId || null), [allTasks, parentPageId]);

  useEffect(() => {
    // Only consider the form "dirty" if there is any title present now or in the initial snapshot.
    const hasAnyTitle = (title ?? '').trim().length > 0 || (initialSnapshot.title ?? '').trim().length > 0;
    if (!hasAnyTitle) {
      onDirtyChange?.(false);
      return;
    }
    // Check if subtasks and recurrence have changed (compare by stringifying for simplicity)
    const subtasksChanged = JSON.stringify(subtasks) !== JSON.stringify(initialSnapshot.subtasks);
    const recurrenceChanged = JSON.stringify(recurrence) !== JSON.stringify(initialSnapshot.recurrence);
    const tagChanged = tag !== initialSnapshot.tag;
    const dirty = title !== initialSnapshot.title || description !== initialSnapshot.description || priority !== initialSnapshot.priority || dueDate !== initialSnapshot.dueDate || parentPageId !== initialSnapshot.parentPageId || sectionId !== initialSnapshot.sectionId || subtasksChanged || recurrenceChanged || tagChanged;
    onDirtyChange?.(dirty);
  }, [title, description, priority, dueDate, parentPageId, sectionId, subtasks, initialSnapshot, onDirtyChange, recurrence, tag]);

  // close popovers when clicking outside — use the shared hook
  useClickOutside([
    { ref: priorityRef, onOutside: () => setPriorityOpen(false) },
    { ref: dueRef, onOutside: () => setDueOpen(false) },
    { ref: projectRef, onOutside: () => setProjectOpen(false) },
    { ref: sectionRef, onOutside: () => setSectionOpen(false) },
    { ref: rootRef as React.RefObject<HTMLElement | null>, onOutside: () => setExpanded(false) },
  ]);

  // close on Escape: delegate to onCancel so the page can prompt for discard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel?.();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Auto-focus title input
  useEffect(() => {
    // Small delay to ensure modal animation has started
    const t = setTimeout(() => titleRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    let t = title, pid = parentPageId, d = dueDate;
    const projectMatch = t.match(/#([^ ]+)/);
    if (projectMatch) {
      const found = taskPages.find(pr => pr.title.toLowerCase() === projectMatch[1].toLowerCase());
      if (found) pid = found.id;
      t = t.replace(/#([^ ]+)/, '').trim();
    }
    const dateMatch = t.match(/@([^ ]+)/);
    if (dateMatch) {
      const iso = friendlyToISO(dateMatch[1]);
      d = iso || '';
      t = t.replace(/@([^ ]+)/, '').trim();
    }
    
    if (mode === 'create') {
      // Use defaultDueDate if no due date was set
      const finalDueDate = d || defaultDueDate || '';
      
      // Update recurrence anchorDate if we have both recurrence and a due date
      const finalRecurrence = recurrence && finalDueDate 
        ? { ...recurrence, anchorDate: finalDueDate }
        : recurrence;
      
      // Call store directly - no prop drilling needed
      addTask({
        title: t,
        description: description || undefined,
        dueDate: finalDueDate || undefined,
        priority: priority || undefined,
        parentPageId: pid || undefined,
        sectionId: sectionId || undefined,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
        recurrence: finalRecurrence,
        tag: tag || undefined,
      });
      
      // Reset form
      setTitle('');
      setDescription('');
      setPriority('');
      setDueDate('');
      setParentPageId('');
      setSectionId('');
      setSubtasks([]);
      setRecurrence(undefined);
      setTag('');
      setExpanded(false);

      // Clear dirty state before the parent closes the pane so the discard
      // guard does not see the previous edited snapshot for one extra render.
      flushSync(() => {
        onDirtyChange?.(false);
      });
      
      // Notify parent (for closing modals)
      onTaskCreated?.();
    } else if (mode === 'edit' && initialTask) {
      flushSync(() => {
        onDirtyChange?.(false);
      });

      // Update recurrence anchorDate if we have both recurrence and a due date
      const finalRecurrence = recurrence && d 
        ? { ...recurrence, anchorDate: d }
        : recurrence;
        
      const updated: Task = { 
        ...initialTask, 
        title: t, 
        description, 
        dueDate: d, 
        priority: priority || undefined, 
        parentPageId: pid || undefined, 
        sectionId: sectionId || undefined, 
        subtasks,
        recurrence: finalRecurrence,
        tag: tag || undefined,
      };
      onSaveTask?.(updated);
      setExpanded(false);
    }
  }, [title, description, dueDate, priority, parentPageId, sectionId, subtasks, recurrence, tag, mode, initialTask, taskPages, addTask, onTaskCreated, onSaveTask, defaultDueDate]);

  // compute token under caret when focused/expanded
        const caretToken = useMemo(() => {
          if (!expanded) return null;
    return getTokenAt(title, caret, taskPages);
        }, [title, caret, expanded, taskPages]);

  const acceptTokenAtCaret = (token: { type: 'taskPage' | 'date' | 'prio', start: number, end: number, token: string } | null, force = false, suggestionOverride?: string) => {
    if (!token) return false;
    if (token.type === 'taskPage') {
      // when forced (click/tab/enter) accept partial suggestions via startsWith
      // when not forced, only accept if it's an exact match
      const suggest = taskPages.find(p => p.title.toLowerCase().startsWith(token.token.toLowerCase()));
      if (!suggest) return false;
      if (!force && suggest.title.toLowerCase() !== token.token.toLowerCase()) return false;
      // accept project and remove the token from the title
      setParentPageId(suggest.id);
      const newTitle = title.slice(0, token.start) + title.slice(token.end);
      setTitle(newTitle);
      // move caret to token start
      const pos = token.start;
      setTimeout(() => {
        const el = titleRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(pos, pos);
          setCaret(pos);
        }
      }, 0);
      // keep the overlay visible after accepting
      setExpanded(true);
  // flash task page glow briefly
  setFlashProject(true);
  setTimeout(() => setFlashProject(false), 600);
      return true;
    }
    if (token.type === 'prio') {
      const lvl = mapPriorityToken(token.token);
      if (!lvl) return false;
      setPriority(lvl);
      // remove token from title
      const newTitle = title.slice(0, token.start) + title.slice(token.end);
      setTitle(newTitle);
      const pos = token.start;
      setTimeout(() => {
        const el = titleRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(pos, pos);
          setCaret(pos);
        }
      }, 0);
  setExpanded(true);
  setFlashPrio(true);
  setTimeout(() => setFlashPrio(false), 600);
      return true;
    }
    if (token.type === 'date') {
      // if not forced, only accept exact friendly names or ISO strings
      if (!force) {
        const iso = friendlyToISO(token.token);
        if (!iso) return false;
        setDueDate(iso);
      } else {
        // forced accept - if a suggestionOverride was supplied (overlay click), use it; otherwise use dateSuggestionFor
        const suggestion = suggestionOverride ?? dateSuggestionFor(token.token);
        if (suggestion) {
          const iso = friendlyToISO(suggestion);
          if (!iso) return false;
          setDueDate(iso);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(token.token)) {
          // if the raw token is an ISO date, accept it
          setDueDate(token.token);
        } else {
          return false;
        }
      }
      // remove token from title after accepting
      const newTitle = title.slice(0, token.start) + title.slice(token.end);
      setTitle(newTitle);
      const pos = token.start;
      setTimeout(() => {
        const el = titleRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(pos, pos);
          setCaret(pos);
        }
      }, 0);
  // keep the overlay visible after accepting
  setExpanded(true);
  setFlashDue(true);
  setTimeout(() => setFlashDue(false), 600);
      return true;
    }
    return false;
  };

  // --- Dropdown for token suggestions (#, @, !) ---

  type TokenDropdownItem = {
    key: string;
    type: 'taskPage' | 'date' | 'prio';
    value: string;
    label: string;
    pageId?: string;
    parentLabel?: string;
    hint?: string;
    icon?: string | null;
    color?: string | null;
  };

  const dropdownItems = useMemo((): TokenDropdownItem[] => {
    if (!expanded || !caretToken) return [];

    if (caretToken.type === 'taskPage') {
      const query = caretToken.token.toLowerCase();
      const filtered = query
        ? taskPages.filter(p => p.title.toLowerCase().includes(query))
        : taskPages;
      return filtered.map(p => ({
        key: p.id,
        type: 'taskPage' as const,
        value: p.title,
        label: p.title || 'Untitled',
        pageId: p.id,
        parentLabel: getParentTitle(p) || undefined,
        icon: p.icon,
        color: p.color,
      }));
    }

    if (caretToken.type === 'date') {
      const query = caretToken.token.toLowerCase();
      const dates = query
        ? FRIENDLY_DATES.filter(d => d.replace(/ /g, '').startsWith(query.replace(/ /g, '')))
        : FRIENDLY_DATES;
      return dates.map(d => ({
        key: d,
        type: 'date' as const,
        value: d,
        label: d.charAt(0).toUpperCase() + d.slice(1),
        hint: friendlyToISO(d),
      }));
    }

    if (caretToken.type === 'prio' && !caretToken.token) {
      return [
        { key: '1', type: 'prio' as const, value: '1', label: 'High' },
        { key: '2', type: 'prio' as const, value: '2', label: 'Medium' },
        { key: '3', type: 'prio' as const, value: '3', label: 'Low' },
      ];
    }

    return [];
  }, [expanded, caretToken, taskPages, getParentTitle]);

  // Reset dropdown index when token changes
  useEffect(() => {
    setDropdownIndex(0);
  }, [caretToken?.type, caretToken?.start, caretToken?.token]);

  const handleDropdownSelect = (item: TokenDropdownItem) => {
    if (!caretToken) return;
    const { start, end } = caretToken;
    const newTitle = title.slice(0, start) + title.slice(end);
    setTitle(newTitle);

    if (item.type === 'taskPage') {
      setParentPageId(item.pageId || '');
      setFlashProject(true);
      setTimeout(() => setFlashProject(false), 600);
    } else if (item.type === 'date') {
      const iso = friendlyToISO(item.value);
      if (iso) {
        setDueDate(iso);
        setFlashDue(true);
        setTimeout(() => setFlashDue(false), 600);
      }
    } else if (item.type === 'prio') {
      const lvl = mapPriorityToken(item.value);
      if (lvl) {
        setPriority(lvl);
        setFlashPrio(true);
        setTimeout(() => setFlashPrio(false), 600);
      }
    }

    const pos = start;
    setTimeout(() => {
      const el = titleRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
        setCaret(pos);
      }
    }, 0);
    setExpanded(true);
    setDropdownIndex(0);
  };





  /**
   * Render desktop property rows (used by both single-column and two-column layouts)
   * Mobile uses MobileSheet instead of Popover, so it has its own section
   */
  const renderDesktopPropertyRows = () => (
    <>
      <div className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest">Properties</div>
      
      {/* Parent Page */}
      <div ref={projectRef} className="relative">
        <PropertyRow
          label="Parent"
          icon={currentProject ? <ProjectIcon icon={currentProject.icon} color={currentProject.color} /> : <Layers className="w-4 h-4" />}
          value={currentProject?.title || 'Inbox'}
          onClick={() => setProjectOpen(!projectOpen)}
          active={parentPageId !== '' || projectOpen}
        />
        {projectOpen && (
          <Popover width="2xl">
            <div className="p-1.5 space-y-0.5">
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-left transition-colors"
                onClick={() => { setParentPageId(''); setSectionId(''); setProjectOpen(false); }}
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-secondary)] flex-shrink-0">
                  <Layers className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--color-text-primary)]">Inbox</div>
                </div>
              </button>
              {taskPages.map(p => {
                const parentTitle = getParentTitle(p);
                return (
                  <button
                    key={p.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-left transition-colors"
                    onClick={() => { setParentPageId(p.id); setProjectOpen(false); }}
                  >
                    <div 
                      className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
                      style={{ 
                        backgroundColor: p.color ? `${p.color}15` : undefined,
                        border: p.color ? `1px solid ${p.color}30` : undefined,
                      }}
                    >
                      <ProjectIcon icon={p.icon} color={p.color} className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {parentTitle && (
                        <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)] mb-0.5 uppercase tracking-wider">
                          <span className="truncate max-w-[120px]">{parentTitle}</span>
                          <ChevronRight className="w-3 h-3 flex-shrink-0" />
                        </div>
                      )}
                      <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {p.title || 'Untitled'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Popover>
        )}
      </div>

      {/* Section (if available) */}
      {availableSections.length > 0 && (
        <div ref={sectionRef} className="relative">
          <PropertyRow
            label="Section"
            icon={<Layers className="w-4 h-4" />}
            value={currentSection?.name || 'No Section'}
            onClick={() => setSectionOpen(!sectionOpen)}
            active={!!sectionId || sectionOpen}
          />
          {sectionOpen && (
            <Popover width="md">
              <div className="p-1.5 space-y-0.5">
                {availableSections.map(s => (
                  <button
                    key={s.id}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-sm"
                    onClick={() => { setSectionId(s.id); setSectionOpen(false); }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color || '#cbd5e1' }} />
                    <span>{s.name}</span>
                  </button>
                ))}
                <div className="h-px bg-[var(--color-border-secondary)] my-1" />
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600"
                  onClick={() => { setSectionId(''); setSectionOpen(false); }}
                >
                  <X className="w-4 h-4" />
                  <span>Clear</span>
                </button>
              </div>
            </Popover>
          )}
        </div>
      )}

      {/* Due Date */}
      <div ref={dueRef} className="relative">
        <PropertyRow
          label="Due Date"
          icon={<Calendar className="w-4 h-4" />}
          value={dueDate ? formatRelativeDate(dueDate) : undefined}
          onClick={() => setDueOpen(!dueOpen)}
          active={!!dueDate || dueOpen}
        />
        {dueOpen && (
          <Popover width="xl">
            <CalendarPicker value={dueDate} onChange={d => { setDueDate(d); setDueOpen(false); }} onClear={() => { setDueDate(''); setDueOpen(false); }} />
          </Popover>
        )}
      </div>

      {/* Recurrence */}
      <div className="relative z-50">
        <RecurrenceSelector
          value={recurrence}
          onChange={setRecurrence}
          anchorDate={dueDate || undefined}
          disabled={!dueDate}
          trigger={
            <PropertyRow
              label="Repeat"
              icon={<Repeat className="w-4 h-4" />}
              value={recurrence ? describeRecurrence(recurrence) : undefined}
              active={!!recurrence}
            />
          }
        />
      </div>

      {/* Priority */}
      <div ref={priorityRef} className="relative">
        <PropertyRow
          label="Priority"
          icon={<Flag className={cn("w-4 h-4", priority ? priorityClasses(priority).text : "text-[var(--color-text-tertiary)]")} />}
          value={priority || undefined}
          onClick={() => setPriorityOpen(!priorityOpen)}
          active={!!priority || priorityOpen}
        />
        {priorityOpen && (
          <Popover width="sm">
            <div className="p-1.5 space-y-0.5">
              {['Low', 'Medium', 'High'].map(p => (
                <button
                  key={p}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--color-surface-hover)] text-sm"
                  onClick={() => { setPriority(p as any); setPriorityOpen(false); }}
                >
                  <Flag className={cn("w-4 h-4", priorityClasses(p as any).text)} />
                  <span>{p}</span>
                </button>
              ))}
              <div className="h-px bg-[var(--color-border-secondary)] my-1" />
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600"
                onClick={() => { setPriority(''); setPriorityOpen(false); }}
              >
                <X className="w-4 h-4" />
                <span>Clear</span>
              </button>
            </div>
          </Popover>
        )}
      </div>

      {/* Tag */}
      <div className="relative">
        <div className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all group border",
          tag 
            ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/20" 
            : "hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border-transparent"
        )}>
          <div className="flex items-center gap-2.5">
            <div className={cn("transition-colors", tag ? "text-[var(--color-accent-primary)]" : "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-primary)]")}>
              <Tag className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium">Tag</span>
          </div>
          <div className="flex-1 flex items-center justify-end ml-4 gap-1.5">
            <InlineTagInput
              value={tag}
              onChange={setTag}
              existingTags={scopedTags}
              placeholder="Empty"
              isMulti={false}
              className="!border-0 !bg-transparent !p-0 !shadow-none justify-end"
            />
            <ChevronRight className="w-3.5 h-3.5 opacity-20 group-hover:opacity-40 transition-opacity flex-shrink-0" />
          </div>
        </div>
      </div>
    </>
  );

  return (
    <form id="add-task-form" onSubmit={handleSubmit} className="relative h-full w-full" ref={rootRef}>
      <div className={cn(
        "flex h-full w-full gap-0 items-stretch",
        layout === 'single-column' ? 'flex-col' : 'flex-col md:flex-row'
      )}>
        {/* Left Column: Content (Title, Description, Subtasks) */}
        <div className={cn(
          "flex flex-col",
          layout === 'single-column' ? 'w-full py-4' : 'w-full md:w-1/2 py-4 md:py-6 pr-4 md:pr-6 pl-0'
        )}>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 md:pr-2">
            {/* Title */}
            <div className="mb-2 group/title">
              <div className="relative">
                <div className="absolute inset-0 pl-0 pr-2 py-1 whitespace-pre-wrap break-words pointer-events-none text-2xl font-bold tracking-tight leading-tight antialiased font-sans">
                  {title.length === 0 ? (
                    <span className="text-[var(--color-text-disabled)]">Task title...</span>
                  ) : (
                    <span className="text-[var(--color-text-primary)]">{title}</span>
                  )}
                </div>
                <textarea
                  ref={titleRef}
                  placeholder="Task title..."
                  value={title}
                  rows={1}
                  onChange={e => {
                    const val = e.target.value.replace(/\n/g, ' ');
                    const sel = e.target.selectionStart ?? val.length;
                    setTitle(val);
                    setCaret(sel);
                    let tok = getTokenAt(val, sel, taskPages);
                    if (!tok && sel > 0 && val[sel - 1] === ' ') {
                      tok = getTokenAt(val, sel - 1, taskPages);
                    }
                    if (tok) {
                      if (tok.type === 'taskPage') {
                        const exact = taskPages.find(p => p.title.toLowerCase() === tok.token.toLowerCase());
                        if (exact && (tok.end === val.length || val[tok.end] === ' ')) {
                          acceptTokenAtCaret(tok);
                        }
                      } else if (tok.type === 'date') {
                        const isFriendlyExact = FRIENDLY_DATES.includes(tok.token.toLowerCase());
                        const isISO = /^\d{4}-\d{2}-\d{2}$/.test(tok.token);
                        if ((isFriendlyExact || isISO) && (tok.end === val.length || val[tok.end] === ' ')) {
                          acceptTokenAtCaret(tok);
                        }
                      } else if (tok.type === 'prio') {
                        if (tok.token.length > 0 && (tok.end === val.length || val[tok.end] === ' ')) {
                          acceptTokenAtCaret(tok);
                        }
                      }
                    }
                    if (tok) setExpanded(true);
                  }}
                  onClick={e => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
                  onKeyUp={e => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
                  onKeyDown={e => {
                    // Dropdown navigation when token is active
                    if (expanded && caretToken && dropdownItems.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setDropdownIndex(i => Math.min(i + 1, dropdownItems.length - 1));
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setDropdownIndex(i => Math.max(i - 1, 0));
                        return;
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        setExpanded(false);
                        return;
                      }
                      if (e.key === 'Tab' || e.key === 'Enter') {
                        e.preventDefault();
                        handleDropdownSelect(dropdownItems[dropdownIndex]);
                        return;
                      }
                    }
                    // Default: Tab/Enter for auto-accept or form submission
                    if (e.key === 'Tab' || e.key === 'Enter') {
                      const tok = caretToken;
                      if (tok) {
                        e.preventDefault();
                        const accepted = acceptTokenAtCaret(tok, true);
                        if (accepted) return;
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.target as HTMLTextAreaElement).form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                      }
                    }
                  }}
                  className="w-full bg-transparent focus:outline-none text-2xl font-bold tracking-tight leading-tight pl-0 pr-2 py-1 text-transparent caret-gray-900 dark:caret-white resize-none overflow-hidden antialiased font-sans m-0 border-none"
                  onFocus={() => setExpanded(true)}
                  maxLength={TITLE_MAX_LENGTH}
                />
                {/* Token suggestion dropdown */}
                {expanded && caretToken && dropdownItems.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-surface-primary)] shadow-lg z-50">
                    {dropdownItems.map((item, i) => (
                      <button
                        key={item.key}
                        type="button"
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                          i === dropdownIndex ? "bg-[var(--color-surface-hover)]" : "hover:bg-[var(--color-surface-hover)]/50"
                        )}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleDropdownSelect(item)}
                        onMouseEnter={() => setDropdownIndex(i)}
                      >
                        {item.type === 'taskPage' && (
                          <>
                            <div
                              className="w-7 h-7 flex items-center justify-center rounded-lg flex-shrink-0"
                              style={{
                                backgroundColor: item.color ? `${item.color}15` : undefined,
                                border: item.color ? `1px solid ${item.color}30` : undefined,
                              }}
                            >
                              <ProjectIcon icon={item.icon} color={item.color} className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {item.parentLabel && (
                                <div className="flex items-center gap-0.5 text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">
                                  <span className="truncate max-w-[120px]">{item.parentLabel}</span>
                                  <ChevronRight className="w-2.5 h-2.5 flex-shrink-0" />
                                </div>
                              )}
                              <div className="truncate font-medium">{item.label}</div>
                            </div>
                          </>
                        )}
                        {item.type === 'date' && (
                          <>
                            <Calendar className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                            <span className="flex-1">{item.label}</span>
                            {item.hint && <span className="text-xs text-[var(--color-text-tertiary)]">{item.hint}</span>}
                          </>
                        )}
                        {item.type === 'prio' && (
                          <>
                            <Flag className={cn("w-4 h-4 flex-shrink-0",
                              item.value === '1' ? 'text-red-500' :
                              item.value === '2' ? 'text-orange-500' : 'text-blue-500'
                            )} />
                            <span className="flex-1">{item.label}</span>
                            <span className="text-xs text-[var(--color-text-tertiary)]">!{item.value}</span>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-4">
              <textarea
                ref={descriptionRef}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add description..."
                className="w-full resize-none text-base text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-disabled)] bg-transparent focus:outline-none py-1 leading-relaxed"
                rows={1}
                style={{ minHeight: '24px', overflow: 'hidden' }}
                maxLength={DESCRIPTION_MAX_LENGTH}
              />
            </div>

            {/* Subtasks */}
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-2 text-[var(--color-text-disabled)]">
                <Layers className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Subtasks</span>
              </div>
              <SubtaskList subtasks={subtasks} onChange={setSubtasks} />
            </div>

            {/* Backlinks */}
            <TaskBacklinks taskId={initialTask?.id} />
          </div>
        </div>

        {/* Right Column: Properties (Sidebar) */}
        {isMobile ? (
          /* Mobile: Plain div with border-top */
          <div className="w-auto -mx-4 px-4 py-4 border-t border-[var(--color-border-secondary)]">
            <div className="px-3 mb-3 text-[10px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-widest">Properties</div>
            
            <div className="flex flex-col gap-2">
              {/* Parent Page */}
              <div ref={projectRef} className="relative">
                <PropertyRow
                  label="Parent"
                  icon={currentProject ? <ProjectIcon icon={currentProject.icon} color={currentProject.color} /> : <Layers className="w-4 h-4" />}
                  value={currentProject?.title || 'Inbox'}
                  onClick={() => setProjectOpen(!projectOpen)}
                  active={parentPageId !== '' || projectOpen}
                />
                {projectOpen && (
                  <MobileSheet isOpen={projectOpen} onClose={() => setProjectOpen(false)} title="Select Parent">
                    <div className="p-2 space-y-1">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--color-surface-hover)]"
                        onClick={() => { setParentPageId(''); setSectionId(''); setProjectOpen(false); }}
                      >
                        <Layers className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                        <span className="font-medium">Inbox</span>
                      </button>
                      {taskPages.map(p => {
                        const parentTitle = getParentTitle(p);
                        return (
                          <button
                            key={p.id}
                            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-[var(--color-surface-hover)] text-left transition-colors"
                            onClick={() => { setParentPageId(p.id); setProjectOpen(false); }}
                          >
                            <div 
                              className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                              style={{ 
                                backgroundColor: p.color ? `${p.color}15` : undefined,
                                border: p.color ? `1px solid ${p.color}30` : undefined,
                              }}
                            >
                              <ProjectIcon icon={p.icon} color={p.color} className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {/* Show parent breadcrumb if exists */}
                              {parentTitle && (
                                <div className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] mb-0.5 uppercase tracking-wider font-medium">
                                  <span className="truncate max-w-[150px]">{parentTitle}</span>
                                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                                </div>
                              )}
                              <div className="text-base font-semibold text-[var(--color-text-primary)] truncate">
                                {p.title || 'Untitled'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </MobileSheet>
                )}
              </div>

              {/* Section (if available) */}
              {availableSections.length > 0 && (
                <div ref={sectionRef} className="relative">
                  <PropertyRow
                    label="Section"
                    icon={<Layers className="w-4 h-4" />}
                    value={currentSection?.name || 'No Section'}
                    onClick={() => setSectionOpen(!sectionOpen)}
                    active={!!sectionId || sectionOpen}
                  />
                  {sectionOpen && (
                    <MobileSheet isOpen={sectionOpen} onClose={() => setSectionOpen(false)} title="Select Section">
                      <div className="p-2 space-y-1">
                        {availableSections.map(s => (
                          <button
                            key={s.id}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--color-surface-hover)]"
                            onClick={() => { setSectionId(s.id); setSectionOpen(false); }}
                          >
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color || '#cbd5e1' }} />
                            <span className="font-medium">{s.name}</span>
                          </button>
                        ))}
                        <button
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--color-surface-hover)] text-red-500"
                          onClick={() => { setSectionId(''); setSectionOpen(false); }}
                        >
                          <X className="w-5 h-5" />
                          <span className="font-medium">Clear Section</span>
                        </button>
                      </div>
                    </MobileSheet>
                  )}
                </div>
              )}

              {/* Due Date */}
              <div ref={dueRef} className="relative">
                <PropertyRow
                  label="Due Date"
                  icon={<Calendar className="w-4 h-4" />}
                  value={dueDate ? formatRelativeDate(dueDate) : undefined}
                  onClick={() => setDueOpen(!dueOpen)}
                  active={!!dueDate || dueOpen}
                />
                {dueOpen && (
                  <MobileSheet isOpen={dueOpen} onClose={() => setDueOpen(false)} title="Select Date">
                    <CalendarPicker value={dueDate} onChange={d => { setDueDate(d); setDueOpen(false); }} onClear={() => { setDueDate(''); setDueOpen(false); }} />
                  </MobileSheet>
                )}
              </div>

              {/* Recurrence */}
              <div className="relative">
                <RecurrenceSelector
                  value={recurrence}
                  onChange={setRecurrence}
                  anchorDate={dueDate || undefined}
                  disabled={!dueDate}
                  trigger={
                    <PropertyRow
                      label="Repeat"
                      icon={<Repeat className="w-4 h-4" />}
                      value={recurrence ? describeRecurrence(recurrence) : undefined}
                      active={!!recurrence}
                    />
                  }
                />
              </div>

              {/* Priority */}
              <div ref={priorityRef} className="relative">
                <PropertyRow
                  label="Priority"
                  icon={<Flag className={cn("w-4 h-4", priority ? priorityClasses(priority).text : "text-[var(--color-text-tertiary)]")} />}
                  value={priority || undefined}
                  onClick={() => setPriorityOpen(!priorityOpen)}
                  active={!!priority || priorityOpen}
                />
                {priorityOpen && (
                  <MobileSheet isOpen={priorityOpen} onClose={() => setPriorityOpen(false)} title="Set Priority">
                    <div className="p-2 space-y-1">
                      {['Low', 'Medium', 'High'].map(p => (
                        <button
                          key={p}
                          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--color-surface-hover)]"
                          onClick={() => { setPriority(p as any); setPriorityOpen(false); }}
                        >
                          <Flag className={cn("w-5 h-5", priorityClasses(p as any).text)} />
                          <span className="font-medium">{p}</span>
                        </button>
                      ))}
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--color-surface-hover)] text-red-500"
                        onClick={() => { setPriority(''); setPriorityOpen(false); }}
                      >
                        <X className="w-5 h-5" />
                        <span className="font-medium">Clear Priority</span>
                      </button>
                    </div>
                  </MobileSheet>
                )}
              </div>

              {/* Tag */}
              <div className="relative">
                <div className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all group border",
                  tag 
                    ? "bg-[var(--color-accent-muted)] text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/20" 
                    : "hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] border-transparent"
                )}>
                  <div className="flex items-center gap-2.5">
                    <div className={cn("transition-colors", tag ? "text-[var(--color-accent-primary)]" : "text-[var(--color-text-tertiary)] group-hover:text-[var(--color-text-primary)]")}>
                      <Tag className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium">Tag</span>
                  </div>
                  <div className="flex-1 flex items-center justify-end ml-4 gap-1.5">
                    <InlineTagInput
                      value={tag}
                      onChange={setTag}
                      existingTags={scopedTags}
                      placeholder="Empty"
                      isMulti={false}
                      className="!border-0 !bg-transparent !p-0 !shadow-none justify-end"
                    />
                    <ChevronRight className="w-3.5 h-3.5 opacity-20 group-hover:opacity-40 transition-opacity flex-shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : layout === 'single-column' ? (
          /* Single Column Layout: Simple vertical stack without panel wrapper */
          <div className="w-full py-4 space-y-1">
            {renderDesktopPropertyRows()}
          </div>
        ) : (
          /* Desktop Two-Column: Panel */
          <Panel 
            padding="none" 
            shadow="sm"
            className="w-full md:w-1/2 border-l border-[var(--color-border-default)] rounded-2xl bg-[var(--color-surface-inset)]"
          >
            <div className="space-y-1 h-full p-4 md:p-6">
              {renderDesktopPropertyRows()}
            </div>
          </Panel>
        )}
      </div>


    </form>
  );
};

// ============================================================================
// TASK BACKLINKS (incoming links TO this task)
// ============================================================================

const TaskBacklinks: React.FC<{ taskId?: string }> = ({ taskId }) => {
  const backlinks = useBacklinks(taskId);
  const navigate = useNavigate();
  const openTaskInContext = useUIStore((s) => s.openTaskInContext);
  const pagesById = usePagesStore((s) => s.pagesById);

  const handleClickBacklink = useCallback((bl: { sourceType: string; sourceId: string }) => {
    if (bl.sourceType === 'task') {
      openTaskInContext(bl.sourceId);
    } else {
      navigate({ to: '/pages/$id', params: { id: bl.sourceId } });
    }
  }, [navigate, openTaskInContext]);

  if (backlinks.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-1.5 text-[var(--color-text-disabled)]">
        <Link2 className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-wider">Backlinks</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {backlinks.map((bl) => {
          const page = bl.sourceType === 'page' ? pagesById[bl.sourceId] : null;
          return (
            <button
              key={bl.sourceId}
              type="button"
              onClick={() => handleClickBacklink(bl)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-md bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors max-w-[200px]"
            >
              {bl.sourceType === 'page' && page ? (
                <ItemIcon
                  type={page.viewMode === 'tasks' ? 'tasks' : page.viewMode === 'collection' ? 'collection' : 'note'}
                  icon={page.icon}
                  color={page.color}
                  size="xs"
                />
              ) : (
                <Layers className="w-3 h-3 flex-shrink-0" />
              )}
              <span className="truncate">{bl.sourceTitle}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AddTaskForm;
