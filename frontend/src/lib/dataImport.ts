/**
 * @file dataImport.ts
 * @description Import data from Markdown files or folders into the workspace
 * - Single .md file: Creates a single note
 * - Folder: Creates pages with folder structure preserved as collections
 */

import type { Page, CreatePageInput } from '@/types/page';

export interface ImportResult {
  success: boolean;
  notesCreated: number;
  errors: string[];
}

export interface ParsedMarkdownNote {
  title: string;
  content: string;
  depth: number;
  parentIndex: number | null;
}

export interface FolderImportEntry {
  path: string;           // Full path (e.g., "Projects/Work/Tasks.md")
  title: string;          // Filename without extension or folder name
  content: string;        // Yoopta JSON content
  isCollection: boolean;  // True if this is a folder
  parentPath: string | null; // Parent folder path
}

/**
 * Parse files from a folder selection
 * Folder structure is preserved as page collections
 */
export async function parseFolderFiles(files: FileList): Promise<FolderImportEntry[]> {
  const entries: FolderImportEntry[] = [];
  const folderPaths = new Set<string>();
  const filesByPath = new Map<string, File>();

  // First pass: collect all markdown files and identify folders
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // webkitRelativePath gives us the path like "FolderName/SubFolder/file.md"
    const relativePath = (file as any).webkitRelativePath || file.name;
    
    if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
      filesByPath.set(relativePath, file);
      
      // Track all parent folders
      const parts = relativePath.split('/');
      for (let j = 1; j < parts.length; j++) {
        folderPaths.add(parts.slice(0, j).join('/'));
      }
    }
  }

  // Second pass: create folder entries
  const sortedFolders = Array.from(folderPaths).sort((a, b) => {
    const depthA = (a.match(/\//g) || []).length;
    const depthB = (b.match(/\//g) || []).length;
    return depthA - depthB;
  });

  for (const folderPath of sortedFolders) {
    const parts = folderPath.split('/');
    const title = parts[parts.length - 1];
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null;

    // Check if there's an index.md in this folder
    const indexPath = folderPath + '/index.md';
    const indexFile = filesByPath.get(indexPath);
    
    let content = '';
    if (indexFile) {
      const text = await readFileAsText(indexFile);
      content = markdownToYoopta(text);
      filesByPath.delete(indexPath); // Don't process again
    }

    entries.push({
      path: folderPath,
      title,
      content,
      isCollection: true,
      parentPath,
    });
  }

  // Third pass: process remaining files
  for (const [relativePath, file] of filesByPath) {
    const text = await readFileAsText(file);
    const content = markdownToYoopta(text);
    
    const parts = relativePath.split('/');
    const filename = parts[parts.length - 1];
    const title = filename.replace(/\.(md|markdown|txt)$/i, '');
    const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : null;

    entries.push({
      path: relativePath.replace(/\.(md|markdown|txt)$/i, ''),
      title,
      content,
      isCollection: false,
      parentPath,
    });
  }

  // Sort by path depth to ensure parents are created before children
  entries.sort((a, b) => {
    const depthA = (a.path.match(/\//g) || []).length;
    const depthB = (b.path.match(/\//g) || []).length;
    if (depthA !== depthB) return depthA - depthB;
    // Collections before files at same depth
    if (a.isCollection !== b.isCollection) return a.isCollection ? -1 : 1;
    return a.path.localeCompare(b.path);
  });

  return entries;
}

/**
 * Convert markdown content to Yoopta JSON format
 */
function markdownToYoopta(markdown: string): string {
  const lines = markdown.split('\n');
  const blocks: Record<string, any> = {};
  let order = 0;

  // Skip leading title if it's just a single h1 (will be used as note title)
  let startIndex = 0;
  const firstNonEmptyLine = lines.findIndex(l => l.trim());
  if (firstNonEmptyLine >= 0 && lines[firstNonEmptyLine].match(/^#\s+/)) {
    startIndex = firstNonEmptyLine + 1;
    // Skip empty lines after title
    while (startIndex < lines.length && !lines[startIndex].trim()) {
      startIndex++;
    }
  }

  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines
    if (trimmed === '') {
      i++;
      continue;
    }

    const blockId = `block-${Date.now()}-${order}`;
    let block: any = null;

    // Heading patterns
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    const h3Match = trimmed.match(/^###\s+(.+)$/);

    // List patterns
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    const todoMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);

    // Blockquote
    const quoteMatch = trimmed.match(/^>\s*(.*)$/);

    // Code block
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```

      block = {
        id: blockId,
        type: 'Code',
        meta: { order, depth: 0 },
        value: [{ children: [{ text: codeLines.join('\n') }] }],
      };
    } else if (trimmed === '---' || trimmed === '***') {
      block = {
        id: blockId,
        type: 'Divider',
        meta: { order, depth: 0 },
        value: [{ children: [{ text: '' }] }],
      };
      i++;
    } else if (h1Match) {
      block = {
        id: blockId,
        type: 'HeadingOne',
        meta: { order, depth: 0 },
        value: [{ children: parseInlineFormatting(h1Match[1]) }],
      };
      i++;
    } else if (h2Match) {
      block = {
        id: blockId,
        type: 'HeadingTwo',
        meta: { order, depth: 0 },
        value: [{ children: parseInlineFormatting(h2Match[1]) }],
      };
      i++;
    } else if (h3Match) {
      block = {
        id: blockId,
        type: 'HeadingThree',
        meta: { order, depth: 0 },
        value: [{ children: parseInlineFormatting(h3Match[1]) }],
      };
      i++;
    } else if (todoMatch) {
      // Check todoMatch BEFORE bulletMatch since `- [ ] text` also matches bullet pattern
      const checked = todoMatch[1].toLowerCase() === 'x';
      block = {
        id: blockId,
        type: 'TodoList',
        meta: { order, depth: 0 },
        value: [{ 
          id: `el-${Date.now()}-${order}`,
          type: 'todo-list',
          children: parseInlineFormatting(todoMatch[2]),
          props: { nodeType: 'block', checked }
        }],
      };
      i++;
    } else if (bulletMatch) {
      block = {
        id: blockId,
        type: 'BulletedList',
        meta: { order, depth: 0 },
        value: [{ 
          id: `el-${Date.now()}-${order}`,
          type: 'bulleted-list',
          children: parseInlineFormatting(bulletMatch[1]),
          props: { nodeType: 'block' }
        }],
      };
      i++;
    } else if (numberedMatch) {
      block = {
        id: blockId,
        type: 'NumberedList',
        meta: { order, depth: 0 },
        value: [{ 
          id: `el-${Date.now()}-${order}`,
          type: 'numbered-list',
          children: parseInlineFormatting(numberedMatch[1]),
          props: { nodeType: 'block' }
        }],
      };
      i++;
    } else if (quoteMatch) {
      block = {
        id: blockId,
        type: 'Blockquote',
        meta: { order, depth: 0 },
        value: [{ children: parseInlineFormatting(quoteMatch[1]) }],
      };
      i++;
    } else {
      // Regular paragraph
      block = {
        id: blockId,
        type: 'Paragraph',
        meta: { order, depth: 0 },
        value: [{ children: parseInlineFormatting(trimmed) }],
      };
      i++;
    }

    if (block) {
      blocks[blockId] = block;
      order++;
    }
  }

  if (Object.keys(blocks).length === 0) {
    return '';
  }

  return JSON.stringify(blocks);
}

/**
 * Parse inline Markdown formatting (bold, italic, code, strikethrough)
 */
function parseInlineFormatting(text: string): any[] {
  // Check for any formatting
  const hasFormatting = /\*\*|__|\*|_|`|~~/.test(text);
  
  if (!hasFormatting) {
    return [{ text }];
  }

  // Simple approach: process one pattern at a time
  let processed = text;

  // Bold
  processed = processed.replace(/\*\*(.+?)\*\*/g, (_, content) => {
    return `\x00BOLD:${content}\x00`;
  });

  // Italic (after bold to avoid conflicts)
  processed = processed.replace(/\*(.+?)\*/g, (_, content) => {
    return `\x00ITALIC:${content}\x00`;
  });

  // Code
  processed = processed.replace(/`(.+?)`/g, (_, content) => {
    return `\x00CODE:${content}\x00`;
  });

  // Strikethrough
  processed = processed.replace(/~~(.+?)~~/g, (_, content) => {
    return `\x00STRIKE:${content}\x00`;
  });

  // Split and rebuild
  const parts = processed.split('\x00').filter(Boolean);
  const segments: any[] = [];

  for (const part of parts) {
    if (part.startsWith('BOLD:')) {
      segments.push({ text: part.slice(5), bold: true });
    } else if (part.startsWith('ITALIC:')) {
      segments.push({ text: part.slice(7), italic: true });
    } else if (part.startsWith('CODE:')) {
      segments.push({ text: part.slice(5), code: true });
    } else if (part.startsWith('STRIKE:')) {
      segments.push({ text: part.slice(7), strikethrough: true });
    } else {
      segments.push({ text: part });
    }
  }

  return segments.length > 0 ? segments : [{ text }];
}

/**
 * Parse a Markdown file into a hierarchy of pages (legacy - single file)
 */
export function parseMarkdownFile(markdown: string): ParsedMarkdownNote[] {
  const lines = markdown.split('\n');
  const pages: ParsedMarkdownNote[] = [];

  let currentNote: ParsedMarkdownNote | null = null;
  let contentLines: string[] = [];
  const depthStack: { depth: number; index: number }[] = [];

  const flushCurrentNote = () => {
    if (currentNote) {
      currentNote.content = contentLinesToYoopta(contentLines);
      pages.push(currentNote);
      contentLines = [];
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      flushCurrentNote();

      const depth = headingMatch[1].length;
      const title = headingMatch[2].replace(/^[^\w\s]*\s*/, '').trim();

      while (depthStack.length > 0 && depthStack[depthStack.length - 1].depth >= depth) {
        depthStack.pop();
      }

      const parentIndex = depthStack.length > 0 ? depthStack[depthStack.length - 1].index : null;

      currentNote = {
        title,
        content: '',
        depth,
        parentIndex,
      };

      depthStack.push({ depth, index: pages.length });
    } else if (currentNote) {
      contentLines.push(line);
    }
  }

  flushCurrentNote();
  return pages;
}

/**
 * Convert markdown content lines to Yoopta JSON format (for single-file import)
 */
function contentLinesToYoopta(lines: string[]): string {
  // Filter out empty leading/trailing lines
  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();

  const content = lines.join('\n');
  return markdownToYoopta('# Placeholder\n\n' + content); // Add placeholder heading so it gets parsed
}

/**
 * Read a file from the user's file input
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Trigger file picker for a single markdown file or a folder
 */
export function pickNotesFile(): Promise<{
  type: 'file' | 'folder';
  name: string;
  entries: FolderImportEntry[];
} | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const content = await readFileAsText(file);
        const yooptaContent = markdownToYoopta(content);
        const title = file.name.replace(/\.(md|markdown|txt)$/i, '');
        
        resolve({
          type: 'file',
          name: file.name,
          entries: [{
            path: title,
            title,
            content: yooptaContent,
            isCollection: false,
            parentPath: null,
          }],
        });
      } catch (error) {
        console.error('Failed to parse file:', error);
        resolve(null);
      }
    };

    input.click();
  });
}

/**
 * Pick a folder and import all markdown files with hierarchy
 */
export function pickNotesFolder(): Promise<{
  type: 'folder';
  name: string;
  entries: FolderImportEntry[];
} | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    // @ts-expect-error - directory is a non-standard property for some browsers
    input.directory = true;

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        resolve(null);
        return;
      }

      try {
        const entries = await parseFolderFiles(files);
        // Get folder name from first file's path
        const firstPath = (files[0] as any).webkitRelativePath || files[0].name;
        const folderName = firstPath.split('/')[0] || 'Imported';
        
        resolve({
          type: 'folder',
          name: folderName,
          entries,
        });
      } catch (error) {
        console.error('Failed to parse folder:', error);
        resolve(null);
      }
    };

    input.click();
  });
}

/**
 * Legacy function - picks a single markdown file (for backwards compatibility)
 */
export function pickMarkdownFile(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.txt';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const content = await readFileAsText(file);
        resolve({ name: file.name, content });
      } catch (error) {
        resolve(null);
      }
    };

    input.click();
  });
}
