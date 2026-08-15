import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Sparkles, X } from 'lucide-react';
import { EditSegment, fetchSegmentsForTask } from '@/components/studio/imageEditService';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const FN_NAME = 'wakti-grok-image-edit';
const MAX_PART_CARDS = 8;

/** Kie segment masks are 128px thumbnails of the part itself (no position data),
 *  so identical names (e.g. 7x "water droplets") are grouped into one card that
 *  selects ALL matching segment indexes at once. */
interface PartGroup {
  name: string;
  indexes: number[];
  thumb: string;
}

interface ImageEditPanelProps {
  open: boolean;
  imageUrl: string;
  kieTaskId: string;
  language: string;
  /** Segments prefetched right after generation — panel opens instantly when provided */
  preloadedSegments?: EditSegment[] | null;
  /** Instructions from previous edits — Kie always edits from the ORIGINAL, so we resend the full recipe */
  editHistory?: string[];
  onClose: () => void;
  onEdited: (newUrl: string, newTaskId: string, newInstruction: string) => void;
}

export default function ImageEditPanel({ open, imageUrl, kieTaskId, language, preloadedSegments, editHistory, onClose, onEdited }: ImageEditPanelProps) {
  const ar = language === 'ar';

  const [loadingSegments, setLoadingSegments] = useState(false);
  const [partGroups, setPartGroups] = useState<PartGroup[]>([]);
  const [segmentsFailed, setSegmentsFailed] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [editPrompt, setEditPrompt] = useState('');
  const [partPrompts, setPartPrompts] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);

  const pollCancelRef = useRef(false);

  const t = {
    title: ar ? 'تعديل الصورة' : 'Edit Image',
    finding: ar ? 'جارٍ اكتشاف أجزاء الصورة…' : 'Finding editable parts…',
    pickParts: ar ? 'اختر الأجزاء التي تريد تعديلها، أو صف التعديل للصورة كاملة' : 'Pick the parts to edit below, or describe an edit for the whole image',
    noParts: ar ? 'تعذر اكتشاف الأجزاء — صف التعديل وسيتم تطبيقه على الصورة كاملة' : 'Could not detect parts — describe your edit and it will apply to the whole image',
    promptPlaceholder: ar ? 'مثال: اجعل السائل أحمر ياقوتي' : 'e.g. change the liquid to ruby red',
    apply: ar ? 'تطبيق التعديل' : 'Apply Edit',
    editing: ar ? 'جارٍ التعديل… قد يستغرق دقيقة' : 'Editing… this can take a minute',
    editFailed: ar ? 'فشل التعديل. حاول مرة أخرى.' : 'Edit failed. Please try again.',
    needPrompt: ar ? 'اكتب وصف التعديل أولاً' : 'Please describe the edit first',
    needPartPrompts: ar ? 'اكتب التعديل لكل جزء اخترته' : 'Write an edit for each part you picked',
    partPromptPlaceholder: ar ? 'ماذا تريد لهذا الجزء؟' : 'What should happen to this part?',
    limitReached: ar ? 'انتهى الحد المجاني لتوليد الصور.' : 'Your free image limit has been reached.',
    sessionExpired: ar
      ? 'تعذر تعديل هذه الصورة — جرّب مرة أخرى أو أنشئ صورة جديدة من برو.'
      : 'This edit could not be applied — try again or generate a fresh Pro Studio image.',
    editsExhausted: ar
      ? 'تم تعديل هذه الصورة ٥ مرات — الحد الأقصى للتعديلات. أنشئ صورة جديدة لمواصلة التعديل.'
      : 'This image has been edited 5 times — edit limit reached. Generate a fresh image to keep editing.',
  };

  // ─── Group segments by name → visual part cards ───
  const buildGroups = (segs: EditSegment[]): PartGroup[] => {
    const byName = new Map<string, PartGroup>();
    for (const seg of segs) {
      const key = seg.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (existing) {
        existing.indexes.push(seg.index);
        if (!existing.thumb && seg.maskDataUrl) existing.thumb = seg.maskDataUrl;
      } else {
        byName.set(key, { name: seg.name, indexes: [seg.index], thumb: seg.maskDataUrl || '' });
      }
    }
    return Array.from(byName.values()).slice(0, MAX_PART_CARDS);
  };

  // ─── Segment loading (prefetched or on-demand) ───
  useEffect(() => {
    if (!open || !kieTaskId) return;
    pollCancelRef.current = false;
    setSelected([]);
    setEditPrompt('');
    setPartPrompts({});

    if (preloadedSegments && preloadedSegments.length > 0) {
      setPartGroups(buildGroups(preloadedSegments));
      setSegmentsFailed(false);
      setLoadingSegments(false);
      return;
    }

    let cancelled = false;
    setLoadingSegments(true);
    setSegmentsFailed(false);
    setPartGroups([]);

    fetchSegmentsForTask(kieTaskId)
      .then((found) => {
        if (cancelled || pollCancelRef.current) return;
        if (!found || found.length === 0) throw new Error('no segments');
        setPartGroups(buildGroups(found));
      })
      .catch(() => {
        if (!cancelled && !pollCancelRef.current) setSegmentsFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingSegments(false);
      });

    return () => { cancelled = true; pollCancelRef.current = true; };
  }, [open, kieTaskId, preloadedSegments]);

  const toggleGroup = (group: PartGroup) => {
    const allSelected = group.indexes.every((i) => selected.includes(i));
    setSelected((prev) =>
      allSelected
        ? prev.filter((i) => !group.indexes.includes(i))
        : [...prev, ...group.indexes.filter((i) => !prev.includes(i))]
    );
  };

  // ─── Apply edit: submit + poll ───
  const handleApply = async () => {
    // Parts picked → each part has its own instruction; otherwise one whole-image prompt
    const selectedGroupsNow = partGroups.filter((g) => g.indexes.every((i) => selected.includes(i)));
    let cleanPrompt = editPrompt.trim();
    if (selectedGroupsNow.length > 0) {
      const lines: string[] = [];
      for (const g of selectedGroupsNow) {
        const instruction = (partPrompts[g.name] || '').trim();
        if (!instruction) {
          toast.error(t.needPartPrompts);
          return;
        }
        lines.push(`For the ${g.name}: ${instruction}.`);
      }
      cleanPrompt = lines.join(' ');
    }
    if (!cleanPrompt) {
      toast.error(t.needPrompt);
      return;
    }
    // Kie always edits from the ORIGINAL task — resend the full recipe (history + new instruction)
    const history = Array.isArray(editHistory) ? editHistory.filter(Boolean) : [];
    const fullPrompt = [...history, cleanPrompt].join(' ');
    setApplying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('auth');
      const { data: { user } } = await supabase.auth.getUser();

      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const submitResp = await fetch(`${SUPABASE_URL}/functions/v1/${FN_NAME}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'edit',
          task_id: kieTaskId,
          prompt: fullPrompt,
          mask_indexs: selected,
          user_id: user?.id,
          language: ar ? 'ar' : 'en',
        }),
      });
      const submitJson = await submitResp.json().catch(() => ({} as Record<string, unknown>));
      if (submitJson?.error === 'TRIAL_LIMIT_REACHED') {
        toast.error(t.limitReached);
        onClose();
        return;
      }
      if (typeof submitJson?.error === 'string' && (submitJson.error.includes('EDIT_SESSION_EXPIRED') || /original task id/i.test(submitJson.error))) {
        toast.error(t.sessionExpired);
        onClose();
        return;
      }
      const editTaskId = (submitJson?.taskId as string) || '';
      if (!submitResp.ok || !submitJson?.success || !editTaskId) throw new Error('edit submit failed');

      const deadline = Date.now() + 8 * 60 * 1000;
      let resultUrl: string | null = null;
      while (Date.now() < deadline) {
        if (pollCancelRef.current) return;
        await new Promise((r) => setTimeout(r, 5000));
        const pollResp = await fetch(`${SUPABASE_URL}/functions/v1/${FN_NAME}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'edit', taskId: editTaskId, user_id: user?.id }),
        });
        const pollJson = await pollResp.json().catch(() => ({} as Record<string, unknown>));
        const urls = pollJson?.urls as string[] | undefined;
        if (Array.isArray(urls) && urls.length > 0) { resultUrl = urls[0]; break; }
        if (pollJson?.status === 'failed' || pollJson?.status === 'error') throw new Error('edit task failed');
      }
      if (!resultUrl) throw new Error('edit timed out');

      // Store only the NEW instruction; the parent appends it to the chain's history
      onEdited(resultUrl, editTaskId, cleanPrompt);
      onClose();
    } catch {
      toast.error(t.editFailed);
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  const editCount = Array.isArray(editHistory) ? editHistory.length : 0;
  const editLimitReached = editCount >= 5;

  // Groups whose every index is selected — each gets its own mini prompt row
  const selectedGroups = partGroups.filter((g) => g.indexes.every((i) => selected.includes(i)));
  const canApply = selectedGroups.length > 0
    ? selectedGroups.every((g) => (partPrompts[g.name] || '').trim().length > 0)
    : editPrompt.trim().length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
      onClick={applying ? undefined : onClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0c0f14] border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        dir={ar ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-sky-400" />
            <h2 className="text-base font-bold text-white">{t.title}</h2>
          </div>
          <button
            onClick={onClose}
            disabled={applying}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center active:scale-90 transition-all"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Image */}
        <div className="px-5">
          <div className="relative inline-block w-full">
            <img
              src={imageUrl}
              alt="Edit target"
              className="w-full rounded-2xl select-none"
              draggable={false}
            />
            {loadingSegments && (
              <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                <span className="text-sm text-white/90">{t.finding}</span>
              </div>
            )}
            {applying && (
              <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                <span className="text-sm text-white/90">{t.editing}</span>
              </div>
            )}
          </div>
        </div>

        {/* Part cards (visual picker) */}
        {!loadingSegments && partGroups.length > 0 && (
          <div className="px-5 mt-3 space-y-2">
            <p className="text-xs text-white/60 text-center">{t.pickParts}</p>
            <div className="grid grid-cols-4 gap-2">
              {partGroups.map((group) => {
                const isSel = group.indexes.every((i) => selected.includes(i));
                return (
                  <button
                    key={group.name}
                    onClick={() => toggleGroup(group)}
                    disabled={applying}
                    className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all active:scale-95 ${
                      isSel
                        ? 'bg-blue-500/20 border-2 border-sky-400/70 shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                        : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                    }`}
                  >
                    {group.thumb ? (
                      <img
                        src={group.thumb}
                        alt={group.name}
                        className="w-full aspect-square object-contain rounded-lg bg-black/30"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full aspect-square rounded-lg bg-black/30 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-white/30" />
                      </div>
                    )}
                    <span className={`text-[10px] font-semibold leading-tight text-center line-clamp-2 ${isSel ? 'text-sky-200' : 'text-white/70'}`}>
                      {group.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {segmentsFailed && (
          <p className="text-xs text-amber-300/80 mt-2 text-center px-5">{t.noParts}</p>
        )}

        {/* Prompt area: per-part mini prompts when parts are picked, whole-image prompt otherwise */}
        <div className="px-5 py-4 space-y-3">
          {editLimitReached ? (
            <p className="text-sm text-amber-300/90 text-center leading-relaxed">{t.editsExhausted}</p>
          ) : selectedGroups.length > 0 ? (
            <div className="space-y-2">
              {selectedGroups.map((group) => (
                <div
                  key={group.name}
                  className="flex items-center gap-2 rounded-xl bg-white/5 border border-sky-400/40 px-2.5 py-2"
                >
                  {group.thumb ? (
                    <img
                      src={group.thumb}
                      alt={group.name}
                      className="h-9 w-9 shrink-0 object-contain rounded-lg bg-black/30"
                      draggable={false}
                    />
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-lg bg-black/30 flex items-center justify-center">
                      <Sparkles className="h-3.5 w-3.5 text-white/30" />
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 shrink-0 max-w-[38%]">
                    <span className="text-[11px] font-semibold text-sky-200 leading-tight line-clamp-2">{group.name}</span>
                    <span className="text-sky-400 text-xs">{ar ? '←' : '→'}</span>
                  </div>
                  <input
                    value={partPrompts[group.name] || ''}
                    onChange={(e) => setPartPrompts((prev) => ({ ...prev, [group.name]: e.target.value }))}
                    placeholder={t.partPromptPlaceholder}
                    disabled={applying}
                    className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                  />
                  <button
                    onClick={() => toggleGroup(group)}
                    disabled={applying}
                    className="shrink-0 h-6 w-6 rounded-full bg-white/10 hover:bg-white/20 text-white/70 flex items-center justify-center active:scale-90 transition-all"
                    aria-label={`Remove ${group.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              placeholder={t.promptPlaceholder}
              disabled={applying}
              rows={2}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-sky-400/60 resize-none"
            />
          )}
          <button
            onClick={handleApply}
            disabled={applying || !canApply || editLimitReached}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.45)] active:scale-95 transition-all disabled:opacity-40 disabled:active:scale-100"
          >
            {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {applying ? t.editing : t.apply}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
