import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emitEvent } from "@/utils/eventBus";
import { useLocation } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { JournalService, JournalCheckin } from "@/services/journalService";
import { toast } from "sonner";
import { MoodFace, moodLabels, MoodValue } from "./icons/MoodFaces";
import { TagIcon, TagId } from "@/components/journal/TagIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Undo2, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatTime } from "@/utils/datetime";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/contexts/AuthContext';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const DEFAULT_TAGS: TagId[] = [
  "family","friends","date","exercise","sport","relax","movies","gaming","reading","cleaning",
  "sleep","eat_healthy","shopping","study","work","music","meditation","nature","travel","cooking","walk","socialize","coffee",
  "love","romance","spouse","prayer","writing","horse_riding","fishing"
];
const TOP_5_TAGS: TagId[] = ["exercise", "work", "family", "sleep", "friends"];

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
  const { user: authUser } = useAuth();
  const location = useLocation();
  const { isMobile } = useIsMobile();
  const [date, setDate] = useState(getLocalDayString());
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [tags, setTags] = useState<TagId[]>([]);
  const [note, setNote] = useState("");
  const [morning, setMorning] = useState("");
  const [midday, setMidday] = useState("");
  const [evening, setEvening] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDayEnded, setIsDayEnded] = useState(false);
  // Gratitude state
  const [gratitude1, setGratitude1] = useState("");
  const [gratitude2, setGratitude2] = useState("");
  const [gratitude3, setGratitude3] = useState("");
  const [activeGratitudeTab, setActiveGratitudeTab] = useState(1);
  const [maxGratitudeTab, setMaxGratitudeTab] = useState(1);
  const [displayName, setDisplayName] = useState<string | null>(null);
  // Note editing session control (editor is only typable after Add note)
  const [isNoteEditing, setIsNoteEditing] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const noteCERef = useRef<HTMLDivElement | null>(null);
  const editorFocusedRef = useRef(false);
  const [isCustomOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const eveningRef = useRef<HTMLTextAreaElement | null>(null);
  // Collapsible states for all sections
  const [moodOpen, setMoodOpen] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(true);
  const [gratitudeOpen, setGratitudeOpen] = useState(true);
  const [reflectionTab, setReflectionTab] = useState<'morning' | 'midday' | 'evening'>('morning');
  // Snapshots of last saved values (used for Clear to only clear unsaved changes)
  const [savedMood, setSavedMood] = useState<MoodValue | null>(null);
  const [savedTags, setSavedTags] = useState<TagId[]>([]);
  const [savedNote, setSavedNote] = useState("");
  const [savedMorning, setSavedMorning] = useState("");
  const [savedMidday, setSavedMidday] = useState("");
  const [savedEvening, setSavedEvening] = useState("");
  const [savedGratitude1, setSavedGratitude1] = useState("");
  const [savedGratitude2, setSavedGratitude2] = useState("");
  const [savedGratitude3, setSavedGratitude3] = useState("");
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
  const lastEntryMinuteRef = useRef<number | null>(null);
  const moodTapTimestampsRef = useRef<Record<MoodValue, number[]>>({ 1: [], 2: [], 3: [], 4: [], 5: [] });
  const lastEntryTimeStrRef = useRef<string | null>(null);
  const lastCheckinIdRef = useRef<string | null>(null);
  // Pending (pre-save) mood taps buffer - grouped by timestamp
  const [pendingMoodCounts, setPendingMoodCounts] = useState<Record<MoodValue, number>>({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [pendingActions, setPendingActions] = useState<Record<string, { mood: MoodValue; tags: TagId[] }>>({});
  // In-UI tag tap counters (so tags can have ×N even without a mood tap)
  const [tagTapCounts, setTagTapCounts] = useState<Record<TagId, number>>({} as any);
  // Stub de-duplication
  const lastStubTextRef = useRef<string | null>(null);
  const lastStubAtRef = useRef<number>(0);
  const savingRef = useRef(false);
  const autoSavingRef = useRef(false);
  const dateRef = useRef(date);
  const persistSilentlyRef = useRef<(opts?: { markEnded?: boolean; targetDate?: string }) => Promise<void>>(async () => {});

  // Unsaved detection for controls visibility
  const hasUnsaved = useMemo(() => {
    const tagsChanged = savedTags.join('|') !== tags.join('|');
    return tagsChanged || savedMood !== mood || savedNote !== note || savedMorning !== morning || savedMidday !== midday || savedEvening !== evening ||
           savedGratitude1 !== gratitude1 || savedGratitude2 !== gratitude2 || savedGratitude3 !== gratitude3;
  }, [savedTags, tags, savedMood, mood, savedNote, note, savedMorning, morning, savedMidday, midday, savedEvening, evening,
      savedGratitude1, gratitude1, savedGratitude2, gratitude2, savedGratitude3, gratitude3]);
  const hasPendingActions = useMemo(() => Object.keys(pendingActions).length > 0, [pendingActions]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    dateRef.current = date;
  }, [date]);
  
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

  const getLatestTimestampKey = (text: string) => {
    const lines = (text || '').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i].match(/^\[([^\]]+)\]/);
      if (m?.[1]) return m[1];
    }
    return null;
  };

  const focusNoteEditor = useCallback(() => {
    setTimeout(() => {
      const el = noteCERef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            const pills = el.querySelectorAll('span[data-free-pill="1"]');
            const target = pills.length ? pills[pills.length - 1] : el;
            const range = document.createRange();
            range.selectNodeContents(target);
            range.collapse(false);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          } catch {}
        });
      });
    }, 120);
  }, []);

  const ensureMinuteEntry = useCallback((source: 'add-log' | 'interaction') => {
    const now = new Date();
    const minuteKey = Math.floor(now.getTime() / 60000);
    const timeStr = formatTime(now, language as any, { hour: '2-digit', minute: '2-digit' });
    const noteText = note || '';
    const hasCurrentMinuteLine = noteText.split('\n').some(line => line.startsWith(`[${timeStr}]`));
    const hasAnyNoteEntry = noteText.split('\n').some(line => isTimestampLine(line));
    const latestTimeKey = getLatestTimestampKey(noteText);

    if (source === 'interaction' && hasAnyNoteEntry) {
      if (!latestTimeKey) return { allowed: false, timeStr: null as string | null, created: false };
      lastEntryTimeStrRef.current = latestTimeKey;
      return { allowed: true, timeStr: latestTimeKey, created: false };
    }

    if ((lastEntryMinuteRef.current === minuteKey && lastEntryTimeStrRef.current) || hasCurrentMinuteLine) {
      lastEntryMinuteRef.current = minuteKey;
      lastEntryTimeStrRef.current = timeStr;
      if (source === 'add-log') {
        toast.info(language === 'ar' ? 'يمكن إضافة سجل واحد فقط في كل دقيقة' : 'You can add only one log per minute');
      }
      return { allowed: source !== 'add-log', timeStr, created: false };
    }

    lastEntryMinuteRef.current = minuteKey;
    lastEntryTimeStrRef.current = timeStr;

    const stub = `[${timeStr}] 🕒 | __UNSAVED__`;
    setNote(prev => {
      const prevText = prev || '';
      const lines = prevText.split('\n');
      const exists = lines.some(line => line.startsWith(`[${timeStr}]`));
      if (exists) return prevText;
      const next = prevText && prevText.trim().length > 0 ? `${prevText}\n${stub}` : stub;
      lastStubTextRef.current = stub;
      lastStubAtRef.current = Date.now();
      try { noteCERef.current && (noteCERef.current.innerHTML = renderNoteHtml(next)); } catch {}
      return next;
    });

    return { allowed: true, timeStr, created: true };
  }, [language, note]);

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
    // Focus caret to the free-text pill on next paint
    requestAnimationFrame(() => {
      const el = noteCERef.current;
      if (!el) return;
      try {
        const pills = el.querySelectorAll('span[data-free-pill="1"]');
        const target = pills.length ? pills[pills.length - 1] : null;
        const range = document.createRange();
        const sel = window.getSelection();
        if (target) {
          range.selectNodeContents(target);
          range.collapse(false);
        } else {
          range.selectNodeContents(el);
          range.collapse(false);
        }
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {}
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
        lines.push(`[${t}] 🕒  | __FREE____END__ | `);
        i = lines.length - 1;
      }
      const line = lines[i];
      const bar = line.indexOf('|');
      if (bar < 0) {
        lines[i] = `${line} | __FREE____END__ | `;
      } else {
        const before = line.slice(0, bar);
        const afterBar = line.slice(bar);
        // Extract existing free text from marker
        const markerRe = /__FREE__(.*?)__END__/;
        const match = afterBar.match(markerRe);
        const currentFree = match ? match[1] : '';
        const newFree = transform(currentFree);
        // Replace ONLY the marker content to preserve other chips
        const rebuilt = before + afterBar.replace(markerRe, `__FREE__${newFree}__END__`);
        lines[i] = rebuilt;
      }
      const next = lines.join('\n');
      try { const el = noteCERef.current; if (el) el.innerHTML = renderNoteHtml(next); } catch {}
      return next;
    });
  }, [language, setNote]);

  // Helper: finalize the current free-text into a chip (Add chip button action)

  const finalizeCurrentPill = useCallback(() => {
    setNote(prev => {
      if (!prev) return prev;
      const lines = prev.split('\n');
      let i = lines.length - 1;
      while (i >= 0 && !/^\[[^\]]+\]/.test(lines[i])) i--;
      if (i < 0) return prev;

      let line = lines[i];
      const markerRe = /__FREE__(.*?)__END__/;
      const match = line.match(markerRe);
      const freeText = match ? match[1].trim() : '';

      if (!freeText) return prev;

      // Convert freeText to a token and append it to the chip list
      // We strip the free-text marker and add the text as a permanent chip
      let updated = line.replace(markerRe, '').trim();
      updated = updated.replace(/\s*\|\s*$/, '').trimEnd();
      
      // Ensure the line has the correct structure [time] | chip1 | chip2 | __UNSAVED__
      if (!updated.includes('|')) {
        updated += ' |';
      }
      
      updated += ` | ${freeText} | __UNSAVED__`;
      
      // Add a fresh empty free-text pill at the end for the next entry
      updated = updated.replace(/\s*__UNSAVED__\s*/g, '');
      updated = updated.replace(/\s*\|\s*$/, '').trimEnd() + ' | __FREE____END__ | __UNSAVED__';
      
      lines[i] = updated;
      const next = lines.join('\n');
      try { noteCERef.current && (noteCERef.current.innerHTML = renderNoteHtml(next)); } catch {}
      return next;
    });
    
    // Maintain focus in the new empty pill
    setTimeout(() => {
      const el = noteCERef.current;
      if (!el) return;
      const pills = el.querySelectorAll('span[data-free-pill="1"]');
      const target = pills.length ? pills[pills.length - 1] : el;
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, 50);
  }, [language, setNote]);

  

  const defaultTagSet = useMemo(() => new Set(DEFAULT_TAGS), []);
  const customCount = useMemo(() => customTags.length, [customTags]);

  // Load user and their custom tags from cached profile
  const { profile: _journalProfile } = useUserProfile();
  useEffect(() => {
    const uid = authUser?.id || null;
    setUserId(uid);
    if (!uid || !_journalProfile) {
      setAllTags([ ...DEFAULT_TAGS ]);
      return;
    }
    // Decide preferred name: username > metadata.username > metadata.full_name > display_name (ignore emails)
    const meta = authUser?.user_metadata || {};
    const candidates = [
      _journalProfile.username?.toString().trim(),
      meta.username?.toString().trim(),
      meta.full_name?.toString().trim(),
      _journalProfile.display_name?.toString().trim(),
    ];
    const preferred = candidates.find((n: any) => n && !String(n).includes('@')) || '';
    setDisplayName(preferred || null);
    // Handle custom tags from cached profile
    const rawTags = _journalProfile.custom_tags;
    if (Array.isArray(rawTags)) {
      const cleaned = (rawTags as string[])
        .map(s => (s || '').toString().toLowerCase().replace(/\s+/g,'_'))
        .filter(Boolean) as TagId[];
      // Remove any custom tags that are now default tags
      const validCustomTags = cleaned.filter(t => !defaultTagSet.has(t));
      // Update DB if we filtered any out (write-back only)
      if (validCustomTags.length !== cleaned.length) {
        supabase.from('profiles').update({ custom_tags: validCustomTags }).eq('id', uid);
      }
      setCustomTags(validCustomTags);
      setAllTags([...
        DEFAULT_TAGS,
        ...validCustomTags
      ] as TagId[]);
    } else {
      setAllTags([ ...DEFAULT_TAGS ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_journalProfile]);

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
    love: "حب",
    romance: "رومانسية",
    spouse: "زوج/زوجة",
    prayer: "صلاة",
    writing: "كتابة",
    horse_riding: "ركوب الخيل",
    fishing: "صيد السمك",
  };

  // Render note with chips inside a contentEditable div. Chips are the tokens after the first '|'
  // Each timestamp line is wrapped in its own outer pill
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
      // Deduplicate tokens within a single check-in
      const tokens = Array.from(new Set(tokensRaw.filter(Boolean)));
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
          chips += `<span class="sr-only"> | </span><span contenteditable="false" class="pointer-events-none select-none inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5">${safe}</span> `;
        });
      });
      const placeholder = language === 'ar' ? 'اكتب هنا...' : 'Type here...';
      const hasChips = tokens.length > 0;
      const free = noteFreeText
        ? `<span class="sr-only"> | </span><span data-free-pill="1" contenteditable="true" class="inline-flex items-center gap-1 rounded-full border-2 border-blue-400 bg-blue-50 dark:bg-blue-900/40 text-slate-900 dark:text-slate-100 px-3 py-1 ring-2 ring-blue-300 dark:ring-blue-500 font-medium">${esc(noteFreeText)}</span> `
        : (hasChips 
            ? `<span class="sr-only"> | </span><span data-free-pill="1" contenteditable="true" class="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 text-primary/60 px-3 py-1 opacity-50"></span> `
            : `<span class="sr-only"> | </span><span data-free-pill="1" contenteditable="true" class="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-400 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-3 py-1 italic">${placeholder}</span> `
          );
      const innerContent = `${before}${chips}${free}`;
      // ALWAYS wrap timestamp lines in outer pill (whether saved or unsaved)
      const hasTimestamp = /^\[/.test(rawLine.trim());
      if (hasTimestamp) {
        htmlLines.push(`<div class="my-2 p-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-800">${innerContent}</div>`);
      } else {
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
            const sel = window.getSelection();
            const pills = el.querySelectorAll('[data-free-pill="1"]');
            const target = pills.length ? pills[pills.length - 1] : null;
            if (target) {
              range.selectNodeContents(target);
              range.collapse(false);
            } else {
              range.selectNodeContents(el);
              range.collapse(false);
            }
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
        cooking: '🍳', walk: '🚶', socialize: '🗣️', coffee: '☕', love: '❤️', romance: '💕', spouse: '💑', prayer: '🙏', writing: '✍️'
      };
      // Smart icon matching for custom tags
      const getIcon = (tagId: string): string => {
        if (tagEmoji[tagId]) return tagEmoji[tagId]!;
        const lower = tagId.toLowerCase().replace(/_/g, ' ');
        if (lower.includes("wife")) return "👰";
        if (lower.includes("husband")) return "🤵";
        if (lower.includes("partner")) return "💑";
        if (lower.includes("kid") || lower.includes("child")) return "👶";
        if (lower.includes("pet") || lower.includes("dog")) return "🐕";
        if (lower.includes("cat")) return "🐈";
        if (lower.includes("gym") || lower.includes("workout")) return "💪";
        if (lower.includes("run") || lower.includes("jog")) return "🏃";
        if (lower.includes("bike") || lower.includes("cycl")) return "🚴";
        if (lower.includes("swim")) return "🏊";
        if (lower.includes("yoga")) return "🧘";
        if (lower.includes("car") || lower.includes("drive")) return "🚗";
        if (lower.includes("food") || lower.includes("eat")) return "🍽️";
        if (lower.includes("code") || lower.includes("program") || lower.includes("coding")) return "💻";
        if (lower.includes("write")) return "✍️";
        return "🏷️";
      };
      const icon = getIcon(tag);
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
    // Clear mood/tags/morning/evening/gratitude selections
    setMood(savedMood);
    setTags([...savedTags]);
    setMorning(savedMorning);
    setMidday(savedMidday);
    setEvening(savedEvening);
    setGratitude1(savedGratitude1);
    setGratitude2(savedGratitude2);
    setGratitude3(savedGratitude3);
    setActiveGratitudeTab(1);
    const savedMaxTab = savedGratitude3 ? 3 : savedGratitude2 ? 2 : 1;
    setMaxGratitudeTab(savedMaxTab);
    setTagTapCounts({} as any);
    lastEntryMinuteRef.current = null;
    lastCheckinIdRef.current = null;
    // Clear pending buffers
    setPendingActions({});
    setPendingMoodCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    moodTapTimestampsRef.current = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    lastEntryTimeStrRef.current = null;
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

  const persistSilently = useCallback(async (opts?: { markEnded?: boolean; targetDate?: string }) => {
    if (autoSavingRef.current || savingRef.current) return;

    const targetDate = opts?.targetDate || dateRef.current;
    const isCurrentDate = targetDate === dateRef.current;
    const markEnded = Boolean(opts?.markEnded);
    const hasAnyContent = Boolean(
      mood ||
      (tags && tags.length > 0) ||
      (note && note.trim().length > 0) ||
      (morning && morning.trim().length > 0) ||
      (midday && midday.trim().length > 0) ||
      (evening && evening.trim().length > 0) ||
      (gratitude1 && gratitude1.trim().length > 0) ||
      (gratitude2 && gratitude2.trim().length > 0) ||
      (gratitude3 && gratitude3.trim().length > 0)
    );

    if (isCurrentDate && !hasUnsaved && !hasPendingActions && !markEnded) return;
    if (markEnded && !hasAnyContent && !hasPendingActions) return;

    autoSavingRef.current = true;
    try {
      let cleanNote = (note || '').replace(/__FREE__(.*?)__END__/g, '$1');
      cleanNote = cleanNote.replace(/\s*__UNSAVED__\s*/g, '');

      await JournalService.upsertDay({
        date: targetDate,
        mood_value: mood,
        tags,
        note: cleanNote || null,
        morning_reflection: morning || null,
        midday_reflection: midday || null,
        evening_reflection: evening || null,
        gratitude_1: gratitude1 || null,
        gratitude_2: gratitude2 || null,
        gratitude_3: gratitude3 || null,
        is_ended: markEnded ? true : isDayEnded,
      });

      const timestamps = Object.keys(pendingActions);
      for (const timeStr of timestamps) {
        const action = pendingActions[timeStr];
        await JournalService.addCheckin({
          date: targetDate,
          mood_value: action.mood,
          tags: action.tags,
          note: null,
        });
      }

      if (isCurrentDate) {
        const refreshed = await JournalService.getCheckinsForDay(targetDate);
        setCheckins(refreshed);
        setPendingActions({});
        setPendingMoodCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
        moodTapTimestampsRef.current = { 1: [], 2: [], 3: [], 4: [], 5: [] };
        lastEntryTimeStrRef.current = null;
        setDayUpdatedAt(new Date().toISOString());
        setSavedMood(mood);
        setSavedTags(tags);
        setSavedNote(cleanNote || '');
        setSavedMorning(morning);
        setSavedMidday(midday);
        setSavedEvening(evening);
        setSavedGratitude1(gratitude1);
        setSavedGratitude2(gratitude2);
        setSavedGratitude3(gratitude3);
        if (markEnded) setIsDayEnded(true);
      }
    } catch (e) {
      console.error('Silent journal save failed:', e);
    } finally {
      autoSavingRef.current = false;
    }
  }, [evening, gratitude1, gratitude2, gratitude3, hasPendingActions, hasUnsaved, isDayEnded, midday, mood, morning, note, pendingActions, tags]);

  useEffect(() => {
    persistSilentlyRef.current = persistSilently;
  }, [persistSilently]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void persistSilentlyRef.current();
        return;
      }
      const today = getLocalDayString();
      const currentDate = dateRef.current;
      if (today !== currentDate) {
        void persistSilentlyRef.current({ markEnded: true, targetDate: currentDate }).finally(() => {
          setDate(today);
        });
      }
    };

    const onPageHide = () => {
      void persistSilentlyRef.current();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const today = getLocalDayString();
      const currentDate = dateRef.current;
      if (today !== currentDate) {
        void persistSilentlyRef.current({ markEnded: true, targetDate: currentDate }).finally(() => {
          setDate(today);
        });
      }
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      void persistSilentlyRef.current();
    };
  }, []);

  // Load today's saved entry on mount and when date changes
  useEffect(() => {
    // Immediately clear transient state to avoid showing stale xN while loading
    setCheckins([]);
    setPendingActions({});
    setPendingMoodCounts({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    moodTapTimestampsRef.current = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    lastEntryTimeStrRef.current = null;
    setTagTapCounts({} as any);
    (async () => {
      try {
        const d = await JournalService.getDay(date);
        if (d) {
          const dayEnded = Boolean(d.is_ended);
          setIsDayEnded(dayEnded);
          // Load current state into form (editable even after End Day)
          setMood((d.mood_value as MoodValue) ?? null);
          setTags(Array.isArray(d.tags) ? d.tags : []);
          setNote(d.note || "");
          setMorning(d.morning_reflection || "");
          setMidday(d.midday_reflection || "");
          setEvening(d.evening_reflection || "");
          setGratitude1(d.gratitude_1 || "");
          setGratitude2(d.gratitude_2 || "");
          setGratitude3(d.gratitude_3 || "");
          const maxTab = d.gratitude_3 ? 3 : d.gratitude_2 ? 2 : 1;
          setMaxGratitudeTab(maxTab);
          setActiveGratitudeTab(1);
          setDayUpdatedAt(d.updated_at || null);
          // Initialize saved snapshots from loaded day
          setSavedMood((d.mood_value as MoodValue) ?? null);
          setSavedTags(Array.isArray(d.tags) ? d.tags : []);
          setSavedNote(d.note || "");
          setSavedMorning(d.morning_reflection || "");
          setSavedMidday(d.midday_reflection || "");
          setSavedEvening(d.evening_reflection || "");
          setSavedGratitude1(d.gratitude_1 || "");
          setSavedGratitude2(d.gratitude_2 || "");
          setSavedGratitude3(d.gratitude_3 || "");
        } else {
          setIsDayEnded(false);
          setMood(null);
          setTags([]);
          setNote("");
          setMorning("");
          setMidday("");
          setEvening("");
          setGratitude1("");
          setGratitude2("");
          setGratitude3("");
          setActiveGratitudeTab(1);
          setMaxGratitudeTab(1);
          setDayUpdatedAt(null);
          setSavedMood(null);
          setSavedTags([]);
          setSavedNote("");
          setSavedMorning("");
          setSavedMidday("");
          setSavedEvening("");
          setSavedGratitude1("");
          setSavedGratitude2("");
          setSavedGratitude3("");
          requestAnimationFrame(() => {
            if (noteCERef.current) noteCERef.current.innerHTML = "";
          });
        }
        // Always load check-ins so user can see/edit daily log entries
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
      const entry = ensureMinuteEntry('interaction');
      if (!entry.allowed || !entry.timeStr) return;
      const timeStr = entry.timeStr;

      const previousMood = pendingActions[timeStr]?.mood;
      if (!previousMood) {
        setPendingMoodCounts(prev => ({ ...prev, [value]: (prev[value] || 0) + 1 }));
      } else if (previousMood !== value) {
        setPendingMoodCounts(prev => ({
          ...prev,
          [previousMood]: Math.max(0, (prev[previousMood] || 0) - 1),
          [value]: (prev[value] || 0) + 1,
        }));
      }

      setPendingActions(prev => {
        const next = { ...prev };
        if (!next[timeStr]) {
          next[timeStr] = { mood: value, tags: [] };
        } else {
          next[timeStr].mood = value;
        }
        return next;
      });

      const emoji: Record<MoodValue, string> = { 1: '😖', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };
      setNote(prev => {
        const prevText = prev || '';
        const lines = prevText.split('\n');
        let existingLineIdx = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].startsWith(`[${timeStr}]`)) {
            existingLineIdx = i;
            break;
          }
        }

        const moodTokenRe = /^(😖|🙁|😐|🙂|😄)(?:\s*×\d+)?$/;

        if (existingLineIdx >= 0) {
          let line = lines[existingLineIdx].replace(/\s*__UNSAVED__\s*/g, '');
          const freeMatch = line.match(/__FREE__(.*?)__END__/);
          const freeText = freeMatch ? freeMatch[0] : '';
          if (freeText) {
            line = line.replace(/__FREE__.*?__END__/, '').replace(/\s*\|\s*\|\s*/g, ' | ').trim();
          }

          const parts = line.split('|').map(p => p.trim()).filter(Boolean);
          const head = parts.shift() || `[${timeStr}] 🕒`;
          const tokens = parts.filter(token => !moodTokenRe.test(token));
          tokens.unshift(emoji[value]);

          let rebuilt = `${head} | ${tokens.join(' | ')}`;
          if (freeText) rebuilt += ` | ${freeText}`;
          rebuilt += ' | __UNSAVED__';

          lines[existingLineIdx] = rebuilt;
          const next = lines.join('\n');
          try { noteCERef.current && (noteCERef.current.innerHTML = renderNoteHtml(next)); } catch {}
          return next;
        }

        if (!entry.created) return prevText;
        const stub = `[${timeStr}] 🕒 | ${emoji[value]} | __UNSAVED__`;
        const next = prevText && prevText.trim().length > 0 ? `${prevText}\n${stub}` : stub;
        lastStubTextRef.current = stub;
        lastStubAtRef.current = Date.now();
        try { noteCERef.current && (noteCERef.current.innerHTML = renderNoteHtml(next)); } catch {}
        return next;
      });

      setNotesOpen(true);
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
    const wasSelected = tags.includes(tag);
    const entry = !wasSelected
      ? ensureMinuteEntry('interaction')
      : { allowed: true, timeStr: lastEntryTimeStrRef.current || getLatestTimestampKey(note || ''), created: false };
    const groupKey = entry.timeStr || formatTime(new Date(), language as any, { hour: '2-digit', minute: '2-digit' });

    setTags(prev => {
      const on = prev.includes(tag);
      if (!on && !entry.allowed) return prev;
      if (!on) {
        setNotesOpen(true);
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
        cooking: '🍳', walk: '🚶', socialize: '🗣️', coffee: '☕', love: '❤️', romance: '💕', spouse: '💑', prayer: '🙏', writing: '✍️'
      };
      const label = (language === 'ar' ? (arTagLabels[tag] || tag.replace('_',' ')) : tag.replace('_',' '));
      // Smart icon matching for custom tags
      const getIcon = (tagId: string): string => {
        if (tagEmoji[tagId]) return tagEmoji[tagId]!;
        const lower = tagId.toLowerCase().replace(/_/g, ' ');
        if (lower.includes("wife")) return "👰";
        if (lower.includes("husband")) return "🤵";
        if (lower.includes("partner")) return "💑";
        if (lower.includes("kid") || lower.includes("child")) return "👶";
        if (lower.includes("pet") || lower.includes("dog")) return "🐕";
        if (lower.includes("cat")) return "🐈";
        if (lower.includes("gym") || lower.includes("workout")) return "💪";
        if (lower.includes("run") || lower.includes("jog")) return "🏃";
        if (lower.includes("bike") || lower.includes("cycl")) return "🚴";
        if (lower.includes("swim")) return "🏊";
        if (lower.includes("yoga")) return "🧘";
        if (lower.includes("car") || lower.includes("drive")) return "🚗";
        if (lower.includes("food") || lower.includes("eat")) return "🍽️";
        if (lower.includes("code") || lower.includes("program") || lower.includes("coding")) return "💻";
        if (lower.includes("write")) return "✍️";
        return "🏷️";
      };
      const icon = getIcon(tag);
      const token = `${icon} ${label}`;
      if (!on) {
        // Add tag to pending actions for this timestamp
        setPendingActions(prev => {
          const next = { ...prev };
          if (!next[groupKey]) {
            next[groupKey] = { mood: mood || 4, tags: [tag] };
          } else {
            if (!next[groupKey].tags.includes(tag)) {
              next[groupKey].tags = [...next[groupKey].tags, tag];
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
            if (lines[i].startsWith(`[${groupKey}]`)) {
              existingLineIdx = i;
              break;
            }
          }
          
          if (existingLineIdx >= 0) {
            // Append to existing line for this timestamp
            let line = lines[existingLineIdx];
            // Remove __UNSAVED__ temporarily
            line = line.replace(/\s*__UNSAVED__\s*/g, '');
            // Extract free text if present to preserve it
            const freeMatch = line.match(/__FREE__(.*?)__END__/);
            const freeText = freeMatch ? freeMatch[0] : '';
            // Remove free text temporarily
            if (freeText) {
              line = line.replace(/__FREE__.*?__END__/, '').replace(/\s*\|\s*\|\s*/g, ' | ').trim();
            }
            // Add the new token, then restore free text, then add __UNSAVED__
            line = line.replace(/\s*\|\s*$/, '').trimEnd() + ` | ${token}`;
            if (freeText) {
              line += ` | ${freeText}`;
            }
            line += ' | __UNSAVED__';
            lines[existingLineIdx] = line;
            const next = lines.join('\n');
            try { noteCERef.current && (noteCERef.current.innerHTML = renderNoteHtml(next)); } catch {}
            return next;
          } else {
            if (!entry.created) return prevVal;
            const stub = `[${groupKey}] 🕒 | ${token} | __UNSAVED__`;
            const next = prevVal && prevVal.trim().length > 0 ? `${prevVal}\n${stub}` : stub;
            lastStubTextRef.current = stub;
            lastStubAtRef.current = Date.now();
            try { noteCERef.current && (noteCERef.current.innerHTML = renderNoteHtml(next)); } catch {}
            return next;
          }
        });
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
    // Enforce single-word validation
    if (/\s/.test(raw)) {
      toast.error(language === 'ar' ? 'الوسوم المخصصة يجب أن تكون كلمة واحدة فقط' : 'Custom tags must be a single word');
      return;
    }
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
        midday_reflection: midday || null,
        evening_reflection: evening || null,
        gratitude_1: gratitude1 || null,
        gratitude_2: gratitude2 || null,
        gratitude_3: gratitude3 || null,
        is_ended: isDayEnded,
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
      moodTapTimestampsRef.current = { 1: [], 2: [], 3: [], 4: [], 5: [] };
      lastEntryTimeStrRef.current = null;
      setDayUpdatedAt(new Date().toISOString());
      // Do not insert separators after save; end editing session
      setIsNoteEditing(false);
      // Update saved snapshots to current saved state
      setSavedMood(mood);
      setSavedTags(tags);
      setSavedMorning(morning);
      setSavedMidday(midday);
      setSavedEvening(evening);
      setSavedGratitude1(gratitude1);
      setSavedGratitude2(gratitude2);
      setSavedGratitude3(gratitude3);
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
    } catch (e: any) {
      toast.error(e?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const renderTagButton = (tag: TagId) => (
    <div key={tag + ':' + customVersion} className="flex flex-col items-center w-full">
      <button
        onClick={() => toggleTag(tag)}
        aria-pressed={tags.includes(tag)}
        className={`group relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 h-[68px] w-full transition-all cursor-pointer select-none focus:outline-none border border-border bg-card hover:-translate-y-[1px] ${tags.includes(tag) ? 'border-primary bg-primary/5' : ''}`}
      >
        {!defaultTagSet.has(tag) && (
          <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-amber-500/90 text-white flex items-center justify-center text-[9px] font-bold border border-amber-600/50">
            ★
          </div>
        )}
        {!defaultTagSet.has(tag) && (
          <div
            role="button"
            aria-label={language === 'ar' ? 'حذف الوسم' : 'Delete tag'}
            className="absolute top-1 left-1 h-5 w-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center text-[10px] border border-destructive/50"
            onClick={(e) => { e.stopPropagation(); removeCustomTag(tag); }}
            title={language === 'ar' ? 'حذف' : 'Delete'}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeCustomTag(tag); } }}
          >
            ×
          </div>
        )}
        <div
          className={`h-7 w-7 rounded-full flex items-center justify-center bg-gradient-to-br from-white/70 to-muted ${tags.includes(tag) ? 'text-primary' : (tagColor[tag] || 'text-muted-foreground')}`}
        >
          <TagIcon id={tag} className="h-5 w-5" />
        </div>
        <span className="text-[10px] leading-none opacity-80">{language === 'ar' ? (arTagLabels[tag] || tag.replace('_',' ')) : tag.replace('_',' ')}</span>
      </button>
    </div>
  );

  const topTags = TOP_5_TAGS.filter(t => allTags.includes(t));
  const restTags = allTags.filter(t => !TOP_5_TAGS.includes(t));

  // Format today's date for display: "Today, 15th June 2026"
  const formattedDate = (() => {
    const d = new Date();
    const day = d.getDate();
    const suffix = (() => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    })();
    const month = d.toLocaleDateString('en-GB', { month: 'long' });
    const year = d.getFullYear();
    const prefix = language === 'ar' ? 'اليوم' : 'Today';
    return `${prefix}, ${day}${suffix} ${month} ${year}`;
  })();

  return (
    <div className="space-y-4">
      {/* Today's date header */}
      <div className="text-center">
        <span className="text-sm font-medium text-muted-foreground tracking-wide">
          {formattedDate}
        </span>
      </div>

      {/* Reflections: Morning / Mid-day / Evening tabs */}
      <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-600 bg-gradient-to-b from-card to-background p-4 relative">
        {saving && <div className="reveal-wipe" />}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            {language === 'ar' ? 'التأملات' : 'Reflections'}
          </div>
        </div>
        {/* Tab buttons */}
        <div className="flex gap-1 mb-3">
          {(['morning', 'midday', 'evening'] as const).map((tab) => {
            const tabLabels: Record<string, { en: string; ar: string }> = {
              morning: { en: 'Morning', ar: 'الصباح' },
              midday: { en: 'Mid-day', ar: 'النهار' },
              evening: { en: 'Evening', ar: 'المساء' },
            };
            const active = reflectionTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setReflectionTab(tab)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                {language === 'ar' ? tabLabels[tab].ar : tabLabels[tab].en}
              </button>
            );
          })}
        </div>
        {/* Tab content */}
        {reflectionTab === 'morning' && (
          <Textarea value={morning} onChange={e => setMorning(e.target.value)} placeholder={language === 'ar' ? 'ما الأهم اليوم؟' : "What matters most today?"} />
        )}
        {reflectionTab === 'midday' && (
          <Textarea value={midday} onChange={e => setMidday(e.target.value)} placeholder={language === 'ar' ? 'كيف يسير يومك حتى الآن؟' : "How is your day going so far?"} />
        )}
        {reflectionTab === 'evening' && (
          <Textarea ref={eveningRef} value={evening} onChange={e => setEvening(e.target.value)} placeholder={language === 'ar' ? 'أفضل لحظة؟ ماذا تعلمت؟' : 'Best moment? What did you learn?'} />
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

      {/* Daily Check-in Section */}
      <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-600 bg-gradient-to-b from-card to-background p-4">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400 inline-block" />
            <span className="text-sm font-semibold text-foreground/90">
              {language === 'ar' ? 'سجل اليوم' : 'Daily Log'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const entry = ensureMinuteEntry('add-log');
              if (!entry.allowed) return;
              setNotesOpen(true);
              setIsNoteEditing(true);
              ensureEndStub();
              focusNoteEditor();
            }}
            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border-0 bg-[#060541] text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[#f2f2f2] dark:text-[#0c0f14]"
          >
            <Plus className="h-3.5 w-3.5" /> {language === 'ar' ? 'أضف سجل' : 'Add Log'}
          </button>
        </div>
        <div className="space-y-3">
      <Collapsible open={moodOpen} onOpenChange={setMoodOpen}>
        <div className="rounded-2xl border border-slate-300 dark:border-slate-600 bg-gradient-to-b from-card/60 to-background/60 p-4">
          <CollapsibleTrigger asChild className="w-full">
            <div className="text-sm text-muted-foreground mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                {language === 'ar' ? 'المزاج' : 'Mood'}
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${moodOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
        <div className={`grid grid-cols-5 ${isMobile ? 'gap-5' : 'gap-6'} items-start`}>
          {faces.map(({ value, color }) => (
            <div key={value} className="flex flex-col items-center">
              <button
                onClick={() => { setMood(value); addQuickCheckin(value); }}
                aria-pressed={mood === value}
                className={`group relative flex flex-col items-center gap-1 rounded-2xl ${isMobile ? 'px-2 py-2' : 'px-3 py-3'} transition-all cursor-pointer select-none focus:outline-none
                border border-border bg-card hover:-translate-y-[1px]
                ${mood === value ? 'border-primary bg-card' : ''}`}
              >
                <MoodFace value={value} active={mood === value} size={isMobile ? 44 : 56} className="transition-transform duration-150 group-hover:scale-[1.03]" />
                <span className={`text-xs ${color}`}>{language === 'ar' ? moodAr[value] : moodLabels[value]}</span>
              </button>
            </div>
          ))}
        </div>
        </CollapsibleContent>
      </div>
      </Collapsible>

      <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
        <div className="rounded-2xl border border-slate-300 dark:border-slate-600 bg-gradient-to-b from-card/60 to-background/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <CollapsibleTrigger asChild>
              <div className="text-sm text-muted-foreground flex items-center gap-2 cursor-pointer select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
                {language === 'ar' ? 'ملاحظة' : 'Note'}
                <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${notesOpen ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {dayUpdatedAt && (
                <span className="text-[10px] text-muted-foreground">
                  {formatTime(new Date(dayUpdatedAt), language as any, { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {isNoteEditing && (
                <button
                  type="button"
                  onClick={finalizeCurrentPill}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-primary/30 bg-primary/10 text-primary font-medium hover:-translate-y-0.5 active:translate-y-0 transition-all focus-visible:outline-none"
                >
                  <Plus className="h-3.5 w-3.5" /> {language === 'ar' ? 'أضف كشريحة' : 'Add chip'}
                </button>
              )}
              {hasUnsaved && (
                <button
                  type="button"
                  onClick={clearSelections}
                  aria-label={language === 'ar' ? 'مسح التغييرات غير المحفوظة' : 'Clear unsaved changes'}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border bg-gradient-to-b from-muted to-background text-muted-foreground hover:-translate-y-0.5 active:translate-y-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {language === 'ar' ? 'مسح' : 'Clear'}
                </button>
              )}
            </div>
          </div>
          <CollapsibleContent>
            <div
              ref={noteCERef}
              className={`flex flex-col gap-2 w-full rounded-md px-3 py-2 text-sm overflow-y-auto focus-visible:outline-none transition-all ${
                isNoteEditing || (note && note.trim())
                  ? 'min-h-[96px] border-2 border-primary bg-primary/5'
                  : 'min-h-0 border-0 bg-transparent'
              }`}
              tabIndex={0}
              role="textbox"
              aria-multiline="true"
              contentEditable
              spellCheck={false}
              onFocus={() => {
                editorFocusedRef.current = true;
                // Auto-start editing on focus so users can type immediately
                if (!isNoteEditing) setIsNoteEditing(true);
                ensureEndStub();
                // After DOM updates, place caret inside the free pill so the cursor is visible
                setTimeout(() => {
                  const el = noteCERef.current; if (!el) return;
                  el.focus();
                  requestAnimationFrame(() => {
                    try {
                      const pills = el.querySelectorAll('span[data-free-pill="1"]');
                      const target = pills.length ? pills[pills.length - 1] : el;
                      const range = document.createRange();
                      range.selectNodeContents(target);
                      range.collapse(false);
                      const sel = window.getSelection();
                      sel?.removeAllRanges();
                      sel?.addRange(range);
                    } catch {}
                  });
                }, 50);
              }}
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
                // Turn on edit mode and place caret in the free pill automatically
                try {
                  e.preventDefault();
                  if (!isNoteEditing) setIsNoteEditing(true);
                  ensureEndStub();
                  const el = noteCERef.current;
                  if (!el) return;
                  const range = document.createRange();
                  const pills = el.querySelectorAll('span[data-free-pill="1"]');
                  const target = pills.length ? pills[pills.length - 1] : el;
                  range.selectNodeContents(target);
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
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Tags section: top 5 always visible, rest expandable */}
      <div className="rounded-2xl border border-slate-300 dark:border-slate-600 bg-gradient-to-b from-card/60 to-background/60 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            <span className="text-sm text-muted-foreground">{language === 'ar' ? 'الوسوم' : 'Tags'}</span>
          </div>
          <button
            type="button"
            onClick={() => setTagsOpen(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>{tagsOpen ? (language === 'ar' ? 'إخفاء' : 'Hide') : (language === 'ar' ? 'المزيد' : 'More')}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${tagsOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Top 5 tags — always visible */}
        <div className="grid grid-cols-5 gap-2 items-start">
          {topTags.map(renderTagButton)}
        </div>

        {/* Rest of tags — expandable */}
        {tagsOpen && (
          <div className="grid [grid-template-columns:repeat(auto-fit,_minmax(104px,_1fr))] gap-2 items-start pt-3 mt-2 border-t border-border/30">
            {restTags.map(renderTagButton)}
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
        )}
      </div>
        </div>
      </div>

      {/* Gratitude Section */}
      <Collapsible open={gratitudeOpen} onOpenChange={setGratitudeOpen}>
        <div className="rounded-2xl border-2 border-slate-300 dark:border-slate-600 bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-card dark:from-purple-950/20 dark:via-pink-950/20 dark:to-card p-5 backdrop-blur-sm">
          <CollapsibleTrigger asChild className="w-full">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                  <span className="text-2xl">🙏</span>
                </div>
                <div className="text-left">
                  <h3 className="text-base font-semibold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                    {language === 'ar' ? 'الامتنان' : 'Being Grateful'}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-muted-foreground">
                      {language === 'ar' ? 'اذكر ثلاثة أشياء تشعر بالامتنان لها' : 'List three things you\'re grateful for'}
                    </p>
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">✨</span>
                  </div>
                  <p className="text-xs text-purple-600/80 dark:text-purple-400/80 font-medium mt-0.5">
                    {language === 'ar' ? 'الامتنان مجزٍ' : 'Being grateful is rewarding'}
                  </p>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${gratitudeOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="mt-2">
              {!displayName && (
                <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-2 mb-3">
                  {language === 'ar' ? '💡 أضف اسم المستخدم في ' : '💡 Add your username in '}
                  <a href="/account" className="underline font-medium hover:text-amber-700 dark:hover:text-amber-300">
                    {language === 'ar' ? 'صفحة الحساب' : 'Account page'}
                  </a>
                  {language === 'ar' ? ' لتخصيص هذا القسم' : ' to personalize this section'}
                </div>
              )}

              {/* Gratitude Tabs */}
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3].filter(n => n <= maxGratitudeTab).map((tabNum) => {
                  const active = activeGratitudeTab === tabNum;
                  const emojis: Record<number, string> = { 1: '✨', 2: '💖', 3: '🌟' };
                  return (
                    <button
                      key={tabNum}
                      type="button"
                      onClick={() => setActiveGratitudeTab(tabNum)}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span>{emojis[tabNum]}</span>
                      <span>{tabNum}</span>
                    </button>
                  );
                })}
                {maxGratitudeTab < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = maxGratitudeTab + 1;
                      setMaxGratitudeTab(next);
                      setActiveGratitudeTab(next);
                    }}
                    className="flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium bg-muted/60 text-muted-foreground hover:bg-muted transition-all"
                    title={language === 'ar' ? 'أضف المزيد' : 'Add more'}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Gratitude Tab Content */}
              {activeGratitudeTab === 1 && (
                <div className="animate-fade-in">
                  <label className="text-sm font-semibold mb-2 block bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 dark:from-purple-400 dark:via-purple-300 dark:to-pink-400 bg-clip-text text-transparent">
                    {language === 'ar'
                      ? (
                        <span className="block">
                          <span className="block">✨ <span dir="ltr">{displayName || '[اسم المستخدم]'}</span></span>
                          <span className="block">ممتن لـ</span>
                        </span>
                      )
                      : `✨ ${displayName || '[username]'} is grateful for`}
                  </label>
                  <Input
                    value={gratitude1}
                    onChange={(e) => setGratitude1(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب هنا...' : 'Type here...'}
                    maxLength={100}
                    className="bg-gradient-to-r from-purple-50/80 to-pink-50/80 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-300 dark:border-purple-700/50 focus:border-purple-500 dark:focus:border-purple-500 text-sm transition-all"
                  />
                </div>
              )}
              {activeGratitudeTab === 2 && (
                <div className="animate-fade-in">
                  <label className="text-sm font-semibold mb-2 block bg-gradient-to-r from-pink-600 via-rose-500 to-purple-500 dark:from-pink-400 dark:via-rose-300 dark:to-purple-400 bg-clip-text text-transparent">
                    {language === 'ar'
                      ? (
                        <span className="block">
                          <span className="block">💖 <span dir="ltr">{displayName || '[اسم المستخدم]'}</span></span>
                          <span className="block">ممتن لـ</span>
                        </span>
                      )
                      : `💖 ${displayName || '[username]'} is grateful for`}
                  </label>
                  <Input
                    value={gratitude2}
                    onChange={(e) => setGratitude2(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب هنا...' : 'Type here...'}
                    maxLength={100}
                    className="bg-gradient-to-r from-pink-50/80 to-rose-50/80 dark:from-pink-950/30 dark:to-rose-950/30 border-pink-300 dark:border-pink-700/50 focus:border-pink-500 dark:focus:border-pink-500 text-sm transition-all"
                  />
                </div>
              )}
              {activeGratitudeTab === 3 && (
                <div className="animate-fade-in">
                  <label className="text-sm font-semibold mb-2 block bg-gradient-to-r from-purple-600 via-indigo-500 to-blue-500 dark:from-purple-400 dark:via-indigo-300 dark:to-blue-400 bg-clip-text text-transparent">
                    {language === 'ar'
                      ? (
                        <span className="block">
                          <span className="block">🌟 <span dir="ltr">{displayName || '[اسم المستخدم]'}</span></span>
                          <span className="block">ممتن لـ</span>
                        </span>
                      )
                      : `🌟 ${displayName || '[username]'} is grateful for`}
                  </label>
                  <Input
                    value={gratitude3}
                    onChange={(e) => setGratitude3(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب هنا...' : 'Type here...'}
                    maxLength={100}
                    className="bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-300 dark:border-purple-700/50 focus:border-indigo-500 dark:focus:border-indigo-500 text-sm transition-all"
                  />
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

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
            const finalEvening = (evening && evening.trim().length > 0) ? evening : null;
            
            // Save main day entry
            await JournalService.upsertDay({
              date,
              mood_value: mood,
              tags,
              note: cleanNote || null,
              morning_reflection: morning || null,
              midday_reflection: midday || null,
              evening_reflection: finalEvening,
              gratitude_1: gratitude1 || null,
              gratitude_2: gratitude2 || null,
              gratitude_3: gratitude3 || null,
              is_ended: true,
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
            moodTapTimestampsRef.current = { 1: [], 2: [], 3: [], 4: [], 5: [] };
            lastEntryTimeStrRef.current = null;

            // Update saved snapshots
            setSavedMood(mood);
            setSavedTags(tags);
            setSavedNote(cleanNote || "");
            setSavedMorning(morning);
            setSavedMidday(midday);
            setSavedEvening(finalEvening);
            setSavedGratitude1(gratitude1);
            setSavedGratitude2(gratitude2);
            setSavedGratitude3(gratitude3);
            
            setIsDayEnded(true);
            toast.success(language === 'ar' ? 'تم إنهاء اليوم وحفظه' : 'Day ended and saved');
            emitEvent('refreshTimeline');
          } catch (e: any) {
            console.error('End Day error:', e);
            toast.error(e?.message || 'Failed to end day');
          } finally {
            setSaving(false);
          }
        }}>
          {isDayEnded
            ? (language === 'ar' ? 'تحديث اليوم' : 'Update Day')
            : (language === 'ar' ? 'إنهاء اليوم' : 'End Day')}
        </Button>
      </div>

      {/* Custom Tag Dialog */}
      <Dialog open={isCustomOpen} onOpenChange={setCustomOpen}>
        <DialogContent
          title={language === 'ar' ? 'إضافة وسم مخصص' : 'Add custom tag'}
          description={language === 'ar' ? 'أدخل وسمًا جديدًا لإضافته إلى قائمتك.' : 'Enter a new tag to add it to your list.'}
        >
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
