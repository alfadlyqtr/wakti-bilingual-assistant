// Tab 2 — the plan rasterizer.
//
// ⛔ THIS FUNCTION IS THE HINGE OF THE WHOLE FEATURE.
// The user edits an editable plan document. The image model cannot read that document — it only
// takes a picture. So we redraw the EDITED plan as a clean, unambiguous architect's blueprint and
// hand that to GPT Image 2 as the reference image. The original upload is never sent again once a
// plan has been traced: if it were, every edit the user made would be silently ignored.
//
// Three properties matter and must not be broken:
//   1. CLEAN. No grid, no dimension lines, no selection highlights, no drafting notation. The
//      prompt spends several paragraphs telling the model to ignore notation; the surest fix is to
//      not draw any. What goes out is walls, openings, columns, furniture and room names.
//   2. SAME PROPORTIONS. The canvas keeps the plan's aspect ratio exactly, so the finished render
//      can overlay the plan. That is the promise the prompt makes.
//   3. HIGH CONTRAST. Pure black line work on pure white. Grey, anti-aliased mush reads as
//      texture to an image model and comes back as walls in the wrong place.

import {
  type FloorPlanDoc,
  type PlanFurniture,
  apertureGeometry,
  gapGeometry,
  pointOnWall,
  wallSegmentPoints,
  wallSolidRanges,
  wallThickness,
} from './floorPlanModel';
import { type PlanShape, furnitureById } from './floorPlanFurniture';

/** Long edge of the rasterized blueprint. Enough for the model to resolve a 6px partition wall. */
const RASTER_MAX_EDGE = 1600;

const WALL_COLOUR = '#000000';
const DETAIL_COLOUR = '#111111';
const FURNITURE_COLOUR = '#444444';
const LABEL_COLOUR = '#000000';

type RasterOptions = {
  /** Draw furniture outlines. Turned off for the "furnish it fresh" path. */
  includeFurniture?: boolean;
  /** Draw room name text. The prompt reads these to furnish each room correctly. */
  includeLabels?: boolean;
  /** Restrict output to a single room, for working on one room at a time. */
  onlyRoomId?: string;
};

