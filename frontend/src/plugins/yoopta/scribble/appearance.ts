import type { ScribblePoint, ScribbleStroke } from './types';

export type PerfectFreehandPreset = {
  size: number;
  thinning: number;
  smoothing: number;
  streamline: number;
  simulatePressure?: boolean;
  easing?: (value: number) => number;
  start?: {
    taper: number;
    cap: boolean;
  };
  end?: {
    taper: number;
    cap: boolean;
  };
};

export type PencilTextureSpec = {
  tileSize: number;
  streakCount: number;
  dotCount: number;
  smudgeCount: number;
  streakAlpha: number;
  dotAlpha: number;
  smudgeAlpha: number;
  angleJitter: number;
};

export type PencilTexturePattern = {
  tileSize: number;
  streaks: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    width: number;
    color: string;
  }>;
  dots: Array<{
    x: number;
    y: number;
    size: number;
    color: string;
  }>;
  smudges: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    color: string;
  }>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeRawPressure(rawPressure: number | undefined): number {
  const clamped = clamp(rawPressure ?? 0.5, 0.04, 1);
  return (clamped - 0.04) / 0.96;
}

function shapePressure(normalized: number, exponent: number, floor: number): number {
  return clamp(floor + Math.pow(normalized, exponent) * (1 - floor), 0.02, 1);
}

export function resolveStrokePressure(point: ScribblePoint, stroke?: ScribbleStroke): number {
  const normalized = normalizeRawPressure(point.pressure);

  if (stroke?.tool === 'marker') {
    return 0.82 + normalized * 0.16;
  }

  if (stroke?.tool === 'pencil') {
    if (stroke.variant === 'hb') return shapePressure(normalized, 1.95, 0.1);
    if (stroke.variant === '4b') return shapePressure(normalized, 1.45, 0.08);
    return shapePressure(normalized, 1.7, 0.09);
  }

  if (stroke?.tool === 'gel') {
    return shapePressure(normalized, 1.55, 0.22);
  }

  if (stroke?.variant === 'ballpoint') {
    return shapePressure(normalized, 1.3, 0.28);
  }

  if (stroke?.variant === 'ink') {
    return shapePressure(normalized, 2.3, 0.05);
  }

  if (stroke?.variant === 'fountain') {
    return shapePressure(normalized, 1.85, 0.07);
  }

  return shapePressure(normalized, 1.6, 0.18);
}

export function resolveScribbleStrokeOpacity(stroke: ScribbleStroke): number {
  if (typeof stroke.opacity === 'number') {
    return stroke.opacity;
  }

  if (stroke.tool === 'marker') {
    return 0.3;
  }

  if (stroke.tool === 'pencil') {
    if (stroke.variant === '4b') return 0.46;
    if (stroke.variant === 'hb') return 0.16;
    return 0.28;
  }

  if (stroke.variant === 'ballpoint') {
    return 0.94;
  }

  if (stroke.variant === 'ink') {
    return 0.98;
  }

  if (stroke.variant === 'fountain') {
    return 1;
  }

  return 1;
}

export function resolveSegmentWidth(stroke: ScribbleStroke, start: ScribblePoint, end: ScribblePoint): number {
  if (stroke.tool === 'marker' || stroke.tool === 'eraser') return stroke.width;

  const avgPressure = (resolveStrokePressure(start, stroke) + resolveStrokePressure(end, stroke)) / 2;

  if (stroke.tool === 'pencil') {
    if (stroke.variant === 'hb') return stroke.width * (0.48 + avgPressure * 0.3);
    if (stroke.variant === '4b') return stroke.width * (0.78 + avgPressure * 0.7);
    return stroke.width * (0.62 + avgPressure * 0.48);
  }

  if (stroke.tool === 'gel') {
    return stroke.width * (0.78 + avgPressure * 0.2);
  }

  if (stroke.variant === 'ballpoint') {
    return stroke.width * (0.84 + avgPressure * 0.16);
  }

  if (stroke.variant === 'ink') {
    return stroke.width * (0.42 + avgPressure * 1.4);
  }

  if (stroke.variant === 'fountain') {
    return stroke.width * (0.5 + avgPressure * 1.16);
  }

  return stroke.width * (0.58 + avgPressure * 0.88);
}

export function resolveStrokeWidth(stroke: ScribbleStroke): number {
  if (stroke.points.length === 0) return stroke.width;
  if (stroke.tool === 'marker' || stroke.tool === 'eraser') return stroke.width;

  const totalPressure = stroke.points.reduce((sum, point) => sum + resolveStrokePressure(point, stroke), 0);
  const avgPressure = totalPressure / stroke.points.length;

  if (stroke.tool === 'pencil') {
    if (stroke.variant === 'hb') return stroke.width * (0.48 + avgPressure * 0.28);
    if (stroke.variant === '4b') return stroke.width * (0.8 + avgPressure * 0.68);
    return stroke.width * (0.64 + avgPressure * 0.44);
  }

  if (stroke.tool === 'gel') {
    return stroke.width * (0.8 + avgPressure * 0.18);
  }

  if (stroke.variant === 'ballpoint') {
    return stroke.width * (0.84 + avgPressure * 0.15);
  }

  if (stroke.variant === 'ink') {
    return stroke.width * (0.46 + avgPressure * 1.32);
  }

  if (stroke.variant === 'fountain') {
    return stroke.width * (0.54 + avgPressure * 1.06);
  }

  return stroke.width * (0.58 + avgPressure * 0.88);
}

