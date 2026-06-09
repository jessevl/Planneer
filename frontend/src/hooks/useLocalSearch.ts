/**
 * @file useLocalSearch.ts
 * @description Shared hook for FTS-primary search with instant local fallback
 * @app SHARED - Used by CommandPalette and InternalLinkPicker
 *
 * Strategy:
 * - When a query is present, FTS is the source of truth. Local-store title
 *   substring matches render instantly as a placeholder while FTS is in
 *   flight, then FTS results take over ordering once they arrive.
 * - Results are ranked by a composite score that boosts title matches over
 *   body-only matches, with FTS bm25 as a tiebreaker.
 * - When the query is empty (selection mode), results come from the local
 *   store sorted by `updated` DESC; for tasks, completed items are pushed
 *   to the bottom.
 * - FTS-returned snippets (with <MARK>...</MARK> sentinels) are surfaced
 *   via `snippetsById` for the consumer to render with HighlightedText.
 */
import { useMemo, useEffect } from 'react';
import { useSearch } from '@/hooks/useSearch';
import { useTasksStore } from '@/stores/tasksStore';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { UI } from '@/lib/config';
import type { Task } from '@/types/task';
import type { Page } from '@/types/page';

export interface ResultSnippets {
  /** Title with <MARK> sentinels (when matched) */
  titleSnippet?: string;
  /** Body/description excerpt with <MARK> sentinels */
  bodySnippet?: string;
}

export interface LocalSearchOptions {
  query: string;
  filterType?: 'all' | 'tasks' | 'pages';
  excludeDailyNotes?: boolean;
  /** Max combined results per type */
  localLimit?: number;
  /** Whether to show items when query is empty */
  showOnEmpty?: boolean;
}

export interface LocalSearchResults {
  tasks: Task[];
  pages: Page[];
  /** Snippets keyed by item id; only populated for FTS-matched rows */
  snippetsById: Record<string, ResultSnippets>;
  isSearching: boolean;
}

// ============================================================================
// SCORING
// ============================================================================

// Score bands keep title matches above body-only matches regardless of bm25.
const SCORE_TITLE_EXACT = 1000;
const SCORE_TITLE_PREFIX = 800;
const SCORE_TITLE_WORD_PREFIX = 600;
const SCORE_TITLE_SUBSTRING = 400;
const SCORE_BODY_ONLY = 200;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Cache compiled regexes per query string — compiled once per render pass
// since lowerQuery is the same for all candidates within a single useMemo run.
const wordBoundaryCache = new Map<string, RegExp>();
function wordBoundaryRegex(lowerQuery: string): RegExp {
  let re = wordBoundaryCache.get(lowerQuery);
  if (!re) {
    re = new RegExp(`(?:^|[\\s-])${escapeRegex(lowerQuery)}`);
    wordBoundaryCache.set(lowerQuery, re);
  }
  return re;
}

function titleScore(title: string, lowerQuery: string): number {
  const t = title.toLowerCase();
  if (t === lowerQuery) return SCORE_TITLE_EXACT;
  if (t.startsWith(lowerQuery)) return SCORE_TITLE_PREFIX;
  if (wordBoundaryRegex(lowerQuery).test(t)) return SCORE_TITLE_WORD_PREFIX;
  if (t.includes(lowerQuery)) return SCORE_TITLE_SUBSTRING;
  return 0;
}

/**
 * Compose a final score. Higher is better.
 * - Title band wins outright if the title matches.
 * - bm25 (lower-is-better) is folded in as a small bonus within a band.
 */
function compositeScore(title: string, lowerQuery: string, bm25Rank: number | null): number {
  const titleBand = titleScore(title, lowerQuery);
  // bm25 returns a negative number from sqlite (smaller = better match);
  // we just need a deterministic monotonic tiebreak in [0, 1).
  const ftsBonus = bm25Rank != null ? 1 / (1 + Math.abs(bm25Rank)) : 0;
  if (titleBand > 0) return titleBand + ftsBonus;
  // Body-only match: title didn't match but FTS hit body/description/excerpt.
  return bm25Rank != null ? SCORE_BODY_ONLY + ftsBonus : 0;
}

/**
 * Hook for FTS-primary search across tasks and pages with instant local fallback.
 */
