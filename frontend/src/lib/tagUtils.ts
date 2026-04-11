/**
 * @file tagUtils.ts
 * @description Tag utilities and color definitions for tasks
 * 
 * Provides a consistent tagging system with predefined colors that work
 * well in both light and dark modes. Tags are simple strings with
 * auto-assigned colors based on the tag name.
 */

/**
 * Predefined tag colors optimized for light/dark mode visibility
 * Each color has background and text variants for both modes
 */
export interface TagColor {
  /** Tag color identifier */
  id: string;
  /** Display name */
  name: string;
  /** Light mode: background color (tailwind class) */
  bgLight: string;
  /** Light mode: text color (tailwind class) */
  textLight: string;
  /** Dark mode: background color (tailwind class) */
  bgDark: string;
  /** Dark mode: text color (tailwind class) */
  textDark: string;
  /** Combined bg classes for light + dark mode (static string for Tailwind scanning) */
  bg: string;
  /** Combined text classes for light + dark mode (static string for Tailwind scanning) */
  text: string;
  /** Hex color for sorting/visual identification */
  hex: string;
}

/**
 * Curated tag colors that look good in both light and dark modes
 * Colors are vibrant but not harsh, with good contrast ratios
 * Extended to 24 colors for better variety and fewer repeats
 */