/** Draws one normalised shape list into a box centred on the origin, already rotated by the caller. */
const drawShapes = (
  context: CanvasRenderingContext2D,
  shapes: PlanShape[],
  width: number,
  depth: number,
): void => {
  const px = (value: number) => -width / 2 + value * width;
  const py = (value: number) => -depth / 2 + value * depth;
  const sx = (value: number) => value * width;
  const sy = (value: number) => value * depth;
  // Radii have to be uniform, so use the smaller axis to avoid overshooting a thin item.
  const sr = (value: number) => value * Math.min(width, depth);

  shapes.forEach((shape) => {
    context.beginPath();
    switch (shape.k) {
      case 'rect': {
        const x = px(shape.x);
        const y = py(shape.y);
        const w = sx(shape.w);
        const h = sy(shape.h);
        const radius = Math.min(sr(shape.r || 0), Math.abs(w) / 2, Math.abs(h) / 2);
        if (radius > 0.5 && typeof context.roundRect === 'function') {
          context.roundRect(x, y, w, h, radius);
        } else {
          context.rect(x, y, w, h);
        }
        break;
      }
      case 'line':
        context.moveTo(px(shape.x1), py(shape.y1));
        context.lineTo(px(shape.x2), py(shape.y2));
        break;
      case 'circle':
        context.arc(px(shape.cx), py(shape.cy), Math.max(0.5, sr(shape.r)), 0, Math.PI * 2);
        break;
      case 'ellipse':
        context.ellipse(px(shape.cx), py(shape.cy), Math.max(0.5, sx(shape.rx)), Math.max(0.5, sy(shape.ry)), 0, 0, Math.PI * 2);
        break;
      case 'arc':
        context.arc(
          px(shape.cx),
          py(shape.cy),
          Math.max(0.5, sr(shape.r)),
          (shape.from * Math.PI) / 180,
          (shape.to * Math.PI) / 180,
        );
        break;
      case 'poly': {
        const points = shape.points;
        for (let index = 0; index + 1 < points.length; index += 2) {
          const x = px(points[index]);
          const y = py(points[index + 1]);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        if (shape.close) context.closePath();
        break;
      }
      default:
        break;
    }

    if ('fill' in shape && shape.fill) context.fill();
    context.stroke();
  });
};

const drawFurniture = (
  context: CanvasRenderingContext2D,
  item: PlanFurniture,
  scale: number,
): void => {
  const symbol = furnitureById(item.symbolId);
  if (!symbol) return;
  context.save();
  context.translate(item.x * scale, item.y * scale);
  context.rotate((item.rotation * Math.PI) / 180);
  context.strokeStyle = FURNITURE_COLOUR;
  context.fillStyle = FURNITURE_COLOUR;
  context.lineWidth = Math.max(1.2, 1.6 * scale);
  context.lineJoin = 'round';
  context.lineCap = 'round';
  drawShapes(context, symbol.shapes, item.width * scale, item.depth * scale);
  context.restore();
};

/**
 * Redraws the edited plan as a clean blueprint and returns it as a PNG data URL.
 *
 * PNG rather than JPEG on purpose: this is line art, and JPEG's ringing around a 6px black line on
 * white is exactly the kind of artefact an image model misreads as a second, fainter wall.
 */
export const rasterizePlan = (plan: FloorPlanDoc, options: RasterOptions = {}): string => {
  const {
    includeFurniture = true,
    includeLabels = true,
    onlyRoomId,
  } = options;

  const scale = Math.min(
    RASTER_MAX_EDGE / Math.max(plan.width, plan.height),
    // Never upscale beyond 2x; it costs payload without adding real detail.
    2,
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(plan.width * scale));
  canvas.height = Math.max(1, Math.round(plan.height * scale));

  const context = canvas.getContext('2d');
  if (!context) return '';

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const s = (value: number) => value * scale;
  const point = (p: { x: number; y: number }) => ({ x: p.x * scale, y: p.y * scale });

  // ---------------------------------------------------------------- walls
  // Only the solid stretches are drawn, so every door and window is a genuine hole in the wall
  // rather than a symbol sitting on top of an unbroken line.
  context.lineCap = 'butt';
  context.lineJoin = 'miter';
  context.strokeStyle = WALL_COLOUR;
  plan.walls.forEach((wall) => {
    const thickness = Math.max(2, s(wallThickness(wall)));
    context.lineWidth = thickness;
    wallSolidRanges(wall, plan.apertures, plan.gaps).forEach((range) => {
      const points = wallSegmentPoints(wall, range.start, range.end).map(point);
      if (points.length < 2) return;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        context.lineTo(points[index].x, points[index].y);
      }
      context.stroke();
    });
  });

  // ---------------------------------------------------------------- doors and windows
  context.strokeStyle = DETAIL_COLOUR;
  context.lineCap = 'butt';
  plan.apertures.forEach((aperture) => {
    const wall = plan.walls.find((item) => item.id === aperture.wallId);
    if (!wall) return;
    const geometry = apertureGeometry(aperture, wall, plan.apertures, plan.gaps);
    if (!geometry) return;

    const start = point(geometry.start);
    const end = point(geometry.end);
    const normal = geometry.normal;
    const jamb = s(geometry.jambDepth);

    // Jambs: a short tick across the wall at each side of the opening, which is what makes an
    // opening read as a built reveal instead of a gap where the wall simply stopped.
    context.lineWidth = Math.max(1.5, s(3));
    ([[start, 1], [end, 1]] as Array<[{ x: number; y: number }, number]>).forEach(([node]) => {
      context.beginPath();
      context.moveTo(node.x - normal.x * jamb, node.y - normal.y * jamb);
      context.lineTo(node.x + normal.x * jamb, node.y + normal.y * jamb);
      context.stroke();
    });

    if (aperture.type === 'window') {
      // Two thin lines across the reveal — the standard window symbol.
      const inset = jamb * 0.45;
      [-inset, inset].forEach((offset) => {
        context.beginPath();
        context.moveTo(start.x + normal.x * offset, start.y + normal.y * offset);
        context.lineTo(end.x + normal.x * offset, end.y + normal.y * offset);
        context.stroke();
      });
      return;
    }

    // Door: the leaf, then its swing arc.
    const hinge = point(geometry.hinge);
    const closed = point(geometry.closed);
    const open = point(geometry.open);

    context.lineWidth = Math.max(1.5, s(3.5));
    context.beginPath();
    context.moveTo(hinge.x, hinge.y);
    context.lineTo(open.x, open.y);
    context.stroke();

    const radius = Math.hypot(open.x - hinge.x, open.y - hinge.y);
    if (radius > 1) {
      const startAngle = Math.atan2(closed.y - hinge.y, closed.x - hinge.x);
      const endAngle = Math.atan2(open.y - hinge.y, open.x - hinge.x);
      context.lineWidth = Math.max(1, s(2));
      context.setLineDash([Math.max(3, s(5)), Math.max(3, s(4))]);
      context.beginPath();
      context.arc(hinge.x, hinge.y, radius, startAngle, endAngle, geometry.arcSweep === 0);
      context.stroke();
      context.setLineDash([]);
    }
  });

  // ---------------------------------------------------------------- plain gaps
  plan.gaps.forEach((gap) => {
    const wall = plan.walls.find((item) => item.id === gap.wallId);
    if (!wall) return;
    const geometry = gapGeometry(gap.wallId, gap.positionRatio, gap.width, wall, plan.apertures, plan.gaps, gap.id);
    if (!geometry) return;
    const start = point(geometry.start);
    const end = point(geometry.end);
    const jamb = s(geometry.jambDepth);
    context.lineWidth = Math.max(1.5, s(3));
    [start, end].forEach((node) => {
      context.beginPath();
      context.moveTo(node.x - geometry.normal.x * jamb, node.y - geometry.normal.y * jamb);
      context.lineTo(node.x + geometry.normal.x * jamb, node.y + geometry.normal.y * jamb);
      context.stroke();
    });
  });

  // ---------------------------------------------------------------- columns and pillars
  context.fillStyle = WALL_COLOUR;
  context.strokeStyle = WALL_COLOUR;
  context.lineWidth = Math.max(1, s(2));
  plan.columns.forEach((column) => {
    const cx = s(column.x);
    const cy = s(column.y);
    const size = Math.max(3, s(column.size));
    context.beginPath();
    if (column.shape === 'round') {
      context.arc(cx, cy, size / 2, 0, Math.PI * 2);
    } else {
      context.rect(cx - size / 2, cy - size / 2, size, size);
    }
    context.fill();
    context.stroke();
  });

  // ---------------------------------------------------------------- furniture
  if (includeFurniture) {
    plan.furniture
      .filter((item) => !onlyRoomId || item.roomId === onlyRoomId)
      .forEach((item) => drawFurniture(context, item, scale));
  }

  // ---------------------------------------------------------------- room names
  // These are the single most valuable thing on the drawing for the prompt, because the whole
  // brief hangs on "furnish each room according to its label".
  if (includeLabels) {
    const fontSize = Math.max(11, Math.round(Math.min(canvas.width, canvas.height) / 42));
    context.font = `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    plan.rooms
      .filter((room) => !onlyRoomId || room.id === onlyRoomId)
      .forEach((room) => {
        const text = room.name.trim().toUpperCase();
        if (!text) return;
        const x = s(room.x);
        const y = s(room.y);
        // Knock a white pad out behind the text so a label sitting over furniture stays legible.
        const metrics = context.measureText(text);
        const padX = fontSize * 0.4;
        const padY = fontSize * 0.32;
        context.fillStyle = '#ffffff';
        context.fillRect(
          x - metrics.width / 2 - padX,
          y - fontSize / 2 - padY,
          metrics.width + padX * 2,
          fontSize + padY * 2,
        );
        context.fillStyle = LABEL_COLOUR;
        context.fillText(text, x, y);
      });
  }

  return canvas.toDataURL('image/png');
};

/**
 * A written inventory of the edited plan, appended to the prompt alongside the rasterized image.
 *
 * The picture carries the geometry; this carries the INTENT. A rectangle with three cushions is
 * unambiguous to a human and merely suggestive to an image model, so naming every piece — "3-seat
 * sofa", "prayer carpet", "treadmill" — is what stops a gym bench coming back as a coffee table.
 */
export const describePlan = (plan: FloorPlanDoc, options: { onlyRoomId?: string } = {}): string => {
  const lines: string[] = [];
  const rooms = plan.rooms.filter((room) => !options.onlyRoomId || room.id === options.onlyRoomId);

  if (rooms.length) {
    lines.push('ROOMS ON THIS PLAN:');
    rooms.forEach((room) => {
      const contents = plan.furniture
        .filter((item) => item.roomId === room.id)
        .map((item) => furnitureById(item.symbolId)?.en)
        .filter((name): name is string => Boolean(name));

      const tally = contents.reduce<Record<string, number>>((accumulator, name) => {
        accumulator[name] = (accumulator[name] || 0) + 1;
        return accumulator;
      }, {});
      const summary = Object.entries(tally)
        .map(([name, count]) => (count > 1 ? `${count} x ${name}` : name))
        .join(', ');

      lines.push(`- ${room.name.toUpperCase()}${summary ? ` — drawn with: ${summary}` : ''}`);
    });
  }

  const unplaced = plan.furniture.filter((item) => !item.roomId);
  if (unplaced.length) {
    const tally = unplaced.reduce<Record<string, number>>((accumulator, item) => {
      const name = furnitureById(item.symbolId)?.en;
      if (name) accumulator[name] = (accumulator[name] || 0) + 1;
      return accumulator;
    }, {});
    const summary = Object.entries(tally)
      .map(([name, count]) => (count > 1 ? `${count} x ${name}` : name))
      .join(', ');
    if (summary) lines.push(`ALSO DRAWN ON THE PLAN: ${summary}`);
  }

  const structural = plan.walls.filter((wall) => wall.type === 'structural').length;
  const partitions = plan.walls.filter((wall) => wall.type === 'partition').length;
  const beams = plan.walls.filter((wall) => wall.type === 'beam').length;
  const doors = plan.apertures.filter((aperture) => aperture.type === 'door').length;
  const windows = plan.apertures.filter((aperture) => aperture.type === 'window').length;

  const counts = [
    structural && `${structural} structural walls`,
    partitions && `${partitions} partition walls`,
    beams && `${beams} beams`,
    plan.columns.length && `${plan.columns.length} columns or pillars`,
    doors && `${doors} doors`,
    windows && `${windows} windows`,
    plan.gaps.length && `${plan.gaps.length} cased openings without doors`,
  ].filter(Boolean).join(', ');

  if (counts) lines.push(`THE PLAN CONTAINS: ${counts}.`);

  return lines.join('\n');
};
