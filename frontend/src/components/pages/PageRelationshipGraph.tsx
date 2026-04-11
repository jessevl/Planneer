/**
 * @file PageRelationshipGraph.tsx
 * @description Interactive workspace graph for pages and tasks with hierarchy and backlink relationships
 * @app PAGES - Used by GraphView
 *
 * Features:
 * - Page and task nodes in a single navigable canvas
 * - Parent-child, tag, and explicit backlink/link edges
 * - Floating controls, search, hover highlighting, and inspector
 * - Deterministic tree/task layout with stable spacing
 * - Wheel zoom that stays inside the canvas without scrolling the page
 *
 * Used by:
 * - GraphView
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Network, Plus, Tag } from 'lucide-react';

import type { Page } from '@/types/page';
import type { Task } from '@/types/task';
import { relationshipGraphIds, type RelationshipGraph, type RelationshipGraphEdge, type RelationshipGraphNode, type VisibleRelationshipGraph } from '@/lib/relationshipGraph';
import { Button, FloatingPanel } from '@/components/ui';
import { cn } from '@/lib/design-system';
import ItemIcon from '@/components/common/ItemIcon';
import { CheckIcon } from '@/components/common/Icons';
import { useUIStore } from '@/stores/uiStore';

interface PageRelationshipGraphProps {
  /** Complete page set used to build the graph model. */
  allPages: Page[];
  /** All tasks in the current workspace. */
  tasks: Task[];
  /** Shared graph model from the parent view. */
  graph: RelationshipGraph;
  /** Currently visible nodes and edges after filters are applied. */
  visibleGraph: VisibleRelationshipGraph;
  /** Selected node id controlled by the parent view. */
  selectedNodeId: string | null;
  /** Selection handler controlled by the parent view. */
  onSelectedNodeIdChange: (nodeId: string | null) => void;
  /** Current graph search query. */
  searchTerm?: string;
  /** Optional floating controls overlay rendered above the canvas. */
  topLeftOverlay?: React.ReactNode;
  /** Whether to show the floating inspector. */
  showInspector?: boolean;
  /** Whether to show canvas usage hints. */
  showCanvasHints?: boolean;
  /** Compact layout for narrow sidepanel embedding — tighter spacing and more local zoom. */
  compact?: boolean;
}

