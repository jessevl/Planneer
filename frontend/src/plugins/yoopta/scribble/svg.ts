import { getStroke } from 'perfect-freehand';

import {
  buildPencilTexturePattern,
  getPencilPatternId,
  getPerfectFreehandOptions,
  getSimplificationEpsilon,
  getSmoothingParams,
  resolveScribbleStrokeOpacity,
  resolveStrokePressure,
  resolveStrokeWidth,
} from './appearance';
import type { ScribblePoint, ScribbleSnapshot, ScribbleStroke } from './types';

const NORMALIZED_POINT_DECIMALS = 3;
const ABSOLUTE_PATH_DECIMALS = 2;

function formatNumber(value: number, digits: number = 4): string {
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function roundNumber(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function midpoint(a: ScribblePoint, b: ScribblePoint): ScribblePoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    pressure: ((a.pressure ?? 0.5) + (b.pressure ?? 0.5)) / 2,
  };
}

type AbsolutePoint = {
  x: number;
  y: number;
};

function pointDistance(a: ScribblePoint, b: ScribblePoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isPointInPolygon(point: ScribblePoint, polygon: ScribblePoint[]): boolean {
  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];

    const intersects =
      (current.y > point.y) !== (previous.y > point.y) &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || Number.EPSILON) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

export function isFilledScribbleStroke(stroke: ScribbleStroke): boolean {
  return stroke.tool === 'pen' && stroke.variant === 'fountain';
}

function parseScribbleStrokeVariant(value: string | undefined): ScribbleStroke['variant'] {
  if (
    value === 'ballpoint' ||
    value === 'ink' ||
    value === 'fountain' ||
    value === 'hb' ||
    value === '2b' ||
    value === '4b'
  ) {
    return value;
  }

  return undefined;
}


// Curvature at point b in the path a→b→c. Returns 0 (straight) to 1 (hairpin).
function computeCurvature(a: ScribblePoint, b: ScribblePoint, c: ScribblePoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const abLen = Math.sqrt(abx * abx + aby * aby);
  const bcLen = Math.sqrt(bcx * bcx + bcy * bcy);
  if (abLen < 1e-10 || bcLen < 1e-10) return 0;
  const dot = (abx * bcx + aby * bcy) / (abLen * bcLen);
  return Math.max(0, (1 - dot) / 2);
}


// Gaussian-weighted [0.25, 0.5, 0.25] smoothing with curvature-adaptive strength.
// Corners are preserved by reducing the smoothing factor at high-curvature points.
// Pressure is smoothed more gently to preserve the writer's pressure intent.
function smoothStrokePoints(
  points: ScribblePoint[],
  passes: number,
  strength: number,
): ScribblePoint[] {
  if (points.length <= 3) {
    return points.map((point) => ({ ...point }));
  }

  let current = points.map((point) => ({ ...point }));

  for (let pass = 0; pass < passes; pass += 1) {
    const next: ScribblePoint[] = [{ ...current[0] }];

    for (let i = 1; i < current.length - 1; i += 1) {
      const prev = current[i - 1];
      const curr = current[i];
      const nxt = current[i + 1];

      // Gaussian-weighted target position
      const targetX = prev.x * 0.25 + curr.x * 0.5 + nxt.x * 0.25;
      const targetY = prev.y * 0.25 + curr.y * 0.5 + nxt.y * 0.25;

      // At corners, reduce smoothing to preserve intentional shape changes
      const curvature = computeCurvature(prev, curr, nxt);
      const factor = curvature > 0.3
        ? strength * Math.max(0.1, 1 - curvature * 1.8)
        : strength;

      // Smooth pressure with reduced strength so pressure dynamics are faithful
      const targetPressure =
        (prev.pressure ?? 0.5) * 0.25 +
        (curr.pressure ?? 0.5) * 0.5 +
        (nxt.pressure ?? 0.5) * 0.25;
      const pressureFactor = factor * 0.5;

      next.push({
        x: curr.x + (targetX - curr.x) * factor,
        y: curr.y + (targetY - curr.y) * factor,
        pressure: curr.pressure !== undefined
          ? (curr.pressure ?? 0.5) + (targetPressure - (curr.pressure ?? 0.5)) * pressureFactor
          : undefined,
      });
    }

    next.push({ ...current[current.length - 1] });
    current = next;
  }

  return current;
}

