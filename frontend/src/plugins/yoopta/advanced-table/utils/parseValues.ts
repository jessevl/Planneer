/**
 * @file parseValues.ts
 * @description Turn loosely formatted text into the values number and date
 * columns store: plain numbers ("53166.5") and ISO dates ("2025-01-31").
 */
import type { ColumnType } from '../types';

const CURRENCY_CODES = 'EUR|USD|GBP|JPY|CHF|CAD|AUD|NZD|SEK|NOK|DKK|PLN|CZK|HUF|CNY|HKD|SGD|INR|BRL|MXN|ZAR|TRY|KRW';
const CURRENCY_CODE_AT_START = new RegExp(`^(?:${CURRENCY_CODES})(?=[-+\\d.,])`, 'i');
const CURRENCY_CODE_AT_END = new RegExp(`(?<=[\\d.,])(?:${CURRENCY_CODES})$`, 'i');

/**
 * Parse a number the way people write it: with currency symbols or codes,
 * thousands separators in either English (53,166.00) or European
 * (53.166,00 / 53 166,00) style, a leading or trailing minus, or accounting
 * parentheses for negatives. Returns null when the text isn't a number.
 */
export function parseNumber(input: string): number | null {
  let text = input.trim();
  if (!text) return null;

  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1).trim();
  }

  // Drop currency symbols, ISO codes and spacing used as thousands separators
  text = text
    .replace(/[\s\u00a0\u202f']/g, '')
    .replace(CURRENCY_CODE_AT_START, '')
    .replace(CURRENCY_CODE_AT_END, '')
    .replace(/[€$£¥₹₽₩₺₪¢]/g, '');

  if (/^[-−]/.test(text) || /[-−]$/.test(text)) {
    negative = !negative;
    text = text.replace(/^[-−]|[-−]$/g, '');
  }
  if (text.startsWith('+')) text = text.slice(1);

  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  let decimalSeparator: ',' | '.' | null = null;

  if (lastComma !== -1 && lastDot !== -1) {
    // Both present: whichever comes last is the decimal separator
    decimalSeparator = lastComma > lastDot ? ',' : '.';
  } else if (lastComma !== -1 || lastDot !== -1) {
    const separator = lastComma !== -1 ? ',' : '.';
    const count = text.split(separator).length - 1;
    const [integerPart, fraction] = [text.slice(0, text.lastIndexOf(separator)), text.slice(text.lastIndexOf(separator) + 1)];
    // "1,234" and "1.234.567" are grouped thousands; "0.125" and "12,5" are decimals
    const looksGrouped = count > 1 || (fraction.length === 3 && /^[1-9]\d{0,2}$/.test(integerPart));
    decimalSeparator = looksGrouped ? null : separator;
  }

  const thousandsSeparator = decimalSeparator === ',' ? '.' : decimalSeparator === '.' ? ',' : null;
  let normalized = text;
  if (thousandsSeparator) normalized = normalized.split(thousandsSeparator).join('');
  if (!decimalSeparator) normalized = normalized.replace(/[.,]/g, '');
  else if (decimalSeparator === ',') normalized = normalized.replace(',', '.');

  if (!/^\d*\.?\d+$|^\d+\.$/.test(normalized)) return null;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  // Dutch/German/French spellings that differ in their first three letters
  mrt: 3, mei: 5, okt: 10, dez: 12, mär: 3, mai: 5, fév: 2, fev: 2, avr: 4, aoû: 8, aou: 8, déc: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

const toISODate = (year: number, month: number, day: number): string | null => {
  if (year < 100) year += year < 70 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null; // e.g. 31 February
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** Whether ambiguous dates like 03/04/2025 are read month-first (US style) */
const prefersMonthFirst = () => {
  try {
    const parts = new Intl.DateTimeFormat(undefined).formatToParts(new Date(2025, 11, 31));
    return parts.findIndex((p) => p.type === 'month') < parts.findIndex((p) => p.type === 'day');
  } catch {
    return false;
  }
};

/**
 * Parse a date written as ISO (2025-01-31, optionally with a time),
 * numerically (31-01-2025, 1/31/2025, 31.1.25) or with a month name
 * (31 Jan 2025, January 31, 2025, 31 mei 2025). Numeric dates where day and
 * month could be swapped follow the browser's locale. Returns YYYY-MM-DD or null.
 */
export function parseDate(input: string, monthFirst = prefersMonthFirst()): string | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!text) return null;

  let match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[t ].*)?$/);
  if (match) return toISODate(+match[1], +match[2], +match[3]);

  match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (match) {
    const [a, b, year] = [+match[1], +match[2], +match[3]];
    if (a > 12) return toISODate(year, b, a);
    if (b > 12) return toISODate(year, a, b);
    return monthFirst ? toISODate(year, a, b) : toISODate(year, b, a);
  }

  const monthOf = (word: string) => MONTHS[word.replace(/\.$/, '').slice(0, 3)];

  // 31 January 2025, 31 jan. 2025
  match = text.match(/^(?:[a-zà-ü]+,? )?(\d{1,2})\.? ([a-zà-ü]+\.?),? (\d{2}|\d{4})$/);
  if (match && monthOf(match[2])) return toISODate(+match[3], monthOf(match[2]), +match[1]);

  // January 31, 2025
  match = text.match(/^(?:[a-zà-ü]+,? )?([a-zà-ü]+\.?) (\d{1,2})(?:st|nd|rd|th)?,? (\d{2}|\d{4})$/);
  if (match && monthOf(match[1])) return toISODate(+match[3], monthOf(match[1]), +match[2]);

  return null;
}

/** Plain decimal string for a number, without float noise like 0.1 + 0.2 */
const formatNumber = (value: number) => String(Number(value.toPrecision(15)));

/**
 * The value a cell of the given column type should store for some text.
 * Text that can't be read as that type is returned unchanged, so nothing is lost.
 */
export function normalizeCellValue(text: string, type: ColumnType | undefined): string {
  if (type === 'number') {
    const value = parseNumber(text);
    return value === null ? text : formatNumber(value);
  }
  if (type === 'date') {
    return parseDate(text) ?? text;
  }
  return text;
}
