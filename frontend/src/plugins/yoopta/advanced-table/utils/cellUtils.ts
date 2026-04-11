/**
 * @file cellUtils.ts
 * @description Shared utilities for table cell operations
 */
import type { AdvancedTableCellElement } from '../types';

/**
 * Extract text content from a table cell element
 */
export function getCellText(cell: AdvancedTableCellElement): string {
  if (!cell?.children) return '';
  return cell.children
    .map((child: any) => child.text || '')
    .join('')
    .trim();
}

/**
 * Type guard for table element
 */
export function isTableElement(n: unknown): boolean {
  return !!n && typeof n === 'object' && (n as any).type === 'table';
}

/**
 * Type guard for table row element
 */
export function isTableRowElement(n: unknown): boolean {
  return !!n && typeof n === 'object' && (n as any).type === 'table-row';
}

/**
 * Type guard for table cell element
 */
export function isTableCellElement(n: unknown): boolean {
  return !!n && typeof n === 'object' && (n as any).type === 'table-data-cell';
}
