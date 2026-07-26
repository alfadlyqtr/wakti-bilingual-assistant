// Tab 2 — the editable floor plan document, and the pure geometry that reads it.
//
// Why this module exists separately from DesignerWorkspace:
//   Tab 3 already has excellent wall/opening geometry, but every helper there is declared
//   INSIDE the component, closing over `apertures`, `scalePixelsPerUnit` and `zoom`. That makes
//   it impossible to reuse. Everything here is a pure function taking exactly what it needs, so
//   the same code drives the on-screen SVG editor AND the offscreen canvas rasterizer that feeds
//   the image model. One definition, two renderers, no drift between what you edit and what the
//   AI is given.
//
// ⛔ COORDINATE SPACE: all coordinates are in the uploaded plan's own pixel space, i.e. the same
// space as the underlay image after downscaling. That is deliberate. Tracing lines up with the
// underlay for free, and the rasterizer emits an image of exactly the same dimensions, which is
// what makes "the output must overlay perfectly on the blueprint" achievable.

export type Point = { x: number; y: number };

export type WallType = 'structural' | 'partition' | 'beam';
export type ApertureType = 'door' | 'window';
export type DoorHinge = 'start' | 'end';
export type DoorSwing = 'left' | 'right';

export type PlanWall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: WallType;
  /** Quadratic control point. Present only on curved walls. */
  control?: Point;
};

export type PlanAperture = {
  id: string;
  wallId: string;
  type: ApertureType;
  /** Centre of the opening along its wall, 0 at the start point, 1 at the end point. */
  positionRatio: number;
  /** Opening width in plan pixels. */
  width: number;
  hinge?: DoorHinge;
  swing?: DoorSwing;
};

/** A cased opening with no door leaf — a plain gap in the wall. */
export type PlanGap = {
  id: string;
  wallId: string;
  positionRatio: number;
  width: number;
};

export type ColumnShape = 'square' | 'round';

export type PlanColumn = {
  id: string;
  x: number;
  y: number;
  size: number;
  shape: ColumnShape;
};

export type PlanFurniture = {
  id: string;
  /** Key into the furniture catalogue in floorPlanFurniture.ts. */
  symbolId: string;
  /** Centre of the item. */
  x: number;
  y: number;
  width: number;
  depth: number;
  /** Clockwise rotation in degrees. */
  rotation: number;
  /** Which room this belongs to, so a single room can be worked on alone. */
  roomId?: string;
};

export type PlanRoom = {
  id: string;
  name: string;
  /** Label anchor, also used as the room's centre for per-room work. */
  x: number;
  y: number;
};

export type FloorPlanDoc = {
  /** Matches the underlay image exactly, so edits and renders always align. */
  width: number;
  height: number;
  walls: PlanWall[];
  apertures: PlanAperture[];
  gaps: PlanGap[];
  columns: PlanColumn[];
  furniture: PlanFurniture[];
  rooms: PlanRoom[];
  /** How many plan pixels make one real-world unit. Used only for dimension labels. */
  scalePixelsPerUnit: number;
  unit: 'm' | 'ft';
};

export const createEmptyPlan = (width: number, height: number): FloorPlanDoc => ({
  width,
  height,
  walls: [],
  apertures: [],
  gaps: [],
  columns: [],
  furniture: [],
  rooms: [],
  // A sensible default for a villa-sized plan; the editor lets the user calibrate it.
  scalePixelsPerUnit: Math.max(8, Math.round(Math.max(width, height) / 40)),
  unit: 'm',
});

export const isPlanEmpty = (plan: FloorPlanDoc): boolean => (
  plan.walls.length === 0
  && plan.columns.length === 0
  && plan.furniture.length === 0
  && plan.rooms.length === 0
);

/** Wall thickness in plan pixels. Matches Tab 3's visual weighting so the two feel like one app. */
export const WALL_THICKNESS: Record<WallType, number> = {
  beam: 16,
  structural: 12,
  partition: 6,
};

export const wallThickness = (wall: PlanWall): number => WALL_THICKNESS[wall.type];

