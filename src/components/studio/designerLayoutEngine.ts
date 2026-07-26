import type {
  DesignerBrief,
  DesignerConnectionSpec,
  DesignerPlacement,
  DesignerRoomSpec,
  DesignerRoomType,
  PlannerAperture,
  PlannerWall,
} from './designerAiPlanner';

export type DesignerRoomLabel = {
  roomId: string;
  name: string;
  x: number;
  y: number;
  widthUnits: number;
  heightUnits: number;
};

export type DesignerEngineDraft = DesignerBrief & {
  placements: DesignerPlacement[];
  unsatisfiedConnections: DesignerConnectionSpec[];
};

export type DesignerCompiledLayout = {
  walls: PlannerWall[];
  apertures: PlannerAperture[];
  labels: DesignerRoomLabel[];
};

type BandKey = 'entry' | 'public' | 'family' | 'spine' | 'service' | 'private';

const BAND_ORDER: BandKey[] = ['entry', 'public', 'family', 'spine', 'service', 'private'];

const ORIGIN_UNITS = 4;
const MIN_SIDE_UNITS = 3;
const DOOR_EDGE_MARGIN_UNITS = 0.4;

const WINDOW_ROOM_TYPES: DesignerRoomType[] = ['living', 'majlis', 'dining', 'bedroom', 'office', 'kitchen', 'gym', 'spa'];

const bandForRoom = (room: DesignerRoomSpec): BandKey => {
  if (room.type === 'lobby') return 'entry';
  if (room.type === 'hallway') return 'spine';
  if (room.type === 'majlis' || room.type === 'dining') return 'public';
  if (room.between) return 'public';
  if (room.type === 'living') return 'family';
  if (room.type === 'kitchen' || room.type === 'bathroom' || room.type === 'spa' || room.type === 'gym') return 'service';
  return 'private';
};

const defaultDimensions = (room: DesignerRoomSpec): { width: number; height: number } => {
  const scale = room.size === 'large' ? 1.25 : room.size === 'small' ? 0.78 : 1;
  const base = (() => {
    switch (room.type) {
      case 'lobby': return { width: 9, height: 5 };
      case 'living': return { width: 11, height: 8 };
      case 'majlis': return { width: 10, height: 8 };
      case 'dining': return { width: 9, height: 7 };
      case 'hallway': return { width: 12, height: 3 };
      case 'bathroom': return { width: 4, height: 4 };
      case 'spa': return { width: 7, height: 6 };
      case 'gym': return { width: 8, height: 6 };
      case 'kitchen': return { width: 8, height: 6 };
      case 'bedroom': return { width: 9, height: 7 };
      case 'office': return { width: 7, height: 6 };
      default: return { width: 8, height: 6 };
    }
  })();
  const width = Math.max(MIN_SIDE_UNITS, Math.round(base.width * scale));
  const height = Math.max(MIN_SIDE_UNITS, Math.round(base.height * scale));
  return { width, height };
};

const resolveDimensions = (room: DesignerRoomSpec): { width: number; height: number } => {
  const fallback = defaultDimensions(room);
  const width = room.widthUnits && room.widthUnits > 0 ? Math.max(MIN_SIDE_UNITS, Math.round(room.widthUnits)) : fallback.width;
  const height = room.heightUnits && room.heightUnits > 0 ? Math.max(MIN_SIDE_UNITS, Math.round(room.heightUnits)) : fallback.height;
  return { width, height };
};

const pairKeyOf = (first: string, second: string) => [first, second].sort().join('|');

const buildNeighbourMap = (connections: DesignerConnectionSpec[]) => {
  const map = new Map<string, Set<string>>();
  connections.forEach((connection) => {
    if (!map.has(connection.from)) map.set(connection.from, new Set());
    if (!map.has(connection.to)) map.set(connection.to, new Set());
    map.get(connection.from)!.add(connection.to);
    map.get(connection.to)!.add(connection.from);
  });
  return map;
};

