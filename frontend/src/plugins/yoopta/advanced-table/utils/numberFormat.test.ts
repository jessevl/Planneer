/**
 * @file numberFormat.test.ts
 * @description Unit tests for number column display formats
 */

import { describe, it, expect } from 'vitest';
import { detectNumberFormat, effectiveDecimals, formatCellNumber, formatNumber } from './numberFormat';
import { analyzeNumber } from './parseValues';

describe('analyzeNumber', () => {
  it('reports currency, decimals and grouping as written', () => {
    expect(analyzeNumber('€53,166.00')).toEqual({ value: 53166, currency: 'EUR', percent: false, fractionDigits: 2, grouped: true });
    expect(analyzeNumber('12.50 USD')).toMatchObject({ value: 12.5, currency: 'USD', fractionDigits: 2, grouped: false });
  });

  it('reads percentages as fractions', () => {
    expect(analyzeNumber('12.5%')).toMatchObject({ value: 0.125, percent: true, fractionDigits: 1 });
    expect(analyzeNumber('-3%')?.value).toBe(-0.03);
  });
});

describe('detectNumberFormat', () => {
  it('detects a shared currency and its decimals', () => {
    expect(detectNumberFormat(['€65,000.00', '€27,000.00', ''])).toEqual({ style: 'currency', currency: 'EUR', decimals: 2 });
  });

  it('detects percentages', () => {
    expect(detectNumberFormat(['10%', '12.5%'])).toEqual({ style: 'percent', decimals: undefined });
  });

  it('detects grouped numbers', () => {
    expect(detectNumberFormat(['1,234', '56'])).toEqual({ style: 'number', decimals: undefined, grouping: true });
  });

  it('returns nothing for plain numbers or text', () => {
    expect(detectNumberFormat(['12', '7'])).toBeUndefined();
    expect(detectNumberFormat(['n/a', ''])).toBeUndefined();
  });
});

describe('formatNumber', () => {
  it('formats currency, percent and grouped numbers', () => {
    expect(formatNumber(53166, { style: 'currency', currency: 'EUR' }, 'en-US')).toBe('€53,166.00');
    expect(formatNumber(53166, { style: 'currency', currency: 'EUR' }, 'nl-NL')).toBe('€ 53.166,00');
    expect(formatNumber(0.125, { style: 'percent', decimals: 1 }, 'en-US')).toBe('12.5%');
    expect(formatNumber(1234.5, { style: 'number', grouping: true, decimals: 2 }, 'en-US')).toBe('1,234.50');
    expect(formatNumber(1234.5678, undefined, 'en-US')).toBe('1234.5678');
  });

  it('leaves non-numbers in a cell unchanged', () => {
    expect(formatCellNumber('n/a', { style: 'currency', currency: 'EUR' }, 'en-US')).toBe('n/a');
    expect(formatCellNumber('42', undefined, 'en-US')).toBe('42');
    expect(formatCellNumber('42', { style: 'currency', currency: 'USD' }, 'en-US')).toBe('$42.00');
  });
});

describe('effectiveDecimals', () => {
  it('uses the fixed decimals, the currency default, or the values', () => {
    expect(effectiveDecimals({ style: 'number', decimals: 3 }, [])).toBe(3);
    expect(effectiveDecimals({ style: 'currency', currency: 'EUR' }, [1])).toBe(2);
    expect(effectiveDecimals({ style: 'currency', currency: 'JPY' }, [1])).toBe(0);
    expect(effectiveDecimals(undefined, [1, 2.25, 3.5])).toBe(2);
    expect(effectiveDecimals({ style: 'percent' }, [0.125])).toBe(1);
  });
});
