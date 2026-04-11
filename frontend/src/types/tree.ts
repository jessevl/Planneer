/**
 * @file tree.ts
 * @description Shared types for hierarchical tree structures
 * @app SHARED - Used by unified pages system
 * 
 * Provides generic tree types for the sidebar navigation:
 * 
 * - TreeItemBase: Common properties (id, title, icon, color, parentId, order)
 * - TreeNode<T>: Generic tree node with item, children, and depth
 * - TreeBreadcrumb: Ancestor chain item for navigation
 * 
 * These types enable:
 * - Unified TreeSection and TreeSidebarItem components
 * - Consistent tree operations (buildTree, getAncestors, etc.)
 * - Single unified page hierarchy
 * 
 * Page types are distinguished by viewMode:
 * - 'page': Regular pages/documents
 * - 'collection': Container for child pages  
 * - 'tasks': Task collection (replaces old projects)
 */

/**
 * Common properties shared by tree-based items (Notes, Projects)
 */
export interface TreeItemBase {
  id: string;
  /** Display name/title */
  title: string;
  /** Emoji icon (e.g., "📁", "🏠") - null means use default icon */
  icon: string | null;
  /** Item color (hex, e.g., "#F87171") - used for default icon coloring */
  color: string | null;
  /** Parent item ID, null = root level */
  parentId: string | null;
  /** Position among siblings (0-based) for ordering */
  order: number;
}

/**
 * Generic tree node for sidebar display
 */
export interface TreeNode<T extends TreeItemBase> {
  item: T;
  children: TreeNode<T>[];
  depth: number;
}

/**
 * Breadcrumb item for navigation (shared between Notes and Projects)
 */
export interface TreeBreadcrumb {
  id: string;
  title: string;
  icon: string | null;
  color: string | null;
}

/**
 * Type of tree item - determines default icon and behavior
 * - 'page': Regular page/note with document icon
 * - 'collection': Page collection with folder/4-dots indicator
 * - 'task-collection': Task collection with square outline indicator
 */
export type TreeItemType = 'page' | 'collection' | 'task-collection';

/** @deprecated Use 'page' instead */
export type LegacyTreeItemType = 'note' | 'project' | 'collection';

// Note: TreeSidebarItemProps is defined in TreeSidebarItem.tsx component

/**
 * Props for item properties modal (shared between Notes and Projects)
 */
export interface ItemPropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemType: TreeItemType;
  /** Item being edited - null for create mode */
  item: TreeItemBase | null;
  /** Available items for parent selection (excludes self and descendants) */
  availableParents: TreeItemBase[];
  onSave: (data: {
    title: string;
    icon: string | null;
    color: string | null;
    parentId: string | null;
  }) => void;
  onDelete?: () => void;
}

/**
 * Helper to build a tree from flat array of items
 */
export function buildTree<T extends TreeItemBase>(
  items: T[],
  parentId: string | null = null,
  depth: number = 0
): TreeNode<T>[] {
  return items
    .filter((item) => item.parentId === parentId)
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      item,
      children: buildTree(items, item.id, depth + 1),
      depth,
    }));
}

/**
 * Get ancestor chain (breadcrumbs) for an item - from root to immediate parent
 */
export function getAncestorChain<T extends TreeItemBase>(
  itemsById: Record<string, T>,
  itemId: string
): TreeBreadcrumb[] {
  const ancestors: TreeBreadcrumb[] = [];
  let current = itemsById[itemId];

  if (!current) return ancestors;

  // Walk up the tree
  while (current.parentId) {
    const parent = itemsById[current.parentId];
    if (!parent) break;

    ancestors.unshift({
      id: parent.id,
      title: parent.title,
      icon: parent.icon,
      color: parent.color,
    });

    current = parent;
  }

  return ancestors;
}

/**
 * Check if targetId is a descendant of sourceId in the tree
 */
export function isDescendant<T extends TreeItemBase>(
  itemsById: Record<string, T>,
  targetId: string,
  sourceId: string
): boolean {
  let current = itemsById[targetId];
  
  while (current) {
    if (current.parentId === sourceId) return true;
    if (!current.parentId) return false;
    current = itemsById[current.parentId];
  }
  
  return false;
}

/**
 * Get all descendant IDs for an item (children, grandchildren, etc.)
 */
export function getDescendantIds<T extends TreeItemBase>(
  items: T[],
  itemId: string
): string[] {
  const descendants: string[] = [];
  const childrenMap = new Map<string, T[]>();

  // Build children map
  items.forEach((item) => {
    if (item.parentId) {
      if (!childrenMap.has(item.parentId)) {
        childrenMap.set(item.parentId, []);
      }
      childrenMap.get(item.parentId)!.push(item);
    }
  });

  // Recursive collection
  function collectDescendants(id: string) {
    const children = childrenMap.get(id) || [];
    for (const child of children) {
      descendants.push(child.id);
      collectDescendants(child.id);
    }
  }

  collectDescendants(itemId);
  return descendants;
}
