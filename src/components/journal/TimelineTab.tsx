import React, { useEffect, useMemo, useState } from "react";
import { onEvent } from "@/utils/eventBus";
import { JournalService, JournalDay, JournalCheckin } from "@/services/journalService";
import { useTheme } from "@/providers/ThemeProvider";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MoodFace, MoodValue } from "./icons/MoodFaces";
import { TagIcon } from "@/components/journal/TagIcon";
import { formatTime } from "@/utils/datetime";
import { toast } from "sonner";

function getLocalDayString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const enMonths = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const arMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

function ordinalSuffix(n: number) {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatTimelineDate(dateStr: string, lang: string) {
  const [yy, mm, dd] = dateStr.split('-').map(n => parseInt(n, 10));
  const d = new Date(yy, (mm || 1) - 1, dd || 1);
  const day = d.getDate();
  const monthIndex = d.getMonth();
  const year = d.getFullYear();
  if (lang === 'ar') {
    return `${day} ${arMonths[monthIndex]}، ${year}`;
  }
  return `${day}${ordinalSuffix(day)} ${enMonths[monthIndex]}, ${year}`;
}

export const TimelineTab: React.FC<{ selectedDate?: string }> = ({ selectedDate }) => {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [days, setDays] = useState<JournalDay[]>([]);
  const [checkins, setCheckins] = useState<JournalCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => getLocalDayString(), []);
  const [refreshKey, setRefreshKey] = useState(0);

  // Removed day delete action per request

  const getMissedDayMessage = (dateStr: string) => {
    // Determine if date is in the past or the future relative to local today
    const today = new Date();
    const [yy, mm, dd] = dateStr.split('-').map(n => parseInt(n, 10));
    const d = new Date(yy, (mm || 1) - 1, dd || 1);
    const isFuture = d > new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Deterministic seed from date string to vary pick per day
    let seed = 0;
    for (let i = 0; i < dateStr.length; i++) seed = (seed * 31 + dateStr.charCodeAt(i)) >>> 0;
    const pick = (n: number) => (seed % n);

    const enPast = [
      "A soft nudge from yesterday — one line is plenty.",
      "Missed you here. Capture a tiny memory from that day?",
      "Your journal waited patiently. A sentence will do.",
      "No pressure. Jot a quick highlight from then.",
      "Even a single word keeps the streak of care alive."
    ];
    const enFuture = [
      "Let’s make a small plan for that day.",
      "Future you will love a tiny intention here.",
      "Set a gentle note for tomorrow — keep it light.",
      "A simple goal line can guide your day.",
      "Plant a thought — revisit and smile later."
    ];
    const arPast = [
      "دفترك اشتاق لك — سطر واحد من ذلك اليوم يكفي.",
      "فوتنا تدوينك. هل نسجل ذكرى صغيرة لذلك اليوم؟",
      "دفترك انتظرك بلطف. جملة واحدة تكفي.",
      "بدون ضغط — سطر سريع عن أبرز ما حدث.",
      "حتى كلمة واحدة تُبقي عادة الاهتمام حية."
    ];
    const arFuture = [
      "لنضع نية بسيطة لذلك اليوم.",
      "ذاتك القادمة ستحب هدفًا صغيرًا هنا.",
      "سطر خفيف لِغدٍ أسهل.",
      "هدف بسيط يوجّه يومك.",
      "ازرع فكرة — وابتسم عند العودة."
    ];

    const pool = language === 'ar' ? (isFuture ? arFuture : arPast) : (isFuture ? enFuture : enPast);
    return pool[pick(pool.length)];
  };

  const renderNotePills = (text?: string | null) => {
    if (!text) return null;
    const lines = (text || '').split('\n');
    return (
      <div className="mt-2">
        {lines.map((rawLine, idx) => {
          const i = rawLine.indexOf('|');
          if (i < 0) return <div key={`note-line-${idx}`} className="text-sm">{rawLine}</div>;
          const before = rawLine.slice(0, i);
          const after = rawLine.slice(i);
          const parts = after.split('|').map(s => s.trim());
          const markerRe = /^__FREE__(.*)__END__$/;
          let noteFreeText = '';
          const tokensRaw: string[] = [];
          for (const p of parts) {
            if (!p) continue;
            const m = p.match(markerRe);
            if (m) { noteFreeText = m[1]; continue; }
            if (p === '🕒' || p === '__UNSAVED__') continue;
            tokensRaw.push(p);
          }
          const tokens = Array.from(new Set(tokensRaw));
          return (
            <div key={`pill-${idx}`} className="my-2 p-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-800 shadow-sm">
              <span className="text-xs text-slate-600 mr-1">{before.match(/\[[^\]]+\]/)?.[0] || before}</span>
              <span className="sr-only"> | </span>
              <span className="inline-flex flex-wrap gap-2 align-middle">
                {tokens.map((tok, k) => (
                  <span key={`tok-${k}`} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow text-xs">{tok}</span>
                ))}
                {noteFreeText && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow text-xs">{noteFreeText}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const getDayMoodCounts = (d: JournalDay | null, cis: JournalCheckin[]) => {
    const counts: Record<number, number> = {};
    const note = d?.note || '';
    // Mood emoji → value mapping
    const emojiToValue: Record<string, number> = { '😖': 1, '🙁': 2, '😐': 3, '🙂': 4, '😄': 5 };
    if (note.trim()) {
      // Count moods from the displayed note text
      for (const line of note.split('\n')) {
        for (const [emoji, value] of Object.entries(emojiToValue)) {
          // Count each occurrence of the mood emoji in the line
          const re = new RegExp(emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
          const matches = line.match(re);
          if (matches) counts[value] = (counts[value] || 0) + matches.length;
        }
      }
    } else {
      // No note — count from visible checkins
      const visible = cis.filter(c => (c.tags?.length || 0) > 0 || (c.note && c.note.trim().length > 0));
      const source = visible.length > 0 ? visible : cis;
      source.forEach(c => { counts[c.mood_value] = (counts[c.mood_value] || 0) + 1; });
    }
    return counts;
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [d, cis] = await Promise.all([
          JournalService.getTimeline(60),
          JournalService.getCheckinsSince(60)
        ]);
        setDays(d);
        setCheckins(cis);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [refreshKey]);

  useEffect(() => {
    const handleRefresh = () => setRefreshKey(k => k + 1);
    return onEvent('refreshTimeline', handleRefresh);
  }, []);

  const dayByDate: Record<string, JournalDay> = useMemo(() => {
    const map: Record<string, JournalDay> = {};
    for (const d of days) map[d.date] = d;
    return map;
  }, [days]);

  const checkinsByDate: Record<string, JournalCheckin[]> = useMemo(() => {
    const map: Record<string, JournalCheckin[]> = {};
    for (const c of checkins) {
      (map[c.date] ||= []).push(c);
    }
    return map;
  }, [checkins]);

  const allDatesDesc = useMemo(() => {
    const set = new Set<string>([...Object.keys(dayByDate), ...Object.keys(checkinsByDate)]);
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [dayByDate, checkinsByDate]);

  // If a selectedDate is provided, show only that day; otherwise default to latest 3
  const limitedDates = selectedDate ? [selectedDate] : allDatesDesc.slice(0, 3);

  if (loading) return <div className="text-muted-foreground">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</div>;
  if (!days.length && !checkins.length) return (
    <div className="journal-card p-6 text-center text-muted-foreground">
      {language === 'ar' ? 'لا توجد إدخالات بعد' : 'No entries yet'}
    </div>
  );

  const buildCard = (dateStr: string, d: JournalDay | null, cis: JournalCheckin[]) => {
    const counts = getDayMoodCounts(d, cis);
    const countKeys = Object.keys(counts);
    const fc = (d?.note ? [] : cis.filter(c => (c.tags?.length||0) > 0 || (c.note && c.note.trim().length>0)));
    const hasMorning = !!d?.morning_reflection;
    const hasMidday = !!d?.midday_reflection;
    const hasEvening = !!d?.evening_reflection;
    const hasGratitude = !!(d?.gratitude_1 || d?.gratitude_2 || d?.gratitude_3);
    const hasNote = !!d?.note;
    const isEmptyDay = !hasNote && !hasMorning && !hasMidday && !hasEvening && !hasGratitude && fc.length === 0;

    return (
      <div key={dateStr} className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium flex items-center gap-3 group">
            <span>{formatTimelineDate(dateStr, language)}</span>
            {countKeys.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {countKeys.map(m => (
                  <div key={`${dateStr}-hdr-mood-${m}`} className="relative">
                    <MoodFace value={parseInt(m) as MoodValue} size={40} active className="transition-transform duration-150 group-hover:scale-[1.03]" />
                    {counts[parseInt(m)] > 1 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-700 h-5 w-5 text-[10px] shadow-sm">{counts[parseInt(m)]}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      {(((d?.tags?.length) || 0) + ((cis[0]?.tags?.length) || 0)) > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {Array.from(new Set([...(d?.tags || []), ...((cis[0]?.tags)||[])])).slice(0,8).map((t, idx) => (
            <span key={`${dateStr}-${t}-${idx}`} className="chip-3d flex items-center gap-1 px-2 py-1 rounded-lg text-xs border">
              <TagIcon id={t} className="h-5 w-5" />
              {t.replace('_',' ')}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {hasMorning && (
          <div className="rounded-xl border border-border/40 p-3 bg-gradient-to-b from-blue-50/40 to-background/60 dark:from-blue-950/20 dark:to-background">
            <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 text-[11px] font-medium mb-1.5 block w-fit">
              {language === 'ar' ? 'الصباح' : 'Morning'}
            </span>
            <p className="text-sm text-left">{d.morning_reflection}</p>
          </div>
        )}

        {hasMidday && (
          <div className="rounded-xl border border-border/40 p-3 bg-gradient-to-b from-teal-50/40 to-background/60 dark:from-teal-950/20 dark:to-background">
            <span className="inline-flex items-center rounded-full bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 px-2 py-0.5 text-[11px] font-medium mb-1.5 block w-fit">
              {language === 'ar' ? 'النهار' : 'Mid-day'}
            </span>
            <p className="text-sm text-left">{d.midday_reflection}</p>
          </div>
        )}

        {hasEvening && (
          <div className="rounded-xl border border-border/40 p-3 bg-gradient-to-b from-amber-50/40 to-background/60 dark:from-amber-950/20 dark:to-background">
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 text-[11px] font-medium mb-1.5 block w-fit">
              {language === 'ar' ? 'المساء' : 'Evening'}
            </span>
            <p className="text-sm text-left">{d.evening_reflection}</p>
          </div>
        )}

        {hasGratitude && (
          <div className="rounded-xl border border-purple-200/40 dark:border-purple-800/30 p-3 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🙏</span>
              <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                {language === 'ar' ? 'ممتن لـ:' : 'Grateful for:'}
              </span>
            </div>
            <div className="space-y-1.5 text-sm text-left">
              {d?.gratitude_1 && (<div className="flex gap-2"><span className="text-purple-500 dark:text-purple-400">1.</span><span>{d.gratitude_1}</span></div>)}
              {d?.gratitude_2 && (<div className="flex gap-2"><span className="text-pink-500 dark:text-pink-400">2.</span><span>{d.gratitude_2}</span></div>)}
              {d?.gratitude_3 && (<div className="flex gap-2"><span className="text-purple-600 dark:text-purple-300">3.</span><span>{d.gratitude_3}</span></div>)}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 my-2">
        <div className="h-px flex-1 bg-border/40" />
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {language === 'ar' ? 'السجلات' : 'Logs'}
        </span>
        <div className="h-px flex-1 bg-border/40" />
      </div>
      {renderNotePills(d?.note)}

      {!hasNote && fc.length > 0 && (
        <div className="space-y-2 mt-2">
          {fc.map(c => (
            <div key={c.id} className="rounded-2xl border p-3 bg-muted/30">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <MoodFace value={c.mood_value as MoodValue} size={24} />
                  {(() => {
                    const d0 = c.occurred_at ? new Date(c.occurred_at) : null;
                    const ok = d0 && !isNaN(d0.getTime());
                    const timeStr = ok ? formatTime(d0 as Date, language as any, { hour: '2-digit', minute: '2-digit' }) : '';
                    return <div className="text-xs opacity-70">{timeStr}</div>;
                  })()}
                </div>
              </div>
              {(!d?.note && c.tags?.length > 0) && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {c.tags.map(t => (
                    <span key={t} className="chip-3d flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] border"><TagIcon id={t} className="h-4 w-4" />{t.replace('_',' ')}</span>
                  ))}
                </div>
              )}
              {c.note && <div className="text-sm">{c.note}</div>}
            </div>
          ))}
        </div>
      )}

      {isEmptyDay && (
        <div className="mt-2 text-sm text-muted-foreground">
          <div className="font-medium mb-1">{language === 'ar' ? 'دفترك افتقدك ✨' : 'Your journal missed you ✨'}</div>
          <div>{getMissedDayMessage(dateStr)}</div>
        </div>
      )}
    </div>
    );
  };

  const cards = limitedDates.map(dateStr => buildCard(dateStr, dayByDate[dateStr] || null, checkinsByDate[dateStr] || []));

  return (
    <div className="space-y-4">
      {cards.length > 0 ? cards : (
        <div className="journal-card p-6 text-center text-muted-foreground">
          {language === 'ar' ? 'لا توجد إدخالات لهذا اليوم' : 'No entries for this day'}
        </div>
      )}
    </div>
  );
} 
;