/** Point at `ratio` along a wall, following the curve when there is one. */
export const pointOnWall = (wall: PlanWall, ratio: number): Point => {
  const t = Math.min(1, Math.max(0, ratio));
  if (!wall.control) {
    return {
      x: wall.x1 + (wall.x2 - wall.x1) * t,
      y: wall.y1 + (wall.y2 - wall.y1) * t,
    };
  }
  const inverse = 1 - t;
  return {
    x: inverse * inverse * wall.x1 + 2 * inverse * t * wall.control.x + t * t * wall.x2,
    y: inverse * inverse * wall.y1 + 2 * inverse * t * wall.control.y + t * t * wall.y2,
  };
};

/** Unit tangent at `ratio`. Falls back to the chord when the derivative degenerates. */
export const wallTangent = (wall: PlanWall, ratio: number): Point => {
  let dx: number;
  let dy: number;
  if (!wall.control) {
    dx = wall.x2 - wall.x1;
    dy = wall.y2 - wall.y1;
  } else {
    const t = Math.min(1, Math.max(0, ratio));
    dx = 2 * (1 - t) * (wall.control.x - wall.x1) + 2 * t * (wall.x2 - wall.control.x);
    dy = 2 * (1 - t) * (wall.control.y - wall.y1) + 2 * t * (wall.y2 - wall.control.y);
    if (Math.hypot(dx, dy) < 1e-6) {
      dx = wall.x2 - wall.x1;
      dy = wall.y2 - wall.y1;
    }
  }
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
};

/** Outward normal at `ratio`, perpendicular to the tangent. */
export const wallNormal = (wall: PlanWall, ratio: number): Point => {
  const tangent = wallTangent(wall, ratio);
  return { x: -tangent.y, y: tangent.x };
};

const CURVE_SAMPLES = 48;

export const wallLength = (wall: PlanWall): number => {
  if (!wall.control) return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  let length = 0;
  let previous = pointOnWall(wall, 0);
  for (let index = 1; index <= CURVE_SAMPLES; index += 1) {
    const point = pointOnWall(wall, index / CURVE_SAMPLES);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
};

export type Interval = { id: string; start: number; end: number };

/**
 * The span a single opening covers along its wall, as ratios. Clamped away from the very ends so
 * an opening can never eat a wall's corner junction, which would leave the plan looking broken.
 */
export const openingInterval = (wall: PlanWall, positionRatio: number, width: number): { start: number; end: number } => {
  const length = wallLength(wall) || 1;
  const halfRatio = Math.min(0.32, width / length / 2);
  return {
    start: Math.max(0.035, positionRatio - halfRatio),
    end: Math.min(0.965, positionRatio + halfRatio),
  };
};

/** Every opening on one wall — doors, windows and plain gaps — sorted along the wall. */
export const wallOpenings = (
  wall: PlanWall,
  apertures: PlanAperture[],
  gaps: PlanGap[],
  ignoredId?: string,
): Interval[] => {
  const fromGaps = gaps
    .filter((gap) => gap.wallId === wall.id && gap.id !== ignoredId)
    .map((gap) => ({ id: gap.id, ...openingInterval(wall, gap.positionRatio, gap.width) }));
  const fromApertures = apertures
    .filter((aperture) => aperture.wallId === wall.id && aperture.id !== ignoredId)
    .map((aperture) => ({ id: aperture.id, ...openingInterval(wall, aperture.positionRatio, aperture.width) }));
  return [...fromGaps, ...fromApertures].sort((first, second) => first.start - second.start);
};

/**
 * The solid stretches of a wall, i.e. what is left once every opening is removed. This is what
 * actually gets drawn, so a door reads as a real hole rather than a line over a wall.
 */
export const wallSolidRanges = (
  wall: PlanWall,
  apertures: PlanAperture[],
  gaps: PlanGap[],
): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  wallOpenings(wall, apertures, gaps).forEach((interval) => {
    if (interval.start > cursor) ranges.push({ start: cursor, end: interval.start });
    cursor = Math.max(cursor, interval.end);
  });
  if (cursor < 1) ranges.push({ start: cursor, end: 1 });
  return ranges.filter((range) => range.end - range.start > 0.001);
};

/** Samples a stretch of wall into a polyline, so curves survive into any renderer. */
export const wallSegmentPoints = (wall: PlanWall, start: number, end: number): Point[] => {
  if (!wall.control) return [pointOnWall(wall, start), pointOnWall(wall, end)];
  const samples = Math.max(4, Math.ceil((end - start) * CURVE_SAMPLES));
  return Array.from({ length: samples + 1 }, (_, index) => (
    pointOnWall(wall, start + ((end - start) * index) / samples)
  ));
};

