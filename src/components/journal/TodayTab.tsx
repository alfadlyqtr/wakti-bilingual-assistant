import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { JournalService, JournalCheckin } from "@/services/journalService";
import { toast } from "sonner";
import { MoodFace, moodLabels, MoodValue } from "./icons/MoodFaces";
import { TagIcon, TagId } from "@/components/journal/TagIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Undo2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatTime } from "@/utils/datetime";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TAGS: TagId[] = [
  "family","friends","date","exercise","sport","relax","movies","gaming","reading","cleaning",
  "sleep","eat_healthy","shopping","study","work","music","meditation","nature","travel","cooking","walk","socialize","coffee"
];

function getLocalDayString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const faces: { value: MoodValue; color: string }[] = [
  { value: 1, color: "text-red-500" },
  { value: 2, color: "text-orange-500" },
  { value: 3, color: "text-amber-500" },
  { value: 4, color: "text-emerald-500" },
  { value: 5, color: "text-green-600" }
];

export const TodayTab: React.FC = () => {
  const { language } = useTheme();
  const location = useLocation();
  const { isMobile } = useIsMobile();
  const [date] = useState(getLocalDayString());
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [tags, setTags] = useState<TagId[]>([]);
  const [note, setNote] = useState("");
  const [morning, setMorning] = useState("");
  const [evening, setEvening] = useState("");
  const [saving, setSaving] = useState(false);
  // Note editing session control (editor is only typable after Add note)
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const noteCERef = useRef<HTMLDivElement | null>(null);
  const editorFocusedRef = useRef(false);
  const [isCustomOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const eveningRef = useRef<HTMLTextAreaElement | null>(null);
  const [morningOpen, setMorningOpen] = useState(true);
  // Snapshots of last saved values (used for Clear to only clear unsaved changes)
  const [savedMood, setSavedMood] = useState<MoodValue | null>(null);
  const [savedTags, setSavedTags] = useState<TagId[]>([]);
  const [savedNote, setSavedNote] = useState("");
  const [savedMorning, setSavedMorning] = useState("");
  const [savedEvening, setSavedEvening] = useState("");
  // Force re-render for tag list updates
  const [customVersion, setCustomVersion] = useState(0);
  // Persisted custom tags (per-user) and merged list used by UI
  const [customTags, setCustomTags] = useState<TagId[]>([]);
  const [allTags, setAllTags] = useState<TagId[]>(DEFAULT_TAGS);
  const [userId, setUserId] = useState<string | null>(null);
  // Check-ins state
  const [checkins, setCheckins] = useState<JournalCheckin[]>([]);
  const checkinSectionRef = useRef<HTMLDivElement | null>(null);
  const [dayUpdatedAt, setDayUpdatedAt] = useState<string | null>(null);
  const lastMoodTapAtRef = useRef<number | null>(null);
  const lastCheckinIdRef = useRef<string | null>(null);
  // Pending (pre-save) mood taps buffer - grouped by timestamp
  const [pendingMoodCounts, setPendingMoodCounts] = useState<Record<MoodValue, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [pendingActions, setPendingActions] = useState<Record<string, { mood: MoodValue; tags: TagId[] }>>({});
  // In-UI tag tap counters (so tags can have ×N even without a mood tap)
  const [tagTapCounts, setTagTapCounts] = useState<Record<TagId, number>>({} as any);
  // Stub de-duplication
  const lastStubTextRef = useRef<string | null>(null);
  const lastStubAtRef = useRef<number>(0);
  // Per-tag throttle to avoid double appends on fast duplicate clicks
  const lastTagTapAtRef = useRef<Record<TagId, number>>({} as any);

  // Unsaved detection for controls visibility
  const hasUnsaved = useMemo(() => {
    const tagsChanged = savedTags.join('|') !== tags.join('|');
    return tagsChanged || savedMood !== mood || savedNote !== note || savedMorning !== morning || savedEvening !== evening;
  }, [savedTags, tags, savedMood, mood, savedNote, note, savedMorning, morning, savedEvening, evening]);
  
  // Helpers to keep clean structure
  const isSeparatorLine = (line: string) => /^\s*\.{6,}\s*$/.test(line);
  const isTimestampLine = (line: string) => /^\s*\[[^\]]+\]/.test(line || '');
  const getLastNonEmptyLine = (text: string) => {
    const lines = (text || '').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const ln = lines[i];
      if (ln && ln.trim().length > 0) return ln;
    }
    return '';
  };

  // Helpers: ensure a fresh timestamp stub at the end and place caret (no separators)
  const ensureEndStub = useCallback(() => {
    const now = new Date();
    const stubTime = formatTime(now, language as any, { hour: '2-digit', minute: '2-digit' });
    setNote(prev => {
      const cur = prev || '';
      const last = getLastNonEmptyLine(cur);
      if (isTimestampLine(last)) {
        // Check if last line already has the same timestamp
        const sameTimeRe = new RegExp(`^\\[${stubTime.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\]`);
        if (sameTimeRe.test(last)) {
          // Same timestamp: just ensure trailing placeholder and add __FREE__ marker if not present
          const lines = cur.split('\n');
          let idx = lines.length - 1;
          while (idx >= 0 && !isTimestampLine(lines[idx])) idx--;
          if (idx >= 0) {
            let line = lines[idx];
            // Remove __UNSAVED__ marker if present (we're now editing this line)
            line = line.replace(/\s*__UNSAVED__\s*/g, '');
            if (!line.includes('__FREE__')) {
              line = line.replace(/\s*\|\s*$/, '').trimEnd() + ' | __FREE____END__ | ';
            }
            lines[idx] = line;
          }
          return lines.join('\n');
        }
        // Different timestamp: ensure trailing placeholder on existing line
        const lines = cur.split('\n');
        let idx = lines.length - 1;
        while (idx >= 0 && !isTimestampLine(lines[idx])) idx--;
        if (idx >= 0) lines[idx] = lines[idx].replace(/\s*\|\s*$/, '').trimEnd() + ' | ';
        return lines.join('\n');
      }
      const base = cur.endsWith('\n') || cur.length === 0 ? cur : cur + '\n';
      return `${base}[${stubTime}] 🕒  | __FREE____END__ | `;
    });
    // Focus caret to end of editor on next paint
    requestAnimationFrame(() => {
      const el = noteCERef.current;
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, [language, setNote]);

  // Helper: mutate the free-text (last segment) of the most recent timestamp line
  const mutateFreeText = useCallback((transform: (s: string) => string) => {
    setNote(prev => {
      const cur = prev || '';
      const lines = cur.split('\n');
      // find last timestamp line, or create one
      let i = lines.length - 1;
      while (i >= 0 && !/^\[[^\]]+\]/.test(lines[i])) i--;
      if (i < 0) {
        const now = new Date();
        const t = formatTime(now, language as any, { hour: '2-digit', minute: '2-digit' });
        lines.push(`[${t}] 🕒  | `);
        i = lines.length - 1;
      }
      const line = lines[i];
      const bar = line.indexOf('|');
      if (bar < 0) {
        lines[i] = `${line} | `;
      } else {
        const before = line.slice(0, bar);
        const afterBar = line.slice(bar);
        // Extract existing free text from marker
        const markerRe = /__FREE__(.*?)__END__/;
        const match = afterBar.match(markerRe);
        const currentFree = match ? match[1] : '';
        // Remove marker from line to get clean tokens
        const cleanAfter = afterBar.replace(markerRe, '').trim();
        const parts = cleanAfter.split('|').map(s => s.trim()).filter(Boolean);
        const tokens = parts.filter(t => t !== '🕒');
        const newFree = transform(currentFree);
        const tokensJoined = tokens.length > 0 ? tokens.join(' | ') : '';
        const rebuilt = `${before}| ${tokensJoined}${tokensJoined ? ' | ' : ''}__FREE__${newFree}__END__ | `;
        lines[i] = rebuilt;
      }
      const next = lines.join('\n');
      try { const el = noteCERef.current; if (el) el.innerHTML = renderNoteHtml(next); } catch {}
      return next;
    });
  }, [language, setNote]);
  

  const defaultTagSet = useMemo(() => new Set(DEFAULT_TAGS), []);
  const customCount = useMemo(() => customTags.length, [customTags]);

  // Load user and their custom tags
  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes?.user?.id || null;
      setUserId(uid);
      if (!uid) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('custom_tags')
        .eq('id', uid)
        .maybeSingle();
      if (!error && data && Array.isArray(data.custom_tags)) {
        const cleaned = (data.custom_tags as string[])
          .map(s => (s || '').toString().toLowerCase().replace(/\s+/g,'_'))
          .filter(Boolean) as TagId[];
        setCustomTags(cleaned);
        setAllTags([...
          DEFAULT_TAGS,
          ...cleaned.filter(t => !defaultTagSet.has(t))
        ] as TagId[]);
      } else {
        setAllTags([ ...DEFAULT_TAGS ]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arTagLabels: Partial<Record<TagId, string>> = {
    family: "العائلة",
    friends: "الأصدقاء",
    date: "موعد",
    exercise: "تمارين",
    sport: "رياضة",
    relax: "استرخاء",
    movies: "أفلام",
    gaming: "ألعاب",
    reading: "قراءة",
    cleaning: "تنظيف",
    sleep: "نوم",
    eat_healthy: "غذاء صحي",
    shopping: "تسوق",
    study: "دراسة",
    work: "عمل",
    music: "موسيقى",
    meditation: "تأمل",
    nature: "طبيعة",
    travel: "سفر",
    cooking: "طبخ",
    walk: "مشي",
    socialize: "اجتماع",
    coffee: "قهوة",
  };

  // Render note with chips inside a contentEditable div. Chips are the tokens after the first '|'
  // Wrap saved entries (without __FREE__ marker) in outer pill; keep editing line flat
  const renderNoteHtml = (text: string) => {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = (text || '').split('\n');
    const htmlLines: string[] = [];
    let prevWasSep = false;
    for (const rawLine of lines) {
      // Compact separator
      if (/^\.{6,}$/.test(rawLine.trim())) {
        if (prevWasSep) continue; // collapse duplicates
        const hidden = esc(rawLine.trim());
        htmlLines.push(`<div class="my-1"><span class="sr-only">${hidden}</span><span class="block h-px w-full bg-border/70"></span></div>`);
        prevWasSep = true;
        continue;
      }
      prevWasSep = false;
      const i = rawLine.indexOf('|');
      if (i < 0) { htmlLines.push(`<div>${esc(rawLine)}</div>`); continue; }
      const before = esc(rawLine.slice(0, i));
      const after = rawLine.slice(i); // includes the first pipe
      const parts = after.split('|').map(s => s.trim());
      const markerRe = /^__FREE__(.*)__END__$/;
      let noteFreeText = '';
      const tokensRaw: string[] = [];
      for (const p of parts) {
        if (!p) continue;
        const m = p.match(markerRe);
        if (m) { noteFreeText = m[1]; continue; }
        tokensRaw.push(p);
      }
      const tokens = tokensRaw.filter(Boolean);
      let chips = '';
      tokens.forEach((tok) => {
        if (tok === '🕒') return; // hide the clock token
        if (tok === '__UNSAVED__') return; // hide the unsaved marker
        // Further split segments like "✈️ travel 🍳 cooking" into individual chips
        // Split on 2+ spaces OR a space before an emoji block
        const subParts = tok
          .split(/\s{2,}|\s(?=[\u2600-\u27BF\u{1F300}-\u{1FAFF}])/u)
          .map(s => s.trim())
          .filter(Boolean);
        if (subParts.length === 0) return;
        subParts.forEach((part) => {
          const safe = esc(part);
          // Use explicit border color for strong contrast across themes and force dark text on white bg for dark mode
          chips += `<span class="sr-only"> | </span><span contenteditable="false" class="pointer-events-none select-none inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow">${safe}</span> `;
        });
      });
      const free = noteFreeText
        ? `<span class="sr-only"> | </span><span contenteditable="false" class="pointer-events-none select-none inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow">${esc(noteFreeText)}</span> `
        : '';
      const innerContent = `${before}${chips}${free}`;
      // Wrap in outer pill ONLY if this line is saved (no __UNSAVED__ or __FREE__ marker)
      const isUnsaved = rawLine.includes('__UNSAVED__') || rawLine.includes('__FREE__');
      if (!isUnsaved) {
        // Saved entry: wrap in outer pill
        htmlLines.push(`<div class="my-2 p-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-800 shadow-sm">${innerContent}</div>`);
      } else {
        // Unsaved entry: keep flat
        htmlLines.push(`<div>${innerContent}</div>`);
      }
    }
    return htmlLines.join('');
  };

  // Keep contentEditable in sync when note changes from external actions (clear/save/load)
  useEffect(() => {
    const el = noteCERef.current;
    if (!el) return;
    const html = renderNoteHtml(note);
    if (el.innerHTML !== html) {
      el.innerHTML = html;
      // If user is editing, keep caret at the end so typing doesn't jump to start or into chips
      if (editorFocusedRef.current) {
        requestAnimationFrame(() => {
          try {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          } catch {}
        });
      }
    }
    // Sync hidden textarea for existing save code paths
    if (noteRef.current && noteRef.current.value !== note) {
      noteRef.current.value = note;
    }
  }, [note, language]);

  // Undo the most recent occurrence of a specific tag (works even after saving)
  const undoLastTag = async (tag: TagId) => {
    try {
      const label = (language === 'ar' ? (arTagLabels[tag] || tag.replace('_',' ')) : tag.replace('_',' '));
      const tagEmoji: Partial<Record<TagId, string>> = {
        family: '👨\u200d👩\u200d👧', friends: '🤝', date: '💘', exercise: '🏋️', sport: '🏆', relax: '😌',
        movies: '🎬', gaming: '🎮', reading: '📖', cleaning: '🧹', sleep: '😴', eat_healthy: '🥗',
        shopping: '🛍️', study: '🧠', work: '💼', music: '🎵', meditation: '🧘', nature: '🌿', travel: '✈️',
        cooking: '🍳', walk: '🚶', socialize: '🗣️', coffee: '☕'
      };
      const icon = tagEmoji[tag] || '🏷️';
      const token = `${icon} ${label}`;

      // 1) Remove the token from the most recent timestamp line in the Note text
      setNote(prev => {
        if (!prev) return prev;
        const lines = prev.split('\n');
        let i = lines.length - 1;
        while (i >= 0 && !/^\[[^\]]+\]/.test(lines[i])) i--;
        if (i < 0) return prev;
        let line = lines[i];
        const tokenRe = new RegExp(`(?:\\s*\\|\\s*)?${token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=\\s*\\|\\s*|\\s*$)`);
        if (!tokenRe.test(line)) return prev;
        line = line
          .replace(tokenRe, '')
          .replace(/\s*\|\s*\|\s*/g, ' | ')
          .replace(/\s+$/,'')
          .replace(/^(.+?)\s*\|\s*$/, '$1 | ');
        lines[i] = line;
        return lines.join('\n');
      });

      // 2) Update DB: choose the latest check-in that still has this tag (not only recent)
      let targetId: string | null = null;
      if (checkins && checkins.length) {
        const sorted = [...checkins].sort((a,b) => {
          const ta = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
          const tb = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
          return tb - ta;
        });
        const target = sorted.find(c => (c.tags || []).includes(tag));
        if (target) targetId = target.id;
      }
      if (targetId) {
        const current = checkins.find(c => c.id === targetId);
        const updated = (current?.tags || []).filter(t => t !== tag);
        await JournalService.updateCheckinTags(targetId, updated);
        const list = await JournalService.getCheckinsForDay(date);
        setCheckins(list);
      }
      // 3) Always decrement UI counter so ×N updates visually
      setTagTapCounts(prev => ({ ...prev, [tag]: Math.max(0, (prev[tag] || 0) - 1) } as any));

      toast.success(language === 'ar' ? 'تم التراجع' : 'Undone');
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
  };

  // When tags change shortly after a mood tap:
  // 1) ensure tokens for selected tags exist on the latest timestamp line in the note (pipe-separated)
  // 2) update tags on the latest created check-in in the DB, then refresh check-ins (so tag ×N updates)
  useEffect(() => {
    const lastTap = lastMoodTapAtRef.current;
    if (!lastTap) return;
    if (Date.now() - lastTap > 2 * 60 * 1000) return; // only within 2 minutes
    const tagLabel = (t: TagId) => (language === 'ar' ? (arTagLabels[t] || t.replace('_',' ')) : t.replace('_',' '));
    const tagEmoji: Partial<Record<TagId, string>> = {
      family: '👨\u200d👩\u200d👧', friends: '🤝', date: '💘', exercise: '🏋️', sport: '🏆', relax: '😌',
      movies: '🎬', gaming: '🎮', reading: '📖', cleaning: '🧹', sleep: '😴', eat_healthy: '🥗',
      shopping: '🛍️', study: '🧠', work: '💼', music: '🎵', meditation: '🧘', nature: '🌿', travel: '✈️',
      cooking: '🍳', walk: '🚶', socialize: '🗣️', coffee: '☕'
    };
    setNote(prev => {
      if (!prev) return prev;
      let text = prev;
      let lines = text.split('\n');
      // If last non-empty line is not a timestamp, append a fresh stub
      const lastNonEmpty = getLastNonEmptyLine(text);
      if (!isTimestampLine(lastNonEmpty)) {
        const now2 = new Date();
        const stubTime2 = formatTime(now2, language as any, { hour: '2-digit', minute: '2-digit' });
        text = (text.endsWith('\n') ? text : text + '\n') + `[${stubTime2}] 🕒  | `;
        lines = text.split('\n');
      }
      // find the most recent stub line ([time] …)
      let idx = lines.length - 1;
      while (idx >= 0 && !isTimestampLine(lines[idx])) idx--;
      if (idx < 0) return prev;
      let updated = lines[idx];
      // Append any missing tokens as pipes
      for (const t of tags) {
        const label = tagLabel(t);
        const icon = tagEmoji[t] || '🏷️';
        const token = `${icon} ${label}`;
        const tokenRe = new RegExp(`(?:\\s|\|)${token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=\s|$)`);
        if (!tokenRe.test(updated)) {
          // if line already has clock/mood, just append with pipe
          updated = `${updated} | ${token} `;
        }
      }
      // Ensure a single trailing placeholder ' | ' exists once at the end
      updated = updated.replace(/\s*\|\s*$/, '').trimEnd() + ' | ';
      if (updated === lines[idx]) return prev;
      lines[idx] = updated;
      return lines.join('\n');
    });

    // Do not persist tags on every change; persistence happens on Save.
  }, [tags]);

  // Undo latest check-in for a specific mood
  const undoLastCheckin = async (value: MoodValue) => {
    try {
      // Operate on pending (pre-save) actions only
      setPendingActions(prev => {
        const entries = Object.entries(prev);
        // Find most recent entry with this mood
        for (let i = entries.length - 1; i >= 0; i--) {
          const [timeStr, action] = entries[i];
          if (action.mood === value) {
            const next = { ...prev };
            delete next[timeStr];
            return next;
          }
        }
        return prev; // nothing to undo
      });
      setPendingMoodCounts(prev => ({ ...prev, [value]: Math.max(0, (prev[value] || 0) - 1) }));
      // Update the last timestamp line counts in the note editor
      const emoji: Record<MoodValue, string> = { 1: '😖', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };
      const now = new Date();
      const timeStr = formatTime(now, language as any, { hour: '2-digit', minute: '2-digit' });
      setNote(prev => {
        const prevText = prev || '';
        const lines = prevText.split('\n');
        if (lines.length === 0) return prevText;
        const lastLine = lines[lines.length - 1];
        const sameTimeRe = new RegExp(`^\\[${timeStr.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\]`);
        const emojiEsc = emoji[value].replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        if (sameTimeRe.test(lastLine)) {
          // Compute total count after undo
          const totalCountAfter = (moodCounts[value] || 0) + Math.max(0, (pendingMoodCounts[value] || 0) - 1);
          let updated = lastLine;
          if (totalCountAfter <= 1) {
            // remove ×N if present, keep the emoji once
            updated = updated.replace(new RegExp(`(${emojiEsc})(?:\\s*×\\d+)?`), `$1`);
          } else {
            updated = updated.replace(new RegExp(`(${emojiEsc})(?:\\s*×\\d+)?`), `$1 ×${totalCountAfter}`);
          }
          updated = updated.replace(/\s*\|\s*$/, '').trimEnd() + ' | ';
          lines[lines.length - 1] = updated;
          return lines.join('\n');
        }
        return prevText;
      });
      toast.success(language === 'ar' ? 'تم التراجع' : 'Undone');
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
  };

  // Frequency counters for today (only check-ins, not base mood)
  const moodCounts = useMemo(() => {
    const counts: Record<MoodValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const c of checkins) counts[c.mood_value as MoodValue] += 1;
    return counts;
  }, [checkins]);

  // Tag counts from check-ins only (not base selection)
  const tagCounts = useMemo(() => {
    const map: Record<TagId, number> = {} as any;
    // Only from persisted check-ins so ×N reflects saved data
    for (const c of checkins) {
      if (Array.isArray(c.tags)) {
        for (const t of c.tags) map[t as TagId] = (map[t as TagId] || 0) + 1;
      }
    }
    return map;
  }, [checkins]);

  const notesToday = useMemo(() => checkins.filter(c => (c.note || '').trim().length > 0), [checkins]);
  // Show current selected tags under the Note (with icons)
  const selectedTagsForPreview = tags;

  // Clear only unsaved changes (keep saved entries)
  const clearSelections = () => {
    // Clear mood/tags/morning/evening selections
    setMood(null);
    setTags([]);
    setMorning("");
    setEvening("");
    setTagTapCounts({} as any);
    lastMoodTapAtRef.current = null;
    lastCheckinIdRef.current = null;
    // Clear pending buffers
    setPendingActions({});
    setPendingMoodCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    // Keep saved entries in note (lines without __FREE__ or __UNSAVED__ markers); remove unsaved lines
    const lines = (note || '').split('\n');
    const savedLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && !line.includes('__FREE__') && !line.includes('__UNSAVED__');
    });
    const cleanedNote = savedLines.join('\n');
    setNote(cleanedNote);
    // Force re-render of contentEditable
    requestAnimationFrame(() => {
      if (noteCERef.current) {
        noteCERef.current.innerHTML = renderNoteHtml(cleanedNote);
      }
    });
    // End editing session
    setIsNoteEditing(false);
  };

  // Auto-scroll Evening textarea when navigating with ?focus=evening
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('focus') === 'evening') {
      setTimeout(() => {
        eveningRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        eveningRef.current?.focus();
      }, 120);
    }
    if (params.get('focus') === 'checkin') {
      setTimeout(() => {
        checkinSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    }
  }, [location.search]);

  const navigate = useNavigate();

  // Load today's saved entry on mount and when date changes
  useEffect(() => {
    // Immediately clear transient state to avoid showing stale xN while loading
    setCheckins([]);
    setPendingActions({});
    setPendingMoodCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    setTagTapCounts({} as any);
    (async () => {
      try {
        const d = await JournalService.getDay(date);
        if (d) {
          const dayEnded = Boolean(d.evening_reflection);
          if (dayEnded) {
            // Day is ended: present a fresh, empty Today tab
            setMood(null);
            setTags([]);
            setNote("");
            setMorning("");
            setEvening("");
            setDayUpdatedAt(d.updated_at || null);
            setSavedMood((d.mood_value as MoodValue) ?? null);
            setSavedTags(Array.isArray(d.tags) ? d.tags : []);
            setSavedNote(d.note || "");
            setSavedMorning(d.morning_reflection || "");
            setSavedEvening(d.evening_reflection || "");
            // Also clear all counters and check-ins so no xN shows after End Day
            setCheckins([]);
            setPendingMoodCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
            setPendingActions({});
            setTagTapCounts({} as any);
            // Clear editor DOM
            requestAnimationFrame(() => {
              if (noteCERef.current) noteCERef.current.innerHTML = "";
            });
          } else {
            // Day not ended: load current state
            setMood((d.mood_value as MoodValue) ?? null);
            setTags(Array.isArray(d.tags) ? d.tags : []);
            setNote(d.note || "");
            setMorning(d.morning_reflection || "");
            setEvening(d.evening_reflection || "");
            setDayUpdatedAt(d.updated_at || null);
            // Initialize saved snapshots from loaded day
            setSavedMood((d.mood_value as MoodValue) ?? null);
            setSavedTags(Array.isArray(d.tags) ? d.tags : []);
            setSavedNote(d.note || "");
            setSavedMorning(d.morning_reflection || "");
            setSavedEvening(d.evening_reflection || "");
          }
        }
        // Only load check-ins if the day is NOT ended. If ended, keep Today clean (no ×N badges)
        if (!d?.evening_reflection) {
          const list = await JournalService.getCheckinsForDay(date);
          setCheckins(list);
        } else {
          setCheckins([]);
        }
        // nothing else
      } catch (e) {
        // Silent; Today remains editable if nothing saved yet
      }
    })();
  }, [date]);

  const addQuickCheckin = async (value: MoodValue) => {
    try {
      // Buffer the tap locally (no DB write yet)
      setPendingMoodCounts(prev => ({ ...prev, [value]: (prev[value] || 0) + 1 }));
      const now = new Date();
      const timeStr = formatTime(now, language as any, { hour: '2-digit', minute: '2-digit' });
      setPendingActions(prev => {
        const next = { ...prev };
        if (!next[timeStr]) {
          next[timeStr] = { mood: value, tags: [] };
        } else {
          next[timeStr].mood = value; // Update mood for this timestamp
        }
        return next;
      });
      // Append a stub line to the note textarea with time + mood emoji
      const emoji: Record<MoodValue, string> = { 1: '😖', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };
      // Initial line with clock + mood, pipe-separated, plus trailing pipe placeholder
      // Mark as unsaved with __UNSAVED__ so renderer knows not to wrap in outer pill
      const stub = `[${timeStr}] 🕒 | ${emoji[value]} | __UNSAVED__`;
      setNote(prev => {
        const prevText = prev || '';
        // Always start a new timestamp line for each mood tap (new entry)
        const next = prevText && prevText.trim().length > 0 ? `${prevText}\n${stub}` : stub;
        lastStubTextRef.current = stub;
        lastStubAtRef.current = Date.now();
        try { noteCERef.current && (noteCERef.current.innerHTML = renderNoteHtml(next)); } catch {}
        return next;
      });
      lastMoodTapAtRef.current = Date.now();
      toast.success(language === 'ar' ? 'تمت الإضافة' : 'Entry added');
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    }
  };

  const moodAr: Record<MoodValue, string> = { 1: "سيئ جداً", 2: "سيئ", 3: "عادي", 4: "جيد", 5: "ممتاز" };
  // Color accents for tag icons when not selected (keeps text-primary when active)
  const tagColor: Record<string, string> = {
    family: "text-pink-400",
    friends: "text-pink-400",
    socialize: "text-pink-400",
    date: "text-rose-400",
    exercise: "text-emerald-400",
    sport: "text-emerald-400",
    relax: "text-sky-400",
    movies: "text-purple-400",
    gaming: "text-indigo-400",
    reading: "text-amber-500",
    cleaning: "text-yellow-400",
    sleep: "text-violet-400",
    eat_healthy: "text-lime-500",
    shopping: "text-rose-400",
    study: "text-cyan-400",
    work: "text-slate-400",
    music: "text-fuchsia-400",
    meditation: "text-teal-400",
    nature: "text-green-500",
    travel: "text-orange-400",
    cooking: "text-red-400",
    walk: "text-emerald-400",
    coffee: "text-amber-600",
  };
  // Colors used for active glow around mood faces
  const moodHex: Record<MoodValue, string> = {
    1: '#ef4444', // red-500
    2: '#f97316', // orange-500
    3: '#f59e0b', // amber-500
    4: '#10b981', // emerald-500
    5: '#22c55e', // green-500
  };

  const toggleTag = (tag: TagId) => {
    setTags(prev => {
      const on = prev.includes(tag);
      // throttle only for selecting (avoid blocking deselect/undo)
      if (!on) {
        const lastAt = lastTagTapAtRef.current[tag] || 0;
        const nowTs = Date.now();
        if (nowTs - lastAt < 600) return prev;
        lastTagTapAtRef.current[tag] = nowTs;
      }
      // Update xN counters in UI
      setTagTapCounts(c => {
        const next = { ...c } as Record<TagId, number>;
        if (!on) next[tag] = (next[tag] || 0) + 1; // selecting → increment
        else if (next[tag] && next[tag] > 0) next[tag] = next[tag] - 1; // deselecting → decrement
        return next;
      });
      // Append/remove stub inside Note for tag actions (text + emoji icon substitute)
      const tagEmoji: Partial<Record<TagId, string>> = {
        family: '👨\u200d👩\u200d👧', friends: '🤝', date: '💘', exercise: '🏋️', sport: '🏆', relax: '😌',
        movies: '🎬', gaming: '🎮', reading: '📖', cleaning: '🧹', sleep: '😴', eat_healthy: '🥗',
        shopping: '🛍️', study: '🧠', work: '💼', music: '🎵', meditation: '🧘', nature: '🌿', travel: '✈️',
        cooking: '🍳', walk: '🚶', socialize: '🗣️', coffee: '☕'
      };
      const now = new Date();
      const timeStr = formatTime(now, language as any, { hour: '2-digit', minute: '2-digit' });
      const label = (language === 'ar' ? (arTagLabels[tag] || tag.replace('_',' ')) : tag.replace('_',' '));
      const icon = tagEmoji[tag] || '🏷️';
      const token = `${icon} ${label}`;
      if (!on) {
        // Add tag to pending actions for this timestamp
        setPendingActions(prev => {
          const next = { ...prev };
          if (!next[timeStr]) {
            next[timeStr] = { mood: mood || 4, tags: [tag] };
          } else {
            if (!next[timeStr].tags.includes(tag)) {
              next[timeStr].tags = [...next[timeStr].tags, tag];
            }
          }
          return next;
        });
        
        setNote(prevText => {
          const prevVal = prevText || '';
          const lines = prevVal.split('\n');
          // Find existing timestamp line for this time
          let existingLineIdx = -1;
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].startsWith(`[${timeStr}]`)) {
              existingLineIdx = i;
              break;
            }
          }
          
          if (existingLineIdx >= 0) {
            // Append to existing line for this timestamp
            let line = lines[existingLineIdx];
            // Remove __UNSAVED__ temporarily
            line = line.replace(/\s*__UNSAVED__\s*/g, '');
            // Add the token before the trailing pipe
            line = line.replace(/\s*\|\s*$/, '').trimEnd() + ` | ${token} | __UNSAVED__`;
            lines[existingLineIdx] = line;
            const next = lines.join('\n');
            try { noteCERef.current && (noteCERef.current.innerHTML = renderNoteHtml(next)); } catch {}
            return next;
          } else {
            // Create new timestamp line
            const stub = `[${timeStr}] 🕒 | ${token} | __UNSAVED__`;
            const next = prevVal && prevVal.trim().length > 0 ? `${prevVal}\n${stub}` : stub;
            lastStubTextRef.current = stub;
            lastStubAtRef.current = Date.now();
            try { noteCERef.current && (noteCERef.current.innerHTML = renderNoteHtml(next)); } catch {}
            return next;
          }
        });
        // Do not auto-focus the note; user may continue selecting other tags/moods
      } else {
        // Deselect: remove token from most recent timestamp line containing it.
        setNote(prevText => {
          if (!prevText) return prevText;
          const lines = prevText.split('\n');
          let i = lines.length - 1;
          const tagPattern = new RegExp(`(?:\\s|\|)${token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=\\s|$)`);
          while (i >= 0) {
            const line = lines[i];
            if (/^\[[^\]]+\]/.test(line) && tagPattern.test(line)) {
              let updated = line.replace(tagPattern, '').replace(/\s*\|\s*\|/g,' | ').replace(/^\[([^\]]+)\]\s*\|\s*$/,'[$1] ').trimEnd();
              // Keep single placeholder when content remains
              if (!/^\[[^\]]+\]\s*$/.test(updated) && !/^\[[^\]]+\]\s*🕒\s*$/.test(updated)) {
                updated = updated.replace(/\s*\|\s*$/, '').trimEnd() + ' | ';
              }
              // If line is only a timestamp after cleanup, drop the line
              if (/^\[[^\]]+\]\s*$/.test(updated) || /^\[[^\]]+\]\s*🕒\s*$/.test(updated)) {
                lines.splice(i,1);
              } else {
                lines[i] = updated;
              }
              break;
            }
            i--;
          }
          return lines.join('\n');
        });
      }
      // Toggle selection
      return on ? prev.filter(t => t !== tag) : [...prev, tag];
    });
  };

  const handleAddCustom = async () => {
    const raw = customValue.trim();
    if (!raw) return;
    const id = (raw.toLowerCase().replace(/\s+/g, '_') as TagId);
    // Enforce a maximum of 3 custom tags (non-default)
    if (!defaultTagSet.has(id) && !allTags.includes(id) && customTags.length >= 3) {
      toast.info(language === 'ar' ? 'يمكنك إضافة 3 وسوم مخصصة فقط. احذف وسمًا لإضافة آخر.' : 'You can add up to 3 custom tags. Delete one to add another.');
      return;
    }
    if (!allTags.includes(id)) {
      // Update remote profile first
      try {
        const nextCustom = defaultTagSet.has(id) ? customTags : Array.from(new Set([...customTags, id]));
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('profiles').update({ custom_tags: nextCustom }).eq('id', userId);
        if (error) throw error;
        setCustomTags(nextCustom);
        setAllTags([ ...DEFAULT_TAGS, ...nextCustom.filter(t => !defaultTagSet.has(t)) ] as TagId[]);
        setCustomVersion(v => v + 1);
      } catch (e: any) {
        toast.error(e?.message || (language === 'ar' ? 'فشل حفظ الوسم' : 'Failed to save tag'));
        return;
      }
    }
    setTags(prev => Array.from(new Set([...prev, id])));
    setCustomValue("");
    setCustomOpen(false);
  };

  const removeCustomTag = (id: TagId) => {
    if (defaultTagSet.has(id)) return; // only custom tags are removable
    (async () => {
      try {
        const nextCustom = customTags.filter(t => t !== id);
        if (!userId) throw new Error('Not authenticated');
        const { error } = await supabase.from('profiles').update({ custom_tags: nextCustom }).eq('id', userId);
        if (error) throw error;
        setCustomTags(nextCustom);
        setAllTags([ ...DEFAULT_TAGS, ...nextCustom.filter(t => !defaultTagSet.has(t)) ] as TagId[]);
        // Also ensure it's not selected anymore and clear UI counters
        setTags(prev => prev.filter(t => t !== id));
        setTagTapCounts(prev => {
          const next = { ...prev } as Record<TagId, number>;
          delete next[id];
          return next;
        });
        setCustomVersion(v => v + 1);
      } catch (e: any) {
        toast.error(e?.message || (language === 'ar' ? 'فشل حذف الوسم' : 'Failed to delete tag'));
      }
    })();
  };

  const onSave = async () => {
    try {
      setSaving(true);
      // Strip __FREE__...__END__ and __UNSAVED__ markers before saving
      let cleanNote = (note || '').replace(/__FREE__(.*?)__END__/g, '$1');
      cleanNote = cleanNote.replace(/\s*__UNSAVED__\s*/g, '');
      await JournalService.upsertDay({
        date,
        mood_value: mood,
        tags,
        note: cleanNote || null,
        morning_reflection: morning || null,
        evening_reflection: evening || null
      });
      // Flush pending mood taps to DB - ONE check-in per unique timestamp
      const timestamps = Object.keys(pendingActions);
      for (const timeStr of timestamps) {
        const action = pendingActions[timeStr];
        await JournalService.addCheckin({
          date,
          mood_value: action.mood,
          tags: action.tags, // Only tags for this specific timestamp
          note: null,
        });
      }
      // Refresh check-ins from DB after flush
      const refreshed = await JournalService.getCheckinsForDay(date);
      setCheckins(refreshed);
      // Reset pending state
      setPendingActions({});
      setPendingMoodCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      setDayUpdatedAt(new Date().toISOString());
      // Do not insert separators after save; end editing session
      setIsNoteEditing(false);
      // Update saved snapshots to current saved state
      setSavedMood(mood);
      setSavedTags(tags);
      setSavedMorning(morning);
      setSavedEvening(evening);
      // Note is updated via setNote above; read from ref shortly after to capture final string
      setTimeout(() => {
        setSavedNote(noteRef.current?.value || savedNote);
      }, 0);
      // Keep cursor at end
      setTimeout(() => {
        const el = noteRef.current;
        if (el) {
          el.focus();
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      }, 0);
      toast.success(language === 'ar' ? 'تم الحفظ' : 'Saved');
      // Collapse morning after save
      setMorningOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 relative shadow-md card-3d inner-bevel edge-liquid">
        {saving && <div className="reveal-wipe" />}
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            {language === 'ar' ? 'تحضير الصباح' : 'Morning Preparation'}
          </div>
          <button
            type="button"
            onClick={() => setMorningOpen(v => !v)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            {morningOpen ? (language === 'ar' ? 'إخفاء' : 'Hide') : (language === 'ar' ? 'تعديل الصباح' : 'Edit morning')}
          </button>
        </div>
        {morningOpen ? (
          <Textarea value={morning} onChange={e => setMorning(e.target.value)} placeholder={language === 'ar' ? 'ما الأهم اليوم؟' : "What matters most today?"} />
        ) : (
          <div className="text-sm text-muted-foreground">
            {morning ? <span className="line-clamp-2">{morning}</span> : <span className="opacity-70">{language === 'ar' ? 'لم تتم إضافته بعد' : 'Not added yet'}</span>}
          </div>
        )}
      </div>

      {/* Composer (flattened, elements removed by request) */}
      <div ref={checkinSectionRef} style={{height:0}} aria-hidden="true"></div>
      {notesToday.length > 0 && (
        <div className="mt-3 rounded-2xl border border-dotted border-border/60 bg-gradient-to-b from-card to-background p-3">
          <div className="space-y-2">
            {notesToday.map(n => (
              <div key={n.id} className="text-xs">
                {(() => {
                  const d = n.occurred_at ? new Date(n.occurred_at) : null;
                  const ok = d && !isNaN(d.getTime());
                  const timeStr = ok ? formatTime(d as Date, language as any, { hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>{timeStr}</span>
                      <span className="h-px flex-1 border-t border-dotted border-border/60" />
                    </div>
                  );
                })()}
                <div className="mt-1 text-sm">{n.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            {language === 'ar' ? 'المزاج' : 'Mood'}
          </div>
          {/* Clear moved to Note header */}
        </div>
        <div className={`grid grid-cols-5 ${isMobile ? 'gap-2' : 'gap-3'} items-start`}>
          {faces.map(({ value, color }) => (
            <div key={value} className="flex flex-col items-center">
              <button
                onClick={() => { setMood(value); addQuickCheckin(value); }}
                aria-pressed={mood === value}
                className={`group relative flex flex-col items-center gap-1 rounded-2xl ${isMobile ? 'px-2 py-2' : 'px-3 py-3'} transition-all cursor-pointer select-none focus:outline-none
                border border-border bg-card shadow-sm hover:shadow-md hover:-translate-y-[1px]
                ${mood === value ? 'border-primary shadow-lg bg-card' : ''}`}
              >
                <MoodFace value={value} active={mood === value} size={isMobile ? 44 : 56} className="transition-transform duration-150 group-hover:scale-[1.03]" />
                <span className={`text-xs ${color}`}>{language === 'ar' ? moodAr[value] : moodLabels[value]}</span>
              </button>
              {((moodCounts[value] || 0) + (pendingMoodCounts[value] || 0)) >= 1 && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted/80 border border-border/60">×{(moodCounts[value] || 0) + (pendingMoodCounts[value] || 0)}</span>
                  {(pendingMoodCounts[value] || 0) > 0 && (
                    <button
                      type="button"
                      aria-label={language === 'ar' ? 'تراجع' : 'Undo'}
                      className="h-6 w-6 rounded-md border border-border bg-card text-foreground/80 leading-none flex items-center justify-center shadow-sm hover:shadow-md active:scale-[0.98]"
                      onClick={() => undoLastCheckin(value)}
                      title={language === 'ar' ? 'تراجع عن آخر اختيار' : 'Undo last pick'}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      <span className="sr-only">{language === 'ar' ? 'تراجع' : 'Undo'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="grid [grid-template-columns:repeat(auto-fit,_minmax(104px,_1fr))] gap-2 items-start">
          {allTags.map(tag => (
            <div key={tag + ':' + customVersion} className="flex flex-col items-center w-full">
              <button
                onClick={() => toggleTag(tag)}
                aria-pressed={tags.includes(tag)}
                className={`group relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 h-[78px] w-full transition-all cursor-pointer select-none focus:outline-none border border-border bg-card shadow-sm hover:shadow-md hover:-translate-y-[1px] ${tags.includes(tag) ? 'border-primary bg-primary/5' : ''}`}
              >
                {(tagCounts[tag] ?? 0) >= 1 && (
                  <span className="absolute top-1 right-1 text-[10px] px-1 py-0.5 rounded bg-muted/80 border border-border/60">×{tagCounts[tag]}</span>
                )}
                {/* Delete for custom tags */}
                {!defaultTagSet.has(tag) && (
                  <div
                    role="button"
                    aria-label={language === 'ar' ? 'حذف الوسم' : 'Delete tag'}
                    className="absolute top-1 left-1 h-5 w-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center text-[10px] border border-destructive/50 shadow"
                    onClick={(e) => { e.stopPropagation(); removeCustomTag(tag); }}
                    title={language === 'ar' ? 'حذف' : 'Delete'}
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeCustomTag(tag); } }}
                  >
                    ×
                  </div>
                )}
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center bg-gradient-to-br from-white/70 to-muted shadow-sm ${tags.includes(tag) ? 'text-primary' : (tagColor[tag] || 'text-muted-foreground')}`}
                >
                  <TagIcon id={tag} className="h-4 w-4" />
                </div>
                <span className="text-[10px] leading-none opacity-80">{language === 'ar' ? (arTagLabels[tag] || tag.replace('_',' ')) : tag.replace('_',' ')}</span>
              </button>
              <div className="mt-1 h-6 flex items-center gap-2">
                <span className={`text-[11px] px-1.5 py-0.5 rounded bg-muted/80 border border-border/60 ${((tagCounts[tag] ?? 0) >= 1) ? '' : 'opacity-0'}`}>×{tagCounts[tag] ?? 0}</span>
                {hasUnsaved && (
                  <button
                    type="button"
                    aria-label={language === 'ar' ? 'تراجع' : 'Undo'}
                    className={`h-6 w-6 rounded-md border border-border bg-card text-foreground/80 leading-none flex items-center justify-center shadow-sm hover:shadow-md active:scale-[0.98] ${((tagCounts[tag] ?? 0) >= 1) ? '' : 'opacity-0 pointer-events-none'}`}
                    onClick={() => undoLastTag(tag)}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    <span className="sr-only">{language === 'ar' ? 'تراجع' : 'Undo'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
          {/* Custom tag chip */}
          <button
            onClick={() => setCustomOpen(true)}
            className="relative chip-3d flex flex-col items-center gap-1 p-2 rounded-xl border border-dashed hover:border-primary transition-all cursor-pointer select-none hover:bg-muted/40"
          >
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-[10px] leading-none opacity-80">{language === 'ar' ? 'مخصص' : 'Custom'}</span>
            <span className="absolute bottom-1 right-1 text-[10px] px-1 py-0.5 rounded bg-muted/70 border border-border/60">{customCount}/3</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            {language === 'ar' ? 'ملاحظاتي اليومية' : 'My daily notes'}
          </div>
          <div className="flex items-center gap-2">
          {dayUpdatedAt && (
            <span className="text-[10px] text-muted-foreground">
              {formatTime(new Date(dayUpdatedAt), language as any, { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            type="button"
            onClick={() => { setIsNoteEditing(true); ensureEndStub(); noteCERef.current?.focus(); }}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border bg-gradient-to-b from-card to-background text-foreground/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-3.5 w-3.5" /> {language === 'ar' ? 'أضف ملاحظة' : 'Add note'}
          </button>
          {hasUnsaved && (
          <button
            type="button"
            onClick={clearSelections}
            aria-label={language === 'ar' ? 'مسح التغييرات غير المحفوظة' : 'Clear unsaved changes'}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border bg-gradient-to-b from-muted to-background text-muted-foreground shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-inner transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {language === 'ar' ? 'مسح' : 'Clear'}
          </button>
          )}
        </div>
        </div>
        <div
          ref={noteCERef}
          contentEditable={isNoteEditing}
          suppressContentEditableWarning
          className="flex w-full rounded-md border-0 bg-transparent px-0 py-2 text-sm min-h-[96px] overflow-y-auto focus-visible:outline-none"
          spellCheck={false}
          onFocus={() => { editorFocusedRef.current = true; if (isNoteEditing) ensureEndStub(); }}
          onBlur={() => { editorFocusedRef.current = false; }}
          onKeyDown={(e) => {
            if (!isNoteEditing) { e.preventDefault(); return; }
            if (e.key === 'Enter') {
              e.preventDefault();
              return;
            }
            // Controlled typing: append to free-text pill; handle Backspace
            const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
            if (printable) {
              e.preventDefault();
              mutateFreeText(prev => (prev + e.key).slice(0, 512));
              return;
            }
            if (e.key === 'Backspace') {
              e.preventDefault();
              mutateFreeText(prev => prev.slice(0, Math.max(0, prev.length - 1)));
              return;
            }
          }}
          onMouseDown={(e) => {
            // Prevent placing caret inside chips; always set caret to end
            try {
              e.preventDefault();
              const el = noteCERef.current;
              if (!el) return;
              const range = document.createRange();
              range.selectNodeContents(el);
              range.collapse(false);
              const sel = window.getSelection();
              sel?.removeAllRanges();
              sel?.addRange(range);
            } catch {}
          }}
          onDrop={(e) => { e.preventDefault(); }}
          onInput={(e) => {
            // In controlled typing mode we already updated note via key handlers; ignore browser input
            if (isNoteEditing) return;
            const el = e.currentTarget as HTMLDivElement;
            const raw = el.innerText.replace(/\r\n/g, '\n');
            setNote(raw);
            requestAnimationFrame(() => {
              try {
                const range = document.createRange();
                range.selectNodeContents(el);
                range.collapse(false);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              } catch {}
            });
          }}
          onPaste={(e) => {
            e.preventDefault();
            if (!isNoteEditing) return;
            const text = e.clipboardData.getData('text/plain').replace(/\r?\n+/g, ' ');
            mutateFreeText(prev => (prev + text).slice(0, 2000));
          }}
          aria-label={language === 'ar' ? 'ملاحظة' : 'Note'}
        />
        {/* Hidden textarea to preserve existing save flows that read from noteRef */}
        <textarea ref={noteRef} value={note} onChange={(e)=>setNote(e.target.value)} className="sr-only" aria-hidden="true" tabIndex={-1} />
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            {language === 'ar' ? 'مراجعة المساء' : 'Evening Reflection'}
          </div>
        </div>
        <Textarea ref={eveningRef} value={evening} onChange={e => setEvening(e.target.value)} placeholder={language === 'ar' ? 'أفضل لحظة؟ ماذا تعلمت؟' : 'Best moment? What did you learn?'} />
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onSave} disabled={saving} className="btn-shine" data-saving={saving ? 'true' : 'false'}>
          {saving ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ' : 'Save')}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={async () => {
          try {
            setSaving(true);
            // Strip markers before saving
            let cleanNote = (note || '').replace(/__FREE__(.*?)__END__/g, '$1');
            cleanNote = cleanNote.replace(/\s*__UNSAVED__\s*/g, '');
            const finalEvening = (evening && evening.trim().length > 0) ? evening : (language === 'ar' ? 'المساء مفقود' : 'Evening missing');
            
            // Save main day entry
            await JournalService.upsertDay({
              date,
              mood_value: mood,
              tags,
              note: cleanNote || null,
              morning_reflection: morning || null,
              evening_reflection: finalEvening,
            });
            
            // Flush pending mood taps
            const timestamps = Object.keys(pendingActions);
            for (const timeStr of timestamps) {
              const action = pendingActions[timeStr];
              await JournalService.addCheckin({
                date,
                mood_value: action.mood,
                tags: action.tags,
                note: null,
              });
            }
            
            // Refresh check-ins from DB to confirm save
            const refreshed = await JournalService.getCheckinsForDay(date);
            setCheckins(refreshed);
            
            // Reset pending state
            setPendingActions({});
            setPendingMoodCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
            
            // Update saved snapshots
            setSavedMood(mood);
            setSavedTags(tags);
            setSavedNote(cleanNote || "");
            setSavedMorning(morning);
            setSavedEvening(finalEvening);
            
            toast.success(language === 'ar' ? 'تم إنهاء اليوم وحفظه' : 'Day ended and saved');
            
            // Trigger Timeline refresh and navigate
            window.dispatchEvent(new Event('refreshTimeline'));
            // Immediately clear Today UI for a fresh start
            setMood(null);
            setTags([]);
            setNote("");
            setMorning("");
            setEvening("");
            setIsNoteEditing(false);
            // Clear check-ins and counters so badges are reset
            setCheckins([]);
            setPendingMoodCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
            setPendingActions({});
            setTagTapCounts({} as any);
            requestAnimationFrame(() => {
              if (noteCERef.current) noteCERef.current.innerHTML = "";
            });
            setTimeout(() => {
              navigate('/journal?tab=timeline');
            }, 300);
          } catch (e: any) {
            console.error('End Day error:', e);
            toast.error(e?.message || 'Failed to end day');
          } finally {
            setSaving(false);
          }
        }}>
          {language === 'ar' ? 'إنهاء اليوم' : 'End Day'}
        </Button>
      </div>

      {/* Custom Tag Dialog */}
      <Dialog open={isCustomOpen} onOpenChange={setCustomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'إضافة وسم مخصص' : 'Add custom tag'}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={customValue} onChange={e => setCustomValue(e.target.value)} placeholder={language === 'ar' ? 'اكتب الوسم...' : 'Type a tag...'} />
            <Button onClick={handleAddCustom}>{language === 'ar' ? 'إضافة' : 'Add'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
