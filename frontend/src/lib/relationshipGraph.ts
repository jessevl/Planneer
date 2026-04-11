/**
 * @file relationshipGraph.ts
 * @description Builds a workspace relationship graph from pages, tasks, hierarchy, and internal links.
 * @app SHARED - Used by graph-oriented views and relationship visualizations
 */
import type { Page, PageViewMode } from '@/types/page';
import type { Task } from '@/types/task';

export type RelationshipGraphNodeType = 'page' | 'task' | 'hub' | 'tag';
export type RelationshipGraphEdgeType = 'page-child' | 'link' | 'tag';

export interface RelationshipGraphNode {
  id: string;
  entityId: string;
  type: RelationshipGraphNodeType;
  title: string;
  subtitle: string;
  pageViewMode?: PageViewMode;
  icon?: string | null;
  color?: string | null;
  parentPageId?: string | null;
  completed?: boolean;
  priority?: Task['priority'];
  tags?: string[];
  dueDate?: string;
}

export interface RelationshipGraphEdge {
  id: string;
  from: string;
  to: string;
  type: RelationshipGraphEdgeType;
  directed: boolean;
}

export interface RelationshipGraph {
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
  nodesById: Record<string, RelationshipGraphNode>;
  edgesByNodeId: Record<string, RelationshipGraphEdge[]>;
  degreeByNodeId: Record<string, number>;
  stats: {
    pages: number;
    tasks: number;
    tags: number;
    links: number;
    hierarchyEdges: number;
  };
}

export interface VisibleRelationshipGraph {
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
}

function toPageNodeId(pageId: string): string {
  return `page:${pageId}`;
}

function toTaskNodeId(taskId: string): string {
  return `task:${taskId}`;
}

function toTagNodeId(tag: string): string {
  return `tag:${tag.toLowerCase()}`;
}

function parseTags(tags?: string): string[] {
  if (!tags) return [];
  return tags
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function extractPageLinkedIds(content: string | null | undefined): string[] {
  if (!content) return [];

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      return [];
    }

    const linkedIds = new Set<string>();

    for (const block of Object.values(parsed as Record<string, unknown>)) {
      if (!block || typeof block !== 'object') continue;

      const candidate = block as {
        type?: string;
        value?: Array<{ props?: { linkedId?: string } }>;
      };

      if (candidate.type !== 'InternalLink' || !Array.isArray(candidate.value)) continue;

      for (const element of candidate.value) {
        const linkedId = element?.props?.linkedId;
        if (linkedId) {
          linkedIds.add(linkedId);
        }
      }
    }

    return Array.from(linkedIds);
  } catch {
    return [];
  }
}

export function collectGraphTasks(pages: Page[], tasks: Task[]): Task[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const linkedTaskIds = new Set<string>();

  for (const page of pages) {
    for (const linkedId of extractPageLinkedIds(page.content)) {
      if (taskById.has(linkedId)) {
        linkedTaskIds.add(linkedId);
      }
    }
  }

  for (const task of tasks) {
    let taskIsGraphRelevant = false;

    for (const linkedItem of task.linkedItems ?? []) {
      if (linkedItem.type === 'task' && taskById.has(linkedItem.id)) {
        linkedTaskIds.add(linkedItem.id);
        taskIsGraphRelevant = true;
      }

      if (linkedItem.type === 'page') {
        taskIsGraphRelevant = true;
      }
    }

    if (taskIsGraphRelevant) {
      linkedTaskIds.add(task.id);
    }
  }

  return tasks.filter((task) => linkedTaskIds.has(task.id));
}

