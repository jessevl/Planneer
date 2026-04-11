/**
 * @file syncEngine/utils.test.ts
 * @description Unit tests for sync engine utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  isNotUniqueError,
  is404Error,
  isNetworkError,
  extractBlockIds,
  parseContent,
  parseBlocks,
  reconstructContent,
} from './utils';

describe('syncEngine utils', () => {
  describe('Error Detection', () => {
    describe('isNotUniqueError', () => {
      it('returns true for PocketBase unique constraint error', () => {
        const error = {
          data: {
            id: { code: 'validation_not_unique', message: 'Record already exists' },
          },
        };
        expect(isNotUniqueError(error)).toBe(true);
      });

      it('returns false for other errors', () => {
        expect(isNotUniqueError({ data: { id: { code: 'other' } } })).toBe(false);
        expect(isNotUniqueError({ message: 'error' })).toBe(false);
        expect(isNotUniqueError(null)).toBe(false);
        expect(isNotUniqueError(undefined)).toBe(false);
      });
    });

    describe('is404Error', () => {
      it('returns true for status 404', () => {
        expect(is404Error({ status: 404 })).toBe(true);
      });

      it('returns false for other status codes', () => {
        expect(is404Error({ status: 200 })).toBe(false);
        expect(is404Error({ status: 500 })).toBe(false);
        expect(is404Error({})).toBe(false);
        expect(is404Error(null)).toBe(false);
      });
    });

    describe('isNetworkError', () => {
      it('returns true for status 0', () => {
        expect(isNetworkError({ status: 0 })).toBe(true);
      });

      it('returns true for status 429 (rate limit)', () => {
        expect(isNetworkError({ status: 429 })).toBe(true);
      });

      it('returns true for fetch error messages', () => {
        expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
        expect(isNetworkError(new Error('Network error occurred'))).toBe(true);
      });

      it('returns false for other errors', () => {
        expect(isNetworkError({ status: 500 })).toBe(false);
        expect(isNetworkError(new Error('Validation failed'))).toBe(false);
        expect(isNetworkError(null)).toBe(false);
      });
    });
  });

  describe('Content Utilities', () => {
    describe('extractBlockIds', () => {
      it('extracts block IDs from Yoopta content', () => {
        const content = JSON.stringify({
          'block-1': { type: 'Paragraph' },
          'block-2': { type: 'Heading' },
          'block-3': { type: 'List' },
        });
        
        const ids = extractBlockIds(content);
        
        expect(ids).toContain('block-1');
        expect(ids).toContain('block-2');
        expect(ids).toContain('block-3');
        expect(ids.length).toBe(3);
      });

      it('returns empty array for null content', () => {
        expect(extractBlockIds(null)).toEqual([]);
      });

      it('returns empty array for invalid JSON', () => {
        expect(extractBlockIds('not json')).toEqual([]);
      });
    });

    describe('parseContent', () => {
      it('parses valid JSON string', () => {
        const content = JSON.stringify({ key: 'value' });
        const parsed = parseContent(content);
        expect(parsed).toEqual({ key: 'value' });
      });

      it('returns empty object for null', () => {
        expect(parseContent(null)).toEqual({});
      });

      it('returns empty object for undefined', () => {
        expect(parseContent(undefined)).toEqual({});
      });

      it('returns empty object for invalid JSON', () => {
        expect(parseContent('not json')).toEqual({});
      });

      it('returns object if already parsed', () => {
        const obj = { key: 'value' };
        expect(parseContent(obj as any)).toEqual(obj);
      });
    });

    describe('parseBlocks', () => {
      it('parses Yoopta content directly', () => {
        const content = JSON.stringify({
          'block-1': { type: 'Paragraph' },
        });
        
        const blocks = parseBlocks(content);
        
        expect(blocks['block-1']).toEqual({ type: 'Paragraph' });
      });

      it('returns empty object for null content', () => {
        expect(parseBlocks(null)).toEqual({});
      });
    });

    describe('reconstructContent', () => {
      it('returns blocks directly for Yoopta format', () => {
        const blocks = { 'block-1': { type: 'Paragraph' } };
        
        const result = reconstructContent(blocks);
        
        expect(result).toEqual(blocks);
      });
    });
  });
});
