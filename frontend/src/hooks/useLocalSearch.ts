/**
 * @file useLocalSearch.ts
 * @description Shared hook for local-first search with FTS fallback
 * @app SHARED - Used by CommandPalette and InternalLinkPicker
 * 
 * Provides instant local search results from Zustand stores,
 * merged with full-text search results from the backend.
 */
import { useMemo, useEffect } from 'react';
import { useSearch } from '@/hooks/useSearch';
import { useTasksStore } from '@/stores/tasksStore';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { UI } from '@/lib/config';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';

// Backward compat alias
type Note = Page;

export interface LocalSearchOptions {
  /** Search query string */
  query: string;
  /** Filter results to specific type */
  filterType?: 'all' | 'tasks' | 'pages';
  /** Exclude daily notes from results */
  excludeDailyNotes?: boolean;
  /** Max results per type for local search */
  localLimit?: number;
  /** Whether to show items when query is empty */
  showOnEmpty?: boolean;
}

export interface LocalSearchResults {
  tasks: Task[];
  pages: Note[];
  isSearching: boolean;
}

/**
 * Hook for local-first search across tasks and pages.
 * 
 * Returns instant results from local stores, merged with FTS results.
 * Deduplicates by ID, preferring local store data over FTS data.
 */
export function useLocalSearch({
  query,
  filterType = 'all',
  excludeDailyNotes = false,
  localLimit = 10,
  showOnEmpty = false,
}: LocalSearchOptions): LocalSearchResults {
  const tasksById = useTasksStore((s) => s.tasksById);
  const notesById = usePagesStore((s: PagesState) => s.pagesById);
  
  // Full-text search hook
  const { results: ftsResults, isSearching, doSearch } = useSearch({ 
    debounceMs: UI.SEARCH_DEBOUNCE_MS 
  });
  
  // Trigger FTS when query changes (using useEffect for side effects)
  useEffect(() => {
    if (query.trim()) {
      doSearch(query);
    }
  }, [query, doSearch]);
  
  // Local search - instant results from stores
  const localResults = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();
    
    if (!lowerQuery && !showOnEmpty) {
      return { tasks: [], notes: [] };
    }
    
    // Search/filter tasks
    let matchedTasks: Task[] = [];
    if (filterType !== 'pages') {
      if (lowerQuery) {
        matchedTasks = Object.values(tasksById)
          .filter(task => 
            task.title.toLowerCase().includes(lowerQuery) ||
            task.description?.toLowerCase().includes(lowerQuery)
          )
          .slice(0, localLimit);
      } else if (showOnEmpty) {
        matchedTasks = Object.values(tasksById).slice(0, localLimit);
      }
    }
    
    // Search/filter pages
    let matchedNotes: Note[] = [];
    if (filterType !== 'tasks') {
      const pageFilter = (note: Note) => {
        if (excludeDailyNotes && note.isDailyNote) return false;
        if (!lowerQuery) return true;
        return (
          note.title.toLowerCase().includes(lowerQuery)
        );
      };
      
      if (lowerQuery || showOnEmpty) {
        matchedNotes = Object.values(notesById)
          .filter(pageFilter)
          .sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))
          .slice(0, localLimit);
      }
    }
    
    return { tasks: matchedTasks, pages: matchedNotes };
  }, [query, tasksById, notesById, filterType, excludeDailyNotes, localLimit, showOnEmpty]);
  
  // Merge local and FTS results
  const mergedResults = useMemo((): LocalSearchResults => {
    const seenTaskIds = new Set<string>();
    const seenNoteIds = new Set<string>();
    
    const tasks: Task[] = [];
    const pages: Note[] = [];
    
    // Local results first (they appear instantly)
    localResults.tasks.forEach(t => {
      if (!seenTaskIds.has(t.id)) {
        seenTaskIds.add(t.id);
        tasks.push(t);
      }
    });
    
    localResults.pages?.forEach(n => {
      if (!seenNoteIds.has(n.id)) {
        seenNoteIds.add(n.id);
        pages.push(n);
      }
    });
    
    // Add FTS results
    if (filterType !== 'pages') {
      ftsResults?.tasks.forEach(t => {
        if (!seenTaskIds.has(t.id)) {
          seenTaskIds.add(t.id);
          const localTask = tasksById[t.id];
          if (localTask) tasks.push(localTask);
        }
      });
    }
    
    if (filterType !== 'tasks') {
      // Use pages if available, fall back to deprecated pages
      const ftsNotes = ftsResults?.pages ?? ftsResults?.pages ?? [];
      ftsNotes.forEach(n => {
        if (!seenNoteIds.has(n.id)) {
          seenNoteIds.add(n.id);
          const localNote = notesById[n.id];
          if (localNote && (!excludeDailyNotes || !localNote.isDailyNote)) {
            pages.push(localNote);
          }
        }
      });
    }
    
    return { tasks, pages, isSearching };
  }, [localResults, ftsResults, tasksById, notesById, filterType, excludeDailyNotes, isSearching]);
  
  return mergedResults;
}