// Perpendicular distance from a point to a line segment (used by RDP).
function perpDistToLine(point: ScribblePoint, start: ScribblePoint, end: ScribblePoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.sqrt((point.x - start.x) ** 2 + (point.y - start.y) ** 2);
  }
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq));
  const projX = start.x + t * dx;
  const projY = start.y + t * dy;
  return Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
}

// Ramer-Douglas-Peucker path simplification. Keeps points that are important for
// path shape (high perpendicular deviation) and discards those near the simplified
// line. Iterative stack-based to avoid recursion depth issues on long strokes.
function rdpSimplify(points: ScribblePoint[], epsilon: number): ScribblePoint[] {
  if (points.length <= 2) {
    return points.map((point) => ({
      x: roundNumber(point.x, NORMALIZED_POINT_DECIMALS),
      y: roundNumber(point.y, NORMALIZED_POINT_DECIMALS),
      pressure: point.pressure !== undefined
        ? roundNumber(resolveStrokePressure(point), 3)
        : undefined,
    }));
  }

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let maxIndex = start;

    for (let i = start + 1; i < end; i += 1) {
      const dist = perpDistToLine(points[i], points[start], points[end]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > epsilon) {
      keep[maxIndex] = 1;
      if (maxIndex - start > 1) stack.push([start, maxIndex]);
      if (end - maxIndex > 1) stack.push([maxIndex, end]);
    }
  }

  const result = points
    .filter((_, i) => keep[i])
    .map((point) => ({
      x: roundNumber(point.x, NORMALIZED_POINT_DECIMALS),
      y: roundNumber(point.y, NORMALIZED_POINT_DECIMALS),
      pressure: point.pressure !== undefined
        ? roundNumber(resolveStrokePressure(point), 3)
        : undefined,
    }));

  if (result.length === 1 && points.length > 1) {
    result.push({ ...result[0] });
  }

  return result;
}

export function normalizeScribbleStroke(stroke: ScribbleStroke): ScribbleStroke {
  const { passes, strength } = getSmoothingParams(stroke);
  const smoothedPoints = smoothStrokePoints(stroke.points, passes, strength);
  const epsilon = getSimplificationEpsilon(stroke);
  const simplifiedPoints = rdpSimplify(smoothedPoints, epsilon);
  const width = roundNumber(resolveStrokeWidth({
    ...stroke,
    points: simplifiedPoints,
  }), 2);

  return {
    id: stroke.id,
    tool: stroke.tool,
    color: stroke.color,
    width,
    points: simplifiedPoints,
    variant: stroke.variant,
    opacity: stroke.opacity,
    svgPath: stroke.svgPath,
  };
}

type FreehandPoint = [number, number] | [number, number, number];

function serializePointData(points: ScribblePoint[]): string {
  return points
    .map((point) => [
      formatNumber(point.x, NORMALIZED_POINT_DECIMALS),
      formatNumber(point.y, NORMALIZED_POINT_DECIMALS),
      formatNumber(resolveStrokePressure(point), 3),
    ].join(','))
    .join(';');
}

function parsePointData(value: string | null): ScribblePoint[] {
  if (!value) {
    return [];
  }

  return value
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map<ScribblePoint | null>((segment) => {
      const [xRaw, yRaw, pressureRaw] = segment.split(',');
      const x = Number.parseFloat(xRaw || '');
      const y = Number.parseFloat(yRaw || '');
      const pressure = Number.parseFloat(pressureRaw || '');

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return {
        x,
        y,
        pressure: Number.isFinite(pressure) ? pressure : undefined,
      };
    })
    .filter((point): point is ScribblePoint => point !== null);
}

