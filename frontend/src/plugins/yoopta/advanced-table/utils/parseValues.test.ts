/**
 * @file parseValues.test.ts
 * @description Unit tests for number and date parsing in table columns
 */

import { describe, it, expect } from 'vitest';
import { normalizeCellValue, parseDate, parseNumber } from './parseValues';

describe('parseNumber', () => {
  it.each([
    ['53166', 53166],
    ['€53,166.00', 53166],
    ['€ 53.166,00', 53166],
    ['53 166,50 €', 53166.5],
    ['$1,234,567.89', 1234567.89],
    ['1.234.567', 1234567],
    ['EUR 12,50', 12.5],
    ['12.50 USD', 12.5],
    ['-€5.00', -5],
    ['€-5.00', -5],
    ['(1,200.00)', -1200],
    ['5-', -5],
    ['+3', 3],
    ['0.125', 0.125],
    ['12,5', 12.5],
    ['1,234', 1234],
    ['1234,567', 1234.567],
    ['.5', 0.5],
    ["1'000.5", 1000.5],
  ])('reads %s as %s', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each(['', 'abc', '12abc', '1.2.3,4,5', '€', '--5', '1-2'])('rejects %s', (input) => {
    expect(parseNumber(input)).toBeNull();
  });
});

describe('parseDate', () => {
  it.each([
    ['2025-01-31', '2025-01-31'],
    ['2025-1-5', '2025-01-05'],
    ['2025-01-31T10:00:00Z', '2025-01-31'],
    ['31-01-2025', '2025-01-31'],
    ['31/1/25', '2025-01-31'],
    ['31.01.2025', '2025-01-31'],
    ['1/31/2025', '2025-01-31'],
    ['31 Jan 2025', '2025-01-31'],
    ['31 januari 2025', '2025-01-31'],
    ['5 mei 2025', '2025-05-05'],
    ['3 okt. 2025', '2025-10-03'],
    ['January 31, 2025', '2025-01-31'],
    ['Fri, Jan 31st 2025', '2025-01-31'],
  ])('reads %s as %s', (input, expected) => {
    expect(parseDate(input, false)).toBe(expected);
  });

  it('follows the locale for dates that could be either way round', () => {
    expect(parseDate('03/04/2025', false)).toBe('2025-04-03');
    expect(parseDate('03/04/2025', true)).toBe('2025-03-04');
  });

  it.each(['', 'soon', '31/02/2025', '2025-13-01', '12345', 'Jan 2025'])('rejects %s', (input) => {
    expect(parseDate(input, false)).toBeNull();
  });
});

describe('normalizeCellValue', () => {
  it('stores plain numbers for number columns', () => {
    expect(normalizeCellValue('€53,166.00', 'number')).toBe('53166');
    expect(normalizeCellValue('0.1', 'number')).toBe('0.1');
  });

  it('keeps text that cannot be converted', () => {
    expect(normalizeCellValue('n/a', 'number')).toBe('n/a');
    expect(normalizeCellValue('someday', 'date')).toBe('someday');
  });

  it('leaves other column types alone', () => {
    expect(normalizeCellValue('€53,166.00', 'text')).toBe('€53,166.00');
    expect(normalizeCellValue('31-01-2025', 'select')).toBe('31-01-2025');
  });
});
