import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Check,
  Crosshair,
  ChevronDown,
  DoorOpen,
  Grid3x3,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  Lock,
  LockOpen,
  Maximize2,
  MessageCircle,
  MousePointer2,
  PencilRuler,
  Redo2,
  RotateCw,
  Ruler,
  Save,
  Sofa,
  ScanLine,
  Scissors,
  Send,
  ShieldAlert,
  Sparkles,
  Spline,
  Tag,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { WaktiAIV2Service } from '@/services/WaktiAIV2Service';
import {
  buildAssistantReply,
  buildDesignerAiPrompt,
  buildLocalDesignerBrief,
  parseDesignerBriefFromResponse,
  summarizeCurrentLayout,
  type DesignerBrief,
  type DesignerChatTurn,
} from './designerAiPlanner';
import { buildEngineDraft, compileEngineDraft, type DesignerRoomLabel } from './designerLayoutEngine';
import {
  applyFollowUpAnswers,
  buildDefaultAnswers,
  buildFollowUpForm,
  type DesignerFormAnswers,
  type DesignerFormField,
} from './designerFollowUp';
import {
  describeEditCommand,
  findFurnitureSymbol,
  findPlacedItemByHint,
  parseDesignerEditCommand,
  type DesignerEditCommand,
} from './designerEditCommands';
import { FurniturePalette, FurnitureShapes, type PlacedItem } from './LayoutFurniture';
import { furnitureById, type FurnitureSymbol } from './floorPlanFurniture';
import DesignerFollowUpDialog from './DesignerFollowUpDialog';
import RedesignRoomStudio from './RedesignRoomStudio';
import FloorPlanStudio from './FloorPlanStudio';
import DesignerSavedProjects from './DesignerSavedProjects';
import { StudioGuestLoginDialog } from './StudioGuestLoginDialog';
import { layoutToBlueprintPng } from './layoutBlueprint';
import {
  BLUEPRINT_KEY,
  asArray,
  asNumber,
  asRecord,
  asText,
  projectImageUrl,
  type DesignerProjectTarget,
  type FloorPlanHandoff,
  type SavedProject,
} from './designerProjects';

const SUPABASE_URL = ((import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL || 'https://hxauxozopvpzpdygoqwf.supabase.co').trim();

export type DesignerStartMode = 'redesign' | 'trace' | 'draw';

export interface Point {
  x: number;
  y: number;
}

export interface WallBreak {
  id: string;
  positionRatio: number;
  width: number;
}

export interface Wall {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  type: 'structural' | 'partition' | 'beam';
  control?: Point;
  breaks?: WallBreak[];
}

type DoorHinge = 'start' | 'end';
type DoorSwing = 'left' | 'right';

export interface Aperture {
  id: string;
  wallId: string;
  type: 'door' | 'window';
  positionRatio: number;
  width: number;
  hinge?: DoorHinge;
  swing?: DoorSwing;
}

type LayoutSnapshot = {
  walls: Wall[];
  apertures: Aperture[];
  /** Placed furniture. Part of the snapshot so undo and redo cover it like everything else. */
  items: PlacedItem[];
};

/**
 * An uploaded plan shown underneath the grid so the user can trace over it by hand.
 *
 * ⛔ This is a REFERENCE IMAGE, not an auto-trace. Nothing reads it, nothing converts it, and no
 * model ever sees it — it is there so a person can draw their own walls on top of their own plan.
 * It is never included in what gets saved or sent for rendering.
 */
type TraceUnderlay = {
  dataUrl: string;
  name: string;
  /** Top-left corner in canvas pixels. */
  x: number;
  y: number;
  /** Rendered width in canvas pixels; the height follows the image's own aspect ratio. */
  width: number;
  height: number;
  opacity: number;
  /** Locked underlays ignore drags, so tracing over one cannot nudge it out of alignment. */
  locked: boolean;
};

type DrawTool = 'select' | 'wall' | 'room' | 'curve' | 'break' | 'door' | 'window' | 'beam';
type WallEndpoint = 'start' | 'end';
type WallEndpointReference = { wallId: string; endpoint: WallEndpoint };
type WallExclusion = string | readonly string[];
type SnapGuide = {
  kind: 'corner' | 'wall-face';
  point: Point;
  pointer: Point;
  lineStart?: Point;
  lineEnd?: Point;
};
type LayoutFeedback = 'none' | 'wall-required' | 'break-wall-required' | 'opening-overlap' | 'door-added' | 'door-updated' | 'window-added' | 'break-added' | 'door-moved' | 'window-moved' | 'break-moved' | 'opening-resized' | 'wall-added' | 'room-added' | 'beam-added' | 'curve-added' | 'wall-resized' | 'wall-moved' | 'curve-adjusted';

type WallInteraction = {
  kind: 'move' | 'resize' | 'curve';
  pointerId: number;
  wallId: string;
  endpoint?: WallEndpoint;
  linkedEndpoints: WallEndpointReference[];
  pointerStart: Point;
  originalWall: Wall;
  originalWalls: Wall[];
  originalApertures: Aperture[];
  draftWalls: Wall[];
  hasMoved: boolean;
};

type ApertureInteraction = {
  pointerId: number;
  apertureId: string;
  originalAperture: Aperture;
  originalWalls: Wall[];
  originalApertures: Aperture[];
  draftAperture: Aperture;
  hasMoved: boolean;
};

type ItemInteraction = {
  pointerId: number;
  itemId: string;
  originalItems: PlacedItem[];
  offsetX: number;
  offsetY: number;
  draftItems: PlacedItem[];
  hasMoved: boolean;
};

type UnderlayInteraction = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
};

type CanvasPanInteraction = {
  pointerId: number;
  clientX: number;
  clientY: number;
  scrollLeft: number;
  scrollTop: number;
};

type WallBreakInteraction = {
  pointerId: number;
  wallId: string;
  breakId: string;
  originalBreak: WallBreak;
  originalWalls: Wall[];
  originalApertures: Aperture[];
  draftBreak: WallBreak;
  hasMoved: boolean;
};

type DesignerWorkspaceProps = {
  language: 'en' | 'ar';
  mode: DesignerStartMode | null;
  onModeChange: (mode: DesignerStartMode) => void;
};

type DesignerView = 'workspace' | 'saved';

type DesignerChatEntry = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
  assumptions?: string[];
  questions?: string[];
};

type LocalizedOption = {
  key: DesignerStartMode;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
};

const modeOptions: LocalizedOption[] = [
  {
    key: 'redesign',
    titleEn: 'Redesign Room',
    titleAr: 'إعادة تصميم الغرفة',
    descriptionEn: 'Upload your room photos to completely redesign and style them.',
    descriptionAr: 'قم بتحميل صور غرفتك لإعادة تصميمها وتنسيقها بالكامل.',
  },
  {
    key: 'trace',
    titleEn: 'Furnish Floor Plan',
    titleAr: 'أثّث مخطط الأرضية',
    descriptionEn: 'Upload a blueprint and get a fully furnished home, room by room.',
    descriptionAr: 'ارفع مخططك واحصل على منزل مؤثّث بالكامل، غرفة بغرفة.',
  },
  {
    key: 'draw',
    titleEn: 'Draw Layout',
    titleAr: 'ارسم المخطط',
    descriptionEn: 'Start with a blank canvas to draft your own layout from scratch.',
    descriptionAr: 'ابدأ بصفحة بيضاء لرسم مخططك الخاص من الصفر.',
  },
];

const traceItems = [
  { value: 'walls', en: 'Walls', ar: 'الجدران' },
  { value: 'doors', en: 'Doors', ar: 'الأبواب' },
  { value: 'windows', en: 'Windows', ar: 'النوافذ' },
];

const drawTools = [
  { value: 'select', en: 'Select', ar: 'تحديد', icon: MousePointer2 },
  { value: 'wall', en: 'Wall', ar: 'جدار', icon: LayoutTemplate },
  { value: 'room', en: 'Room', ar: 'غرفة', icon: Grid3x3 },
  { value: 'curve', en: 'Curve', ar: 'منحنى', icon: Spline },
  { value: 'break', en: 'Opening', ar: 'فتحة', icon: Scissors },
  { value: 'door', en: 'Door', ar: 'باب', icon: DoorOpen },
  { value: 'window', en: 'Window', ar: 'نافذة', icon: Box },
  { value: 'beam', en: 'Beam', ar: 'كمرة', icon: Ruler },
] as const;