function getStrokeOutlinePath(points: number[][]): string {
  if (points.length === 0) {
    return '';
  }

  const max = points.length - 1;
  const commands: string[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = index === max ? points[0] : points[index + 1];
    const midX = (point[0] + next[0]) / 2;
    const midY = (point[1] + next[1]) / 2;

    if (index === 0) {
      commands.push(`M ${formatNumber(point[0], ABSOLUTE_PATH_DECIMALS)} ${formatNumber(point[1], ABSOLUTE_PATH_DECIMALS)}`);
    }

    commands.push(
      `Q ${formatNumber(point[0], ABSOLUTE_PATH_DECIMALS)} ${formatNumber(point[1], ABSOLUTE_PATH_DECIMALS)} ${formatNumber(midX, ABSOLUTE_PATH_DECIMALS)} ${formatNumber(midY, ABSOLUTE_PATH_DECIMALS)}`,
    );
  }

  commands.push('Z');
  return commands.join(' ');
}

function getFreehandInputPointsForPoints(
  stroke: ScribbleStroke,
  points: ScribblePoint[],
  pageWidth: number,
  pageHeight: number,
): FreehandPoint[] {
  const hasExplicitPressure = points.some((point) => typeof point.pressure === 'number');

  if (!hasExplicitPressure) {
    return points.map((point) => [point.x * pageWidth, point.y * pageHeight]);
  }

  return points.map((point) => [
    point.x * pageWidth,
    point.y * pageHeight,
    resolveStrokePressure(point, stroke),
  ]);
}

function getFreehandInputPoints(stroke: ScribbleStroke, pageWidth: number, pageHeight: number): FreehandPoint[] {
  return getFreehandInputPointsForPoints(stroke, stroke.points, pageWidth, pageHeight);
}

export function buildRenderableStrokeLayerPathData(
  stroke: ScribbleStroke,
  pageWidth: number,
  pageHeight: number,
): string[] {
  if (stroke.points.length === 0) return [];

  if (stroke.tool !== 'pencil' || stroke.points.length < 2) {
    const pathData = buildRenderableStrokePathData(stroke, pageWidth, pageHeight);
    return pathData ? [pathData] : [];
  }

  const preset = getPerfectFreehandOptions(stroke);
  const layerPaths: string[] = [];

  for (let index = 0; index < stroke.points.length - 1; index += 1) {
    const sliceStart = Math.max(0, index - 1);
    const sliceEnd = Math.min(stroke.points.length, index + 3);
    const slicePoints = stroke.points.slice(sliceStart, sliceEnd);
    if (slicePoints.length < 2) {
      continue;
    }

    const inputPoints = getFreehandInputPointsForPoints(stroke, slicePoints, pageWidth, pageHeight);
    const outline = getStroke(inputPoints as number[][], {
      ...preset,
      simulatePressure: preset.simulatePressure ?? inputPoints[0]?.length !== 3,
      last: index === stroke.points.length - 2,
    }) as number[][];
    const pathData = getStrokeOutlinePath(outline);

    if (pathData) {
      layerPaths.push(pathData);
    }
  }

  return layerPaths;
}