export function useLocalSearch({
  query,
  filterType = 'all',
  excludeDailyNotes = false,
  localLimit = 10,
  showOnEmpty = false,
}: LocalSearchOptions): LocalSearchResults {
  const tasksById = useTasksStore((s) => s.tasksById);
  const pagesById = usePagesStore((s: PagesState) => s.pagesById);

  const { results: ftsResults, isSearching, doSearch } = useSearch({
    debounceMs: UI.SEARCH_DEBOUNCE_MS,
  });

  useEffect(() => {
    if (query.trim()) {
      doSearch(query);
    }
  }, [query, doSearch]);

  return useMemo<LocalSearchResults>(() => {
    const lowerQuery = query.toLowerCase().trim();
    const snippetsById: Record<string, ResultSnippets> = {};

    // ========================================================================
    // EMPTY QUERY — recents from local store
    // ========================================================================
    if (!lowerQuery) {
      if (!showOnEmpty) {
        return { tasks: [], pages: [], snippetsById, isSearching: false };
      }

      const tasks: Task[] = filterType === 'pages'
        ? []
        : Object.values(tasksById)
            .sort((a, b) => {
              // Incomplete first, then most-recently-updated first.
              if (a.completed !== b.completed) return a.completed ? 1 : -1;
              return (b.updated || '').localeCompare(a.updated || '');
            })
            .slice(0, localLimit);

      const pages: Page[] = filterType === 'tasks'
        ? []
        : Object.values(pagesById)
            .filter((p) => !excludeDailyNotes || !p.isDailyNote)
            .sort((a, b) => (b.updated || '').localeCompare(a.updated || ''))
            .slice(0, localLimit);

      return { tasks, pages, snippetsById, isSearching: false };
    }

    // ========================================================================
    // QUERY PRESENT — FTS primary, with instant local fallback while pending
    // ========================================================================

    // Collect FTS-known ids and snippets per type. FTS is the authoritative
    // signal when it's available; we still merge in any local title-substring
    // matches that FTS didn't surface (e.g. unsynced items, FTS lag).
    const ftsTaskRankById = new Map<string, number>();
    const ftsPageRankById = new Map<string, number>();

    // Only forward snippets that actually contain <MARK> sentinels. FTS5's
    // snippet() returns text from its column even when the match was on a
    // different column, so an unmarked snippet is just noise — we'd rather
    // fall back to the existing subtitle (parent collection / stored excerpt).
    if (filterType !== 'pages') {
      for (const t of ftsResults?.tasks ?? []) {
        ftsTaskRankById.set(t.id, t.rank);
        snippetsById[t.id] = {
          titleSnippet: hasMark(t.titleSnippet) ? t.titleSnippet : undefined,
          bodySnippet: hasMark(t.descriptionSnippet) ? t.descriptionSnippet : undefined,
        };
      }
    }

    if (filterType !== 'tasks') {
      for (const p of ftsResults?.pages ?? []) {
        ftsPageRankById.set(p.id, p.rank);
        snippetsById[p.id] = {
          titleSnippet: hasMark(p.titleSnippet) ? p.titleSnippet : undefined,
          bodySnippet: hasMark(p.bodySnippet) ? p.bodySnippet : undefined,
        };
      }
    }

    // -------- Tasks
    let tasks: Task[] = [];
    if (filterType !== 'pages') {
      const candidateIds = new Set<string>(ftsTaskRankById.keys());
      // Add local title-substring matches so instant results show before FTS lands.
      for (const t of Object.values(tasksById)) {
        if (candidateIds.has(t.id)) continue;
        if (
          t.title.toLowerCase().includes(lowerQuery) ||
          t.description?.toLowerCase().includes(lowerQuery)
        ) {
          candidateIds.add(t.id);
        }
      }

      tasks = Array.from(candidateIds)
        .map((id) => tasksById[id])
        .filter((t): t is Task => !!t)
        .map((t) => ({
          item: t,
          score: compositeScore(t.title, lowerQuery, ftsTaskRankById.get(t.id) ?? null),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => {
          // Completed tasks sink within their score band.
          if (a.item.completed !== b.item.completed) return a.item.completed ? 1 : -1;
          return b.score - a.score;
        })
        .slice(0, localLimit)
        .map((x) => x.item);
    }

    // -------- Pages
    let pages: Page[] = [];
    if (filterType !== 'tasks') {
      const candidateIds = new Set<string>(ftsPageRankById.keys());
      for (const p of Object.values(pagesById)) {
        if (candidateIds.has(p.id)) continue;
        if (excludeDailyNotes && p.isDailyNote) continue;
        if (p.title.toLowerCase().includes(lowerQuery)) {
          candidateIds.add(p.id);
        }
      }

      pages = Array.from(candidateIds)
        .map((id) => pagesById[id])
        .filter((p): p is Page => !!p && (!excludeDailyNotes || !p.isDailyNote))
        .map((p) => ({
          item: p,
          score: compositeScore(p.title, lowerQuery, ftsPageRankById.get(p.id) ?? null),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, localLimit)
        .map((x) => x.item);
    }

    return { tasks, pages, snippetsById, isSearching };
  }, [query, tasksById, pagesById, ftsResults, filterType, excludeDailyNotes, localLimit, showOnEmpty, isSearching]);
}

function hasMark(s: string | undefined): boolean {
  return !!s && s.includes('<MARK>');
}
