// Tab 2 — the plan editor.
//
// The uploaded blueprint sits underneath as a locked underlay; the editable plan is drawn over it
// in SVG. Everything the user changes here ends up in the rasterized blueprint that the image
// model is given, so this screen is where the render is really decided.
//
// ⛔ MOBILE FIRST. Every interaction is a tap or a drag with a generous invisible hit target,
// because the real user is holding a phone, not driving a mouse. Nothing here needs hover, a
// right-click or a keyboard.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Circle as CircleIcon,
  DoorOpen,
  Eraser,
  Loader2,
  Maximize2,
  Minus,
  MousePointer2,
  Move,
  RectangleHorizontal,
  Redo2,
  RotateCw,
  Ruler,
  Sofa,
  Square,
  Trash2,
  Type,
  Undo2,
  Wand2,
} from 'lucide-react';

import {
  type FloorPlanDoc,
  type PlanWall,
  type Point,
  type WallType,
  apertureGeometry,
  closestRatioOnWall,
  distanceToWall,
  gapGeometry,
  maximumOpeningWidth,
  planId,
  pointOnWall,
  safeOpeningRatio,
  wallLength,
  wallSegmentPath,
  wallSolidRanges,
  wallThickness,
} from './floorPlanModel';
import {
  FURNITURE_CATEGORIES,
  type FurnitureCategory,
  type PlanShape,
  furnitureByCategory,
  furnitureById,
} from './floorPlanFurniture';
import { assignFurnitureToRooms } from './floorPlanTrace';

type Tool =
  | 'select'
  | 'wall'
  | 'partition'
  | 'beam'
  | 'door'
  | 'window'
  | 'gap'
  | 'pillar'
  | 'furniture'
  | 'label'
  | 'erase';

type FloorPlanEditorProps = {
  imageUrl: string;
  plan: FloorPlanDoc;
  onPlanChange: (plan: FloorPlanDoc) => void;
  isArabic: boolean;
  onAutoTrace: () => void;
  isTracing: boolean;
};

type DrawState = { pointerId: number; from: Point; to: Point };
type DragState = {
  pointerId: number;
  kind: 'furniture' | 'column' | 'room' | 'wall-end';
  id: string;
  /** Which end of a wall is being dragged. */
  endpoint?: 'start' | 'end';
  offset: Point;
};

/** Anything closer than this to a wall counts as a tap on that wall. */
const WALL_HIT_RATIO = 0.03;
const CORNER_SNAP_RATIO = 0.02;
const AXIS_SNAP_DEGREES = 7;