export function buildRenderableStrokePathData(
  stroke: ScribbleStroke,
  pageWidth: number,
  pageHeight: number,
): string {
  if (stroke.points.length === 0) return '';

  if (isFilledScribbleStroke(stroke)) {
    return buildFountainFillPathData(stroke, pageWidth, pageHeight);
  }

  if (stroke.points.length === 1) {
    const point = stroke.points[0];
    const radius = Math.max(0.5, stroke.width / 2);
    const x = point.x * pageWidth;
    const y = point.y * pageHeight;

    return [
      `M ${formatNumber(x - radius, ABSOLUTE_PATH_DECIMALS)} ${formatNumber(y, ABSOLUTE_PATH_DECIMALS)}`,
      `A ${formatNumber(radius, ABSOLUTE_PATH_DECIMALS)} ${formatNumber(radius, ABSOLUTE_PATH_DECIMALS)} 0 1 0 ${formatNumber(x + radius, ABSOLUTE_PATH_DECIMALS)} ${formatNumber(y, ABSOLUTE_PATH_DECIMALS)}`,
      `A ${formatNumber(radius, ABSOLUTE_PATH_DECIMALS)} ${formatNumber(radius, ABSOLUTE_PATH_DECIMALS)} 0 1 0 ${formatNumber(x - radius, ABSOLUTE_PATH_DECIMALS)} ${formatNumber(y, ABSOLUTE_PATH_DECIMALS)}`,
      'Z',
    ].join(' ');
  }

  const inputPoints = getFreehandInputPoints(stroke, pageWidth, pageHeight);
  const preset = getPerfectFreehandOptions(stroke);
  const outline = getStroke(inputPoints as number[][], {
    ...preset,
    simulatePressure: preset.simulatePressure ?? inputPoints[0]?.length !== 3,
    last: true,
  }) as number[][];

  return getStrokeOutlinePath(outline);
}

function toAbsolutePoint(point: ScribblePoint, pageWidth: number, pageHeight: number): AbsolutePoint {
  return {
    x: point.x * pageWidth,
    y: point.y * pageHeight,
  };
}

function normalizeAbsolutePoint(point: AbsolutePoint): AbsolutePoint {
  return {
    x: Number.isFinite(point.x) ? point.x : 0,
    y: Number.isFinite(point.y) ? point.y : 0,
  };
}

function getStrokeTangent(points: AbsolutePoint[], index: number): AbsolutePoint {
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;

  return {
    x: dx / length,
    y: dy / length,
  };
}

function getFountainHalfWidth(stroke: ScribbleStroke, index: number): number {
  const point = stroke.points[index] ?? stroke.points[stroke.points.length - 1];
  const pressure = resolveStrokePressure(point, stroke);
  const progress = stroke.points.length <= 1 ? 0.5 : index / (stroke.points.length - 1);
  const edgeTaper = Math.sin(progress * Math.PI);
  const taper = 0.35 + edgeTaper * 0.65;
  return stroke.width * (0.45 + pressure * 0.75) * taper;
}

function buildFountainOutline(stroke: ScribbleStroke, pageWidth: number, pageHeight: number): AbsolutePoint[] {
  const centerline = stroke.points.map((point) => toAbsolutePoint(point, pageWidth, pageHeight));
  if (centerline.length === 0) return [];

  if (centerline.length === 1) {
    const center = centerline[0];
    const radius = Math.max(1, stroke.width * 0.8);
    return [
      { x: center.x - radius, y: center.y },
      { x: center.x, y: center.y - radius },
      { x: center.x + radius, y: center.y },
      { x: center.x, y: center.y + radius },
    ];
  }

  const leftSide: AbsolutePoint[] = [];
  const rightSide: AbsolutePoint[] = [];

  for (let index = 0; index < centerline.length; index += 1) {
    const point = centerline[index];
    const tangent = getStrokeTangent(centerline, index);
    const normal = normalizeAbsolutePoint({ x: -tangent.y, y: tangent.x });
    const halfWidth = getFountainHalfWidth(stroke, index);

    leftSide.push({
      x: point.x + normal.x * halfWidth,
      y: point.y + normal.y * halfWidth,
    });
    rightSide.push({
      x: point.x - normal.x * halfWidth,
      y: point.y - normal.y * halfWidth,
    });
  }

  return [...leftSide, ...rightSide.reverse()];
}