export interface PageRelationshipGraphHandle {
  fit: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface GraphPosition {
  x: number;
  y: number;
}

interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

interface VisibleGraph {
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
}

interface PaginatedVisibleGraph {
  graph: VisibleGraph;
  hiddenChildrenByParent: Map<string, number>;
  hiddenTasksByParent: Map<string, number>;
}

interface SyntheticClusterCard {
  id: string;
  parentId: string;
  x: number;
  y: number;
  hiddenCount: number;
  revealCount: number;
}

type LocalGraphRole = 'center' | 'ancestor' | 'descendant' | 'linked' | 'task' | 'related';

const PAGE_X_STEP = 352;
const ROOT_X = 224;
const PAGE_HEADER_HEIGHT = 156;
const PAGE_GAP_Y = 42;
const TASK_ROW_GAP = 128;
const TASK_COLUMN_OFFSET = 118;
const TASK_ROW_PADDING = 22;
const MIN_BLOCK_HEIGHT = 176;
const WORLD_PADDING = 180;
const PAGE_NODE_WIDTH = 252;
const TASK_NODE_WIDTH = 212;
const HUB_NODE_WIDTH = 184;
const NODE_HALF_HEIGHT = 50;
const ROOT_RADIUS = 280;
const DEPTH_RADIUS_STEP = 250;
const TASK_RING_RADIUS = 165;
const TASK_RING_STEP = 94;
const TASKS_PER_RING = 4;
const MIN_SECTOR_SPAN = Math.PI / 7;
const DEFAULT_VISIBLE_CHILDREN = 8;
const DEFAULT_VISIBLE_TASKS = 6;
const LOAD_MORE_STEP = 8;
const LARGE_CHILDREN_STEP = 24;
const XL_CHILDREN_STEP = 100;
const EXPAND_ALL_CHILDREN_LIMIT = 250;
const TAG_NODE_WIDTH = 168;
const CLUSTER_CARD_WIDTH = 216;
const CLUSTER_CARD_WIDTH_COMPACT = 188;
const CLUSTER_CARD_HALF_HEIGHT = 56;

interface PageLayoutMaps {
  childrenByParent: Map<string | null, string[]>;
  taskNodesByParent: Map<string, RelationshipGraphNode[]>;
  nodeHeights: Map<string, number>;
  parentOfNode: Map<string, string | null>;
  subtreeWeights: Map<string, number>;
}

function polarToCartesian(radius: number, angle: number): GraphPosition {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

function paginateGraphNodes(
  visibleGraph: VisibleGraph,
  graph: RelationshipGraph,
  allPages: Page[],
  _tasks: Task[],
  selectedNodeId: string | null,
  searchTerm: string,
  expandedChildrenByParent: Map<string, number>,
  expandedTasksByParent: Map<string, number>,
): PaginatedVisibleGraph {
  if (searchTerm.trim()) {
    return {
      graph: visibleGraph,
      hiddenChildrenByParent: new Map<string, number>(),
      hiddenTasksByParent: new Map<string, number>(),
    };
  }

  const pageOrder = new Map(allPages.map((page) => [page.id, page.order ?? 0]));
  const pageChildrenByParent = new Map<string | null, string[]>();
  const parentByNodeId = new Map<string, string | null>();

  for (const edge of visibleGraph.edges) {
    if (edge.type === 'page-child') {
      const childIds = pageChildrenByParent.get(edge.from) ?? [];
      childIds.push(edge.to);
      pageChildrenByParent.set(edge.from, childIds);
      parentByNodeId.set(edge.to, edge.from);
    }
  }

  for (const [parentId, childIds] of pageChildrenByParent.entries()) {
    childIds.sort((left, right) => {
      const leftPageId = graph.nodesById[left]?.entityId ?? '';
      const rightPageId = graph.nodesById[right]?.entityId ?? '';
      return (pageOrder.get(leftPageId) ?? 0) - (pageOrder.get(rightPageId) ?? 0)
        || (graph.nodesById[left]?.title ?? '').localeCompare(graph.nodesById[right]?.title ?? '');
    });
    pageChildrenByParent.set(parentId, childIds);
  }

  const selectedPath = new Set<string>();
  let cursor = selectedNodeId;
  while (cursor) {
    selectedPath.add(cursor);
    cursor = parentByNodeId.get(cursor) ?? null;
  }

  const allowedNodeIds = new Set<string>();
  const hiddenChildrenByParent = new Map<string, number>();
  const hiddenTasksByParent = new Map<string, number>();
  const visiblePageRoots = visibleGraph.nodes
    .filter((node) => node.type === 'page' && !parentByNodeId.has(node.id))
    .map((node) => node.id)
    .sort((left, right) => (graph.nodesById[left]?.title ?? '').localeCompare(graph.nodesById[right]?.title ?? ''));

  const visitPageNode = (nodeId: string) => {
    allowedNodeIds.add(nodeId);

    const childIds = pageChildrenByParent.get(nodeId) ?? [];
    const expandedChildren = expandedChildrenByParent.get(nodeId) ?? DEFAULT_VISIBLE_CHILDREN;
    const visibleChildren = new Set<string>([
      ...childIds.slice(0, expandedChildren),
      ...childIds.filter((childId) => selectedPath.has(childId)),
    ]);

    hiddenChildrenByParent.set(nodeId, Math.max(0, childIds.length - visibleChildren.size));
    for (const childId of childIds) {
      if (visibleChildren.has(childId)) {
        visitPageNode(childId);
      }
    }

    hiddenTasksByParent.set(nodeId, 0);
  };

  for (const rootId of visiblePageRoots) {
    visitPageNode(rootId);
  }

  if (selectedNodeId && visibleGraph.nodes.some((node) => node.id === selectedNodeId)) {
    allowedNodeIds.add(selectedNodeId);
  }

  for (const edge of visibleGraph.edges) {
    if (edge.type === 'page-child' || edge.type === 'tag') continue;
    if (allowedNodeIds.has(edge.from) || allowedNodeIds.has(edge.to)) {
      allowedNodeIds.add(edge.from);
      allowedNodeIds.add(edge.to);
    }
  }

  const allowedEdges = visibleGraph.edges.filter((edge) => {
    if (edge.type === 'tag') {
      return allowedNodeIds.has(edge.from) || allowedNodeIds.has(edge.to);
    }
    return allowedNodeIds.has(edge.from) && allowedNodeIds.has(edge.to);
  });

  for (const edge of allowedEdges) {
    allowedNodeIds.add(edge.from);
    allowedNodeIds.add(edge.to);
  }

  return {
    graph: {
      nodes: visibleGraph.nodes.filter((node) => allowedNodeIds.has(node.id)),
      edges: allowedEdges.filter((edge) => allowedNodeIds.has(edge.from) && allowedNodeIds.has(edge.to)),
    },
    hiddenChildrenByParent,
    hiddenTasksByParent,
  };
}

function getVisibleDepth(
  nodeId: string,
  childrenByParent: Map<string | null, string[]>,
  parentOfNode: Map<string, string | null>,
  cache: Map<string, number>,
): number {
  const cached = cache.get(nodeId);
  if (cached !== undefined) return cached;

  const parentId = parentOfNode.get(nodeId) ?? null;
  if (parentId === null) {
    cache.set(nodeId, 0);
    return 0;
  }

  const depth = getVisibleDepth(parentId, childrenByParent, parentOfNode, cache) + 1;
  cache.set(nodeId, depth);
  return depth;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatChildPageLabel(value: number): string {
  return `${value.toLocaleString()} child ${value === 1 ? 'page' : 'pages'}`;
}

function getChildExpansionStep(hiddenCount: number, compact: boolean): number {
  if (hiddenCount <= 0) return 0;
  if (compact) {
    if (hiddenCount > 240) return 48;
    if (hiddenCount > 60) return 24;
    return Math.min(12, hiddenCount);
  }
  if (hiddenCount > 600) return XL_CHILDREN_STEP;
  if (hiddenCount > 120) return LARGE_CHILDREN_STEP;
  return Math.min(12, hiddenCount);
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildPageLayoutMaps(visibleGraph: VisibleGraph, pagesById: Record<string, Page>): PageLayoutMaps {
  const childrenByParent = new Map<string | null, string[]>();
  const taskNodesByParent = new Map<string, RelationshipGraphNode[]>();
  const nodeHeights = new Map<string, number>();
  const subtreeWeights = new Map<string, number>();

  const pageNodes = visibleGraph.nodes.filter((node) => node.type === 'page');
  const visiblePageIds = new Set(pageNodes.map((node) => node.entityId));

  for (const pageNode of pageNodes) {
    const page = pagesById[pageNode.entityId];
    const parentId = page?.parentId && visiblePageIds.has(page.parentId)
      ? relationshipGraphIds.page(page.parentId)
      : null;
    if (!childrenByParent.has(parentId)) {
      childrenByParent.set(parentId, []);
    }
    childrenByParent.get(parentId)?.push(pageNode.id);
  }

  for (const childIds of childrenByParent.values()) {
    childIds.sort((left, right) => {
      const leftPage = pagesById[left.replace(/^page:/, '')];
      const rightPage = pagesById[right.replace(/^page:/, '')];
      return (leftPage?.order ?? 0) - (rightPage?.order ?? 0)
        || (leftPage?.title ?? '').localeCompare(rightPage?.title ?? '');
    });
  }

  for (const nodes of taskNodesByParent.values()) {
    nodes.sort((left, right) => left.title.localeCompare(right.title));
  }

  const measureHeight = (nodeId: string): number => {
    const cached = nodeHeights.get(nodeId);
    if (cached !== undefined) return cached;

    const tasksForNode = taskNodesByParent.get(nodeId) ?? [];
    const taskRows = Math.ceil(tasksForNode.length / 2);
    const tasksHeight = taskRows > 0 ? (taskRows * TASK_ROW_GAP) + TASK_ROW_PADDING : 0;
    const childIds = childrenByParent.get(nodeId) ?? [];
    const childrenHeight = childIds.reduce((total, childId, index) => {
      return total + measureHeight(childId) + (index === childIds.length - 1 ? 0 : PAGE_GAP_Y);
    }, 0);

    const measured = Math.max(MIN_BLOCK_HEIGHT, PAGE_HEADER_HEIGHT + tasksHeight + (childrenHeight > 0 ? PAGE_GAP_Y + childrenHeight : 0));
    nodeHeights.set(nodeId, measured);
    return measured;
  };

  const roots = childrenByParent.get(null) ?? [];
  roots.forEach((rootId) => measureHeight(rootId));

  const measureWeight = (nodeId: string): number => {
    const cached = subtreeWeights.get(nodeId);
    if (cached !== undefined) return cached;

    const childIds = childrenByParent.get(nodeId) ?? [];
    const tasksForNode = taskNodesByParent.get(nodeId) ?? [];
    const childWeight = childIds.reduce((total, childId) => total + measureWeight(childId), 0);
    const taskWeight = tasksForNode.length * 0.65;
    const weight = Math.max(1, 1 + childWeight + taskWeight);
    subtreeWeights.set(nodeId, weight);
    return weight;
  };

  for (const rootId of roots) {
    measureWeight(rootId);
  }

  // Build parent-of-node map for depth calculation within visible graph
  const parentOfNode = new Map<string, string | null>();
  for (const [parentId, children] of childrenByParent.entries()) {
    for (const childId of children) {
      parentOfNode.set(childId, parentId);
    }
  }

  return { childrenByParent, taskNodesByParent, nodeHeights, parentOfNode, subtreeWeights };
}

function layoutGraph(
  visibleGraph: VisibleGraph,
  allPages: Page[],
  compact = false,
): { positions: Record<string, GraphPosition>; bounds: GraphBounds } {
  const rRoot = compact ? 210 : ROOT_RADIUS;
  const rDepthStep = compact ? 165 : DEPTH_RADIUS_STEP;
  const rTaskRing = compact ? 132 : TASK_RING_RADIUS;
  const rTaskStep = compact ? 72 : TASK_RING_STEP;
  const collisionMinPP = compact ? 232 : 248;
  const collisionMinMixed = compact ? 206 : 222;
  const collisionMinTT = compact ? 176 : 188;
  const tagRadiusOffset = compact ? 86 : 110;
  const positions: Record<string, GraphPosition> = {};
  const pagesById = allPages.reduce<Record<string, Page>>((accumulator, page) => {
    accumulator[page.id] = page;
    return accumulator;
  }, {});

  const { childrenByParent, taskNodesByParent, parentOfNode, subtreeWeights } = buildPageLayoutMaps(visibleGraph, pagesById);
  const depthCache = new Map<string, number>();

  const placeTasks = (parentNodeId: string, centerX: number, centerY: number, centerAngle: number, sectorSpan: number) => {
    const tasksForParent = taskNodesByParent.get(parentNodeId) ?? [];
    tasksForParent.forEach((taskNode, index) => {
      const ringIndex = Math.floor(index / TASKS_PER_RING);
      const indexInRing = index % TASKS_PER_RING;
      const itemsInRing = Math.min(TASKS_PER_RING, tasksForParent.length - (ringIndex * TASKS_PER_RING));
      const ringRadius = rTaskRing + (ringIndex * rTaskStep);
      const spread = clamp(Math.max(sectorSpan * 0.62, 0.8), 0.8, 1.75);
      const taskAngle = itemsInRing === 1
        ? centerAngle
        : centerAngle - (spread / 2) + (spread * (indexInRing / Math.max(itemsInRing - 1, 1)));
      const offset = polarToCartesian(ringRadius, taskAngle);
      positions[taskNode.id] = {
        x: centerX + offset.x,
        y: centerY + offset.y,
      };
    });
  };

  const layoutPageNode = (nodeId: string, startAngle: number, endAngle: number) => {
    const depth = getVisibleDepth(nodeId, childrenByParent, parentOfNode, depthCache);
    const angle = (startAngle + endAngle) / 2;
    const radius = rRoot + (depth * rDepthStep);
    const point = polarToCartesian(radius, angle);
    positions[nodeId] = point;

    placeTasks(nodeId, point.x, point.y, angle, endAngle - startAngle);

    const childIds = childrenByParent.get(nodeId) ?? [];
    if (childIds.length === 0) return;

    const totalWeight = childIds.reduce((total, childId) => total + (subtreeWeights.get(childId) ?? 1), 0);
    const availableSpan = Math.max(endAngle - startAngle, MIN_SECTOR_SPAN);
    let cursorAngle = startAngle;

    for (const childId of childIds) {
      const weight = subtreeWeights.get(childId) ?? 1;
      const childSpan = availableSpan * (weight / Math.max(totalWeight, 1));
      layoutPageNode(childId, cursorAngle, cursorAngle + childSpan);
      cursorAngle += childSpan;
    }
  };

  const rootIds = [...(childrenByParent.get(null) ?? [])];

  const totalRootWeight = rootIds.reduce((total, rootId) => total + (subtreeWeights.get(rootId) ?? 1), 0);
  let cursorAngle = -Math.PI / 2;

  for (const rootId of rootIds) {
    const weight = subtreeWeights.get(rootId) ?? 1;
    const rootSpan = (Math.PI * 2) * (weight / Math.max(totalRootWeight, 1));
    const span = Math.max(rootSpan, MIN_SECTOR_SPAN);

    layoutPageNode(rootId, cursorAngle, cursorAngle + span);

    cursorAngle += span;
  }

  for (const childIds of childrenByParent.values()) {
    if (childIds.length <= 1) continue;

    const positionedChildren = childIds
      .map((childId) => ({ childId, position: positions[childId] }))
      .filter((entry): entry is { childId: string; position: GraphPosition } => Boolean(entry.position));

    if (positionedChildren.length <= 1) continue;

    const minArcGap = compact ? 228 : 252;
    const bandStep = compact ? 156 : 188;
    const averageRadius = positionedChildren.reduce((sum, entry) => sum + Math.hypot(entry.position.x, entry.position.y), 0) / positionedChildren.length;
    const estimatedCapacity = Math.max(1, Math.floor(((Math.PI * 2) * Math.max(averageRadius, 1)) / minArcGap));

    if (positionedChildren.length <= estimatedCapacity) continue;

    positionedChildren.forEach((entry, index) => {
      const bandIndex = Math.floor(index / estimatedCapacity);
      if (bandIndex === 0) return;

      const angle = Math.atan2(entry.position.y, entry.position.x);
      const radius = Math.hypot(entry.position.x, entry.position.y) + (bandIndex * bandStep);
      positions[entry.childId] = polarToCartesian(radius, angle);
    });
  }

  const unpositionedNodes = visibleGraph.nodes.filter((node) => !positions[node.id] && node.type !== 'tag');
  unpositionedNodes.forEach((node, index) => {
    const connectedPositions = visibleGraph.edges
      .filter((edge) => edge.from === node.id || edge.to === node.id)
      .map((edge) => positions[edge.from === node.id ? edge.to : edge.from])
      .filter((position): position is GraphPosition => Boolean(position));

    if (connectedPositions.length === 0) {
      const fallbackOffset = index - ((unpositionedNodes.length - 1) / 2);
      positions[node.id] = {
        x: fallbackOffset * 280,
        y: rRoot + rDepthStep,
      };
      return;
    }

    const averageX = connectedPositions.reduce((sum, position) => sum + position.x, 0) / connectedPositions.length;
    const averageY = connectedPositions.reduce((sum, position) => sum + position.y, 0) / connectedPositions.length;
    const anchorAngle = Math.atan2(averageY, averageX);
    const spread = ((index % 5) - 2) * 0.24;
    const offset = polarToCartesian(node.type === 'task' ? rTaskRing : 132, anchorAngle + spread);

    positions[node.id] = {
      x: averageX + offset.x,
      y: averageY + offset.y,
    };
  });

  const tagNodes = visibleGraph.nodes.filter((node) => node.type === 'tag');
  for (const tagNode of tagNodes) {
    const connectedEdges = visibleGraph.edges.filter((edge) => edge.type === 'tag' && (edge.from === tagNode.id || edge.to === tagNode.id));
    const connectedPositions = connectedEdges
      .map((edge) => positions[edge.from === tagNode.id ? edge.to : edge.from])
      .filter((position): position is GraphPosition => Boolean(position));

    if (connectedPositions.length === 0) continue;

    const averageX = connectedPositions.reduce((sum, position) => sum + position.x, 0) / connectedPositions.length;
    const averageY = connectedPositions.reduce((sum, position) => sum + position.y, 0) / connectedPositions.length;
    const averageAngle = Math.atan2(averageY, averageX);
    const tagRadius = Math.sqrt((averageX * averageX) + (averageY * averageY)) + tagRadiusOffset;
    const tagPoint = polarToCartesian(tagRadius, averageAngle + ((hashString(tagNode.id) % 24) - 12) * 0.018);
    positions[tagNode.id] = tagPoint;
  }

  // Collision resolution — push ALL overlapping nodes apart
  for (let iteration = 0; iteration < 16; iteration += 1) {
    for (let firstIndex = 0; firstIndex < visibleGraph.nodes.length; firstIndex += 1) {
      const firstNode = visibleGraph.nodes[firstIndex];
      const first = positions[firstNode.id];
      if (!first) continue;

      for (let secondIndex = firstIndex + 1; secondIndex < visibleGraph.nodes.length; secondIndex += 1) {
        const secondNode = visibleGraph.nodes[secondIndex];
        const second = positions[secondNode.id];
        if (!second) continue;

        const dx = first.x - second.x;
        const dy = first.y - second.y;
        const distance = Math.max(Math.sqrt((dx * dx) + (dy * dy)), 0.5);
        const bothPages = firstNode.type === 'page' && secondNode.type === 'page';
        const minDistance = bothPages ? collisionMinPP : (firstNode.type === 'page' || secondNode.type === 'page') ? collisionMinMixed : collisionMinTT;
        if (distance >= minDistance) continue;

        const strength = ((minDistance - distance) / minDistance) * 0.45;
        const offsetX = (dx / distance) * minDistance * strength;
        const offsetY = (dy / distance) * minDistance * strength;

        first.x += offsetX;
        first.y += offsetY;
        second.x -= offsetX;
        second.y -= offsetY;
      }
    }
  }

  const allPositions = Object.values(positions);
  const minX = Math.min(...allPositions.map((position) => position.x), 90);
  const maxX = Math.max(...allPositions.map((position) => position.x), 960);
  const minY = Math.min(...allPositions.map((position) => position.y), 90);
  const maxY = Math.max(...allPositions.map((position) => position.y), 720);

  return {
    positions,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

function centeredOffsets(count: number, gap: number): number[] {
  if (count <= 0) return [];
  const midpoint = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => (index - midpoint) * gap);
}

function buildCenteredGridPositions(
  count: number,
  columns: number,
  columnGap: number,
  rowGap: number,
): GraphPosition[] {
  if (count <= 0) return [];

  const safeColumns = Math.max(1, columns);
  const positions: GraphPosition[] = [];

  for (let start = 0, row = 0; start < count; start += safeColumns, row += 1) {
    const end = Math.min(start + safeColumns, count);
    const rowCount = end - start;
    const rowOffsets = centeredOffsets(rowCount, columnGap);

    for (let index = 0; index < rowCount; index += 1) {
      positions.push({
        x: rowOffsets[index] ?? 0,
        y: row * rowGap,
      });
    }
  }

  return positions;
}

function stackedVerticalOffsets(count: number, step: number, centerGap: number): number[] {
  if (count <= 0) return [];

  const offsets: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const ring = Math.floor(index / 2);
    const direction = index % 2 === 0 ? -1 : 1;
    offsets.push(direction * (centerGap + (ring * step)));
  }

  return offsets;
}

function getLocalHierarchyColumnCount(count: number, compact: boolean): number {
  if (count <= 1) return 1;
  if (count <= 4) return Math.min(count, 2);
  return compact ? Math.min(4, Math.ceil(Math.sqrt(count))) : Math.min(5, Math.ceil(Math.sqrt(count)));
}

function buildSyntheticClusterCards(
  renderedGraph: VisibleGraph,
  positions: Record<string, GraphPosition>,
  hiddenChildrenByParent: Map<string, number>,
  compact: boolean,
): SyntheticClusterCard[] {
  const cards: SyntheticClusterCard[] = [];

  const childEdgesByParent = new Map<string, RelationshipGraphEdge[]>();
  for (const edge of renderedGraph.edges) {
    if (edge.type !== 'page-child') continue;
    const parentEdges = childEdgesByParent.get(edge.from) ?? [];
    parentEdges.push(edge);
    childEdgesByParent.set(edge.from, parentEdges);
  }

  for (const node of renderedGraph.nodes) {
    if (node.type !== 'page') continue;

    const hiddenCount = hiddenChildrenByParent.get(node.id) ?? 0;
    if (hiddenCount <= 0) continue;

    const parentPosition = positions[node.id];
    if (!parentPosition) continue;

    const childEdges = childEdgesByParent.get(node.id) ?? [];
    const childPositions = childEdges
      .map((edge) => positions[edge.to])
      .filter((position): position is GraphPosition => Boolean(position));

    const centroid = childPositions.length > 0
      ? {
          x: childPositions.reduce((sum, position) => sum + position.x, 0) / childPositions.length,
          y: childPositions.reduce((sum, position) => sum + position.y, 0) / childPositions.length,
        }
      : null;

    const fallbackAngle = compact ? Math.PI / 2 : Math.atan2(parentPosition.y, parentPosition.x || 1);
    const directionX = centroid ? centroid.x - parentPosition.x : Math.cos(fallbackAngle);
    const directionY = centroid ? centroid.y - parentPosition.y : Math.sin(fallbackAngle);
    const directionLength = Math.max(Math.hypot(directionX, directionY), 1);
    const normalizedDirection = {
      x: directionX / directionLength,
      y: directionY / directionLength,
    };
    const perpendicular = {
      x: -normalizedDirection.y,
      y: normalizedDirection.x,
    };
    const spreadSeed = (hashString(node.id) % 3) - 1;
    const offsetDistance = compact ? 210 : 252;
    const spreadDistance = (compact ? 42 : 58) * spreadSeed;
    const anchor = centroid ?? parentPosition;

    cards.push({
      id: `cluster:${node.id}`,
      parentId: node.id,
      x: anchor.x + (normalizedDirection.x * offsetDistance) + (perpendicular.x * spreadDistance),
      y: anchor.y + (normalizedDirection.y * offsetDistance) + (perpendicular.y * spreadDistance),
      hiddenCount,
      revealCount: Math.min(getChildExpansionStep(hiddenCount, compact), hiddenCount),
    });
  }

  return cards;
}

function classifyLocalRole(centerId: string, edge: RelationshipGraphEdge, neighbor: RelationshipGraphNode): LocalGraphRole {
  if (edge.type === 'page-child') {
    return edge.to === centerId ? 'ancestor' : 'descendant';
  }

  if (edge.type === 'link') {
    return neighbor.type === 'task' ? 'task' : 'linked';
  }

  return 'related';
}

function layoutLocalGraph(
  visibleGraph: VisibleGraph,
  graph: RelationshipGraph,
  selectedNodeId: string,
  compact = false,
): { positions: Record<string, GraphPosition>; bounds: GraphBounds } {
  const positions: Record<string, GraphPosition> = {};
  const centerNode = graph.nodesById[selectedNodeId] ?? visibleGraph.nodes[0];

  if (!centerNode) {
    return {
      positions,
      bounds: {
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        width: 0,
        height: 0,
      },
    };
  }

  const adjacency = new Map<string, RelationshipGraphEdge[]>();
  for (const edge of visibleGraph.edges) {
    const fromEdges = adjacency.get(edge.from) ?? [];
    fromEdges.push(edge);
    adjacency.set(edge.from, fromEdges);

    const toEdges = adjacency.get(edge.to) ?? [];
    toEdges.push(edge);
    adjacency.set(edge.to, toEdges);
  }

  const roles = new Map<string, LocalGraphRole>([[centerNode.id, 'center']]);
  const depths = new Map<string, number>([[centerNode.id, 0]]);
  const queue: string[] = [centerNode.id];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;

    const currentRole = roles.get(currentId) ?? 'related';
    const currentDepth = depths.get(currentId) ?? 0;
    const connectedEdges = adjacency.get(currentId) ?? [];

    for (const edge of connectedEdges) {
      const neighborId = edge.from === currentId ? edge.to : edge.from;
      if (roles.has(neighborId)) continue;

      const neighbor = graph.nodesById[neighborId];
      if (!neighbor) continue;

      const nextRole = currentId === centerNode.id
        ? classifyLocalRole(centerNode.id, edge, neighbor)
        : currentRole;

      roles.set(neighborId, nextRole);
      depths.set(neighborId, currentDepth + 1);
      queue.push(neighborId);
    }
  }

  const groups = new Map<string, RelationshipGraphNode[]>();
  for (const node of visibleGraph.nodes) {
    if (node.id === centerNode.id) continue;
    const role = roles.get(node.id) ?? 'related';
    const depth = depths.get(node.id) ?? 1;
    const key = `${role}:${depth}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(node);
    groups.set(key, bucket);
  }

  positions[centerNode.id] = { x: 0, y: 0 };

  const sortNodes = (nodes: RelationshipGraphNode[]) => {
    nodes.sort((left, right) => left.title.localeCompare(right.title));
  };

  for (const bucket of groups.values()) {
    sortNodes(bucket);
  }

  const localCardHalfWidth = PAGE_NODE_WIDTH / 2;
  const localCardHalfHeight = NODE_HALF_HEIGHT;
  const leftColumnX = -138;
  const centerColumnX = 0;
  const rightColumnX = 138;
  const farRightColumnX = 188;
  const horizontalDepthStep = 26;
  const verticalStep = 154;
  const sideStackStep = 144;
  const sideCenterGap = 168;

  for (const [key, nodes] of groups.entries()) {
    const [role, depthToken] = key.split(':');
    const depth = Number(depthToken);
    const hierarchyOffsets = role === 'ancestor' || role === 'descendant'
      ? buildCenteredGridPositions(
          nodes.length,
          getLocalHierarchyColumnCount(nodes.length, compact),
          compact ? 224 : 276,
          compact ? 132 : 148,
        )
      : null;
    const sideOffsets = hierarchyOffsets
      ? null
      : stackedVerticalOffsets(nodes.length, sideStackStep, sideCenterGap + ((depth - 1) * 40));

    nodes.forEach((node, index) => {
      const hierarchyOffset = hierarchyOffsets?.[index] ?? null;
      const sideOffset = sideOffsets?.[index] ?? 0;

      if (role === 'ancestor') {
        positions[node.id] = {
          x: centerColumnX + (hierarchyOffset?.x ?? 0),
          y: -(verticalStep * depth) - (hierarchyOffset?.y ?? 0),
        };
        return;
      }

      if (role === 'descendant') {
        positions[node.id] = {
          x: centerColumnX + (hierarchyOffset?.x ?? 0),
          y: verticalStep * depth + (hierarchyOffset?.y ?? 0),
        };
        return;
      }

      if (role === 'linked') {
        positions[node.id] = {
          x: leftColumnX - ((depth - 1) * horizontalDepthStep),
          y: sideOffset,
        };
        return;
      }

      if (role === 'task') {
        positions[node.id] = {
          x: rightColumnX + ((depth - 1) * horizontalDepthStep),
          y: sideOffset,
        };
        return;
      }

      positions[node.id] = {
        x: farRightColumnX + ((depth - 1) * horizontalDepthStep * 0.35),
        y: sideOffset,
      };
    });
  }

  const allPositions = Object.values(positions);
  const minX = Math.min(...allPositions.map((position) => position.x - localCardHalfWidth), leftColumnX - localCardHalfWidth - 24);
  const maxX = Math.max(...allPositions.map((position) => position.x + localCardHalfWidth), rightColumnX + localCardHalfWidth + 24);
  const minY = Math.min(...allPositions.map((position) => position.y - localCardHalfHeight), -verticalStep - localCardHalfHeight);
  const maxY = Math.max(...allPositions.map((position) => position.y + localCardHalfHeight), verticalStep + localCardHalfHeight);

  return {
    positions,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

function buildLocalFocusGraph(
  visibleGraph: VisibleGraph,
  selectedNodeId: string,
): VisibleGraph {
  const directEdges = visibleGraph.edges.filter((edge) => edge.from === selectedNodeId || edge.to === selectedNodeId);
  const visibleNodeIds = new Set<string>([selectedNodeId]);

  for (const edge of directEdges) {
    visibleNodeIds.add(edge.from);
    visibleNodeIds.add(edge.to);
  }

  return {
    nodes: visibleGraph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: directEdges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)),
  };
}

function fitTransform(bounds: GraphBounds, width: number, height: number, compact = false): { x: number; y: number; scale: number } {
  if (compact) {
    const scale = clamp(
      Math.min(width / Math.max(bounds.width + 72, 1), height / Math.max(bounds.height + 96, 1)) * 1.08,
      0.62,
      1.18,
    );

    const contentWidth = bounds.width * scale;
    const contentHeight = bounds.height * scale;

    return {
      scale,
      x: ((width - contentWidth) / 2) - (bounds.minX * scale),
      y: ((height - contentHeight) / 2) - (bounds.minY * scale),
    };
  }

  const scale = clamp(
    Math.min(width / Math.max(bounds.width + 220, 1), height / Math.max(bounds.height + 180, 1)) * 0.94,
    0.34,
    1.1,
  );

  const contentWidth = bounds.width * scale;
  const contentHeight = bounds.height * scale;

  return {
    scale,
    x: ((width - contentWidth) / 2) - (bounds.minX * scale),
    y: ((height - contentHeight) / 2) - (bounds.minY * scale),
  };
}

function nodeBorderColor(node: RelationshipGraphNode): string {
  if (node.type === 'task') {
    if (node.completed) return 'rgba(34, 197, 94, 0.65)';
    if (node.priority === 'High') return 'rgba(239, 68, 68, 0.72)';
    if (node.priority === 'Medium') return 'rgba(245, 158, 11, 0.72)';
    return 'rgba(59, 130, 246, 0.55)';
  }

  if (node.type === 'hub') return 'rgba(79, 70, 229, 0.7)';
  if (node.color) return node.color;
  if (node.pageViewMode === 'tasks') return 'rgba(14, 165, 233, 0.7)';
  if (node.pageViewMode === 'collection') return 'rgba(16, 185, 129, 0.7)';
  return 'rgba(99, 102, 241, 0.6)';
}

function edgeStyle(edge: RelationshipGraphEdge): { stroke: string; strokeWidth: number; dashArray?: string; opacity: number } {
  if (edge.type === 'page-child') {
    return { stroke: 'rgba(148, 163, 184, 0.65)', strokeWidth: 2.2, opacity: 0.8 };
  }
  return { stroke: 'rgba(99, 102, 241, 0.58)', strokeWidth: 2.4, dashArray: '8 6', opacity: 0.95 };
}

const PageRelationshipGraph = forwardRef<PageRelationshipGraphHandle, PageRelationshipGraphProps>(({ 
  allPages,
  tasks,
  graph,
  visibleGraph,
  selectedNodeId,
  onSelectedNodeIdChange,
  searchTerm = '',
  topLeftOverlay,
  showInspector = true,
  showCanvasHints = true,
  compact = false,
}, ref) => {
  const navigate = useNavigate();
  const openTaskInContext = useUIStore((state) => state.openTaskInContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ originX: number; originY: number; startX: number; startY: number } | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [expandedChildrenByParent, setExpandedChildrenByParent] = useState<Map<string, number>>(new Map());
  const [expandedTasksByParent, setExpandedTasksByParent] = useState<Map<string, number>>(new Map());

  const paginatedVisibleGraph = useMemo(
    () => paginateGraphNodes(
      visibleGraph,
      graph,
      allPages,
      tasks,
      selectedNodeId,
      searchTerm,
      expandedChildrenByParent,
      expandedTasksByParent,
    ),
    [visibleGraph, graph, allPages, tasks, selectedNodeId, searchTerm, expandedChildrenByParent, expandedTasksByParent]
  );

  const { graph: renderedGraph, hiddenChildrenByParent, hiddenTasksByParent } = paginatedVisibleGraph;

  const compactRenderedGraph = useMemo(() => {
    if (!compact || !selectedNodeId) {
      return renderedGraph;
    }

    return buildLocalFocusGraph(renderedGraph, selectedNodeId);
  }, [compact, renderedGraph, selectedNodeId]);

  const { positions, bounds } = useMemo(() => {
    if (compact && selectedNodeId) {
      return layoutLocalGraph(compactRenderedGraph, graph, selectedNodeId, compact);
    }

    return layoutGraph(renderedGraph, allPages, compact);
  }, [allPages, compact, compactRenderedGraph, graph, renderedGraph, selectedNodeId]);
  const worldOriginX = bounds.minX - WORLD_PADDING;
  const worldOriginY = bounds.minY - WORLD_PADDING;
  const localBounds = useMemo<GraphBounds>(() => ({
    minX: WORLD_PADDING,
    maxX: WORLD_PADDING + bounds.width,
    minY: WORLD_PADDING,
    maxY: WORLD_PADDING + bounds.height,
    width: bounds.width,
    height: bounds.height,
  }), [bounds]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const wheelHandler = (event: WheelEvent) => {
      event.preventDefault();

      const rect = container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      // Trackpad pinch is exposed as a wheel event with ctrlKey on macOS.
      // Plain two-finger movement should pan the canvas instead of zooming it.
      if (!event.ctrlKey) {
        setTransform((current) => ({
          ...current,
          x: current.x - event.deltaX,
          y: current.y - event.deltaY,
        }));
        return;
      }

      const pinchStrength = clamp(Math.abs(event.deltaY) / 120, 0.35, 1.8);
      const zoomDirection = event.deltaY > 0 ? 1 / (1 + (pinchStrength * 0.12)) : 1 + (pinchStrength * 0.12);

      setTransform((current) => {
        const nextScale = clamp(current.scale * zoomDirection, 0.28, 1.8);
        const scaleRatio = nextScale / current.scale;

        return {
          scale: nextScale,
          x: mouseX - ((mouseX - current.x) * scaleRatio),
          y: mouseY - ((mouseY - current.y) * scaleRatio),
        };
      });
    };

    container.addEventListener('wheel', wheelHandler, { passive: false });
    return () => container.removeEventListener('wheel', wheelHandler);
  }, []);

  const applyFit = useCallback(() => {
    if (viewportSize.width === 0 || viewportSize.height === 0) return;
    setTransform(fitTransform(localBounds, viewportSize.width, viewportSize.height, compact));
  }, [compact, localBounds, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    applyFit();
  }, [applyFit]);

  const activeRenderedGraph = compact ? compactRenderedGraph : renderedGraph;
  const activeNodeId = hoveredNodeId ?? selectedNodeId;

  const nodeWidth = useCallback((type: string) => {
    return type === 'task' ? TASK_NODE_WIDTH : type === 'hub' ? HUB_NODE_WIDTH : type === 'tag' ? TAG_NODE_WIDTH : PAGE_NODE_WIDTH;
  }, []);

  const activeNeighbors = useMemo(() => {
    if (!activeNodeId) return new Set<string>();
    const edges = activeRenderedGraph.edges;

    return new Set(
      edges
        .filter((edge) => edge.from === activeNodeId || edge.to === activeNodeId)
        .flatMap((edge) => [edge.from, edge.to])
    );
  }, [activeNodeId, activeRenderedGraph.edges]);

  const selectedNode = selectedNodeId ? graph.nodesById[selectedNodeId] ?? null : null;
  const selectedNodeEdges = useMemo(
    () => selectedNode
      ? activeRenderedGraph.edges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id)
      : [],
    [activeRenderedGraph.edges, selectedNode]
  );
  const isInspectorExpanded = Boolean(selectedNode);
  const visibleHiddenChildrenByParent = useMemo(() => {
    if (!selectedNodeId) {
      return hiddenChildrenByParent;
    }

    const selectedHiddenChildCount = hiddenChildrenByParent.get(selectedNodeId) ?? 0;
    if (selectedHiddenChildCount <= 0) {
      return new Map<string, number>();
    }

    return new Map<string, number>([[selectedNodeId, selectedHiddenChildCount]]);
  }, [hiddenChildrenByParent, selectedNodeId]);
  const selectedHiddenChildren = selectedNode ? visibleHiddenChildrenByParent.get(selectedNode.id) ?? 0 : 0;
  const selectedVisibleChildren = selectedNode ? expandedChildrenByParent.get(selectedNode.id) ?? DEFAULT_VISIBLE_CHILDREN : DEFAULT_VISIBLE_CHILDREN;
  const selectedChildExpansionStep = getChildExpansionStep(selectedHiddenChildren, compact);
  const syntheticClusterCards = useMemo(
    () => buildSyntheticClusterCards(activeRenderedGraph, positions, visibleHiddenChildrenByParent, compact),
    [activeRenderedGraph, positions, visibleHiddenChildrenByParent, compact],
  );
  const clusterParentIds = useMemo(
    () => new Set(syntheticClusterCards.map((clusterCard) => clusterCard.parentId)),
    [syntheticClusterCards],
  );

  const expandChildrenForParent = useCallback((parentId: string, amount: number) => {
    if (amount <= 0) return;
    setExpandedChildrenByParent((current) => {
      const next = new Map(current);
      next.set(parentId, (next.get(parentId) ?? DEFAULT_VISIBLE_CHILDREN) + amount);
      return next;
    });
  }, []);

  const expandAllChildrenForParent = useCallback((parentId: string, hiddenCount: number) => {
    if (hiddenCount <= 0) return;
    setExpandedChildrenByParent((current) => {
      const next = new Map(current);
      next.set(parentId, (next.get(parentId) ?? DEFAULT_VISIBLE_CHILDREN) + hiddenCount);
      return next;
    });
  }, []);

  const handleOpenNode = useCallback((node: RelationshipGraphNode | null) => {
    if (!node) return;

    if (node.type === 'page') {
      navigate({ to: '/pages/$id', params: { id: node.entityId } });
      return;
    }

    if (node.type === 'task') {
      const task = tasks.find((candidate) => candidate.id === node.entityId);
      const filter = task?.parentPageId ?? 'all';
      navigate({ to: '/tasks/$filter', params: { filter } });
      window.setTimeout(() => openTaskInContext(node.entityId), 80);
    }
  }, [navigate, openTaskInContext, tasks]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-graph-node="true"]')) return;

    dragStateRef.current = {
      originX: transform.x,
      originY: transform.y,
      startX: event.clientX,
      startY: event.clientY,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }, [transform.x, transform.y]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    setTransform((current) => ({
      ...current,
      x: dragState.originX + (event.clientX - dragState.startX),
      y: dragState.originY + (event.clientY - dragState.startY),
    }));
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const zoomBy = useCallback((factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    setTransform((current) => {
      const nextScale = clamp(current.scale * factor, 0.28, 1.8);
      const scaleRatio = nextScale / current.scale;
      return {
        scale: nextScale,
        x: centerX - ((centerX - current.x) * scaleRatio),
        y: centerY - ((centerY - current.y) * scaleRatio),
      };
    });
  }, []);

  useImperativeHandle(ref, () => ({
    fit: applyFit,
    zoomIn: () => zoomBy(1.12),
    zoomOut: () => zoomBy(0.88),
  }), [applyFit, zoomBy]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--color-accent-primary)_10%,transparent),transparent_28%),radial-gradient(circle_at_bottom_right,color-mix(in_srgb,var(--color-accent-secondary)_12%,transparent),transparent_30%),linear-gradient(180deg,color-mix(in_srgb,var(--color-surface-secondary)_20%,transparent),transparent_16%)] eink-canvas-flat">
      {topLeftOverlay && (
        <div className="pointer-events-none absolute left-4 top-20 z-20 max-w-[min(44rem,calc(100%-2rem))] xl:left-5 xl:top-24">
          <div className="pointer-events-auto">
            {topLeftOverlay}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="relative h-full overflow-hidden touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            width: `${bounds.width + WORLD_PADDING * 2}px`,
            height: `${bounds.height + WORLD_PADDING * 2}px`,
          }}
        >
          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${bounds.width + WORLD_PADDING * 2} ${bounds.height + WORLD_PADDING * 2}`}>
            <defs>
              <pattern id="graph-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                <path d="M 36 0 L 0 0 0 36" fill="none" stroke="rgba(148, 163, 184, 0.1)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={bounds.width + WORLD_PADDING * 2} height={bounds.height + WORLD_PADDING * 2} fill="url(#graph-grid)" />
            {(compact ? compactRenderedGraph.edges : renderedGraph.edges).map((edge) => {
              const from = positions[edge.from];
              const to = positions[edge.to];
              if (!from || !to) return null;

              const style = edgeStyle(edge);
              const active = !activeNodeId || edge.from === activeNodeId || edge.to === activeNodeId;

              // Compute node half-sizes for anchor points
              const fromNode = graph.nodesById[edge.from];
              const toNode = graph.nodesById[edge.to];
              const fromHalfW = nodeWidth(fromNode?.type ?? 'page') / 2;
              const toHalfW = nodeWidth(toNode?.type ?? 'page') / 2;
              const fromHalfH = NODE_HALF_HEIGHT;
              const toHalfH = NODE_HALF_HEIGHT;
              const fromLocalX = from.x - worldOriginX;
              const fromLocalY = from.y - worldOriginY;
              const toLocalX = to.x - worldOriginX;
              const toLocalY = to.y - worldOriginY;

              // Direction vector from source to target
              const dx = toLocalX - fromLocalX;
              const dy = toLocalY - fromLocalY;

              // Choose anchor on nearest edge of each card
              let fromAnchorX = fromLocalX;
              let fromAnchorY = fromLocalY;
              let toAnchorX = toLocalX;
              let toAnchorY = toLocalY;

              if (Math.abs(dx) * fromHalfH > Math.abs(dy) * fromHalfW) {
                // Exit horizontally
                fromAnchorX = fromLocalX + (dx > 0 ? fromHalfW : -fromHalfW);
                toAnchorX = toLocalX + (dx > 0 ? -toHalfW : toHalfW);
              } else {
                // Exit vertically
                fromAnchorY = fromLocalY + (dy > 0 ? fromHalfH : -fromHalfH);
                toAnchorY = toLocalY + (dy > 0 ? -toHalfH : toHalfH);
              }

              // Build a smooth cubic bezier between the anchors
              const mx = (fromAnchorX + toAnchorX) / 2;
              const my = (fromAnchorY + toAnchorY) / 2;
              const curvature = 0.35;
              const cdx = toAnchorX - fromAnchorX;
              const cdy = toAnchorY - fromAnchorY;

              let cp1x: number, cp1y: number, cp2x: number, cp2y: number;
              if (Math.abs(dx) * fromHalfH > Math.abs(dy) * fromHalfW) {
                // Horizontal-dominant: control points push horizontally
                cp1x = fromAnchorX + cdx * curvature;
                cp1y = fromAnchorY;
                cp2x = toAnchorX - cdx * curvature;
                cp2y = toAnchorY;
              } else {
                // Vertical-dominant: control points push vertically
                cp1x = fromAnchorX;
                cp1y = fromAnchorY + cdy * curvature;
                cp2x = toAnchorX;
                cp2y = toAnchorY - cdy * curvature;
              }

              const path = `M ${fromAnchorX} ${fromAnchorY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toAnchorX} ${toAnchorY}`;

              return (
                <path
                  key={edge.id}
                  d={path}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={active ? style.strokeWidth + 0.5 : style.strokeWidth}
                  strokeDasharray={style.dashArray}
                  opacity={active ? style.opacity : style.opacity * 0.24}
                  strokeLinecap="round"
                />
              );
            })}

            {syntheticClusterCards.map((clusterCard) => {
              const parentPosition = positions[clusterCard.parentId];
              if (!parentPosition) return null;

              const fromLocalX = parentPosition.x - worldOriginX;
              const fromLocalY = parentPosition.y - worldOriginY;
              const toLocalX = clusterCard.x - worldOriginX;
              const toLocalY = clusterCard.y - worldOriginY;
              const dx = toLocalX - fromLocalX;
              const dy = toLocalY - fromLocalY;

              let fromAnchorX = fromLocalX;
              let fromAnchorY = fromLocalY;
              let toAnchorX = toLocalX;
              let toAnchorY = toLocalY;
              const fromHalfW = PAGE_NODE_WIDTH / 2;
              const toHalfW = (compact ? CLUSTER_CARD_WIDTH_COMPACT : CLUSTER_CARD_WIDTH) / 2;

              if (Math.abs(dx) * NODE_HALF_HEIGHT > Math.abs(dy) * fromHalfW) {
                fromAnchorX = fromLocalX + (dx > 0 ? fromHalfW : -fromHalfW);
                toAnchorX = toLocalX + (dx > 0 ? -toHalfW : toHalfW);
              } else {
                fromAnchorY = fromLocalY + (dy > 0 ? NODE_HALF_HEIGHT : -NODE_HALF_HEIGHT);
                toAnchorY = toLocalY + (dy > 0 ? -CLUSTER_CARD_HALF_HEIGHT : CLUSTER_CARD_HALF_HEIGHT);
              }

              const cdx = toAnchorX - fromAnchorX;
              const cdy = toAnchorY - fromAnchorY;
              const cp1x = Math.abs(dx) > Math.abs(dy) ? fromAnchorX + (cdx * 0.38) : fromAnchorX;
              const cp1y = Math.abs(dx) > Math.abs(dy) ? fromAnchorY : fromAnchorY + (cdy * 0.38);
              const cp2x = Math.abs(dx) > Math.abs(dy) ? toAnchorX - (cdx * 0.38) : toAnchorX;
              const cp2y = Math.abs(dx) > Math.abs(dy) ? toAnchorY : toAnchorY - (cdy * 0.38);
              const path = `M ${fromAnchorX} ${fromAnchorY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toAnchorX} ${toAnchorY}`;

              return (
                <path
                  key={`cluster-edge:${clusterCard.id}`}
                  d={path}
                  fill="none"
                  stroke="rgba(99, 102, 241, 0.28)"
                  strokeWidth={1.8}
                  strokeDasharray="6 8"
                  opacity={activeNodeId && activeNodeId !== clusterCard.parentId ? 0.18 : 0.72}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>

          {activeRenderedGraph.nodes.map((node) => {
            const position = positions[node.id];
            if (!position) return null;

            const isActive = activeNodeId === node.id;
            const isNeighbor = activeNeighbors.has(node.id);
            const isDimmed = Boolean(activeNodeId) && !isActive && !isNeighbor;
            const borderColor = nodeBorderColor(node);

            return (
              <button
                key={node.id}
                type="button"
                data-graph-node="true"
                onClick={() => onSelectedNodeIdChange(compact ? node.id : selectedNodeId === node.id ? null : node.id)}
                onDoubleClick={() => handleOpenNode(node)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId((current) => current === node.id ? null : current)}
                className={cn(
                  'absolute flex -translate-x-1/2 -translate-y-1/2 items-start gap-3.5 rounded-[30px] border px-4 py-3.5 text-left shadow-[0_18px_55px_-25px_rgba(15,23,42,0.45)] transition-all backdrop-blur-xl eink-graph-node',
                  isActive ? 'scale-[1.03]' : 'hover:scale-[1.012]',
                  isDimmed && 'opacity-35',
                )}
                style={{
                  width: nodeWidth(node.type),
                  left: position.x - worldOriginX,
                  top: position.y - worldOriginY,
                  borderColor,
                  background: node.type === 'task'
                    ? 'color-mix(in srgb, var(--color-surface-base) 88%, rgba(59,130,246,0.05))'
                    : node.type === 'hub'
                      ? 'color-mix(in srgb, var(--color-surface-base) 84%, rgba(79,70,229,0.14))'
                      : 'color-mix(in srgb, var(--color-surface-base) 90%, transparent)',
                  boxShadow: isActive
                    ? `0 22px 65px -26px ${borderColor}`
                    : `0 14px 34px -28px ${borderColor}`,
                }}
                title="Single click to inspect, double click to open"
              >
                <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[18px] border border-white/25 bg-white/50 shadow-sm dark:bg-white/5 eink-graph-node-icon">
                  {node.type === 'page' ? (
                    <ItemIcon type={node.pageViewMode === 'collection' ? 'collection' : node.pageViewMode === 'tasks' ? 'tasks' : 'note'} icon={node.icon} color={node.color} size="lg" />
                  ) : node.type === 'hub' ? (
                    <Network className="h-5.5 w-5.5 text-[var(--color-text-primary)]" />
                  ) : node.type === 'tag' ? (
                    <Tag className="h-5.5 w-5.5 text-amber-500 eink-graph-accent-icon" />
                  ) : node.completed ? (
                    <CheckCircle2 className="h-5.5 w-5.5 text-emerald-500 eink-graph-accent-icon" />
                  ) : (
                    <CheckIcon className="h-5.5 w-5.5 text-[var(--color-text-primary)]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full eink-graph-accent-dot" style={{ backgroundColor: borderColor }} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                      {node.type === 'page'
                        ? node.pageViewMode === 'tasks' ? 'Tasks page' : node.pageViewMode === 'collection' ? 'Collection' : 'Page'
                        : node.type === 'tag'
                          ? 'Tag'
                        : node.type === 'hub'
                          ? 'Hub'
                          : node.completed ? 'Completed task' : 'Task'}
                    </span>
                  </div>
                  <div className="line-clamp-2 text-[17px] font-semibold leading-[1.2] text-[var(--color-text-primary)]">{node.title}</div>
                  <div className="mt-1 line-clamp-1 text-sm text-[var(--color-text-secondary)]">{node.subtitle}</div>
                  {node.tags && node.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {node.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]/75 px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] eink-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {(visibleHiddenChildrenByParent.get(node.id) ?? 0) > 0 && !clusterParentIds.has(node.id) && (
                    <div className="mt-3 space-y-2">
                      <div className="text-[11px] text-[var(--color-text-secondary)]">
                        {formatCompactCount(visibleHiddenChildrenByParent.get(node.id) ?? 0)} direct descendants hidden
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            expandChildrenForParent(node.id, getChildExpansionStep(visibleHiddenChildrenByParent.get(node.id) ?? 0, compact));
                          }}
                          className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]/80 px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] eink-chip"
                        >
                          Show {Math.min(getChildExpansionStep(visibleHiddenChildrenByParent.get(node.id) ?? 0, compact), visibleHiddenChildrenByParent.get(node.id) ?? 0)} more
                        </button>
                        {!compact && (visibleHiddenChildrenByParent.get(node.id) ?? 0) <= EXPAND_ALL_CHILDREN_LIMIT && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              expandAllChildrenForParent(node.id, visibleHiddenChildrenByParent.get(node.id) ?? 0);
                            }}
                            className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]/55 px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] eink-chip-subtle"
                          >
                            Show all
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                  {(hiddenTasksByParent.get(node.id) ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedTasksByParent((current) => {
                          const next = new Map(current);
                          next.set(node.id, (next.get(node.id) ?? DEFAULT_VISIBLE_TASKS) + LOAD_MORE_STEP);
                          return next;
                        });
                      }}
                      className="mt-2 inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]/80 px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] eink-chip"
                    >
                      Load {Math.min(LOAD_MORE_STEP, hiddenTasksByParent.get(node.id) ?? 0)} more tasks
                    </button>
                  )}
                </div>
              </button>
            );
          })}

          {syntheticClusterCards.map((clusterCard) => {
            const showAll = !compact && clusterCard.hiddenCount <= EXPAND_ALL_CHILDREN_LIMIT;
            const parentIsActive = activeNodeId === clusterCard.parentId;

            return (
              <div
                key={clusterCard.id}
                data-graph-node="true"
                onMouseEnter={() => setHoveredNodeId(clusterCard.parentId)}
                onMouseLeave={() => setHoveredNodeId((current) => current === clusterCard.parentId ? null : current)}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2',
                  parentIsActive ? 'z-20' : 'z-10',
                )}
                style={{
                  left: clusterCard.x - worldOriginX,
                  top: clusterCard.y - worldOriginY,
                  width: compact ? CLUSTER_CARD_WIDTH_COMPACT : CLUSTER_CARD_WIDTH,
                }}
              >
                <div className="pointer-events-none absolute inset-0 translate-x-3 translate-y-3 rounded-[28px] border border-[rgba(99,102,241,0.18)] bg-[color-mix(in_srgb,var(--color-surface-base)_84%,transparent)] shadow-[0_12px_28px_-24px_rgba(99,102,241,0.45)] eink-graph-stack-layer" />
                <div className="pointer-events-none absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-[28px] border border-[rgba(99,102,241,0.22)] bg-[color-mix(in_srgb,var(--color-surface-base)_88%,transparent)] shadow-[0_10px_24px_-22px_rgba(99,102,241,0.42)] eink-graph-stack-layer" />
                <div className="relative rounded-[28px] border border-[rgba(99,102,241,0.28)] bg-[color-mix(in_srgb,var(--color-surface-base)_94%,transparent)] px-4 py-3 shadow-[0_20px_48px_-28px_rgba(99,102,241,0.42)] backdrop-blur-xl eink-content-card">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px] border border-white/25 bg-white/55 shadow-sm dark:bg-white/5 eink-graph-node-icon">
                      <Plus className="h-4.5 w-4.5 text-[var(--color-text-primary)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[rgba(99,102,241,0.75)] eink-graph-accent-dot" />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">
                          Grouped descendants
                        </span>
                      </div>
                      <div className="text-[17px] font-semibold leading-[1.2] text-[var(--color-text-primary)]">
                        {formatChildPageLabel(clusterCard.hiddenCount)}
                      </div>
                      <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                        Hidden as a cluster to keep the graph readable.
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => expandChildrenForParent(clusterCard.parentId, clusterCard.revealCount)}
                          className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]/80 px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] eink-chip"
                        >
                          Show {clusterCard.revealCount}
                        </button>
                        {showAll && (
                          <button
                            type="button"
                            onClick={() => expandAllChildrenForParent(clusterCard.parentId, clusterCard.hiddenCount)}
                            className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]/55 px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-secondary)] eink-chip-subtle"
                          >
                            Show all
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showCanvasHints && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 flex flex-wrap gap-2">
          <div className="rounded-full border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-surface-base)_84%,transparent)] px-3 py-1 text-xs text-[var(--color-text-secondary)] shadow-sm backdrop-blur-md eink-chip-subtle">
            Drag or two-finger pan
          </div>
          <div className="rounded-full border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-surface-base)_84%,transparent)] px-3 py-1 text-xs text-[var(--color-text-secondary)] shadow-sm backdrop-blur-md eink-chip-subtle">
            Pinch or wheel to zoom
          </div>
          <div className="rounded-full border border-[var(--color-border-default)] bg-[color-mix(in_srgb,var(--color-surface-base)_84%,transparent)] px-3 py-1 text-xs text-[var(--color-text-secondary)] shadow-sm backdrop-blur-md eink-chip-subtle">
            Double click to open
          </div>
        </div>
        )}

        {showInspector && (
        <FloatingPanel
          containerClassName="bottom-5 right-5 w-[300px] max-w-[calc(100%-2.5rem)]"
          surfaceClassName={cn(
            'transition-[max-height,transform,opacity] duration-300 ease-out',
            isInspectorExpanded
              ? 'max-h-[calc(100vh-var(--header-height)-7.5rem)] translate-y-0 opacity-100'
              : 'max-h-[110px] translate-y-2 opacity-95'
          )}
        >
            <div className="border-b border-[var(--color-border-subtle)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Inspector</div>
              <h3 className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{selectedNode ? selectedNode.title : 'No node selected'}</h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {selectedNode ? selectedNode.subtitle : 'Select a node to inspect its relationships and open the source page or task.'}
              </p>
            </div>

            <div className={cn('px-4 transition-[padding,opacity] duration-300 ease-out', isInspectorExpanded ? 'flex-1 overflow-hidden py-4 opacity-100' : 'overflow-hidden py-0 opacity-80')}>
              {selectedNode ? (
                <div className="flex h-full min-h-0 flex-col gap-4">
                  <div className="rounded-3xl border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]/55 p-4 eink-content-card-secondary">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-[var(--color-surface-base)] eink-graph-node-icon">
                        {selectedNode.type === 'page' ? (
                          <ItemIcon type={selectedNode.pageViewMode === 'collection' ? 'collection' : selectedNode.pageViewMode === 'tasks' ? 'tasks' : 'note'} icon={selectedNode.icon} color={selectedNode.color} size="lg" />
                        ) : selectedNode.type === 'hub' ? (
                          <Network className="h-6 w-6 text-[var(--color-text-primary)]" />
                        ) : selectedNode.type === 'tag' ? (
                          <Tag className="h-6 w-6 text-amber-500" />
                        ) : selectedNode.completed ? (
                          <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                        ) : (
                          <CheckIcon className="h-6 w-6 text-[var(--color-text-primary)]" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{selectedNode.title}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{selectedNode.subtitle}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-secondary)]">
                      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]/75 px-3 py-2 eink-chip-subtle">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Connections</div>
                        <div className="mt-1 text-lg font-semibold text-[var(--color-text-primary)]">{graph.degreeByNodeId[selectedNode.id] ?? 0}</div>
                      </div>
                      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]/75 px-3 py-2 eink-chip-subtle">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Type</div>
                        <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                          {selectedNode.type === 'page'
                            ? selectedNode.pageViewMode === 'tasks' ? 'Tasks page' : selectedNode.pageViewMode === 'collection' ? 'Collection' : 'Page'
                            : selectedNode.type === 'tag'
                              ? 'Tag'
                            : selectedNode.type === 'hub'
                              ? 'Inbox hub'
                              : 'Task'}
                        </div>
                      </div>
                    </div>

                    {selectedNode.type !== 'hub' && selectedNode.type !== 'tag' && (
                      <Button className="mt-4 w-full" onClick={() => handleOpenNode(selectedNode)}>
                        Open {selectedNode.type === 'task' ? 'task' : 'page'}
                      </Button>
                    )}

                    {selectedNode.type === 'page' && selectedHiddenChildren > 0 && (
                      <div className="mt-4 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]/75 p-3 eink-chip-subtle">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">Descendants</div>
                        <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
                          {selectedVisibleChildren.toLocaleString()} shown, {selectedHiddenChildren.toLocaleString()} hidden
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => expandChildrenForParent(selectedNode.id, selectedChildExpansionStep)}
                            className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-tertiary)] eink-chip"
                          >
                            Show {Math.min(selectedChildExpansionStep, selectedHiddenChildren)} more
                          </button>
                          {!compact && selectedHiddenChildren <= EXPAND_ALL_CHILDREN_LIMIT && (
                            <button
                              type="button"
                              onClick={() => expandAllChildrenForParent(selectedNode.id, selectedHiddenChildren)}
                              className="inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-secondary)]/55 px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-tertiary)] eink-chip-subtle"
                            >
                              Show all descendants
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-tertiary)]">Connected items</div>
                    <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
                      {selectedNodeEdges.map((edge) => {
                        const neighborId = edge.from === selectedNode.id ? edge.to : edge.from;
                        const neighbor = graph.nodesById[neighborId];
                        if (!neighbor) return null;

                        return (
                          <button
                            key={edge.id}
                            type="button"
                            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-secondary)]/45 px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-secondary)]"
                            onClick={() => onSelectedNodeIdChange(neighbor.id)}
                          >
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/20 bg-[var(--color-surface-base)]/70">
                              {neighbor.type === 'page' ? (
                                <ItemIcon type={neighbor.pageViewMode === 'collection' ? 'collection' : neighbor.pageViewMode === 'tasks' ? 'tasks' : 'note'} icon={neighbor.icon} color={neighbor.color} size="sm" />
                              ) : neighbor.type === 'hub' ? (
                                <Network className="h-4 w-4 text-[var(--color-text-primary)]" />
                              ) : neighbor.type === 'tag' ? (
                                <Tag className="h-4 w-4 text-amber-500" />
                              ) : (
                                <CheckIcon className="h-4 w-4 text-[var(--color-text-primary)]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-[var(--color-text-primary)]">{neighbor.title}</div>
                              <div className="truncate text-xs text-[var(--color-text-secondary)]">
                                {edge.type === 'page-child' ? 'Hierarchy' : edge.type === 'tag' ? 'Tag association' : 'Link / backlink'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pb-4 text-sm text-[var(--color-text-secondary)]">
                  Use the graph to inspect structure before jumping into content.
                </div>
              )}
            </div>
        </FloatingPanel>
        )}
      </div>
    </div>
  );
});

export default PageRelationshipGraph;