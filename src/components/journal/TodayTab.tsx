import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Plus } from "lucide-react";

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
  const [date] = useState(getLocalDayString());
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [tags, setTags] = useState<TagId[]>([]);
  const [note, setNote] = useState("");
  const [morning, setMorning] = useState("");
  const [evening, setEvening] = useState("");
  const [saving, setSaving] = useState(false);
  const [isCustomOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const eveningRef = useRef<HTMLTextAreaElement | null>(null);
  const [eveningOpen, setEveningOpen] = useState(false);
  const [morningOpen, setMorningOpen] = useState(true);
  // Check-ins state
  const [checkins, setCheckins] = useState<JournalCheckin[]>([]);
  const [checkinMood, setCheckinMood] = useState<MoodValue | null>(null);
  const [checkinTags, setCheckinTags] = useState<TagId[]>([]);
  const [checkinNote, setCheckinNote] = useState("");
  const checkinSectionRef = useRef<HTMLDivElement | null>(null);
  const checkinNoteRef = useRef<HTMLTextAreaElement | null>(null);
  

  const tagList = useMemo(() => DEFAULT_TAGS, []);

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

  // Frequency counters for today
  const moodCounts = useMemo(() => {
    const counts: Record<MoodValue, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (mood) counts[mood] += 1; // base mood
    for (const c of checkins) counts[c.mood_value as MoodValue] += 1;
    return counts;
  }, [mood, checkins]);

  const tagCounts = useMemo(() => {
    const map: Record<TagId, number> = {} as any;
    for (const t of tags) map[t] = (map[t] || 0) + 1; // base tags
    for (const c of checkins) {
      if (Array.isArray(c.tags)) {
        for (const t of c.tags) map[t as TagId] = (map[t as TagId] || 0) + 1;
      }
    }
    return map;
  }, [tags, checkins]);

  const notesToday = useMemo(() => checkins.filter(c => (c.note || '').trim().length > 0), [checkins]);

  // Auto-focus Evening textarea when navigating with ?focus=evening
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('focus') === 'evening') {
      setEveningOpen(true);
      setTimeout(() => {
        eveningRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        eveningRef.current?.focus();
      }, 120);
    }
    if (params.get('focus') === 'checkin') {
      setTimeout(() => {
        checkinSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        checkinNoteRef.current?.focus();
      }, 120);
    }
  }, [location.search]);

  // If evening content appears (loaded or typed), keep section open
  useEffect(() => {
    if (evening && evening.trim().length > 0) {
      setEveningOpen(true);
    }
  }, [evening]);

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
        }
        const list = await JournalService.getCheckinsForDay(date);
        setCheckins(list);
        // Prefill quick check-in mood using last checkin or base mood
        const lastMood = (list?.[0]?.mood_value as MoodValue | null) ?? ((d?.mood_value as MoodValue) ?? null);
        setCheckinMood(lastMood);
      } catch (e) {
        // Silent; Today remains editable if nothing saved yet
      }
    })();
  }, [date]);

  const toggleCheckinTag = (tag: TagId) => {
    setCheckinTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const onAddCheckin = async () => {
    if (!checkinMood) return;
    try {
      await JournalService.addCheckin({
        date,
        mood_value: checkinMood,
        tags: checkinTags,
        note: checkinNote || null,
      });
      setCheckinNote("");
      setCheckinTags([]);
      const list = await JournalService.getCheckinsForDay(date);
      setCheckins(list);
      // Keep prefill to last mood
      const lastMood = list?.[0]?.mood_value ?? checkinMood;
      setCheckinMood(lastMood as MoodValue);
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
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleAddCustom = () => {
    const raw = customValue.trim();
    if (!raw) return;
    const id = (raw.toLowerCase().replace(/\s+/g, '_') as TagId);
    if (!tagList.includes(id)) {
      // Extend in-place for this session
      (tagList as TagId[]).push(id);
    }
    setTags(prev => Array.from(new Set([...prev, id])));
    setCustomValue("");
    setCustomOpen(false);
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
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{new Date(n.occurred_at).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</span>
                  <span className="h-px flex-1 border-t border-dotted border-border/60" />
                </div>
                <div className="mt-1 text-sm">{n.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
          {language === 'ar' ? 'المزاج' : 'Mood'}
        </div>
        <div className="grid grid-cols-5 gap-2 items-center">
          {faces.map(({ value, color }) => (
            <button
              key={value}
              onClick={() => setMood(value)}
              aria-pressed={mood === value}
              className={`mood-3d flex flex-col items-center gap-1 rounded-xl py-2 transition-all cursor-pointer select-none active:scale-[0.98] ${mood === value ? 'active bg-muted ring-2 ring-offset-1 ring-offset-background' : 'hover:bg-muted/60'}`}
              style={mood === value ? { boxShadow: `0 0 14px ${moodHex[value]}55` } : undefined}
            >
              <MoodFace value={value} active={mood === value} size={56} />
              <span className={`text-xs ${color}`}>{language === 'ar' ? moodAr[value] : moodLabels[value]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="grid grid-cols-6 gap-2">
          {tagList.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              aria-pressed={tags.includes(tag)}
              className={`chip-3d flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer select-none active:scale-[0.98] hover:-translate-y-[1px] ${tags.includes(tag) ? 'active bg-primary/5 border-primary' : 'border-border hover:bg-muted/50'}`}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center ${tags.includes(tag) ? 'bg-primary/10 text-primary' : `bg-muted ${tagColor[tag] || 'text-muted-foreground'}`}`}>
                <TagIcon id={tag} className="h-4 w-4" />
              </div>
              <span className="text-[10px] leading-none opacity-80">{language === 'ar' ? (arTagLabels[tag] || tag.replace('_',' ')) : tag.replace('_',' ')}</span>
            </button>
          ))}
          {/* Custom tag chip */}
          <button
            onClick={() => setCustomOpen(true)}
            className="chip-3d flex flex-col items-center gap-1 p-2 rounded-xl border border-dashed hover:border-primary transition-all cursor-pointer select-none hover:bg-muted/40"
          >
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-[10px] leading-none opacity-80">{language === 'ar' ? 'مخصص' : 'Custom'}</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="text-xs text-muted-foreground mb-2">
          {language === 'ar' ? 'ملاحظة' : 'Note'}
        </div>
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder={language === 'ar' ? 'ملاحظة قصيرة (اختياري)' : 'Short note (optional)'} />
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            {language === 'ar' ? 'مراجعة المساء' : 'Evening Reflection'}
            {!evening && (
              <span className="ml-2 px-2 py-0.5 text-[10px] rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">
                {language === 'ar' ? 'معلّق حتى المساء' : 'Pending tonight'}
              </span>
            )}
          </div>
        </div>
        <Textarea ref={eveningRef} value={evening} onChange={e => setEvening(e.target.value)} placeholder={language === 'ar' ? 'أفضل لحظة؟ ماذا تعلمت؟' : 'Best moment? What did you learn?'} />
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="btn-shine" data-saving={saving ? 'true' : 'false'}>
          {saving ? (language === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : (language === 'ar' ? 'حفظ' : 'Save')}
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
