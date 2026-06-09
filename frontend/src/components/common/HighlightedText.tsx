/**
 * @file HighlightedText.tsx
 * @description Renders FTS snippet text with <MARK>...</MARK> sentinels as
 * styled spans. Safe — never uses innerHTML.
 */
import React, { useMemo } from 'react';

const MARK_OPEN = '<MARK>';
const MARK_CLOSE = '</MARK>';

interface HighlightedTextProps {
  /** Snippet string. May contain <MARK>...</MARK> markers from the FTS backend. */
  text: string | null | undefined;
  /** Fallback rendered when text is empty/null. */
  fallback?: React.ReactNode;
  className?: string;
}

interface TokenizeResult {
  tokens: { value: string; mark: boolean }[];
  hasMarks: boolean;
}

/**
 * Single-pass parse. Returns tokens and a hasMarks flag together so callers
 * don't need a second `.some()` scan. Tolerant of malformed input (unmatched
 * opens render literally as plain text).
 */
function tokenize(text: string): TokenizeResult {
  const tokens: { value: string; mark: boolean }[] = [];
  let hasMarks = false;
  let i = 0;
  while (i < text.length) {
    const openAt = text.indexOf(MARK_OPEN, i);
    if (openAt === -1) {
      tokens.push({ value: text.slice(i), mark: false });
      break;
    }
    if (openAt > i) {
      tokens.push({ value: text.slice(i, openAt), mark: false });
    }
    const closeAt = text.indexOf(MARK_CLOSE, openAt + MARK_OPEN.length);
    if (closeAt === -1) {
      tokens.push({ value: text.slice(openAt), mark: false });
      break;
    }
    tokens.push({ value: text.slice(openAt + MARK_OPEN.length, closeAt), mark: true });
    hasMarks = true;
    i = closeAt + MARK_CLOSE.length;
  }
  return { tokens, hasMarks };
}

const HighlightedText: React.FC<HighlightedTextProps> = ({ text, fallback, className }) => {
  const { tokens, hasMarks } = useMemo(() => (text ? tokenize(text) : { tokens: [], hasMarks: false }), [text]);

  if (!text || tokens.length === 0) {
    return <>{fallback ?? null}</>;
  }

  if (!hasMarks) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {tokens.map((t, i) =>
        t.mark ? (
          <mark
            key={i}
            className="bg-yellow-200/70 dark:bg-yellow-500/30 text-inherit rounded px-0.5"
          >
            {t.value}
          </mark>
        ) : (
          <React.Fragment key={i}>{t.value}</React.Fragment>
        )
      )}
    </span>
  );
};

export default HighlightedText;
