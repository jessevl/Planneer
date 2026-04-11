/**
 * @file useBacklinks.ts
 * @description Hook to compute backlinks — pages/tasks that link TO a given target
 * @app SHARED - Used by PageHero and AddTaskForm
 * 
 * Scans two sources for references to the target ID:
 * 1. Page content: Yoopta JSON InternalLink blocks
 * 2. Task linkedItems: explicit link references stored on tasks
 * 
 * Uses a two-phase approach for page content scanning:
 * 1. Fast string check: skip pages whose content doesn't contain the target ID
 * 2. JSON parse + block scan: only for pages that pass the fast check
 */
import { useMemo } from 'react';
import { usePagesStore, type PagesState } from '@/stores/pagesStore';
import { useTasksStore } from '@/stores/tasksStore';

export interface Backlink {
  /** Type of the source item */
  sourceType: 'page' | 'task';
  /** ID of the source item */
  sourceId: string;
  /** Title of the source item */
  sourceTitle: string;
  /** Icon of the source (pages only) */
  sourceIcon: string | null;
  /** Color of the source (pages only) */
  sourceColor: string | null;
  /** ViewMode of the source page (pages only) */
  sourceViewMode: string;
}

/**
 * Extract backlinks from all pages and tasks that reference the given target ID.
 */
export function useBacklinks(targetId: string | null | undefined): Backlink[] {
  const pagesById = usePagesStore((s: PagesState) => s.pagesById);
  const tasksById = useTasksStore((s) => s.tasksById);

  return useMemo(() => {
    if (!targetId) return [];

    const backlinks: Backlink[] = [];
    const seen = new Set<string>();

    // 1. Scan page content for InternalLink blocks
    for (const page of Object.values(pagesById)) {
      if (page.id === targetId) continue;
      if (!page.content) continue;

      // Fast check: does the content string contain our target ID at all?
      if (!page.content.includes(targetId)) continue;

      // Slower check: parse and look for InternalLink blocks
      try {
        const content = JSON.parse(page.content);
        let found = false;
        for (const blockKey of Object.keys(content)) {
          const block = content[blockKey];
          if (block?.type === 'InternalLink') {
            const elements = block.value;
            if (Array.isArray(elements)) {
              for (const el of elements) {
                if (el?.props?.linkedId === targetId) {
                  found = true;
                  break;
                }
              }
            }
            if (found) break;
          }
        }

        if (found && !seen.has(page.id)) {
          seen.add(page.id);
          backlinks.push({
            sourceType: 'page',
            sourceId: page.id,
            sourceTitle: page.title || 'Untitled',
            sourceIcon: page.icon,
            sourceColor: page.color,
            sourceViewMode: page.viewMode,
          });
        }
      } catch {
        // Invalid JSON content — skip
      }
    }

    // 2. Scan task linkedItems for references to this target
    for (const task of Object.values(tasksById)) {
      if (task.id === targetId) continue;
      if (!task.linkedItems?.length) continue;

      const hasLink = task.linkedItems.some(item => item.id === targetId);
      if (hasLink && !seen.has(task.id)) {
        seen.add(task.id);
        backlinks.push({
          sourceType: 'task',
          sourceId: task.id,
          sourceTitle: task.title,
          sourceIcon: null,
          sourceColor: null,
          sourceViewMode: '',
        });
      }
    }

    return backlinks;
  }, [targetId, pagesById, tasksById]);
}
