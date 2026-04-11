/**
 * @file dataExport.ts
 * @description Export workspace data via backend API
 * - CSV: Tasks only as a spreadsheet
 * - Markdown: Pages as a ZIP with individual .md files (folder structure preserved)
 */

import { pb } from './pocketbase';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTasksStore } from '@/stores/tasksStore';
import { usePagesStore } from '@/stores/pagesStore';
import type { Task } from '@/types/task';

export type ExportFormat = 'csv' | 'markdown';

/**
 * Export workspace data to the specified format
 * Uses backend API to ensure complete data including all page content
 */
export async function exportWorkspace(format: ExportFormat): Promise<void> {
  const workspaceId = useWorkspaceStore.getState().currentWorkspaceId;
  if (!workspaceId) {
    throw new Error('No workspace selected');
  }

  const token = pb.authStore.token;
  if (!token) {
    throw new Error('Not authenticated');
  }

  // Call backend export API
  const response = await fetch(
    `${pb.baseURL}/api/workspaces/${workspaceId}/export?format=${format}`,
    {
      method: 'GET',
      headers: {
        'Authorization': token,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Export failed' }));
    throw new Error(error.message || 'Export failed');
  }

  // Get filename from Content-Disposition header or generate one
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = format === 'csv' ? 'tasks.csv' : 'pages.zip';
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match) {
      filename = match[1];
    }
  }

  // Download the file
  const blob = await response.blob();
  downloadBlob(blob, filename);
}

/**
 * Export tasks to CSV format
 */
export async function exportToCSV(): Promise<void> {
  return exportWorkspace('csv');
}

/**
 * Export pages to Markdown format (ZIP with individual files)
 */
export async function exportToMarkdown(): Promise<void> {
  return exportWorkspace('markdown');
}

/**
 * Download a blob as a file
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Legacy function for backwards compatibility - downloads content as file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Export a single page to Markdown format
 * Uses backend API to convert Yoopta content to Markdown
 */
export async function exportPageToMarkdown(pageId: string, pageTitle: string): Promise<void> {
  const token = pb.authStore.token;
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(
    `${pb.baseURL}/api/pages/${pageId}/export`,
    {
      method: 'GET',
      headers: {
        'Authorization': token,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Export failed' }));
    throw new Error(error.message || 'Export failed');
  }

  // Get filename from Content-Disposition header or generate one
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = `${pageTitle || 'page'}.md`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  downloadBlob(blob, filename);
}

/**
 * Export tasks from a specific page to CSV format
 * Creates a CSV with columns: title, dueDate, priority, completed, sectionId, tag, description
 */
export function exportTasksToCSV(pageId: string, pageTitle: string): void {
  const tasksById = useTasksStore.getState().tasksById;
  const tasks = Object.values(tasksById).filter(t => t.parentPageId === pageId);
  
  if (tasks.length === 0) {
    throw new Error('No tasks to export');
  }
  
  // CSV header
  const headers = ['title', 'dueDate', 'priority', 'completed', 'sectionId', 'tag', 'description'];
  
  // Escape CSV field (handle commas, quotes, newlines)
  const escapeCSV = (value: string | null | undefined): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If the string contains comma, quote, or newline, wrap in quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  // Build CSV rows
  const rows: string[] = [headers.join(',')];
  
  for (const task of tasks) {
    const row = [
      escapeCSV(task.title),
      escapeCSV(task.dueDate),
      escapeCSV(task.priority),
      task.completed ? 'true' : 'false',
      escapeCSV(task.sectionId),
      escapeCSV(task.tag),
      escapeCSV(task.description),
    ];
    rows.push(row.join(','));
  }
  
  const csvContent = rows.join('\n');
  const filename = `${pageTitle || 'tasks'}-tasks.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
}

/**
 * Parse CSV content and import tasks to a specific page
 * Expected columns: title, dueDate, priority, completed, sectionId, tag, description
 * Returns the number of tasks imported
 */
export async function importTasksFromCSV(
  csvContent: string, 
  targetPageId: string
): Promise<{ imported: number; errors: string[] }> {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row');
  }
  
  const headerLine = lines[0];
  const headers = parseCSVRow(headerLine);
  
  // Map header names to indices (case-insensitive)
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h.toLowerCase().trim()] = i;
  });
  
  // Required: title column
  if (!('title' in headerMap)) {
    throw new Error('CSV must have a "title" column');
  }
  
  const addTask = useTasksStore.getState().addTask;
  const pagesById = usePagesStore.getState().pagesById;
  
  // Verify target page exists
  const targetPage = pagesById[targetPageId];
  if (!targetPage) {
    throw new Error('Target page not found');
  }
  
  const errors: string[] = [];
  let imported = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    try {
      const values = parseCSVRow(line);
      
      const title = values[headerMap['title']] || '';
      if (!title.trim()) {
        errors.push(`Row ${i + 1}: Empty title, skipped`);
        continue;
      }
      
      const taskData: {
        title: string;
        parentPageId: string;
        dueDate?: string;
        priority?: 'Low' | 'Medium' | 'High';
        sectionId?: string;
        tag?: string;
        description?: string;
      } = {
        title: title.trim(),
        parentPageId: targetPageId,
      };
      
      // Optional fields
      if ('duedate' in headerMap && values[headerMap['duedate']]) {
        const dateStr = values[headerMap['duedate']].trim();
        // Accept ISO format or common date formats
        if (dateStr) {
          taskData.dueDate = dateStr;
        }
      }
      
      if ('priority' in headerMap && values[headerMap['priority']]) {
        const priority = values[headerMap['priority']].trim();
        if (['Low', 'Medium', 'High'].includes(priority)) {
          taskData.priority = priority as 'Low' | 'Medium' | 'High';
        }
      }
      
      if ('sectionid' in headerMap && values[headerMap['sectionid']]) {
        taskData.sectionId = values[headerMap['sectionid']].trim();
      }
      
      if ('tag' in headerMap && values[headerMap['tag']]) {
        taskData.tag = values[headerMap['tag']].trim();
      }
      
      if ('description' in headerMap && values[headerMap['description']]) {
        taskData.description = values[headerMap['description']].trim();
      }
      
      await addTask(taskData);
      imported++;
    } catch (err) {
      errors.push(`Row ${i + 1}: ${(err as Error).message}`);
    }
  }
  
  return { imported, errors };
}

/**
 * Parse a single CSV row, handling quoted fields
 */
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < row.length) {
    const char = row[i];
    
    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote
        if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        current += char;
        i++;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
      } else if (char === ',') {
        result.push(current);
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
  }
  
  // Add the last field
  result.push(current);
  
  return result;
}

/**
 * Open a file picker for CSV files and return the content
 */
export function pickCSVFile(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      
      try {
        const content = await file.text();
        resolve({ name: file.name, content });
      } catch (err) {
        console.error('Error reading CSV file:', err);
        resolve(null);
      }
    };
    
    input.oncancel = () => resolve(null);
    input.click();
  });
}
