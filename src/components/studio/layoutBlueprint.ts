// Turns a layout drawn on the Draw Layout canvas into a clean architectural blueprint PNG.
//
// ⛔ This deliberately does NOT screenshot the SVG on screen. Two separate reasons, both fatal:
//   1. Every stroke on that canvas takes its colour from a Tailwind class. Serialise the SVG on
//      its own and it reaches the encoder with no stylesheet attached, so it comes out blank.
//   2. Even if that worked, what is on screen is a dark-mode UI with a blue grid over it.
// Tab 2's plan reader wants the exact opposite — black lines on white paper with the room names
// printed on the drawing, because reading those names off the page is how it finds the rooms. So
// the blueprint is drawn from the geometry onto a plain 2D canvas, and the on-screen SVG is left
// alone as a purely visual thing.

/** Structural subset of a drawn wall. `Wall` in DesignerWorkspace satisfies this. */
export type BlueprintWall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'structural' | 'partition' | 'beam';
  control?: { x: number; y: number };
  breaks?: Array<{ positionRatio: number; width: number }>;
};

/** Structural subset of a door or window. `Aperture` in DesignerWorkspace satisfies this. */
export type BlueprintAperture = {
  wallId: string;
  type: 'door' | 'window';
  positionRatio: number;
  width: number;
};

/** Structural subset of a placed piece. `PlacedItem` in LayoutFurniture satisfies this. */
export type BlueprintItem = {
  x: number;
  y: number;
  width: number;
  depth: number;
  rotation: number;
};

export type BlueprintLabel = {
  name: string;
  x: number;
  y: number;
};

/** Drawn in layout pixels, so these read as real wall thicknesses on the page. */
const WALL_THICKNESS: Record<BlueprintWall['type'], number> = {
  structural: 15,
  partition: 9,
  beam: 7,
};

/** Plain white paper around the building, so the plan is not cropped hard against its own walls. */
const MARGIN = 72;
/** Drawn larger than the canvas so the printed room names survive being read by a vision model. */
const OUTPUT_SCALE = 2;
const MAX_OUTPUT_EDGE = 2200;
const LABEL_FONT_SIZE = 22;

const pointOnWall = (wall: BlueprintWall, t: number): { x: number; y: number } => {
  if (wall.control) {
    const inverse = 1 - t;
    return {
      x: (inverse * inverse * wall.x1) + (2 * inverse * t * wall.control.x) + (t * t * wall.x2),
      y: (inverse * inverse * wall.y1) + (2 * inverse * t * wall.control.y) + (t * t * wall.y2),
    };
  }
  return {
    x: wall.x1 + ((wall.x2 - wall.x1) * t),
    y: wall.y1 + ((wall.y2 - wall.y1) * t),
  };
};

/** Unit vector pointing along the wall at `t`. Used to place openings square to the wall. */
const directionOnWall = (wall: BlueprintWall, t: number): { x: number; y: number } => {
  let dx: number;
  let dy: number;
  if (wall.control) {
    const inverse = 1 - t;
    dx = (2 * inverse * (wall.control.x - wall.x1)) + (2 * t * (wall.x2 - wall.control.x));
    dy = (2 * inverse * (wall.control.y - wall.y1)) + (2 * t * (wall.y2 - wall.control.y));
  } else {
    dx = wall.x2 - wall.x1;
    dy = wall.y2 - wall.y1;
  }
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
};

const wallLength = (wall: BlueprintWall): number => {
  if (!wall.control) return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
  let length = 0;
  let previous = pointOnWall(wall, 0);
  for (let step = 1; step <= 16; step += 1) {
    const next = pointOnWall(wall, step / 16);
    length += Math.hypot(next.x - previous.x, next.y - previous.y);
    previous = next;
  }
  return length;
};

type Opening = {
  wall: BlueprintWall;
  positionRatio: number;
  width: number;
  kind: 'door' | 'window' | 'gap';
};

/**
 * Draws the blueprint and returns it as a PNG data URL, or '' if there is nothing to draw.
 *
 * The result is cropped to the building's own bounding box plus a margin, which matters more than
 * it looks: tab 2 sizes its render from the blueprint's proportions, so handing it a mostly-empty
 * 1200x1200 square would produce a square render of a long thin apartment.
 */