const orderBandRooms = (
  bandRooms: DesignerRoomSpec[],
  neighbours: Map<string, Set<string>>,
  previousCenters: Map<string, number>,
): DesignerRoomSpec[] => {
  if (bandRooms.length <= 1) return bandRooms;
  const bandIds = new Set(bandRooms.map((room) => room.id));
  const roomById = new Map(bandRooms.map((room) => [room.id, room]));

  const inBandNeighbours = (roomId: string) => Array.from(neighbours.get(roomId) || [])
    .filter((otherId) => bandIds.has(otherId));

  const preferredX = (roomId: string): number | null => {
    const outside = Array.from(neighbours.get(roomId) || []).filter((otherId) => previousCenters.has(otherId));
    if (!outside.length) return null;
    const total = outside.reduce((sum, otherId) => sum + (previousCenters.get(otherId) || 0), 0);
    return total / outside.length;
  };

  const visited = new Set<string>();
  const components: DesignerRoomSpec[][] = [];

  bandRooms.forEach((room) => {
    if (visited.has(room.id)) return;
    const queue = [room.id];
    const componentIds: string[] = [];
    visited.add(room.id);
    while (queue.length) {
      const currentId = queue.shift()!;
      componentIds.push(currentId);
      inBandNeighbours(currentId).forEach((nextId) => {
        if (visited.has(nextId)) return;
        visited.add(nextId);
        queue.push(nextId);
      });
    }

    const remaining = new Set(componentIds);
    const startId = componentIds
      .slice()
      .sort((a, b) => inBandNeighbours(a).length - inBandNeighbours(b).length)[0];
    const chain: string[] = [];
    let currentId: string | undefined = startId;
    while (currentId) {
      chain.push(currentId);
      remaining.delete(currentId);
      const nextId: string | undefined = inBandNeighbours(currentId)
        .filter((candidateId) => remaining.has(candidateId))
        .sort((a, b) => inBandNeighbours(a).length - inBandNeighbours(b).length)[0];
      currentId = nextId;
    }
    remaining.forEach((leftoverId) => chain.push(leftoverId));
    components.push(chain.map((id) => roomById.get(id)!).filter(Boolean));
  });

  const scored = components.map((component) => {
    const scores = component.map((room) => preferredX(room.id)).filter((value): value is number => value !== null);
    const average = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : Number.POSITIVE_INFINITY;
    return { component, average };
  });

  scored.sort((a, b) => a.average - b.average);
  return scored.flatMap((entry) => entry.component);
};

const stretchWidths = (widths: number[], targetTotal: number): number[] => {
  const currentTotal = widths.reduce((sum, value) => sum + value, 0);
  if (currentTotal >= targetTotal || !widths.length) return widths.slice();
  const next = widths.slice();
  let remainder = targetTotal - currentTotal;
  const order = next
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value)
    .map((entry) => entry.index);
  let cursor = 0;
  while (remainder > 0) {
    next[order[cursor % order.length]] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return next;
};