export function buildFountainFillPathData(
  stroke: ScribbleStroke,
  pageWidth: number,
  pageHeight: number,
): string {
  const outline = buildFountainOutline(stroke, pageWidth, pageHeight);
  if (outline.length < 3) return '';

  const fmt = (v: number) => formatNumber(v, ABSOLUTE_PATH_DECIMALS);
  const first = outline[0];
  const commands: string[] = [`M ${fmt(first.x)} ${fmt(first.y)}`];

  // Use quadratic Bézier curves through midpoints for a smooth outline
  // instead of straight L segments which look angular with fewer points.
  for (let i = 1; i < outline.length - 1; i += 1) {
    const curr = outline[i];
    const next = outline[i + 1];
    const mx = (curr.x + next.x) / 2;
    const my = (curr.y + next.y) / 2;
    commands.push(`Q ${fmt(curr.x)} ${fmt(curr.y)} ${fmt(mx)} ${fmt(my)}`);
  }

  const last = outline[outline.length - 1];
  commands.push(`L ${fmt(last.x)} ${fmt(last.y)}`);
  commands.push('Z');

  return commands.join(' ');
}

function buildPencilPatternMarkup(strokes: ScribbleStroke[]): string {
  const seen = new Set<string>();

  return strokes
    .filter((stroke) => stroke.tool === 'pencil')
    .map((stroke) => {
      const patternId = getPencilPatternId(stroke);
      if (seen.has(patternId)) {
        return '';
      }

      seen.add(patternId);
      const pattern = buildPencilTexturePattern(stroke.variant, stroke.color);
      const streakMarkup = pattern.streaks
        .map((segment) => (
          `<line x1="${formatNumber(segment.x1, ABSOLUTE_PATH_DECIMALS)}" y1="${formatNumber(segment.y1, ABSOLUTE_PATH_DECIMALS)}" x2="${formatNumber(segment.x2, ABSOLUTE_PATH_DECIMALS)}" y2="${formatNumber(segment.y2, ABSOLUTE_PATH_DECIMALS)}" stroke="${escapeXml(segment.color)}" stroke-width="${formatNumber(segment.width, 2)}" stroke-linecap="round"/>`
        ))
        .join('');
      const dotMarkup = pattern.dots
        .map((dot) => (
          `<circle cx="${formatNumber(dot.x, ABSOLUTE_PATH_DECIMALS)}" cy="${formatNumber(dot.y, ABSOLUTE_PATH_DECIMALS)}" r="${formatNumber(dot.size, 2)}" fill="${escapeXml(dot.color)}"/>`
        ))
        .join('');
      const smudgeMarkup = pattern.smudges
        .map((smudge) => (
          `<ellipse cx="${formatNumber(smudge.x, ABSOLUTE_PATH_DECIMALS)}" cy="${formatNumber(smudge.y, ABSOLUTE_PATH_DECIMALS)}" rx="${formatNumber(smudge.width / 2, 2)}" ry="${formatNumber(smudge.height / 2, 2)}" fill="${escapeXml(smudge.color)}" transform="rotate(${formatNumber(smudge.rotation, 2)} ${formatNumber(smudge.x, ABSOLUTE_PATH_DECIMALS)} ${formatNumber(smudge.y, ABSOLUTE_PATH_DECIMALS)})"/>`
        ))
        .join('');

      return `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${pattern.tileSize}" height="${pattern.tileSize}">${streakMarkup}${dotMarkup}${smudgeMarkup}</pattern>`;
    })
    .join('');
}

