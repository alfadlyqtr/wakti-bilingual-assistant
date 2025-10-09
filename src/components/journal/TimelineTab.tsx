import React, { useEffect, useMemo, useState } from "react";
import { JournalService, JournalDay, JournalCheckin } from "@/services/journalService";
import { useTheme } from "@/providers/ThemeProvider";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MoodFace, MoodValue } from "./icons/MoodFaces";
import { TagIcon } from "@/components/journal/TagIcon";
import { formatTime } from "@/utils/datetime";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDeleteCheckin = async (id: string) => {
    try {
      await JournalService.deleteCheckin(id);
      toast.success(language === 'ar' ? 'تم حذف المدخل' : 'Entry deleted');
      setRefreshKey(k => k + 1);
    } catch (error) {
      console.error('Error deleting checkin:', error);
      toast.error(language === 'ar' ? 'فشل حذف المدخل' : 'Failed to delete entry');
    }
  };

  // Render a saved note string as outer pill(s) with inner chips, like TodayTab
  const renderNotePills = (text?: string | null) => {
    if (!text) return null;
    const lines = (text || '').split('\n');
    return (
      <div className="mt-2">
        {lines.map((rawLine, idx) => {
          const i = rawLine.indexOf('|');
          if (i < 0) return <div key={`note-line-${idx}`} className="text-sm">{rawLine}</div>;
          const before = rawLine.slice(0, i); // e.g., "[09:31 AM] 🕒  "
          const after = rawLine.slice(i);
          const parts = after.split('|').map(s => s.trim());
          const markerRe = /^__FREE__(.*)__END__$/;
          const timeTokenRe = /^\[[^\]]+\]$/; // e.g., [10:29 AM]
          let noteFreeText = '';
          const tokensRaw: string[] = [];
          for (const p of parts) {
            if (!p) continue;
            const m = p.match(markerRe);
            if (m) { noteFreeText = m[1]; continue; }
            // Strip any leading timestamp + optional clock from token
            let q = p.replace(/^\[[^\]]+\]\s*/,'').trim();
            if (q === '🕒') continue;
            if (q === '__UNSAVED__') continue;
            if (timeTokenRe.test(q)) continue; // token is still a pure time label
            if (!q) continue;
            tokensRaw.push(q);
          }
          const chips = (
            <>
              {tokensRaw.map((tok, k) => (
                <span key={`tok-${k}`} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow text-xs">{tok}</span>
              ))}
              {noteFreeText && (
                <span key={`free-${idx}`} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow text-xs">{noteFreeText}</span>
              )}
            </>
          );
          return (
            <div key={`pill-${idx}`} className="my-2 p-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-800 shadow-sm">
              <span className="text-xs text-slate-600 mr-1">{before.match(/\[[^\]]+\]/)?.[0] || before}</span>
              <span className="sr-only"> | </span>
              <span className="inline-flex flex-wrap gap-2 align-middle">{chips}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Collect mood counts from check-ins and/or the saved day note
  const getDayMoodCounts = (d: JournalDay | null, cis: JournalCheckin[]) => {
    const counts: Record<number, number> = {};
    // Prefer authoritative check-ins when present
    if (cis.length > 0) {
      cis.forEach(c => { counts[c.mood_value] = (counts[c.mood_value] || 0) + 1; });
      return counts;
    }
    // Fall back to parsing saved day note (historical data without check-ins)
    const note = d?.note || '';
    if (!note) return counts;
    const lines = note.split('\n');
    const moodEmoji: Record<number, string> = { 1: '😖', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };
    const emojiToMood: Record<string, number> = Object.fromEntries(Object.entries(moodEmoji).map(([k,v]) => [v, Number(k)]));
    for (const rawLine of lines) {
      const i = rawLine.indexOf('|');
      if (i < 0) continue;
      const after = rawLine.slice(i);
      const parts = after.split('|').map(s => s.trim()).filter(Boolean);
      for (const p of parts) {
        const found = Object.keys(emojiToMood).find(e => p.includes(e));
        if (found) {
          const mv = emojiToMood[found];
          counts[mv] = (counts[mv] || 0) + 1;
        }
      }
    }
    return counts;
  };

  // Refresh data when tab becomes active or refreshKey changes
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
  
  // Listen for custom refresh event from Today tab
  useEffect(() => {
    const handleRefresh = () => setRefreshKey(k => k + 1);
    window.addEventListener('refreshTimeline', handleRefresh);
    return () => window.removeEventListener('refreshTimeline', handleRefresh);
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
  // Show Today on Timeline only after End Day (evening_reflection exists)
  const showPinnedToday = Boolean(todayDay?.evening_reflection);

  const pastDates = allDatesDesc.filter(d => d !== today).slice(0, 3);
  
  const todayCard = showPinnedToday ? (
    (() => {
      const dateStr = today;
      const d = todayDay;
      const cis = todayCheckins;
      const lastMood: MoodValue | null = (cis[0]?.mood_value as MoodValue | undefined) ?? (d?.mood_value as MoodValue | undefined) ?? null;
      return (
        <div key={`today-${dateStr}`} className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium flex items-center gap-3 group">
              <span>{dateStr}</span>
              {(() => {
                const counts = getDayMoodCounts(d, cis);
                const keys = Object.keys(counts);
                if (keys.length === 0) return null;
                return (
                  <div className="flex flex-wrap items-center gap-2">
                    {keys.map(m => (
                      <div key={`${dateStr}-hdr-mood-${m}`} className="flex items-center gap-1">
                        <MoodFace value={parseInt(m) as MoodValue} size={56} active className="transition-transform duration-150 group-hover:scale-[1.03]" />
                        {counts[parseInt(m)]>1 && <span className="text-[11px] opacity-70">×{counts[parseInt(m)]}</span>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
          {(((d?.tags?.length) || 0) + ((cis[0]?.tags?.length) || 0)) > 0 ? (
            <div className="flex flex-wrap gap-2 mb-2">
              {Array.from(new Set([...(d?.tags || []), ...((cis[0]?.tags)||[])])).slice(0,8).map((t, idx) => (
                <span key={`${dateStr}-${t}-${idx}`} className="chip-3d flex items-center gap-1 px-2 py-1 rounded-lg text-xs border">
                  <TagIcon id={t} className="h-5 w-5" />
                  {t.replace('_',' ')}
                </span>
              ))}
            </div>
          ) : null}
          {d?.morning_reflection && <div className="text-sm">{d.morning_reflection}</div>}
          
          {/* Gratitude Display */}
          {(d?.gratitude_1 || d?.gratitude_2 || d?.gratitude_3) && (
            <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200/30 dark:border-purple-800/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🙏</span>
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                  {language === 'ar' ? 'الامتنان' : 'Gratitude'}
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                {d.gratitude_1 && (<div className="flex gap-2"><span className="text-purple-500 dark:text-purple-400">1.</span><span>{d.gratitude_1}</span></div>)}
                {d.gratitude_2 && (<div className="flex gap-2"><span className="text-pink-500 dark:text-pink-400">2.</span><span>{d.gratitude_2}</span></div>)}
                {d.gratitude_3 && (<div className="flex gap-2"><span className="text-purple-600 dark:text-purple-300">3.</span><span>{d.gratitude_3}</span></div>)}
              </div>
            </div>
          )}
          
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
          {expanded[dateStr+':cis'] && renderNotePills(d?.note)}
          <div className="mt-2">
            <button className="text-xs text-muted-foreground underline" onClick={() => setExpanded(prev => ({...prev, [dateStr+':cis']: !prev[dateStr+':cis']}))}>
              {expanded[dateStr+':cis'] ? (language==='ar'?'إخفاء المدخلات':'Hide entries') : (language==='ar'?'إظهار المدخلات':'Show entries')} ({cis.length})
            </button>
            {expanded[dateStr+':cis'] && !Boolean(d?.note) && (() => {
              const fc = cis.filter(c => (c.tags?.length||0) > 0 || (c.note && c.note.trim().length>0));
              return (
              <div className="space-y-2 mt-1">
                {fc.length === 0 && <div className="text-xs text-muted-foreground">{language==='ar'?'لا توجد مدخلات':'No entries'}</div>}
                {fc.map(c => (
                  <div key={c.id} className="my-2 p-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-800 shadow-sm group relative">
                    <button
                      onClick={() => handleDeleteCheckin(c.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                      title={language === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="flex items-center flex-wrap gap-2">
                      {(() => {
                        const d2 = c.occurred_at ? new Date(c.occurred_at) : null;
                        const ok = d2 && !isNaN(d2.getTime());
                        const timeStr = ok ? formatTime(d2 as Date, language as any, { hour: '2-digit', minute: '2-digit' }) : '';
                        return <span className="text-xs text-slate-600 mr-1">[{timeStr}]</span>;
                      })()}
                      {c.tags?.map(t => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow text-xs"><TagIcon id={t} className="h-4 w-4" />{t.replace('_',' ')}</span>
                      ))}
                      {c.note && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow text-xs">{c.note}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ); })()}
          </div>
          {/* Open in Calendar button removed as requested */}
        </div>
      );
    })()
  ) : null;
  const pastCards = pastDates.map((dateStr) => {
    const d = dayByDate[dateStr] || null;
    const cis = checkinsByDate[dateStr] || [];
    const lastMood: MoodValue | null = (cis[0]?.mood_value as MoodValue | undefined) ?? (d?.mood_value as MoodValue | undefined) ?? null;
    const missingEvening = dateStr < today && (!d || !d.evening_reflection);
    return (
      <div key={dateStr} className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium flex items-center gap-3 group">
            <span>{dateStr}</span>
            {(() => {
              const counts = getDayMoodCounts(d, cis);
              const keys = Object.keys(counts);
              if (keys.length === 0) return null;
              return (
                <div className="flex flex-wrap items-center gap-2">
                  {keys.map(m => (
                    <div key={`${dateStr}-hdr-mood-${m}`} className="flex items-center gap-1">
                      <MoodFace value={parseInt(m) as MoodValue} size={56} active className="transition-transform duration-150 group-hover:scale-[1.03]" />
                      {counts[parseInt(m)]>1 && <span className="text-[11px] opacity-70">×{counts[parseInt(m)]}</span>}
                    </div>
                  ))}
                </div>
              );
            })()}
            {missingEvening && <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">{language==='ar'?"المساء مفقود":"Evening missing"}</span>}
          </div>
        </div>
        {(((d?.tags?.length) || 0) + ((cis[0]?.tags?.length) || 0)) > 0 ? (
          <div className="flex flex-wrap gap-2 mb-2">
            {Array.from(new Set([...(d?.tags || []), ...((cis[0]?.tags)||[])])).slice(0,8).map((t, idx) => (
              <span key={`${dateStr}-${t}-${idx}`} className="chip-3d flex items-center gap-1 px-2 py-1 rounded-lg text-xs border">
                <TagIcon id={t} className="h-3.5 w-3.5" />
                {t.replace('_',' ')}
              </span>
            ))}
          </div>
        ) : null}
            {d?.morning_reflection && <div className="text-sm">{d.morning_reflection}</div>}
            
            {/* Gratitude Display */}
            {(d?.gratitude_1 || d?.gratitude_2 || d?.gratitude_3) && (
              <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200/30 dark:border-purple-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🙏</span>
                  <span className="text-xs font-medium text-purple-600 dark:text-purple-400">
                    {language === 'ar' ? 'الامتنان' : 'Gratitude'}
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  {d.gratitude_1 && (<div className="flex gap-2"><span className="text-purple-500 dark:text-purple-400">1.</span><span>{d.gratitude_1}</span></div>)}
                  {d.gratitude_2 && (<div className="flex gap-2"><span className="text-pink-500 dark:text-pink-400">2.</span><span>{d.gratitude_2}</span></div>)}
                  {d.gratitude_3 && (<div className="flex gap-2"><span className="text-purple-600 dark:text-purple-300">3.</span><span>{d.gratitude_3}</span></div>)}
                </div>
              </div>
            )}
            
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
                <div key={c.id} className="rounded-xl border p-3 bg-muted/30 group relative">
                  <button
                    onClick={() => handleDeleteCheckin(c.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                    title={language === 'ar' ? 'حذف' : 'Delete'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
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
        {/* Open in Calendar button removed as requested */}
      </div>
    );
  });

  return (
    <div className="space-y-4">
      {todayCard}
      {pastCards}
    </div>
  );
}
;
