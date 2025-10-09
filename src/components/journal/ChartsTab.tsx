import React, { useEffect, useMemo, useState } from "react";
import { JournalService, JournalDay, JournalCheckin } from "@/services/journalService";
import { useTheme } from "@/providers/ThemeProvider";
import { MoodFace, MoodValue } from "./icons/MoodFaces";
import { TagIcon } from "./TagIcon";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Label,
  LabelList
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
  const [range, setRange] = useState<1 | 7 | 14 | 30>(7);

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

  // Count all check-ins by mood value within the selected range
  const moodCounts = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    for (const checkin of filteredCheckins) {
      if (checkin.mood_value != null && checkin.mood_value >= 1 && checkin.mood_value <= 5) {
        counts[checkin.mood_value] = (counts[checkin.mood_value] || 0) + 1;
      }
    }
    
    return [1, 2, 3, 4, 5].map(value => ({ 
      mood: value,
      count: counts[value] 
    }));
  }, [filteredCheckins]);

  // Order rows as 5 (top) -> 1 (bottom) so low mood ends at the bottom
  const moodCountsOrdered = useMemo(() => {
    return [...moodCounts].sort((a, b) => b.mood - a.mood);
  }, [moodCounts]);

  const trendData = useMemo(() => {
    // Use real data: get the most frequent mood per day from actual check-ins
    const now = new Date();
    const points: { day: number; value: number | null }[] = [];
    
    // Create day range (1, 2, 3, 4, 5, 6, 7...)
    for (let i = 0; i < range; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - (range - 1 - i));
      const dayStr = getLocalDayString(d);
      
      // Find check-ins for this day
      const dayCheckins = filteredCheckins.filter(ci => ci.date === dayStr);
      
      let dayMood: number | null = null;
      if (dayCheckins.length > 0) {
        // Get most frequent mood for this day
        const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        dayCheckins.forEach(ci => {
          const mv = Number(ci.mood_value);
          if (mv >= 1 && mv <= 5) counts[mv]++;
        });
        
        // Find mode (most frequent)
        let maxCount = 0;
        for (let m = 1; m <= 5; m++) {
          if (counts[m] > maxCount) {
            maxCount = counts[m];
            dayMood = m;
          }
        }
      } else {
        // Fallback to base day mood
        const dayEntry = filtered.find(day => day.date === dayStr);
        if (dayEntry?.mood_value) {
          dayMood = dayEntry.mood_value as number;
        }
      }
      
      points.push({ day: i + 1, value: dayMood });
    }
    
    return points;
  }, [filteredCheckins, filtered, range]);

  // xTicks no longer needed (we render continuous time axis)
  const topTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    // Count all tags from journal days in the selected range
    for (const day of filtered) {
      if (day.tags && Array.isArray(day.tags)) {
        for (const tag of day.tags) {
          if (tag) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        }
      }
    }

    // Sort by count and take top 6
    const sortedTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const maxCount = sortedTags[0]?.[1] || 1;

    return sortedTags.map(([tagId, count]) => ({
      tagId,
      name: tagId.replace(/_/g, ' '),
      count,
      percentage: (count / maxCount) * 100
    }));
  }, [filtered]);

  const totalCheckins = useMemo(() => moodCounts.reduce((s, m) => s + m.count, 0), [moodCounts]);
  const barMax = useMemo(() => {
    const maxVal = Math.max(1, ...moodCounts.map(m => m.count));
    const nice = Math.ceil(maxVal / 5) * 5; // step to 5s
    return Math.max(5, nice);
  }, [moodCounts]);

  const xTicks = useMemo(() => {
    const step = barMax <= 10 ? 1 : 5;
    const ticks: number[] = [];
    for (let n = 0; n <= barMax; n += step) ticks.push(n);
    return ticks;
  }, [barMax]);


  const moodPercents = useMemo(() => {
    return moodCounts.map(m => ({ mood: m.mood, percent: totalCheckins ? Math.round((m.count * 100) / totalCheckins) : 0 }));
  }, [moodCounts, totalCheckins]);

  // Total top tag count for percentage in table
  const topTagsTotal = useMemo(() => topTags.reduce((s, t) => s + t.count, 0), [topTags]);

  const moodColors: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#10b981", 5: "#22c55e" };

  const moodLabels: Record<MoodValue, string> = {
    1: language === 'ar' ? 'سيئ جداً' : 'awful',
    2: language === 'ar' ? 'سيئ' : 'bad',
    3: language === 'ar' ? 'عادي' : 'meh',
    4: language === 'ar' ? 'جيد' : 'good',
    5: language === 'ar' ? 'ممتاز' : 'rad',
  };

  // Custom pie label to ensure all percentages are visible (rendered outside each slice)
  const RADIAN = Math.PI / 180;
  const renderPieLabel = ({ cx, cy, midAngle, outerRadius, percent, payload }: any) => {
    if (percent == null) return null;
    const radius = (outerRadius || 0) + 18;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const p = Math.round((percent || 0) * 100);
    if (p <= 0) return null;
    const moodVal = (payload?.mood as number) || 0;
    const fill = moodColors[moodVal] || 'hsl(var(--foreground))';
    const name = moodLabels[moodVal as MoodValue] || '';
    return (
      <text x={x} y={y} fill={fill} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
        {name ? `${name} ${p}%` : `${p}%`}
      </text>
    );
  };

  return (
    <div className="space-y-4">
      {/* Mood trend */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid relative">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">
            {language === 'ar' ? 'تكرار المزاج' : 'Mood Frequency'}
          </div>
          <div className="flex items-center gap-2">
            {[1,7,14,30].map((r) => (
              <button key={r} onClick={() => setRange(r as 1|7|14|30)} className={`px-2.5 py-1 rounded-md border text-xs ${range===r? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'}`}>
                {r}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-64 relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={moodCountsOrdered} layout="vertical" margin={{ top: 12, right: 24, left: 16, bottom: 12 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.25} />
              <XAxis type="number" domain={[0, barMax]} ticks={xTicks} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" tickLine={false} axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }} />
              <YAxis type="category" dataKey="mood" width={120} tickMargin={0} tickLine={false} axisLine={false} tick={(props: any) => {
                const { x, y, payload } = props;
                const v = Number(payload?.value) as MoodValue;
                const color = moodColors[v];
                const total = (moodCounts.find(m => m.mood === v)?.count) || 0;
                return (
                  <g transform={`translate(${x - 112}, ${y - 16})`}>
                    <foreignObject width={120} height={32}>
                      <div style={{ width: 120, height: 32, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MoodFace value={v} size={24} />
                        <span style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: color, boxShadow: '0 0 0 2px #ffffff' }} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'hsl(var(--foreground))' }}>{moodLabels[v]}</span>
                        <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>×{total}</span>
                      </div>
                    </foreignObject>
                  </g>
                );
              }} />
              <Tooltip formatter={(val: any, _name: any, info: any) => [`${val}`, language === 'ar' ? 'العدد' : 'count']} labelFormatter={(l) => `${language === 'ar' ? 'المزاج' : 'mood'} ${l}`} contentStyle={{ fontSize: '11px', backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
              <Bar dataKey="count" radius={[0, 8, 8, 0]} isAnimationActive={true} animationDuration={700}>
                {moodCountsOrdered.map((entry, idx) => (
                  <Cell key={`bar-${idx}`} fill={moodColors[entry.mood]} />
                ))}
                <LabelList dataKey="count" position="right" fill="hsl(var(--foreground))" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Mini legend with percentages */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {moodPercents.map(mp => (
            <div key={`pct-${mp.mood}`} className="flex items-center gap-1">
              <span className="inline-block" style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: moodColors[mp.mood] }} />
              <span>{moodLabels[mp.mood as MoodValue]}</span>
              <span className="font-medium text-foreground">{mp.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mood count pie */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="text-sm mb-3 text-muted-foreground">
          {language === 'ar' ? 'عدد المزاج' : 'Mood Count'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 4, right: 44, bottom: 4, left: 44 }}>
                <Pie
                  data={moodCounts}
                  dataKey="count"
                  nameKey="mood"
                  innerRadius={0}
                  outerRadius={78}
                  paddingAngle={1}
                  stroke="#ffffff"
                  strokeWidth={2}
                  label={renderPieLabel}
                  labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                >
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
          <div className="flex items-center justify-start gap-4 flex-wrap">
            {[1,2,3,4,5].map((m) => (
              <div key={`legend-${m}`} className="flex items-center gap-2">
                <MoodFace value={m as MoodValue} size={28} active />
                <span className="text-sm font-medium">{moodLabels[m as MoodValue]}</span>
                <span className="text-sm text-muted-foreground">{moodCounts.find(x=>x.mood===m)?.count || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top activities (clean table) */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="text-sm mb-3 text-muted-foreground">
          {language === 'ar' ? 'أكثر الأنشطة' : 'Top Activities'}
        </div>
        {topTags.length === 0 ? (
          <div className="text-muted-foreground text-sm">
            {language === 'ar' ? 'لا توجد بيانات' : 'No data'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-2 pl-1 pr-2 text-left">#</th>
                  <th className="py-2 px-2 text-left">{language === 'ar' ? 'النشاط' : 'Activity'}</th>
                  <th className="py-2 px-2 text-right">{language === 'ar' ? 'العدد' : 'Count'}</th>
                  <th className="py-2 pl-2 pr-1 text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {topTags.map((tag, idx) => {
                  const pct = topTagsTotal ? Math.round((tag.count * 100) / topTagsTotal) : 0;
                  return (
                    <tr key={tag.tagId} className="border-t border-border/60 hover:bg-muted/40 transition-colors">
                      <td className="py-2 pl-1 pr-2 text-left text-muted-foreground">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base"><TagIcon id={tag.tagId} /></span>
                          <span className="capitalize">{tag.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-medium">{tag.count}</td>
                      <td className="py-2 pl-2 pr-1 text-right text-muted-foreground">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
