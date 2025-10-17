import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "@/providers/ThemeProvider";
import { TodayTab } from "@/components/journal/TodayTab";
import { TimelineTab } from "@/components/journal/TimelineTab";
import { ChartsTab } from "@/components/journal/ChartsTab";
import { AskTab } from "@/components/journal/AskTab";
import { NotebookPen, ChevronLeft, ChevronRight } from "lucide-react";
import { JournalService } from "@/services/journalService";

export default function Journal() {
  const { language } = useTheme();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialTab = (params.get('tab') || 'today') as 'today' | 'timeline' | 'charts' | 'ask';
  const [activeTab, setActiveTab] = useState<'today' | 'timeline' | 'charts' | 'ask'>(initialTab);
  const [currentStreak, setCurrentStreak] = useState<number | null>(null);
  const [bestStreak, setBestStreak] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const isToday = (d: Date) => {
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  };
  const isYesterday = (d: Date) => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
  };
  const formatHeader = (d: Date) => {
    const locale = language === 'ar' ? 'ar-u-ca-gregory' : undefined;
    const month = d.toLocaleDateString(locale, { month: 'long' });
    const year = d.getFullYear();
    return `${month} ${year}`;
  };
  const formatSub = (d: Date) => {
    const locale = language === 'ar' ? 'ar-u-ca-gregory' : undefined;
    if (isToday(d)) return language === 'ar' ? 'اليوم' : 'Today';
    if (isYesterday(d)) return language === 'ar' ? 'أمس' : 'Yesterday';
    return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  };
  const goPrevDay = () => {
    setSelectedDate(prev => { const n = new Date(prev); n.setDate(n.getDate() - 1); return n; });
  };
  const goNextDay = () => {
    setSelectedDate(prev => { const n = new Date(prev); n.setDate(n.getDate() + 1); return n; });
  };

  // Month dropdown values: last 12 months including current
  const monthOptions = useMemo(() => {
    const arr: { key: string; label: string; date: Date }[] = [];
    const base = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const locale = language === 'ar' ? 'ar-u-ca-gregory' : undefined;
      const label = d.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      arr.push({ key, label, date: d });
    }
    return arr;
  }, [language]);
  const onChangeMonth = (key: string) => {
    const [yy, mm] = key.split('-').map(v => parseInt(v, 10));
    setSelectedDate(prev => new Date(yy, mm - 1, Math.min(prev.getDate(), 28)));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const days = await JournalService.getCalendarOverlay(365);
        if (cancelled) return;
        // Consider a day "checked" if mood_value is 1..5
        const checked = new Set<string>(days.filter(d => (d.mood_value ?? 0) >= 1).map(d => d.date));
        const today = new Date();
        const toKey = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        // Current streak: count back from today while dates exist
        let cur = 0; const walk = new Date(today);
        for (let i=0;i<400;i++) {
          const key = toKey(walk);
          if (!checked.has(key)) break;
          cur++;
          walk.setDate(walk.getDate()-1);
        }
        // Best streak: scan all dates sorted and count consecutive runs
        const sorted = Array.from(checked.values()).sort();
        let best = 0; let run = 0; let prev: Date | null = null;
        for (const k of sorted) {
          const d = new Date(`${k}T00:00:00`);
          if (prev) {
            const diff = (d.getTime() - prev.getTime()) / (24*3600*1000);
            if (diff === 1) run++; else run = 1;
          } else {
            run = 1;
          }
          if (run > best) best = run;
          prev = d;
        }
        setCurrentStreak(cur);
        setBestStreak(best);
      } catch {
        setCurrentStreak(null);
        setBestStreak(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div className="container mx-auto p-3 max-w-3xl">
      <div className="glass-hero px-5 py-4 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-pink-500/30 to-purple-500/30 text-pink-400 shadow-md">
            <NotebookPen className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{language === 'ar' ? 'دفتر اليوميات' : 'WAKTI Journal'}</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {currentStreak !== null && (
            <span
              className="rounded-full px-3 py-1 font-medium
                bg-gradient-to-r from-rose-100 to-orange-100 text-rose-700 border border-rose-300 shadow-sm
                dark:from-rose-500/20 dark:to-orange-500/20 dark:text-rose-200 dark:border-white/10 dark:shadow-rose-900/30 backdrop-blur-[2px]"
              title={language === 'ar' ? 'السلسلة الحالية' : 'Current streak'}
            >
              🔥 {language === 'ar' ? 'الحالي' : 'Current'}: {currentStreak}
            </span>
          )}
          {bestStreak !== null && (
            <span
              className="rounded-full px-3 py-1 font-medium
                bg-gradient-to-r from-indigo-100 to-violet-100 text-indigo-700 border border-indigo-300 shadow-sm
                dark:from-indigo-500/20 dark:to-violet-500/20 dark:text-indigo-200 dark:border-white/10 dark:shadow-indigo-900/30 backdrop-blur-[2px]"
              title={language === 'ar' ? 'أفضل سلسلة' : 'Best streak'}
            >
              🏆 {language === 'ar' ? 'الأفضل' : 'Best'}: {bestStreak}
            </span>
          )}
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="w-full flex justify-start gap-2 overflow-x-auto px-1">
          <TabsTrigger value="today" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">{language === 'ar' ? 'اليوم' : 'Today'}</TabsTrigger>
          <TabsTrigger value="timeline" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">{language === 'ar' ? 'السجل' : 'Timeline'}</TabsTrigger>
          <TabsTrigger value="charts" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">{language === 'ar' ? 'الإحصائيات' : 'Charts'}</TabsTrigger>
          <TabsTrigger value="ask" className="flex-shrink-0 text-xs sm:text-sm px-3 sm:px-4">{language === 'ar' ? 'اسأل' : 'Ask Journal'}</TabsTrigger>
        </TabsList>
        {activeTab === 'timeline' && (
          <div className="sticky top-[64px] z-10 mt-2 mb-2">
            <div className="flex items-center justify-between rounded-2xl border bg-gradient-to-r from-cyan-500/10 via-transparent to-violet-500/10 backdrop-blur-sm px-3 py-2 shadow-sm">
              <button onClick={goPrevDay} className="rounded-xl p-2 hover:bg-card/70 transition-colors" aria-label={language === 'ar' ? 'اليوم السابق' : 'Previous day'}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center justify-center w-full">
                <div className="flex flex-col items-center gap-1">
                  <div className="text-xs text-muted-foreground">{formatSub(selectedDate)}</div>
                  <select
                    className="rounded-xl border bg-card px-3 py-2 text-sm shadow-sm"
                    value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}`}
                    onChange={(e) => onChangeMonth(e.target.value)}
                  >
                    {monthOptions.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={goNextDay} className="rounded-xl p-2 hover:bg-card/70 transition-colors" aria-label={language === 'ar' ? 'اليوم التالي' : 'Next day'}>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        <TabsContent value="today" className="mt-4"><TodayTab /></TabsContent>
        <TabsContent value="timeline" className="mt-4"><TimelineTab selectedDate={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`} /></TabsContent>
        <TabsContent value="charts" className="mt-4"><ChartsTab /></TabsContent>
        <TabsContent value="ask" className="mt-4"><AskTab /></TabsContent>
      </Tabs>
    </div>
  );
}