export const layoutToBlueprintPng = (input: {
  walls: BlueprintWall[];
  apertures: BlueprintAperture[];
  items: BlueprintItem[];
  labels: BlueprintLabel[];
}): string => {
  const { walls, apertures, items, labels } = input;
  if (!walls.length) return '';

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  walls.forEach((wall) => {
    include(wall.x1, wall.y1);
    include(wall.x2, wall.y2);
    if (wall.control) include(wall.control.x, wall.control.y);
  });
  items.forEach((item) => {
    const reach = Math.max(item.width, item.depth) / 2;
    include(item.x - reach, item.y - reach);
    include(item.x + reach, item.y + reach);
  });
  labels.forEach((label) => include(label.x, label.y));

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return '';

  const left = minX - MARGIN;
  const top = minY - MARGIN;
  const boxWidth = (maxX - minX) + (MARGIN * 2);
  const boxHeight = (maxY - minY) + (MARGIN * 2);
  if (boxWidth <= 0 || boxHeight <= 0) return '';

  const scale = Math.min(OUTPUT_SCALE, MAX_OUTPUT_EDGE / Math.max(boxWidth, boxHeight));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(boxWidth * scale));
  canvas.height = Math.max(1, Math.round(boxHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Work in layout pixels from here on, so nothing below has to think about output resolution.
  ctx.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  walls.forEach((wall) => {
    const isBeam = wall.type === 'beam';
    ctx.strokeStyle = isBeam ? '#6b7280' : '#111827';
    ctx.lineWidth = WALL_THICKNESS[wall.type] || WALL_THICKNESS.partition;
    ctx.setLineDash(isBeam ? [16, 10] : []);
    ctx.beginPath();
    ctx.moveTo(wall.x1, wall.y1);
    if (wall.control) ctx.quadraticCurveTo(wall.control.x, wall.control.y, wall.x2, wall.y2);
    else ctx.lineTo(wall.x2, wall.y2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  const openings: Opening[] = [];
  walls.forEach((wall) => {
    (wall.breaks || []).forEach((wallBreak) => {
      openings.push({ wall, positionRatio: wallBreak.positionRatio, width: wallBreak.width, kind: 'gap' });
    });
  });
  apertures.forEach((aperture) => {
    const wall = walls.find((item) => item.id === aperture.wallId);
    if (wall) {
      openings.push({ wall, positionRatio: aperture.positionRatio, width: aperture.width, kind: aperture.type });
    }
  });

  openings.forEach(({ wall, positionRatio, width, kind }) => {
    const length = wallLength(wall) || 1;
    const halfRatio = (width / 2) / length;
    const start = pointOnWall(wall, Math.max(0, positionRatio - halfRatio));
    const end = pointOnWall(wall, Math.min(1, positionRatio + halfRatio));
    const thickness = WALL_THICKNESS[wall.type] || WALL_THICKNESS.partition;

    // Cut the hole by painting the wall out in white. The page is white, so this reads as a real
    // opening without having to work out where each surviving piece of the wall starts and ends.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = thickness + 2;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    const along = directionOnWall(wall, positionRatio);
    const normalX = -along.y;
    const normalY = along.x;

    if (kind === 'window') {
      // Two wall faces plus a centre line: the standard way a window is drawn on a plan.
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 1.6;
      [-thickness / 2, 0, thickness / 2].forEach((offset) => {
        ctx.beginPath();
        ctx.moveTo(start.x + (normalX * offset), start.y + (normalY * offset));
        ctx.lineTo(end.x + (normalX * offset), end.y + (normalY * offset));
        ctx.stroke();
      });
      return;
    }

    if (kind === 'door') {
      const openWidth = Math.hypot(end.x - start.x, end.y - start.y) || width;
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.2;
      // The leaf, standing open at ninety degrees to the wall.
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(start.x + (normalX * openWidth), start.y + (normalY * openWidth));
      ctx.stroke();
      // The swing arc, from the open leaf round to the closed position.
      const leafAngle = Math.atan2(normalY, normalX);
      const closedAngle = Math.atan2(end.y - start.y, end.x - start.x);
      let sweep = closedAngle - leafAngle;
      while (sweep > Math.PI) sweep -= Math.PI * 2;
      while (sweep < -Math.PI) sweep += Math.PI * 2;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(start.x, start.y, openWidth, leafAngle, leafAngle + sweep, sweep < 0);
      ctx.stroke();
    }
  });

  // Furniture is drawn as unlabelled symbolic outlines, exactly as a real plan draws it. Printing
  // the piece names here would give the plan reader extra words to mistake for room names.
  ctx.strokeStyle = '#9ca3af';
  ctx.fillStyle = '#f3f4f6';
  ctx.lineWidth = 1.8;
  items.forEach((item) => {
    if (item.width <= 0 || item.depth <= 0) return;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate((item.rotation || 0) * (Math.PI / 180));
    ctx.beginPath();
    ctx.rect(-item.width / 2, -item.depth / 2, item.width, item.depth);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${LABEL_FONT_SIZE}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.lineJoin = 'round';
  labels.forEach((label) => {
    const name = (label.name || '').trim().toUpperCase();
    if (!name) return;
    // A white halo behind the name keeps it readable where it lands on top of furniture.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeText(name, label.x, label.y);
    ctx.fillStyle = '#111827';
    ctx.fillText(name, label.x, label.y);
  });

  return canvas.toDataURL('image/png');
};
