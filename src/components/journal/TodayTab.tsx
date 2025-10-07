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

  // Helpers: ensure a separator + fresh stub at the end and place caret
  const ensureEndStub = useCallback(() => {
    const now = new Date();
    const stubTime = formatTime(now, language as any, { hour: '2-digit', minute: '2-digit' });
    setNote(prev => {
      const cur = prev || '';
      const last = getLastNonEmptyLine(cur);
      if (isTimestampLine(last)) {
        // ensure single trailing placeholder
        const lines = cur.split('\n');
        let idx = lines.length - 1; while (idx >= 0 && !isTimestampLine(lines[idx])) idx--;
        if (idx >= 0) lines[idx] = lines[idx].replace(/\s*\|\s*$/, '').trimEnd() + ' | ';
        return lines.join('\n');
      }
      const sep = '............';
      const base = cur.endsWith('\n') || cur.length === 0 ? cur : cur + '\n';
      const withSep = base.length ? `${base}${sep}\n` : '';
      return `${withSep}[${stubTime}] 🕒  | `;
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
      const tokens = parts.slice(0, Math.max(parts.length - 1, 0)).filter(Boolean);
      const noteFreeText = (parts.length > 0 ? parts[parts.length - 1] : '').trim();
      let chips = '';
      tokens.forEach((tok) => {
        if (tok === '🕒') return; // hide the clock token
        // Further split segments like "✈️ travel 🍳 cooking" into individual chips
        // Split on 2+ spaces OR a space before an emoji block
        const subParts = tok
          .split(/\s{2,}|\s(?=[\u2600-\u27BF\u{1F300}-\u{1FAFF}])/u)
          .map(s => s.trim())
          .filter(Boolean);
        if (subParts.length === 0) return;
        subParts.forEach((part) => {
          const safe = esc(part);
          chips += `<span class="sr-only"> | </span><span contenteditable="false" class="pointer-events-none select-none inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 shadow-sm">${safe}</span> `;
        });
      });
      const free = noteFreeText ? `<span> ${esc(noteFreeText)}</span>` : '';
      htmlLines.push(`<div>${before}${chips}${free}</div>`);
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
      const ok = await JournalService.deleteLastCheckin(date, value);
      if (!ok) {
        toast.info(language === 'ar' ? 'لا يوجد شيء للتراجع عنه' : 'Nothing to undo');
        return;
      }
      const list = await JournalService.getCheckinsForDay(date);
      setCheckins(list);
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

  // Clear everything: selected mood, selected tags, counters, and Note text
  const clearSelections = () => {
    // Revert to last saved snapshots only (do not wipe saved content)
    setMood(savedMood);
    setTags(savedTags);
    setNote(savedNote);
    setMorning(savedMorning);
    setEvening(savedEvening);
    setTagTapCounts({} as any);
    lastMoodTapAtRef.current = null;
    lastCheckinIdRef.current = null;
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
    (async () => {
      try {
        const d = await JournalService.getDay(date);
        if (d) {
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
        const list = await JournalService.getCheckinsForDay(date);
        setCheckins(list);
        // nothing else
      } catch (e) {
        // Silent; Today remains editable if nothing saved yet
      }
    })();
  }, [date]);

  const addQuickCheckin = async (value: MoodValue) => {
    try {
      const created = await JournalService.addCheckin({
        date,
        mood_value: value,
        tags,
        note: null,
      });
      const list = await JournalService.getCheckinsForDay(date);
      setCheckins(list);
      // Append a stub line to the note textarea with time + mood emoji
      const emoji: Record<MoodValue, string> = { 1: '😖', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };
      const now = new Date();
      const timeStr = formatTime(now, language as any, { hour: '2-digit', minute: '2-digit' });
      // Initial line with clock + mood, pipe-separated, plus trailing pipe placeholder
      const stub = `[${timeStr}] 🕒 | ${emoji[value]} | `;
      setNote(prev => {
        const prevText = prev || '';
        const lastLine = prevText.split('\n').pop() || '';
        // If last line already begins with the same timestamp, append mood to it instead of creating new line
        const sameTimeRe = new RegExp(`^\\[${timeStr.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\]`);
        if (sameTimeRe.test(lastLine)) {
          // if mood token not present, append with pipe
          if (!new RegExp(`(?:\\s|\|)${emoji[value].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=\\s|$)`).test(lastLine)) {
            let combined = `${lastLine} | ${emoji[value]} `;
            combined = combined.replace(/\s*\|\s*$/, '').trimEnd() + ' | ';
            const base = prevText.split('\n'); base[base.length-1] = combined;
            lastStubTextRef.current = combined; lastStubAtRef.current = Date.now();
            return base.join('\n');
          }
          // ensure placeholder at end even if mood already present
          const base = prevText.split('\n');
          base[base.length-1] = (lastLine.replace(/\s*\|\s*$/, '').trimEnd() + ' | ');
          return base.join('\n');
        }
        // Otherwise start a new line
        // de-dupe only if exact same stub was just added
        if (lastLine === stub && Date.now() - lastStubAtRef.current < 1200) return prevText;
        const next = prevText && prevText.trim().length > 0 ? `${prevText}\n${stub}` : stub;
        lastStubTextRef.current = stub;
        lastStubAtRef.current = Date.now();
        return next;
      });
      lastMoodTapAtRef.current = Date.now();
      // Focus textarea and place cursor at end
      setTimeout(() => {
        const el = noteRef.current;
        if (el) {
          el.focus();
          const len = el.value.length;
          el.setSelectionRange(len, len);
        }
      }, 0);
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
        setNote(prevText => {
          const prevVal = prevText || '';
          const lines = prevVal.length ? prevVal.split('\n') : [];
          const lastIdx = lines.length - 1;
          if (lastIdx >= 0 && /^\[[^\]]+\]/.test(lines[lastIdx])) {
            // operate on existing last timestamp line
            const sameTime = new RegExp(`^\\[${timeStr.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}\\]`);
            const alreadyHas = new RegExp(`(?:\\s|\|)${token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?=\\s|$)`);
            if (alreadyHas.test(lines[lastIdx])) return prevVal; // avoid duplicate tag on same line
            if (sameTime.test(lines[lastIdx]) || true) {
              // append to same line (one timestamp)
              lines[lastIdx] = `${lines[lastIdx]} | ${token}`.trimEnd();
              const next = lines.join('\n');
              lastStubTextRef.current = token;
              lastStubAtRef.current = Date.now();
              return next;
            }
          }
          // otherwise create a new timestamp line
          const stub = `[${timeStr}] 🕒 | ${token}`;
          if (lines.length === 0) return stub;
          lines.push(stub);
          const next = lines.join('\n');
          lastStubTextRef.current = stub;
          lastStubAtRef.current = Date.now();
          return next;
        });
        // Focus textarea and place cursor at end so the user sees the appended tag line immediately
        setTimeout(() => {
          const el = noteRef.current;
          if (el) {
            el.focus();
            const len = el.value.length;
            el.setSelectionRange(len, len);
          }
        }, 0);
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
      await JournalService.upsertDay({
        date,
        mood_value: mood,
        tags,
        note: note || null,
        morning_reflection: morning || null,
        evening_reflection: evening || null
      });
      setDayUpdatedAt(new Date().toISOString());
      // After saving, add a dotted separator AND start a fresh timestamp stub on a new line
      const now = new Date();
      const stubTime = formatTime(now, language as any, { hour: '2-digit', minute: '2-digit' });
      const sep = '............';
      setNote(prev => {
        const prevText = prev || '';
        const ensureNL = prevText.endsWith('\n') ? prevText : prevText + '\n';
        return `${ensureNL}${sep}\n[${stubTime}] 🕒  | `;
      });
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
              {moodCounts[value] >= 1 && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted/80 border border-border/60">×{moodCounts[value]}</span>
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
            onClick={() => { ensureEndStub(); noteCERef.current?.focus(); }}
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
          contentEditable
          suppressContentEditableWarning
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[96px] overflow-y-auto"
          onFocus={() => { editorFocusedRef.current = true; ensureEndStub(); }}
          onBlur={() => { editorFocusedRef.current = false; }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
            }
          }}
          onInput={(e) => {
            const el = e.currentTarget as HTMLDivElement;
            // Use innerText to get the raw text representation with pipes and tokens
            const raw = el.innerText.replace(/\r\n/g, '\n');
            setNote(raw);
            // Force caret to end to avoid caret inside a chip
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
            const text = e.clipboardData.getData('text/plain').replace(/\r?\n+/g, ' ');
            document.execCommand('insertText', false, text);
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
            const finalEvening = (evening && evening.trim().length > 0) ? evening : (language === 'ar' ? 'المساء مفقود' : 'Evening missing');
            await JournalService.upsertDay({
              date,
              mood_value: mood,
              tags,
              note: note || null,
              morning_reflection: morning || null,
              evening_reflection: finalEvening,
            });
            toast.success(language === 'ar' ? 'تم إنهاء اليوم' : 'Day ended');
            navigate('/journal?tab=timeline');
          } catch (e: any) {
            toast.error(e?.message || 'Error');
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
