import React, { useEffect, useMemo, useState } from "react";
import { JournalService, JournalDay, JournalCheckin } from "@/services/journalService";
import { useTheme } from "@/providers/ThemeProvider";
import { MoodFace, MoodValue } from "./icons/MoodFaces";
import { TagIcon } from "./TagIcon";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Label
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
  const [checkins, setCheckins] = useState<JournalCheckin[]>([]);
  const [range, setRange] = useState<7 | 14 | 30>(30);

  useEffect(() => {
    (async () => {
      const [days, cis] = await Promise.all([
        JournalService.getTimeline(60),
        JournalService.getCheckinsSince(60)
      ]);
      setItems(days);
      setCheckins(cis);
    })();
  }, []);

  const filtered = useMemo(() => {
    // Keep last `range` days using local-day strings (yyyy-MM-dd)
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - (range - 1));
    const fromKey = getLocalDayString(from);
    return items.filter(i => i.date >= fromKey);
  }, [items, range]);

  const filteredCheckins = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - (range - 1));
    const fromKey = getLocalDayString(from);
    return checkins.filter(c => c.date >= fromKey);
  }, [checkins, range]);

  // Real counts come from check-ins within range
  const moodCounts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const ci of filteredCheckins) {
      c[ci.mood_value as number] = (c[ci.mood_value as number] || 0) + 1;
    }
    return [1, 2, 3, 4, 5].map(v => ({ mood: v, count: c[v] || 0 }));
  }, [filteredCheckins]);

  const trendData = useMemo(() => {
    // Build a map to the last check-in mood per day
    const lastByDate = new Map<string, number | null>();
    for (const ci of filteredCheckins) {
      const existing = lastByDate.get(ci.date);
      // assume checkins are not guaranteed sorted; use occurred_at
      const ts = ci.occurred_at ? new Date(ci.occurred_at).getTime() : 0;
      const prevTs = (existing as any)?.ts || -1;
      if (!lastByDate.has(ci.date) || ts > prevTs) {
        (lastByDate as any).set(ci.date, { v: ci.mood_value, ts });
      }
    }
    const days: string[] = [];
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(getLocalDayString(d));
    }
    const dayBaseMood = new Map(filtered.map(i => [i.date, i.mood_value || null] as const));
    return days.map(date => {
      const last = (lastByDate.get(date) as any)?.v ?? null;
      const base = dayBaseMood.get(date) ?? null;
      return { date, value: last ?? base };
    });
  }, [filtered, filteredCheckins, range]);

  const topTags = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of filtered) {
      for (const t of d.tags || []) map[t] = (map[t] || 0) + 1;
    }
    const sorted = Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const maxCount = sorted[0]?.[1] || 1;
    return sorted.map(([tagId, count]) => ({ 
      tagId, 
      name: tagId.replace('_', ' '), 
      count,
      percentage: (count / maxCount) * 100
    }));
  }, [filtered]);

  const totalCheckins = useMemo(() => moodCounts.reduce((s, m) => s + m.count, 0), [moodCounts]);

  const moodColors: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#f59e0b", 4: "#10b981", 5: "#22c55e" };

  return (
    <div className="space-y-4">
      {/* Mood trend */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid relative">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">
            {language === 'ar' ? 'اتجاه المزاج' : 'Mood Trend'}
            <span className="ml-2 opacity-60">{language === 'ar' ? 'اضغط على المخطط لرؤية المزيد' : 'Tap on the chart to see more'}</span>
          </div>
          <div className="flex items-center gap-2">
            {[7,14,30].map((r) => (
              <button key={r} onClick={() => setRange(r as 7|14|30)} className={`px-2.5 py-1 rounded-md border text-xs ${range===r? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        {/* Left mood color legend like screenshot */}
        <div className="absolute left-2 top-14 flex flex-col gap-2 opacity-80">
          {[1,2,3,4,5].map(m => (
            <span key={`ylegend-${m}`} className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: moodColors[m] }} />
          ))}
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
              <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} width={28} />
              <Tooltip formatter={(v: any) => v ?? '—'} labelFormatter={(l) => l} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#22c55e"
                strokeWidth={2}
                connectNulls
                isAnimationActive={false}
                activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 1 }}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload?.value == null) return null;
                  const mood = Number(payload.value) as 1|2|3|4|5;
                  const fill = (moodColors as any)[mood] || '#999';
                  return <circle cx={cx} cy={cy} r={4} fill={fill} stroke="none" />
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mood count donut */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="text-sm mb-3 text-muted-foreground">
          {language === 'ar' ? 'عدد المزاج' : 'Mood Count'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={moodCounts} dataKey="count" nameKey="mood" innerRadius={55} outerRadius={75} paddingAngle={2} stroke="#ffffff" strokeOpacity={0.9} startAngle={180} endAngle={0}>
                  {moodCounts.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={moodColors[entry.mood]} />
                  ))}
                  <Label position="center" content={() => (
                    <text x={0} y={0} textAnchor="middle" dominantBaseline="central" className="fill-foreground">
                      <tspan fontSize="20" fontWeight={600}>{totalCheckins}</tspan>
                    </text>
                  )} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-start gap-3 flex-wrap">
            {[1,2,3,4,5].map((m) => (
              <div key={`legend-${m}`} className="flex items-center gap-2">
                <MoodFace value={m as MoodValue} size={28} active />
                <span className="text-sm">{moodCounts.find(x=>x.mood===m)?.count || 0}</span>
              </div>
            ))}
          </div>
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
          <div className="space-y-3">
            {topTags.map((tag) => (
              <div key={tag.tagId} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-lg"><TagIcon id={tag.tagId} /></span>
                    <span className="font-medium capitalize">{tag.name}</span>
                  </div>
                  <span className="text-muted-foreground font-semibold">{tag.count}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                    style={{ width: `${tag.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