export function getSmoothingParams(stroke: ScribbleStroke): { passes: number; strength: number } {
  if (stroke.tool === 'marker') return { passes: 1, strength: 0.12 };
  if (stroke.tool === 'pencil') return { passes: 1, strength: 0.14 };
  if (stroke.tool === 'gel') return { passes: 1, strength: 0.18 };
  if (stroke.variant === 'ballpoint') return { passes: 1, strength: 0.16 };
  if (stroke.variant === 'ink') return { passes: 1, strength: 0.18 };
  if (stroke.variant === 'fountain') return { passes: 1, strength: 0.16 };
  return { passes: 1, strength: 0.16 };
}

export function getSimplificationEpsilon(stroke: ScribbleStroke): number {
  if (stroke.tool === 'marker') return 0.00035;
  if (stroke.tool === 'pencil') return stroke.variant === '4b' ? 0.0001 : 0.00012;
  if (stroke.tool === 'gel') return 0.00016;
  if (stroke.variant === 'ballpoint') return 0.00018;
  if (stroke.variant === 'ink') return 0.00014;
  if (stroke.variant === 'fountain') return 0.00012;
  return 0.00016;
}

function pointDistance(a: ScribblePoint, b: ScribblePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getStrokeTravel(points: ScribblePoint[]): number {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += pointDistance(points[index - 1], points[index]);
  }

  return total;
}

function tunePresetForStrokeLength(stroke: ScribbleStroke, preset: PerfectFreehandPreset): PerfectFreehandPreset {
  const strokeTravel = getStrokeTravel(stroke.points);
  const shortStrokeRatio = Math.max(0, 1 - Math.min(1, strokeTravel / 0.06));

  if (shortStrokeRatio <= 0) {
    return preset;
  }

  return {
    ...preset,
    size: preset.size * (1 - shortStrokeRatio * 0.03),
    smoothing: preset.smoothing * (1 - shortStrokeRatio * 0.12),
    streamline: preset.streamline * (1 - shortStrokeRatio * 0.18),
  };
}

export function getPerfectFreehandOptions(stroke: ScribbleStroke): PerfectFreehandPreset {
  if (stroke.tool === 'marker') {
    return tunePresetForStrokeLength(stroke, {
      size: stroke.width * 1.16,
      thinning: 0.02,
      smoothing: 0.9,
      streamline: 0.72,
      simulatePressure: false,
      easing: (value) => value,
    });
  }

  if (stroke.tool === 'pencil') {
    if (stroke.variant === 'hb') {
      return tunePresetForStrokeLength(stroke, {
        size: stroke.width * 0.7,
        thinning: 0.04,
        smoothing: 0.18,
        streamline: 0.04,
        easing: (value) => value * value,
      });
    }

    if (stroke.variant === '4b') {
      return tunePresetForStrokeLength(stroke, {
        size: stroke.width * 1.22,
        thinning: 0.24,
        smoothing: 0.24,
        streamline: 0.06,
        easing: (value) => Math.pow(value, 0.78),
      });
    }

    return tunePresetForStrokeLength(stroke, {
      size: stroke.width * 0.94,
      thinning: 0.14,
      smoothing: 0.2,
      streamline: 0.05,
      easing: (value) => Math.pow(value, 0.88),
    });
  }

  if (stroke.tool === 'gel') {
    return tunePresetForStrokeLength(stroke, {
      size: stroke.width * 0.92,
      thinning: 0.06,
      smoothing: 0.68,
      streamline: 0.5,
      easing: (value) => value,
    });
  }

  if (stroke.variant === 'ballpoint') {
    return tunePresetForStrokeLength(stroke, {
      size: stroke.width * 0.8,
      thinning: 0.04,
      smoothing: 0.4,
      streamline: 0.24,
      easing: (value) => value,
    });
  }

  if (stroke.variant === 'ink') {
    return tunePresetForStrokeLength(stroke, {
      size: stroke.width * 0.92,
      thinning: 0.82,
      smoothing: 0.46,
      streamline: 0.14,
      easing: (value) => Math.pow(value, 0.72),
      start: { taper: stroke.width * 0.28, cap: true },
      end: { taper: stroke.width * 0.96, cap: true },
    });
  }

  return tunePresetForStrokeLength(stroke, {
    size: stroke.width * 0.98,
    thinning: 0.64,
    smoothing: 0.62,
    streamline: 0.18,
    easing: (value) => Math.pow(value, 0.8),
    start: { taper: stroke.width * 0.16, cap: true },
    end: { taper: stroke.width * 0.66, cap: true },
  });
}