export function buildRelationshipGraph(pages: Page[], tasks: Task[]): RelationshipGraph {
  const nodes: RelationshipGraphNode[] = [];
  const edges: RelationshipGraphEdge[] = [];
  const nodesById: Record<string, RelationshipGraphNode> = {};
  const edgesByNodeId: Record<string, RelationshipGraphEdge[]> = {};
  const degreeByNodeId: Record<string, number> = {};
  const edgeIds = new Set<string>();

  const nonDailyPages = pages.filter((page) => !page.isDailyNote);
  const graphTasks = collectGraphTasks(nonDailyPages, tasks);
  const pageIdSet = new Set(nonDailyPages.map((page) => page.id));
  const taskIdSet = new Set(graphTasks.map((task) => task.id));
  const tagSet = new Map<string, string>();

  const pushNode = (node: RelationshipGraphNode) => {
    nodes.push(node);
    nodesById[node.id] = node;
    edgesByNodeId[node.id] = [];
    degreeByNodeId[node.id] = 0;
  };

  const pushEdge = (edge: RelationshipGraphEdge) => {
    if (!nodesById[edge.from] || !nodesById[edge.to]) return;
    if (edgeIds.has(edge.id)) return;

    edgeIds.add(edge.id);
    edges.push(edge);
    edgesByNodeId[edge.from].push(edge);
    edgesByNodeId[edge.to].push(edge);
    degreeByNodeId[edge.from] += 1;
    degreeByNodeId[edge.to] += 1;
  };

  for (const page of nonDailyPages) {
    for (const tag of parseTags(page.tags)) {
      tagSet.set(tag.toLowerCase(), tag);
    }

    pushNode({
      id: toPageNodeId(page.id),
      entityId: page.id,
      type: 'page',
      title: page.title || 'Untitled',
      subtitle: page.viewMode === 'tasks' ? 'Tasks page' : page.viewMode === 'collection' ? 'Collection' : 'Page',
      pageViewMode: page.viewMode,
      icon: page.icon,
      color: page.color,
      parentPageId: page.parentId,
      tags: parseTags(page.tags),
    });
  }

  for (const task of graphTasks) {
    for (const tag of task.tag ? [task.tag] : []) {
      tagSet.set(tag.toLowerCase(), tag);
    }

    pushNode({
      id: toTaskNodeId(task.id),
      entityId: task.id,
      type: 'task',
      title: task.title || 'Untitled task',
      subtitle: task.completed ? 'Completed task' : 'Task',
      parentPageId: task.parentPageId ?? null,
      completed: task.completed,
      priority: task.priority,
      dueDate: task.dueDate,
      tags: task.tag ? [task.tag] : [],
    });
  }

  for (const [normalizedTag, originalTag] of tagSet.entries()) {
    pushNode({
      id: toTagNodeId(normalizedTag),
      entityId: normalizedTag,
      type: 'tag',
      title: originalTag,
      subtitle: 'Tag',
      color: '#f59e0b',
    });
  }

  for (const page of nonDailyPages) {
    if (!page.parentId || !pageIdSet.has(page.parentId)) continue;

    pushEdge({
      id: `page-child:${page.parentId}:${page.id}`,
      from: toPageNodeId(page.parentId),
      to: toPageNodeId(page.id),
      type: 'page-child',
      directed: true,
    });
  }

  for (const page of nonDailyPages) {
    const sourceId = toPageNodeId(page.id);

    for (const linkedId of extractPageLinkedIds(page.content)) {
      if (linkedId === page.id) continue;

      const targetNodeId = pageIdSet.has(linkedId)
        ? toPageNodeId(linkedId)
        : taskIdSet.has(linkedId)
          ? toTaskNodeId(linkedId)
          : null;

      if (!targetNodeId) continue;

      pushEdge({
        id: `link:${sourceId}:${targetNodeId}`,
        from: sourceId,
        to: targetNodeId,
        type: 'link',
        directed: true,
      });
    }
  }

  for (const task of graphTasks) {
    const sourceId = toTaskNodeId(task.id);

    for (const linkedItem of task.linkedItems ?? []) {
      if (linkedItem.id === task.id) continue;

      const targetNodeId = linkedItem.type === 'page'
        ? pageIdSet.has(linkedItem.id)
          ? toPageNodeId(linkedItem.id)
          : null
        : taskIdSet.has(linkedItem.id)
          ? toTaskNodeId(linkedItem.id)
          : null;

      if (!targetNodeId) continue;

      pushEdge({
        id: `link:${sourceId}:${targetNodeId}`,
        from: sourceId,
        to: targetNodeId,
        type: 'link',
        directed: true,
      });
    }
  }

  for (const page of nonDailyPages) {
    const sourceId = toPageNodeId(page.id);
    for (const tag of parseTags(page.tags)) {
      const targetId = toTagNodeId(tag.toLowerCase());
      pushEdge({
        id: `tag:${sourceId}:${targetId}`,
        from: sourceId,
        to: targetId,
        type: 'tag',
        directed: false,
      });
    }
  }

  for (const task of graphTasks) {
    const sourceId = toTaskNodeId(task.id);
    for (const tag of task.tag ? [task.tag] : []) {
      const targetId = toTagNodeId(tag.toLowerCase());
      pushEdge({
        id: `tag:${sourceId}:${targetId}`,
        from: sourceId,
        to: targetId,
        type: 'tag',
        directed: false,
      });
    }
  }

  return {
    nodes,
    edges,
    nodesById,
    edgesByNodeId,
    degreeByNodeId,
    stats: {
      pages: nonDailyPages.length,
      tasks: graphTasks.length,
      tags: tagSet.size,
      links: edges.filter((edge) => edge.type === 'link').length,
      hierarchyEdges: edges.filter((edge) => edge.type === 'page-child').length,
    },
  };
}