/** SVG path data for a stretch of wall. */
export const wallSegmentPath = (wall: PlanWall, start: number, end: number): string => (
  wallSegmentPoints(wall, start, end)
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
);

/**
 * Keeps an opening inside its wall and clear of the openings already on it, nudging it to the
 * nearest legal position rather than refusing the edit. Three passes settle the common cases
 * without risking an unbounded loop.
 */
export const safeOpeningRatio = (
  wall: PlanWall,
  requestedRatio: number,
  width: number,
  apertures: PlanAperture[],
  gaps: PlanGap[],
  ignoredId?: string,
): number => {
  const length = wallLength(wall) || 1;
  const halfRatio = Math.min(0.32, width / length / 2);
  const minimum = 0.035 + halfRatio;
  const maximum = 0.965 - halfRatio;
  const safetyGap = Math.min(0.025, 8 / length);
  let ratio = Math.max(minimum, Math.min(maximum, requestedRatio));

  for (let pass = 0; pass < 3; pass += 1) {
    const collision = wallOpenings(wall, apertures, gaps, ignoredId).find((interval) => (
      ratio + halfRatio + safetyGap > interval.start && ratio - halfRatio - safetyGap < interval.end
    ));
    if (!collision) break;
    const before = Math.max(minimum, collision.start - halfRatio - safetyGap);
    const after = Math.min(maximum, collision.end + halfRatio + safetyGap);
    ratio = Math.abs(requestedRatio - before) <= Math.abs(after - requestedRatio) ? before : after;
  }

  return Math.max(minimum, Math.min(maximum, ratio));
};

/** How wide an opening may be at a given spot before it collides with its neighbours. */
export const maximumOpeningWidth = (
  wall: PlanWall,
  positionRatio: number,
  apertures: PlanAperture[],
  gaps: PlanGap[],
  ignoredId?: string,
): number => {
  const length = wallLength(wall) || 1;
  const safetyGap = Math.min(0.025, 8 / length);
  let halfRatio = Math.min(positionRatio - 0.035, 0.965 - positionRatio);

  wallOpenings(wall, apertures, gaps, ignoredId).forEach((interval) => {
    if (interval.end <= positionRatio) halfRatio = Math.min(halfRatio, positionRatio - interval.end - safetyGap);
    if (interval.start >= positionRatio) halfRatio = Math.min(halfRatio, interval.start - positionRatio - safetyGap);
  });

  return Math.max(0, Math.min(length * 0.6, Math.max(0, halfRatio) * 2 * length));
};

export type ApertureGeometry = {
  centre: Point;
  start: Point;
  end: Point;
  hinge: Point;
  closed: Point;
  open: Point;
  width: number;
  normal: Point;
  /** SVG arc sweep flag for the door's swing arc. */
  arcSweep: 0 | 1;
  jambDepth: number;
};

/**
 * Everything needed to draw one door or window: the reveal across the wall, the jambs, and for a
 * door the leaf and the swing arc. Returns null when the opening cannot fit, so callers skip it
 * instead of drawing something malformed.
 */
export const apertureGeometry = (
  aperture: PlanAperture,
  wall: PlanWall,
  apertures: PlanAperture[],
  gaps: PlanGap[],
): ApertureGeometry | null => {
  const width = Math.min(aperture.width, maximumOpeningWidth(wall, aperture.positionRatio, apertures, gaps, aperture.id));
  if (width <= 1) return null;
  const ratio = safeOpeningRatio(wall, aperture.positionRatio, width, apertures, gaps, aperture.id);
  const centre = pointOnWall(wall, ratio);
  const tangent = wallTangent(wall, ratio);
  const normal = { x: -tangent.y, y: tangent.x };
  const start = { x: centre.x - tangent.x * (width / 2), y: centre.y - tangent.y * (width / 2) };
  const end = { x: centre.x + tangent.x * (width / 2), y: centre.y + tangent.y * (width / 2) };
  const hinge = aperture.hinge === 'end' ? end : start;
  const closed = aperture.hinge === 'end' ? start : end;
  const swingDirection = aperture.swing === 'left' ? -1 : 1;
  const open = {
    x: hinge.x + normal.x * width * swingDirection,
    y: hinge.y + normal.y * width * swingDirection,
  };
  const closedVector = { x: closed.x - hinge.x, y: closed.y - hinge.y };
  const openVector = { x: open.x - hinge.x, y: open.y - hinge.y };
  const arcSweep: 0 | 1 = closedVector.x * openVector.y - closedVector.y * openVector.x > 0 ? 1 : 0;

  return {
    centre,
    start,
    end,
    hinge,
    closed,
    open,
    width,
    normal,
    arcSweep,
    jambDepth: Math.max(4, wallThickness(wall) / 2),
  };
};