export const buildEngineDraft = (brief: DesignerBrief): DesignerEngineDraft => {
  const rooms = brief.rooms;
  if (!rooms.length) {
    return { ...brief, placements: [], unsatisfiedConnections: [] };
  }

  const neighbours = buildNeighbourMap(brief.connections);
  const bands = BAND_ORDER
    .map((band) => ({ band, rooms: rooms.filter((room) => bandForRoom(room) === band) }))
    .filter((entry) => entry.rooms.length > 0);

  const orderedBands: Array<{ band: BandKey; rooms: DesignerRoomSpec[] }> = [];
  const centers = new Map<string, number>();
  let previousCenters = new Map<string, number>();

  bands.forEach((entry) => {
    const ordered = orderBandRooms(entry.rooms, neighbours, previousCenters);
    orderedBands.push({ band: entry.band, rooms: ordered });
    const layoutCenters = new Map<string, number>();
    let cursor = 0;
    ordered.forEach((room) => {
      const dimensions = resolveDimensions(room);
      layoutCenters.set(room.id, cursor + dimensions.width / 2);
      cursor += dimensions.width;
    });
    previousCenters = layoutCenters;
  });

  const envelopeWidth = orderedBands.reduce((widest, entry) => {
    const bandWidth = entry.rooms.reduce((sum, room) => sum + resolveDimensions(room).width, 0);
    return Math.max(widest, bandWidth);
  }, 0);

  const placements: DesignerPlacement[] = [];
  let cursorY = ORIGIN_UNITS;

  orderedBands.forEach((entry) => {
    const dimensions = entry.rooms.map((room) => resolveDimensions(room));
    const bandHeight = dimensions.reduce((tallest, item) => Math.max(tallest, item.height), MIN_SIDE_UNITS);
    const widths = stretchWidths(dimensions.map((item) => item.width), envelopeWidth);
    let cursorX = ORIGIN_UNITS;
    entry.rooms.forEach((room, index) => {
      placements.push({
        roomId: room.id,
        x: cursorX,
        y: cursorY,
        width: widths[index],
        height: bandHeight,
      });
      centers.set(room.id, cursorX + widths[index] / 2);
      cursorX += widths[index];
    });
    cursorY += bandHeight;
  });

  const placementById = new Map(placements.map((placement) => [placement.roomId, placement]));
  const unsatisfiedConnections = brief.connections.filter((connection) => {
    const first = placementById.get(connection.from);
    const second = placementById.get(connection.to);
    if (!first || !second) return true;
    const sharesVertical = (first.x + first.width === second.x || second.x + second.width === first.x)
      && Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y) >= 1;
    const sharesHorizontal = (first.y + first.height === second.y || second.y + second.height === first.y)
      && Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x) >= 1;
    return !sharesVertical && !sharesHorizontal;
  });

  return { ...brief, placements, unsatisfiedConnections };
};

type BoundaryUnit = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pairKey: string;
  roomA: string;
  roomB: string | null;
  orientation: 'horizontal' | 'vertical';
};

type BoundarySegment = BoundaryUnit & { wallId: string };

const buildCellMap = (placements: DesignerPlacement[]) => {
  const cells = new Map<string, string>();
  placements.forEach((placement) => {
    for (let x = placement.x; x < placement.x + placement.width; x += 1) {
      for (let y = placement.y; y < placement.y + placement.height; y += 1) {
        cells.set(`${x},${y}`, placement.roomId);
      }
    }
  });
  return cells;
};

const buildBoundaries = (placements: DesignerPlacement[]): BoundarySegment[] => {
  const cells = buildCellMap(placements);
  const units = new Map<string, BoundaryUnit>();

  placements.forEach((placement) => {
    for (let x = placement.x; x < placement.x + placement.width; x += 1) {
      for (let y = placement.y; y < placement.y + placement.height; y += 1) {
        const checks = [
          { nx: x, ny: y - 1, x1: x, y1: y, x2: x + 1, y2: y, orientation: 'horizontal' as const },
          { nx: x + 1, ny: y, x1: x + 1, y1: y, x2: x + 1, y2: y + 1, orientation: 'vertical' as const },
          { nx: x, ny: y + 1, x1: x, y1: y + 1, x2: x + 1, y2: y + 1, orientation: 'horizontal' as const },
          { nx: x - 1, ny: y, x1: x, y1: y, x2: x, y2: y + 1, orientation: 'vertical' as const },
        ];
        checks.forEach((check) => {
          const neighbourRoom = cells.get(`${check.nx},${check.ny}`) || null;
          if (neighbourRoom === placement.roomId) return;
          const pair = [placement.roomId, neighbourRoom || 'outside'].sort();
          const pairKey = pair.join('|');
          const key = `${check.x1},${check.y1},${check.x2},${check.y2}|${pairKey}`;
          if (units.has(key)) return;
          units.set(key, {
            x1: check.x1,
            y1: check.y1,
            x2: check.x2,
            y2: check.y2,
            pairKey,
            roomA: pair[0] === 'outside' ? pair[1] : pair[0],
            roomB: pair.includes('outside') ? null : pair[1],
            orientation: check.orientation,
          });
        });
      }
    }
  });

  const merged: BoundarySegment[] = [];
  const mergeRun = (items: BoundaryUnit[], isHorizontal: boolean) => {
    let current: BoundaryUnit | null = null;
    items.forEach((item) => {
      if (!current) {
        current = { ...item };
        return;
      }
      const continues = isHorizontal
        ? current.pairKey === item.pairKey && current.y1 === item.y1 && current.x2 === item.x1
        : current.pairKey === item.pairKey && current.x1 === item.x1 && current.y2 === item.y1;
      if (continues) {
        current = isHorizontal ? { ...current, x2: item.x2 } : { ...current, y2: item.y2 };
        return;
      }
      merged.push({ ...current, wallId: `wall-${merged.length + 1}` });
      current = { ...item };
    });
    if (current) merged.push({ ...current, wallId: `wall-${merged.length + 1}` });
  };

  const all = Array.from(units.values());
  mergeRun(
    all.filter((unit) => unit.orientation === 'horizontal')
      .sort((a, b) => a.pairKey.localeCompare(b.pairKey) || a.y1 - b.y1 || a.x1 - b.x1),
    true,
  );
  mergeRun(
    all.filter((unit) => unit.orientation === 'vertical')
      .sort((a, b) => a.pairKey.localeCompare(b.pairKey) || a.x1 - b.x1 || a.y1 - b.y1),
    false,
  );
  return merged;
};

