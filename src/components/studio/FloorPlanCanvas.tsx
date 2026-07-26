import React, { useRef, useState } from 'react';
import { Check, Eye, EyeOff, Maximize2, Pencil, Trash2, X } from 'lucide-react';

export type FloorPlanLabel = {
  id: string;
  name: string;
  /** Position as a fraction of the render, 0 to 1, so labels survive any display size. */
  x: number;
  y: number;
};

type FloorPlanCanvasProps = {
  imageUrl: string;
  labels: FloorPlanLabel[];
  onLabelsChange: (labels: FloorPlanLabel[]) => void;
  onRoomTap: (label: FloorPlanLabel) => void;
  onExpand: () => void;
  isArabic: boolean;
  /** Blocks label editing and tapping while a new render is in flight. */
  isBusy?: boolean;
  /** The render already contains room name text, so the pins can be hidden for a clean view. */
  showPins: boolean;
  onTogglePins: () => void;
};

const TAP_SLOP_PX = 6;

export default function FloorPlanCanvas({
  imageUrl,
  labels,
  onLabelsChange,
  onRoomTap,
  onExpand,
  isArabic,
  isBusy = false,
  showPins,
  onTogglePins,
}: FloorPlanCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; labelId: string; movedPx: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const beginEdit = (label: FloorPlanLabel) => {
    setEditingId(label.id);
    setDraft(label.name);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const name = draft.trim().slice(0, 40);
    if (name) {
      onLabelsChange(labels.map((label) => (label.id === editingId ? { ...label, name } : label)));
    }
    setEditingId(null);
    setDraft('');
  };

  const removeLabel = (labelId: string) => {
    onLabelsChange(labels.filter((label) => label.id !== labelId));
    setEditingId(null);
  };

  const handlePointerDown = (event: React.PointerEvent, label: FloorPlanLabel) => {
    if (isBusy || editingId) return;
    event.stopPropagation();
    dragRef.current = { pointerId: event.pointerId, labelId: label.id, movedPx: 0 };
    setDraggingId(label.id);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    const container = containerRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !container) return;

    drag.movedPx += Math.abs(event.movementX) + Math.abs(event.movementY);
    if (drag.movedPx < TAP_SLOP_PX) return;

    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.min(0.98, Math.max(0.02, (event.clientX - rect.left) / rect.width));
    const y = Math.min(0.98, Math.max(0.02, (event.clientY - rect.top) / rect.height));
    onLabelsChange(labels.map((label) => (label.id === drag.labelId ? { ...label, x, y } : label)));
  };

  const handlePointerUp = (event: React.PointerEvent, label: FloorPlanLabel) => {
    const drag = dragRef.current;
    dragRef.current = null;
    setDraggingId(null);
    if (!drag || drag.pointerId !== event.pointerId) return;
    // A press that never really moved is a tap on the room, not a reposition.
    if (drag.movedPx < TAP_SLOP_PX) onRoomTap(label);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#c9dff5] bg-white dark:border-sky-300/20 dark:bg-black/30">
      <div ref={containerRef} className="relative w-full select-none">
        <img
          src={imageUrl}
          alt={isArabic ? 'المخطط ثلاثي الأبعاد' : '3D floor plan render'}
          className="block w-full"
          draggable={false}
        />

        {showPins && labels.map((label) => {
          const isEditing = editingId === label.id;
          const isDragging = draggingId === label.id;
          return (
            <div
              key={label.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${label.x * 100}%`, top: `${label.y * 100}%` }}
            >
              {isEditing ? (
                <div className="flex items-center gap-1 rounded-lg border border-sky-400 bg-white p-1 shadow-lg dark:bg-[#0c0f14]">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitEdit();
                      if (event.key === 'Escape') { setEditingId(null); setDraft(''); }
                    }}
                    maxLength={40}
                    aria-label={isArabic ? 'اسم الغرفة' : 'Room name'}
                    className="w-24 bg-transparent px-1 text-[11px] font-extrabold uppercase tracking-wide text-[#060541] outline-none dark:text-foreground"
                  />
                  <button
                    type="button"
                    onClick={commitEdit}
                    aria-label={isArabic ? 'تم' : 'Done'}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-sky-500 text-white active:scale-95"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLabel(label.id)}
                    aria-label={isArabic ? 'حذف الاسم' : 'Delete label'}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-rose-500 text-white active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setDraft(''); }}
                    aria-label={isArabic ? 'إلغاء' : 'Cancel'}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/10 text-[#40506a] active:scale-95 dark:bg-white/10 dark:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className={`flex items-center gap-0.5 rounded-lg border bg-white/95 shadow-[0_2px_10px_rgba(6,5,65,0.25)] backdrop-blur-sm transition-transform dark:bg-[#0c0f14]/90 ${
                  isDragging ? 'scale-110 border-sky-500' : 'border-white/70 dark:border-sky-300/25'
                }`}>
                  <button
                    type="button"
                    onPointerDown={(event) => handlePointerDown(event, label)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={(event) => handlePointerUp(event, label)}
                    onPointerCancel={() => { dragRef.current = null; setDraggingId(null); }}
                    disabled={isBusy}
                    title={isArabic ? 'اضغط للدخول، اسحب للتحريك' : 'Tap to go inside, drag to move'}
                    className="max-w-[120px] touch-none truncate px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#060541] disabled:opacity-60 dark:text-foreground"
                  >
                    {label.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => beginEdit(label)}
                    disabled={isBusy}
                    aria-label={isArabic ? 'تعديل الاسم' : 'Rename'}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sky-700 transition hover:bg-sky-100 disabled:opacity-60 dark:text-sky-300 dark:hover:bg-white/10"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        <div className="absolute end-2 top-2 z-20 flex gap-1.5">
          <button
            type="button"
            onClick={onTogglePins}
            aria-label={isArabic ? (showPins ? 'أخفِ المؤشرات' : 'اعرض المؤشرات') : (showPins ? 'Hide room pins' : 'Show room pins')}
            aria-pressed={showPins}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-black/55 text-white backdrop-blur-sm transition active:scale-95"
          >
            {showPins ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onExpand}
            aria-label={isArabic ? 'تكبير' : 'Expand'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-black/55 text-white backdrop-blur-sm transition active:scale-95"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="border-t border-[#d9e7f5] bg-[#f7fbff] px-3 py-2 text-[10px] font-semibold text-[#40506a] dark:border-sky-300/15 dark:bg-black/20 dark:text-foreground/70">
        {/* Never promise room names that are not there: when the plan reader returns no rooms this
            caption used to invite the user to tap a pin that did not exist. */}
        {!labels.length
          ? (isArabic
            ? 'لم نتمكن من قراءة أسماء الغرف من هذا المخطط، لذلك لا توجد مؤشرات.'
            : 'We could not read the room names off this plan, so there are no pins to tap.')
          : showPins
            ? (isArabic
              ? 'اضغط على اسم الغرفة للدخول إليها، اسحبه لتحريكه، أو اضغط القلم لتغيير الاسم.'
              : 'Tap a room name to go inside it, drag it to move it, or tap the pencil to rename it.')
            : (isArabic
              ? 'المؤشرات مخفية — اضغط العين لإعادة إظهارها والدخول إلى الغرف.'
              : 'Pins hidden — tap the eye to bring them back and go inside a room.')}
      </p>
    </div>
  );
}