export default function DesignerWorkspace({ language, mode, onModeChange }: DesignerWorkspaceProps) {
  const isArabic = language === 'ar';
  const plannerLanguage = isArabic ? 'ar' : 'en';
  const { isGuest } = useAuth();
  const activeMode = mode || 'redesign';
  const activeOption = modeOptions.find((option) => option.key === activeMode)!;
  const [view, setView] = useState<DesignerView>('workspace');
  const [selectedTraceItems, setSelectedTraceItems] = useState<string[]>(['walls', 'doors', 'windows']);
  const [scalePixelsPerUnit, setScalePixelsPerUnit] = useState<number>(20);
  const [scaleUnit, setScaleUnit] = useState<'m' | 'ft'>('m');
  const [walls, setWalls] = useState<Wall[]>([]);
  const [apertures, setApertures] = useState<Aperture[]>([]);
  const [history, setHistory] = useState<LayoutSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [selectedTool, setSelectedTool] = useState<DrawTool>('select');
  const [newWallType, setNewWallType] = useState<Exclude<Wall['type'], 'beam'>>('partition');
  const [drawingStartPoint, setDrawingStartPoint] = useState<Point | null>(null);
  const [currentDrawingPoint, setCurrentDrawingPoint] = useState<Point | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [layoutFeedback, setLayoutFeedback] = useState<LayoutFeedback>('none');
  const [zoom, setZoom] = useState(1);
  const [isLayoutKitOpen, setIsLayoutKitOpen] = useState(true);
  const [curveEndPoint, setCurveEndPoint] = useState<Point | null>(null);
  const [snapGuide, setSnapGuide] = useState<SnapGuide | null>(null);
  const [items, setItems] = useState<PlacedItem[]>([]);
  const [underlay, setUnderlay] = useState<TraceUnderlay | null>(null);
  const [isFurnitureOpen, setIsFurnitureOpen] = useState(false);
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [assetNames, setAssetNames] = useState<Record<DesignerStartMode, string[]>>({
    redesign: [],
    trace: [],
    draw: [],
  });
  const [designerPrompt, setDesignerPrompt] = useState('');
  const [designerChat, setDesignerChat] = useState<DesignerChatEntry[]>([]);
  const [designerIsLoading, setDesignerIsLoading] = useState(false);
  const [roomLabels, setRoomLabels] = useState<DesignerRoomLabel[]>([]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [straightOnly, setStraightOnly] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpFields, setFollowUpFields] = useState<DesignerFormField[]>([]);
  const [followUpAnswers, setFollowUpAnswers] = useState<DesignerFormAnswers>({});
  const [pendingBrief, setPendingBrief] = useState<DesignerBrief | null>(null);
  const [pendingRequest, setPendingRequest] = useState('');
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  /** Set on a successful save and cleared by the next edit, so the tick can never lie. */
  const [savedLayoutId, setSavedLayoutId] = useState<string | null>(null);
  /** A saved project waiting for FloorPlanStudio to pick up and restore. */
  const [planHandoff, setPlanHandoff] = useState<FloorPlanHandoff | null>(null);
  const labelDragRef = useRef<{ pointerId: number; labelId: string; offsetX: number; offsetY: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const layoutSvgRef = useRef<SVGSVGElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const drawingStartRef = useRef<Point | null>(null);
  const pointerStartRef = useRef<Point | null>(null);
  const pointerWasDrawingRef = useRef(false);
  const hadExistingStartRef = useRef(false);
  const wallInteractionRef = useRef<WallInteraction | null>(null);
  const apertureInteractionRef = useRef<ApertureInteraction | null>(null);
  const canvasPanRef = useRef<CanvasPanInteraction | null>(null);
  const wallBreakInteractionRef = useRef<WallBreakInteraction | null>(null);
  const itemInteractionRef = useRef<ItemInteraction | null>(null);
  const underlayInteractionRef = useRef<UnderlayInteraction | null>(null);
  const underlayInputRef = useRef<HTMLInputElement | null>(null);
  const currentAssets = assetNames[activeMode];
  const GRID_GAP = 20;
  const CONNECTOR_SNAP_DISTANCE = 18;
  const CORNER_JOIN_DISTANCE = 3;
  const CANVAS_SIZE = 1200;

  const setWorkspaceMode = (nextMode: DesignerStartMode) => {
    onModeChange(nextMode);
    setView('workspace');
  };

  /**
   * Saves the drawn layout as its own project.
   *
   * Two things go in and both are load-bearing: the GEOMETRY, which is what makes the drawing
   * editable again on this canvas, and a rendered BLUEPRINT PNG, which is what lets tab 2 furnish
   * it. Neither is much use without the other.
   */
  const saveLayout = async () => {
    if (isSavingLayout || !walls.length) return;
    setIsSavingLayout(true);
    try {
      const blueprint = layoutToBlueprintPng({
        walls,
        apertures,
        items,
        labels: roomLabels.map((label) => ({ name: label.name, x: label.x, y: label.y })),
      });
      if (!blueprint) throw new Error(isArabic ? 'لا يوجد رسم لحفظه بعد' : 'There is nothing drawn to save yet');

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error(isArabic ? 'يجب تسجيل الدخول' : 'You need to sign in first');

      const response = await fetch(`${SUPABASE_URL}/functions/v1/wakti-designer-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'draw',
          title: isArabic ? 'مخطط مرسوم' : 'Drawn layout',
          summary: [
            roomLabels.map((label) => label.name.trim()).filter(Boolean).join(', '),
            isArabic
              ? `${walls.length} جدار · ${apertures.length} فتحة`
              : `${walls.length} walls · ${apertures.length} openings`,
          ].filter(Boolean).join(' — '),
          choices: { walls, apertures, items, roomLabels, scalePixelsPerUnit, scaleUnit },
          images: [{ key: BLUEPRINT_KEY, url: blueprint }],
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success || !json?.project?.id) {
        throw new Error(String(json?.error || (isArabic ? 'تعذّر الحفظ' : 'Could not save')));
      }

      setSavedLayoutId(String(json.project.id));
      toast.success(isArabic ? 'تم حفظ المخطط في المحفوظات' : 'Layout saved to your designs');
    } catch (error) {
      const message = error instanceof Error ? error.message : (isArabic ? 'تعذّر الحفظ' : 'Could not save');
      console.error('[designer-draw] save failed:', message);
      toast.error(message);
    } finally {
      setIsSavingLayout(false);
    }
  };

  /**
   * Puts a saved layout back on the canvas, fully editable.
   *
   * ⛔ Every field is read defensively. `choices` is jsonb written by a possibly older version of
   * this component, so a missing or malformed field has to degrade rather than throw — losing one
   * door is recoverable, a blank screen is not.
   *
   * History is RESET to a single snapshot of what was just loaded rather than restored from the
   * record, so the furthest undo can reach is the drawing as it was saved, never an empty canvas
   * belonging to some earlier session.
   */
  const hydrateLayout = (project: SavedProject) => {
    const restoredWalls: Wall[] = asArray(project.choices.walls)
      .map((entry) => asRecord(entry))
      .filter((entry) => asText(entry.id))
      .map((entry) => {
        const type = asText(entry.type);
        const control = asRecord(entry.control);
        const wall: Wall = {
          id: asText(entry.id),
          x1: asNumber(entry.x1, 0),
          y1: asNumber(entry.y1, 0),
          x2: asNumber(entry.x2, 0),
          y2: asNumber(entry.y2, 0),
          type: type === 'structural' || type === 'beam' ? type : 'partition',
          breaks: asArray(entry.breaks)
            .map((raw) => asRecord(raw))
            .map((raw) => ({
              id: asText(raw.id) || crypto.randomUUID(),
              positionRatio: asNumber(raw.positionRatio, 0.5),
              width: asNumber(raw.width, 40),
            })),
        };
        if (typeof control.x === 'number' && typeof control.y === 'number') {
          wall.control = { x: control.x, y: control.y };
        }
        return wall;
      });

    // An opening whose wall did not survive would be invisible and impossible to delete.
    const wallIds = new Set(restoredWalls.map((wall) => wall.id));
    const restoredApertures: Aperture[] = asArray(project.choices.apertures)
      .map((entry) => asRecord(entry))
      .filter((entry) => asText(entry.id) && wallIds.has(asText(entry.wallId)))
      .map((entry) => ({
        id: asText(entry.id),
        wallId: asText(entry.wallId),
        type: asText(entry.type) === 'window' ? 'window' : 'door',
        positionRatio: asNumber(entry.positionRatio, 0.5),
        width: asNumber(entry.width, 40),
        hinge: asText(entry.hinge) === 'end' ? 'end' : 'start',
        swing: asText(entry.swing) === 'right' ? 'right' : 'left',
      }));

    const restoredItems: PlacedItem[] = asArray(project.choices.items)
      .map((entry) => asRecord(entry))
      .filter((entry) => asText(entry.symbolId))
      .map((entry) => ({
        id: asText(entry.id) || crypto.randomUUID(),
        symbolId: asText(entry.symbolId),
        x: asNumber(entry.x, 0),
        y: asNumber(entry.y, 0),
        rotation: asNumber(entry.rotation, 0),
        width: asNumber(entry.width, 40),
        depth: asNumber(entry.depth, 40),
      }));

    const restoredLabels: DesignerRoomLabel[] = asArray(project.choices.roomLabels)
      .map((entry) => asRecord(entry))
      .filter((entry) => asText(entry.name))
      .map((entry) => ({
        roomId: asText(entry.roomId) || crypto.randomUUID(),
        name: asText(entry.name),
        x: asNumber(entry.x, 0),
        y: asNumber(entry.y, 0),
        widthUnits: asNumber(entry.widthUnits, 0),
        heightUnits: asNumber(entry.heightUnits, 0),
      }));

    setWalls(restoredWalls);
    setApertures(restoredApertures);
    setItems(restoredItems);
    setRoomLabels(restoredLabels);
    setScalePixelsPerUnit(asNumber(project.choices.scalePixelsPerUnit, 20));
    setScaleUnit(asText(project.choices.scaleUnit) === 'ft' ? 'ft' : 'm');
    setHistory([{ walls: restoredWalls, apertures: restoredApertures, items: restoredItems }]);
    setHistoryIndex(0);
    setSelectedElementId(null);
    setSelectedTool('select');
    setLayoutFeedback('none');
    // The trace underlay is a reference image that was never saved, so there is none to restore.
    setUnderlay(null);
    setZoom(1);
    setSavedLayoutId(project.id);
    resetDrawing();
  };

  /**
   * The one place a saved project is routed, and it does not guess. The button the user pressed
   * decides the destination; the project's own mode decides which buttons exist at all, over in
   * DesignerSavedProjects. A room-photo project reaches neither branch.
   */
  const handleOpenProject = (target: DesignerProjectTarget, project: SavedProject) => {
    if (target === 'draw') {
      hydrateLayout(project);
      setWorkspaceMode('draw');
      toast.success(isArabic ? 'تم فتح الرسم للتعديل' : 'Drawing opened for editing');
      return;
    }
    if (target === 'trace') {
      const blueprintUrl = projectImageUrl(project, BLUEPRINT_KEY);
      if (!blueprintUrl) {
        toast.error(isArabic
          ? 'هذا المشروع لا يحتوي على الرسم الأصلي'
          : 'This project has no original drawing saved with it');
        return;
      }
      setPlanHandoff({ project, blueprintUrl });
      setWorkspaceMode('trace');
    }
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setAssetNames((current) => ({
      ...current,
      [activeMode]: files.slice(0, 1).map((file) => file.name),
    }));
    event.target.value = '';
  };

  const removeAsset = (assetName: string) => {
    setAssetNames((current) => ({
      ...current,
      [activeMode]: current[activeMode].filter((name) => name !== assetName),
    }));
  };

  const toggleTraceItem = (item: string) => {
    setSelectedTraceItems((current) => (
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item]
    ));
  };

  const setDrawingStart = (point: Point | null) => {
    drawingStartRef.current = point;
    setDrawingStartPoint(point);
  };

  const snapToGrid = (value: number): number => Math.round(value / GRID_GAP) * GRID_GAP;

  const clampToCanvas = (value: number): number => Math.max(0, Math.min(CANVAS_SIZE, value));

  const snapPoint = (point: Point): Point => ({
    x: clampToCanvas(snapToGrid(point.x)),
    y: clampToCanvas(snapToGrid(point.y)),
  });

  const cloneWall = (wall: Wall): Wall => ({
    ...wall,
    control: wall.control ? { ...wall.control } : undefined,
    breaks: wall.breaks?.map((wallBreak) => ({ ...wallBreak })),
  });

  const getPointOnWall = (wall: Wall, ratio: number): Point => {
    const t = Math.max(0, Math.min(1, ratio));
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

  const getWallTangent = (wall: Wall, ratio: number): Point => {
    if (!wall.control) {
      const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) || 1;
      return { x: (wall.x2 - wall.x1) / length, y: (wall.y2 - wall.y1) / length };
    }

    const t = Math.max(0, Math.min(1, ratio));
    const rawX = 2 * (1 - t) * (wall.control.x - wall.x1) + 2 * t * (wall.x2 - wall.control.x);
    const rawY = 2 * (1 - t) * (wall.control.y - wall.y1) + 2 * t * (wall.y2 - wall.control.y);
    const length = Math.hypot(rawX, rawY) || 1;
    return { x: rawX / length, y: rawY / length };
  };

  const getWallLength = (wall: Wall): number => {
    if (!wall.control) return Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1);
    let length = 0;
    let previousPoint = getPointOnWall(wall, 0);
    for (let index = 1; index <= 48; index += 1) {
      const point = getPointOnWall(wall, index / 48);
      length += Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
      previousPoint = point;
    }
    return length;
  };

  const getDistanceLabel = (x1: number, y1: number, x2: number, y2: number): string => {
    const pixels = Math.hypot(x2 - x1, y2 - y1);
    const units = pixels / scalePixelsPerUnit;
    return `${units.toFixed(1)} ${scaleUnit}`;
  };

  const getWallDistanceLabel = (wall: Wall): string => `${(getWallLength(wall) / scalePixelsPerUnit).toFixed(1)} ${scaleUnit}`;

  const getWallPath = (wall: Wall): string => (
    wall.control
      ? `M ${wall.x1} ${wall.y1} Q ${wall.control.x} ${wall.control.y} ${wall.x2} ${wall.y2}`
      : `M ${wall.x1} ${wall.y1} L ${wall.x2} ${wall.y2}`
  );

  const getWallStrokeWidth = (wall: Wall): number => (
    wall.type === 'beam' ? 16 : wall.type === 'structural' ? 12 : 6
  );

  const getOpeningInterval = (wall: Wall, positionRatio: number, width: number) => {
    const length = getWallLength(wall) || 1;
    const halfRatio = Math.min(0.32, width / length / 2);
    return {
      start: Math.max(0.035, positionRatio - halfRatio),
      end: Math.min(0.965, positionRatio + halfRatio),
    };
  };

  const getWallOpeningIntervals = (
    wall: Wall,
    ignoredOpeningId?: string,
  ): Array<{ id: string; start: number; end: number }> => {
    const breaks = (wall.breaks || [])
      .filter((wallBreak) => wallBreak.id !== ignoredOpeningId)
      .map((wallBreak) => ({
        id: wallBreak.id,
        ...getOpeningInterval(wall, wallBreak.positionRatio, wallBreak.width),
      }));
    const wallApertures = apertures
      .filter((aperture) => aperture.wallId === wall.id && aperture.id !== ignoredOpeningId)
      .map((aperture) => ({
        id: aperture.id,
        ...getOpeningInterval(wall, aperture.positionRatio, aperture.width),
      }));
    return [...breaks, ...wallApertures].sort((first, second) => first.start - second.start);
  };

  const isWallPositionOpen = (wall: Wall, ratio: number, ignoredOpeningId?: string): boolean => (
    getWallOpeningIntervals(wall, ignoredOpeningId).some((interval) => ratio >= interval.start && ratio <= interval.end)
  );

  const getWallPieceRanges = (wall: Wall): Array<{ start: number; end: number }> => {
    const ranges: Array<{ start: number; end: number }> = [];
    let cursor = 0;
    getWallOpeningIntervals(wall).forEach((interval) => {
      if (interval.start > cursor) ranges.push({ start: cursor, end: interval.start });
      cursor = Math.max(cursor, interval.end);
    });
    if (cursor < 1) ranges.push({ start: cursor, end: 1 });
    return ranges;
  };

  const getSafeOpeningRatio = (wall: Wall, requestedRatio: number, width: number, ignoredOpeningId?: string): number => {
    const length = getWallLength(wall) || 1;
    const halfRatio = Math.min(0.32, width / length / 2);
    const minimum = 0.035 + halfRatio;
    const maximum = 0.965 - halfRatio;
    const safetyGap = Math.min(0.025, 8 / length);
    let ratio = Math.max(minimum, Math.min(maximum, requestedRatio));

    for (let pass = 0; pass < 3; pass += 1) {
      const collision = getWallOpeningIntervals(wall, ignoredOpeningId).find((interval) => (
        ratio + halfRatio + safetyGap > interval.start && ratio - halfRatio - safetyGap < interval.end
      ));
      if (!collision) break;
      const before = Math.max(minimum, collision.start - halfRatio - safetyGap);
      const after = Math.min(maximum, collision.end + halfRatio + safetyGap);
      ratio = Math.abs(requestedRatio - before) <= Math.abs(after - requestedRatio) ? before : after;
    }

    return Math.max(minimum, Math.min(maximum, ratio));
  };

  const getMaximumOpeningWidth = (wall: Wall, positionRatio: number, ignoredOpeningId?: string): number => {
    const length = getWallLength(wall) || 1;
    const safetyGap = Math.min(0.025, 8 / length);
    let halfRatio = Math.min(positionRatio - 0.035, 0.965 - positionRatio);

    getWallOpeningIntervals(wall, ignoredOpeningId).forEach((interval) => {
      if (interval.end <= positionRatio) halfRatio = Math.min(halfRatio, positionRatio - interval.end - safetyGap);
      if (interval.start >= positionRatio) halfRatio = Math.min(halfRatio, interval.start - positionRatio - safetyGap);
    });

    return Math.max(0, Math.min(length * 0.6, Math.max(0, halfRatio) * 2 * length));
  };

  const getWallPiecePath = (wall: Wall, start: number, end: number): string => {
    if (!wall.control) {
      const first = getPointOnWall(wall, start);
      const last = getPointOnWall(wall, end);
      return `M ${first.x} ${first.y} L ${last.x} ${last.y}`;
    }
    if (start === 0 && end === 1) return getWallPath(wall);

    const segments = Math.max(6, Math.ceil((end - start) * 64));
    const points = Array.from({ length: segments + 1 }, (_, index) => getPointOnWall(wall, start + ((end - start) * index) / segments));
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  };

  const getWallDimensionPosition = (wall: Wall) => {
    const ranges = getWallPieceRanges(wall);
    const middleRange = ranges.find((range) => range.start <= 0.5 && range.end >= 0.5);
    const longestRange = ranges.reduce<{ start: number; end: number } | null>((longest, range) => (
      !longest || range.end - range.start > longest.end - longest.start ? range : longest
    ), null);
    const ratio = middleRange ? 0.5 : longestRange ? (longestRange.start + longestRange.end) / 2 : 0.5;
    const point = getPointOnWall(wall, ratio);
    const tangent = getWallTangent(wall, ratio);
    const perpendicular = { x: -tangent.y, y: tangent.x };
    let rotation = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);
    if (rotation > 90 || rotation < -90) rotation += 180;
    return {
      x: point.x + perpendicular.x * 18,
      y: point.y + perpendicular.y * 18,
      rotation,
    };
  };

  const getCanvasCoordinates = (event: React.PointerEvent<SVGElement>): Point => {
    const svg = layoutSvgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    return {
      x: clampToCanvas((rawX / rect.width) * CANVAS_SIZE),
      y: clampToCanvas((rawY / rect.height) * CANVAS_SIZE),
    };
  };

  const isWallExcluded = (wallId: string, exclusion?: WallExclusion): boolean => {
    if (!exclusion) return false;
    return typeof exclusion === 'string' ? wallId === exclusion : exclusion.includes(wallId);
  };

  const getConnectorPoints = (exclusion?: WallExclusion): Point[] => (
    walls.flatMap((wall) => (
      isWallExcluded(wall.id, exclusion)
        ? []
        : [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }]
    ))
  );

  const getConnectedEndpointReferences = (point: Point, sourceWalls: Wall[]): WallEndpointReference[] => (
    sourceWalls.flatMap((wall) => {
      const references: WallEndpointReference[] = [];
      if (Math.hypot(wall.x1 - point.x, wall.y1 - point.y) <= CORNER_JOIN_DISTANCE) {
        references.push({ wallId: wall.id, endpoint: 'start' });
      }
      if (Math.hypot(wall.x2 - point.x, wall.y2 - point.y) <= CORNER_JOIN_DISTANCE) {
        references.push({ wallId: wall.id, endpoint: 'end' });
      }
      return references;
    })
  );

  const getConnectedWallReferences = (wall: Wall, sourceWalls: Wall[]): WallEndpointReference[] => {
    const references = [
      ...getConnectedEndpointReferences({ x: wall.x1, y: wall.y1 }, sourceWalls),
      ...getConnectedEndpointReferences({ x: wall.x2, y: wall.y2 }, sourceWalls),
    ].filter((reference) => reference.wallId !== wall.id);
    return references.filter((reference, index) => (
      references.findIndex((item) => item.wallId === reference.wallId && item.endpoint === reference.endpoint) === index
    ));
  };

  const getNearestConnectorPoint = (
    point: Point,
    exclusion?: WallExclusion,
    orientation?: 'horizontal' | 'vertical',
  ): Point | null => {
    let closestPoint: Point | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    getConnectorPoints(exclusion).forEach((candidate) => {
      if (orientation === 'horizontal' && candidate.y !== point.y) return;
      if (orientation === 'vertical' && candidate.x !== point.x) return;
      const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (distance <= CONNECTOR_SNAP_DISTANCE / zoom && distance < closestDistance) {
        closestPoint = candidate;
        closestDistance = distance;
      }
    });

    return closestPoint;
  };

  const getClosestWallPosition = (point: Point, wall: Wall) => {
    const sampleCount = wall.control ? 64 : 1;
    let closestDistance = Number.POSITIVE_INFINITY;
    let closestRatio = 0.5;

    for (let index = 0; index < sampleCount; index += 1) {
      const startRatio = index / sampleCount;
      const endRatio = (index + 1) / sampleCount;
      const start = getPointOnWall(wall, startRatio);
      const end = getPointOnWall(wall, endRatio);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const lengthSquared = dx * dx + dy * dy || 1;
      const segmentRatio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
      const projected = { x: start.x + dx * segmentRatio, y: start.y + dy * segmentRatio };
      const distance = Math.hypot(point.x - projected.x, point.y - projected.y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestRatio = startRatio + (endRatio - startRatio) * segmentRatio;
      }
    }

    return { ratio: closestRatio, distance: closestDistance };
  };

  const getNearestWallJoinPoint = (
    point: Point,
    exclusion?: WallExclusion,
    orientation?: 'horizontal' | 'vertical',
  ): Point | null => {
    let closestPoint: Point | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    walls.forEach((wall) => {
      if (isWallExcluded(wall.id, exclusion)) return;
      const position = getClosestWallPosition(point, wall);
      if (isWallPositionOpen(wall, position.ratio)) return;
      const candidate = getPointOnWall(wall, position.ratio);
      if (orientation === 'horizontal' && Math.abs(candidate.y - point.y) > GRID_GAP / 2) return;
      if (orientation === 'vertical' && Math.abs(candidate.x - point.x) > GRID_GAP / 2) return;
      if (position.distance <= CONNECTOR_SNAP_DISTANCE / zoom && position.distance < closestDistance) {
        closestPoint = candidate;
        closestDistance = position.distance;
      }
    });

    return closestPoint;
  };

  const getNearestLayoutSnapPoint = (
    point: Point,
    exclusion?: WallExclusion,
    orientation?: 'horizontal' | 'vertical',
  ): Point | null => {
    const endpoint = getNearestConnectorPoint(point, exclusion, orientation);
    const wallPoint = getNearestWallJoinPoint(point, exclusion, orientation);
    if (!endpoint) return wallPoint;
    if (!wallPoint) return endpoint;
    return Math.hypot(endpoint.x - point.x, endpoint.y - point.y) <= Math.hypot(wallPoint.x - point.x, wallPoint.y - point.y)
      ? endpoint
      : wallPoint;
  };

  const snapPointToConnector = (point: Point, exclusion?: WallExclusion): Point => (
    getNearestLayoutSnapPoint(point, exclusion) || snapPoint(point)
  );

  const getNearestWallFaceGuide = (point: Point, exclusion?: WallExclusion): { guide: SnapGuide; distance: number } | null => {
    let closest: { guide: SnapGuide; distance: number } | null = null;
    walls.forEach((wall) => {
      if (isWallExcluded(wall.id, exclusion)) return;
      const position = getClosestWallPosition(point, wall);
      if (isWallPositionOpen(wall, position.ratio) || position.distance > CONNECTOR_SNAP_DISTANCE / zoom) return;
      const wallPoint = getPointOnWall(wall, position.ratio);
      const tangent = getWallTangent(wall, position.ratio);
      const guide: SnapGuide = {
        kind: 'wall-face',
        point: wallPoint,
        pointer: point,
        lineStart: { x: wallPoint.x - tangent.x * CANVAS_SIZE, y: wallPoint.y - tangent.y * CANVAS_SIZE },
        lineEnd: { x: wallPoint.x + tangent.x * CANVAS_SIZE, y: wallPoint.y + tangent.y * CANVAS_SIZE },
      };
      if (!closest || position.distance < closest.distance) closest = { guide, distance: position.distance };
    });
    return closest;
  };

  const getSnapGuide = (point: Point, exclusion?: WallExclusion): SnapGuide | null => {
    const endpoint = getNearestConnectorPoint(point, exclusion);
    const endpointDistance = endpoint ? Math.hypot(endpoint.x - point.x, endpoint.y - point.y) : Number.POSITIVE_INFINITY;
    const wallFace = getNearestWallFaceGuide(point, exclusion);
    if (!endpoint && !wallFace) return null;
    if (!wallFace || endpointDistance <= wallFace.distance) {
      return endpoint ? { kind: 'corner', point: endpoint, pointer: point } : null;
    }
    return wallFace.guide;
  };

  const getWallSnapGuide = (wall: Wall, exclusion?: WallExclusion): SnapGuide | null => {
    const candidates = [
      { x: wall.x1, y: wall.y1 },
      { x: wall.x2, y: wall.y2 },
    ];
    let closest: { guide: SnapGuide; distance: number } | null = null;
    candidates.forEach((candidate) => {
      const guide = getSnapGuide(candidate, exclusion);
      if (!guide) return;
      const distance = Math.hypot(guide.point.x - candidate.x, guide.point.y - candidate.y);
      if (!closest || distance < closest.distance) closest = { guide, distance };
    });
    return closest?.guide || null;
  };

  const getGuidedPoint = (start: Point, current: Point, exclusion?: WallExclusion): Point => {
    const nearbyJoin = getSnapGuide(current, exclusion)?.point;
    if (nearbyJoin) return nearbyJoin;

    const snappedCurrent = snapPoint(current);
    const horizontalDistance = Math.abs(current.y - start.y);
    const verticalDistance = Math.abs(current.x - start.x);

    if (straightOnly) {
      return horizontalDistance <= verticalDistance
        ? { x: snappedCurrent.x, y: start.y }
        : { x: start.x, y: snappedCurrent.y };
    }

    const alignmentDistance = GRID_GAP * 0.35;
    if (horizontalDistance <= alignmentDistance && horizontalDistance <= verticalDistance) {
      return { x: snappedCurrent.x, y: start.y };
    }
    if (verticalDistance <= alignmentDistance) {
      return { x: start.x, y: snappedCurrent.y };
    }

    return snappedCurrent;
  };

  const getWallAtPoint = (point: Point): Wall | null => {
    let closestWall: Wall | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    walls.forEach((wall) => {
      if (wall.type === 'beam') return;
      const position = getClosestWallPosition(point, wall);
      if (isWallPositionOpen(wall, position.ratio)) return;
      if (position.distance < closestDistance) {
        closestWall = wall;
        closestDistance = position.distance;
      }
    });

    return closestDistance <= 44 / zoom ? closestWall : null;
  };

  const getWallPositionRatio = (point: Point, wall: Wall): number => {
    const ratio = getClosestWallPosition(point, wall).ratio;
    return Math.max(0.08, Math.min(0.92, ratio));
  };

  const isSameWall = (first: Wall, second: Wall): boolean => (
    first.x1 === second.x1
    && first.y1 === second.y1
    && first.x2 === second.x2
    && first.y2 === second.y2
    && first.type === second.type
    && first.control?.x === second.control?.x
    && first.control?.y === second.control?.y
    && JSON.stringify(first.breaks || []) === JSON.stringify(second.breaks || [])
  );

  const isSameAperture = (first: Aperture, second: Aperture): boolean => (
    first.wallId === second.wallId
    && first.type === second.type
    && first.positionRatio === second.positionRatio
    && first.width === second.width
    && first.hinge === second.hinge
    && first.swing === second.swing
  );

  const getMovedAperture = (aperture: Aperture, point: Point): Aperture => {
    const currentWall = walls.find((wall) => wall.id === aperture.wallId);
    const targetWall = getWallAtPoint(point) || currentWall;
    if (!targetWall) return aperture;
    const requestedRatio = getWallPositionRatio(point, targetWall);
    return {
      ...aperture,
      wallId: targetWall.id,
      positionRatio: getSafeOpeningRatio(targetWall, requestedRatio, aperture.width, aperture.id),
    };
  };

  const getMovedWall = (wall: Wall, pointerStart: Point, point: Point, exclusion?: WallExclusion): Wall => {
    const rawDeltaX = point.x - pointerStart.x;
    const rawDeltaY = point.y - pointerStart.y;
    const points = [
      { x: wall.x1, y: wall.y1 },
      { x: wall.x2, y: wall.y2 },
      ...(wall.control ? [wall.control] : []),
    ];
    const minX = Math.min(...points.map((item) => item.x));
    const maxX = Math.max(...points.map((item) => item.x));
    const minY = Math.min(...points.map((item) => item.y));
    const maxY = Math.max(...points.map((item) => item.y));
    const deltaX = Math.max(-minX, Math.min(CANVAS_SIZE - maxX, rawDeltaX));
    const deltaY = Math.max(-minY, Math.min(CANVAS_SIZE - maxY, rawDeltaY));
    const movedWall = {
      ...wall,
      x1: wall.x1 + deltaX,
      y1: wall.y1 + deltaY,
      x2: wall.x2 + deltaX,
      y2: wall.y2 + deltaY,
      control: wall.control ? { x: wall.control.x + deltaX, y: wall.control.y + deltaY } : undefined,
    };
    const excludedWallIds = [wall.id, ...(typeof exclusion === 'string' ? [exclusion] : exclusion ? [...exclusion] : [])];
    let closestSnap: { point: Point; target: Point; distance: number } | null = null;
    [
      { x: movedWall.x1, y: movedWall.y1 },
      { x: movedWall.x2, y: movedWall.y2 },
    ].forEach((candidate) => {
      const target = getNearestLayoutSnapPoint(candidate, excludedWallIds);
      if (!target) return;
      const distance = Math.hypot(target.x - candidate.x, target.y - candidate.y);
      if (distance <= CONNECTOR_SNAP_DISTANCE / zoom && (!closestSnap || distance < closestSnap.distance)) {
        closestSnap = { point: candidate, target, distance };
      }
    });
    if (!closestSnap) return movedWall;
    const snapDeltaX = closestSnap.target.x - closestSnap.point.x;
    const snapDeltaY = closestSnap.target.y - closestSnap.point.y;
    const adjustedDeltaX = Math.max(-minX, Math.min(CANVAS_SIZE - maxX, deltaX + snapDeltaX));
    const adjustedDeltaY = Math.max(-minY, Math.min(CANVAS_SIZE - maxY, deltaY + snapDeltaY));
    return {
      ...wall,
      x1: wall.x1 + adjustedDeltaX,
      y1: wall.y1 + adjustedDeltaY,
      x2: wall.x2 + adjustedDeltaX,
      y2: wall.y2 + adjustedDeltaY,
      control: wall.control ? { x: wall.control.x + adjustedDeltaX, y: wall.control.y + adjustedDeltaY } : undefined,
    };
  };

  const getResizedWall = (wall: Wall, endpoint: WallEndpoint, point: Point, exclusion: WallExclusion = wall.id): Wall => {
    const nextPoint = snapPointToConnector(point, exclusion);
    const oppositePoint = endpoint === 'start' ? { x: wall.x2, y: wall.y2 } : { x: wall.x1, y: wall.y1 };
    if (nextPoint.x === oppositePoint.x && nextPoint.y === oppositePoint.y) return wall;
    return endpoint === 'start'
      ? { ...wall, x1: nextPoint.x, y1: nextPoint.y }
      : { ...wall, x2: nextPoint.x, y2: nextPoint.y };
  };

  const getResizedJunctionWalls = (
    originalWalls: Wall[],
    linkedEndpoints: WallEndpointReference[],
    point: Point,
  ): Wall[] => {
    const linkedWallIds = [...new Set(linkedEndpoints.map((reference) => reference.wallId))];
    const nextPoint = snapPointToConnector(point, linkedWallIds);
    return originalWalls.map((wall) => {
      const references = linkedEndpoints.filter((reference) => reference.wallId === wall.id);
      return references.reduce((nextWall, reference) => getResizedWall(nextWall, reference.endpoint, nextPoint, linkedWallIds), wall);
    });
  };

  /**
   * The single place a layout change becomes undoable.
   *
   * `nextItems` defaults to the furniture already on the board, so the many callers that only touch
   * walls or openings did not have to change when furniture arrived.
   */
  const commitLayout = (nextWalls: Wall[], nextApertures: Aperture[], nextItems: PlacedItem[] = items) => {
    // The drawing has just diverged from whatever was saved, so the saved tick stops applying.
    setSavedLayoutId(null);
    const snapshot: LayoutSnapshot = {
      walls: nextWalls.map(cloneWall),
      apertures: nextApertures.map((aperture) => ({ ...aperture })),
      items: nextItems.map((item) => ({ ...item })),
    };
    const nextHistory = [...history.slice(0, historyIndex + 1), snapshot];
    setWalls(snapshot.walls);
    setApertures(snapshot.apertures);
    setItems(snapshot.items);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  // ---------------------------------------------------------------- furniture

  /**
   * Drops a piece of furniture into the middle of what the user is currently looking at.
   *
   * Sizing comes from the symbol's real-world metres multiplied by the board's own scale, so a king
   * bed lands two metres wide on the grid rather than an arbitrary number of pixels.
   */
  const addFurniture = (symbol: FurnitureSymbol) => {
    const viewport = canvasViewportRef.current;
    const centre = viewport
      ? {
        x: (viewport.scrollLeft + viewport.clientWidth / 2) / zoom,
        y: (viewport.scrollTop + viewport.clientHeight / 2) / zoom,
      }
      : { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };

    const item: PlacedItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      symbolId: symbol.id,
      x: Math.round(Math.min(CANVAS_SIZE, Math.max(0, centre.x))),
      y: Math.round(Math.min(CANVAS_SIZE, Math.max(0, centre.y))),
      rotation: 0,
      width: symbol.widthM * scalePixelsPerUnit,
      depth: symbol.depthM * scalePixelsPerUnit,
    };
    commitLayout(walls, apertures, [...items, item]);
    setSelectedTool('select');
    setSelectedElementId(item.id);
  };

  const rotateSelectedFurniture = (degrees: number) => {
    const target = items.find((item) => item.id === selectedElementId);
    if (!target) return;
    commitLayout(walls, apertures, items.map((item) => (
      item.id === target.id ? { ...item, rotation: (item.rotation + degrees + 360) % 360 } : item
    )));
  };

  const handleFurniturePointerDown = (event: React.PointerEvent<SVGGElement>, item: PlacedItem) => {
    // Without this the canvas would start panning underneath the drag.
    event.stopPropagation();
    event.preventDefault();
    const point = getCanvasCoordinates(event);
    setSelectedTool('select');
    setSelectedElementId(item.id);
    setLayoutFeedback('none');
    itemInteractionRef.current = {
      pointerId: event.pointerId,
      itemId: item.id,
      originalItems: items.map((entry) => ({ ...entry })),
      offsetX: point.x - item.x,
      offsetY: point.y - item.y,
      draftItems: items.map((entry) => ({ ...entry })),
      hasMoved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  // ---------------------------------------------------------------- trace underlay

  const handleUnderlaySelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setLayoutFeedback('none');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(file);
    }).catch(() => '');
    if (!dataUrl) return;

    // Measure it so the underlay keeps the plan's real proportions, then fit it to most of the
    // board. A plan squashed to a square is useless to trace over.
    const size = await new Promise<{ w: number; h: number }>((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ w: image.naturalWidth || 1, h: image.naturalHeight || 1 });
      image.onerror = () => resolve({ w: 1, h: 1 });
      image.src = dataUrl;
    });

    const fitted = CANVAS_SIZE * 0.8;
    const width = size.w >= size.h ? fitted : fitted * (size.w / size.h);
    const height = size.w >= size.h ? fitted * (size.h / size.w) : fitted;
    setUnderlay({
      dataUrl,
      name: file.name,
      x: (CANVAS_SIZE - width) / 2,
      y: (CANVAS_SIZE - height) / 2,
      width,
      height,
      opacity: 0.45,
      locked: false,
    });
    setIsTraceOpen(true);
  };

  /** Resizes the underlay about its own centre, so scaling never walks it off the board. */
  const scaleUnderlay = (factor: number) => {
    setUnderlay((current) => {
      if (!current) return current;
      const width = Math.min(CANVAS_SIZE * 3, Math.max(CANVAS_SIZE * 0.1, current.width * factor));
      const height = width * (current.height / current.width);
      return {
        ...current,
        width,
        height,
        x: current.x + (current.width - width) / 2,
        y: current.y + (current.height - height) / 2,
      };
    });
  };

  const handleUnderlayPointerDown = (event: React.PointerEvent<SVGImageElement>) => {
    if (!underlay || underlay.locked || selectedTool !== 'select') return;
    event.stopPropagation();
    event.preventDefault();
    const point = getCanvasCoordinates(event);
    underlayInteractionRef.current = {
      pointerId: event.pointerId,
      offsetX: point.x - underlay.x,
      offsetY: point.y - underlay.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const applyDesignerBrief = (brief: DesignerBrief) => {
    const draft = buildEngineDraft(brief);
    const compiled = compileEngineDraft(draft, scalePixelsPerUnit);
    commitLayout(compiled.walls as Wall[], compiled.apertures as Aperture[]);
    setRoomLabels(compiled.labels);
    setEditingLabelId(null);
    resetDrawing();
    setSelectedElementId(null);
    setSelectedTool('select');
    setSnapGuide(null);
    setLayoutFeedback('none');
    setWorkspaceMode('draw');
    return draft;
  };

  const pushAssistantMessage = (content: string, extra: Partial<DesignerChatEntry> = {}) => {
    setDesignerChat((current) => [...current, {
      id: `designer-assistant-${Date.now()}-${current.length}`,
      role: 'assistant',
      content,
      ...extra,
    }]);
  };

  const addOpeningToSelectedWall = (wall: Wall, kind: 'door' | 'window' | 'opening') => {
    const widthUnits = kind === 'door' ? 0.9 : kind === 'window' ? 1.2 : 1.5;
    const width = widthUnits * scalePixelsPerUnit;
    const ratio = getSafeOpeningRatio(wall, 0.5, width);
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (kind === 'opening') {
      const nextWalls = walls.map((item) => (
        item.id === wall.id
          ? { ...item, breaks: [...(item.breaks || []), { id: `break_${stamp}`, positionRatio: ratio, width }] }
          : item
      ));
      commitLayout(nextWalls, apertures);
      setSelectedElementId(`break_${stamp}`);
      return true;
    }

    const aperture: Aperture = {
      id: `${kind}_${stamp}`,
      wallId: wall.id,
      type: kind,
      positionRatio: ratio,
      width,
      ...(kind === 'door' ? { hinge: 'start' as DoorHinge, swing: 'right' as DoorSwing } : {}),
    };
    commitLayout(walls, [...apertures, aperture]);
    setSelectedElementId(aperture.id);
    return true;
  };

  const executeEditCommand = (command: DesignerEditCommand): { didApply: boolean; detail?: string } => {
    const selectedWallForEdit = walls.find((wall) => wall.id === selectedElementId && wall.type !== 'beam') || null;

    switch (command.kind) {
      case 'clear-plan': {
        commitLayout([], [], []);
        setRoomLabels([]);
        setEditingLabelId(null);
        setSelectedElementId(null);
        return { didApply: true };
      }
      case 'undo': {
        if (historyIndex < 0) return { didApply: false };
        const nextIndex = historyIndex - 1;
        const snapshot: LayoutSnapshot = nextIndex >= 0 ? history[nextIndex] : { walls: [], apertures: [], items: [] };
        setWalls(snapshot.walls.map(cloneWall));
        setApertures(snapshot.apertures.map((aperture) => ({ ...aperture })));
        setItems((snapshot.items || []).map((item) => ({ ...item })));
        setHistoryIndex(nextIndex);
        setSelectedElementId(null);
        return { didApply: true };
      }
      case 'remove-wall': {
        const target = walls.find((wall) => wall.id === selectedElementId);
        if (!target) return { didApply: false };
        commitLayout(
          walls.filter((wall) => wall.id !== target.id),
          apertures.filter((aperture) => aperture.wallId !== target.id),
        );
        setSelectedElementId(null);
        return { didApply: true };
      }
      case 'remove-opening': {
        const aperture = apertures.find((item) => item.id === selectedElementId);
        if (aperture) {
          commitLayout(walls, apertures.filter((item) => item.id !== aperture.id));
          setSelectedElementId(null);
          return { didApply: true };
        }
        const breakOwner = walls.find((wall) => wall.breaks?.some((item) => item.id === selectedElementId));
        if (!breakOwner) return { didApply: false };
        commitLayout(
          walls.map((wall) => (
            wall.id === breakOwner.id
              ? { ...wall, breaks: (wall.breaks || []).filter((item) => item.id !== selectedElementId) }
              : wall
          )),
          apertures,
        );
        setSelectedElementId(null);
        return { didApply: true };
      }
      case 'add-column': {
        const size = Math.max(GRID_GAP, scalePixelsPerUnit * 0.6);
        const center = CANVAS_SIZE / 2;
        const column: Wall = {
          id: `wall_column_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          x1: center - size / 2,
          y1: center,
          x2: center + size / 2,
          y2: center,
          type: 'beam',
        };
        commitLayout([...walls, column], apertures);
        setSelectedTool('select');
        setSelectedElementId(column.id);
        return { didApply: true };
      }
      case 'add-beam': {
        setSelectedTool('beam');
        return { didApply: true };
      }
      case 'add-wall': {
        setSelectedTool('wall');
        return { didApply: true };
      }
      case 'add-room': {
        setSelectedTool('room');
        return { didApply: true };
      }
      case 'add-door':
      case 'add-window':
      case 'add-opening': {
        const kind = command.kind === 'add-door' ? 'door' : command.kind === 'add-window' ? 'window' : 'opening';
        if (selectedWallForEdit) {
          return { didApply: addOpeningToSelectedWall(selectedWallForEdit, kind) };
        }
        setSelectedTool(kind === 'opening' ? 'break' : kind);
        return { didApply: false };
      }
      case 'rename-room': {
        if (!roomLabels.length) return { didApply: false };
        const hint = command.roomHint?.toLowerCase().trim();
        const target = (hint
          ? roomLabels.find((label) => label.name.toLowerCase().includes(hint) || label.roomId.toLowerCase().includes(hint))
          : null)
          || roomLabels.find((label) => label.roomId === selectedElementId)
          || null;
        if (!target) return { didApply: false };
        setRoomLabels((current) => current.map((label) => (
          label.roomId === target.roomId ? { ...label, name: command.nextName } : label
        )));
        return { didApply: true };
      }
      case 'add-item': {
        const symbol = findFurnitureSymbol(command.itemHint);
        if (!symbol) return { didApply: false };
        addFurniture(symbol);
        return { didApply: true };
      }
      case 'remove-item': {
        const item = findPlacedItemByHint(items, command.itemHint, selectedElementId);
        if (!item) return { didApply: false };
        commitLayout(walls, apertures, items.filter((entry) => entry.id !== item.id));
        setSelectedElementId(null);
        return { didApply: true };
      }
      case 'move-item': {
        const item = findPlacedItemByHint(items, command.itemHint, selectedElementId);
        if (!item) return { didApply: false };

        // The room the piece currently sits in decides which side of a wall is "inside". Falls
        // back to the canvas centre when the plan has no labels yet.
        const reference = roomLabels.length
          ? roomLabels.reduce((closest, label) => (
            Math.hypot(label.x - item.x, label.y - item.y) < Math.hypot(closest.x - item.x, closest.y - item.y) ? label : closest
          ))
          : { x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 };

        const inwardNormal = (wall: Wall, point: Point): Point => {
          const length = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) || 1;
          const dx = (wall.x2 - wall.x1) / length;
          const dy = (wall.y2 - wall.y1) / length;
          const first = { x: -dy, y: dx };
          const facesRoom = first.x * (reference.x - point.x) + first.y * (reference.y - point.y);
          return facesRoom >= 0 ? first : { x: dy, y: -dx };
        };

        // Sits the piece against a wall, inside the room, facing into it. Rotation snaps to a
        // right angle because furniture floating at 37 degrees looks like a mistake on a plan.
        const placeBesideWall = (wall: Wall, point: Point) => {
          const inward = inwardNormal(wall, point);
          const offset = item.depth / 2 + scalePixelsPerUnit * 0.15;
          const x = clampToCanvas(snapToGrid(point.x + inward.x * offset));
          const y = clampToCanvas(snapToGrid(point.y + inward.y * offset));
          const degrees = (Math.atan2(inward.x, inward.y) * 180) / Math.PI;
          const rotation = ((Math.round(degrees / 90) * 90) + 360) % 360;
          return { x, y, rotation };
        };

        let destination: { x: number; y: number; rotation?: number } | null = null;
        if (command.target.type === 'window' || command.target.type === 'door') {
          const targetType = command.target.type;
          const candidates = apertures
            .filter((aperture) => aperture.type === targetType)
            .map((aperture) => {
              const wall = walls.find((entry) => entry.id === aperture.wallId);
              if (!wall) return null;
              const point = getPointOnWall(wall, aperture.positionRatio);
              return { wall, point, distance: Math.hypot(point.x - item.x, point.y - item.y) };
            })
            .filter((entry): entry is { wall: Wall; point: Point; distance: number } => entry !== null)
            .sort((first, second) => first.distance - second.distance);
          if (!candidates.length) return { didApply: false };
          destination = placeBesideWall(candidates[0].wall, candidates[0].point);
        } else if (command.target.type === 'wall') {
          const candidates = walls
            .filter((wall) => wall.type !== 'beam')
            .map((wall) => {
              const position = getClosestWallPosition({ x: item.x, y: item.y }, wall);
              return { wall, point: getPointOnWall(wall, position.ratio), distance: position.distance };
            })
            .sort((first, second) => first.distance - second.distance);
          if (!candidates.length) return { didApply: false };
          destination = placeBesideWall(candidates[0].wall, candidates[0].point);
        } else if (command.target.type === 'item') {
          const anchor = findPlacedItemByHint(items, command.target.itemHint, undefined, item.id);
          if (!anchor) return { didApply: false };
          const gap = scalePixelsPerUnit * 0.4;
          destination = {
            x: clampToCanvas(snapToGrid(anchor.x + anchor.width / 2 + gap + item.width / 2)),
            y: clampToCanvas(snapToGrid(anchor.y)),
          };
        } else {
          const hint = command.target.roomHint.toLowerCase();
          const label = roomLabels.find((entry) => entry.name.toLowerCase().includes(hint));
          if (!label) return { didApply: false };
          destination = { x: clampToCanvas(snapToGrid(label.x)), y: clampToCanvas(snapToGrid(label.y)) };
        }
        if (!destination) return { didApply: false };
        const next = destination;
        commitLayout(walls, apertures, items.map((entry) => (
          entry.id === item.id
            ? { ...entry, x: next.x, y: next.y, rotation: next.rotation ?? entry.rotation }
            : entry
        )));
        setSelectedElementId(item.id);
        return { didApply: true };
      }
      case 'space-items': {
        const first = findPlacedItemByHint(items, command.firstHint, selectedElementId);
        const second = findPlacedItemByHint(items, command.secondHint, undefined, first?.id);
        if (!first || !second) return { didApply: false };
        const gapNeeded = scalePixelsPerUnit * 0.8;
        const dx = second.x - first.x;
        const dy = second.y - first.y;
        const distance = Math.hypot(dx, dy);
        const currentGap = distance - (Math.max(first.width, first.depth) / 2 + Math.max(second.width, second.depth) / 2);
        if (currentGap >= gapNeeded) {
          return { didApply: true, detail: isArabic ? 'بينهم مسافة كافية أصلًا.' : 'They already have enough space between them.' };
        }
        const push = gapNeeded - Math.max(currentGap, 0);
        const ux = distance > 1 ? dx / distance : 1;
        const uy = distance > 1 ? dy / distance : 0;
        const x = clampToCanvas(snapToGrid(second.x + ux * push));
        const y = clampToCanvas(snapToGrid(second.y + uy * push));
        commitLayout(walls, apertures, items.map((entry) => (
          entry.id === second.id ? { ...entry, x, y } : entry
        )));
        setSelectedElementId(second.id);
        return { didApply: true };
      }
      default:
        return { didApply: false };
    }
  };

  const finalizeDesignerBrief = (brief: DesignerBrief, notes: string[]) => {
    const draft = applyDesignerBrief(brief);
    const extraNotes = [...notes];
    if (draft.unsatisfiedConnections.length) {
      extraNotes.push(isArabic
        ? `لم أتمكن من إعطاء ${draft.unsatisfiedConnections.length} وصلة جدارًا مشتركًا، عدّلها يدويًا أو اطلب ترتيبًا مختلفًا.`
        : `I could not give ${draft.unsatisfiedConnections.length} connection(s) a shared wall, so adjust them by hand or ask me for a different arrangement.`);
    }
    pushAssistantMessage(buildAssistantReply(draft, plannerLanguage), {
      summary: brief.summary,
      assumptions: [...brief.assumptions, ...extraNotes],
      questions: brief.questions,
    });
  };

  const openFollowUpForBrief = (brief: DesignerBrief, request: string) => {
    const fields = buildFollowUpForm({ brief, language: plannerLanguage, unitLabel: scaleUnit });
    setPendingBrief(brief);
    setPendingRequest(request);
    if (!fields.length) {
      finalizeDesignerBrief(brief, []);
      setPendingBrief(null);
      return;
    }
    setFollowUpFields(fields);
    setFollowUpAnswers(buildDefaultAnswers(fields));
    setFollowUpOpen(true);
    pushAssistantMessage(
      isArabic
        ? 'فهمت طلبك، وفتحت لك نموذجًا سريعًا بالأسئلة المهمة فقط حتى يخرج المخطط دقيقًا.'
        : 'I understood your request, and I opened a quick form with only the important questions so the plan comes out accurate.',
      { summary: brief.summary, questions: brief.questions },
    );
  };

  const handleDesignerSend = async () => {
    const request = designerPrompt.trim();
    if (!request || designerIsLoading) return;
    if (isGuest) {
      setGuestDialogOpen(true);
      return;
    }

    const userEntry: DesignerChatEntry = {
      id: `designer-user-${Date.now()}`,
      role: 'user',
      content: request,
    };
    const nextChat = [...designerChat, userEntry];
    setDesignerChat(nextChat);
    setDesignerPrompt('');

    const command = walls.length ? parseDesignerEditCommand(request, plannerLanguage) : null;
    if (command) {
      const result = executeEditCommand(command);
      pushAssistantMessage(describeEditCommand(command, plannerLanguage, result));
      return;
    }

    const conversation: DesignerChatTurn[] = nextChat.map((entry) => ({
      role: entry.role,
      content: entry.summary ? `${entry.summary}\n${entry.content}` : entry.content,
    }));
    const combinedUserRequests = nextChat
      .filter((entry) => entry.role === 'user')
      .map((entry) => entry.content)
      .join('\n');

    setDesignerIsLoading(true);
    try {
      const currentLayoutSummary = summarizeCurrentLayout({
        walls,
        apertures,
        pixelsPerUnit: scalePixelsPerUnit,
        language: plannerLanguage,
      });
      const prompt = buildDesignerAiPrompt({
        language: plannerLanguage,
        request,
        conversation,
        currentLayoutSummary,
      });
      const aiResult = await WaktiAIV2Service.sendMessage(
        prompt,
        undefined,
        plannerLanguage,
        null,
        'text',
        [],
        true,
        'chat',
      );
      const parsedBrief = !aiResult?.error
        ? parseDesignerBriefFromResponse(aiResult?.response || '', plannerLanguage)
        : null;
      openFollowUpForBrief(
        parsedBrief || buildLocalDesignerBrief(combinedUserRequests || request, plannerLanguage),
        request,
      );
    } catch {
      openFollowUpForBrief(buildLocalDesignerBrief(combinedUserRequests || request, plannerLanguage), request);
    } finally {
      setDesignerIsLoading(false);
    }
  };

  const handleFollowUpAnswerChange = (fieldId: string, value: string) => {
    setFollowUpAnswers((current) => ({ ...current, [fieldId]: value }));
  };

  const handleFollowUpSubmit = () => {
    if (!pendingBrief) {
      setFollowUpOpen(false);
      return;
    }
    const applied = applyFollowUpAnswers({ brief: pendingBrief, answers: followUpAnswers, language: plannerLanguage });
    setFollowUpOpen(false);
    finalizeDesignerBrief(applied.brief, applied.notes);
    setPendingBrief(null);
  };

  const handleFollowUpSkip = () => {
    const brief = pendingBrief;
    setFollowUpOpen(false);
    setPendingBrief(null);
    if (!brief) return;
    finalizeDesignerBrief(brief, []);
  };

  const handleLabelPointerDown = (event: React.PointerEvent<SVGGElement>, label: DesignerRoomLabel) => {
    if (selectedTool !== 'select') return;
    event.preventDefault();
    event.stopPropagation();
    const point = getCanvasCoordinates(event);
    labelDragRef.current = {
      pointerId: event.pointerId,
      labelId: label.roomId,
      offsetX: point.x - label.x,
      offsetY: point.y - label.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedElementId(label.roomId);
  };

  const handleLabelPointerMove = (event: React.PointerEvent<SVGGElement>) => {
    const drag = labelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const point = getCanvasCoordinates(event);
    setRoomLabels((current) => current.map((label) => (
      label.roomId === drag.labelId
        ? { ...label, x: point.x - drag.offsetX, y: point.y - drag.offsetY }
        : label
    )));
  };

  const handleLabelPointerUp = (event: React.PointerEvent<SVGGElement>) => {
    const drag = labelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    labelDragRef.current = null;
  };

  const startLabelEditing = (label: DesignerRoomLabel) => {
    setEditingLabelId(label.roomId);
    setLabelDraft(label.name);
  };

  const commitLabelEditing = () => {
    if (!editingLabelId) return;
    const nextName = labelDraft.trim();
    if (nextName) {
      setRoomLabels((current) => current.map((label) => (
        label.roomId === editingLabelId ? { ...label, name: nextName } : label
      )));
    }
    setEditingLabelId(null);
    setLabelDraft('');
  };

  function resetDrawing() {
    setDrawingStart(null);
    setCurrentDrawingPoint(null);
    setCurveEndPoint(null);
    setSnapGuide(null);
    pointerStartRef.current = null;
    pointerWasDrawingRef.current = false;
    hadExistingStartRef.current = false;
  }

  const completeWall = (
    start: Point,
    end: Point,
    control?: Point,
    type: Wall['type'] = newWallType,
  ) => {
    if (start.x === end.x && start.y === end.y) return;
    const wall: Wall = {
      id: `wall_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      type,
      control,
    };
    commitLayout([...walls, wall], apertures);
    setSelectedElementId(wall.id);
    setLayoutFeedback(type === 'beam' ? 'beam-added' : control ? 'curve-added' : 'wall-added');
    resetDrawing();
  };

  const completeRoom = (start: Point, end: Point) => {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    if (maxX - minX < GRID_GAP * 2 || maxY - minY < GRID_GAP * 2) return;

    const corners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
    const timestamp = Date.now();
    const roomWalls = corners.map((corner, index): Wall => {
      const nextCorner = corners[(index + 1) % corners.length];
      return {
        id: `wall_${timestamp}_${index}_${Math.random().toString(36).slice(2, 6)}`,
        x1: corner.x,
        y1: corner.y,
        x2: nextCorner.x,
        y2: nextCorner.y,
        type: newWallType,
      };
    });
    commitLayout([...walls, ...roomWalls], apertures);
    setSelectedElementId(roomWalls[0].id);
    setLayoutFeedback('room-added');
    resetDrawing();
  };

  const startWallInteraction = (
    event: React.PointerEvent<SVGElement>,
    wall: Wall,
    kind: WallInteraction['kind'],
    endpoint?: WallEndpoint,
  ) => {
    if (selectedTool !== 'select') return;
    event.preventDefault();
    event.stopPropagation();
    const svg = layoutSvgRef.current;
    if (!svg) return;
    const originalWalls = walls.map(cloneWall);
    const originalWall = originalWalls.find((item) => item.id === wall.id) || cloneWall(wall);
    const endpointPoint = endpoint === 'start'
      ? { x: originalWall.x1, y: originalWall.y1 }
      : endpoint === 'end'
        ? { x: originalWall.x2, y: originalWall.y2 }
        : null;
    const linkedEndpoints = endpointPoint
      ? getConnectedEndpointReferences(endpointPoint, originalWalls)
      : kind === 'move'
        ? getConnectedWallReferences(originalWall, originalWalls)
        : [];
    wallInteractionRef.current = {
      kind,
      pointerId: event.pointerId,
      wallId: wall.id,
      endpoint,
      linkedEndpoints,
      pointerStart: snapPoint(getCanvasCoordinates(event)),
      originalWall,
      originalWalls,
      originalApertures: apertures.map((aperture) => ({ ...aperture })),
      draftWalls: originalWalls,
      hasMoved: false,
    };
    svg.setPointerCapture(event.pointerId);
    setSelectedElementId(wall.id);
    setSnapGuide(null);
    setLayoutFeedback('none');
  };

  // Typed to SVGElement because walls render as <path>, not <line>. It was declared as SVGLineElement
  // and every call site was quietly a type error.
  const handleWallPointerDown = (event: React.PointerEvent<SVGElement>, wall: Wall) => {
    startWallInteraction(event, wall, 'move');
  };

  const handleWallEndpointPointerDown = (
    event: React.PointerEvent<SVGCircleElement>,
    wall: Wall,
    endpoint: WallEndpoint,
  ) => {
    startWallInteraction(event, wall, 'resize', endpoint);
  };

  const handleWallCurvePointerDown = (event: React.PointerEvent<SVGCircleElement>, wall: Wall) => {
    startWallInteraction(event, wall, 'curve');
  };

  const startWallBreakInteraction = (event: React.PointerEvent<SVGCircleElement>, wall: Wall, wallBreak: WallBreak) => {
    if (selectedTool === 'break') {
      event.stopPropagation();
      setSelectedElementId(wallBreak.id);
      return;
    }
    if (selectedTool !== 'select') return;
    event.preventDefault();
    event.stopPropagation();
    const svg = layoutSvgRef.current;
    if (!svg) return;
    const originalWalls = walls.map(cloneWall);
    const originalWall = originalWalls.find((item) => item.id === wall.id);
    const originalBreak = originalWall?.breaks?.find((item) => item.id === wallBreak.id) || { ...wallBreak };
    wallBreakInteractionRef.current = {
      pointerId: event.pointerId,
      wallId: wall.id,
      breakId: wallBreak.id,
      originalBreak,
      originalWalls,
      originalApertures: apertures.map((aperture) => ({ ...aperture })),
      draftBreak: originalBreak,
      hasMoved: false,
    };
    svg.setPointerCapture(event.pointerId);
    setSelectedElementId(wallBreak.id);
    setLayoutFeedback('none');
  };

  const handleWallBreakPointerDown = (event: React.PointerEvent<SVGCircleElement>, wall: Wall, wallBreak: WallBreak) => {
    startWallBreakInteraction(event, wall, wallBreak);
  };

  const startApertureInteraction = (event: React.PointerEvent<SVGGElement>, aperture: Aperture) => {
    if (selectedTool !== 'select') return;
    event.preventDefault();
    event.stopPropagation();
    const svg = layoutSvgRef.current;
    if (!svg) return;
    const originalApertures = apertures.map((item) => ({ ...item }));
    const originalAperture = originalApertures.find((item) => item.id === aperture.id) || { ...aperture };
    apertureInteractionRef.current = {
      pointerId: event.pointerId,
      apertureId: aperture.id,
      originalAperture,
      originalWalls: walls.map(cloneWall),
      originalApertures,
      draftAperture: originalAperture,
      hasMoved: false,
    };
    svg.setPointerCapture(event.pointerId);
    setSelectedElementId(aperture.id);
    setLayoutFeedback('none');
  };

  const handleAperturePointerDown = (event: React.PointerEvent<SVGGElement>, aperture: Aperture) => {
    startApertureInteraction(event, aperture);
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (selectedTool === 'select') {
      const viewport = canvasViewportRef.current;
      setSelectedElementId(null);
      setLayoutFeedback('none');
      if (!viewport) return;
      event.preventDefault();
      canvasPanRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    event.preventDefault();
    const point = getCanvasCoordinates(event);

    if (selectedTool === 'door' || selectedTool === 'window') {
      const wall = getWallAtPoint(point);
      if (!wall) {
        setLayoutFeedback('wall-required');
        return;
      }
      const requestedRatio = getWallPositionRatio(point, wall);
      const requestedWidth = scalePixelsPerUnit * (selectedTool === 'door' ? 0.9 : 1.2);
      const maximumWidth = getMaximumOpeningWidth(wall, requestedRatio);
      if (maximumWidth < scalePixelsPerUnit * 0.55) {
        setLayoutFeedback('opening-overlap');
        return;
      }
      const aperture: Aperture = {
        id: `aperture_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        wallId: wall.id,
        type: selectedTool,
        positionRatio: getSafeOpeningRatio(wall, requestedRatio, Math.min(requestedWidth, maximumWidth)),
        width: Math.min(requestedWidth, maximumWidth),
        hinge: selectedTool === 'door' ? 'start' : undefined,
        swing: selectedTool === 'door' ? 'right' : undefined,
      };
      commitLayout(walls, [...apertures, aperture]);
      setSelectedElementId(aperture.id);
      setLayoutFeedback(selectedTool === 'door' ? 'door-added' : 'window-added');
      return;
    }

    if (selectedTool === 'break') {
      const wall = getWallAtPoint(point);
      if (!wall) {
        setLayoutFeedback('break-wall-required');
        return;
      }
      const requestedRatio = getWallPositionRatio(point, wall);
      const requestedWidth = scalePixelsPerUnit * (newWallType === 'structural' ? 2.4 : 1.5);
      const maximumWidth = getMaximumOpeningWidth(wall, requestedRatio);
      if (maximumWidth < scalePixelsPerUnit * 0.8) {
        setLayoutFeedback('opening-overlap');
        return;
      }
      const width = Math.min(requestedWidth, maximumWidth);
      const wallBreak: WallBreak = {
        id: `break_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        positionRatio: getSafeOpeningRatio(wall, requestedRatio, width),
        width,
      };
      const nextWalls = walls.map((item) => (
        item.id === wall.id ? { ...item, breaks: [...(item.breaks || []), wallBreak] } : item
      ));
      commitLayout(nextWalls, apertures);
      setSelectedElementId(wallBreak.id);
      setLayoutFeedback('break-added');
      return;
    }

    if (selectedTool === 'curve') {
      const connectedPoint = snapPointToConnector(point);
      setSnapGuide(getSnapGuide(point));
      if (!drawingStartRef.current) {
        setDrawingStart(connectedPoint);
        setCurrentDrawingPoint(connectedPoint);
        setLayoutFeedback('none');
        return;
      }
      if (!curveEndPoint) {
        if (drawingStartRef.current.x !== connectedPoint.x || drawingStartRef.current.y !== connectedPoint.y) {
          setCurveEndPoint(connectedPoint);
          setCurrentDrawingPoint(connectedPoint);
        }
        return;
      }
      completeWall(drawingStartRef.current, curveEndPoint, snapPoint(point));
      return;
    }

    if (selectedTool !== 'wall' && selectedTool !== 'room' && selectedTool !== 'beam') return;

    const connectedPoint = snapPointToConnector(point);
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerStartRef.current = connectedPoint;
    pointerWasDrawingRef.current = false;
    hadExistingStartRef.current = Boolean(drawingStartRef.current);
    setSnapGuide(getSnapGuide(point));
    setLayoutFeedback('none');

    if (drawingStartRef.current) {
      setCurrentDrawingPoint(selectedTool === 'room'
        ? connectedPoint
        : getGuidedPoint(drawingStartRef.current, point));
      return;
    }

    setDrawingStart(connectedPoint);
    setCurrentDrawingPoint(connectedPoint);
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const canvasPan = canvasPanRef.current;
    if (canvasPan && canvasPan.pointerId === event.pointerId) {
      const viewport = canvasViewportRef.current;
      if (viewport) {
        viewport.scrollLeft = canvasPan.scrollLeft - (event.clientX - canvasPan.clientX);
        viewport.scrollTop = canvasPan.scrollTop - (event.clientY - canvasPan.clientY);
      }
      return;
    }

    // Furniture and the underlay are checked first: both are dragged directly and neither needs
    // any of the wall snapping below.
    const itemInteraction = itemInteractionRef.current;
    if (itemInteraction && itemInteraction.pointerId === event.pointerId) {
      const point = getCanvasCoordinates(event);
      const nextX = Math.min(CANVAS_SIZE, Math.max(0, point.x - itemInteraction.offsetX));
      const nextY = Math.min(CANVAS_SIZE, Math.max(0, point.y - itemInteraction.offsetY));
      const draftItems = itemInteraction.originalItems.map((entry) => (
        entry.id === itemInteraction.itemId ? { ...entry, x: nextX, y: nextY } : entry
      ));
      itemInteraction.draftItems = draftItems;
      itemInteraction.hasMoved = true;
      setItems(draftItems);
      return;
    }

    const underlayInteraction = underlayInteractionRef.current;
    if (underlayInteraction && underlayInteraction.pointerId === event.pointerId) {
      const point = getCanvasCoordinates(event);
      setUnderlay((current) => (current ? {
        ...current,
        x: point.x - underlayInteraction.offsetX,
        y: point.y - underlayInteraction.offsetY,
      } : current));
      return;
    }

    const wallBreakInteraction = wallBreakInteractionRef.current;
    if (wallBreakInteraction && wallBreakInteraction.pointerId === event.pointerId) {
      const originalWall = wallBreakInteraction.originalWalls.find((wall) => wall.id === wallBreakInteraction.wallId);
      if (!originalWall) return;
      const draftBreak = {
        ...wallBreakInteraction.originalBreak,
        positionRatio: getSafeOpeningRatio(
          originalWall,
          getWallPositionRatio(getCanvasCoordinates(event), originalWall),
          wallBreakInteraction.originalBreak.width,
          wallBreakInteraction.breakId,
        ),
      };
      wallBreakInteraction.draftBreak = draftBreak;
      wallBreakInteraction.hasMoved = draftBreak.positionRatio !== wallBreakInteraction.originalBreak.positionRatio;
      setWalls((current) => current.map((wall) => (
        wall.id === wallBreakInteraction.wallId
          ? { ...wall, breaks: (wall.breaks || []).map((wallBreak) => (wallBreak.id === wallBreakInteraction.breakId ? draftBreak : wallBreak)) }
          : wall
      )));
      return;
    }

    const apertureInteraction = apertureInteractionRef.current;
    if (apertureInteraction && apertureInteraction.pointerId === event.pointerId) {
      const draftAperture = getMovedAperture(apertureInteraction.originalAperture, getCanvasCoordinates(event));
      apertureInteraction.draftAperture = draftAperture;
      apertureInteraction.hasMoved = !isSameAperture(apertureInteraction.originalAperture, draftAperture);
      setApertures((current) => current.map((aperture) => (
        aperture.id === apertureInteraction.apertureId ? draftAperture : aperture
      )));
      return;
    }

    const interaction = wallInteractionRef.current;
    if (interaction && interaction.pointerId === event.pointerId) {
      const rawPoint = getCanvasCoordinates(event);
      const point = interaction.kind === 'move' ? rawPoint : snapPoint(rawPoint);
      const linkedWallIds = [...new Set([interaction.wallId, ...interaction.linkedEndpoints.map((reference) => reference.wallId)])];
      const draftWalls = interaction.kind === 'resize' && interaction.endpoint
        ? getResizedJunctionWalls(interaction.originalWalls, interaction.linkedEndpoints, point)
        : interaction.originalWalls.map((wall) => {
          if (wall.id !== interaction.wallId) return wall;
          return interaction.kind === 'curve'
            ? { ...wall, control: point }
            : getMovedWall(wall, interaction.pointerStart, point, linkedWallIds);
        });
      const draftWall = draftWalls.find((wall) => wall.id === interaction.wallId);
      setSnapGuide(interaction.kind === 'resize'
        ? getSnapGuide(rawPoint, linkedWallIds)
        : interaction.kind === 'move' && draftWall
          ? getWallSnapGuide(draftWall, linkedWallIds)
          : getSnapGuide(rawPoint, interaction.wallId));
      interaction.draftWalls = draftWalls;
      interaction.hasMoved = draftWalls.some((wall, index) => !isSameWall(wall, interaction.originalWalls[index]));
      setWalls(draftWalls);
      return;
    }

    if (selectedTool === 'curve' && drawingStartRef.current) {
      const rawPoint = getCanvasCoordinates(event);
      setSnapGuide(curveEndPoint ? null : getSnapGuide(rawPoint));
      setCurrentDrawingPoint(curveEndPoint ? snapPoint(rawPoint) : snapPointToConnector(rawPoint));
      return;
    }

    if ((selectedTool !== 'wall' && selectedTool !== 'room' && selectedTool !== 'beam') || !drawingStartRef.current) return;
    const rawPoint = getCanvasCoordinates(event);
    const point = snapPointToConnector(rawPoint);
    const pointerStart = pointerStartRef.current;
    if (pointerStart && Math.hypot(point.x - pointerStart.x, point.y - pointerStart.y) >= GRID_GAP / 2) {
      pointerWasDrawingRef.current = true;
    }
    setSnapGuide(getSnapGuide(rawPoint));
    setCurrentDrawingPoint(selectedTool === 'room'
      ? point
      : getGuidedPoint(drawingStartRef.current, rawPoint));
  };

  const handleCanvasPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    const itemInteraction = itemInteractionRef.current;
    if (itemInteraction && itemInteraction.pointerId === event.pointerId) {
      itemInteractionRef.current = null;
      // Only a real move earns a history entry; a plain tap just selects.
      if (itemInteraction.hasMoved) commitLayout(walls, apertures, itemInteraction.draftItems);
      return;
    }

    const underlayInteraction = underlayInteractionRef.current;
    if (underlayInteraction && underlayInteraction.pointerId === event.pointerId) {
      underlayInteractionRef.current = null;
      return;
    }

    const canvasPan = canvasPanRef.current;
    if (canvasPan && canvasPan.pointerId === event.pointerId) {
      canvasPanRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    const wallBreakInteraction = wallBreakInteractionRef.current;
    if (wallBreakInteraction && wallBreakInteraction.pointerId === event.pointerId) {
      if (wallBreakInteraction.hasMoved) {
        const nextWalls = wallBreakInteraction.originalWalls.map((wall) => (
          wall.id === wallBreakInteraction.wallId
            ? { ...wall, breaks: (wall.breaks || []).map((wallBreak) => (wallBreak.id === wallBreakInteraction.breakId ? wallBreakInteraction.draftBreak : wallBreak)) }
            : wall
        ));
        commitLayout(nextWalls, wallBreakInteraction.originalApertures);
        setSelectedElementId(wallBreakInteraction.breakId);
        setLayoutFeedback('break-moved');
      } else {
        setWalls(wallBreakInteraction.originalWalls);
      }
      wallBreakInteractionRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    const apertureInteraction = apertureInteractionRef.current;
    if (apertureInteraction && apertureInteraction.pointerId === event.pointerId) {
      if (apertureInteraction.hasMoved) {
        const nextApertures = apertureInteraction.originalApertures.map((aperture) => (
          aperture.id === apertureInteraction.apertureId ? apertureInteraction.draftAperture : aperture
        ));
        commitLayout(apertureInteraction.originalWalls, nextApertures);
        setSelectedElementId(apertureInteraction.apertureId);
        setLayoutFeedback(apertureInteraction.draftAperture.type === 'door' ? 'door-moved' : 'window-moved');
      } else {
        setApertures(apertureInteraction.originalApertures);
      }
      apertureInteractionRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    const interaction = wallInteractionRef.current;
    if (interaction && interaction.pointerId === event.pointerId) {
      if (interaction.hasMoved) {
        commitLayout(interaction.draftWalls, interaction.originalApertures);
        setSelectedElementId(interaction.wallId);
        setLayoutFeedback(interaction.kind === 'resize' ? 'wall-resized' : interaction.kind === 'curve' ? 'curve-adjusted' : 'wall-moved');
      } else {
        setWalls(interaction.originalWalls);
      }
      wallInteractionRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    if ((selectedTool !== 'wall' && selectedTool !== 'room' && selectedTool !== 'beam') || !drawingStartRef.current) return;
    const start = drawingStartRef.current;
    const rawEnd = getCanvasCoordinates(event);
    const end = selectedTool === 'room' ? snapPointToConnector(rawEnd) : getGuidedPoint(start, rawEnd);
    const shouldComplete = hadExistingStartRef.current || pointerWasDrawingRef.current;

    if (shouldComplete && (start.x !== end.x || start.y !== end.y)) {
      if (selectedTool === 'room') {
        completeRoom(start, end);
      } else {
        completeWall(start, end, undefined, selectedTool === 'beam' ? 'beam' : newWallType);
      }
    } else {
      setCurrentDrawingPoint(start);
      pointerStartRef.current = null;
      pointerWasDrawingRef.current = false;
      hadExistingStartRef.current = false;
    }

    setSnapGuide(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleCanvasPointerCancel = (event: React.PointerEvent<SVGSVGElement>) => {
    const canvasPan = canvasPanRef.current;
    if (canvasPan && canvasPan.pointerId === event.pointerId) {
      canvasPanRef.current = null;
    }
    const wallBreakInteraction = wallBreakInteractionRef.current;
    if (wallBreakInteraction && wallBreakInteraction.pointerId === event.pointerId) {
      setWalls(wallBreakInteraction.originalWalls);
      setApertures(wallBreakInteraction.originalApertures);
      wallBreakInteractionRef.current = null;
    }
    const apertureInteraction = apertureInteractionRef.current;
    if (apertureInteraction && apertureInteraction.pointerId === event.pointerId) {
      setWalls(apertureInteraction.originalWalls);
      setApertures(apertureInteraction.originalApertures);
      apertureInteractionRef.current = null;
    }
    const interaction = wallInteractionRef.current;
    if (interaction && interaction.pointerId === event.pointerId) {
      setWalls(interaction.originalWalls);
      setApertures(interaction.originalApertures);
      wallInteractionRef.current = null;
    }
    pointerStartRef.current = null;
    pointerWasDrawingRef.current = false;
    hadExistingStartRef.current = false;
    setSnapGuide(null);
    setCurrentDrawingPoint(drawingStartRef.current);
  };

  const handleToolChange = (tool: DrawTool) => {
    setSelectedTool(tool);
    setSelectedElementId(null);
    setLayoutFeedback('none');
    apertureInteractionRef.current = null;
    wallBreakInteractionRef.current = null;
    canvasPanRef.current = null;
    resetDrawing();
  };

  const applySnapshot = (snapshot: LayoutSnapshot) => {
    setWalls(snapshot.walls.map(cloneWall));
    setApertures(snapshot.apertures.map((aperture) => ({ ...aperture })));
    setItems((snapshot.items || []).map((item) => ({ ...item })));
    setSelectedElementId(null);
    resetDrawing();
  };

  const handleUndo = () => {
    if (historyIndex < 0) return;
    const nextIndex = historyIndex - 1;
    applySnapshot(nextIndex >= 0 ? history[nextIndex] : { walls: [], apertures: [], items: [] });
    setHistoryIndex(nextIndex);
  };

  const handleRedo = () => {
    if (historyIndex + 1 >= history.length) return;
    const nextIndex = historyIndex + 1;
    applySnapshot(history[nextIndex]);
    setHistoryIndex(nextIndex);
  };

  const handleDeleteSelected = () => {
    if (!selectedElementId) return;

    // Furniture is checked first and returns early, so the wall and opening logic below never has
    // to know that furniture exists.
    if (items.some((item) => item.id === selectedElementId)) {
      commitLayout(walls, apertures, items.filter((item) => item.id !== selectedElementId));
      setSelectedElementId(null);
      return;
    }

    const selectedWall = walls.find((wall) => wall.id === selectedElementId);
    const nextWalls = selectedWall
      ? walls.filter((wall) => wall.id !== selectedWall.id)
      : walls.map((wall) => ({
        ...wall,
        breaks: wall.breaks?.filter((wallBreak) => wallBreak.id !== selectedElementId),
      }));
    const nextApertures = apertures.filter((aperture) => (
      aperture.id !== selectedElementId && aperture.wallId !== selectedElementId
    ));
    const hasChangedBreak = nextWalls.some((wall, index) => (wall.breaks?.length || 0) !== (walls[index]?.breaks?.length || 0));
    if (nextWalls.length === walls.length && nextApertures.length === apertures.length && !hasChangedBreak) return;
    commitLayout(nextWalls, nextApertures);
    setSelectedElementId(null);
  };

  const deleteSelectedRef = useRef<() => void>(() => undefined);
  deleteSelectedRef.current = handleDeleteSelected;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (selectedTool !== 'select' || !selectedElementId || (event.key !== 'Delete' && event.key !== 'Backspace')) return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      event.preventDefault();
      deleteSelectedRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, selectedTool]);

  const updateOpeningWidth = (openingId: string, requestedUnits: number) => {
    if (!Number.isFinite(requestedUnits) || requestedUnits <= 0) return;
    const requestedWidth = Math.max(scalePixelsPerUnit * 0.3, requestedUnits * scalePixelsPerUnit);
    const aperture = apertures.find((item) => item.id === openingId);
    if (aperture) {
      const wall = walls.find((item) => item.id === aperture.wallId);
      if (!wall) return;
      const maximumWidth = getMaximumOpeningWidth(wall, aperture.positionRatio, aperture.id);
      if (maximumWidth < scalePixelsPerUnit * 0.3) {
        setLayoutFeedback('opening-overlap');
        return;
      }
      const width = Math.min(requestedWidth, maximumWidth);
      const nextAperture = {
        ...aperture,
        width,
        positionRatio: getSafeOpeningRatio(wall, aperture.positionRatio, width, aperture.id),
      };
      commitLayout(walls, apertures.map((item) => (item.id === aperture.id ? nextAperture : item)));
      setLayoutFeedback('opening-resized');
      return;
    }

    const ownerWall = walls.find((wall) => wall.breaks?.some((wallBreak) => wallBreak.id === openingId));
    const wallBreak = ownerWall?.breaks?.find((item) => item.id === openingId);
    if (!ownerWall || !wallBreak) return;
    const maximumWidth = getMaximumOpeningWidth(ownerWall, wallBreak.positionRatio, wallBreak.id);
    if (maximumWidth < scalePixelsPerUnit * 0.3) {
      setLayoutFeedback('opening-overlap');
      return;
    }
    const width = Math.min(requestedWidth, maximumWidth);
    const nextBreak = {
      ...wallBreak,
      width,
      positionRatio: getSafeOpeningRatio(ownerWall, wallBreak.positionRatio, width, wallBreak.id),
    };
    const nextWalls = walls.map((wall) => (
      wall.id === ownerWall.id
        ? { ...wall, breaks: (wall.breaks || []).map((item) => (item.id === nextBreak.id ? nextBreak : item)) }
        : wall
    ));
    commitLayout(nextWalls, apertures);
    setLayoutFeedback('opening-resized');
  };

  const updateDoorOrientation = (apertureId: string, updates: Pick<Aperture, 'hinge' | 'swing'>) => {
    const door = apertures.find((aperture) => aperture.id === apertureId && aperture.type === 'door');
    if (!door) return;
    commitLayout(walls, apertures.map((aperture) => (
      aperture.id === apertureId ? { ...aperture, ...updates } : aperture
    )));
    setLayoutFeedback('door-updated');
  };

  const getApertureGeometry = (aperture: Aperture, wall: Wall) => {
    const length = getWallLength(wall);
    if (!length) return null;
    const width = Math.min(aperture.width, getMaximumOpeningWidth(wall, aperture.positionRatio, aperture.id));
    const ratio = getSafeOpeningRatio(wall, aperture.positionRatio, width, aperture.id);
    const center = getPointOnWall(wall, ratio);
    const tangent = getWallTangent(wall, ratio);
    const perpendicular = { x: -tangent.y, y: tangent.x };
    const start = { x: center.x - tangent.x * (width / 2), y: center.y - tangent.y * (width / 2) };
    const end = { x: center.x + tangent.x * (width / 2), y: center.y + tangent.y * (width / 2) };
    const hinge = aperture.hinge === 'end' ? end : start;
    const closed = aperture.hinge === 'end' ? start : end;
    const swingDirection = aperture.swing === 'left' ? -1 : 1;
    const open = {
      x: hinge.x + perpendicular.x * width * swingDirection,
      y: hinge.y + perpendicular.y * width * swingDirection,
    };
    const closedVector = { x: closed.x - hinge.x, y: closed.y - hinge.y };
    const openVector = { x: open.x - hinge.x, y: open.y - hinge.y };
    const arcSweep = closedVector.x * openVector.y - closedVector.y * openVector.x > 0 ? 1 : 0;
    const jambDepth = Math.max(4, getWallStrokeWidth(wall) / 2);
    return {
      center,
      start,
      end,
      hinge,
      closed,
      open,
      width,
      perpendicular,
      arcSweep,
      jambDepth,
    };
  };

  const getDimensionPosition = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const tangent = { x: dx / length, y: dy / length };
    const perpendicular = { x: -tangent.y, y: tangent.x };
    let rotation = Math.atan2(tangent.y, tangent.x) * (180 / Math.PI);
    if (rotation > 90 || rotation < -90) rotation += 180;
    return {
      x: (x1 + x2) / 2 + perpendicular.x * 14,
      y: (y1 + y2) / 2 + perpendicular.y * 14,
      rotation,
    };
  };

  const changeZoom = (amount: number) => {
    setZoom((current) => Math.max(0.5, Math.min(2.5, Number((current + amount).toFixed(2)))));
  };

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 0.1 : -0.1);
  };

  const defaultLayoutInstruction = drawingStartPoint
    ? selectedTool === 'curve'
      ? curveEndPoint
        ? (isArabic ? 'اضغط نقطة الانحناء لتشكيل الجدار.' : 'Tap a bend point to shape the curve.')
        : (isArabic ? 'اضغط نقطة نهاية المنحنى.' : 'Tap the curve endpoint.')
      : selectedTool === 'room'
        ? (isArabic ? 'اضغط الزاوية المقابلة لإكمال الغرفة.' : 'Tap the opposite corner to complete the room.')
        : (isArabic ? 'اضغط نقطة ثانية لإكمال العنصر.' : 'Tap a second point to complete it.')
    : selectedTool === 'door'
      ? (isArabic ? 'اضغط مباشرة على جدار لإضافة باب.' : 'Tap directly on a wall to add a door.')
      : selectedTool === 'window'
        ? (isArabic ? 'اضغط مباشرة على جدار لإضافة نافذة.' : 'Tap directly on a wall to add a window.')
        : selectedTool === 'break'
          ? (isArabic ? 'اضغط على جدار لإضافة فتحة ممر قابلة للتحريك والعرض.' : 'Tap a wall to add a movable, resizable hall opening.')
          : selectedTool === 'beam'
            ? (isArabic ? 'اضغط أو اسحب بين نقاط الدعم لوضع كمرة.' : 'Tap or drag between support points to place a beam.')
            : selectedTool === 'room'
              ? (isArabic ? 'اضغط أو اسحب زاويتين متقابلتين لإنشاء غرفة كاملة.' : 'Tap or drag opposite corners to create a complete room.')
              : selectedTool === 'curve'
                ? (isArabic ? 'اضغط نقطة البداية، ثم النهاية، ثم نقطة الانحناء.' : 'Tap a start point, end point, then bend point.')
                : selectedTool === 'select'
                  ? (isArabic ? 'اسحب مساحة فارغة للتحرك. اسحب أي زاوية لتحريك الجدران المتصلة معًا، أو حدّد بابًا أو نافذة واضغط Delete لإزالتها.' : 'Drag empty space to pan. Drag any corner to move joined walls together, or select a door/window and press Delete to remove it.')
                  : (isArabic ? 'اضغط أو اسحب لرسم جدار بأي زاوية. اقترب من زاوية أو جدار حتى يظهر دليل الاتصال البرتقالي.' : 'Tap or drag to draw a wall at any angle. Move near a corner or wall until the amber connection guide appears.');

  const feedbackMessage = layoutFeedback === 'wall-required'
    ? (isArabic ? 'اختر الباب أو النافذة، ثم اضغط مباشرة على جدار موجود.' : 'Choose Door or Window, then tap directly on an existing wall.')
    : layoutFeedback === 'break-wall-required'
      ? (isArabic ? 'اختر أداة الفتحة، ثم اضغط مباشرة على جدار موجود.' : 'Choose Opening, then tap directly on an existing wall.')
      : layoutFeedback === 'opening-overlap'
        ? (isArabic ? 'لا توجد مساحة كافية هنا. اختر جزءًا أطول من الجدار أو حرّك فتحة موجودة.' : 'There is not enough clear wall here. Choose a longer section or move an existing opening.')
        : layoutFeedback === 'door-added'
          ? (isArabic ? 'تمت إضافة الباب كفتحة حقيقية في الجدار.' : 'Door added as a true wall opening.')
          : layoutFeedback === 'door-updated'
            ? (isArabic ? 'تم تعديل مفصلة الباب واتجاه فتحه.' : 'Door hinge and swing direction updated.')
            : layoutFeedback === 'window-added'
            ? (isArabic ? 'تمت إضافة النافذة كفتحة حقيقية في الجدار.' : 'Window added as a true wall opening.')
            : layoutFeedback === 'break-added'
              ? (isArabic ? 'تمت إضافة فتحة الممر. حدّدها لتغيير عرضها.' : 'Hall opening added. Select it to change its width.')
              : layoutFeedback === 'opening-resized'
                ? (isArabic ? 'تم تحديث عرض الفتحة مع الحفاظ على مسافة آمنة.' : 'Opening width updated with safe clearance.')
                : layoutFeedback === 'door-moved'
                  ? (isArabic ? 'تم نقل الباب.' : 'Door moved.')
                  : layoutFeedback === 'window-moved'
                    ? (isArabic ? 'تم نقل النافذة.' : 'Window moved.')
                    : layoutFeedback === 'break-moved'
                      ? (isArabic ? 'تم نقل فتحة الجدار.' : 'Wall opening moved.')
                      : layoutFeedback === 'room-added'
                        ? (isArabic ? 'تم إنشاء غرفة بأربع جدران متصلة.' : 'Room created with four joined walls.')
                        : layoutFeedback === 'beam-added'
                          ? (isArabic ? 'تمت إضافة الكمرة الداعمة.' : 'Support beam added.')
                          : layoutFeedback === 'curve-added'
                            ? (isArabic ? 'تمت إضافة الجدار المنحني. اسحب مقبضه لتعديل الانحناء.' : 'Curved wall added. Drag its handle to refine the bend.')
                            : layoutFeedback === 'curve-adjusted'
                              ? (isArabic ? 'تم تعديل انحناء الجدار.' : 'Wall curve adjusted.')
                              : layoutFeedback === 'wall-added'
                                ? (isArabic ? 'تمت إضافة الجدار. اختر أداة التحديد ثم اسحب أي زاوية لتعديلها.' : 'Wall added. Choose Select, then drag any corner to edit it.')
                                : layoutFeedback === 'wall-resized'
                                  ? (isArabic ? 'تم تعديل الزاوية مع بقاء الجدران المتصلة مرتبطة.' : 'Corner updated. Connected walls stayed joined.')
                                  : layoutFeedback === 'wall-moved'
                                    ? (isArabic ? 'تم نقل الجدار.' : 'Wall moved.')
                                    : defaultLayoutInstruction;

  const hasLayoutError = layoutFeedback === 'wall-required' || layoutFeedback === 'break-wall-required' || layoutFeedback === 'opening-overlap';
  const selectedAperture = apertures.find((aperture) => aperture.id === selectedElementId) || null;
  const selectedBreakOwner = walls.find((wall) => wall.breaks?.some((wallBreak) => wallBreak.id === selectedElementId)) || null;
  const selectedBreak = selectedBreakOwner?.breaks?.find((wallBreak) => wallBreak.id === selectedElementId) || null;
  const selectedOpening = selectedAperture || selectedBreak;
  const selectedBeam = walls.find((wall) => wall.id === selectedElementId && wall.type === 'beam') || null;

  const cardClass = 'rounded-2xl border border-[#c9dff5] bg-white/90 shadow-[0_10px_24px_rgba(6,5,65,0.08)] dark:border-sky-300/20 dark:bg-black/30 dark:shadow-none';
  const fieldClass = 'w-full rounded-xl border border-[#c9dff5] bg-white px-3 py-2.5 text-sm text-[#060541] shadow-sm outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 dark:border-sky-300/20 dark:bg-black/35 dark:text-foreground';
  const headingClass = 'text-[#060541] dark:text-foreground';
  const mutedClass = 'text-[#53627a] dark:text-muted-foreground';

  return (
    <section
      dir={isArabic ? 'rtl' : 'ltr'}
      className="relative overflow-hidden rounded-3xl border border-[#b8d8f7] bg-gradient-to-br from-[#fcfefd] via-[#edf7ff] to-[#f6f1ff] p-3 shadow-[0_14px_36px_-12px_rgba(6,5,65,0.18)] dark:border-sky-400/25 dark:from-sky-950/55 dark:via-blue-950/50 dark:to-indigo-950/35 dark:shadow-[0_8px_40px_-4px_hsla(210,100%,65%,0.28)] md:p-5"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 scale-110 opacity-25 blur-3xl dark:opacity-40" style={{ background: 'radial-gradient(circle, hsla(210,100%,65%,0.35) 0%, transparent 70%)' }} />
      <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-100" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 120%, hsla(210,100%,65%,0.16), transparent)' }} />
      <div className="pointer-events-none absolute inset-0 rounded-3xl border border-white/70 dark:border-white/30" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.14) 25%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.14) 75%, rgba(255,255,255,0.42) 100%)', mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'xor', WebkitMaskComposite: 'xor', padding: '1px', opacity: 0.8 }} />

      <div className="relative space-y-3 md:space-y-4">
        <div className="relative z-20 flex items-center justify-between gap-3 rounded-2xl border border-[#c9dff5] bg-white/90 p-2.5 shadow-[0_6px_18px_rgba(6,5,65,0.08)] dark:border-sky-300/20 dark:bg-black/25 dark:shadow-none">
          <div className="flex min-w-0 items-center gap-3 text-start">
            <div
              className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 60%, #1e40af 100%)', boxShadow: '0 0 22px hsla(210,100%,65%,0.7), 0 0 8px hsla(210,100%,75%,0.5), inset 0 1px 0 rgba(255,255,255,0.35)' }}
            >
              <div className="absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 100%)' }} />
              <PencilRuler className="relative h-5 w-5 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
            </div>
            <div className="min-w-0">
              <h1 className={`truncate text-xl font-bold tracking-tight md:text-2xl ${headingClass}`}>
                {isArabic ? 'المصمم' : 'Designer'}
              </h1>
              <p className={`hidden text-xs sm:block ${mutedClass}`}>
                {isArabic ? 'صمّم مساحتك خطوة بخطوة' : 'Shape your space step by step'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-pressed={view === 'saved'}
            onClick={() => setView('saved')}
            className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all active:scale-95 md:px-4 md:text-sm ${
              view === 'saved'
                ? 'border-sky-300/45 bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-[0_4px_14px_hsla(210,100%,65%,0.45)]'
                : 'border-sky-200 bg-sky-50 text-[#075985] shadow-sm hover:bg-sky-100 dark:border-sky-300/30 dark:bg-sky-400/15 dark:text-sky-100 dark:shadow-none'
            }`}
          >
            <Save className="h-4 w-4" />
            <span className="whitespace-nowrap">{isArabic ? 'المحفوظات' : 'Saved'}</span>
          </button>
        </div>

        <nav
          role="tablist"
          aria-label={isArabic ? 'مسارات المصمم' : 'Designer workflows'}
          className="relative z-10 grid grid-cols-3 gap-2 rounded-2xl border border-[#c9dff5] bg-[#f7fbff]/95 p-2 shadow-[0_6px_18px_rgba(6,5,65,0.06)] dark:border-sky-300/20 dark:bg-black/30 dark:shadow-none"
        >
          {modeOptions.map((option, index) => {
            const isActive = view === 'workspace' && activeMode === option.key;
            return (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setWorkspaceMode(option.key)}
                className={`flex min-h-[68px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2 text-center text-[10px] font-semibold leading-tight transition-all duration-200 active:scale-95 sm:px-3 sm:text-xs ${
                  isActive
                    ? 'border-sky-300/45 bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[0_4px_14px_hsla(210,100%,65%,0.45)]'
                    : 'border-[#d9e7f5] bg-white text-[#40506a] shadow-sm hover:border-sky-300/45 hover:bg-sky-50 dark:border-transparent dark:bg-white/[0.035] dark:text-foreground/75 dark:shadow-none dark:hover:border-sky-300/25 dark:hover:bg-white/[0.09] dark:hover:text-foreground'
                }`}
              >
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current/35 text-[10px]">
                  {index + 1}
                </span>
                <span className="break-words">{isArabic ? option.titleAr : option.titleEn}</span>
              </button>
            );
          })}
        </nav>

        {view === 'saved' ? (
          <DesignerSavedProjects
            language={language}
            onStartDesign={() => setView('workspace')}
            onOpenProject={handleOpenProject}
          />
        ) : activeMode === 'redesign' ? (
          <RedesignRoomStudio language={language} />
        ) : activeMode === 'trace' ? (
          <FloorPlanStudio
            language={plannerLanguage}
            handoff={planHandoff}
            onHandoffConsumed={() => setPlanHandoff(null)}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)] lg:gap-4">
            <section className={`${cardClass} relative min-h-[390px] overflow-hidden p-3 md:p-4`}>
              {/* This whole branch is the Draw Layout tab. Redesign and Furnish Floor Plan return
                  their own components above, so there is no mode check to make down here. */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Grid3x3 className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-200" />
                  <span className={`truncate text-sm font-bold ${headingClass}`}>
                    {isArabic ? 'لوحة الرسم' : 'Layout Canvas'}
                  </span>
                </div>
                {/* ⛔ Save lives HERE, in the always-visible card header, and NOT in the Layout Kit
                    toolbar below. That toolbar sits inside a collapsed panel, so a Save button in it
                    is invisible to someone who has just finished tracing a plan and wants to keep
                    it. It replaced a decorative "Blueprint" badge that carried no information. */}
                <button
                  type="button"
                  onClick={() => void saveLayout()}
                  disabled={isSavingLayout || !walls.length}
                  title={isArabic ? 'احفظ المخطط في المحفوظات' : 'Save layout to your designs'}
                  className={`inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[11px] font-extrabold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                    savedLayoutId
                      ? 'border-emerald-400/45 bg-emerald-400/15 text-emerald-700 dark:text-emerald-200'
                      : 'border-sky-300/45 bg-sky-400/20 text-sky-800 shadow-[0_0_12px_hsla(210,100%,65%,0.25)] hover:bg-sky-400/30 dark:text-sky-100'
                  }`}
                >
                  {isSavingLayout
                    ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    : savedLayoutId
                      ? <Check className="h-3.5 w-3.5 shrink-0" />
                      : <Save className="h-3.5 w-3.5 shrink-0" />}
                  <span className="whitespace-nowrap">
                    {isSavingLayout
                      ? (isArabic ? 'جاري الحفظ' : 'Saving')
                      : savedLayoutId
                        ? (isArabic ? 'محفوظ' : 'Saved')
                        : (isArabic ? 'احفظ' : 'Save')}
                  </span>
                </button>
              </div>

              {(
                <div className="space-y-3">
                  <div
                    ref={canvasViewportRef}
                    onWheel={handleCanvasWheel}
                    className="relative mx-auto h-[440px] w-full max-w-[720px] overflow-auto rounded-2xl border border-[#9ec9ee] bg-[#e8f4ff] shadow-inner [scrollbar-color:#38bdf8_transparent] [scrollbar-width:thin] sm:h-[520px] dark:border-sky-300/25 dark:bg-[#040912]"
                  >
                    <svg
                      ref={layoutSvgRef}
                      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
                      role="application"
                      aria-label={isArabic ? 'مساحة رسم مخطط قابلة للتمرير' : 'Scrollable layout drawing canvas'}
                      className={`block select-none ${selectedTool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}`}
                      style={{ width: CANVAS_SIZE * zoom, height: CANVAS_SIZE * zoom, touchAction: 'none' }}
                      onPointerDown={handleCanvasPointerDown}
                      onPointerMove={handleCanvasPointerMove}
                      onPointerUp={handleCanvasPointerUp}
                      onPointerCancel={handleCanvasPointerCancel}
                    >
                      <defs>
                        <pattern id="designer-layout-grid" width={GRID_GAP} height={GRID_GAP} patternUnits="userSpaceOnUse">
                          <path d={`M ${GRID_GAP} 0 L 0 0 0 ${GRID_GAP}`} fill="none" className="stroke-sky-400/25 dark:stroke-sky-300/15" strokeWidth="1" />
                        </pattern>
                        <pattern id="designer-layout-major-grid" width={GRID_GAP * 5} height={GRID_GAP * 5} patternUnits="userSpaceOnUse">
                          <path d={`M ${GRID_GAP * 5} 0 L 0 0 0 ${GRID_GAP * 5}`} fill="none" className="stroke-sky-500/35 dark:stroke-sky-300/30" strokeWidth="1.5" />
                        </pattern>
                        <filter id="designer-selected-glow" x="-40%" y="-40%" width="180%" height="180%">
                          <feGaussianBlur stdDeviation="5" result="blur" />
                          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>
                      <rect width={CANVAS_SIZE} height={CANVAS_SIZE} className="fill-[#f8fcff] dark:fill-[#040912]" />

                      {/*
                        The uploaded plan sits UNDER the grid and under everything drawn, so the
                        user's own walls always read clearly on top of it while they trace.
                      */}
                      {underlay && (
                        <image
                          href={underlay.dataUrl}
                          x={underlay.x}
                          y={underlay.y}
                          width={underlay.width}
                          height={underlay.height}
                          opacity={underlay.opacity}
                          preserveAspectRatio="xMidYMid meet"
                          style={{ cursor: underlay.locked ? 'default' : 'move' }}
                          pointerEvents={underlay.locked || selectedTool !== 'select' ? 'none' : 'auto'}
                          onPointerDown={handleUnderlayPointerDown}
                        />
                      )}

                      <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="url(#designer-layout-grid)" pointerEvents="none" />
                      <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="url(#designer-layout-major-grid)" pointerEvents="none" />

                      {walls.map((wall) => {
                        const isSelected = selectedElementId === wall.id;
                        const wallWidth = getWallStrokeWidth(wall);
                        const isBeam = wall.type === 'beam';
                        const dimension = getWallDimensionPosition(wall);
                        const blueprintClass = isBeam
                          ? (isSelected ? 'stroke-fuchsia-600 dark:stroke-amber-200' : 'stroke-[#6b2f91] dark:stroke-fuchsia-200')
                          : wall.type === 'structural'
                            ? (isSelected ? 'stroke-indigo-700 dark:stroke-white' : 'stroke-[#071a2e] dark:stroke-[#e0f2fe]')
                            : (isSelected ? 'stroke-indigo-600 dark:stroke-sky-100' : 'stroke-[#1a4a70] dark:stroke-sky-300');
                        return (
                          <g key={wall.id}>
                            {getWallPieceRanges(wall).map((piece, index) => {
                              const path = getWallPiecePath(wall, piece.start, piece.end);
                              return (
                                <g key={`${wall.id}-${index}`}>
                                  <path
                                    d={path}
                                    fill="none"
                                    className="stroke-transparent"
                                    strokeWidth={Math.max(wallWidth + (10 / zoom), 34 / zoom)}
                                    strokeLinecap="square"
                                    strokeLinejoin="round"
                                    onPointerDown={(event) => handleWallPointerDown(event, wall)}
                                  />
                                  {isSelected && (
                                    <path
                                      d={path}
                                      fill="none"
                                      className="stroke-sky-400/55 dark:stroke-sky-300/70"
                                      strokeWidth={wallWidth + 12}
                                      strokeLinecap="square"
                                      strokeLinejoin="round"
                                      filter="url(#designer-selected-glow)"
                                      pointerEvents="none"
                                    />
                                  )}
                                  <path
                                    d={path}
                                    fill="none"
                                    className={blueprintClass}
                                    strokeWidth={wallWidth}
                                    strokeLinecap="square"
                                    strokeLinejoin="round"
                                    pointerEvents="none"
                                  />
                                  {isBeam && (
                                    <path d={path} fill="none" className="stroke-white/45 dark:stroke-white/35" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="square" pointerEvents="none" />
                                  )}
                                </g>
                              );
                            })}
                            <text
                              x={dimension.x}
                              y={dimension.y}
                              transform={`rotate(${dimension.rotation} ${dimension.x} ${dimension.y})`}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              pointerEvents="none"
                              className={isBeam ? 'fill-fuchsia-700 text-[11px] font-extrabold dark:fill-amber-200' : 'fill-[#075985] text-[11px] font-bold dark:fill-sky-100'}
                            >
                              {isBeam ? `${isArabic ? 'كمرة ' : 'BEAM '}${getWallDistanceLabel(wall)}` : getWallDistanceLabel(wall)}
                            </text>
                          </g>
                        );
                      })}

                      {walls.flatMap((wall) => ([
                        { wall, endpoint: 'start' as const, point: { x: wall.x1, y: wall.y1 } },
                        { wall, endpoint: 'end' as const, point: { x: wall.x2, y: wall.y2 } },
                      ])).map(({ wall, endpoint, point }) => {
                        const isSelected = selectedElementId === wall.id;
                        const showConnector = isSelected || selectedTool === 'select' || selectedTool === 'wall' || selectedTool === 'room' || selectedTool === 'curve' || selectedTool === 'beam';
                        return (
                          <g key={`${wall.id}-${endpoint}`}>
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={24 / zoom}
                              fill="transparent"
                              pointerEvents="all"
                              onPointerDown={(event) => handleWallEndpointPointerDown(event, wall, endpoint)}
                            />
                            {showConnector && (
                              <circle
                                cx={point.x}
                                cy={point.y}
                                r={isSelected ? '9' : '5'}
                                pointerEvents="none"
                                className={isSelected ? 'fill-white stroke-indigo-600 dark:fill-[#081429] dark:stroke-sky-100' : 'fill-[#081429] stroke-sky-300'}
                                strokeWidth={isSelected ? '3' : '2'}
                              />
                            )}
                          </g>
                        );
                      })}

                      {walls.filter((wall) => wall.control).map((wall) => {
                        const isSelected = selectedElementId === wall.id;
                        const showHandle = isSelected || selectedTool === 'curve';
                        if (!wall.control || !showHandle) return null;
                        const midpoint = getPointOnWall(wall, 0.5);
                        return (
                          <g key={`${wall.id}-curve-control`}>
                            <line x1={midpoint.x} y1={midpoint.y} x2={wall.control.x} y2={wall.control.y} className="stroke-indigo-400/70 dark:stroke-sky-300/70" strokeWidth="2" strokeDasharray="5 5" pointerEvents="none" />
                            <circle cx={wall.control.x} cy={wall.control.y} r={22 / zoom} fill="transparent" onPointerDown={(event) => handleWallCurvePointerDown(event, wall)} />
                            <circle cx={wall.control.x} cy={wall.control.y} r="8" pointerEvents="none" className="fill-indigo-500 stroke-white dark:fill-sky-300 dark:stroke-[#081429]" strokeWidth="3" />
                          </g>
                        );
                      })}

                      {walls.flatMap((wall) => (wall.breaks || []).map((wallBreak) => ({ wall, wallBreak }))).map(({ wall, wallBreak }) => {
                        const point = getPointOnWall(wall, wallBreak.positionRatio);
                        const isSelected = selectedElementId === wallBreak.id;
                        const showMarker = isSelected || selectedTool === 'break';
                        return (
                          <g key={wallBreak.id}>
                            <circle cx={point.x} cy={point.y} r={22 / zoom} fill="transparent" onPointerDown={(event) => handleWallBreakPointerDown(event, wall, wallBreak)} />
                            {showMarker && (
                              <>
                                <circle cx={point.x} cy={point.y} r="8" pointerEvents="none" className="fill-[#081429] stroke-fuchsia-500 dark:stroke-amber-200" strokeWidth="3" />
                                <path d={`M ${point.x - 4} ${point.y - 4} L ${point.x + 4} ${point.y + 4} M ${point.x + 4} ${point.y - 4} L ${point.x - 4} ${point.y + 4}`} pointerEvents="none" className="stroke-fuchsia-500 dark:stroke-amber-200" strokeWidth="2" strokeLinecap="round" />
                                {isSelected && <text x={point.x} y={point.y - 16} textAnchor="middle" pointerEvents="none" className="fill-fuchsia-700 text-[10px] font-extrabold dark:fill-amber-100">{(wallBreak.width / scalePixelsPerUnit).toFixed(2)} {scaleUnit}</text>}
                              </>
                            )}
                          </g>
                        );
                      })}

                      {apertures.map((aperture) => {
                        const wall = walls.find((item) => item.id === aperture.wallId);
                        if (!wall) return null;
                        const geometry = getApertureGeometry(aperture, wall);
                        if (!geometry) return null;
                        const isSelected = selectedElementId === aperture.id;
                        const apertureClass = isSelected ? 'stroke-fuchsia-500 dark:stroke-amber-200' : 'stroke-[#0f77a6] dark:stroke-cyan-200';
                        const dimensionOffset = aperture.type === 'door' && aperture.swing === 'left' ? -18 : 18;
                        const dimensionPosition = {
                          x: geometry.center.x + geometry.perpendicular.x * dimensionOffset,
                          y: geometry.center.y + geometry.perpendicular.y * dimensionOffset,
                        };
                        if (aperture.type === 'door') {
                          return (
                            <g key={aperture.id} onPointerDown={(event) => handleAperturePointerDown(event, aperture)}>
                              <line
                                x1={geometry.start.x - geometry.perpendicular.x * geometry.jambDepth}
                                y1={geometry.start.y - geometry.perpendicular.y * geometry.jambDepth}
                                x2={geometry.start.x + geometry.perpendicular.x * geometry.jambDepth}
                                y2={geometry.start.y + geometry.perpendicular.y * geometry.jambDepth}
                                className={apertureClass}
                                strokeWidth="3"
                                strokeLinecap="square"
                              />
                              <line
                                x1={geometry.end.x - geometry.perpendicular.x * geometry.jambDepth}
                                y1={geometry.end.y - geometry.perpendicular.y * geometry.jambDepth}
                                x2={geometry.end.x + geometry.perpendicular.x * geometry.jambDepth}
                                y2={geometry.end.y + geometry.perpendicular.y * geometry.jambDepth}
                                className={apertureClass}
                                strokeWidth="3"
                                strokeLinecap="square"
                              />
                              <line x1={geometry.hinge.x} y1={geometry.hinge.y} x2={geometry.open.x} y2={geometry.open.y} className={apertureClass} strokeWidth="4" strokeLinecap="round" />
                              <path d={`M ${geometry.closed.x} ${geometry.closed.y} A ${geometry.width} ${geometry.width} 0 0 ${geometry.arcSweep} ${geometry.open.x} ${geometry.open.y}`} fill="none" className={apertureClass} strokeWidth="2.5" strokeDasharray="5 4" />
                              <line x1={geometry.start.x} y1={geometry.start.y} x2={geometry.end.x} y2={geometry.end.y} className="stroke-transparent" strokeWidth={32 / zoom} />
                              <line x1={geometry.hinge.x} y1={geometry.hinge.y} x2={geometry.open.x} y2={geometry.open.y} className="stroke-transparent" strokeWidth={32 / zoom} />
                              {isSelected && <text x={dimensionPosition.x} y={dimensionPosition.y} textAnchor="middle" dominantBaseline="middle" pointerEvents="none" className="fill-fuchsia-700 text-[10px] font-extrabold dark:fill-amber-100">{(aperture.width / scalePixelsPerUnit).toFixed(2)} {scaleUnit}</text>}
                            </g>
                          );
                        }

                        return (
                          <g key={aperture.id} onPointerDown={(event) => handleAperturePointerDown(event, aperture)}>
                            {[-5, 0, 5].map((offset) => (
                              <line
                                key={offset}
                                x1={geometry.start.x + geometry.perpendicular.x * offset}
                                y1={geometry.start.y + geometry.perpendicular.y * offset}
                                x2={geometry.end.x + geometry.perpendicular.x * offset}
                                y2={geometry.end.y + geometry.perpendicular.y * offset}
                                className={apertureClass}
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                            ))}
                            <line x1={geometry.start.x} y1={geometry.start.y} x2={geometry.end.x} y2={geometry.end.y} className="stroke-transparent" strokeWidth={26 / zoom} />
                            {isSelected && <text x={dimensionPosition.x} y={dimensionPosition.y} textAnchor="middle" dominantBaseline="middle" pointerEvents="none" className="fill-fuchsia-700 text-[10px] font-extrabold dark:fill-amber-100">{(aperture.width / scalePixelsPerUnit).toFixed(2)} {scaleUnit}</text>}
                          </g>
                        );
                      })}

                      {snapGuide && (
                        <g pointerEvents="none">
                          <line
                            x1={snapGuide.pointer.x}
                            y1={snapGuide.pointer.y}
                            x2={snapGuide.point.x}
                            y2={snapGuide.point.y}
                            className="stroke-amber-400/90 dark:stroke-amber-200"
                            strokeWidth={2 / zoom}
                            strokeDasharray="7 5"
                          />
                          {snapGuide.kind === 'corner' && (
                            <>
                              <line x1={snapGuide.point.x} y1="0" x2={snapGuide.point.x} y2={CANVAS_SIZE} className="stroke-amber-300/45 dark:stroke-amber-200/45" strokeWidth={1.5 / zoom} strokeDasharray="10 8" />
                              <line x1="0" y1={snapGuide.point.y} x2={CANVAS_SIZE} y2={snapGuide.point.y} className="stroke-amber-300/45 dark:stroke-amber-200/45" strokeWidth={1.5 / zoom} strokeDasharray="10 8" />
                            </>
                          )}
                          {snapGuide.kind === 'wall-face' && snapGuide.lineStart && snapGuide.lineEnd && (
                            <line x1={snapGuide.lineStart.x} y1={snapGuide.lineStart.y} x2={snapGuide.lineEnd.x} y2={snapGuide.lineEnd.y} className="stroke-cyan-300/70 dark:stroke-cyan-200/75" strokeWidth={2 / zoom} strokeDasharray="12 8" />
                          )}
                          <circle cx={snapGuide.point.x} cy={snapGuide.point.y} r={20 / zoom} fill="none" className="stroke-amber-400 dark:stroke-amber-200" strokeWidth={3 / zoom} strokeDasharray="6 5" />
                          <circle cx={snapGuide.point.x} cy={snapGuide.point.y} r={6 / zoom} className="fill-amber-300 stroke-white dark:fill-amber-200 dark:stroke-[#040912]" strokeWidth={2 / zoom} />
                          <text x={snapGuide.point.x + 18 / zoom} y={snapGuide.point.y - 18 / zoom} className="fill-amber-700 text-[14px] font-extrabold dark:fill-amber-100">
                            {snapGuide.kind === 'corner' ? (isArabic ? 'اتصال زاوية' : 'CONNECT CORNER') : (isArabic ? 'اتصال بالجدار' : 'CONNECT WALL')}
                          </text>
                        </g>
                      )}

                      {drawingStartPoint && (
                        <circle cx={drawingStartPoint.x} cy={drawingStartPoint.y} r="7" className="fill-indigo-500 stroke-white dark:fill-sky-300 dark:stroke-[#040912]" strokeWidth="3" />
                      )}

                      {drawingStartPoint && selectedTool === 'curve' && curveEndPoint && currentDrawingPoint && (() => {
                        const previewWall: Wall = {
                          id: 'curve-preview',
                          x1: drawingStartPoint.x,
                          y1: drawingStartPoint.y,
                          x2: curveEndPoint.x,
                          y2: curveEndPoint.y,
                          type: newWallType,
                          control: currentDrawingPoint,
                        };
                        const dimension = getWallDimensionPosition(previewWall);
                        return (
                          <g pointerEvents="none">
                            <path d={getWallPath(previewWall)} fill="none" className="stroke-indigo-500 dark:stroke-sky-200" strokeWidth={getWallStrokeWidth(previewWall)} strokeDasharray="10 7" strokeLinecap="square" />
                            <line x1={getPointOnWall(previewWall, 0.5).x} y1={getPointOnWall(previewWall, 0.5).y} x2={currentDrawingPoint.x} y2={currentDrawingPoint.y} className="stroke-indigo-400/70 dark:stroke-sky-300/70" strokeWidth="2" strokeDasharray="5 5" />
                            <circle cx={curveEndPoint.x} cy={curveEndPoint.y} r="7" className="fill-white stroke-indigo-500 dark:fill-[#081429] dark:stroke-sky-200" strokeWidth="3" />
                            <circle cx={currentDrawingPoint.x} cy={currentDrawingPoint.y} r="7" className="fill-indigo-500 stroke-white dark:fill-sky-300 dark:stroke-[#081429]" strokeWidth="3" />
                            <text x={dimension.x} y={dimension.y} transform={`rotate(${dimension.rotation} ${dimension.x} ${dimension.y})`} textAnchor="middle" dominantBaseline="middle" className="fill-indigo-700 text-[12px] font-extrabold dark:fill-sky-100">
                              {getWallDistanceLabel(previewWall)}
                            </text>
                          </g>
                        );
                      })()}

                      {drawingStartPoint && selectedTool === 'room' && currentDrawingPoint && (drawingStartPoint.x !== currentDrawingPoint.x || drawingStartPoint.y !== currentDrawingPoint.y) && (() => {
                        const minX = Math.min(drawingStartPoint.x, currentDrawingPoint.x);
                        const minY = Math.min(drawingStartPoint.y, currentDrawingPoint.y);
                        const width = Math.abs(currentDrawingPoint.x - drawingStartPoint.x);
                        const height = Math.abs(currentDrawingPoint.y - drawingStartPoint.y);
                        return (
                          <g pointerEvents="none">
                            <rect x={minX} y={minY} width={width} height={height} fill="hsla(210,100%,65%,0.08)" className="stroke-indigo-500 dark:stroke-sky-200" strokeWidth={getWallStrokeWidth({ id: 'room-preview', x1: 0, y1: 0, x2: 0, y2: 0, type: newWallType })} strokeDasharray="10 7" />
                            <text x={minX + width / 2} y={minY + height / 2} textAnchor="middle" dominantBaseline="middle" className="fill-indigo-700 text-[12px] font-extrabold dark:fill-sky-100">
                              {(width / scalePixelsPerUnit).toFixed(1)} × {(height / scalePixelsPerUnit).toFixed(1)} {scaleUnit}
                            </text>
                          </g>
                        );
                      })()}

                      {drawingStartPoint && currentDrawingPoint && selectedTool !== 'room' && !(selectedTool === 'curve' && curveEndPoint) && (drawingStartPoint.x !== currentDrawingPoint.x || drawingStartPoint.y !== currentDrawingPoint.y) && (() => {
                        const dimension = getDimensionPosition(drawingStartPoint.x, drawingStartPoint.y, currentDrawingPoint.x, currentDrawingPoint.y);
                        const previewType: Wall['type'] = selectedTool === 'beam' ? 'beam' : newWallType;
                        const previewWidth = getWallStrokeWidth({ id: 'preview', x1: 0, y1: 0, x2: 0, y2: 0, type: previewType });
                        return (
                          <g pointerEvents="none">
                            <line
                              x1={drawingStartPoint.x}
                              y1={drawingStartPoint.y}
                              x2={currentDrawingPoint.x}
                              y2={currentDrawingPoint.y}
                              className={selectedTool === 'beam' ? 'stroke-fuchsia-500 dark:stroke-amber-200' : 'stroke-indigo-500 dark:stroke-sky-200'}
                              strokeWidth={previewWidth}
                              strokeDasharray="10 7"
                              strokeLinecap="square"
                            />
                            <text
                              x={dimension.x}
                              y={dimension.y}
                              transform={`rotate(${dimension.rotation} ${dimension.x} ${dimension.y})`}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className={selectedTool === 'beam' ? 'fill-fuchsia-700 text-[12px] font-extrabold dark:fill-amber-200' : 'fill-indigo-700 text-[12px] font-extrabold dark:fill-sky-100'}
                            >
                              {selectedTool === 'beam' ? `${isArabic ? 'كمرة ' : 'BEAM '}${getDistanceLabel(drawingStartPoint.x, drawingStartPoint.y, currentDrawingPoint.x, currentDrawingPoint.y)}` : getDistanceLabel(drawingStartPoint.x, drawingStartPoint.y, currentDrawingPoint.x, currentDrawingPoint.y)}
                            </text>
                          </g>
                        );
                      })()}

                      {/*
                        Furniture draws above the walls so a sofa against a wall is not hidden by
                        it. Each piece is its own <g> with its own pointer handler, which is what
                        lets it be dragged without the canvas panning underneath.
                      */}
                      {items.map((item) => {
                        const symbol = furnitureById(item.symbolId);
                        if (!symbol) return null;
                        const isSelected = selectedElementId === item.id;
                        return (
                          <g
                            key={item.id}
                            transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
                            className={isSelected ? 'text-sky-600 dark:text-sky-300' : 'text-[#25415f] dark:text-sky-100/80'}
                            style={{ cursor: 'move' }}
                            onPointerDown={(event) => handleFurniturePointerDown(event, item)}
                          >
                            {isSelected && (
                              <rect
                                x={-item.width / 2 - 4}
                                y={-item.depth / 2 - 4}
                                width={item.width + 8}
                                height={item.depth + 8}
                                rx={6}
                                fill="none"
                                className="stroke-sky-400/80"
                                strokeWidth={2}
                                strokeDasharray="6 4"
                                pointerEvents="none"
                              />
                            )}
                            {/* An invisible slab guarantees a finger-sized target on thin symbols. */}
                            <rect
                              x={-item.width / 2}
                              y={-item.depth / 2}
                              width={item.width}
                              height={item.depth}
                              fill="transparent"
                            />
                            <g
                              stroke="currentColor"
                              strokeWidth={1.6}
                              fill="none"
                              strokeLinejoin="round"
                              pointerEvents="none"
                            >
                              <FurnitureShapes shapes={symbol.shapes} width={item.width} depth={item.depth} />
                            </g>
                          </g>
                        );
                      })}

                      {roomLabels.map((label) => {
                        const isSelected = selectedElementId === label.roomId;
                        return (
                          <g
                            key={label.roomId}
                            className={selectedTool === 'select' ? 'cursor-move' : 'cursor-default'}
                            onPointerDown={(event) => handleLabelPointerDown(event, label)}
                            onPointerMove={handleLabelPointerMove}
                            onPointerUp={handleLabelPointerUp}
                            onPointerCancel={handleLabelPointerUp}
                            onDoubleClick={(event) => { event.stopPropagation(); startLabelEditing(label); }}
                          >
                            <rect
                              x={label.x - 64}
                              y={label.y - 16}
                              width={128}
                              height={32}
                              rx={9}
                              strokeWidth={1.5}
                              className={isSelected
                                ? 'fill-sky-100/95 stroke-sky-500 dark:fill-sky-400/25 dark:stroke-sky-300'
                                : 'fill-white/85 stroke-[#9ec9ee] dark:fill-black/50 dark:stroke-sky-300/30'}
                            />
                            <text
                              x={label.x}
                              y={label.y - 3}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className="pointer-events-none fill-[#060541] text-[13px] font-extrabold dark:fill-sky-50"
                            >
                              {label.name}
                            </text>
                            <text
                              x={label.x}
                              y={label.y + 9}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className="pointer-events-none fill-[#53627a] text-[10px] font-bold dark:fill-sky-200/80"
                            >
                              {`${label.widthUnits} × ${label.heightUnits} ${scaleUnit}`}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {editingLabelId && (() => {
                      const label = roomLabels.find((item) => item.roomId === editingLabelId);
                      if (!label) return null;
                      return (
                        <div
                          className="absolute z-20"
                          style={{ left: label.x * zoom - 84, top: label.y * zoom - 18 }}
                        >
                          <input
                            autoFocus
                            value={labelDraft}
                            onChange={(event) => setLabelDraft(event.currentTarget.value)}
                            onBlur={commitLabelEditing}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitLabelEditing();
                              }
                              if (event.key === 'Escape') {
                                setEditingLabelId(null);
                                setLabelDraft('');
                              }
                            }}
                            className="w-[168px] rounded-lg border border-sky-400 bg-white px-2 py-1 text-center text-xs font-bold text-[#060541] shadow-lg outline-none dark:border-sky-300 dark:bg-[#0c0f14] dark:text-sky-50"
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {roomLabels.length > 0 && (
                    <div className="flex justify-center">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c9dff5] bg-white/90 px-3 py-1 text-[10px] font-bold text-[#53627a] dark:border-sky-300/20 dark:bg-black/40 dark:text-sky-100">
                        <Tag className="h-3 w-3" />
                        {isArabic ? 'اسحب اسم الغرفة لتحريكه، وانقر مرتين لتعديل الاسم' : 'Drag a room label to move it, double-click to rename it'}
                      </span>
                    </div>
                  )}

                  {/* Rotate and remove for the piece of furniture currently selected. */}
                  {items.some((item) => item.id === selectedElementId) && (
                    <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-sky-300/40 bg-sky-50/70 px-2 py-2 dark:border-sky-300/20 dark:bg-sky-500/10">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-[#075985] dark:text-sky-200">
                        {isArabic ? 'العنصر المحدد' : 'Selected piece'}
                      </span>
                      <button
                        type="button"
                        onClick={() => rotateSelectedFurniture(-45)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[10px] font-bold text-[#40506a] transition active:scale-95 dark:bg-white/10 dark:text-foreground/80"
                      >
                        <RotateCw className="h-3.5 w-3.5 -scale-x-100" />
                        45°
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateSelectedFurniture(45)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[10px] font-bold text-[#40506a] transition active:scale-95 dark:bg-white/10 dark:text-foreground/80"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        45°
                      </button>
                      <button
                        type="button"
                        onClick={() => rotateSelectedFurniture(90)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1.5 text-[10px] font-bold text-[#40506a] transition active:scale-95 dark:bg-white/10 dark:text-foreground/80"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        90°
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelected}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-1.5 text-[10px] font-bold text-rose-600 transition active:scale-95 dark:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {isArabic ? 'حذف' : 'Remove'}
                      </button>
                    </div>
                  )}

                  {/* ── Trace a plan ── */}
                  <div className="overflow-hidden rounded-2xl border border-[#c9dff5] bg-[#f7fbff]/80 dark:border-sky-300/20 dark:bg-black/[0.16]">
                    <button
                      type="button"
                      aria-expanded={isTraceOpen}
                      onClick={() => setIsTraceOpen((current) => !current)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start transition hover:bg-sky-50/70 dark:hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-2">
                        <ImagePlus className="h-4 w-4 text-sky-700 dark:text-sky-200" />
                        <span>
                          <span className={`block text-xs font-bold ${headingClass}`}>{isArabic ? 'تتبّع مخطط' : 'Trace a plan'}</span>
                          <span className="block text-[10px] font-semibold text-muted-foreground">
                            {isArabic ? 'ارفع مخططك وارسم فوقه' : 'Upload your plan and draw over it'}
                          </span>
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 text-sky-700 transition-transform duration-200 dark:text-sky-200 ${isTraceOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isTraceOpen && (
                      <div className="space-y-2.5 border-t border-[#d9e7f5] px-3 py-3 dark:border-sky-300/15">
                        <input
                          ref={underlayInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUnderlaySelected}
                        />

                        {!underlay ? (
                          <>
                            <button
                              type="button"
                              onClick={() => underlayInputRef.current?.click()}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 px-3 py-2.5 text-xs font-bold text-white shadow-[0_4px_14px_hsla(210,100%,65%,0.45)] transition-all hover:brightness-110 active:scale-95"
                            >
                              <Upload className="h-4 w-4" />
                              {isArabic ? 'رفع مخطط للتتبّع' : 'Upload a plan to trace'}
                            </button>
                            <p className={`text-[10px] leading-relaxed ${mutedClass}`}>
                              {isArabic
                                ? 'يظهر المخطط باهتاً تحت الشبكة. حرّكه وكبّره حتى يناسب المقياس، ثبّته، ثم ارسم الجدران فوقه بنفسك.'
                                : 'Your plan appears faded under the grid. Move and resize it until the scale looks right, lock it, then draw your own walls straight over it.'}
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <span className={`min-w-0 flex-1 truncate text-[11px] font-bold ${headingClass}`}>{underlay.name}</span>
                              <button
                                type="button"
                                onClick={() => setUnderlay(null)}
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-1 text-[10px] font-bold text-rose-600 transition active:scale-95 dark:text-rose-300"
                              >
                                <X className="h-3.5 w-3.5" />
                                {isArabic ? 'إزالة' : 'Remove'}
                              </button>
                            </div>

                            <label className="block">
                              <span className="mb-1 flex items-center justify-between text-[10px] font-bold text-[#40506a] dark:text-foreground/70">
                                <span>{isArabic ? 'وضوح المخطط' : 'Plan visibility'}</span>
                                <span>{Math.round(underlay.opacity * 100)}%</span>
                              </span>
                              <input
                                type="range"
                                min={5}
                                max={100}
                                value={Math.round(underlay.opacity * 100)}
                                onChange={(event) => {
                                  const next = Number(event.target.value) / 100;
                                  setUnderlay((current) => (current ? { ...current, opacity: next } : current));
                                }}
                                className="w-full accent-sky-500"
                              />
                            </label>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold text-[#40506a] dark:text-foreground/70">{isArabic ? 'الحجم' : 'Size'}</span>
                              <button
                                type="button"
                                onClick={() => scaleUnderlay(1 / 1.1)}
                                className="inline-flex h-7 w-8 items-center justify-center rounded-lg bg-white text-[#40506a] transition active:scale-95 dark:bg-white/10 dark:text-foreground/80"
                                aria-label={isArabic ? 'تصغير المخطط' : 'Shrink the plan'}
                              >
                                <ZoomOut className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => scaleUnderlay(1.1)}
                                className="inline-flex h-7 w-8 items-center justify-center rounded-lg bg-white text-[#40506a] transition active:scale-95 dark:bg-white/10 dark:text-foreground/80"
                                aria-label={isArabic ? 'تكبير المخطط' : 'Enlarge the plan'}
                              >
                                <ZoomIn className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setUnderlay((current) => (current ? { ...current, locked: !current.locked } : current))}
                                className={`ms-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition active:scale-95 ${
                                  underlay.locked
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-white text-[#40506a] dark:bg-white/10 dark:text-foreground/80'
                                }`}
                              >
                                {underlay.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                                {underlay.locked ? (isArabic ? 'مثبّت' : 'Locked') : (isArabic ? 'غير مثبّت' : 'Unlocked')}
                              </button>
                            </div>

                            <p className={`text-[10px] leading-relaxed ${mutedClass}`}>
                              {underlay.locked
                                ? (isArabic
                                  ? 'المخطط مثبّت. ارسم الجدران والأبواب والنوافذ فوقه بأدوات الرسم.'
                                  : 'The plan is locked. Now draw your walls, doors and windows straight over it with the drawing tools.')
                                : (isArabic
                                  ? 'بأداة التحديد اسحب المخطط لتوضيعه، ثم اضغط تثبيت قبل الرسم.'
                                  : 'With the Select tool, drag the plan to position it, then press Locked before you start drawing.')}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Add furniture ── */}
                  <div className="overflow-hidden rounded-2xl border border-[#c9dff5] bg-[#f7fbff]/80 dark:border-sky-300/20 dark:bg-black/[0.16]">
                    <button
                      type="button"
                      aria-expanded={isFurnitureOpen}
                      onClick={() => setIsFurnitureOpen((current) => !current)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-start transition hover:bg-sky-50/70 dark:hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-2">
                        <Sofa className="h-4 w-4 text-sky-700 dark:text-sky-200" />
                        <span>
                          <span className={`block text-xs font-bold ${headingClass}`}>{isArabic ? 'إضافة أثاث' : 'Add furniture'}</span>
                          <span className="block text-[10px] font-semibold text-muted-foreground">
                            {items.length > 0
                              ? (isArabic ? `${items.length} عنصر على اللوحة` : `${items.length} on the board`)
                              : (isArabic ? 'اضغط أي قطعة لإضافتها' : 'Tap any piece to place it')}
                          </span>
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 text-sky-700 transition-transform duration-200 dark:text-sky-200 ${isFurnitureOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isFurnitureOpen && (
                      <div className="space-y-2 border-t border-[#d9e7f5] px-3 py-3 dark:border-sky-300/15">
                        <FurniturePalette isArabic={isArabic} onPick={addFurniture} />
                        <p className={`text-[10px] leading-relaxed ${mutedClass}`}>
                          {isArabic
                            ? 'تُضاف القطعة في منتصف ما تراه بمقاسها الحقيقي. اسحبها لتحريكها، ثم استخدم أزرار التدوير أعلاه.'
                            : 'Each piece lands in the middle of your view at its real-world size. Drag it to move it, then use the rotate buttons above.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <p className={`px-1 text-center text-xs ${mutedClass}`}>
                    {isArabic ? 'لوحة قابلة للتمرير: ' : 'Scrollable board: '}{Math.round(zoom * 100)}% · {(CANVAS_SIZE / scalePixelsPerUnit).toFixed(1)} × {(CANVAS_SIZE / scalePixelsPerUnit).toFixed(1)} {scaleUnit} · {isArabic ? '20 بكسل = ' : '20 px = '}{(GRID_GAP / scalePixelsPerUnit).toFixed(2)} {scaleUnit}
                  </p>
                </div>
              )}

            </section>

            <aside className="space-y-3 lg:space-y-4">
              <section className={`${cardClass} p-4`}>
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-sky-700 dark:text-sky-200" />
                  <h2 className="text-sm font-extrabold text-foreground">{isArabic ? 'متحكم المصمم' : 'Designer Controller'}</h2>
                </div>

                {(
                  <div className="mt-4 overflow-hidden rounded-2xl border border-[#c9dff5] bg-[#f7fbff]/80 dark:border-sky-300/20 dark:bg-black/[0.16]">
                    <button
                      type="button"
                      aria-expanded={isLayoutKitOpen}
                      onClick={() => setIsLayoutKitOpen((current) => !current)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-3 text-start transition hover:bg-sky-50/70 dark:hover:bg-white/[0.06]"
                    >
                      <span className="flex items-center gap-2">
                        <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[0_0_14px_hsla(210,100%,65%,0.38)]">
                          <PencilRuler className="h-4 w-4" />
                        </div>
                        <span>
                          <span className="block text-sm font-extrabold text-foreground">{isArabic ? 'عدة المخطط' : 'Layout Kit'}</span>
                          <span className="block text-[10px] font-semibold text-muted-foreground">{isArabic ? 'الأدوات، التكبير، القياس، والإجراءات' : 'Tools, zoom, scale, and actions'}</span>
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 text-sky-700 transition-transform duration-200 dark:text-sky-200 ${isLayoutKitOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isLayoutKitOpen && (
                      <div className="space-y-3 border-t border-[#d9e7f5] px-3 py-3 dark:border-sky-300/15">
                        <div className={`rounded-xl border px-3 py-2 ${
                          hasLayoutError
                            ? 'border-rose-300/60 bg-rose-50 text-rose-800 dark:border-rose-300/35 dark:bg-rose-400/10 dark:text-rose-100'
                            : 'border-[#d9e7f5] bg-white/80 text-[#40506a] dark:border-sky-300/15 dark:bg-black/[0.18] dark:text-sky-100/85'
                        }`}>
                          <div className="flex items-center gap-2 text-start">
                            <Ruler className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-200" />
                            <p className="text-[11px] font-semibold leading-relaxed">{feedbackMessage}</p>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[#d9e7f5] bg-white/80 p-2 dark:border-sky-300/15 dark:bg-black/[0.18]">
                          <div className="mb-2 flex items-center justify-between gap-2 px-1">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/65">{isArabic ? 'الأدوات والإجراءات' : 'Tools & actions'}</span>
                            <span className="text-[10px] font-bold text-sky-700 dark:text-sky-200">{Math.round(zoom * 100)}%</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="flex flex-wrap gap-1 rounded-xl border border-[#c9dff5] bg-[#f7fbff] p-1 dark:border-sky-300/15 dark:bg-black/[0.22]">
                              {drawTools.map((tool) => {
                                const ToolIcon = tool.icon;
                                const isActive = selectedTool === tool.value;
                                return (
                                  <button
                                    key={tool.value}
                                    type="button"
                                    title={isArabic ? tool.ar : tool.en}
                                    aria-label={isArabic ? tool.ar : tool.en}
                                    aria-pressed={isActive}
                                    onClick={() => handleToolChange(tool.value)}
                                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                                      isActive ? 'bg-sky-500 text-white shadow-[0_0_14px_hsla(210,100%,65%,0.55)]' : 'text-[#40506a] hover:bg-sky-50 hover:text-[#075985] dark:text-sky-100/70 dark:hover:bg-white/[0.1] dark:hover:text-white'
                                    }`}
                                  >
                                    <ToolIcon className="h-4 w-4" />
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex gap-1 rounded-xl border border-[#c9dff5] bg-[#f7fbff] p-1 dark:border-sky-300/15 dark:bg-black/[0.22]">
                              <button type="button" title={isArabic ? 'تصغير' : 'Zoom out'} aria-label={isArabic ? 'تصغير' : 'Zoom out'} onClick={() => changeZoom(-0.25)} disabled={zoom <= 0.5} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#40506a] transition hover:bg-sky-50 hover:text-[#075985] disabled:cursor-not-allowed disabled:opacity-35 dark:text-sky-100/70 dark:hover:bg-white/[0.1] dark:hover:text-white"><ZoomOut className="h-4 w-4" /></button>
                              <button type="button" title={isArabic ? 'الحجم الافتراضي' : 'Reset zoom'} aria-label={isArabic ? 'الحجم الافتراضي' : 'Reset zoom'} onClick={() => setZoom(1)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#40506a] transition hover:bg-sky-50 hover:text-[#075985] dark:text-sky-100/70 dark:hover:bg-white/[0.1] dark:hover:text-white"><Maximize2 className="h-4 w-4" /></button>
                              <button type="button" title={isArabic ? 'تكبير' : 'Zoom in'} aria-label={isArabic ? 'تكبير' : 'Zoom in'} onClick={() => changeZoom(0.25)} disabled={zoom >= 2.5} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#40506a] transition hover:bg-sky-50 hover:text-[#075985] disabled:cursor-not-allowed disabled:opacity-35 dark:text-sky-100/70 dark:hover:bg-white/[0.1] dark:hover:text-white"><ZoomIn className="h-4 w-4" /></button>
                            </div>
                            <div className="flex gap-1 rounded-xl border border-[#c9dff5] bg-[#f7fbff] p-1 dark:border-sky-300/15 dark:bg-black/[0.22]">
                              <button type="button" title={isArabic ? 'تراجع' : 'Undo'} aria-label={isArabic ? 'تراجع' : 'Undo'} onClick={handleUndo} disabled={historyIndex < 0} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#40506a] transition hover:bg-sky-50 hover:text-[#075985] disabled:cursor-not-allowed disabled:opacity-35 dark:text-sky-100/70 dark:hover:bg-white/[0.1] dark:hover:text-white"><Undo2 className="h-4 w-4" /></button>
                              <button type="button" title={isArabic ? 'إعادة' : 'Redo'} aria-label={isArabic ? 'إعادة' : 'Redo'} onClick={handleRedo} disabled={historyIndex + 1 >= history.length} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#40506a] transition hover:bg-sky-50 hover:text-[#075985] disabled:cursor-not-allowed disabled:opacity-35 dark:text-sky-100/70 dark:hover:bg-white/[0.1] dark:hover:text-white"><Redo2 className="h-4 w-4" /></button>
                              <button type="button" title={isArabic ? 'حذف المحدد' : 'Delete selected'} aria-label={isArabic ? 'حذف المحدد' : 'Delete selected'} onClick={handleDeleteSelected} disabled={!selectedElementId} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-35 dark:text-rose-300 dark:hover:bg-rose-400/10"><Trash2 className="h-4 w-4" /></button>
                            </div>
                            {(selectedTool === 'wall' || selectedTool === 'room' || selectedTool === 'curve') && (
                              <div className="flex gap-1 rounded-xl border border-[#c9dff5] bg-[#f7fbff] p-1 dark:border-sky-300/15 dark:bg-black/[0.22]">
                                <button
                                  type="button"
                                  title={isArabic ? 'خطوط مستقيمة فقط (أفقية / عمودية)' : 'Straight lines only (H / V)'}
                                  aria-label={isArabic ? 'خطوط مستقيمة فقط' : 'Straight lines only'}
                                  aria-pressed={straightOnly}
                                  onClick={() => setStraightOnly((prev) => !prev)}
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                                    straightOnly ? 'bg-sky-500 text-white shadow-[0_0_14px_hsla(210,100%,65%,0.55)]' : 'text-[#40506a] hover:bg-sky-50 hover:text-[#075985] dark:text-sky-100/70 dark:hover:bg-white/[0.1] dark:hover:text-white'
                                  }`}
                                >
                                  <Crosshair className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {(selectedTool === 'wall' || selectedTool === 'room' || selectedTool === 'curve' || selectedTool === 'break') && (
                          <div>
                            <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-foreground/65">{isArabic ? 'نوع الجدار' : 'Wall type'}</span>
                            <div className="mt-1.5 grid grid-cols-2 gap-2">
                              {(['partition', 'structural'] as const).map((type) => {
                                const isActive = newWallType === type;
                                return (
                                  <button key={type} type="button" aria-pressed={isActive} onClick={() => setNewWallType(type)} className={`min-h-[38px] rounded-xl border px-3 text-xs font-bold transition-all ${isActive ? 'border-sky-300/45 bg-sky-400/20 text-sky-800 dark:text-sky-100' : 'border-[#d9e7f5] bg-white text-[#40506a] hover:bg-sky-50 dark:border-sky-300/15 dark:bg-black/[0.1] dark:text-foreground/70 dark:hover:bg-white/[0.08]'}`}>
                                    {type === 'structural' ? (isArabic ? 'إنشائي' : 'Structural') : (isArabic ? 'فاصل' : 'Partition')}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {selectedOpening && (
                          <div className="rounded-xl border border-fuchsia-200/80 bg-fuchsia-50/70 p-3 dark:border-amber-300/25 dark:bg-amber-400/[0.08]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-fuchsia-800 dark:text-amber-100">{selectedAperture?.type === 'door' ? (isArabic ? 'عرض الباب' : 'Door width') : selectedAperture?.type === 'window' ? (isArabic ? 'عرض النافذة' : 'Window width') : (isArabic ? 'عرض فتحة الممر' : 'Hall opening width')}</span>
                              <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[10px] font-extrabold text-fuchsia-800 dark:bg-amber-300/15 dark:text-amber-100">{(selectedOpening.width / scalePixelsPerUnit).toFixed(2)} {scaleUnit}</span>
                            </div>
                            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_74px] gap-2">
                              <div className="flex overflow-hidden rounded-lg border border-fuchsia-200 bg-white dark:border-amber-300/20 dark:bg-black/25">
                                {(selectedAperture?.type === 'door' ? [0.8, 0.9, 1.0, 1.2] : selectedAperture?.type === 'window' ? [0.9, 1.2, 1.5, 2.0] : [1.2, 1.5, 2.0, 2.4]).map((units) => (
                                  <button key={units} type="button" onClick={() => updateOpeningWidth(selectedOpening.id, units)} className="min-h-[34px] flex-1 border-e border-fuchsia-100 px-1 text-[10px] font-bold text-fuchsia-800 transition last:border-e-0 hover:bg-fuchsia-100 dark:border-amber-300/10 dark:text-amber-100 dark:hover:bg-amber-300/10">{units}</button>
                                ))}
                              </div>
                              <input
                                key={selectedOpening.id}
                                type="number"
                                inputMode="decimal"
                                min="0.3"
                                step="0.1"
                                defaultValue={(selectedOpening.width / scalePixelsPerUnit).toFixed(2)}
                                onBlur={(event) => updateOpeningWidth(selectedOpening.id, event.currentTarget.valueAsNumber)}
                                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                                aria-label={isArabic ? 'عرض الفتحة' : 'Opening width'}
                                className="w-full rounded-lg border border-fuchsia-200 bg-white px-1 text-center text-xs font-bold text-fuchsia-900 outline-none focus:ring-2 focus:ring-fuchsia-300 dark:border-amber-300/25 dark:bg-black/25 dark:text-amber-100"
                              />
                            </div>
                            <p className="mt-2 text-[10px] leading-relaxed text-fuchsia-800/80 dark:text-amber-100/75">{isArabic ? 'يتم الحفاظ على مسافة آمنة تلقائيًا من الأبواب والنوافذ والفتحات الأخرى.' : 'Safe spacing from nearby doors, windows, and openings is kept automatically.'}</p>
                            {selectedAperture && (
                              <button
                                type="button"
                                onClick={handleDeleteSelected}
                                className="mt-3 inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-lg border border-rose-300/70 bg-rose-50 px-3 text-[10px] font-extrabold text-rose-700 transition hover:bg-rose-100 dark:border-rose-300/30 dark:bg-rose-400/10 dark:text-rose-100 dark:hover:bg-rose-400/20"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {selectedAperture.type === 'door' ? (isArabic ? 'إزالة الباب' : 'Remove door') : (isArabic ? 'إزالة النافذة' : 'Remove window')}
                              </button>
                            )}
                            {selectedAperture?.type === 'door' && (
                              <div className="mt-3 border-t border-fuchsia-200/80 pt-3 dark:border-amber-300/20">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-fuchsia-800 dark:text-amber-100">{isArabic ? 'اتجاه فتح الباب' : 'Door swing'}</span>
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => updateDoorOrientation(selectedAperture.id, { hinge: selectedAperture.hinge === 'end' ? 'start' : 'end', swing: selectedAperture.swing || 'right' })}
                                    className="min-h-[38px] rounded-lg border border-fuchsia-200 bg-white px-2 text-[10px] font-bold text-fuchsia-800 transition hover:bg-fuchsia-100 dark:border-amber-300/25 dark:bg-black/20 dark:text-amber-100 dark:hover:bg-amber-300/10"
                                  >
                                    {isArabic ? 'تبديل جهة المفصلة' : 'Swap hinge side'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateDoorOrientation(selectedAperture.id, { hinge: selectedAperture.hinge || 'start', swing: selectedAperture.swing === 'left' ? 'right' : 'left' })}
                                    className="min-h-[38px] rounded-lg border border-fuchsia-200 bg-white px-2 text-[10px] font-bold text-fuchsia-800 transition hover:bg-fuchsia-100 dark:border-amber-300/25 dark:bg-black/20 dark:text-amber-100 dark:hover:bg-amber-300/10"
                                  >
                                    {isArabic ? 'عكس اتجاه الفتح' : 'Flip swing direction'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {selectedBeam && (
                          <div className="flex items-start gap-2 rounded-xl border border-fuchsia-200/80 bg-fuchsia-50/70 px-3 py-2.5 text-start dark:border-amber-300/25 dark:bg-amber-400/[0.08]">
                            <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-700 dark:text-amber-200" />
                            <p className="text-[10px] leading-relaxed text-fuchsia-900 dark:text-amber-100">{isArabic ? 'تم تحديد كمرة داعمة. اسحبها لتحريكها أو اسحب أي طرف لتغيير طولها.' : 'Support beam selected. Drag it to move it, or drag either end to resize it.'}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2 rounded-xl border border-[#d9e7f5] bg-white/80 p-2.5 dark:border-sky-300/15 dark:bg-black/[0.18]">
                          <label className="block text-start">
                            <span className="text-[10px] font-bold text-foreground/75">{isArabic ? `بكسل لكل ${scaleUnit === 'm' ? 'متر' : 'قدم'}` : `Pixels per ${scaleUnit === 'm' ? 'metre' : 'foot'}`}</span>
                            <input type="number" inputMode="decimal" min="1" step="1" value={scalePixelsPerUnit} onChange={(event) => { const nextValue = event.currentTarget.valueAsNumber; if (Number.isFinite(nextValue) && nextValue > 0) setScalePixelsPerUnit(nextValue); }} className={`${fieldClass} mt-1 h-9 py-1.5 text-center`} />
                          </label>
                          <label className="block text-start">
                            <span className="text-[10px] font-bold text-foreground/75">{isArabic ? 'الوحدة' : 'Unit'}</span>
                            <select value={scaleUnit} onChange={(event) => setScaleUnit(event.target.value as 'm' | 'ft')} className={`${fieldClass} mt-1 h-9 py-1.5 text-center`}>
                              <option value="m">{isArabic ? 'متر' : 'Metres'}</option>
                              <option value="ft">{isArabic ? 'قدم' : 'Feet'}</option>
                            </select>
                          </label>
                          <p className={`col-span-2 text-center text-[10px] ${mutedClass}`}>{isArabic ? 'استخدم أزرار التكبير أو Ctrl + عجلة الماوس.' : 'Use zoom buttons or Ctrl + mouse wheel.'}</p>
                        </div>

                        <div className="flex items-start gap-2 rounded-xl border border-amber-300/35 bg-amber-50/65 px-3 py-2 text-start dark:border-amber-300/20 dark:bg-amber-400/[0.07]">
                          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-200" />
                          <p className="text-[10px] leading-relaxed text-amber-900 dark:text-amber-100">{isArabic ? 'أداة تصورية فقط، وليست للاعتماد الإنشائي أو الهندسي.' : 'Concept only. Not for construction or engineering approval.'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className={`${cardClass} p-4`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-sky-700 dark:text-sky-200" />
                    <h2 className="text-sm font-extrabold text-foreground">{isArabic ? 'دردشة المصمم' : 'Designer Chat'}</h2>
                  </div>
                  <span className="rounded-full border border-sky-300/20 bg-sky-400/10 px-2 py-1 text-[10px] font-bold text-sky-800 dark:text-sky-200">{isArabic ? 'مفعّل' : 'Live'}</span>
                </div>
                <div className="mt-3 rounded-xl border border-[#d9e7f5] bg-[#f7fbff] p-3 text-start dark:border-sky-300/15 dark:bg-black/25">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 dark:text-sky-200" />
                    <p className={`text-xs leading-relaxed ${mutedClass}`}>
                      {isArabic ? 'اكتب وصفك، وسينشئ المصمم مسودة أولى على اللوحة ثم يوضح افتراضاته وأسئلة المتابعة المهمة فقط.' : 'Describe the layout you want, and Designer will place a first draft on the canvas, then show only the important assumptions and follow-up questions.'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  <div className="max-h-[280px] space-y-2 overflow-y-auto pe-1">
                    {designerChat.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[#c9dff5] bg-white/70 px-3 py-3 text-xs text-[#53627a] dark:border-sky-300/15 dark:bg-black/15 dark:text-muted-foreground">
                        {isArabic ? 'مثال: أريد لوبي صغيرًا، مجلسًا قريبًا من المدخل، غرفة طعام متصلة به، وممرًا يصل إلى الجيم والسبا والحمام.' : 'Example: I want a small lobby, a majlis near the entrance, a connected dining room, and a hallway leading to the gym, spa, and bath.'}
                      </div>
                    ) : (
                      designerChat.map((entry) => (
                        <div
                          key={entry.id}
                          className={entry.role === 'user'
                            ? 'ms-8 rounded-2xl bg-[#060541] px-3 py-2 text-xs text-white dark:bg-sky-500/20 dark:text-sky-50'
                            : 'me-3 rounded-2xl border border-[#d9e7f5] bg-white px-3 py-3 text-xs text-[#53627a] dark:border-sky-300/15 dark:bg-black/20 dark:text-muted-foreground'}
                        >
                          {entry.summary && <p className="font-bold text-foreground dark:text-foreground">{entry.summary}</p>}
                          <p className={`whitespace-pre-line leading-relaxed ${entry.summary ? 'mt-2' : ''}`}>{entry.content}</p>
                          {entry.assumptions && entry.assumptions.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-200">{isArabic ? 'الافتراضات' : 'Assumptions'}</p>
                              {entry.assumptions.map((item) => (
                                <p key={item} className="text-[11px] leading-relaxed">- {item}</p>
                              ))}
                            </div>
                          )}
                          {entry.questions && entry.questions.length > 0 && (
                            <div className="mt-3 space-y-1">
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-200">{isArabic ? 'أسئلة متابعة' : 'Follow-up questions'}</p>
                              {entry.questions.map((item) => (
                                <p key={item} className="text-[11px] leading-relaxed">- {item}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {designerIsLoading && (
                      <div className="me-3 rounded-2xl border border-[#d9e7f5] bg-white px-3 py-3 text-xs text-[#53627a] dark:border-sky-300/15 dark:bg-black/20 dark:text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Wand2 className="h-4 w-4 animate-pulse text-sky-700 dark:text-sky-200" />
                          <p>{isArabic ? 'أبني المسودة الآن وأرتب الغرف على اللوحة...' : 'I am building the draft now and arranging the rooms on the canvas...'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={designerPrompt}
                      onChange={(event) => setDesignerPrompt(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleDesignerSend();
                        }
                      }}
                      rows={3}
                      placeholder={isArabic ? 'اكتب طلبك للمصمم...' : 'Tell Designer what you want...'}
                      className="min-h-[72px] flex-1 resize-none rounded-xl border border-[#d9e7f5] bg-white px-3 py-2 text-xs text-[#53627a] outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 dark:border-sky-300/15 dark:bg-black/25 dark:text-muted-foreground dark:placeholder:text-muted-foreground/70"
                    />
                    <button
                      type="button"
                      onClick={() => { void handleDesignerSend(); }}
                      disabled={designerIsLoading || !designerPrompt.trim()}
                      aria-label={isArabic ? 'إرسال' : 'Send'}
                      className="inline-flex w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500 text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-sky-400 dark:text-[#060541]"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        )}

        {view === 'workspace' && (
          <p className="px-1 text-center text-[11px] text-muted-foreground/75">
            {isArabic ? activeOption.descriptionAr : activeOption.descriptionEn}
          </p>
        )}
      </div>

      <DesignerFollowUpDialog
        open={followUpOpen}
        language={language}
        fields={followUpFields}
        answers={followUpAnswers}
        isBusy={designerIsLoading}
        requestPreview={pendingRequest}
        onAnswerChange={handleFollowUpAnswerChange}
        onSubmit={handleFollowUpSubmit}
        onSkip={handleFollowUpSkip}
        onClose={() => setFollowUpOpen(false)}
      />

      <StudioGuestLoginDialog
        open={guestDialogOpen}
        onOpenChange={setGuestDialogOpen}
        redirectTo="/music?studioTab=designer"
        language={language}
      />
    </section>
  );
}
