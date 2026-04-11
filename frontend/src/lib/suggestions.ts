/**
 * @file suggestions.ts
 * @description Autocomplete suggestions and natural language parsing for task input
 * @app TASKS APP ONLY - Used by AddTaskForm for smart input
 * 
 * Provides utilities for the task title autocomplete feature:
 * - FRIENDLY_DATES: Natural language date strings ("today", "tomorrow", etc.)
 * - friendlyToISO: Convert friendly dates to ISO format
 * - getTokenAt: Find the token being typed at cursor position
 * - dateSuggestionFor: Get date suggestions matching user input
 * - mapPriorityToken: Map "p1", "p2", etc. to priority values
 * 
 * Used by AddTaskForm to parse dates and priorities from the task title
 * as the user types, providing inline suggestions.
 */
import dayjs from 'dayjs';

export const FRIENDLY_DATES = ['today','tomorrow','next week','next weekend','next month','sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
export const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

export const friendlyToISO = (l: string): string => {
  l = l.toLowerCase();
  if (l === 'today') return dayjs().format('YYYY-MM-DD');
  if (l === 'tomorrow') return dayjs().add(1, 'day').format('YYYY-MM-DD');
  if (l.replace(' ', '') === 'nextweek') {
    const today = dayjs();
    let delta = (1 - today.day() + 7) % 7;
    if (delta === 0) delta = 7;
    return today.add(delta, 'day').format('YYYY-MM-DD');
  }
  if (l.replace(' ', '') === 'nextweekend') {
    const today = dayjs();
    let delta = (6 - today.day() + 7) % 7;
    if (delta === 0) delta = 7;
    return today.add(delta, 'day').format('YYYY-MM-DD');
  }
  if (l.replace(' ', '') === 'nextmonth') return dayjs().add(1, 'month').format('YYYY-MM-DD');
  const wd = WEEKDAYS.indexOf(l);
  if (wd > -1) {
    const todayIdx = dayjs().day();
    const delta = (wd - todayIdx + 7) % 7 || 7;
    return dayjs().add(delta, 'day').format('YYYY-MM-DD');
  }
  const parsed = dayjs(l);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
};

export const getTokenAt = (val: string, pos: number, projects: { title: string }[]): { type: 'taskPage'|'date'|'prio', start: number, end: number, token: string } | null => {
  const n = val.length, clamped = Math.max(0, Math.min(pos, n));
  // first look for # or @ tokens in the current word
  let segStart = clamped - 1;
  while (segStart >= 0 && val[segStart] !== ' ') segStart--;
  const segmentStart = segStart + 1;
  let start = -1;
  for (let i = Math.min(clamped - 1, n - 1); i >= segmentStart; i--) {
    if (val[i] === '#' || val[i] === '@') { start = i; break; }
  }
  if (start !== -1) {
    const kind = val[start] === '#' ? 'taskPage' : 'date';
    let end = start + 1;
    while (end < n) {
      const c = val[end];
      if (c === '#' || c === '@') break;
      if (c === ' ') {
        const raw = val.slice(start + 1, end).toLowerCase();
        if (kind === 'date' && FRIENDLY_DATES.some(f => f.startsWith(raw))) { end++; continue; }
        if (kind === 'taskPage' && projects.some(p => p.title.toLowerCase().startsWith(raw))) { end++; continue; }
        break;
      }
      end++;
    }
    const token = val.slice(start, end);
    return token.startsWith('#') ? { type: 'taskPage', start, end, token: token.slice(1) }
      : token.startsWith('@') ? { type: 'date', start, end, token: token.slice(1) } : null;
  }

  // fallback: detect priority tokens starting with '!' or 'p'
  let wstart = clamped - 1;
  while (wstart >= 0 && val[wstart] !== ' ') wstart--;
  const wordStart = wstart + 1;
  let wend = wordStart;
  while (wend < n && val[wend] !== ' ') wend++;
  const word = val.slice(wordStart, wend);
  
  // Match !1, !2, !3 OR p1, p2, p3 OR !p1, !p2, !p3 OR just !, p, !p (for suggestions)
  const m = /^(!)([1-3])?$/i.exec(word);
  if (m) {
    return { type: 'prio', start: wordStart, end: wend, token: m[2] || '' };
  }
  return null;
};

export const mapPriorityToken = (token: string): 'Low' | 'Medium' | 'High' | null => {
  // accept '1'/'2'/'3', '!1'/'!2'/'!3' and legacy 'p1' tokens
  const normalized = token.toLowerCase().replace(/^(!|p)/, '');
  const map: Record<string, 'Low' | 'Medium' | 'High'> = { '1': 'High', '2': 'Medium', '3': 'Low' };
  return map[normalized] || null;
};

export const dateSuggestionFor = (q: string): string => {
  if (!q) return '';
  const s = q.toLowerCase();
  if ('today'.startsWith(s) && s.length < 'today'.length) return 'today';
  if ('tomorrow'.startsWith(s) && s.length < 'tomorrow'.length) return 'tomorrow';
  if ('next week'.replace(' ','').startsWith(s.replace(' ','')) && s.length < 'next week'.length) return 'next week';
  if ('next weekend'.replace(' ','').startsWith(s.replace(' ','')) && s.length < 'next weekend'.length) return 'next weekend';
  if ('next month'.replace(' ','').startsWith(s.replace(' ','')) && s.length < 'next month'.length) return 'next month';
  const wd = WEEKDAYS.find(d => d.startsWith(s));
  if (wd && s.length < wd.length) return wd;
  if (s.length >= 3) {
    const parsed = dayjs(q);
    if (parsed.isValid()) {
      return parsed.format('MMM D YYYY');
    }
  }
  return FRIENDLY_DATES.slice(4).find(d => d.startsWith(s) && s.length < d.length) || '';
};
