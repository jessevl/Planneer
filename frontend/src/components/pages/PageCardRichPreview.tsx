/**
 * @file PageCardRichPreview.tsx
 * @description Lightweight rich-content preview renderer for page cards
 * @app PAGES - Used by PageCard
 *
 * Features:
 * - Renders a small subset of Yoopta content with basic block and mark styling
 * - Preserves headings, quotes, lists, todo items, code blocks, and inline marks
 * - Falls back to plain text when rich content is unavailable
 *
 * Used by:
 * - PageCard
 */
import React, { useMemo } from 'react';
import { cn } from '@/lib/design-system';
import { extractRichPagePreviewBlocks } from '@/lib/pageUtils';
import type { PagePreviewBlock, PagePreviewLeaf } from '@/types/page';

interface PageCardRichPreviewProps {
  /** Serialized Yoopta content for the page */
  content: string | null;
  /** Precomputed structured preview blocks from the server */
  previewBlocks?: PagePreviewBlock[] | null;
  /** Plain-text fallback when structured content is unavailable */
  fallbackText?: string;
  /** Maximum number of blocks to render */
  maxBlocks?: number;
}

const blockClampStyle: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

function renderLeaf(leaf: PagePreviewLeaf, index: number): React.ReactNode {
  let node: React.ReactNode = leaf.text || '';

  if (leaf.code) {
    node = (
      <code className="rounded bg-[var(--color-surface-secondary)] px-1 py-0.5 font-mono text-[11px] text-[var(--color-text-primary)]">
        {node}
      </code>
    );
  }

  if (leaf.bold) node = <strong>{node}</strong>;
  if (leaf.italic) node = <em>{node}</em>;
  if (leaf.underline) node = <span className="underline underline-offset-2">{node}</span>;
  if (leaf.strike) node = <span className="line-through opacity-80">{node}</span>;
  if (leaf.highlight) {
    node = (
      <span className="rounded bg-yellow-200/80 px-0.5 dark:bg-yellow-500/30">
        {node}
      </span>
    );
  }

  if (leaf.href) {
    node = (
      <span className="text-[var(--color-accent-primary)] underline underline-offset-2">
        {node}
      </span>
    );
  }

  return <React.Fragment key={`${leaf.text}-${index}`}>{node}</React.Fragment>;
}

function renderInline(children: PagePreviewLeaf[]): React.ReactNode {
  return children.map((leaf, index) => renderLeaf(leaf, index));
}

function PreviewBlock({ block, index }: { block: PagePreviewBlock; index: number }) {
  switch (block.type) {
    case 'heading-one':
      return (
        <div className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]" style={blockClampStyle}>
          {renderInline(block.children)}
        </div>
      );
    case 'heading-two':
    case 'heading-three':
      return (
        <div className="text-sm font-semibold text-[var(--color-text-primary)]" style={blockClampStyle}>
          {renderInline(block.children)}
        </div>
      );
    case 'blockquote':
      return (
        <div className="rounded-r-lg border-l-2 border-[var(--color-border-default)] pl-3 text-[13px] italic text-[var(--color-text-secondary)]" style={blockClampStyle}>
          {renderInline(block.children)}
        </div>
      );
    case 'callout':
      return (
        <div className="rounded-lg border border-amber-200/70 bg-amber-50/70 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" style={blockClampStyle}>
          {renderInline(block.children)}
        </div>
      );
    case 'code':
      return (
        <pre className="overflow-hidden rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] px-3 py-2 font-mono text-[11px] leading-5 text-[var(--color-text-primary)]" style={blockClampStyle}>
          {renderInline(block.children)}
        </pre>
      );
    case 'divider':
      return <div className="my-1 h-px w-full bg-[var(--color-border-default)]" />;
    case 'bulleted-list':
      return (
        <div className="flex items-start gap-2 text-[13px] text-[var(--color-text-primary)]" style={{ marginLeft: `${block.depth * 12}px` }}>
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-accent-primary)]" />
          <span className="min-w-0" style={blockClampStyle}>{renderInline(block.children)}</span>
        </div>
      );
    case 'numbered-list':
      return (
        <div className="flex items-start gap-2 text-[13px] text-[var(--color-text-primary)]" style={{ marginLeft: `${block.depth * 12}px` }}>
          <span className="min-w-[1rem] text-[11px] font-semibold text-[var(--color-text-secondary)]">{index + 1}.</span>
          <span className="min-w-0" style={blockClampStyle}>{renderInline(block.children)}</span>
        </div>
      );
    case 'todo-list':
      return (
        <div className="flex items-start gap-2 text-[13px] text-[var(--color-text-primary)]" style={{ marginLeft: `${block.depth * 12}px` }}>
          <span className={cn(
            'mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border text-[10px] font-semibold',
            block.checked
              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'border-[var(--color-border-default)] text-transparent'
          )}>
            ✓
          </span>
          <span className={cn('min-w-0', block.checked && 'line-through opacity-70')} style={blockClampStyle}>
            {renderInline(block.children)}
          </span>
        </div>
      );
    default:
      return (
        <div className="text-[13px] leading-5 text-[var(--color-text-primary)]" style={blockClampStyle}>
          {renderInline(block.children)}
        </div>
      );
  }
}

const PageCardRichPreview: React.FC<PageCardRichPreviewProps> = ({
  content,
  previewBlocks = null,
  fallbackText = '',
  maxBlocks = 4,
}) => {
  const blocks = useMemo(
    () => (previewBlocks && previewBlocks.length > 0 ? previewBlocks : extractRichPagePreviewBlocks(content, maxBlocks)),
    [content, maxBlocks, previewBlocks]
  );

  if (blocks.length === 0) {
    return fallbackText ? (
      <p className="text-sm leading-6 text-[var(--color-text-primary)]" style={blockClampStyle}>
        {fallbackText}
      </p>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, index) => (
        <PreviewBlock key={block.id} block={block} index={index} />
      ))}
    </div>
  );
};

export default React.memo(PageCardRichPreview);