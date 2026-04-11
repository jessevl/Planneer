import { describe, expect, it } from 'vitest';

import { buildRelationshipGraph, collectGraphTasks, extractPageLinkedIds, relationshipGraphIds } from './relationshipGraph';
import type { Page } from '@/types/page';
import type { Task } from '@/types/task';

function createPage(overrides: Partial<Page>): Page {
  return {
    id: overrides.id ?? 'page-1',
    title: overrides.title ?? 'Page',
    content: overrides.content ?? null,
    excerpt: overrides.excerpt ?? null,
    created: overrides.created ?? '2026-03-30T00:00:00.000Z',
    updated: overrides.updated ?? '2026-03-30T00:00:00.000Z',
    parentId: overrides.parentId ?? null,
    order: overrides.order ?? 0,
    icon: overrides.icon ?? null,
    color: overrides.color ?? null,
    coverImage: overrides.coverImage ?? null,
    coverGradient: overrides.coverGradient ?? null,
    coverAttribution: overrides.coverAttribution ?? null,
    images: overrides.images ?? [],
    files: overrides.files ?? [],
    viewMode: overrides.viewMode ?? 'note',
    childrenViewMode: overrides.childrenViewMode ?? 'list',
    isDailyNote: overrides.isDailyNote ?? false,
    dailyNoteDate: overrides.dailyNoteDate ?? null,
    childCount: overrides.childCount ?? 0,
    isExpanded: overrides.isExpanded ?? false,
    isPinned: overrides.isPinned ?? false,
    pinnedOrder: overrides.pinnedOrder ?? 0,
    ...overrides,
  };
}

function createTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? 'task-1',
    title: overrides.title ?? 'Task',
    completed: overrides.completed ?? false,
    ...overrides,
  };
}

describe('extractPageLinkedIds', () => {
  it('collects unique internal links from yoopta content', () => {
    const content = JSON.stringify({
      blockA: {
        type: 'InternalLink',
        value: [
          { props: { linkedId: 'page-2' } },
          { props: { linkedId: 'task-3' } },
          { props: { linkedId: 'page-2' } },
        ],
      },
      blockB: {
        type: 'paragraph',
        value: [],
      },
    });

    expect(extractPageLinkedIds(content)).toEqual(['page-2', 'task-3']);
  });
});

describe('buildRelationshipGraph', () => {
  it('builds hierarchy, explicit link, and tag edges without task hierarchy edges', () => {
    const pages = [
      createPage({ id: 'page-root', title: 'Root', tags: 'planning, focus' }),
      createPage({ id: 'page-child', title: 'Child', parentId: 'page-root' }),
      createPage({
        id: 'page-links',
        title: 'Links',
        content: JSON.stringify({
          blockA: {
            type: 'InternalLink',
            value: [{ props: { linkedId: 'task-linked' } }],
          },
        }),
      }),
    ];

    const tasks = [
      createTask({ id: 'task-linked', title: 'Linked task', parentPageId: 'page-root', tag: 'focus' }),
      createTask({ id: 'task-inbox', title: 'Inbox task', linkedItems: [{ type: 'page', id: 'page-child', title: 'Child' }] }),
    ];

    const graph = buildRelationshipGraph(pages, tasks);

    expect(graph.nodesById[relationshipGraphIds.page('page-root')]).toBeDefined();
    expect(graph.nodesById[relationshipGraphIds.task('task-linked')]).toBeDefined();
    expect(graph.nodesById[relationshipGraphIds.task('task-inbox')]).toBeDefined();
    expect(graph.nodesById[relationshipGraphIds.tag('focus')]).toBeDefined();

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'page-child:page-root:page-child',
          type: 'page-child',
        }),
        expect.objectContaining({
          id: `link:${relationshipGraphIds.page('page-links')}:${relationshipGraphIds.task('task-linked')}`,
          type: 'link',
        }),
        expect.objectContaining({
          id: `link:${relationshipGraphIds.task('task-inbox')}:${relationshipGraphIds.page('page-child')}`,
          type: 'link',
        }),
        expect.objectContaining({
          id: `tag:${relationshipGraphIds.page('page-root')}:${relationshipGraphIds.tag('planning')}`,
          type: 'tag',
        }),
      ])
    );

    expect(graph.stats).toEqual({
      pages: 3,
      tasks: 2,
      tags: 2,
      links: 2,
      hierarchyEdges: 1,
    });

    expect(graph.edges.some((edge) => edge.type === 'link' && edge.to === relationshipGraphIds.task('task-linked'))).toBe(true);
  });

  it('excludes tasks that are not explicitly linked from graph inputs and stats', () => {
    const pages = [
      createPage({ id: 'page-root', title: 'Root' }),
      createPage({
        id: 'page-links',
        title: 'Links',
        content: JSON.stringify({
          blockA: {
            type: 'InternalLink',
            value: [{ props: { linkedId: 'task-linked' } }],
          },
        }),
      }),
    ];

    const tasks = [
      createTask({ id: 'task-linked', title: 'Linked task' }),
      createTask({ id: 'task-hidden', title: 'Hidden task', parentPageId: 'page-root' }),
    ];

    const graphTasks = collectGraphTasks(pages, tasks);
    const graph = buildRelationshipGraph(pages, tasks);

    expect(graphTasks.map((task) => task.id)).toEqual(['task-linked']);
    expect(graph.nodesById[relationshipGraphIds.task('task-linked')]).toBeDefined();
    expect(graph.nodesById[relationshipGraphIds.task('task-hidden')]).toBeUndefined();
    expect(graph.stats.tasks).toBe(1);
  });
});