export const TAG_COLORS: TagColor[] = [
  // Primary colors
  {
    id: 'blue',
    name: 'Blue',
    bgLight: 'bg-blue-100',
    textLight: 'text-blue-700',
    bgDark: 'bg-blue-500/20',
    textDark: 'text-blue-300',
    bg: 'bg-blue-100 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-300',
    hex: '#3b82f6',
  },
  {
    id: 'green',
    name: 'Green',
    bgLight: 'bg-emerald-100',
    textLight: 'text-emerald-700',
    bgDark: 'bg-emerald-500/20',
    textDark: 'text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    hex: '#10b981',
  },
  {
    id: 'purple',
    name: 'Purple',
    bgLight: 'bg-purple-100',
    textLight: 'text-purple-700',
    bgDark: 'bg-purple-500/20',
    textDark: 'text-purple-300',
    bg: 'bg-purple-100 dark:bg-purple-500/20',
    text: 'text-purple-700 dark:text-purple-300',
    hex: '#8b5cf6',
  },
  {
    id: 'orange',
    name: 'Orange',
    bgLight: 'bg-orange-100',
    textLight: 'text-orange-700',
    bgDark: 'bg-orange-500/20',
    textDark: 'text-orange-300',
    bg: 'bg-orange-100 dark:bg-orange-500/20',
    text: 'text-orange-700 dark:text-orange-300',
    hex: '#f97316',
  },
  {
    id: 'pink',
    name: 'Pink',
    bgLight: 'bg-pink-100',
    textLight: 'text-pink-700',
    bgDark: 'bg-pink-500/20',
    textDark: 'text-pink-300',
    bg: 'bg-pink-100 dark:bg-pink-500/20',
    text: 'text-pink-700 dark:text-pink-300',
    hex: '#ec4899',
  },
  {
    id: 'yellow',
    name: 'Yellow',
    bgLight: 'bg-amber-100',
    textLight: 'text-amber-700',
    bgDark: 'bg-amber-500/20',
    textDark: 'text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300',
    hex: '#f59e0b',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    bgLight: 'bg-cyan-100',
    textLight: 'text-cyan-700',
    bgDark: 'bg-cyan-500/20',
    textDark: 'text-cyan-300',
    bg: 'bg-cyan-100 dark:bg-cyan-500/20',
    text: 'text-cyan-700 dark:text-cyan-300',
    hex: '#06b6d4',
  },
  {
    id: 'red',
    name: 'Red',
    bgLight: 'bg-red-100',
    textLight: 'text-red-700',
    bgDark: 'bg-red-500/20',
    textDark: 'text-red-300',
    bg: 'bg-red-100 dark:bg-red-500/20',
    text: 'text-red-700 dark:text-red-300',
    hex: '#ef4444',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    bgLight: 'bg-indigo-100',
    textLight: 'text-indigo-700',
    bgDark: 'bg-indigo-500/20',
    textDark: 'text-indigo-300',
    bg: 'bg-indigo-100 dark:bg-indigo-500/20',
    text: 'text-indigo-700 dark:text-indigo-300',
    hex: '#6366f1',
  },
  {
    id: 'teal',
    name: 'Teal',
    bgLight: 'bg-teal-100',
    textLight: 'text-teal-700',
    bgDark: 'bg-teal-500/20',
    textDark: 'text-teal-300',
    bg: 'bg-teal-100 dark:bg-teal-500/20',
    text: 'text-teal-700 dark:text-teal-300',
    hex: '#14b8a6',
  },
  // Additional colors for variety
  {
    id: 'lime',
    name: 'Lime',
    bgLight: 'bg-lime-100',
    textLight: 'text-lime-700',
    bgDark: 'bg-lime-500/20',
    textDark: 'text-lime-300',
    bg: 'bg-lime-100 dark:bg-lime-500/20',
    text: 'text-lime-700 dark:text-lime-300',
    hex: '#84cc16',
  },
  {
    id: 'rose',
    name: 'Rose',
    bgLight: 'bg-rose-100',
    textLight: 'text-rose-700',
    bgDark: 'bg-rose-500/20',
    textDark: 'text-rose-300',
    bg: 'bg-rose-100 dark:bg-rose-500/20',
    text: 'text-rose-700 dark:text-rose-300',
    hex: '#f43f5e',
  },
  {
    id: 'violet',
    name: 'Violet',
    bgLight: 'bg-violet-100',
    textLight: 'text-violet-700',
    bgDark: 'bg-violet-500/20',
    textDark: 'text-violet-300',
    bg: 'bg-violet-100 dark:bg-violet-500/20',
    text: 'text-violet-700 dark:text-violet-300',
    hex: '#8b5cf6',
  },
  {
    id: 'fuchsia',
    name: 'Fuchsia',
    bgLight: 'bg-fuchsia-100',
    textLight: 'text-fuchsia-700',
    bgDark: 'bg-fuchsia-500/20',
    textDark: 'text-fuchsia-300',
    bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/20',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    hex: '#d946ef',
  },
  {
    id: 'sky',
    name: 'Sky',
    bgLight: 'bg-sky-100',
    textLight: 'text-sky-700',
    bgDark: 'bg-sky-500/20',
    textDark: 'text-sky-300',
    bg: 'bg-sky-100 dark:bg-sky-500/20',
    text: 'text-sky-700 dark:text-sky-300',
    hex: '#0ea5e9',
  },
  {
    id: 'amber',
    name: 'Amber',
    bgLight: 'bg-amber-100',
    textLight: 'text-amber-700',
    bgDark: 'bg-amber-500/25',
    textDark: 'text-amber-200',
    bg: 'bg-amber-100 dark:bg-amber-500/25',
    text: 'text-amber-700 dark:text-amber-200',
    hex: '#f59e0b',
  },
  {
    id: 'slate',
    name: 'Slate',
    bgLight: 'bg-slate-200',
    textLight: 'text-slate-700',
    bgDark: 'bg-slate-500/25',
    textDark: 'text-slate-300',
    bg: 'bg-slate-200 dark:bg-slate-500/25',
    text: 'text-slate-700 dark:text-slate-300',
    hex: '#64748b',
  },
  {
    id: 'zinc',
    name: 'Zinc',
    bgLight: 'bg-zinc-200',
    textLight: 'text-zinc-700',
    bgDark: 'bg-zinc-500/25',
    textDark: 'text-zinc-300',
    bg: 'bg-zinc-200 dark:bg-zinc-500/25',
    text: 'text-zinc-700 dark:text-zinc-300',
    hex: '#71717a',
  },
  {
    id: 'stone',
    name: 'Stone',
    bgLight: 'bg-stone-200',
    textLight: 'text-stone-700',
    bgDark: 'bg-stone-500/25',
    textDark: 'text-stone-300',
    bg: 'bg-stone-200 dark:bg-stone-500/25',
    text: 'text-stone-700 dark:text-stone-300',
    hex: '#78716c',
  },
  {
    id: 'coral',
    name: 'Coral',
    bgLight: 'bg-red-100',
    textLight: 'text-red-600',
    bgDark: 'bg-red-400/20',
    textDark: 'text-red-300',
    bg: 'bg-red-100 dark:bg-red-400/20',
    text: 'text-red-600 dark:text-red-300',
    hex: '#ff7f50',
  },
  {
    id: 'mint',
    name: 'Mint',
    bgLight: 'bg-green-100',
    textLight: 'text-green-600',
    bgDark: 'bg-green-400/20',
    textDark: 'text-green-300',
    bg: 'bg-green-100 dark:bg-green-400/20',
    text: 'text-green-600 dark:text-green-300',
    hex: '#3eb489',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    bgLight: 'bg-purple-100',
    textLight: 'text-purple-600',
    bgDark: 'bg-purple-400/20',
    textDark: 'text-purple-300',
    bg: 'bg-purple-100 dark:bg-purple-400/20',
    text: 'text-purple-600 dark:text-purple-300',
    hex: '#b4a7d6',
  },
  {
    id: 'peach',
    name: 'Peach',
    bgLight: 'bg-orange-100',
    textLight: 'text-orange-600',
    bgDark: 'bg-orange-400/20',
    textDark: 'text-orange-300',
    bg: 'bg-orange-100 dark:bg-orange-400/20',
    text: 'text-orange-600 dark:text-orange-300',
    hex: '#ffb07c',
  },
  {
    id: 'navy',
    name: 'Navy',
    bgLight: 'bg-blue-200',
    textLight: 'text-blue-800',
    bgDark: 'bg-blue-600/25',
    textDark: 'text-blue-200',
    bg: 'bg-blue-200 dark:bg-blue-600/25',
    text: 'text-blue-800 dark:text-blue-200',
    hex: '#1e3a5f',
  },
];

