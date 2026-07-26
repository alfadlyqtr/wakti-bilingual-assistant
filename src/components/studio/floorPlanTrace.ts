// Tab 2 — turning a raw AI trace into a clean, editable plan.
//
// ⛔ THE CLEANUP IN THIS FILE IS NOT OPTIONAL POLISH. IT IS THE FEATURE.
// A vision model reading a drawing returns coordinates that are roughly right and never exactly
// right: walls come back a degree or two off square, corners miss each other by a few pixels, and
// openings float slightly off the wall they belong to. Handed straight to the editor that produces
// a plan that looks subtly broken and renders even worse.
//
// So the raw trace is put through four passes before the user ever sees it:
//   1. STRAIGHTEN  — walls within a few degrees of square are snapped to exactly square.
//   2. WELD        — endpoints that nearly touch are merged onto one shared corner.
//   3. ATTACH      — each opening is snapped onto its nearest wall, by position along that wall.
//   4. PRUNE       — hairline fragments the model hallucinated are dropped.
// Almost every plan in the world is orthogonal, so pass 1 alone removes most of the visible error.

import {
  type FloorPlanDoc,
  type PlanAperture,
  type PlanFurniture,
  type PlanGap,
  type PlanRoom,
  type PlanWall,
  type WallType,
  closestRatioOnWall,
  createEmptyPlan,
  distanceToWall,
  maximumOpeningWidth,
  planId,
  safeOpeningRatio,
  wallLength,
} from './floorPlanModel';

export type RawTraceWall = {
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  type?: string;
  control?: { x?: number; y?: number };
};

export type RawTraceOpening = {
  x?: number;
  y?: number;
  width?: number;
  type?: string;
  swing?: string;
};

export type RawTraceColumn = { x?: number; y?: number; size?: number; shape?: string };
export type RawTraceRoom = { name?: string; x?: number; y?: number };

export type RawTrace = {
  walls?: RawTraceWall[];
  openings?: RawTraceOpening[];
  columns?: RawTraceColumn[];
  rooms?: RawTraceRoom[];
};

/** Walls closer to square than this are treated as intended to be square. */
const SQUARE_TOLERANCE_DEGREES = 5;

const finite = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// ⛔ 'beam' is deliberately NOT accepted from a trace. Stair treads, hatching bands and dimension
// stacks all look like "a band with no room either side", so the model classified them as beams and
// they rendered as purple bars with a black column parked on each one. Beams are a manual tool only.
const wallTypeOf = (raw: unknown): WallType => {
  const value = String(raw || '').toLowerCase();
  if (value === 'partition') return 'partition';
  return 'structural';
};

/**
 * Pass 1 — snap near-square walls to exactly square.
 * The endpoints are pulled onto their shared average, so the wall stays where the user saw it
 * rather than jumping to one end's coordinate.
 */
const straightenWall = (wall: PlanWall): PlanWall => {
  if (wall.control) return wall;
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  if (!dx && !dy) return wall;

  const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  const offHorizontal = Math.min(angle, Math.abs(180 - angle));
  const offVertical = Math.abs(90 - angle);

  if (offHorizontal <= SQUARE_TOLERANCE_DEGREES && offHorizontal <= offVertical) {
    const y = (wall.y1 + wall.y2) / 2;
    return { ...wall, y1: y, y2: y };
  }
  if (offVertical <= SQUARE_TOLERANCE_DEGREES) {
    const x = (wall.x1 + wall.x2) / 2;
    return { ...wall, x1: x, y1: wall.y1, x2: x, y2: wall.y2 };
  }
  return wall;
};

type Corner = { x: number; y: number; count: number };

/**
 * Pass 2 — weld endpoints that nearly coincide onto a single shared corner.
 * Greedy clustering is used rather than full union-find: plans have tens of corners, not
 * thousands, and greedy gives the same answer at a fraction of the complexity.
 */
