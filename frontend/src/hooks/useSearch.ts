/**
 * @file useSearch.ts
 * @description Custom hook for full-text search functionality
 * @app SHARED - Search across tasks and pages
 */

import { useState, useCallback, useRef } from 'react';
import { search, SearchResults, SearchType } from '@/api/searchApi';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { UI } from '@/lib/config';

interface UseSearchOptions {
  /** Search type: 'all', 'tasks', or 'pages' */
  type?: SearchType;
  /** Maximum results per type */
  limit?: number;
  /** Debounce delay in milliseconds (defaults to UI.SEARCH_DEBOUNCE_MS) */
  debounceMs?: number;
}

interface UseSearchResult {
  /** Current search query */
  query: string;
  /** Search results */
  results: SearchResults | null;
  /** Whether a search is in progress */
  isSearching: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Execute a search */
  doSearch: (query: string) => Promise<void>;
  /** Clear search results */
  clearSearch: () => void;
}

/**
 * Hook for performing full-text search across tasks and pages
 * 
 * @example
 * ```tsx
 * const { query, results, isSearching, doSearch, clearSearch } = useSearch();
 * 
 * // In a search input handler
 * const handleSearch = (e) => {
 *   doSearch(e.target.value);
 * };
 * 
 * // Render results
 * {results?.tasks.map(task => <TaskResult key={task.id} task={task} />)}
 * {results?.pages.map(note => <NoteResult key={note.id} note={note} />)}
 * ```
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const { type = 'all', limit = 20, debounceMs = UI.SEARCH_DEBOUNCE_MS } = options;
  
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (searchQuery: string) => {
    // Update the query state immediately for responsive UI
    setQuery(searchQuery);
    
    // Clear any pending debounced search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // If query is empty, clear results immediately
    if (!searchQuery.trim()) {
      setResults(null);
      setError(null);
      setIsSearching(false);
      return;
    }
    
    if (!workspaceId) {
      setError('No workspace selected');
      return;
    }
    
    // Debounce the actual search
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      
      abortControllerRef.current = new AbortController();
      
      try {
        const searchResults = await search(searchQuery, workspaceId, type, limit);
        setResults(searchResults);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults(null);
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);
  }, [workspaceId, type, limit, debounceMs]);

  const clearSearch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setQuery('');
    setResults(null);
    setError(null);
    setIsSearching(false);
  }, []);

  return {
    query,
    results,
    isSearching,
    error,
    doSearch,
    clearSearch,
  };
}