const roomTypeOf = (roomId: string, rooms: DesignerRoomSpec[]): DesignerRoomType => (
  rooms.find((room) => room.id === roomId)?.type || 'other'
);

const doorWidthUnits = (first: DesignerRoomType, second: DesignerRoomType) => {
  if (first === 'bathroom' || second === 'bathroom') return 0.9;
  if (first === 'majlis' || second === 'majlis' || first === 'dining' || second === 'dining') return 1.2;
  return 1;
};

const openingWidthUnits = (first: DesignerRoomType, second: DesignerRoomType) => {
  if (first === 'living' || second === 'living') return 2.4;
  if (first === 'lobby' || second === 'lobby') return 2;
  return 1.8;
};

const segmentLengthUnits = (segment: BoundarySegment) => Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);

const findFreeRatio = (
  occupied: Array<{ start: number; end: number }>,
  lengthUnits: number,
  openingUnits: number,
): number | null => {
  if (lengthUnits <= 0) return null;
  const halfRatio = (openingUnits / 2) / lengthUnits;
  const marginRatio = DOOR_EDGE_MARGIN_UNITS / lengthUnits;
  const minRatio = halfRatio + marginRatio;
  const maxRatio = 1 - halfRatio - marginRatio;
  if (minRatio >= maxRatio) return null;

  const candidates = [0.5];
  for (let step = 1; step <= 8; step += 1) {
    const offset = step * 0.06;
    candidates.push(0.5 - offset, 0.5 + offset);
  }

  for (const candidate of candidates) {
    const ratio = Math.min(maxRatio, Math.max(minRatio, candidate));
    const start = ratio - halfRatio;
    const end = ratio + halfRatio;
    const clashes = occupied.some((slot) => start < slot.end + marginRatio && end > slot.start - marginRatio);
    if (!clashes) return ratio;
  }
  return null;
};

