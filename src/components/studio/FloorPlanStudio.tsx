import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  FolderPlus,
  Link2,
  Loader2,
  Maximize2,
  RotateCcw,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
  Unlink,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DesignerImageLightbox, { type LightboxImage } from './DesignerImageLightbox';
import FloorPlanCanvas, { type FloorPlanLabel } from './FloorPlanCanvas';
import { StudioGuestLoginDialog } from './StudioGuestLoginDialog';
import { renderFileName, saveImagesToDevice } from './saveImageToDevice';
import {
  CUSTOM_ID,
  DEFAULT_FLOOR_PLAN_CHOICES,
  FLOOR_PLAN_FURNITURE_MODES,
  FLOOR_PLAN_ROWS,
  FLOOR_PLAN_STYLES,
  FLOOR_PLAN_UPLOAD_KINDS,
  PER_ROOM_ROWS,
  FLOOR_PLAN_SCOPES,
  ROOM_PURPOSES,
  buildFloorPlanPrompt,
  buildRoomZoomPrompt,
  hasRoomOverride,
  purposePhrase,
  speedSettings,
  type FloorPlanChoices,
  type FloorPlanOption,
  type FloorPlanRowKey,
  type FloorPlanSpeed,
  type RoomGroup,
  type RoomOverrides,
  type RoomStyleOverride,
} from './floorPlanOptions';
import {
  BLUEPRINT_KEY,
  FLOOR_PLAN_KEY,
  asArray,
  asNumber,
  asRecord,
  asText,
  projectImageUrl,
  type FloorPlanHandoff,
} from './designerProjects';

const SUPABASE_URL = ((import.meta as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL || 'https://hxauxozopvpzpdygoqwf.supabase.co').trim();

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
// Blueprints live or die on fine line work, so they are kept larger than a room photo would be —
// the plan reader has to be able to make out room names and door swings.
const MAX_EDGE_PIXELS = 1600;
const MAX_ROOM_RENDERS = 5;
// Runware accepts any multiple of 16. Matching the plan's own proportions is what keeps the
// result overlayable on the original drawing instead of stretched to fit a square.
const RENDER_STEP = 16;
const RENDER_MIN_EDGE = 512;
// GPT Image 2 takes 2–3 minutes on a dense plan, so the render is submitted and then polled.
// The ceiling is generous on purpose: abandoning a job we have already paid for is the worst
// possible outcome, and the user is watching a live timer the whole time.
const POLL_INTERVAL_MS = 4000;
const POLL_CEILING_MS = 8 * 60 * 1000;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** A running clock the user can watch, so a three-minute render never looks like a hang. */
const formatElapsed = (seconds: number, isArabic: boolean): string => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const clock = minutes ? `${minutes}:${String(rest).padStart(2, '0')}` : `${rest}s`;
  return isArabic ? `مضى ${clock}` : `${clock} elapsed`;
};

type PlanAsset = { name: string; dataUrl: string; width: number; height: number };
/** Everything the provider needs to size and price one render. */
type RenderSetup = { width: number; height: number; quality: 'medium' | 'high' };

/** Fits the plan's aspect ratio into Runware's allowed dimension grid, capped by the speed setting. */
const renderDimensions = (
  planWidth: number,
  planHeight: number,
  maxEdge: number,
): { width: number; height: number } => {
  const snap = (value: number) => Math.max(
    RENDER_MIN_EDGE,
    Math.min(maxEdge, Math.round(value / RENDER_STEP) * RENDER_STEP),
  );
  if (!planWidth || !planHeight) return { width: maxEdge, height: maxEdge };
  const scale = maxEdge / Math.max(planWidth, planHeight);
  return { width: snap(planWidth * scale), height: snap(planHeight * scale) };
};
type RoomRender = { labelId: string; name: string; url: string };
type StudioStep = 'plan' | 'style' | 'result';

const STEPS: Array<{ key: StudioStep; en: string; ar: string }> = [
  { key: 'plan', en: 'Plan', ar: 'المخطط' },
  { key: 'style', en: 'Style', ar: 'الطراز' },
  { key: 'result', en: 'Result', ar: 'النتيجة' },
];

const chipClass = (isActive: boolean) => `min-h-[40px] rounded-xl border px-2 py-2 text-[11px] font-bold transition-all active:scale-95 ${
  isActive
    ? 'border-sky-300/45 bg-sky-400/20 text-sky-800 shadow-[0_0_12px_hsla(210,100%,65%,0.2)] dark:text-sky-100'
    : 'border-[#d9e7f5] bg-[#f7fbff] text-[#40506a] hover:bg-sky-50 dark:border-sky-300/15 dark:bg-black/[0.1] dark:text-foreground/70 dark:hover:bg-white/[0.08]'
}`;

const inputClass = 'w-full rounded-xl border border-[#d9e7f5] bg-white px-3 py-2 text-xs font-semibold text-[#31405a] outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 dark:border-sky-300/15 dark:bg-black/25 dark:text-foreground';

/** One-tap additions for a room, so the free-text box is never a blank page. */
const ROOM_IDEAS: Array<{ en: string; ar: string }> = [
  { en: 'Floor seating', ar: 'جلسة أرضية' },
  { en: 'Brighter', ar: 'إضاءة أقوى' },
  { en: 'Cosier', ar: 'أكثر دفء' },
  { en: 'More plants', ar: 'نباتات أكثر' },
  { en: 'Feature wall', ar: 'جدار مميز' },
  { en: 'Bigger rug', ar: 'سجادة أكبر' },
];

/**
 * A collapsed choice row that shows the current pick, and opens to a grid of chips. Choosing
 * "Custom…" reveals a text box whose contents go into the brief verbatim.
 *
 * ⛔ This and RoomStyleSheet MUST stay at module scope. Declaring a component inside
 * FloorPlanStudio gives it a fresh identity on every render, so React unmounts and remounts it and
 * any focused text input inside loses focus on every single keystroke.
 */