export function serializeScribbleSnapshotToSvg(
  snapshot: ScribbleSnapshot,
  pageWidth: number,
  pageHeight: number,
): string {
  const defsMarkup = buildPencilPatternMarkup(snapshot.strokes);
  const strokeMarkup = snapshot.strokes
    .map((stroke) => {
      const pathData = buildRenderableStrokePathData(stroke, pageWidth, pageHeight);
      const opacity = resolveScribbleStrokeOpacity(stroke);
      const variantAttribute = stroke.variant ? ` data-v="${escapeXml(stroke.variant)}"` : '';
      const opacityAttribute = opacity < 0.999 ? ` opacity="${formatNumber(opacity, 2)}"` : '';
      const pointAttribute = ` data-pts="${escapeXml(serializePointData(stroke.points))}"`;
      const widthAttribute = ` data-w="${formatNumber(stroke.width, 2)}"`;
      const toolCode = stroke.tool === 'marker'
        ? 'm'
        : stroke.tool === 'eraser'
          ? 'e'
          : stroke.tool === 'gel'
            ? 'g'
            : isFilledScribbleStroke(stroke)
              ? 'f'
              : 'p';

      if (!pathData) {
        return '';
      }

      const basePath = `<path id="${escapeXml(stroke.id)}" d="${escapeXml(pathData)}" fill="${escapeXml(stroke.color)}" data-role="stroke-base" data-t="${toolCode}"${variantAttribute}${opacityAttribute}${pointAttribute}${widthAttribute}/>`;

      if (stroke.tool !== 'pencil') {
        return basePath;
      }

      const hiddenBasePath = `<path id="${escapeXml(stroke.id)}" d="${escapeXml(pathData)}" fill="${escapeXml(stroke.color)}" data-role="stroke-base" data-t="${toolCode}"${variantAttribute}${pointAttribute}${widthAttribute} opacity="0"/>`;
      const layerPaths = buildRenderableStrokeLayerPathData(stroke, pageWidth, pageHeight);
      const visibleOpacity = formatNumber(opacity, 2);
      const visibleLayers = layerPaths
        .map((layerPath) => (
          `<g data-role="stroke-layer" opacity="${visibleOpacity}"><path d="${escapeXml(layerPath)}" fill="${escapeXml(stroke.color)}"/><path d="${escapeXml(layerPath)}" fill="url(#${getPencilPatternId(stroke)})" data-role="stroke-texture" opacity="1"/></g>`
        ))
        .join('');

      return `<g data-stroke-id="${escapeXml(stroke.id)}">${hiddenBasePath}${visibleLayers}</g>`;
    })
    .join('');

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pageWidth} ${pageHeight}" data-bg="${escapeXml(snapshot.background)}">`,
    `<rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" fill="${escapeXml(snapshot.background)}" />`,
    defsMarkup ? `<defs>${defsMarkup}</defs>` : '',
    `<g id="scribble-strokes" fill="none" stroke-linecap="round" stroke-linejoin="round">${strokeMarkup}</g>`,
    `</svg>`,
  ].join('');
}

function parsePathData(pathData: string): ScribblePoint[] {
  const tokens = pathData.match(/[MQL]|-?\d*\.?\d+/g) ?? [];
  const points: ScribblePoint[] = [];
  let index = 0;

  while (index < tokens.length) {
    const command = tokens[index];
    index += 1;

    if (command === 'M' || command === 'L') {
      const x = Number.parseFloat(tokens[index] || '');
      const y = Number.parseFloat(tokens[index + 1] || '');
      index += 2;

      if (Number.isFinite(x) && Number.isFinite(y)) {
        if (command === 'M' || points.length === 0 || pointDistance(points[points.length - 1], { x, y }) > 0.00001) {
          points.push({ x, y });
        } else {
          points[points.length - 1] = { x, y };
        }
      }
    }

    if (command === 'Q') {
      const controlX = Number.parseFloat(tokens[index] || '');
      const controlY = Number.parseFloat(tokens[index + 1] || '');
      const endX = Number.parseFloat(tokens[index + 2] || '');
      const endY = Number.parseFloat(tokens[index + 3] || '');
      index += 4;

      if (Number.isFinite(controlX) && Number.isFinite(controlY)) {
        points.push({ x: controlX, y: controlY });
      }

      if (Number.isFinite(endX) && Number.isFinite(endY) && points.length === 0) {
        points.push({ x: endX, y: endY });
      }
    }
  }

  return points;
}

