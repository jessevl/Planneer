/**
 * @file CardPreviewCollection.tsx
 * @description Mini child-page preview for collection cards in grid view
 * @app PAGES - Used by PageCard when viewMode='collection'
 *
 * Shows the two most recent child pages as vertical mini-cards side by side,
 * plus a dashed "+N more" card when additional children exist.
 * Mirrors the horizontal layout of CardPreviewTasks for visual consistency.
 *
 * Used by:
 * - PageCard (excerpt area for collection pages)
 */
import React, { useMemo } from 'react';
import { FolderOpen, ListTodo } from 'lucide-react';
import { usePagesStore } from '@/stores/pagesStore';
import ItemIcon from '@/components/common/ItemIcon';
import type { Page } from '@/types/page';
import PageCardRichPreview from '@/components/pages/PageCardRichPreview';

const MAX_VISIBLE = 2;

interface CardPreviewCollectionProps {
  pageId: string;
}

function getChildPreviewText(child: Page): string {
  const structuredText = child.previewStructured
    ?.flatMap((block) => block.children.map((leaf) => leaf.text.trim()))
    .find((text) => text.length > 0);

  if (structuredText) {
    return structuredText;
  }

  return child.excerpt?.trim() ?? '';
}

function ChildPreviewBody({ child }: { child: Page }) {
  const isTaskPage = child.viewMode === 'tasks';
  const isCollectionPage = child.viewMode === 'collection';

  if (isTaskPage || isCollectionPage) {
    const Icon = isTaskPage ? ListTodo : FolderOpen;

    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg bg-[var(--color-surface-secondary)]/55">
        <Icon className="h-7 w-7 text-[var(--color-text-tertiary)]/70" strokeWidth={1.6} />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-[var(--color-surface-secondary)]/35 px-2 py-1.5">
      <PageCardRichPreview
        content={child.content}
        previewBlocks={child.previewStructured ?? null}
        fallbackText={getChildPreviewText(child)}
        maxBlocks={2}
      />
    </div>
  );
}

const CardPreviewCollection: React.FC<CardPreviewCollectionProps> = React.memo(
  ({ pageId }) => {
    const getChildren = usePagesStore((s) => s.getChildren);

    const children = useMemo(() => getChildren(pageId), [getChildren, pageId]);

    if (children.length === 0) {
      return (
        <div className="flex h-full flex-col justify-center rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-base)]/70 px-3 py-4 text-center">
          <FolderOpen className="mx-auto mb-2 h-5 w-5 text-[var(--color-text-secondary)]" />
          <p className="text-xs font-medium text-[var(--color-text-primary)]">Empty collection</p>
          <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">Add pages to turn this into a working area.</p>
        </div>
      );
    }

    const visible = children.slice(0, MAX_VISIBLE);
    const remaining = children.length - MAX_VISIBLE;

    return (
      <div className="flex h-full gap-1.5 overflow-hidden">
        {visible.map((child) => {
          const iconType =
            child.isDailyNote
              ? 'daily'
              : child.viewMode === 'tasks'
                  ? 'tasks'
                  : child.viewMode === 'collection'
                    ? 'collection'
                    : 'note';

          return (
            <div
              key={child.id}
              className="flex flex-1 flex-col gap-1.5 overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-base)]/90 px-2.5 py-2"
            >
              <div className="flex items-center gap-1.5">
                <div className="flex-shrink-0 rounded-md bg-[var(--color-surface-secondary)] p-1">
                  <ItemIcon
                    type={iconType}
                    icon={child.icon}
                    color={child.color}
                    size="xs"
                  />
                </div>
                <span className="truncate text-[11px] font-semibold text-[var(--color-text-primary)] leading-tight">
                  {child.title}
                </span>
              </div>
              <ChildPreviewBody child={child} />
            </div>
          );
        })}

        {remaining > 0 && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-base)]/60 px-2 py-3">
            <span className="text-lg font-semibold text-[var(--color-text-secondary)]">
              +{remaining}
            </span>
            <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">more</span>
          </div>
        )}
      </div>
    );
  }
);

CardPreviewCollection.displayName = 'CardPreviewCollection';

export default CardPreviewCollection;
