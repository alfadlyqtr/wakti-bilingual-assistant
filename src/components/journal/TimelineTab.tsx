import React, { useEffect, useMemo, useState } from "react";
import { JournalService, JournalDay, JournalCheckin } from "@/services/journalService";
import { useTheme } from "@/providers/ThemeProvider";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MoodFace, MoodValue } from "./icons/MoodFaces";
import { TagIcon } from "@/components/journal/TagIcon";
import { formatTime } from "@/utils/datetime";

function getLocalDayString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export const TimelineTab: React.FC = () => {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [days, setDays] = useState<JournalDay[]>([]);
  const [checkins, setCheckins] = useState<JournalCheckin[]>([]);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => getLocalDayString(), []);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // per-date expand for check-ins

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  // Build maps for fast lookup (hooks must run every render)
  const dayByDate: Record<string, JournalDay> = useMemo(() => {
    const map: Record<string, JournalDay> = {};
    for (const d of days) map[d.date] = d;
    return map;
  }, [days]);

  const checkinsByDate: Record<string, JournalCheckin[]> = useMemo(() => {
    const map: Record<string, JournalCheckin[]> = {};
    for (const c of checkins) {
      if (!map[c.date]) {
        map[c.date] = [];
      }
      map[c.date].push(c);
    }
    return map;
  }, [checkins]);

  const allDatesDesc = useMemo(() => {
    const set = new Set<string>([...Object.keys(dayByDate), ...Object.keys(checkinsByDate)]);
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [dayByDate, checkinsByDate]);

  if (loading) return <div className="text-muted-foreground">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</div>;

  if (!days.length && !checkins.length) return (
    <div className="journal-card p-6 text-center text-muted-foreground">
      {language === 'ar' ? 'لا توجد إدخالات بعد' : 'No entries yet'}
    </div>
  );

  const todayDay = dayByDate[today] || null;
  const todayCheckins = checkinsByDate[today] || [];
  const todayHasContent = Boolean(todayDay || todayCheckins.length > 0);
  // Per product decision: Do not show Today on Timeline until evening is saved or after midnight
  const showPinnedToday = false;

  const pastDates = allDatesDesc.filter(d => d !== today).slice(0, 3);
  const pastCards = pastDates.map((dateStr) => {
    const d = dayByDate[dateStr] || null;
    const cis = checkinsByDate[dateStr] || [];
    const lastMood: MoodValue | null = (cis[0]?.mood_value as MoodValue | undefined) ?? (d?.mood_value as MoodValue | undefined) ?? null;
    const missingEvening = dateStr < today && (!d || !d.evening_reflection);
    return (
      <div key={dateStr} className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium flex items-center gap-2">
            <span>{dateStr}</span>
            {missingEvening && <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">{language==='ar'?'المساء مفقود':'Evening missing'}</span>}
          </div>
          {lastMood && <MoodFace value={lastMood} active size={36} />}
        </div>
        {(((d?.tags?.length) || 0) + ((cis[0]?.tags?.length) || 0)) > 0 ? (
          <div className="flex flex-wrap gap-2 mb-2">
            {[...(d?.tags || []), ...((cis[0]?.tags)||[])].slice(0,8).map(t => (
              <span key={t} className="chip-3d flex items-center gap-1 px-2 py-1 rounded-lg text-xs border">
                <TagIcon id={t} className="h-3.5 w-3.5" />
                {t.replace('_',' ')}
              </span>
            ))}
          </div>
        ) : null}
        {d?.morning_reflection && <div className="text-sm">{d.morning_reflection}</div>}
        <div className="mt-2">
          {d?.evening_reflection ? (
            <>
              <button className="text-xs text-muted-foreground underline" onClick={() => setExpanded(prev => ({...prev, [dateStr]: !prev[dateStr]}))}>
                {expanded[dateStr] ? (language === 'ar' ? 'إخفاء المساء' : 'Hide evening') : (language === 'ar' ? 'إظهار المساء' : 'Show evening')}
              </button>
              {expanded[dateStr] && (
                <div className="text-sm mt-1">{d?.evening_reflection}</div>
              )}
            </>
          ) : (
            <div className="text-xs text-muted-foreground">{language === 'ar' ? 'لا يوجد انعكاس مسائي' : 'No evening reflection'}</div>
          )}
        </div>
        {d?.note && <div className="text-sm mt-2 italic opacity-80">{d.note}</div>}
        <div className="mt-2">
          <button className="text-xs text-muted-foreground underline" onClick={() => setExpanded(prev => ({...prev, [dateStr+':cis']: !prev[dateStr+':cis']}))}>
            {expanded[dateStr+':cis'] ? (language==='ar'?'إخفاء المدخلات':'Hide entries') : (language==='ar'?'إظهار المدخلات':'Show entries')} ({cis.length})
          </button>
          {expanded[dateStr+':cis'] && (
            <div className="space-y-2 mt-1">
              {cis.length === 0 && <div className="text-xs text-muted-foreground">{language==='ar'?'لا توجد مدخلات':'No entries'}</div>}
              {cis.map(c => (
                <div key={c.id} className="rounded-xl border p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <MoodFace value={c.mood_value as MoodValue} size={24} />
                      {(() => {
                        const d = c.occurred_at ? new Date(c.occurred_at) : null;
                        const ok = d && !isNaN(d.getTime());
                        const timeStr = ok ? formatTime(d as Date, language as any, { hour: '2-digit', minute: '2-digit' }) : '';
                        return <div className="text-xs opacity-70">{timeStr}</div>;
                      })()}
                    </div>
                  </div>
                  {c.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {c.tags.map(t => (
                        <span key={t} className="chip-3d flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] border"><TagIcon id={t} className="h-3 w-3" />{t.replace('_',' ')}</span>
                      ))}
                    </div>
                  )}
                  {c.note && <div className="text-sm">{c.note}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/calendar?date=${dateStr}#journal`)}>
            {language === 'ar' ? 'افتح في التقويم' : 'Open in Calendar'}
          </Button>
        </div>
      </div>
    );
  });

  return (
    <div className="space-y-4">
      {pastCards}
    </div>
  );
}
;
