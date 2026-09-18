/**
 * @file fullView.test.ts
 * @description Unit tests for full view helpers: cell references and range statistics
 */

import { describe, it, expect } from 'vitest';
import { columnLetter } from './TableToolbar';
import { getRangeStats } from './TableStatusBar';
import type { AdvancedTableElement } from '../types';

const table = (rows: string[][]) =>
  ({
    type: 'table',
    children: rows.map((row) => ({ type: 'table-row', children: row.map((text) => ({ type: 'table-data-cell', children: [{ text }] })) })),
  }) as unknown as AdvancedTableElement;

describe('columnLetter', () => {
  it.each([[0, 'A'], [2, 'C'], [25, 'Z'], [26, 'AA'], [27, 'AB'], [701, 'ZZ'], [702, 'AAA']])('%i → %s', (index, letter) => {
    expect(columnLetter(index)).toBe(letter);
  });
});

describe('getRangeStats', () => {
  it('counts non-empty cells and summarises the numbers among them', () => {
    const t = table([
      ['a', '10', ''],
      ['b', '-2.5', 'x'],
      ['c', '20', '4'],
    ]);
    expect(getRangeStats(t, { tablePath: [0], top: 0, bottom: 2, left: 1, right: 2 })).toEqual({
      count: 5,
      numbers: 4,
      sum: 31.5,
      average: 7.875,
      min: -2.5,
      max: 20,
    });
  });

  it('handles ranges without numbers', () => {
    const t = table([['a', 'b']]);
    expect(getRangeStats(t, { tablePath: [0], top: 0, bottom: 0, left: 0, right: 1 })).toMatchObject({ count: 2, numbers: 0, sum: 0 });
  });
});
