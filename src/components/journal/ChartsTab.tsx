import React, { useEffect, useMemo, useState } from "react";
import { JournalService, JournalDay } from "@/services/journalService";
import { useTheme } from "@/providers/ThemeProvider";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

function getLocalDayString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export const ChartsTab: React.FC = () => {
  const { language } = useTheme();
  const [items, setItems] = useState<JournalDay[]>([]);

  useEffect(() => {
    (async () => {
      const data = await JournalService.getTimeline(30);
      setItems(data);
    })();
  }, []);

  const moodCounts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const d of items) {
      if (d.mood_value) c[d.mood_value] = (c[d.mood_value] || 0) + 1;
    }
    return [1, 2, 3, 4, 5].map(v => ({ mood: v, count: c[v] || 0 }));
  }, [items]);

  const trendData = useMemo(() => {
    const days: string[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(getLocalDayString(d));
    }
    const map = new Map(items.map(i => [i.date, i.mood_value || null] as const));
    return days.map(date => ({ date, value: map.get(date) ?? null }));
  }, [items]);

  const topTags = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of items) {
      for (const t of d.tags || []) map[t] = (map[t] || 0) + 1;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name: name.replace('_', ' '), count }));
  }, [items]);

  return (
    <div className="space-y-4">
      {/* Mood trend */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="text-sm mb-3 text-muted-foreground">
          {language === 'ar' ? 'اتجاه المزاج (آخر 30 يوماً)' : 'Mood Trend (last 30 days)'}
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} width={28} />
              <Tooltip formatter={(v: any) => v ?? '—'} labelFormatter={(l) => l} />
              <Line type="monotone" dataKey="value" stroke="#ec4899" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mood distribution */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="text-sm mb-3 text-muted-foreground">
          {language === 'ar' ? 'توزيع المزاج' : 'Mood Distribution'}
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={moodCounts} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="mood" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
              <Tooltip />
              <Bar dataKey="count" fill="#a78bfa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top activities */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="text-sm mb-3 text-muted-foreground">
          {language === 'ar' ? 'أكثر الأنشطة' : 'Top Activities'}
        </div>
        {topTags.length === 0 ? (
          <div className="text-muted-foreground text-sm">
            {language === 'ar' ? 'لا توجد بيانات' : 'No data'}
          </div>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTags} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} height={40} tickMargin={8} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                <Tooltip />
                <Bar dataKey="count" fill="#60a5fa" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