export function parseScribbleSvg(
  markup: string,
  fallbackBackground: string,
  fallbackPageHeight: number,
): ScribbleSnapshot {
  const parser = new DOMParser();
  const document = parser.parseFromString(markup, 'image/svg+xml');
  const svg = document.documentElement;

  if (!svg || svg.nodeName.toLowerCase() !== 'svg') {
    return {
      version: 1,
      background: fallbackBackground,
      pageHeight: fallbackPageHeight,
      strokes: [],
    };
  }

  const background = svg.getAttribute('data-bg') || fallbackBackground;
  const viewBox = svg.getAttribute('viewBox')?.split(/\s+/).map((value) => Number.parseFloat(value)) ?? [];
  const pageHeight = viewBox.length === 4 && Number.isFinite(viewBox[3]) ? viewBox[3] : fallbackPageHeight;
  const paths = Array.from(document.querySelectorAll('path[data-role="stroke-base"], #scribble-strokes > path:not([data-role]), #scribble-strokes > g > path[data-role="stroke-base"]'));

  const strokes: ScribbleStroke[] = paths
    .map<ScribbleStroke | null>((pathElement) => {
      const pathData = pathElement.getAttribute('d') || '';
      const viewBoxWidth = viewBox.length === 4 && Number.isFinite(viewBox[2]) ? viewBox[2] : 1;
      const points = parsePointData(pathElement.getAttribute('data-pts'));
      const toolCode = pathElement.getAttribute('data-t');
      const variantCode = pathElement.getAttribute('data-v') || undefined;
      const tool = toolCode === 'm'
        ? 'marker'
        : toolCode === 'e'
          ? 'eraser'
        : toolCode === 'g'
          ? 'gel'
          : 'pen';
      const color = pathElement.getAttribute('fill') || pathElement.getAttribute('stroke') || '#1f2937';
      const width = Number.parseFloat(pathElement.getAttribute('data-w') || pathElement.getAttribute('stroke-width') || '') || 1;
      const opacity = Number.parseFloat(pathElement.getAttribute('opacity') || '');

      const normalizedPoints = points.length > 0
        ? points
        : parsePathData(pathData).map((point) => ({
          x: point.x / viewBoxWidth,
          y: point.y / pageHeight,
        }));

      if (normalizedPoints.length === 0) return null;

      const stroke: ScribbleStroke = {
        id: pathElement.getAttribute('id') || crypto.randomUUID(),
        tool,
        color,
        width,
        points: normalizedPoints,
        variant: toolCode === 'f' ? 'fountain' : parseScribbleStrokeVariant(variantCode),
        opacity: Number.isFinite(opacity) ? opacity : undefined,
      };

      if (toolCode === 'f') {
        stroke.svgPath = pathData;
      }

      return stroke;
    })
    .filter((stroke): stroke is ScribbleStroke => stroke !== null);

  return {
    version: 1,
    background,
    pageHeight,
    strokes,
  };
}

function pointToSegmentDistance(point: ScribblePoint, start: ScribblePoint, end: ScribblePoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0 && dy === 0) {
    const px = point.x - start.x;
    const py = point.y - start.y;
    return Math.sqrt(px * px + py * py);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projectedX = start.x + dx * t;
  const projectedY = start.y + dy * t;
  const diffX = point.x - projectedX;
  const diffY = point.y - projectedY;
  return Math.sqrt(diffX * diffX + diffY * diffY);
}

function isPointNearStroke(stroke: ScribbleStroke, point: ScribblePoint, threshold: number): boolean {
  if (stroke.points.length === 0) return false;

  if (isFilledScribbleStroke(stroke) && stroke.points.length >= 3) {
    return isPointInPolygon(point, stroke.points);
  }

  if (stroke.points.length === 1) {
    return pointToSegmentDistance(point, stroke.points[0], stroke.points[0]) <= threshold;
  }

  for (let index = 0; index < stroke.points.length - 1; index += 1) {
    if (pointToSegmentDistance(point, stroke.points[index], stroke.points[index + 1]) <= threshold) {
      return true;
    }
  }

  return false;
}

export function findIntersectingStrokeIds(
  snapshot: ScribbleSnapshot,
  point: ScribblePoint,
  threshold: number,
): string[] {
  return snapshot.strokes
    .filter((stroke) => isPointNearStroke(stroke, point, threshold))
    .map((stroke) => stroke.id);
}