/**
 * @file BooxPageEmbedRender.tsx
 * @description Read-only renderer for embedded BOOX notebook pages inside Yoopta
 */

import { useMemo } from 'react';
import type { PluginElementRenderProps } from '@yoopta/editor';

import { buildBooxSourcePdfPageUrl } from '@/lib/booxPageEmbed';
import type { BooxPageEmbedElementProps } from './types';

function formatSourceModifiedAt(value: string): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default function BooxPageEmbedRender({
  attributes,
  element,
}: PluginElementRenderProps) {
  const props = element.props as unknown as BooxPageEmbedElementProps;

  const sourcePageUrl = useMemo(
    () => buildBooxSourcePdfPageUrl(props.sourcePdfUrl, props.pageNumber),
    [props.pageNumber, props.sourcePdfUrl],
  );

  const modifiedLabel = useMemo(
    () => formatSourceModifiedAt(props.sourceModifiedAt),
    [props.sourceModifiedAt],
  );

  const stopSlateSelection = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      {...attributes}
      contentEditable={false}
      onMouseDown={stopSlateSelection}
      onClick={stopSlateSelection}
      className="my-3"
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-white shadow-sm dark:bg-gh-canvas-default">
        <div className="border-b border-[var(--color-border-default)] bg-[var(--color-surface-secondary)] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
            BOOX Page Embed
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
            {props.notebookTitle || 'BOOX Notebook'}
          </div>
          <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Page {props.pageNumber}
            {modifiedLabel ? ` • source updated ${modifiedLabel}` : ''}
          </div>
        </div>

        {props.previewImageUrl ? (
          <div className="bg-[var(--color-surface-secondary)] p-3">
            <img
              src={props.previewImageUrl}
              alt={`${props.notebookTitle || 'BOOX notebook'} page ${props.pageNumber}`}
              className="mx-auto w-full max-w-2xl rounded-xl border border-[var(--color-border-subtle)] bg-white object-contain shadow-sm"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex min-h-[220px] items-center justify-center bg-[var(--color-surface-secondary)] px-4 py-10 text-sm text-[var(--color-text-secondary)]">
            Preview unavailable for this BOOX page.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="text-xs text-[var(--color-text-tertiary)]">
            Linked to the mirrored source PDF and preserved as a read-only notebook page snapshot.
          </div>
          <a
            href={sourcePageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-[var(--color-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-secondary)]"
          >
            Open source page
          </a>
        </div>
      </div>
    </div>
  );
}