/**
 * @file booxPageEmbed.test.ts
 * @description Unit tests for BOOX page embed helpers
 */

import { describe, expect, it } from 'vitest';

import {
  buildBooxSourcePdfPageUrl,
  clampBooxPageNumber,
  createBooxNotebookPageId,
} from './booxPageEmbed';

describe('booxPageEmbed helpers', () => {
  it('creates a stable notebook page id', () => {
    expect(createBooxNotebookPageId('page_123', 4)).toBe('page_123:page:4');
  });

  it('clamps page numbers to a valid range', () => {
    expect(clampBooxPageNumber(0, 10)).toBe(1);
    expect(clampBooxPageNumber(3.9, 10)).toBe(3);
    expect(clampBooxPageNumber(42, 12)).toBe(12);
  });

  it('builds a source PDF url with the selected page hash', () => {
    expect(buildBooxSourcePdfPageUrl('https://example.test/notebook.pdf', 8))
      .toBe('https://example.test/notebook.pdf#page=8');
  });

  it('replaces an existing hash when building the page url', () => {
    expect(buildBooxSourcePdfPageUrl('https://example.test/notebook.pdf#page=2', 5))
      .toBe('https://example.test/notebook.pdf#page=5');
  });
});