/**
 * Context-aware tag color assignment.
 * Keeps track of colors used within a context (like a column) and
 * assigns unique colors until all 24 are used, then cycles.
 */
const tagColorAssignments = new Map<string, Map<string, TagColor>>();

/**
 * Get or assign a unique color for a tag within a specific context.
 * This ensures different tags in the same column get different colors
 * for as long as possible (up to 24 unique colors).
 * 
 * @param tagName - The tag name to get color for
 * @param contextKey - Optional context identifier (e.g., column ID) for tracking used colors
 * @param existingTags - Optional array of existing tags in the same context
 */
export function getTagColorInContext(
  tagName: string, 
  contextKey?: string, 
  existingTags?: string[]
): TagColor {
  if (!tagName) {
    return TAG_COLORS[0];
  }

  // Check for manual color override: "tagname::colorId"
  if (tagName.includes('::')) {
    const [, colorId] = tagName.split('::');
    const manualColor = TAG_COLORS.find(c => c.id === colorId);
    if (manualColor) return manualColor;
  }

  // If no context provided, fall back to hash-based assignment
  if (!contextKey) {
    return getTagColor(tagName);
  }

  // Get or create context map
  let contextColors = tagColorAssignments.get(contextKey);
  if (!contextColors) {
    contextColors = new Map();
    tagColorAssignments.set(contextKey, contextColors);
  }

  // If this tag already has a color in this context, return it
  const existingColor = contextColors.get(tagName.toLowerCase());
  if (existingColor) {
    return existingColor;
  }

  // Find colors already used in this context
  const usedColorIds = new Set<string>();
  
  // Add colors from the assignment map
  contextColors.forEach((color) => {
    usedColorIds.add(color.id);
  });

  // Also check existing tags if provided
  if (existingTags) {
    existingTags.forEach(tag => {
      const normalizedTag = tag.trim().toLowerCase();
      if (normalizedTag && normalizedTag !== tagName.toLowerCase()) {
        const assignedColor = contextColors!.get(normalizedTag);
        if (assignedColor) {
          usedColorIds.add(assignedColor.id);
        }
      }
    });
  }

  // Find the first unused color
  let assignedColor: TagColor | null = null;
  for (const color of TAG_COLORS) {
    if (!usedColorIds.has(color.id)) {
      assignedColor = color;
      break;
    }
  }

  // If all colors are used, fall back to hash-based selection
  if (!assignedColor) {
    assignedColor = getTagColor(tagName);
  }

  // Store the assignment
  contextColors.set(tagName.toLowerCase(), assignedColor);
  
  return assignedColor;
}