export default function FloorPlanEditor({
  imageUrl,
  plan,
  onPlanChange,
  isArabic,
  onAutoTrace,
  isTracing,
}: FloorPlanEditorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [underlayOpacity, setUnderlayOpacity] = useState(0.35);
  const [drawState, setDrawState] = useState<DrawState | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [symbolId, setSymbolId] = useState('sofa-3');
  const [category, setCategory] = useState<FurnitureCategory>('living');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [viewport, setViewport] = useState({ x: 0, y: 0, w: plan.width, h: plan.height });

  // Pinch-to-zoom: track all active pointers and previous pinch state.
  const activePointers = useRef(new Map<number, { clientX: number; clientY: number }>());
  const prevPinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const panPointerRef = useRef<number | null>(null);

  // History lives here rather than in the parent, so the parent only ever holds one plan.
  const [past, setPast] = useState<FloorPlanDoc[]>([]);
  const [future, setFuture] = useState<FloorPlanDoc[]>([]);

  // Reset zoom/pan whenever a new blueprint is loaded (dimensions change).
  useEffect(() => {
    setViewport({ x: 0, y: 0, w: plan.width, h: plan.height });
  }, [plan.width, plan.height]);

  const shortEdge = Math.min(plan.width, plan.height);
  const hitTolerance = Math.max(10, shortEdge * WALL_HIT_RATIO);
  const cornerTolerance = Math.max(6, shortEdge * CORNER_SNAP_RATIO);

  const commit = (next: FloorPlanDoc) => {
    setPast((entries) => [...entries.slice(-40), plan]);
    setFuture([]);
    onPlanChange(next);
  };

  const undo = () => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setPast((entries) => entries.slice(0, -1));
    setFuture((entries) => [plan, ...entries].slice(0, 40));
    setSelectedId(null);
    onPlanChange(previous);
  };

  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setFuture((entries) => entries.slice(1));
    setPast((entries) => [...entries.slice(-40), plan]);
    setSelectedId(null);
    onPlanChange(next);
  };

  // ------------------------------------------------------------------ coordinates
  /** Screen point to plan point. Uses the rendered box, so it survives any zoom or layout. */
  const toPlanPoint = (event: React.PointerEvent): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: viewport.x + ((event.clientX - rect.left) / rect.width) * viewport.w,
      y: viewport.y + ((event.clientY - rect.top) / rect.height) * viewport.h,
    };
  };

  /** Snaps to an existing corner first, because joined walls matter more than square walls. */
  const snapPoint = (point: Point, anchor?: Point): Point => {
    let best: Point | null = null;
    let bestDistance = cornerTolerance;
    plan.walls.forEach((wall) => {
      ([{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }] as Point[]).forEach((corner) => {
        const distance = Math.hypot(point.x - corner.x, point.y - corner.y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = corner;
        }
      });
    });
    if (best) return best;

    if (anchor) {
      // Nudge a nearly-square run onto exactly square, which is what the user meant.
      const dx = point.x - anchor.x;
      const dy = point.y - anchor.y;
      const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
      const offHorizontal = Math.min(angle, Math.abs(180 - angle));
      const offVertical = Math.abs(90 - angle);
      if (offHorizontal <= AXIS_SNAP_DEGREES && offHorizontal <= offVertical) return { x: point.x, y: anchor.y };
      if (offVertical <= AXIS_SNAP_DEGREES) return { x: anchor.x, y: point.y };
    }
    return point;
  };

  const wallAt = (point: Point): PlanWall | null => {
    let best: PlanWall | null = null;
    let bestDistance = hitTolerance;
    plan.walls.forEach((wall) => {
      const distance = distanceToWall(wall, point);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = wall;
      }
    });
    return best;
  };

  const metresToPixels = (metres: number): number => {
    const perMetre = plan.unit === 'ft' ? 3.28084 : 1;
    return metres * perMetre * plan.scalePixelsPerUnit;
  };

  // ------------------------------------------------------------------ element actions
  const addOpening = (point: Point, kind: 'door' | 'window' | 'gap') => {
    const wall = wallAt(point);
    if (!wall) return;
    const ratio = closestRatioOnWall(wall, point);
    const defaultWidth = kind === 'window' ? metresToPixels(1.2) : metresToPixels(0.9);
    const available = maximumOpeningWidth(wall, ratio, plan.apertures, plan.gaps);
    const width = Math.min(defaultWidth, available, wallLength(wall) * 0.8);
    if (width < 4) return;
    const safeRatio = safeOpeningRatio(wall, ratio, width, plan.apertures, plan.gaps);

    if (kind === 'gap') {
      const gap = { id: planId('gap'), wallId: wall.id, positionRatio: safeRatio, width };
      commit({ ...plan, gaps: [...plan.gaps, gap] });
      setSelectedId(gap.id);
      return;
    }

    const aperture = {
      id: planId(kind),
      wallId: wall.id,
      type: kind,
      positionRatio: safeRatio,
      width,
      ...(kind === 'door' ? { hinge: 'start' as const, swing: 'right' as const } : {}),
    };
    commit({ ...plan, apertures: [...plan.apertures, aperture] });
    setSelectedId(aperture.id);
  };

  const deleteById = (id: string) => {
    // Removing a wall must take its openings with it, or they become orphans that never draw.
    if (plan.walls.some((wall) => wall.id === id)) {
      commit({
        ...plan,
        walls: plan.walls.filter((wall) => wall.id !== id),
        apertures: plan.apertures.filter((aperture) => aperture.wallId !== id),
        gaps: plan.gaps.filter((gap) => gap.wallId !== id),
      });
    } else {
      commit({
        ...plan,
        apertures: plan.apertures.filter((item) => item.id !== id),
        gaps: plan.gaps.filter((item) => item.id !== id),
        columns: plan.columns.filter((item) => item.id !== id),
        furniture: plan.furniture.filter((item) => item.id !== id),
        rooms: plan.rooms.filter((item) => item.id !== id),
      });
    }
    setSelectedId(null);
  };

  /** Topmost element under a point. Small things are tested first so they stay reachable. */
  const elementAt = (point: Point): { id: string; kind: DragState['kind'] } | null => {
    const furniture = [...plan.furniture].reverse().find((item) => {
      const half = Math.max(item.width, item.depth) / 2;
      return Math.abs(point.x - item.x) <= half && Math.abs(point.y - item.y) <= half;
    });
    if (furniture) return { id: furniture.id, kind: 'furniture' };

    const column = plan.columns.find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= Math.max(item.size, hitTolerance));
    if (column) return { id: column.id, kind: 'column' };

    const room = plan.rooms.find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= hitTolerance * 1.4);
    if (room) return { id: room.id, kind: 'room' };

    return null;
  };

  // ------------------------------------------------------------------ pointer handling
  const handlePointerDown = (event: React.PointerEvent) => {
    activePointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (activePointers.current.size >= 2) {
      // Second finger arrived — cancel any draw/drag/pan and switch to pinch mode.
      setDrawState(null);
      setDragState(null);
      panPointerRef.current = null;
      prevPinchRef.current = null;
      return;
    }
    if (isTracing) return;
    const raw = toPlanPoint(event);

    if (tool === 'select' || tool === 'erase') {
      const hit = elementAt(raw);
      if (hit) {
        if (tool === 'erase') {
          deleteById(hit.id);
          return;
        }
        setSelectedId(hit.id);
        const source = hit.kind === 'furniture'
          ? plan.furniture.find((item) => item.id === hit.id)
          : hit.kind === 'column'
            ? plan.columns.find((item) => item.id === hit.id)
            : plan.rooms.find((item) => item.id === hit.id);
        if (source) {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragState({
            pointerId: event.pointerId,
            kind: hit.kind,
            id: hit.id,
            offset: { x: raw.x - source.x, y: raw.y - source.y },
          });
        }
        return;
      }

      const wall = wallAt(raw);
      if (wall) {
        if (tool === 'erase') deleteById(wall.id);
        else setSelectedId(wall.id);
        return;
      }
      setSelectedId(null);
      if (tool === 'select') {
        // Tap on empty canvas in select mode — start a single-finger pan.
        event.currentTarget.setPointerCapture(event.pointerId);
        panPointerRef.current = event.pointerId;
      }
      return;
    }

    if (tool === 'wall' || tool === 'partition' || tool === 'beam') {
      const from = snapPoint(raw);
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrawState({ pointerId: event.pointerId, from, to: from });
      return;
    }

    if (tool === 'door' || tool === 'window' || tool === 'gap') {
      addOpening(raw, tool);
      return;
    }

    if (tool === 'pillar') {
      const column = {
        id: planId('column'),
        x: raw.x,
        y: raw.y,
        size: metresToPixels(0.4),
        shape: 'square' as const,
      };
      commit({ ...plan, columns: [...plan.columns, column] });
      setSelectedId(column.id);
      return;
    }

    if (tool === 'furniture') {
      const symbol = furnitureById(symbolId);
      if (!symbol) return;
      const item = {
        id: planId('item'),
        symbolId,
        x: raw.x,
        y: raw.y,
        width: metresToPixels(symbol.widthM),
        depth: metresToPixels(symbol.depthM),
        rotation: 0,
      };
      commit({ ...plan, furniture: assignFurnitureToRooms([...plan.furniture, item], plan.rooms) });
      setSelectedId(item.id);
      return;
    }

    if (tool === 'label') {
      const room = { id: planId('room'), name: isArabic ? 'غرفة' : 'ROOM', x: raw.x, y: raw.y };
      commit({ ...plan, rooms: [...plan.rooms, room] });
      setSelectedId(room.id);
      setRenamingId(room.id);
      setRenameDraft(room.name);
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const prevPos = activePointers.current.get(event.pointerId);
    activePointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });

    if (activePointers.current.size >= 2) {
      const pts = Array.from(activePointers.current.values());
      if (pts.length < 2) return;
      const [p1, p2] = pts;
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const currentDist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      const midX = (p1.clientX + p2.clientX) / 2;
      const midY = (p1.clientY + p2.clientY) / 2;
      if (prevPinchRef.current) {
        const { dist: prevDist, midX: prevMidX, midY: prevMidY } = prevPinchRef.current;
        const fracPrevX = (prevMidX - rect.left) / rect.width;
        const fracPrevY = (prevMidY - rect.top) / rect.height;
        const fracCurX = (midX - rect.left) / rect.width;
        const fracCurY = (midY - rect.top) / rect.height;
        const scaleRatio = prevDist / Math.max(1, currentDist);
        setViewport((vp) => {
          const anchorX = vp.x + fracPrevX * vp.w;
          const anchorY = vp.y + fracPrevY * vp.h;
          const newW = Math.min(plan.width * 1.5, Math.max(plan.width * 0.05, vp.w * scaleRatio));
          const newH = Math.min(plan.height * 1.5, Math.max(plan.height * 0.05, vp.h * scaleRatio));
          return { x: anchorX - fracCurX * newW, y: anchorY - fracCurY * newH, w: newW, h: newH };
        });
      }
      prevPinchRef.current = { dist: currentDist, midX, midY };
      return;
    }

    if (panPointerRef.current === event.pointerId && prevPos) {
      const dx = event.clientX - prevPos.clientX;
      const dy = event.clientY - prevPos.clientY;
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect && rect.width && rect.height) {
        setViewport((vp) => ({
          ...vp,
          x: vp.x - (dx / rect.width) * vp.w,
          y: vp.y - (dy / rect.height) * vp.h,
        }));
      }
      return;
    }

    if (drawState && drawState.pointerId === event.pointerId) {
      const raw = toPlanPoint(event);
      setDrawState({ ...drawState, to: snapPoint(raw, drawState.from) });
      return;
    }
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const raw = toPlanPoint(event);
    const x = raw.x - dragState.offset.x;
    const y = raw.y - dragState.offset.y;

    // Dragging writes straight through without touching history, so a single drag is one undo
    // step rather than a hundred.
    if (dragState.kind === 'furniture') {
      onPlanChange({
        ...plan,
        furniture: plan.furniture.map((item) => (item.id === dragState.id ? { ...item, x, y } : item)),
      });
    } else if (dragState.kind === 'column') {
      onPlanChange({
        ...plan,
        columns: plan.columns.map((item) => (item.id === dragState.id ? { ...item, x, y } : item)),
      });
    } else if (dragState.kind === 'room') {
      onPlanChange({
        ...plan,
        rooms: plan.rooms.map((item) => (item.id === dragState.id ? { ...item, x, y } : item)),
      });
    } else if (dragState.kind === 'wall-end') {
      const snapped = snapPoint({ x: raw.x, y: raw.y });
      onPlanChange({
        ...plan,
        walls: plan.walls.map((wall) => {
          if (wall.id !== dragState.id) return wall;
          return dragState.endpoint === 'start'
            ? { ...wall, x1: snapped.x, y1: snapped.y }
            : { ...wall, x2: snapped.x, y2: snapped.y };
        }),
      });
    }
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    activePointers.current.delete(event.pointerId);
    if (activePointers.current.size < 2) prevPinchRef.current = null;
    if (panPointerRef.current === event.pointerId) panPointerRef.current = null;
    if (drawState && drawState.pointerId === event.pointerId) {
      const { from, to } = drawState;
      setDrawState(null);
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      // Ignore an accidental tap; a wall shorter than this is never intentional.
      if (length < Math.max(8, shortEdge * 0.015)) return;
      const type: WallType = tool === 'beam' ? 'beam' : tool === 'partition' ? 'partition' : 'structural';
      const wall: PlanWall = { id: planId('wall'), x1: from.x, y1: from.y, x2: to.x, y2: to.y, type };
      commit({ ...plan, walls: [...plan.walls, wall] });
      setSelectedId(wall.id);
      return;
    }

    if (dragState && dragState.pointerId === event.pointerId) {
      setDragState(null);
      // Bank one history entry for the whole gesture, and refresh room grouping since an item
      // may have been dragged into a different room.
      setPast((entries) => [...entries.slice(-40), plan]);
      setFuture([]);
      onPlanChange({ ...plan, furniture: assignFurnitureToRooms(plan.furniture, plan.rooms) });
    }
  };

  const beginWallEndDrag = (event: React.PointerEvent, wall: PlanWall, endpoint: 'start' | 'end') => {
    if (tool !== 'select' || isTracing) return;
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    setSelectedId(wall.id);
    setDragState({ pointerId: event.pointerId, kind: 'wall-end', id: wall.id, endpoint, offset: { x: 0, y: 0 } });
  };

  // ------------------------------------------------------------------ selection helpers
  const selectedWall = plan.walls.find((item) => item.id === selectedId) || null;
  const selectedAperture = plan.apertures.find((item) => item.id === selectedId) || null;
  const selectedGap = plan.gaps.find((item) => item.id === selectedId) || null;
  const selectedColumn = plan.columns.find((item) => item.id === selectedId) || null;
  const selectedFurniture = plan.furniture.find((item) => item.id === selectedId) || null;
  const selectedRoom = plan.rooms.find((item) => item.id === selectedId) || null;

  const updateFurniture = (changes: Partial<{ rotation: number; width: number; depth: number }>) => {
    if (!selectedFurniture) return;
    commit({
      ...plan,
      furniture: plan.furniture.map((item) => (item.id === selectedFurniture.id ? { ...item, ...changes } : item)),
    });
  };

  const scaleFurniture = (factor: number) => {
    if (!selectedFurniture) return;
    updateFurniture({
      width: Math.max(8, selectedFurniture.width * factor),
      depth: Math.max(8, selectedFurniture.depth * factor),
    });
  };

  const resizeOpening = (factor: number) => {
    if (selectedAperture) {
      const wall = plan.walls.find((item) => item.id === selectedAperture.wallId);
      if (!wall) return;
      const maximum = maximumOpeningWidth(wall, selectedAperture.positionRatio, plan.apertures, plan.gaps, selectedAperture.id);
      const width = Math.max(6, Math.min(maximum, selectedAperture.width * factor));
      commit({
        ...plan,
        apertures: plan.apertures.map((item) => (item.id === selectedAperture.id ? { ...item, width } : item)),
      });
      return;
    }
    if (selectedGap) {
      const wall = plan.walls.find((item) => item.id === selectedGap.wallId);
      if (!wall) return;
      const maximum = maximumOpeningWidth(wall, selectedGap.positionRatio, plan.apertures, plan.gaps, selectedGap.id);
      const width = Math.max(6, Math.min(maximum, selectedGap.width * factor));
      commit({ ...plan, gaps: plan.gaps.map((item) => (item.id === selectedGap.id ? { ...item, width } : item)) });
    }
  };

  const flipSwing = () => {
    if (!selectedAperture || selectedAperture.type !== 'door') return;
    commit({
      ...plan,
      apertures: plan.apertures.map((item) => (
        item.id === selectedAperture.id
          ? {
            ...item,
            // Cycling hinge and swing together walks all four possible door orientations.
            swing: item.swing === 'left' ? 'right' : 'left',
            hinge: item.swing === 'left' ? item.hinge : (item.hinge === 'end' ? 'start' : 'end'),
          }
          : item
      )),
    });
  };

  const applyRename = () => {
    if (!renamingId) return;
    const name = renameDraft.trim().slice(0, 40);
    if (name) {
      commit({ ...plan, rooms: plan.rooms.map((room) => (room.id === renamingId ? { ...room, name } : room)) });
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  // ------------------------------------------------------------------ shape drawing
  const shapeElements = (shapes: PlanShape[], width: number, depth: number): React.ReactNode[] => {
    const px = (value: number) => -width / 2 + value * width;
    const py = (value: number) => -depth / 2 + value * depth;
    const sx = (value: number) => value * width;
    const sy = (value: number) => value * depth;
    const sr = (value: number) => value * Math.min(width, depth);

    return shapes.map((shape, index) => {
      const key = `shape-${index}`;
      const fill = 'fill' in shape && shape.fill ? 'currentColor' : 'none';
      switch (shape.k) {
        case 'rect':
          return (
            <rect
              key={key}
              x={px(shape.x)}
              y={py(shape.y)}
              width={Math.max(0, sx(shape.w))}
              height={Math.max(0, sy(shape.h))}
              rx={sr(shape.r || 0)}
              fill={fill}
            />
          );
        case 'line':
          return <line key={key} x1={px(shape.x1)} y1={py(shape.y1)} x2={px(shape.x2)} y2={py(shape.y2)} />;
        case 'circle':
          return <circle key={key} cx={px(shape.cx)} cy={py(shape.cy)} r={Math.max(0.5, sr(shape.r))} fill={fill} />;
        case 'ellipse':
          return (
            <ellipse
              key={key}
              cx={px(shape.cx)}
              cy={py(shape.cy)}
              rx={Math.max(0.5, sx(shape.rx))}
              ry={Math.max(0.5, sy(shape.ry))}
              fill={fill}
            />
          );
        case 'arc': {
          const radius = Math.max(0.5, sr(shape.r));
          const from = (shape.from * Math.PI) / 180;
          const to = (shape.to * Math.PI) / 180;
          const cx = px(shape.cx);
          const cy = py(shape.cy);
          const largeArc = Math.abs(shape.to - shape.from) > 180 ? 1 : 0;
          return (
            <path
              key={key}
              d={`M ${cx + radius * Math.cos(from)} ${cy + radius * Math.sin(from)} A ${radius} ${radius} 0 ${largeArc} 1 ${cx + radius * Math.cos(to)} ${cy + radius * Math.sin(to)}`}
              fill="none"
            />
          );
        }
        case 'poly': {
          const points = shape.points;
          const parts: string[] = [];
          for (let i = 0; i + 1 < points.length; i += 2) {
            parts.push(`${i === 0 ? 'M' : 'L'} ${px(points[i])} ${py(points[i + 1])}`);
          }
          if (shape.close) parts.push('Z');
          return <path key={key} d={parts.join(' ')} fill={fill} />;
        }
        default:
          return null;
      }
    });
  };

  const tools: Array<{ id: Tool; icon: typeof Minus; en: string; ar: string }> = useMemo(() => ([
    { id: 'select', icon: MousePointer2, en: 'Select', ar: 'تحديد' },
    { id: 'wall', icon: Minus, en: 'Wall', ar: 'جدار' },
    { id: 'partition', icon: Minus, en: 'Partition', ar: 'قاطع' },
    { id: 'beam', icon: Ruler, en: 'Beam', ar: 'كمرة' },
    { id: 'door', icon: DoorOpen, en: 'Door', ar: 'باب' },
    { id: 'window', icon: RectangleHorizontal, en: 'Window', ar: 'نافذة' },
    { id: 'gap', icon: Move, en: 'Opening', ar: 'فتحة' },
    { id: 'pillar', icon: Square, en: 'Pillar', ar: 'عمود' },
    { id: 'furniture', icon: Sofa, en: 'Furniture', ar: 'أثاث' },
    { id: 'label', icon: Type, en: 'Room name', ar: 'اسم غرفة' },
    { id: 'erase', icon: Eraser, en: 'Erase', ar: 'مسح' },
  ]), []);

  const strokeFor = (wall: PlanWall): string => {
    if (selectedId === wall.id) return '#0ea5e9';
    if (wall.type === 'beam') return '#a855f7';
    if (wall.type === 'partition') return '#475569';
    return '#0f172a';
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#c9dff5] bg-white dark:border-sky-300/20 dark:bg-black/30">
      {/* ------------------------------------------------------------ toolbar */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-[#d9e7f5] bg-[#f7fbff] p-2 dark:border-sky-300/15 dark:bg-black/20">
        {tools.map((entry) => {
          const Icon = entry.icon;
          const active = tool === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setTool(entry.id);
                setSelectedId(null);
              }}
              className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[9px] font-bold transition active:scale-95 ${
                active
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'bg-white text-[#40506a] dark:bg-white/10 dark:text-foreground/80'
              }`}
            >
              <Icon className={`h-4 w-4 ${entry.id === 'partition' ? 'scale-x-75' : ''}`} />
              {isArabic ? entry.ar : entry.en}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------ canvas */}
      <div className="relative bg-[#fbfdff] dark:bg-[#05080f]">
        <svg
          ref={svgRef}
          viewBox={`${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`}
          className="block w-full touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <image href={imageUrl} x={0} y={0} width={plan.width} height={plan.height} opacity={underlayOpacity} />

          {/* walls, drawn only where they are solid so openings read as real holes */}
          {plan.walls.map((wall) => (
            <g key={wall.id}>
              {wallSolidRanges(wall, plan.apertures, plan.gaps).map((range, index) => (
                <path
                  key={`${wall.id}-${index}`}
                  d={wallSegmentPath(wall, range.start, range.end)}
                  fill="none"
                  stroke={strokeFor(wall)}
                  strokeWidth={wallThickness(wall)}
                  strokeLinecap="butt"
                  // A beam / dropped soffit is drawn dashed by convention. It also stops a beam
                  // reading as a UI slider, which the solid bar plus white centre stripe did.
                  strokeDasharray={wall.type === 'beam' ? '14 9' : undefined}
                />
              ))}
            </g>
          ))}

          {/* doors and windows */}
          {plan.apertures.map((aperture) => {
            const wall = plan.walls.find((item) => item.id === aperture.wallId);
            if (!wall) return null;
            const geometry = apertureGeometry(aperture, wall, plan.apertures, plan.gaps);
            if (!geometry) return null;
            const colour = selectedId === aperture.id ? '#0ea5e9' : '#0f77a6';
            const jamb = geometry.jambDepth;
            return (
              <g key={aperture.id} onPointerDown={(event) => { event.stopPropagation(); setSelectedId(aperture.id); }}>
                {[geometry.start, geometry.end].map((node, index) => (
                  <line
                    key={index}
                    x1={node.x - geometry.normal.x * jamb}
                    y1={node.y - geometry.normal.y * jamb}
                    x2={node.x + geometry.normal.x * jamb}
                    y2={node.y + geometry.normal.y * jamb}
                    stroke={colour}
                    strokeWidth={3}
                  />
                ))}
                {aperture.type === 'window' ? (
                  [-jamb * 0.45, jamb * 0.45].map((offset, index) => (
                    <line
                      key={index}
                      x1={geometry.start.x + geometry.normal.x * offset}
                      y1={geometry.start.y + geometry.normal.y * offset}
                      x2={geometry.end.x + geometry.normal.x * offset}
                      y2={geometry.end.y + geometry.normal.y * offset}
                      stroke={colour}
                      strokeWidth={2}
                    />
                  ))
                ) : (
                  <>
                    <line
                      x1={geometry.hinge.x}
                      y1={geometry.hinge.y}
                      x2={geometry.open.x}
                      y2={geometry.open.y}
                      stroke={colour}
                      strokeWidth={4}
                      strokeLinecap="round"
                    />
                    <path
                      d={`M ${geometry.closed.x} ${geometry.closed.y} A ${geometry.width} ${geometry.width} 0 0 ${geometry.arcSweep} ${geometry.open.x} ${geometry.open.y}`}
                      fill="none"
                      stroke={colour}
                      strokeWidth={2}
                      strokeDasharray="6 5"
                    />
                  </>
                )}
                {/* generous invisible target, because these are small on a phone */}
                <line
                  x1={geometry.start.x}
                  y1={geometry.start.y}
                  x2={geometry.end.x}
                  y2={geometry.end.y}
                  stroke="transparent"
                  strokeWidth={Math.max(24, hitTolerance * 2)}
                />
              </g>
            );
          })}

          {/* cased openings */}
          {plan.gaps.map((gap) => {
            const wall = plan.walls.find((item) => item.id === gap.wallId);
            if (!wall) return null;
            const geometry = gapGeometry(gap.wallId, gap.positionRatio, gap.width, wall, plan.apertures, plan.gaps, gap.id);
            if (!geometry) return null;
            const colour = selectedId === gap.id ? '#0ea5e9' : '#64748b';
            return (
              <g key={gap.id} onPointerDown={(event) => { event.stopPropagation(); setSelectedId(gap.id); }}>
                {[geometry.start, geometry.end].map((node, index) => (
                  <line
                    key={index}
                    x1={node.x - geometry.normal.x * geometry.jambDepth}
                    y1={node.y - geometry.normal.y * geometry.jambDepth}
                    x2={node.x + geometry.normal.x * geometry.jambDepth}
                    y2={node.y + geometry.normal.y * geometry.jambDepth}
                    stroke={colour}
                    strokeWidth={3}
                  />
                ))}
                <line
                  x1={geometry.start.x}
                  y1={geometry.start.y}
                  x2={geometry.end.x}
                  y2={geometry.end.y}
                  stroke="transparent"
                  strokeWidth={Math.max(24, hitTolerance * 2)}
                />
              </g>
            );
          })}

          {/* columns */}
          {plan.columns.map((column) => (
            column.shape === 'round' ? (
              <circle
                key={column.id}
                cx={column.x}
                cy={column.y}
                r={column.size / 2}
                fill={selectedId === column.id ? '#0ea5e9' : '#0f172a'}
              />
            ) : (
              <rect
                key={column.id}
                x={column.x - column.size / 2}
                y={column.y - column.size / 2}
                width={column.size}
                height={column.size}
                fill={selectedId === column.id ? '#0ea5e9' : '#0f172a'}
              />
            )
          ))}

          {/* furniture */}
          {plan.furniture.map((item) => (
            <g
              key={item.id}
              transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
              stroke={selectedId === item.id ? '#0ea5e9' : '#475569'}
              strokeWidth={Math.max(1.5, shortEdge * 0.0022)}
              fill="none"
              strokeLinejoin="round"
              color={selectedId === item.id ? '#0ea5e9' : '#475569'}
            >
              {shapeElements(furnitureById(item.symbolId)?.shapes || [], item.width, item.depth)}
              <rect
                x={-item.width / 2}
                y={-item.depth / 2}
                width={item.width}
                height={item.depth}
                fill="transparent"
                stroke="none"
              />
            </g>
          ))}

          {/* wall endpoint handles, shown only when a wall is selected so the plan stays readable */}
          {selectedWall && ([
            { endpoint: 'start' as const, point: { x: selectedWall.x1, y: selectedWall.y1 } },
            { endpoint: 'end' as const, point: { x: selectedWall.x2, y: selectedWall.y2 } },
          ]).map(({ endpoint, point }) => (
            <g key={endpoint}>
              <circle
                cx={point.x}
                cy={point.y}
                r={Math.max(18, hitTolerance)}
                fill="transparent"
                onPointerDown={(event) => beginWallEndDrag(event, selectedWall, endpoint)}
              />
              <circle cx={point.x} cy={point.y} r={Math.max(6, shortEdge * 0.011)} fill="#ffffff" stroke="#0ea5e9" strokeWidth={3} />
            </g>
          ))}

          {/* room names */}
          {plan.rooms.map((room) => (
            <g key={room.id} onPointerDown={(event) => { event.stopPropagation(); if (tool === 'erase') deleteById(room.id); else setSelectedId(room.id); }}>
              <text
                x={room.x}
                y={room.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={Math.max(11, shortEdge * 0.028)}
                fontWeight={700}
                fill={selectedId === room.id ? '#0ea5e9' : '#0f172a'}
                stroke="#ffffff"
                strokeWidth={Math.max(2, shortEdge * 0.006)}
                paintOrder="stroke"
              >
                {room.name.toUpperCase()}
              </text>
            </g>
          ))}

          {/* live preview of the wall being drawn */}
          {drawState && (
            <line
              x1={drawState.from.x}
              y1={drawState.from.y}
              x2={drawState.to.x}
              y2={drawState.to.y}
              stroke="#0ea5e9"
              strokeWidth={tool === 'beam' ? 16 : tool === 'partition' ? 6 : 12}
              strokeOpacity={0.65}
              strokeLinecap="butt"
            />
          )}
        </svg>

        {/* ---- zoom controls */}
        <div className="absolute bottom-2 right-2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setViewport((vp) => {
              const cx = vp.x + vp.w / 2;
              const cy = vp.y + vp.h / 2;
              const newW = Math.max(plan.width * 0.05, vp.w * 0.7);
              const newH = Math.max(plan.height * 0.05, vp.h * 0.7);
              return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
            })}
            aria-label="Zoom in"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-sm font-bold text-[#40506a] shadow transition active:scale-95 dark:bg-white/15 dark:text-foreground/80"
          >+</button>
          <button
            type="button"
            onClick={() => setViewport((vp) => {
              const cx = vp.x + vp.w / 2;
              const cy = vp.y + vp.h / 2;
              const newW = Math.min(plan.width * 1.5, vp.w * 1.43);
              const newH = Math.min(plan.height * 1.5, vp.h * 1.43);
              return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
            })}
            aria-label="Zoom out"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-sm font-bold text-[#40506a] shadow transition active:scale-95 dark:bg-white/15 dark:text-foreground/80"
          >−</button>
          <button
            type="button"
            onClick={() => setViewport({ x: 0, y: 0, w: plan.width, h: plan.height })}
            aria-label={isArabic ? 'ملاءمة' : 'Fit'}
            title={isArabic ? 'ملاءمة' : 'Fit'}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 shadow transition active:scale-95 dark:bg-white/15"
          >
            <Maximize2 className="h-3.5 w-3.5 text-[#40506a] dark:text-foreground/80" />
          </button>
        </div>

        {isTracing && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-white/80 backdrop-blur-sm dark:bg-black/70">
            <Loader2 className="h-7 w-7 animate-spin text-sky-500" />
            <p className="px-6 text-center text-[11px] font-bold text-[#40506a] dark:text-foreground/80">
              {isArabic ? 'جارٍ تتبّع المخطط…' : 'Tracing your plan…'}
            </p>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ contextual actions */}
      {(selectedFurniture || selectedAperture || selectedGap || selectedColumn || selectedWall || selectedRoom) && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[#d9e7f5] bg-[#f2f8ff] p-2 dark:border-sky-300/15 dark:bg-black/30">
          {selectedFurniture && (
            <>
              <ActionButton onClick={() => updateFurniture({ rotation: selectedFurniture.rotation - 15 })} label={isArabic ? 'تدوير يسار' : 'Rotate left'}>
                <RotateCw className="h-3.5 w-3.5 -scale-x-100" />
              </ActionButton>
              <ActionButton onClick={() => updateFurniture({ rotation: selectedFurniture.rotation + 15 })} label={isArabic ? 'تدوير يمين' : 'Rotate right'}>
                <RotateCw className="h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton onClick={() => scaleFurniture(1.12)} label={isArabic ? 'أكبر' : 'Bigger'}>+</ActionButton>
              <ActionButton onClick={() => scaleFurniture(0.89)} label={isArabic ? 'أصغر' : 'Smaller'}>−</ActionButton>
            </>
          )}

          {(selectedAperture || selectedGap) && (
            <>
              <ActionButton onClick={() => resizeOpening(1.12)} label={isArabic ? 'أوسع' : 'Wider'}>+</ActionButton>
              <ActionButton onClick={() => resizeOpening(0.89)} label={isArabic ? 'أضيق' : 'Narrower'}>−</ActionButton>
              {selectedAperture?.type === 'door' && (
                <ActionButton onClick={flipSwing} label={isArabic ? 'اتجاه الفتح' : 'Flip swing'}>
                  <DoorOpen className="h-3.5 w-3.5" />
                </ActionButton>
              )}
            </>
          )}

          {selectedColumn && (
            <>
              <ActionButton
                onClick={() => commit({
                  ...plan,
                  columns: plan.columns.map((item) => (
                    item.id === selectedColumn.id ? { ...item, shape: item.shape === 'round' ? 'square' : 'round' } : item
                  )),
                })}
                label={isArabic ? 'الشكل' : 'Shape'}
              >
                <CircleIcon className="h-3.5 w-3.5" />
              </ActionButton>
              <ActionButton
                onClick={() => commit({
                  ...plan,
                  columns: plan.columns.map((item) => (item.id === selectedColumn.id ? { ...item, size: item.size * 1.15 } : item)),
                })}
                label={isArabic ? 'أكبر' : 'Bigger'}
              >
                +
              </ActionButton>
              <ActionButton
                onClick={() => commit({
                  ...plan,
                  columns: plan.columns.map((item) => (item.id === selectedColumn.id ? { ...item, size: Math.max(4, item.size * 0.87) } : item)),
                })}
                label={isArabic ? 'أصغر' : 'Smaller'}
              >
                −
              </ActionButton>
            </>
          )}

          {selectedWall && (
            <>
              {(['structural', 'partition', 'beam'] as WallType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => commit({
                    ...plan,
                    walls: plan.walls.map((item) => (item.id === selectedWall.id ? { ...item, type } : item)),
                  })}
                  className={`rounded-lg px-2 py-1 text-[10px] font-bold transition active:scale-95 ${
                    selectedWall.type === type ? 'bg-sky-500 text-white' : 'bg-white text-[#40506a] dark:bg-white/10 dark:text-foreground/80'
                  }`}
                >
                  {type === 'structural' ? (isArabic ? 'حامل' : 'Structural') : type === 'partition' ? (isArabic ? 'قاطع' : 'Partition') : (isArabic ? 'كمرة' : 'Beam')}
                </button>
              ))}
            </>
          )}

          {selectedRoom && (
            <ActionButton
              onClick={() => { setRenamingId(selectedRoom.id); setRenameDraft(selectedRoom.name); }}
              label={isArabic ? 'إعادة تسمية' : 'Rename'}
            >
              <Type className="h-3.5 w-3.5" />
            </ActionButton>
          )}

          <ActionButton onClick={() => selectedId && deleteById(selectedId)} label={isArabic ? 'حذف' : 'Delete'} danger>
            <Trash2 className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      )}

      {/* ------------------------------------------------------------ furniture picker */}
      {tool === 'furniture' && (
        <div className="border-t border-[#d9e7f5] bg-white p-2 dark:border-sky-300/15 dark:bg-black/20">
          <div className="mb-2 flex gap-1.5 overflow-x-auto">
            {FURNITURE_CATEGORIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCategory(entry.id)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold transition active:scale-95 ${
                  category === entry.id ? 'bg-sky-500 text-white' : 'bg-[#f2f8ff] text-[#40506a] dark:bg-white/10 dark:text-foreground/80'
                }`}
              >
                {isArabic ? entry.ar : entry.en}
              </button>
            ))}
          </div>
          <div className="grid max-h-40 grid-cols-4 gap-1.5 overflow-y-auto">
            {furnitureByCategory(category).map((symbol) => (
              <button
                key={symbol.id}
                type="button"
                onClick={() => setSymbolId(symbol.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 transition active:scale-95 ${
                  symbolId === symbol.id
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/15'
                    : 'border-[#dbe9f8] bg-white dark:border-white/10 dark:bg-white/5'
                }`}
              >
                <svg viewBox="-55 -55 110 110" className="h-9 w-9 text-[#40506a] dark:text-foreground/80">
                  <g stroke="currentColor" strokeWidth={3} fill="none" strokeLinejoin="round" color="currentColor">
                    {shapeElements(symbol.shapes, 100, 100)}
                  </g>
                </svg>
                <span className="line-clamp-1 text-[8px] font-bold text-[#40506a] dark:text-foreground/70">
                  {isArabic ? symbol.ar : symbol.en}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ footer */}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#d9e7f5] bg-[#f7fbff] p-2 dark:border-sky-300/15 dark:bg-black/20">
        <ActionButton onClick={undo} label={isArabic ? 'تراجع' : 'Undo'} disabled={!past.length}>
          <Undo2 className="h-3.5 w-3.5" />
        </ActionButton>
        <ActionButton onClick={redo} label={isArabic ? 'إعادة' : 'Redo'} disabled={!future.length}>
          <Redo2 className="h-3.5 w-3.5" />
        </ActionButton>

        <button
          type="button"
          onClick={onAutoTrace}
          disabled={isTracing}
          className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-2.5 py-1.5 text-[10px] font-bold text-white transition active:scale-95 disabled:opacity-60"
        >
          {isTracing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {isArabic ? 'تتبّع تلقائي' : 'Auto-trace'}
        </button>

        <label className="ms-auto flex items-center gap-1.5 text-[9px] font-bold text-[#40506a] dark:text-foreground/70">
          {isArabic ? 'المخطط الأصلي' : 'Underlay'}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(underlayOpacity * 100)}
            onChange={(event) => setUnderlayOpacity(Number(event.target.value) / 100)}
            className="w-20 accent-sky-500"
          />
        </label>
      </div>

      {/* ------------------------------------------------------------ rename */}
      {renamingId && (
        <div className="flex items-center gap-1.5 border-t border-[#d9e7f5] bg-white p-2 dark:border-sky-300/15 dark:bg-black/30">
          <input
            autoFocus
            value={renameDraft}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyRename();
              if (event.key === 'Escape') setRenamingId(null);
            }}
            maxLength={40}
            placeholder={isArabic ? 'اسم الغرفة' : 'Room name'}
            className="min-w-0 flex-1 rounded-lg border border-[#dbe9f8] bg-white px-2 py-1.5 text-xs font-semibold text-[#0f2544] outline-none focus:border-sky-400 dark:border-white/10 dark:bg-black/30 dark:text-foreground"
          />
          <button
            type="button"
            onClick={applyRename}
            className="rounded-lg bg-sky-500 px-3 py-1.5 text-[10px] font-bold text-white transition active:scale-95"
          >
            {isArabic ? 'حفظ' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  onClick,
  label,
  children,
  disabled,
  danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[11px] font-bold transition active:scale-95 disabled:opacity-40 ${
        danger
          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
          : 'bg-white text-[#40506a] dark:bg-white/10 dark:text-foreground/80'
      }`}
    >
      {children}
    </button>
  );
}