export const compileEngineDraft = (
  draft: DesignerEngineDraft,
  pixelsPerUnit: number,
): DesignerCompiledLayout => {
  const boundaries = buildBoundaries(draft.placements);
  const walls: PlannerWall[] = boundaries.map((segment) => ({
    id: segment.wallId,
    x1: segment.x1 * pixelsPerUnit,
    y1: segment.y1 * pixelsPerUnit,
    x2: segment.x2 * pixelsPerUnit,
    y2: segment.y2 * pixelsPerUnit,
    type: segment.roomB ? 'partition' : 'structural',
  }));
  const wallById = new Map(walls.map((wall) => [wall.id, wall]));
  const segmentById = new Map(boundaries.map((segment) => [segment.wallId, segment]));
  const apertures: PlannerAperture[] = [];
  const occupancy = new Map<string, Array<{ start: number; end: number }>>();

  const reserve = (wallId: string, ratio: number, halfRatio: number) => {
    const slots = occupancy.get(wallId) || [];
    slots.push({ start: ratio - halfRatio, end: ratio + halfRatio });
    occupancy.set(wallId, slots);
  };

  draft.connections.forEach((connection, connectionIndex) => {
    const pair = pairKeyOf(connection.from, connection.to);
    const candidates = boundaries
      .filter((segment) => segment.roomB && segment.pairKey === pair)
      .sort((a, b) => segmentLengthUnits(b) - segmentLengthUnits(a));
    if (!candidates.length) return;

    const firstType = roomTypeOf(connection.from, draft.rooms);
    const secondType = roomTypeOf(connection.to, draft.rooms);
    const isOpening = connection.kind === 'open';
    const requestedUnits = isOpening
      ? openingWidthUnits(firstType, secondType)
      : doorWidthUnits(firstType, secondType);

    for (const candidate of candidates) {
      const lengthUnits = segmentLengthUnits(candidate);
      const usableUnits = Math.min(requestedUnits, Math.max(0.8, lengthUnits * 0.6));
      const ratio = findFreeRatio(occupancy.get(candidate.wallId) || [], lengthUnits, usableUnits);
      if (ratio === null) continue;
      const halfRatio = (usableUnits / 2) / lengthUnits;
      reserve(candidate.wallId, ratio, halfRatio);

      if (isOpening) {
        const wall = wallById.get(candidate.wallId);
        if (!wall) break;
        wall.breaks = [...(wall.breaks || []), {
          id: `opening-${candidate.wallId}-${connectionIndex + 1}`,
          positionRatio: ratio,
          width: usableUnits * pixelsPerUnit,
        }];
        break;
      }

      apertures.push({
        id: `door-${candidate.wallId}-${connectionIndex + 1}`,
        wallId: candidate.wallId,
        type: 'door',
        positionRatio: ratio,
        width: usableUnits * pixelsPerUnit,
        hinge: connectionIndex % 2 === 0 ? 'start' : 'end',
        swing: connectionIndex % 2 === 0 ? 'right' : 'left',
      });
      break;
    }
  });

  const windowCounts = new Map<string, number>();
  draft.placements.forEach((placement) => {
    const type = roomTypeOf(placement.roomId, draft.rooms);
    if (!WINDOW_ROOM_TYPES.includes(type)) return;
    const exterior = boundaries
      .filter((segment) => !segment.roomB && segment.roomA === placement.roomId)
      .sort((a, b) => segmentLengthUnits(b) - segmentLengthUnits(a));
    const allowance = type === 'living' || type === 'majlis' ? 2 : 1;

    for (const segment of exterior) {
      if ((windowCounts.get(placement.roomId) || 0) >= allowance) break;
      const lengthUnits = segmentLengthUnits(segment);
      if (lengthUnits < 3) continue;
      const widthUnits = Math.min(2.2, lengthUnits * 0.45);
      const ratio = findFreeRatio(occupancy.get(segment.wallId) || [], lengthUnits, widthUnits);
      if (ratio === null) continue;
      reserve(segment.wallId, ratio, (widthUnits / 2) / lengthUnits);
      apertures.push({
        id: `window-${segment.wallId}-${(windowCounts.get(placement.roomId) || 0) + 1}`,
        wallId: segment.wallId,
        type: 'window',
        positionRatio: ratio,
        width: widthUnits * pixelsPerUnit,
      });
      windowCounts.set(placement.roomId, (windowCounts.get(placement.roomId) || 0) + 1);
    }
  });

  const labels: DesignerRoomLabel[] = draft.placements.map((placement) => {
    const room = draft.rooms.find((item) => item.id === placement.roomId);
    return {
      roomId: placement.roomId,
      name: room?.name || placement.roomId,
      x: (placement.x + placement.width / 2) * pixelsPerUnit,
      y: (placement.y + placement.height / 2) * pixelsPerUnit,
      widthUnits: placement.width,
      heightUnits: placement.height,
    };
  });

  void segmentById;
  return { walls, apertures, labels };
};