export function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let state = seed || 1;

  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let output = Math.imul(state ^ (state >>> 15), 1 | state);
    output ^= output + Math.imul(output ^ (output >>> 7), 61 | output);
    return ((output ^ (output >>> 14)) >>> 0) / 4294967296;
  };
}

function parseHexColor(color: string): { r: number; g: number; b: number } {
  const normalized = color.trim();
  const hex = normalized.startsWith('#') ? normalized.slice(1) : normalized;

  if (hex.length === 3) {
    return {
      r: Number.parseInt(`${hex[0]}${hex[0]}`, 16),
      g: Number.parseInt(`${hex[1]}${hex[1]}`, 16),
      b: Number.parseInt(`${hex[2]}${hex[2]}`, 16),
    };
  }

  if (hex.length === 6) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  return { r: 82, g: 82, b: 91 };
}

function mixChannel(channel: number, target: number, amount: number): number {
  return Math.round(channel + (target - channel) * amount);
}

export function rgbaFromRgb(rgb: { r: number; g: number; b: number }, alpha: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function getPencilTextureSpec(texture: ScribbleStroke['variant']): PencilTextureSpec {
  if (texture === 'hb') {
    return {
      tileSize: 18,
      streakCount: 12,
      dotCount: 10,
      smudgeCount: 2,
      streakAlpha: 0.055,
      dotAlpha: 0.025,
      smudgeAlpha: 0.018,
      angleJitter: 0.26,
    };
  }

  if (texture === '4b') {
    return {
      tileSize: 30,
      streakCount: 54,
      dotCount: 40,
      smudgeCount: 9,
      streakAlpha: 0.16,
      dotAlpha: 0.11,
      smudgeAlpha: 0.08,
      angleJitter: 0.88,
    };
  }

  return {
    tileSize: 24,
    streakCount: 28,
    dotCount: 22,
    smudgeCount: 5,
    streakAlpha: 0.1,
    dotAlpha: 0.06,
    smudgeAlpha: 0.04,
    angleJitter: 0.58,
  };
}

export function buildPencilTexturePattern(texture: ScribbleStroke['variant'], color: string): PencilTexturePattern {
  const spec = getPencilTextureSpec(texture);
  const random = createSeededRandom(hashString(`${texture ?? '2b'}:${color}`));
  const base = parseHexColor(color);
  const lighter = {
    r: mixChannel(base.r, 255, 0.2),
    g: mixChannel(base.g, 255, 0.2),
    b: mixChannel(base.b, 255, 0.2),
  };
  const darker = {
    r: mixChannel(base.r, 0, 0.14),
    g: mixChannel(base.g, 0, 0.14),
    b: mixChannel(base.b, 0, 0.14),
  };

  const streaks: PencilTexturePattern['streaks'] = [];
  const dots: PencilTexturePattern['dots'] = [];
  const smudges: PencilTexturePattern['smudges'] = [];

  for (let index = 0; index < spec.streakCount; index += 1) {
    const x = random() * spec.tileSize;
    const y = random() * spec.tileSize;
    const angleBase = random() > 0.4 ? Math.PI / 6 : -Math.PI / 7;
    const angle = angleBase + (random() - 0.5) * spec.angleJitter;
    const length = spec.tileSize * (0.1 + random() * 0.42);
    const width = 0.28 + random() * (texture === '4b' ? 1.1 : texture === 'hb' ? 0.42 : 0.72);
    const colorChoice = random() > 0.72 ? lighter : darker;

    streaks.push({
      x1: x,
      y1: y,
      x2: x + Math.cos(angle) * length,
      y2: y + Math.sin(angle) * length,
      width,
      color: rgbaFromRgb(colorChoice, spec.streakAlpha * (0.6 + random() * 0.7)),
    });
  }

  for (let index = 0; index < spec.dotCount; index += 1) {
    const colorChoice = random() > 0.58 ? lighter : darker;
    dots.push({
      x: random() * spec.tileSize,
      y: random() * spec.tileSize,
      size: 0.35 + random() * (texture === '4b' ? 1.8 : texture === 'hb' ? 0.6 : 1.1),
      color: rgbaFromRgb(colorChoice, spec.dotAlpha * (0.55 + random() * 0.8)),
    });
  }

  for (let index = 0; index < spec.smudgeCount; index += 1) {
    const colorChoice = random() > 0.5 ? lighter : darker;
    smudges.push({
      x: random() * spec.tileSize,
      y: random() * spec.tileSize,
      width: spec.tileSize * (0.14 + random() * 0.28),
      height: spec.tileSize * (0.08 + random() * 0.14),
      rotation: (random() - 0.5) * 56,
      color: rgbaFromRgb(colorChoice, spec.smudgeAlpha * (0.6 + random() * 0.8)),
    });
  }

  return {
    tileSize: spec.tileSize,
    streaks,
    dots,
    smudges,
  };
}

export function getPencilPatternId(stroke: ScribbleStroke): string {
  return `scribble-pencil-${hashString(`${stroke.variant ?? '2b'}-${stroke.color}`)}`;
}