function ChoiceRow({ title, options, value, customText, onChange, onCustomChange, isArabic, isOpen, onToggle }: {
  title: string;
  options: FloorPlanOption[];
  value: string;
  customText: string;
  onChange: (id: string) => void;
  onCustomChange: (text: string) => void;
  isArabic: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isCustom = value === CUSTOM_ID;
  const selected = options.find((option) => option.id === value) || options[0];
  const summary = isCustom
    ? (customText.trim() || (isArabic ? 'مخصص…' : 'Custom…'))
    : (isArabic ? selected.ar : selected.en);

  return (
    <div className="overflow-hidden rounded-xl border border-[#d9e7f5] bg-[#f7fbff] dark:border-sky-300/15 dark:bg-black/[0.1]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-start"
      >
        <span className="shrink-0 text-[11px] font-extrabold text-foreground/85">{title}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] font-bold text-sky-700 dark:text-sky-300">{summary}</span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#7c8ba5] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {isOpen && (
        <div className="space-y-2 border-t border-[#d9e7f5] p-2 dark:border-sky-300/15">
          <div className="grid grid-cols-3 gap-1.5">
            {options.map((option) => (
              <button
                key={option.id || 'auto'}
                type="button"
                aria-pressed={value === option.id}
                onClick={() => onChange(option.id)}
                className={chipClass(value === option.id)}
              >
                {isArabic ? option.ar : option.en}
              </button>
            ))}
          </div>
          {isCustom && (
            <input
              type="text"
              value={customText}
              onChange={(event) => onCustomChange(event.target.value.slice(0, 200))}
              placeholder={isArabic ? 'صف ما تريده بكلماتك' : 'Describe it in your own words'}
              className={inputClass}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** The bottom sheet that gives one room — or one combined set of rooms — its own direction. */
function RoomStyleSheet({ roomName, override, onChange, onReset, onSeparate, onClose, isArabic }: {
  roomName: string;
  override: RoomStyleOverride;
  onChange: (next: RoomStyleOverride) => void;
  onReset: () => void;
  /** Only passed for a combined set, and the only way back to separate rooms. */
  onSeparate?: () => void;
  onClose: () => void;
  isArabic: boolean;
}) {
  const setRow = (key: FloorPlanRowKey, id: string) =>
    onChange({ ...override, rows: { ...override.rows, [key]: id } });
  const setCustom = (key: FloorPlanRowKey, text: string) =>
    onChange({ ...override, custom: { ...override.custom, [key]: text } });
  const addIdea = (idea: string) => {
    const current = (override.note || '').trim();
    if (current.toLowerCase().includes(idea.toLowerCase())) return;
    onChange({ ...override, note: (current ? `${current}, ${idea}` : idea).slice(0, 300) });
  };
  const purposeChanged = Boolean(purposePhrase(override));

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[1050] mx-auto max-h-[82vh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl border border-[#c9dff5] bg-white p-4 shadow-[0_-8px_40px_rgba(6,5,65,0.25)] dark:border-sky-300/20 dark:bg-[#0c0f14]"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="truncate text-sm font-extrabold uppercase tracking-wide text-foreground">{roomName}</h4>
        <button
          type="button"
          onClick={onClose}
          aria-label={isArabic ? 'إغلاق' : 'Close'}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/5 text-foreground/70 transition active:scale-95 dark:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1 text-[10px] font-semibold text-muted-foreground">
        {onSeparate
          ? (isArabic
            ? 'هذه الغرف ستُعامَل كمساحة واحدة مفتوحة بطراز واحد. لن نضيف أي فاصل بينها، وأي جدار مرسوم في مخططك يبقى كما هو.'
            : 'These rooms will be treated as one open space with one shared look. We will not add a divider between them, and any wall your plan does draw stays exactly as it is.')
          : (isArabic
            ? 'اترك أي صف على «مثل المنزل» ليتبع الطراز العام.'
            : 'Leave a row on “Same as home” and this room just follows the whole-home style.')}
      </p>

      <div className="mt-3 space-y-2.5">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-foreground/65">
            {onSeparate
              ? (isArabic ? 'استخدم هذه المساحة كـ' : 'Use this space as')
              : (isArabic ? 'استخدم هذه الغرفة كـ' : 'Use this room as')}
          </span>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {ROOM_PURPOSES.map((option) => (
              <button
                key={option.id || 'as-drawn'}
                type="button"
                aria-pressed={(override.purpose || '') === option.id}
                onClick={() => onChange({ ...override, purpose: option.id })}
                className={chipClass((override.purpose || '') === option.id)}
              >
                {isArabic ? option.ar : option.en}
              </button>
            ))}
          </div>
          {override.purpose === CUSTOM_ID && (
            <input
              type="text"
              value={override.purposeNote || ''}
              onChange={(event) => onChange({ ...override, purposeNote: event.target.value.slice(0, 80) })}
              placeholder={isArabic ? 'مثال: غرفة طعام' : 'e.g. a dining room'}
              className={`mt-1.5 ${inputClass}`}
            />
          )}
          {purposeChanged && (
            <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-sky-700 dark:text-sky-300">
              {isArabic
                ? 'سنأثِّثها بهذا الاستخدام بدلاً مما هو مكتوب في المخطط، ونزيل أثاث الاستخدام القديم. الجدران والأبواب والنوافذ تبقى كما هي.'
                : 'We will furnish it as that instead of what the plan calls it, and leave out the old fittings. Walls, doors and windows stay exactly where they are.'}
            </p>
          )}
        </div>

        {PER_ROOM_ROWS.map((row) => {
          const current = override.rows?.[row.key] || '';
          const custom = override.custom?.[row.key] || '';
          return (
            <div key={row.key}>
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-foreground/65">
                {isArabic ? row.ar : row.en}
              </span>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {row.options.map((option) => (
                  <button
                    key={option.id || 'inherit'}
                    type="button"
                    aria-pressed={current === option.id}
                    onClick={() => setRow(row.key, option.id)}
                    className={chipClass(current === option.id)}
                  >
                    {isArabic ? option.ar : option.en}
                  </button>
                ))}
              </div>
              {current === CUSTOM_ID && (
                <input
                  type="text"
                  value={custom}
                  onChange={(event) => setCustom(row.key, event.target.value.slice(0, 200))}
                  placeholder={isArabic ? 'صف ما تريده بكلماتك' : 'Describe it in your own words'}
                  className={`mt-1.5 ${inputClass}`}
                />
              )}
            </div>
          );
        })}

        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wide text-foreground/65">
            {isArabic ? 'أي شيء خاص بهذه الغرفة؟' : 'Anything specific for this room?'}
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ROOM_IDEAS.map((idea) => (
              <button
                key={idea.en}
                type="button"
                onClick={() => addIdea(isArabic ? idea.ar : idea.en)}
                className="rounded-full border border-dashed border-sky-300/50 px-2.5 py-1 text-[10px] font-bold text-sky-700 transition active:scale-95 dark:text-sky-300"
              >
                + {isArabic ? idea.ar : idea.en}
              </button>
            ))}
          </div>
          <textarea
            value={override.note || ''}
            onChange={(event) => onChange({ ...override, note: event.target.value.slice(0, 300) })}
            rows={2}
            placeholder={isArabic ? 'مثال: جلسة أرضية وسجاد فاخر' : 'e.g. floor seating and a rich patterned carpet'}
            className={`mt-1.5 resize-none ${inputClass}`}
          />
        </div>
      </div>

      {onSeparate && (
        <button
          type="button"
          onClick={onSeparate}
          className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d9e7f5] px-3 text-[11px] font-extrabold text-[#40506a] transition active:scale-95 dark:border-sky-300/20 dark:text-foreground/75"
        >
          <Unlink className="h-3.5 w-3.5" />
          {isArabic ? 'افصلها إلى غرف منفصلة' : 'Separate back into rooms'}
        </button>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#d9e7f5] px-3 text-[11px] font-extrabold text-[#40506a] transition active:scale-95 dark:border-sky-300/15 dark:text-foreground/75"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {isArabic ? 'مثل المنزل' : 'Reset to home'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 px-3 text-[11px] font-extrabold text-white shadow-[0_0_16px_hsla(210,100%,65%,0.35)] transition active:scale-95"
        >
          <Check className="h-4 w-4" />
          {isArabic ? 'تم' : 'Done'}
        </button>
      </div>
    </div>
  );
}

/** Downscales and re-encodes the blueprint so the payload stays sane without losing line detail. */
const preparePlan = async (file: File): Promise<{ dataUrl: string; width: number; height: number }> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE_PIXELS / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no canvas context');
  // Plans are line art on white, so a white matte avoids black fringing on transparent PNGs.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.92), width, height };
};

/**
 * Re-loads a stored blueprint as if the user had just picked it off their phone.
 *
 * Everything downstream — the plan reader, the render sizing, the reference image sent to the
 * provider — expects a data URL plus the plan's own pixel dimensions. Putting the stored file back
 * through `preparePlan` makes a reopened project indistinguishable from a fresh upload, rather than
 * a second code path that would have to be kept in step with the first one forever.
 */
const planFromStoredUrl = async (url: string, name: string): Promise<PlanAsset> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`blueprint fetch failed: ${response.status}`);
  const blob = await response.blob();
  const file = new File([blob], name, { type: blob.type || 'image/png' });
  const prepared = await preparePlan(file);
  return { name, ...prepared };
};

const ROW_KEYS: FloorPlanRowKey[] = ['style', 'palette', 'flooring', 'lighting', 'ceiling', 'finish'];

/**
 * ⛔ Mirrors `safeSlug` in wakti-designer-save. Room close-ups are stored under the room's slugged
 * name, so "M. BATHROOM" is on disk as "mbathroom". Looking one up by its raw name finds nothing
 * and the close-ups silently vanish on reopen.
 */
const storedRoomKey = (name: string): string => (
  name.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32)
);

/** Pulls one row-and-custom pair out of saved jsonb, dropping anything blank. */
const restoreRowMap = (raw: Record<string, unknown>): Partial<Record<FloorPlanRowKey, string>> => {
  const result: Partial<Record<FloorPlanRowKey, string>> = {};
  ROW_KEYS.forEach((key) => {
    const value = asText(raw[key]);
    if (value) result[key] = value;
  });
  return result;
};

/**
 * Rebuilds the whole-home picks from a saved project.
 *
 * ⛔ `uploadKind` deliberately falls back to null rather than 'home'. Every project saved before
 * that question existed has no answer stored, and guessing "whole home" for what might be a master
 * suite is the exact mistake the picker was added to stop — so a reopened project asks again.
 */
const restoreChoices = (raw: Record<string, unknown>): FloorPlanChoices => {
  const rows = asRecord(raw.rows);
  const uploadKind = asText(raw.uploadKind);
  return {
    furnitureMode: asText(raw.furnitureMode) === 'fresh' ? 'fresh' : 'keep',
    uploadKind: uploadKind === 'home' || uploadKind === 'suite' || uploadKind === 'room' ? uploadKind : null,
    scope: asText(raw.scope) === 'rooms' ? 'rooms' : 'home',
    rows: {
      style: asText(rows.style, DEFAULT_FLOOR_PLAN_CHOICES.rows.style),
      palette: asText(rows.palette, DEFAULT_FLOOR_PLAN_CHOICES.rows.palette),
      flooring: asText(rows.flooring),
      lighting: asText(rows.lighting),
      ceiling: asText(rows.ceiling),
      finish: asText(rows.finish),
    },
    custom: restoreRowMap(asRecord(raw.custom)),
    speed: asText(raw.speed) === 'quick' ? 'quick' : 'best',
    customNote: asText(raw.customNote),
  };
};

/** Rebuilds one room's own direction, keeping only the fields that actually carry something. */
const restoreOverride = (raw: unknown): RoomStyleOverride => {
  const record = asRecord(raw);
  const override: RoomStyleOverride = {};
  const purpose = asText(record.purpose);
  const purposeNote = asText(record.purposeNote);
  const note = asText(record.note);
  if (purpose) override.purpose = purpose;
  if (purposeNote) override.purposeNote = purposeNote;
  if (note) override.note = note;
  const rows = restoreRowMap(asRecord(record.rows));
  const custom = restoreRowMap(asRecord(record.custom));
  if (Object.keys(rows).length) override.rows = rows;
  if (Object.keys(custom).length) override.custom = custom;
  return override;
};

export default function FloorPlanStudio({ language, handoff, onHandoffConsumed }: {
  language: 'en' | 'ar';
  /** A saved project to restore, handed over by the Saved tab. Optional so nothing else breaks. */
  handoff?: FloorPlanHandoff | null;
  /** Called once the hand-over has been taken, so it can never be applied twice. */
  onHandoffConsumed?: () => void;
}) {
  const isArabic = language === 'ar';
  const { isGuest } = useAuth();

  const [step, setStep] = useState<StudioStep>('plan');
  const [plan, setPlan] = useState<PlanAsset | null>(null);
  const [choices, setChoices] = useState<FloorPlanChoices>(DEFAULT_FLOOR_PLAN_CHOICES);
  const [isReadingFile, setIsReadingFile] = useState(false);

  // Per-room direction, keyed by label id. Empty for a room means it follows the whole home.
  const [roomOverrides, setRoomOverrides] = useState<RoomOverrides>({});
  // Rooms the user has tied together into one space. Their styling lives in roomOverrides under
  // the group's own id, so a group is just another target as far as the sheet and prompt care.
  const [roomGroups, setRoomGroups] = useState<RoomGroup[]>([]);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);
  // In room-by-room mode the six whole-home rows become the base for everything left untouched,
  // tucked behind one collapsed row so the room list is what the user actually sees.
  const [baseOpen, setBaseOpen] = useState(false);
  // Combining is a separate tap mode: while it is on, tapping a room selects it instead of
  // opening its sheet. Keeping the two apart avoids a long-press or a fiddly checkbox on mobile.
  const [combineMode, setCombineMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // The plan is read once, on the way into the style step, so the room list exists in time for
  // the per-room chips. Tracked with a flag so the render never pays for a second reading.
  const [hasReadPlan, setHasReadPlan] = useState(false);
  const [isReadingPlan, setIsReadingPlan] = useState(false);

  const [planBrief, setPlanBrief] = useState('');
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [labels, setLabels] = useState<FloorPlanLabel[]>([]);
  const [roomRenders, setRoomRenders] = useState<RoomRender[]>([]);
  const [editHistory, setEditHistory] = useState<string[]>([]);
  const [editInput, setEditInput] = useState('');

  const [statusMessage, setStatusMessage] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isWorking, setIsWorking] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  // The render deliberately carries no text, so the pins are now the only thing naming a room as
  // well as the way into it. They stay on by default and can be hidden for a clean screenshot.
  const [showPins, setShowPins] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeRoom = labels.find((label) => label.id === activeRoomId) || null;
  const activeRoomRender = roomRenders.find((item) => item.labelId === activeRoomId) || null;

  /**
   * Everything the user can style: each ungrouped room on its own, and each group once, in the
   * order the rooms were read off the plan. A group takes the position of its first member so the
   * list never jumps around when rooms are tied together.
   */
  const styleTargets = useMemo(() => {
    const seen = new Set<string>();
    const targets: Array<{ id: string; names: string[]; labelIds: string[] }> = [];
    labels.forEach((label) => {
      if (seen.has(label.id)) return;
      const group = roomGroups.find((item) => item.labelIds.includes(label.id));
      if (!group) {
        seen.add(label.id);
        targets.push({ id: label.id, names: [label.name], labelIds: [label.id] });
        return;
      }
      const members = labels.filter((item) => group.labelIds.includes(item.id));
      members.forEach((member) => seen.add(member.id));
      targets.push({
        id: group.id,
        names: members.map((member) => member.name),
        labelIds: members.map((member) => member.id),
      });
    });
    return targets;
  }, [labels, roomGroups]);

  const overrideTarget = styleTargets.find((target) => target.id === overrideTargetId) || null;
  // A group counts as customised on its own: tying two rooms together is already a decision.
  const customisedCount = styleTargets
    .filter((target) => target.names.length > 1 || hasRoomOverride(roomOverrides[target.id])).length;

  /** What the prompt builder needs: every room or group paired with the direction it carries. */
  const roomsForPrompt = useMemo(
    () => styleTargets.map((target) => ({
      names: target.names,
      override: roomOverrides[target.id] || {},
    })),
    [styleTargets, roomOverrides],
  );

  /** A room inherits its group's direction, so a close-up of it matches the main render. */
  const overrideForLabel = (labelId: string): RoomStyleOverride | undefined => {
    const group = roomGroups.find((item) => item.labelIds.includes(labelId));
    return roomOverrides[group ? group.id : labelId];
  };

  const toggleSelected = (id: string) => setSelectedIds((current) => (
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  ));

  /**
   * Ties the selected targets into one. Selecting an existing group folds its members in rather
   * than nesting, and the new group keeps the first direction it finds so the user's styling is
   * not silently thrown away.
   */
  const combineSelected = () => {
    const chosen = styleTargets.filter((target) => selectedIds.includes(target.id));
    if (chosen.length < 2) return;
    const labelIds = chosen.flatMap((target) => target.labelIds);
    const inherited = chosen.map((target) => roomOverrides[target.id]).find(hasRoomOverride);
    const groupId = `group-${Date.now()}`;
    setRoomGroups((current) => [
      ...current.filter((group) => !group.labelIds.some((id) => labelIds.includes(id))),
      { id: groupId, labelIds },
    ]);
    setRoomOverrides((current) => {
      const next = { ...current };
      chosen.forEach((target) => delete next[target.id]);
      if (inherited) next[groupId] = inherited;
      return next;
    });
    setSelectedIds([]);
    setCombineMode(false);
  };

  /** Breaks a group back into individual rooms and drops the direction it carried. */
  const separateGroup = (groupId: string) => {
    setRoomGroups((current) => current.filter((group) => group.id !== groupId));
    setRoomOverrides((current) => {
      const next = { ...current };
      delete next[groupId];
      return next;
    });
    setOverrideTargetId(null);
  };

  /**
   * The six whole-home rows. They appear on their own when styling the whole house, and behind
   * an "Everything else" row when working room by room, so they are built once here.
   */
  const directionRows = (
    <div className="space-y-1.5">
      {FLOOR_PLAN_ROWS.map((row) => (
        <ChoiceRow
          key={row.key}
          title={isArabic ? row.ar : row.en}
          options={row.options}
          value={choices.rows[row.key]}
          customText={choices.custom[row.key] || ''}
          onChange={(id) => setChoices((current) => ({
            ...current,
            rows: { ...current.rows, [row.key]: id },
          }))}
          onCustomChange={(text) => setChoices((current) => ({
            ...current,
            custom: { ...current.custom, [row.key]: text },
          }))}
          isArabic={isArabic}
          isOpen={openSection === row.key}
          onToggle={() => setOpenSection(openSection === row.key ? null : row.key)}
        />
      ))}
    </div>
  );

  /**
   * The room list. Shown in BOTH scopes, because combining two rooms is a fact about the house and
   * has nothing to do with which styling path you picked — hiding it inside "Room by room" meant
   * the owner never found it. In Whole house the chips are inert except for combining, and a
   * combined chip stays tappable so "make the dining and majlis one big majlis" is still one tap.
   */
  const roomListSection = (
    <>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[10px] font-extrabold uppercase tracking-wide text-foreground/65">
          {isArabic ? 'غرفك' : 'Your rooms'}
          {customisedCount > 0 && (isArabic ? ` · ${customisedCount} مخصصة` : ` · ${customisedCount} set`)}
        </span>
        {styleTargets.length > 1 && (
          <button
            type="button"
            onClick={() => { setCombineMode(!combineMode); setSelectedIds([]); }}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-sky-700 transition hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-white/10"
          >
            {combineMode ? <X className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
            {combineMode ? (isArabic ? 'إلغاء' : 'Cancel') : (isArabic ? 'دمج غرف' : 'Combine rooms')}
          </button>
        )}
      </div>

      {isReadingPlan ? (
        <div className="mt-2 flex items-center gap-2 px-1 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-sky-600 dark:text-sky-300" />
          <span className="text-[10px] font-bold text-foreground/75">
            {isArabic ? 'نقرأ غرف المخطط…' : 'Reading the rooms on your plan…'}
          </span>
        </div>
      ) : styleTargets.length ? (
        <>
          <p className="mt-1 text-[10px] font-semibold leading-relaxed text-muted-foreground">
            {combineMode
              ? (isArabic
                ? 'اختر غرفتين أو أكثر مفتوحتين على بعضهما — مثل الصالة والمجلس — لتُعامَلا كمساحة واحدة بطراز واحد.'
                : 'Pick two or more rooms that open onto each other — a dining area and a majlis, say — and they will be treated as one space with one look.')
              : choices.scope === 'rooms'
                ? (isArabic
                  ? 'اضغط أي غرفة لتعطيها طرازًا خاصًا أو تغير استخدامها. ما لا تلمسه يتبع الطراز الأساسي بالأسفل — وكله في صورة واحدة.'
                  : 'Tap a room to give it its own look, or to change what the room is used for. Anything you leave alone follows the base style below — and it all comes out in one render.')
                : (isArabic
                  ? 'إن كانت غرفتان مفتوحتين على بعضهما فاضغط «دمج غرف» لتأثيثهما كمساحة واحدة.'
                  : 'If two rooms open onto each other, tap “Combine rooms” and they will be furnished as one single space.')}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {styleTargets.map((target) => {
              const combined = target.names.length > 1;
              const customised = combined || hasRoomOverride(roomOverrides[target.id]);
              const selected = combineMode && selectedIds.includes(target.id);
              // In Whole house the chips are there for combining only, so plain rooms are inert.
              const openable = combineMode || choices.scope === 'rooms' || combined;
              return (
                <button
                  key={target.id}
                  type="button"
                  disabled={!openable}
                  aria-pressed={selected}
                  onClick={() => (combineMode ? toggleSelected(target.id) : setOverrideTargetId(target.id))}
                  className={`relative min-h-[40px] rounded-xl border px-2 py-2 text-[10px] font-extrabold uppercase tracking-wide transition active:scale-95 disabled:cursor-default disabled:active:scale-100 ${combined ? 'col-span-2' : ''} ${
                    selected
                      ? 'border-sky-400 bg-sky-400/30 text-sky-900 ring-2 ring-sky-400/45 dark:text-sky-50'
                      : customised
                        ? 'border-sky-300/45 bg-sky-400/20 text-sky-800 shadow-[0_0_12px_hsla(210,100%,65%,0.2)] dark:text-sky-100'
                        : 'border-[#d9e7f5] bg-[#f7fbff] text-[#40506a] dark:border-sky-300/15 dark:bg-black/[0.1] dark:text-foreground/70'
                  }`}
                >
                  <span className="block truncate">{target.names.join(' + ')}</span>
                  {selected ? (
                    <Check className="absolute end-1 top-1 h-3 w-3 text-sky-700 dark:text-sky-200" />
                  ) : customised ? (
                    <span className="absolute end-1 top-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                  ) : null}
                </button>
              );
            })}
          </div>
          {combineMode && (
            <button
              type="button"
              disabled={selectedIds.length < 2}
              onClick={combineSelected}
              className="mt-2 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-3 text-[11px] font-extrabold text-white transition active:scale-95 disabled:opacity-40"
            >
              <Link2 className="h-3.5 w-3.5" />
              {selectedIds.length > 1
                ? (isArabic ? `ادمجها كمساحة واحدة (${selectedIds.length})` : `Combine ${selectedIds.length} rooms into one space`)
                : (isArabic ? 'اختر غرفتين على الأقل' : 'Pick at least two rooms')}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 text-[10px] font-semibold leading-relaxed text-muted-foreground">
            {isArabic
              ? 'لم نتمكن من قراءة أسماء الغرف من مخططك، لذلك لا يمكن تخصيص الغرف ولا دمجها. جرّب القراءة مرة أخرى — عادةً تنجح.'
              : 'We could not read the room names off your plan, so there is nothing to style room by room or combine. Try reading it again — that usually works.'}
          </p>
          <button
            type="button"
            onClick={runPlanRead}
            disabled={isReadingPlan}
            className="mt-2 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[#d9e7f5] px-3 text-[11px] font-extrabold text-[#40506a] transition active:scale-95 disabled:opacity-50 dark:border-sky-300/15 dark:text-foreground/75"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isArabic ? 'اقرأ المخطط مرة أخرى' : 'Read the plan again'}
          </button>
        </>
      )}
    </>
  );

  /** Shown on the collapsed "Everything else" row so the base look is visible without opening it. */
  const baseStyle = FLOOR_PLAN_ROWS[0].options.find((option) => option.id === choices.rows.style);

  const speed = speedSettings(choices.speed);

  /**
   * Resolution and provider effort for a whole-home render.
   *
   * ⛔ ALWAYS BEST. There is no speed choice and no "upgrade later" step. Asking the user to pick
   * medium or high effort before they have seen anything was meaningless, and offering an upgrade
   * afterwards just meant the first thing they ever saw was the worst version of their home. On a
   * whole villa at 1024px a staircase is only about sixty pixels wide, which is not enough to draw
   * treads and a handrail at all — so the cheap render was quietly costing real detail.
   */
  const setupFor = (id: FloorPlanSpeed): RenderSetup => {
    const target = speedSettings(id);
    return {
      quality: target.quality,
      ...(plan
        ? renderDimensions(plan.width, plan.height, target.maxEdge)
        : { width: target.maxEdge, height: target.maxEdge }),
    };
  };

  const planSetup = (): RenderSetup => setupFor('best');

  const lightboxImages = useMemo<LightboxImage[]>(() => {
    const images: LightboxImage[] = [];
    if (renderUrl) images.push({ url: renderUrl, label: isArabic ? 'المخطط كامل' : 'Whole home' });
    roomRenders.forEach((room) => images.push({ url: room.url, label: room.name }));
    return images;
  }, [renderUrl, roomRenders, isArabic]);

  /** Which hand-over has already been applied, so the same one is never restored twice. */
  const restoredProjectRef = useRef<string | null>(null);

  /**
   * Picks up a saved project handed over from the Saved tab.
   *
   * The stored blueprint is re-fetched and run back through `preparePlan`, so from this point on a
   * reopened project behaves exactly like a fresh upload. Where it lands differs by what it is:
   *   - A DRAWN LAYOUT stops at the plan step. It has never been read or styled, and the user still
   *     has to say whether it is a whole home, a suite or one room.
   *   - A FINISHED FLOOR PLAN gets its render, pins, reading, picks and edit history back and lands
   *     on the result, ready to keep editing without paying to read the plan again.
   *
   * ⛔ Guarded by project id, not by a cancellation flag. Clearing the hand-over in the parent
   * changes this effect's dependency, and a cleanup-based guard would abort its own restore.
   */
  useEffect(() => {
    if (!handoff) {
      // Lets the same project be reopened again later rather than being blocked by a stale id.
      restoredProjectRef.current = null;
      return;
    }
    if (restoredProjectRef.current === handoff.project.id) return;
    restoredProjectRef.current = handoff.project.id;

    const { project, blueprintUrl } = handoff;
    void (async () => {
      setIsReadingFile(true);
      setErrorMessage('');
      try {
        const asset = await planFromStoredUrl(blueprintUrl, `${project.title || 'blueprint'}.png`);

        // Common ground first, so nothing from the previous session can leak across.
        setPlan(asset);
        setSelectedIds([]);
        setCombineMode(false);
        setActiveRoomId(null);
        setEditInput('');
        setStatusMessage('');
        setElapsedSeconds(0);
        setIsSaved(false);

        if (project.mode !== 'floorplan') {
          setChoices(DEFAULT_FLOOR_PLAN_CHOICES);
          setRoomOverrides({});
          setRoomGroups([]);
          setHasReadPlan(false);
          setPlanBrief('');
          setLabels([]);
          setRenderUrl(null);
          setRoomRenders([]);
          setEditHistory([]);
          setStep('plan');
          toast.success(isArabic ? 'تم فتح الرسم، جاهز للتأثيث' : 'Drawing opened, ready to furnish');
          return;
        }

        const saved = project.choices;
        const brief = asText(saved.planBrief);
        const restoredLabels: FloorPlanLabel[] = asArray(saved.labels)
          .map((entry) => asRecord(entry))
          .filter((entry) => asText(entry.id) && asText(entry.name))
          .map((entry) => ({
            id: asText(entry.id),
            name: asText(entry.name),
            x: asNumber(entry.x, 0.5),
            y: asNumber(entry.y, 0.5),
          }));
        const labelIds = new Set(restoredLabels.map((label) => label.id));

        const restoredOverrides: RoomOverrides = {};
        Object.entries(asRecord(saved.roomOverrides)).forEach(([key, value]) => {
          restoredOverrides[key] = restoreOverride(value);
        });

        // A group needs at least two surviving rooms to still mean anything.
        const restoredGroups: RoomGroup[] = asArray(saved.roomGroups)
          .map((entry) => asRecord(entry))
          .map((entry) => ({
            id: asText(entry.id) || crypto.randomUUID(),
            labelIds: asArray(entry.labelIds).map((id) => asText(id)).filter((id) => labelIds.has(id)),
          }))
          .filter((group) => group.labelIds.length > 1);

        const wholeHome = projectImageUrl(project, FLOOR_PLAN_KEY);

        setChoices(restoreChoices(saved));
        setPlanBrief(brief);
        setHasReadPlan(Boolean(brief) || restoredLabels.length > 0);
        setLabels(restoredLabels);
        setRoomOverrides(restoredOverrides);
        setRoomGroups(restoredGroups);
        setEditHistory(asArray(saved.edits).map((entry) => asText(entry)).filter(Boolean));
        setRenderUrl(wholeHome || null);
        setRoomRenders(restoredLabels
          .map((label) => {
            const url = projectImageUrl(project, storedRoomKey(label.name));
            return url ? { labelId: label.id, name: label.name, url } : null;
          })
          .filter((room): room is RoomRender => room !== null));
        setStep(wholeHome ? 'result' : 'style');
        toast.success(isArabic ? 'تم فتح المشروع' : 'Project opened');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[floorplan] reopen failed:', message);
        toast.error(isArabic ? 'تعذّر فتح هذا المشروع' : 'Could not open that project');
      } finally {
        setIsReadingFile(false);
        onHandoffConsumed?.();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff]);

  const handlePlanSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(isArabic ? 'الملف أكبر من 12 ميجابايت' : 'That file is larger than 12 MB');
      return;
    }
    setIsReadingFile(true);
    try {
      const prepared = await preparePlan(file);
      if (!prepared.dataUrl) throw new Error('empty');
      setPlan({ name: file.name, ...prepared });
      // A different plan means a different set of rooms, so anything read before is now stale.
      setHasReadPlan(false);
      setLabels([]);
      setRoomOverrides({});
      setRoomGroups([]);
      setPlanBrief('');
      // The new drawing may well be a different kind of thing — a suite where the last was a whole
      // floor — and silently keeping the old answer would mis-describe it. Make them pick again.
      setChoices((current) => ({ ...current, uploadKind: null }));
    } catch {
      toast.error(isArabic ? 'تعذّر قراءة الملف' : 'Could not read that file');
    } finally {
      setIsReadingFile(false);
    }
  };

  const getToken = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error(isArabic ? 'يجب تسجيل الدخول' : 'You need to sign in first');
    return token;
  };

  /**
   * Reads the blueprint once. The written brief is how detail the image model would otherwise
   * gloss over reaches it, and the room list is what becomes the editable labels. A failed
   * read must never cost the user their render, so it degrades to an empty brief.
   */
  const readPlan = async (token: string, planDataUrl: string): Promise<{ brief: string; labels: FloorPlanLabel[] }> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/wakti-room-analyzer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'plan', image_base64: planDataUrl }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success) return { brief: '', labels: [] };
      const rooms: unknown = json?.rooms;
      const parsed: FloorPlanLabel[] = (Array.isArray(rooms) ? rooms : [])
        .map((entry, index) => {
          const row = entry as { name?: unknown; x?: unknown; y?: unknown };
          const name = String(row?.name || '').trim();
          const x = Number(row?.x);
          const y = Number(row?.y);
          if (!name || !Number.isFinite(x) || !Number.isFinite(y)) return null;
          return { id: `room-${index}-${name.toLowerCase().replace(/\s+/g, '-')}`, name, x, y };
        })
        .filter((item): item is FloorPlanLabel => item !== null);
      return { brief: typeof json?.analysis === 'string' ? json.analysis.trim() : '', labels: parsed };
    } catch {
      return { brief: '', labels: [] };
    }
  };

  /**
   * Asks the vision judge whether an edited render actually shows the ONE change the client
   * asked for. Any failure of the check itself (network, parsing, refusal) degrades to
   * "compliant" — a broken judge must never block a finished render from reaching the client.
   */
  const verifyEdit = async (token: string, imageUrl: string, instruction: string): Promise<{ compliant: boolean; reason: string }> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/wakti-room-analyzer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'verify', image_url: imageUrl, instruction }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success) return { compliant: true, reason: '' };
      return {
        compliant: json?.compliant !== false,
        reason: String(json?.reason || ''),
      };
    } catch {
      return { compliant: true, reason: '' };
    }
  };

  /**
   * Moves to the style step, reading the plan first so the per-room chips have a room list.
   *
   * A failed reading costs the user their per-room controls but never their render, so it is
   * swallowed — the whole-home style still works, and the drawing itself still carries the room
   * names into the render.
   */
  const goToStyle = async () => {
    if (!plan) return;
    setStep('style');
    if (hasReadPlan || isReadingPlan) return;
    await runPlanRead();
  };

  /**
   * Reads the plan and, if the room list comes back empty, tries once more.
   *
   * ⛔ An empty room list is a REAL failure and must never pass quietly. It costs the user their
   * pins, the whole per-room panel and the combine button, and it means the renderer loses the
   * architect's description too — which is how invented walls and missing staircases got through.
   * The reader returns 200 with a partial brief in that case, so nothing upstream notices.
   *
   * Declared as a function, not a const arrow, because `roomListSection` above wires it to the
   * retry button and a declaration is hoisted — an arrow here would be read before it exists.
   */
  async function runPlanRead() {
    if (!plan) return;
    setIsReadingPlan(true);
    try {
      const token = await getToken();
      let read = await readPlan(token, plan.dataUrl);
      if (!read.labels.length) {
        console.warn('[floorplan] plan read returned no rooms, retrying once');
        read = await readPlan(token, plan.dataUrl);
      }
      setPlanBrief(read.brief);
      setLabels(read.labels);
      setHasReadPlan(true);
      if (!read.labels.length) {
        toast.error(isArabic
          ? 'تعذّر قراءة أسماء الغرف — جرّب القراءة مرة أخرى'
          : 'Could not read the room names — try reading the plan again');
      }
    } catch (error) {
      console.error('[floorplan] plan read failed:', error instanceof Error ? error.message : error);
    } finally {
      setIsReadingPlan(false);
    }
  }

  /**
   * Runs one render through Runware GPT Image 2: submit the job, then poll until the image lands.
   *
   * ⛔ It must never be turned back into a single blocking call. GPT Image 2 needs 2–3 minutes on
   * a dense plan, which is longer than Runware will hold a connection open — it returns
   * `failedTaskTimeout` while still generating and charging for the image, so the user pays for a
   * picture the app then reports as a failure.
   */
  const runRender = async (
    token: string,
    prompt: string,
    references: string[],
    size: RenderSetup,
    onProgress?: (seconds: number) => void,
  ): Promise<string> => {
    const call = async (payload: Record<string, unknown>) => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/wakti-runware-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => ({}));
      if (json?.error === 'TRIAL_LIMIT_REACHED') {
        throw new Error(isArabic ? 'انتهت محاولاتك المجانية' : 'Your free trial limit is reached');
      }
      if (!response.ok || !json?.success) {
        throw new Error(String(json?.error || (isArabic ? 'فشل إنشاء الصورة' : 'Image generation failed')));
      }
      return json as { status?: string; url?: string; taskUUID?: string; error?: string };
    };

    const submitted = await call({
      prompt,
      referenceImages: references,
      width: size.width,
      height: size.height,
      quality: size.quality,
    });
    if (submitted.status === 'success' && submitted.url) return submitted.url;

    const taskUUID = submitted.taskUUID;
    if (!taskUUID) throw new Error(isArabic ? 'فشل إنشاء الصورة' : 'Image generation failed');

    const startedAt = Date.now();
    while (Date.now() - startedAt < POLL_CEILING_MS) {
      await wait(POLL_INTERVAL_MS);
      onProgress?.(Math.round((Date.now() - startedAt) / 1000));
      const polled = await call({ action: 'poll', taskUUID });
      if (polled.status === 'success' && polled.url) return polled.url;
      if (polled.status === 'error') {
        throw new Error(String(polled.error || (isArabic ? 'فشل إنشاء الصورة' : 'Image generation failed')));
      }
    }
    throw new Error(isArabic
      ? 'استغرقت الصورة وقتًا أطول من المتوقع'
      : 'The image took longer than expected');
  };

  /**
   * The provider's moderation refuses intermittently and charges nothing for a refusal, so one
   * free retry with desensitised wording is the right response rather than failing outright.
   */
  const renderWithRetry = async (
    token: string,
    references: string[],
    size: RenderSetup,
    buildPrompt: (safeMode: boolean) => string,
    progressLabel?: string,
  ): Promise<string> => {
    const onProgress = (seconds: number) => {
      setElapsedSeconds(seconds);
      if (progressLabel) setStatusMessage(`${progressLabel} · ${formatElapsed(seconds, isArabic)}`);
    };
    try {
      return await runRender(token, buildPrompt(false), references, size, onProgress);
    } catch (firstError) {
      const message = firstError instanceof Error ? firstError.message : String(firstError);
      const looksLikeRefusal = /431|refus|filter|policy|sensitive|blocked|moderation/i.test(message);
      if (!looksLikeRefusal) throw firstError;
      setStatusMessage(isArabic ? 'إعادة المحاولة بصياغة أخرى…' : 'Retrying with different wording…');
      return await runRender(token, buildPrompt(true), references, size, onProgress);
    }
  };

  const generate = async () => {
    if (!plan || isWorking) return;
    if (isGuest) {
      setGuestDialogOpen(true);
      return;
    }
    setIsWorking(true);
    setErrorMessage('');
    setStep('result');
    setRenderUrl(null);
    setRoomRenders([]);
    setEditHistory([]);
    setElapsedSeconds(0);
    setIsSaved(false);

    try {
      const token = await getToken();

      // Normally already done on the way into the style step; this is the fallback path.
      let brief = planBrief;
      let rooms = roomsForPrompt;
      if (!hasReadPlan) {
        setStatusMessage(isArabic ? 'نقرأ المخطط: الغرف، الأبواب، النوافذ، السلالم…' : 'Reading your plan: rooms, doors, windows, stairs…');
        const read = await readPlan(token, plan.dataUrl);
        brief = read.brief;
        rooms = read.labels.map((label) => ({ names: [label.name], override: roomOverrides[label.id] || {} }));
        setPlanBrief(brief);
        setLabels(read.labels);
        setHasReadPlan(true);
      }

      setStatusMessage(isArabic ? 'نرسم منزلك بالكامل… قد يستغرق دقيقة' : 'Finishing your whole home… this can take a minute');
      const url = await renderWithRetry(
        token,
        [plan.dataUrl],
        planSetup(),
        (safeMode) => buildFloorPlanPrompt(choices, { planBrief: brief, safeMode, rooms }),
        isArabic ? 'نرسم منزلك بالكامل' : 'Finishing your whole home',
      );
      setRenderUrl(url);
      setStatusMessage('');
      toast.success(isArabic ? 'جاهز!' : 'Ready!');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setStatusMessage('');
      console.error('[floorplan] generate failed:', message);
    } finally {
      setIsWorking(false);
    }
  };

  /** Re-renders the whole plan with the user's change appended to the running list of edits. */
  const applyEdit = async (rawInstruction: string) => {
    const instruction = rawInstruction.trim();
    if (!instruction || !plan || isWorking) return;
    const nextHistory = [...editHistory, instruction];

    setIsWorking(true);
    setErrorMessage('');
    setEditInput('');
    setEditHistory(nextHistory);
    setIsSaved(false);
    setStatusMessage(isArabic ? 'نطبّق التغيير ونعيد البناء…' : 'Applying your change and rebuilding…');

    try {
      const token = await getToken();
      // ⛔ The render on screen goes FIRST, the blueprint second. Rendering an edit from the
      // blueprint alone meant the model had never seen its own previous output, so "leave the rest
      // alone" was impossible to obey and every room came back redesigned. Giving it the current
      // image to copy is the only thing that makes a one-line change behave like a one-line change.
      const editReferences = renderUrl ? [renderUrl, plan.dataUrl] : [plan.dataUrl];
      // ⛔ When there IS a current render, only the NEW instruction is sent — never the whole
      // history. Reference 1 already shows every earlier change applied, so repeating them orders
      // the model to change things that are already correct, and each repeated line is one more
      // invitation to drift. The full history still lives in state: undo and save need it.
      const promptEdits = renderUrl ? [instruction] : nextHistory;
      const url = await renderWithRetry(
        token,
        editReferences,
        planSetup(),
        (safeMode) => buildFloorPlanPrompt(choices, {
          planBrief,
          safeMode,
          editHistory: promptEdits,
          rooms: roomsForPrompt,
          editFromCurrentRender: Boolean(renderUrl),
        }),
        isArabic ? 'نطبّق التغيير' : 'Applying your change',
      );

      // The judge reads the fresh render against the client's own words. A disobedient render is
      // retried ONCE with the failure spelled out — and the second result is kept whatever the
      // judge says, so a stubborn request can never burn renders in a loop.
      if (renderUrl) {
        setStatusMessage(isArabic ? 'نتأكد أن التغيير ظهر…' : 'Checking your change took effect…');
        const verdict = await verifyEdit(token, url, instruction);
        if (!verdict.compliant) {
          console.warn('[floorplan] edit judge rejected first attempt:', verdict.reason);
          setStatusMessage(isArabic ? 'لم يظهر التغيير، نعيد المحاولة…' : 'The change did not come through, retrying…');
          const retryReferences = [url, plan.dataUrl];
          const retryUrl = await renderWithRetry(
            token,
            retryReferences,
            planSetup(),
            (safeMode) => buildFloorPlanPrompt(choices, {
              planBrief,
              safeMode,
              editHistory: [
                `YOUR PREVIOUS ATTEMPT IGNORED THIS REQUEST (${verdict.reason || 'the change was not visible'}). It is the ONLY thing that matters now: ${instruction}`,
              ],
              rooms: roomsForPrompt,
              editFromCurrentRender: true,
            }),
            isArabic ? 'نعيد تطبيق التغيير' : 'Re-applying your change',
          );
          setRenderUrl(retryUrl);
          setRoomRenders([]);
          setStatusMessage('');
          setElapsedSeconds(0);
          toast.success(isArabic ? 'تم التعديل' : 'Change applied');
          return;
        }
      }
      setRenderUrl(url);
      // Room close-ups were taken from the previous render, so they no longer match.
      setRoomRenders([]);
      setStatusMessage('');
      toast.success(isArabic ? 'تم التعديل' : 'Change applied');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setStatusMessage('');
      // Roll the failed instruction back so the next attempt is not poisoned by it.
      setEditHistory(editHistory);
      console.error('[floorplan] edit failed:', message);
    } finally {
      setIsWorking(false);
    }
  };

  const undoLastEdit = async () => {
    if (!editHistory.length || isWorking || !plan) return;
    const nextHistory = editHistory.slice(0, -1);
    setIsWorking(true);
    setErrorMessage('');
    setEditHistory(nextHistory);
    setIsSaved(false);
    setStatusMessage(isArabic ? 'نتراجع عن آخر تغيير…' : 'Undoing the last change…');
    try {
      const token = await getToken();
      // Undo renders from the blueprint ALONE, deliberately. The picture on screen still contains
      // the change being undone, so handing it back as a reference to copy would preserve exactly
      // the thing the user just asked to remove.
      const url = await renderWithRetry(
        token,
        [plan.dataUrl],
        planSetup(),
        (safeMode) => buildFloorPlanPrompt(choices, { planBrief, safeMode, editHistory: nextHistory, rooms: roomsForPrompt }),
        isArabic ? 'نتراجع عن آخر تغيير' : 'Undoing the last change',
      );
      setRenderUrl(url);
      setRoomRenders([]);
      setStatusMessage('');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      setStatusMessage('');
      setEditHistory(editHistory);
    } finally {
      setIsWorking(false);
    }
  };

  /**
   * Renders one room in close-up detail. The reference is the finished whole-home render rather
   * than the blueprint, so the room's finishes and furniture match what the user is looking at.
   */
  const renderRoom = async (label: FloorPlanLabel) => {
    if (!renderUrl || isWorking || pendingRoomId) return;
    if (roomRenders.length >= MAX_ROOM_RENDERS && !roomRenders.some((item) => item.labelId === label.id)) {
      toast.info(isArabic
        ? `يمكن حفظ ${MAX_ROOM_RENDERS} غرف كحد أقصى مع المشروع`
        : `Up to ${MAX_ROOM_RENDERS} rooms can be saved with a project`);
      return;
    }

    setPendingRoomId(label.id);
    setErrorMessage('');
    try {
      const token = await getToken();
      // A single room close-up is framed square regardless of the whole plan's proportions.
      const url = await renderWithRetry(
        token,
        [renderUrl],
        { width: 1024, height: 1024, quality: speed.quality },
        (safeMode) => buildRoomZoomPrompt(label.name, choices, {
          planBrief,
          safeMode,
          override: overrideForLabel(label.id),
        }),
        isArabic ? `نجهّز ${label.name}` : `Rendering ${label.name}`,
      );
      setRoomRenders((current) => [
        ...current.filter((item) => item.labelId !== label.id),
        { labelId: label.id, name: label.name, url },
      ]);
      setIsSaved(false);
      toast.success(isArabic ? `تم تجهيز ${label.name}` : `${label.name} is ready`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      console.error('[floorplan] room render failed:', message);
    } finally {
      setPendingRoomId(null);
    }
  };

  const saveProject = async () => {
    if (!renderUrl || isSaving) return;
    setIsSaving(true);
    try {
      const token = await getToken();
      // ⛔ The blueprint goes in as well, and it is the entire reason this project can be reopened
      // later. It is a browser data URL, which wakti-designer-save only started accepting when
      // reopening was built — and the image cap had to go from 6 to 8 to make room for it, because
      // one render plus five close-ups already filled the old limit exactly.
      const images = [
        { key: FLOOR_PLAN_KEY, url: renderUrl },
        ...roomRenders.map((room) => ({ key: room.name, url: room.url })),
        ...(plan ? [{ key: BLUEPRINT_KEY, url: plan.dataUrl }] : []),
      ];
      const style = FLOOR_PLAN_STYLES.find((item) => item.id === choices.rows.style);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/wakti-designer-save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: 'floorplan',
          title: isArabic ? 'مخطط ثلاثي الأبعاد' : '3D floor plan',
          summary: [style ? (isArabic ? style.ar : style.en) : '', labels.map((label) => label.name).join(', ')]
            .filter(Boolean)
            .join(' — '),
          choices: {
            ...choices,
            rooms: labels.map((label) => label.name),
            // ⛔ The pins themselves, with their coordinates and ids — not just the names above.
            // Names alone cannot be put back on the drawing, and the ids are what roomOverrides and
            // roomGroups key on, so without these both would reopen orphaned.
            labels,
            // The architect's reading, so reopening does not have to pay to read the plan again.
            planBrief,
            roomOverrides,
            // Stored with their real ids for the same reason: a group's own styling lives in
            // roomOverrides under the group id, so regenerating it on load would lose that styling.
            roomGroups,
            edits: editHistory,
          },
          images,
        }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json?.success) {
        throw new Error(String(json?.error || (isArabic ? 'تعذّر الحفظ' : 'Could not save')));
      }
      setIsSaved(true);
      toast.success(isArabic
        ? `تم الحفظ في مشاريعك (${json.savedCount} صور)`
        : `Saved to your designs (${json.savedCount} images)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : (isArabic ? 'تعذّر الحفظ' : 'Could not save');
      console.error('[floorplan] save failed:', message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const saveAllToPhone = async () => {
    if (!renderUrl) return;
    const items = [
      { url: renderUrl, fileName: renderFileName('floor-plan', 1) },
      ...roomRenders.map((room, index) => ({ url: room.url, fileName: renderFileName(room.name, index + 2) })),
    ];
    await saveImagesToDevice(items);
  };

  const startOver = () => {
    setStep('plan');
    setPlan(null);
    setRoomOverrides({});
    setRoomGroups([]);
    setOverrideTargetId(null);
    setOpenSection(null);
    setBaseOpen(false);
    setCombineMode(false);
    setSelectedIds([]);
    setHasReadPlan(false);
    setElapsedSeconds(0);
    setPlanBrief('');
    setRenderUrl(null);
    setLabels([]);
    setRoomRenders([]);
    setEditHistory([]);
    setEditInput('');
    setErrorMessage('');
    setStatusMessage('');
    setActiveRoomId(null);
    setIsSaved(false);
    setChoices(DEFAULT_FLOOR_PLAN_CHOICES);
  };

  const cardClass = 'rounded-2xl border border-[#c9dff5] bg-white/90 p-4 shadow-[0_10px_24px_rgba(6,5,65,0.08)] dark:border-sky-300/20 dark:bg-black/30 dark:shadow-none';
  const primaryButtonClass = 'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 px-4 text-sm font-extrabold text-white shadow-[0_0_20px_hsla(210,100%,65%,0.4)] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50';

  const currentStepIndex = STEPS.findIndex((item) => item.key === step);

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <div className="flex items-center gap-2">
          <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[0_0_14px_hsla(210,100%,65%,0.38)]">
            <Wand2 className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-extrabold text-foreground">
              {isArabic ? 'من مخطط إلى منزل ثلاثي الأبعاد' : 'Blueprint to 3D home'}
            </h3>
            <p className="truncate text-[11px] font-semibold text-muted-foreground">
              {isArabic ? 'ارفع مخططك واحصل على منزل مفروش بالكامل' : 'Upload your plan, get a fully furnished home'}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          {STEPS.map((item, index) => (
            <React.Fragment key={item.key}>
              <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[10px] font-extrabold transition ${
                index <= currentStepIndex
                  ? 'bg-sky-500 text-white'
                  : 'bg-[#e8f2fc] text-[#7c8ba5] dark:bg-white/10 dark:text-foreground/50'
              }`}>
                {index < currentStepIndex ? <Check className="h-3 w-3" /> : index + 1}
              </span>
              <span className={`text-[10px] font-bold ${index === currentStepIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
                {isArabic ? item.ar : item.en}
              </span>
              {index < STEPS.length - 1 && <span className="h-px flex-1 bg-[#d9e7f5] dark:bg-white/10" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {step === 'plan' && (
        <div className={cardClass}>
          <h4 className="text-xs font-extrabold uppercase tracking-wide text-foreground/80">
            {isArabic ? '١ · مخطط الأرضية' : '1 · Your floor plan'}
          </h4>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePlanSelected}
            className="hidden"
          />

          {plan ? (
            <div className="mt-3">
              <div className="relative overflow-hidden rounded-xl border border-[#d9e7f5] bg-white dark:border-sky-300/15">
                <img src={plan.dataUrl} alt={plan.name} className="block max-h-72 w-full object-contain" />
                <button
                  type="button"
                  onClick={() => setPlan(null)}
                  aria-label={isArabic ? 'إزالة' : 'Remove'}
                  className="absolute end-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1.5 truncate text-[10px] font-semibold text-muted-foreground">{plan.name}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isReadingFile}
              className="mt-3 flex min-h-[150px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#c9dff5] bg-[#f7fbff] px-4 py-6 transition hover:border-sky-400 hover:bg-sky-50 disabled:opacity-60 dark:border-sky-300/25 dark:bg-black/20 dark:hover:bg-white/[0.06]"
            >
              {isReadingFile ? (
                <Loader2 className="h-6 w-6 animate-spin text-sky-600 dark:text-sky-300" />
              ) : (
                <Upload className="h-6 w-6 text-sky-600 dark:text-sky-300" />
              )}
              <span className="text-xs font-extrabold text-[#31405a] dark:text-foreground">
                {isArabic ? 'ارفع مخطط الأرضية' : 'Upload your floor plan'}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground">
                {isArabic ? 'صورة أو لقطة شاشة للمخطط · حتى ١٢ ميجابايت' : 'A photo or screenshot of the plan · up to 12 MB'}
              </span>
            </button>
          )}

          {/* ⛔ Required, and asked before anything else. A master-suite plan read as a house of
              separate rooms turned a 6m x 6m dressing room into a lounge with a dining table, and
              MASTER LIVING into a family living room. Nothing on a drawing states whether it is a
              whole home or one suite inside one, and the model cannot infer it reliably. */}
          <div className="mt-4">
            <span className="text-xs font-extrabold text-foreground/85">
              {isArabic ? 'ما الذي رفعته؟' : 'What did you upload?'}
            </span>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {FLOOR_PLAN_UPLOAD_KINDS.map((kind) => {
                const isActive = choices.uploadKind === kind.id;
                return (
                  <button
                    key={kind.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setChoices((current) => ({ ...current, uploadKind: kind.id }))}
                    className={`rounded-xl border px-2.5 py-2.5 text-start transition-all active:scale-95 ${
                      isActive
                        ? 'border-sky-300/45 bg-sky-400/20 shadow-[0_0_12px_hsla(210,100%,65%,0.2)]'
                        : 'border-[#d9e7f5] bg-[#f7fbff] hover:bg-sky-50 dark:border-sky-300/15 dark:bg-black/[0.1] dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className={`block text-[11px] font-extrabold ${isActive ? 'text-sky-800 dark:text-sky-100' : 'text-[#31405a] dark:text-foreground'}`}>
                      {isArabic ? kind.ar : kind.en}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-semibold leading-snug text-muted-foreground">
                      {isArabic ? kind.hintAr : kind.hintEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <span className="text-xs font-extrabold text-foreground/85">
              {isArabic ? 'الأثاث المرسوم في المخطط؟' : 'The furniture drawn on the plan?'}
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FLOOR_PLAN_FURNITURE_MODES.map((mode) => {
                const isActive = choices.furnitureMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setChoices((current) => ({ ...current, furnitureMode: mode.id }))}
                    className={`rounded-xl border px-2.5 py-2.5 text-start transition-all active:scale-95 ${
                      isActive
                        ? 'border-sky-300/45 bg-sky-400/20 shadow-[0_0_12px_hsla(210,100%,65%,0.2)]'
                        : 'border-[#d9e7f5] bg-[#f7fbff] hover:bg-sky-50 dark:border-sky-300/15 dark:bg-black/[0.1] dark:hover:bg-white/[0.08]'
                    }`}
                  >
                    <span className={`block text-[11px] font-extrabold ${isActive ? 'text-sky-800 dark:text-sky-100' : 'text-[#31405a] dark:text-foreground'}`}>
                      {isArabic ? mode.ar : mode.en}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-semibold leading-snug text-muted-foreground">
                      {isArabic ? mode.hintAr : mode.hintEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={goToStyle}
            disabled={!plan || !choices.uploadKind}
            className={`mt-4 ${primaryButtonClass}`}
          >
            {isArabic ? 'التالي: الطراز' : 'Next: choose the style'}
          </button>
        </div>
      )}

      {step === 'style' && (
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wide text-foreground/80">
              {isArabic ? '٢ · الطراز واللون' : '2 · Style and colour'}
            </h4>
            <button
              type="button"
              onClick={() => setStep('plan')}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-sky-700 transition hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-white/10"
            >
              <ArrowLeft className="h-3 w-3" />
              {isArabic ? 'رجوع' : 'Back'}
            </button>
          </div>

          <span className="mt-3 block text-[10px] font-extrabold uppercase tracking-wide text-foreground/65">
            {isArabic ? 'كيف تريد التنسيق؟' : 'How do you want to style it?'}
          </span>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {FLOOR_PLAN_SCOPES.map((option) => {
              const isActive = choices.scope === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setChoices((current) => ({ ...current, scope: option.id }))}
                  className={`flex min-h-[52px] flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-start transition active:scale-95 ${
                    isActive
                      ? 'border-sky-300/45 bg-sky-400/20 shadow-[0_0_12px_hsla(210,100%,65%,0.2)]'
                      : 'border-[#d9e7f5] bg-[#f7fbff] dark:border-sky-300/15 dark:bg-black/[0.1]'
                  }`}
                >
                  <span className={`text-[11px] font-extrabold ${isActive ? 'text-sky-800 dark:text-sky-100' : 'text-foreground/80'}`}>
                    {isArabic ? option.ar : option.en}
                  </span>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {isArabic ? option.hintAr : option.hintEn}
                  </span>
                </button>
              );
            })}
          </div>

          {choices.scope === 'home' ? (
            <>
              <span className="mt-4 block text-[10px] font-extrabold uppercase tracking-wide text-foreground/65">
                {isArabic ? 'المنزل بالكامل' : 'The whole home'}
              </span>
              <div className="mt-2">{directionRows}</div>
              {roomListSection}
            </>
          ) : (
            <>
              {roomListSection}

              <div className="mt-4 overflow-hidden rounded-xl border border-[#d9e7f5] bg-[#f7fbff] dark:border-sky-300/15 dark:bg-black/[0.1]">
                <button
                  type="button"
                  onClick={() => setBaseOpen(!baseOpen)}
                  aria-expanded={baseOpen}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-start"
                >
                  <span className="shrink-0 text-[11px] font-extrabold text-foreground/85">
                    {isArabic ? 'كل ما تبقّى' : 'Everything else'}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[11px] font-bold text-sky-700 dark:text-sky-300">
                      {baseStyle ? (isArabic ? baseStyle.ar : baseStyle.en) : ''}
                    </span>
                    <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#7c8ba5] transition-transform ${baseOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {baseOpen && (
                  <div className="border-t border-[#d9e7f5] p-2 dark:border-sky-300/15">
                    <p className="mb-2 px-1 text-[10px] font-semibold leading-relaxed text-muted-foreground">
                      {isArabic
                        ? 'الطراز الأساسي لكل غرفة لم تخصّصها.'
                        : 'The base look for every room you have not given its own style.'}
                    </p>
                    {directionRows}
                  </div>
                )}
              </div>
            </>
          )}

          <label className="mt-4 block">
            <span className="text-[11px] font-extrabold text-foreground/85">
              {isArabic ? 'أي شيء آخر؟ (اختياري)' : 'Anything else? (optional)'}
            </span>
            <textarea
              value={choices.customNote}
              onChange={(event) => setChoices((current) => ({ ...current, customNote: event.target.value.slice(0, 400) }))}
              rows={2}
              placeholder={isArabic ? 'مثال: أرضية رخام فاتح، إضاءة دافئة جدًا' : 'e.g. pale marble floors, very warm lighting'}
              className="mt-1.5 w-full resize-none rounded-xl border border-[#d9e7f5] bg-white px-3 py-2 text-xs font-semibold text-[#31405a] outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 dark:border-sky-300/15 dark:bg-black/25 dark:text-foreground"
            />
          </label>

          <button type="button" onClick={generate} disabled={!plan || isWorking} className={`mt-4 ${primaryButtonClass}`}>
            <Sparkles className="h-4 w-4" />
            {isArabic ? 'ابنِ منزلي ثلاثي الأبعاد' : 'Build my home in 3D'}
          </button>
          <p className="mt-2 text-center text-[10px] font-semibold text-muted-foreground">
            {isArabic
              ? 'نستخدم مخططك الأصلي كما هو — لن تتغير أي جدران أو أبواب أو نوافذ.'
              : 'We use your original plan exactly as uploaded — no wall, door or window moves.'}
          </p>
        </div>
      )}

      {step === 'result' && (
        <>
          {(isWorking || (!renderUrl && !errorMessage)) && (
            <div className={cardClass}>
              {/* Showing the user's own plan behind the shimmer is what stops a three-minute
                  render reading as a crash. The bar is paced against the speed setting's typical
                  duration and deliberately stalls at 95%, so it never claims to be finished. */}
              {plan && (
                <div className="relative mb-3 overflow-hidden rounded-xl border border-[#d9e7f5] dark:border-sky-300/15">
                  <img src={plan.dataUrl} alt="" className="w-full opacity-30 blur-[1px]" />
                  <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-br from-sky-400/10 via-transparent to-indigo-500/10" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-sky-600 dark:text-sky-300" />
                <p className="text-[11px] font-bold leading-relaxed text-foreground/85">
                  {statusMessage || (isArabic ? 'جارٍ العمل…' : 'Working…')}
                </p>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${Math.min(95, Math.round((elapsedSeconds / speed.expectSeconds) * 100))}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] font-semibold leading-relaxed text-muted-foreground">
                {isArabic
                  ? `عادةً ${speed.hintAr}. اترك هذه الشاشة مفتوحة — نحن نتابع العمل.`
                  : `Usually ${speed.hintEn.toLowerCase()}. Keep this screen open — we are still working.`}
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl border border-rose-300/60 bg-rose-50 p-4 dark:border-rose-300/35 dark:bg-rose-400/10">
              <p className="text-[11px] font-bold leading-relaxed text-rose-800 dark:text-rose-100">{errorMessage}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={generate}
                  disabled={isWorking}
                  className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 text-[11px] font-extrabold text-white transition active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {isArabic ? 'حاول مرة أخرى' : 'Try again'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('style')}
                  className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-rose-300 px-3 text-[11px] font-extrabold text-rose-700 transition active:scale-95 dark:border-rose-300/40 dark:text-rose-100"
                >
                  {isArabic ? 'تغيير الخيارات' : 'Change options'}
                </button>
              </div>
            </div>
          )}

          {renderUrl && (
            <>
              <FloorPlanCanvas
                imageUrl={renderUrl}
                labels={labels}
                onLabelsChange={setLabels}
                onRoomTap={(label) => setActiveRoomId(label.id)}
                onExpand={() => setLightboxIndex(0)}
                isArabic={isArabic}
                isBusy={isWorking}
                showPins={showPins}
                onTogglePins={() => setShowPins((current) => !current)}
              />

              <div className={cardClass}>
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-foreground/80">
                  {isArabic ? 'اطلب أي تعديل' : 'Ask for any change'}
                </h4>
                <p className="mt-1 text-[10px] font-semibold leading-relaxed text-muted-foreground">
                  {isArabic
                    ? 'مثال: أزل الجدار بين الصالة والمجلس · ضع بابًا في المطبخ · اجعل الأرضية رخامًا'
                    : 'e.g. remove the wall between the salah and the majlis · add a door to the kitchen · make the floors marble'}
                </p>

                <div className="mt-3 flex gap-2">
                  <textarea
                    value={editInput}
                    onChange={(event) => setEditInput(event.target.value.slice(0, 300))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        applyEdit(editInput);
                      }
                    }}
                    rows={2}
                    disabled={isWorking}
                    placeholder={isArabic ? 'اكتب التعديل…' : 'Describe the change…'}
                    className="w-full resize-none rounded-xl border border-[#d9e7f5] bg-white px-3 py-2 text-xs font-semibold text-[#31405a] outline-none transition focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60 dark:border-sky-300/15 dark:bg-black/25 dark:text-foreground"
                  />
                  <button
                    type="button"
                    onClick={() => applyEdit(editInput)}
                    disabled={isWorking || !editInput.trim()}
                    aria-label={isArabic ? 'تطبيق' : 'Apply'}
                    className="inline-flex h-[58px] w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[0_0_16px_hsla(210,100%,65%,0.35)] transition active:scale-95 disabled:opacity-50"
                  >
                    {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>

                {editHistory.length > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-foreground/65">
                        {isArabic ? 'التعديلات المطبقة' : 'Changes applied'}
                      </span>
                      <button
                        type="button"
                        onClick={undoLastEdit}
                        disabled={isWorking}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-sky-700 transition hover:bg-sky-50 disabled:opacity-50 dark:text-sky-300 dark:hover:bg-white/10"
                      >
                        <RotateCcw className="h-3 w-3" />
                        {isArabic ? 'تراجع' : 'Undo last'}
                      </button>
                    </div>
                    <ol className="mt-1.5 space-y-1">
                      {editHistory.map((edit, index) => (
                        <li key={`${index}-${edit}`} className="rounded-lg bg-[#f7fbff] px-2.5 py-1.5 text-[10px] font-semibold text-[#40506a] dark:bg-white/[0.06] dark:text-foreground/75">
                          {index + 1}. {edit}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {roomRenders.length > 0 && (
                <div className={cardClass}>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-foreground/80">
                    {isArabic ? 'الغرف الجاهزة' : 'Rooms in detail'}
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {roomRenders.map((room) => {
                      const position = lightboxImages.findIndex((image) => image.url === room.url);
                      return (
                        <button
                          key={room.labelId}
                          type="button"
                          onClick={() => setLightboxIndex(position >= 0 ? position : 0)}
                          className="overflow-hidden rounded-xl border border-[#d9e7f5] bg-white text-start transition active:scale-95 dark:border-sky-300/15 dark:bg-black/20"
                        >
                          <img src={room.url} alt={room.name} className="block aspect-square w-full object-cover" />
                          <span className="block truncate px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[#31405a] dark:text-foreground">
                            {room.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={cardClass}>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={saveProject}
                    disabled={isSaving || isWorking}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 px-3 text-[11px] font-extrabold text-white shadow-[0_0_16px_hsla(210,100%,65%,0.35)] transition active:scale-95 disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isSaved ? <Check className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
                    {isSaved ? (isArabic ? 'محفوظ' : 'Saved') : (isArabic ? 'حفظ كمشروع' : 'Save as project')}
                  </button>
                  <button
                    type="button"
                    onClick={saveAllToPhone}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#c9dff5] bg-[#f7fbff] px-3 text-[11px] font-extrabold text-[#31405a] transition active:scale-95 dark:border-sky-300/20 dark:bg-white/[0.06] dark:text-foreground"
                  >
                    <Smartphone className="h-4 w-4" />
                    {isArabic ? 'حفظ في الهاتف' : 'Save to phone'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={startOver}
                  disabled={isWorking}
                  className="mt-2 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[#d9e7f5] px-3 text-[11px] font-extrabold text-[#40506a] transition active:scale-95 disabled:opacity-50 dark:border-sky-300/15 dark:text-foreground/75"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {isArabic ? 'ابدأ من جديد' : 'Start over'}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {overrideTarget && (
        <RoomStyleSheet
          roomName={overrideTarget.names.join(' + ')}
          override={roomOverrides[overrideTarget.id] || {}}
          onChange={(next) => setRoomOverrides((current) => ({ ...current, [overrideTarget.id]: next }))}
          onReset={() => setRoomOverrides((current) => {
            const next = { ...current };
            delete next[overrideTarget.id];
            return next;
          })}
          onSeparate={overrideTarget.names.length > 1
            ? () => separateGroup(overrideTarget.id)
            : undefined}
          onClose={() => setOverrideTargetId(null)}
          isArabic={isArabic}
        />
      )}

      {activeRoom && renderUrl && (
        <div className="fixed inset-x-0 bottom-0 z-[1050] mx-auto w-full max-w-[520px] rounded-t-3xl border border-[#c9dff5] bg-white p-4 shadow-[0_-8px_40px_rgba(6,5,65,0.25)] dark:border-sky-300/20 dark:bg-[#0c0f14]"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate text-sm font-extrabold uppercase tracking-wide text-foreground">{activeRoom.name}</h4>
            <button
              type="button"
              onClick={() => setActiveRoomId(null)}
              aria-label={isArabic ? 'إغلاق' : 'Close'}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/5 text-foreground/70 transition active:scale-95 dark:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {activeRoomRender ? (
            <button
              type="button"
              onClick={() => {
                const position = lightboxImages.findIndex((image) => image.url === activeRoomRender.url);
                setLightboxIndex(position >= 0 ? position : 0);
              }}
              className="mt-3 block w-full overflow-hidden rounded-xl border border-[#d9e7f5] transition active:scale-95 dark:border-sky-300/15"
            >
              <img src={activeRoomRender.url} alt={activeRoom.name} className="block w-full" />
            </button>
          ) : (
            <>
              {/* Instant, free feedback: a magnified crop of the render centred on this room. */}
              <div
                className="mt-3 aspect-[4/3] w-full rounded-xl border border-[#d9e7f5] bg-white bg-no-repeat dark:border-sky-300/15"
                style={{
                  backgroundImage: `url(${renderUrl})`,
                  backgroundSize: '270%',
                  backgroundPosition: `${activeRoom.x * 100}% ${activeRoom.y * 100}%`,
                }}
                role="img"
                aria-label={isArabic ? `منظر مكبّر لـ ${activeRoom.name}` : `Zoomed view of ${activeRoom.name}`}
              />
              <button
                type="button"
                onClick={() => renderRoom(activeRoom)}
                disabled={pendingRoomId !== null || isWorking}
                className={`mt-3 ${primaryButtonClass}`}
              >
                {pendingRoomId === activeRoom.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {pendingRoomId === activeRoom.id
                  ? (isArabic ? 'نجهّز الغرفة…' : 'Rendering this room…')
                  : (isArabic ? 'اعرض هذه الغرفة بتفاصيل كاملة' : 'Render this room in full detail')}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-[#d9e7f5] px-3 text-[11px] font-extrabold text-[#40506a] transition active:scale-95 dark:border-sky-300/15 dark:text-foreground/75"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            {isArabic ? 'اعرض المخطط كامل' : 'View the whole home'}
          </button>
        </div>
      )}

      <DesignerImageLightbox
        images={lightboxImages}
        startIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        language={language}
        onSaveProject={saveProject}
        isSavingProject={isSaving}
        isSavedProject={isSaved}
      />

      <StudioGuestLoginDialog
        open={guestDialogOpen}
        onOpenChange={setGuestDialogOpen}
        redirectTo="/music?studioTab=designer"
        language={language}
      />
    </div>
  );
}