export function createVisibleRelationshipGraph(
  graph: RelationshipGraph,
  scopedPages: Page[],
  searchTerm: string,
  showHierarchy: boolean,
  showLinks: boolean,
  showTags: boolean,
  selectedNodeId: string | null,
  focusSelection: boolean,
): VisibleRelationshipGraph {
  const scopedPageIds = new Set(scopedPages.map((page) => relationshipGraphIds.page(page.id)));
  const hasScope = scopedPageIds.size > 0 && scopedPageIds.size < graph.stats.pages;
  const normalizedSearch = searchTerm.trim().toLowerCase();

  const allowedNodeIds = new Set(
    graph.nodes
      .filter((node) => {
        if (!showTags && node.type === 'tag') {
          return false;
        }
        return true;
      })
      .map((node) => node.id)
  );

  const visibleEdges = graph.edges.filter((edge) => {
    if (!allowedNodeIds.has(edge.from) || !allowedNodeIds.has(edge.to)) return false;
    if (edge.type === 'page-child') return showHierarchy;
    if (edge.type === 'tag') return showTags;
    return showLinks;
  });

  const adjacency = new Map<string, Set<string>>();
  for (const edge of visibleEdges) {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, new Set<string>());
    if (!adjacency.has(edge.to)) adjacency.set(edge.to, new Set<string>());
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }

  const seedIds = new Set<string>();

  if (hasScope) {
    for (const scopedId of scopedPageIds) {
      if (allowedNodeIds.has(scopedId)) {
        seedIds.add(scopedId);
      }
    }
  }

  if (normalizedSearch) {
    for (const node of graph.nodes) {
      if (!allowedNodeIds.has(node.id)) continue;
      const haystack = [node.title, node.subtitle, ...(node.tags ?? [])].join(' ').toLowerCase();
      if (haystack.includes(normalizedSearch)) {
        seedIds.add(node.id);
      }
    }
  }

  if (selectedNodeId && focusSelection && allowedNodeIds.has(selectedNodeId)) {
    seedIds.add(selectedNodeId);
  }

  let visibleNodeIds = new Set<string>(allowedNodeIds);

  if (seedIds.size > 0) {
    visibleNodeIds = new Set<string>();

    const queue = Array.from(seedIds).map((id) => ({ id, depth: 0 }));
    const seen = new Set<string>();
    const maxDepth = selectedNodeId && focusSelection ? 2 : 1;

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || seen.has(current.id)) continue;
      seen.add(current.id);
      visibleNodeIds.add(current.id);

      if (current.depth >= maxDepth) continue;

      for (const neighborId of adjacency.get(current.id) ?? []) {
        if (allowedNodeIds.has(neighborId)) {
          queue.push({ id: neighborId, depth: current.depth + 1 });
        }
      }
    }
  }

  const nodes = graph.nodes.filter((node) => visibleNodeIds.has(node.id));
  const edges = visibleEdges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to));

  return { nodes, edges };
}

export const relationshipGraphIds = {
  page: toPageNodeId,
  task: toTaskNodeId,
  tag: toTagNodeId,
};