/** The plain reveal of a gap or window across the wall, with no leaf or arc. */
export const gapGeometry = (
  wallId: string,
  positionRatio: number,
  requestedWidth: number,
  wall: PlanWall,
  apertures: PlanAperture[],
  gaps: PlanGap[],
  ignoredId?: string,
): { start: Point; end: Point; normal: Point; jambDepth: number } | null => {
  if (wall.id !== wallId) return null;
  const width = Math.min(requestedWidth, maximumOpeningWidth(wall, positionRatio, apertures, gaps, ignoredId));
  if (width <= 1) return null;
  const ratio = safeOpeningRatio(wall, positionRatio, width, apertures, gaps, ignoredId);
  const centre = pointOnWall(wall, ratio);
  const tangent = wallTangent(wall, ratio);
  return {
    start: { x: centre.x - tangent.x * (width / 2), y: centre.y - tangent.y * (width / 2) },
    end: { x: centre.x + tangent.x * (width / 2), y: centre.y + tangent.y * (width / 2) },
    normal: { x: -tangent.y, y: tangent.x },
    jambDepth: Math.max(4, wallThickness(wall) / 2),
  };
};

/** Shortest distance from a point to a wall, used for hit testing in the editor. */
export const distanceToWall = (wall: PlanWall, point: Point): number => {
  const samples = wall.control ? CURVE_SAMPLES : 1;
  let best = Infinity;
  for (let index = 0; index < samples; index += 1) {
    const a = pointOnWall(wall, index / samples);
    const b = pointOnWall(wall, (index + 1) / samples);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)) : 0;
    best = Math.min(best, Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t)));
  }
  return best;
};

/** The ratio along a wall closest to a point, used when dropping a door onto a wall. */
export const closestRatioOnWall = (wall: PlanWall, point: Point): number => {
  const samples = wall.control ? CURVE_SAMPLES : 24;
  let bestRatio = 0;
  let bestDistance = Infinity;
  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / samples;
    const candidate = pointOnWall(wall, ratio);
    const distance = Math.hypot(point.x - candidate.x, point.y - candidate.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRatio = ratio;
    }
  }
  return bestRatio;
};

/**
 * Snaps a point to a nearby wall endpoint so traced walls actually join up. Without this a plan
 * ends up full of hairline gaps at the corners, which the image model then renders as broken walls.
 */
export const snapToCorner = (walls: PlanWall[], point: Point, tolerance: number): Point => {
  let best: Point | null = null;
  let bestDistance = tolerance;
  walls.forEach((wall) => {
    ([{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }] as Point[]).forEach((corner) => {
      const distance = Math.hypot(point.x - corner.x, point.y - corner.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = corner;
      }
    });
  });
  return best || point;
};

/** Axis-aligned bounds of everything in the plan, used to frame and to sanity-check a trace. */
export const planBounds = (plan: FloorPlanDoc): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  const xs: number[] = [];
  const ys: number[] = [];
  plan.walls.forEach((wall) => {
    xs.push(wall.x1, wall.x2);
    ys.push(wall.y1, wall.y2);
    if (wall.control) {
      xs.push(wall.control.x);
      ys.push(wall.control.y);
    }
  });
  plan.columns.forEach((column) => {
    xs.push(column.x - column.size / 2, column.x + column.size / 2);
    ys.push(column.y - column.size / 2, column.y + column.size / 2);
  });
  if (!xs.length) return null;
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
};

export const formatDistance = (pixels: number, plan: FloorPlanDoc): string => (
  `${(pixels / plan.scalePixelsPerUnit).toFixed(2)} ${plan.unit}`
);

let idCounter = 0;
/** Short, stable, collision-free ids. Date.now() alone repeats inside a single tick. */
export const planId = (prefix: string): string => {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`;
};
