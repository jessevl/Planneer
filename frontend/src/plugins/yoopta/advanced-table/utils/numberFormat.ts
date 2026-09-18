/**
 * @file numberFormat.ts
 * @description Display formats for number columns.
 *
 * Number cells store plain numbers ("53166.5") so sorting, filtering and
 * totals work; a column's NumberFormat decides how they are shown
 * ("€53,166.50", "12.5%"), using the viewer's locale for separators.
 */
import type { NumberFormat } from '../types';
import { analyzeNumber } from './parseValues';

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'CAD', 'AUD', 'INR'];

const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(format: NumberFormat | undefined, locale?: string): Intl.NumberFormat {
  const key = JSON.stringify([format ?? null, locale ?? null]);
  let formatter = formatters.get(key);
  if (!formatter) {
    const style = format?.style ?? 'number';
    const options: Intl.NumberFormatOptions = {
      style: style === 'number' ? 'decimal' : style,
      useGrouping: format ? format.grouping !== false : false,
    };
    if (style === 'currency') options.currency = format?.currency || 'EUR';
    if (format?.decimals !== undefined) {
      options.minimumFractionDigits = format.decimals;
      options.maximumFractionDigits = format.decimals;
    } else if (style !== 'currency') {
      // Show the digits the value has rather than rounding to 3
      options.maximumFractionDigits = 10;
    }
    try {
      formatter = new Intl.NumberFormat(locale, options);
    } catch {
      formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 10 });
    }
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Format a number for display in a column with the given format */
export function formatNumber(value: number, format?: NumberFormat, locale?: string): string {
  return getFormatter(format, locale).format(value);
}

/**
 * Format a stored cell value. Text that isn't a plain number is returned
 * unchanged so invalid entries stay visible.
 */
export function formatCellNumber(text: string, format?: NumberFormat, locale?: string): string {
  const trimmed = text.trim();
  if (!format || !/^-?\d*\.?\d+(e[-+]?\d+)?$/i.test(trimmed)) return text;
  return formatNumber(Number(trimmed), format, locale);
}

/** Decimals currently shown for a format, for the "fewer/more decimals" buttons */
export function effectiveDecimals(format: NumberFormat | undefined, values: number[]): number {
  if (format?.decimals !== undefined) return format.decimals;
  if (format?.style === 'currency') return getFormatter(format).resolvedOptions().maximumFractionDigits ?? 2;
  const scale = format?.style === 'percent' ? 100 : 1;
  return Math.max(0, ...values.map((v) => {
    const text = String(Number((v * scale).toPrecision(15)));
    return text.includes('.') ? text.length - text.indexOf('.') - 1 : 0;
  }));
}

/**
 * Guess a display format from how a column's values were written, so that
 * converting "€53,166.00" to a number column keeps showing it as euros.
 * Returns undefined when the values look like plain numbers.
 */
export function detectNumberFormat(texts: string[]): NumberFormat | undefined {
  const parsed = texts.map((text) => analyzeNumber(text)).filter((n) => n !== null);
  if (parsed.length === 0) return undefined;

  const decimals = Math.max(...parsed.map((n) => n.fractionDigits));
  const sameDecimals = parsed.every((n) => n.fractionDigits === decimals);

  if (parsed.every((n) => n.percent)) {
    return { style: 'percent', decimals: sameDecimals ? decimals : undefined };
  }

  const currencies = new Set(parsed.map((n) => n.currency).filter(Boolean));
  if (currencies.size === 1 && parsed.filter((n) => n.currency).length >= parsed.length / 2) {
    return { style: 'currency', currency: [...currencies][0], decimals: sameDecimals ? decimals : undefined };
  }

  if (parsed.some((n) => n.grouped) || (sameDecimals && decimals > 0)) {
    return { style: 'number', decimals: sameDecimals && decimals > 0 ? decimals : undefined, grouping: true };
  }

  return undefined;
}