const weldCorners = (walls: PlanWall[], tolerance: number): PlanWall[] => {
  const corners: Corner[] = [];

  const resolve = (x: number, y: number): { x: number; y: number } => {
    const existing = corners.find((corner) => Math.hypot(corner.x - x, corner.y - y) <= tolerance);
    if (existing) {
      // Roll the cluster centre towards the new point so the corner settles between its walls.
      existing.x = (existing.x * existing.count + x) / (existing.count + 1);
      existing.y = (existing.y * existing.count + y) / (existing.count + 1);
      existing.count += 1;
      return { x: existing.x, y: existing.y };
    }
    const created: Corner = { x, y, count: 1 };
    corners.push(created);
    return { x, y };
  };

  // First pass registers every endpoint and settles the cluster centres.
  walls.forEach((wall) => {
    resolve(wall.x1, wall.y1);
    resolve(wall.x2, wall.y2);
  });

  // Second pass reads the settled centres back onto the walls.
  const snap = (x: number, y: number): { x: number; y: number } => {
    const match = corners.find((corner) => Math.hypot(corner.x - x, corner.y - y) <= tolerance * 1.5);
    return match ? { x: match.x, y: match.y } : { x, y };
  };

  return walls.map((wall) => {
    const start = snap(wall.x1, wall.y1);
    const end = snap(wall.x2, wall.y2);
    return { ...wall, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  });
};

/**
 * Pass 5 — kill stacked parallel junk.
 *
 * Stair treads, hatching, and dimension stacks all present as a row of near-parallel lines sitting
 * very close together. A real building never has three parallel walls a few centimetres apart, so
 * when that pattern appears we keep only the outermost pair and drop everything between them.
 */
const dropParallelStacks = (walls: PlanWall[], bandTolerance: number): PlanWall[] => {
  const removed = new Set<string>();

  const axisOf = (wall: PlanWall): 'h' | 'v' | null => {
    const dx = Math.abs(wall.x2 - wall.x1);
    const dy = Math.abs(wall.y2 - wall.y1);
    if (dx > dy * 4) return 'h';
    if (dy > dx * 4) return 'v';
    return null;
  };

  (['h', 'v'] as const).forEach((axis) => {
    // Position across the run, and the span along it.
    const posOf = (wall: PlanWall) => (axis === 'h' ? (wall.y1 + wall.y2) / 2 : (wall.x1 + wall.x2) / 2);
    const spanOf = (wall: PlanWall): [number, number] => (axis === 'h'
      ? [Math.min(wall.x1, wall.x2), Math.max(wall.x1, wall.x2)]
      : [Math.min(wall.y1, wall.y2), Math.max(wall.y1, wall.y2)]);

    const sorted = walls
      .filter((wall) => axisOf(wall) === axis)
      .sort((a, b) => posOf(a) - posOf(b));

    let index = 0;
    while (index < sorted.length) {
      // Collect a run of walls inside one tight band that also overlap along the axis.
      const band: PlanWall[] = [sorted[index]];
      let next = index + 1;
      while (next < sorted.length && posOf(sorted[next]) - posOf(band[band.length - 1]) <= bandTolerance) {
        const [aStart, aEnd] = spanOf(band[band.length - 1]);
        const [bStart, bEnd] = spanOf(sorted[next]);
        if (Math.min(aEnd, bEnd) - Math.max(aStart, bStart) <= 0) break;
        band.push(sorted[next]);
        next += 1;
      }
      // Three or more stacked parallel lines is drafting notation, not architecture.
      if (band.length >= 3) band.slice(1, -1).forEach((wall) => removed.add(wall.id));
      index = next > index ? next : index + 1;
    }
  });

  return walls.filter((wall) => !removed.has(wall.id));
};

/**
 * Converts a raw AI trace into a clean plan document in the plan's own pixel space.
 *
 * `width` and `height` are the underlay image's dimensions, because everything downstream — the
 * editor, the rasterizer and the render — shares that one coordinate space.
 */
export const importTrace = (raw: RawTrace, width: number, height: number): FloorPlanDoc => {
  const plan = createEmptyPlan(width, height);
  const shortEdge = Math.min(width, height);
  // Everything scales off the plan size, so a phone screenshot and a huge export behave the same.
  const weldTolerance = Math.max(5, shortEdge * 0.012);
  const minimumWallLength = Math.max(6, shortEdge * 0.012);
  const attachTolerance = Math.max(14, shortEdge * 0.045);
  // Treads sit ~1% of the short edge apart; a real corridor is 4%+. 2% separates the two cleanly.
  const stackTolerance = Math.max(8, shortEdge * 0.02);

  // ---------------------------------------------------------------- walls
  const rawWalls = Array.isArray(raw.walls) ? raw.walls : [];
  let walls: PlanWall[] = rawWalls
    .map((entry) => {
      const x1 = finite(entry?.x1) * width;
      const y1 = finite(entry?.y1) * height;
      const x2 = finite(entry?.x2) * width;
      const y2 = finite(entry?.y2) * height;
      const hasControl = entry?.control
        && Number.isFinite(Number(entry.control.x))
        && Number.isFinite(Number(entry.control.y));
      const wall: PlanWall = {
        id: planId('wall'),
        x1,
        y1,
        x2,
        y2,
        type: wallTypeOf(entry?.type),
        ...(hasControl
          ? { control: { x: finite(entry.control?.x) * width, y: finite(entry.control?.y) * height } }
          : {}),
      };
      return wall;
    })
    // Pass 4 (part one) — drop hairline fragments before they pollute the corner clusters.
    .filter((wall) => Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) >= minimumWallLength)
    .map(straightenWall);

  walls = weldCorners(walls, weldTolerance);

  // Pass 4 (part two) — welding can collapse a short wall onto itself.
  walls = walls.filter((wall) => wallLength(wall) >= minimumWallLength);

  walls = dropParallelStacks(walls, stackTolerance);

  plan.walls = walls;

  // ---------------------------------------------------------------- openings
  // Each opening is a point, so it is attached to whichever wall it actually sits on. Anything
  // too far from every wall is discarded rather than forced onto the wrong one.
  const apertures: PlanAperture[] = [];
  const gaps: PlanGap[] = [];

  (Array.isArray(raw.openings) ? raw.openings : []).forEach((entry) => {
    const point = { x: finite(entry?.x) * width, y: finite(entry?.y) * height };
    if (!point.x && !point.y) return;

    let nearest: PlanWall | null = null;
    let nearestDistance = attachTolerance;
    plan.walls.forEach((wall) => {
      const distance = distanceToWall(wall, point);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = wall;
      }
    });
    if (!nearest) return;
    const wall: PlanWall = nearest;

    const length = wallLength(wall) || 1;
    const requestedWidth = finite(entry?.width) * width;
    // Openings can never be wider than most of their wall, and a tiny one is unusable.
    const desiredWidth = Math.min(
      Math.max(requestedWidth || length * 0.3, Math.max(8, shortEdge * 0.02)),
      length * 0.85,
    );

    const ratio = closestRatioOnWall(wall, point);
    const type = String(entry?.type || 'door').toLowerCase();

    const available = maximumOpeningWidth(wall, ratio, apertures, gaps);
    const finalWidth = Math.min(desiredWidth, available);
    if (finalWidth < Math.max(6, shortEdge * 0.012)) return;

    const safeRatio = safeOpeningRatio(wall, ratio, finalWidth, apertures, gaps);

    if (type === 'gap' || type === 'opening') {
      gaps.push({ id: planId('gap'), wallId: wall.id, positionRatio: safeRatio, width: finalWidth });
      return;
    }

    apertures.push({
      id: planId(type === 'window' ? 'window' : 'door'),
      wallId: wall.id,
      type: type === 'window' ? 'window' : 'door',
      positionRatio: safeRatio,
      width: finalWidth,
      ...(type === 'window'
        ? {}
        : {
          hinge: 'start' as const,
          swing: String(entry?.swing || '').toLowerCase() === 'left' ? ('left' as const) : ('right' as const),
        }),
    });
  });

  plan.apertures = apertures;
  plan.gaps = gaps;

  // ---------------------------------------------------------------- columns
  // ⛔ Deliberately empty. The tracer invented a column on top of every hallucinated beam, which is
  // what produced the "sliders". Pillars are a manual tool the user places where they actually are.
  plan.columns = [];

  // ---------------------------------------------------------------- rooms
  plan.rooms = (Array.isArray(raw.rooms) ? raw.rooms : [])
    .map((entry): PlanRoom => ({
      id: planId('room'),
      name: String(entry?.name || '').trim().slice(0, 40),
      // Kept just inside the frame so a label never sits half off the drawing.
      x: Math.min(width * 0.98, Math.max(width * 0.02, finite(entry?.x) * width)),
      y: Math.min(height * 0.98, Math.max(height * 0.02, finite(entry?.y) * height)),
    }))
    .filter((room) => room.name.length > 0);

  return plan;
};

/**
 * Assigns each furniture item to the room whose label is nearest.
 *
 * Rooms are points rather than polygons here, which is a deliberate simplification: deriving true
 * room polygons from traced walls is a genuinely hard problem, and nearest-label is right almost
 * every time on a real plan because labels sit at room centres. It only matters for grouping, so a
 * rare mistake costs a per-room listing, never the geometry.
 */
export const assignFurnitureToRooms = (
  furniture: PlanFurniture[],
  rooms: PlanRoom[],
): PlanFurniture[] => {
  if (!rooms.length) return furniture.map((item) => ({ ...item, roomId: undefined }));
  return furniture.map((item) => {
    let bestId = rooms[0].id;
    let bestDistance = Infinity;
    rooms.forEach((room) => {
      const distance = Math.hypot(item.x - room.x, item.y - room.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = room.id;
      }
    });
    return { ...item, roomId: bestId };
  });
};

/** A quick readable verdict on a trace, so the user is told plainly when it came back thin. */
export const traceQuality = (plan: FloorPlanDoc): { ok: boolean; walls: number; rooms: number } => ({
  ok: plan.walls.length >= 4 && plan.rooms.length >= 1,
  walls: plan.walls.length,
  rooms: plan.rooms.length,
});