/**
 * Clear color assignments for a context (useful when resetting a column)
 */
export function clearContextColors(contextKey: string): void {
  tagColorAssignments.delete(contextKey);
}

/**
 * Get a consistent color for a tag based on its name.
 * Uses a simple hash function to assign colors deterministically.
 */
export function getTagColor(tagName: string): TagColor {
  if (!tagName) {
    return TAG_COLORS[0]; // Default to blue
  }

  // Check for manual color override: "tagname::colorId"
  if (tagName.includes('::')) {
    const [, colorId] = tagName.split('::');
    const manualColor = TAG_COLORS.find(c => c.id === colorId);
    if (manualColor) return manualColor;
  }
  
  // Simple hash: sum of char codes
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = ((hash << 5) - hash) + tagName.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const index = Math.abs(hash) % TAG_COLORS.length;
  return TAG_COLORS[index];
}

/**
 * Get Tailwind classes for a tag badge
 */
export function getTagClasses(tagName: string): string {
  const color = getTagColor(tagName);
  return `${color.bgLight} ${color.textLight} dark:${color.bgDark} dark:${color.textDark}`;
}

/**
 * Suggested default tags for quick selection
 * Users can still create custom tags
 */
export const SUGGESTED_TAGS = [
  'work',
  'personal',
  'urgent',
  'later',
  'review',
  'research',
  'meeting',
  'idea',
  'reference',
  'archive',
];

/**
 * Sort function for tags - alphabetical
 */
export function sortByTag<T extends { tag?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // Items without tags go last
    if (!a.tag && !b.tag) return 0;
    if (!a.tag) return 1;
    if (!b.tag) return -1;
    return a.tag.localeCompare(b.tag);
  });
}

/**
 * Group items by tag
 */
export function groupByTag<T extends { tag?: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  
  for (const item of items) {
    const tag = item.tag || '';
    const existing = groups.get(tag) || [];
    existing.push(item);
    groups.set(tag, existing);
  }
  
  return groups;
}

/**
 * Extract unique tags from a list of items
 */
export function getUniqueTags<T extends { tag?: string }>(items: T[]): string[] {
  const tags = new Set<string>();
  for (const item of items) {
    if (item.tag) {
      tags.add(item.tag);
    }
  }
  return Array.from(tags).sort();
}

/**
 * Collect all unique tags from a list of tasks
 * Useful for populating tag suggestions in pickers
 */
export function collectAllTags(tasks: Array<{ tag?: string }>): string[] {
  return getUniqueTags(tasks);
}

/**
 * Collect unique tags from tasks, optionally scoped to a specific parent page
 * When parentPageId is provided, only returns tags from tasks in that page
 * When parentPageId is null/undefined (inbox, all, today, upcoming views), returns all tags
 */
export function collectTagsScoped(
  tasks: Array<{ tag?: string; parentPageId?: string }>,
  parentPageId?: string | null,
  showAllTags?: boolean
): string[] {
  if (!parentPageId || showAllTags) {
    // No parent page or explicitly showing all = show all tags (inbox, all, today, upcoming views)
    return getUniqueTags(tasks);
  }
  // Filter tasks to those in the specified parent page
  const scopedTasks = tasks.filter(t => t.parentPageId === parentPageId);
  return getUniqueTags(scopedTasks);
}
