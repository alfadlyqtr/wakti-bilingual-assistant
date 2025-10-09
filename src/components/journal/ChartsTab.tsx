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
  const [range, setRange] = useState<7 | 14 | 30>(7);

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

  const trendData = useMemo(() => {
    // Build a complete map of all days in range
    const days: string[] = [];
    const now = new Date();
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push(getLocalDayString(d));
    }
    
    // Get the most recent check-in mood value for each day
    const checkinMoodByDate = new Map<string, { mood: number; time: number }>();
    for (const ci of filteredCheckins) {
      if (!ci.date || ci.mood_value == null) continue;
      const timestamp = ci.occurred_at ? new Date(ci.occurred_at).getTime() : 0;
      const existing = checkinMoodByDate.get(ci.date);
      
      // Keep the most recent check-in for this day
      if (!existing || timestamp > existing.time) {
        checkinMoodByDate.set(ci.date, { mood: ci.mood_value as number, time: timestamp });
      }
    }
    
    // Get base mood from journal days (fallback if no check-ins)
    const dayBaseMood = new Map<string, number>();
    for (const day of filtered) {
      if (day.date && day.mood_value != null) {
        dayBaseMood.set(day.date, day.mood_value as number);
      }
    }
    
    // Build trend data: prefer check-in mood over day base mood
    return days.map(date => {
      const checkinData = checkinMoodByDate.get(date);
      const baseMood = dayBaseMood.get(date);
      const value = checkinData ? checkinData.mood : (baseMood ?? null);
      return { date, value };
    });
  }, [filtered, filteredCheckins, range]);

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
      name: tagId.replace(/_/g, ' '), // Replace all underscores
      count,
      percentage: (count / maxCount) * 100
    }));
  }, [filtered]);

  const totalCheckins = useMemo(() => moodCounts.reduce((s, m) => s + m.count, 0), [moodCounts]);

  const moodColors: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#10b981", 5: "#22c55e" };

  const moodLabels: Record<MoodValue, string> = {
    1: language === 'ar' ? 'سيئ جداً' : 'awful',
    2: language === 'ar' ? 'سيئ' : 'bad',
    3: language === 'ar' ? 'عادي' : 'meh',
    4: language === 'ar' ? 'جيد' : 'good',
    5: language === 'ar' ? 'ممتاز' : 'rad',
  };

  return (
    <div className="space-y-4">
      {/* Mood trend */}
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid relative">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">
            {language === 'ar' ? 'اتجاه المزاج' : 'Mood Trend'}
          </div>
          <div className="flex items-center gap-2">
            {[7,14,30].map((r) => (
              <button key={r} onClick={() => setRange(r as 7|14|30)} className={`px-2.5 py-1 rounded-md border text-xs ${range===r? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-border'}`}>
                {r}d
              </button>
            ))}
          </div>
        </div>
        <div className="h-64 relative pl-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 20, right: 20, left: 10, bottom: 30 }}>
              <defs>
                {/* Gradient fill that transitions through mood colors */}
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="25%" stopColor="#10b981" stopOpacity={0.25}/>
                  <stop offset="50%" stopColor="#eab308" stopOpacity={0.2}/>
                  <stop offset="75%" stopColor="#f97316" stopOpacity={0.15}/>
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                opacity={0.2}
                vertical={false}
              />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                tickFormatter={(val) => {
                  const d = new Date(val);
                  return d.getDate().toString();
                }}
                stroke="hsl(var(--border))"
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
              />
              <YAxis 
                domain={[1, 5]} 
                ticks={[1, 2, 3, 4, 5]} 
                tick={false}
                width={0}
                axisLine={false}
              />
              <Tooltip 
                formatter={(v: any) => v ? moodLabels[v as MoodValue] : '—'} 
                labelFormatter={(l) => {
                  const d = new Date(l);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
                contentStyle={{ 
                  fontSize: '11px',
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="none"
                fill="url(#areaGradient)"
                fillOpacity={0.8}
                connectNulls
                isAnimationActive={true}
                animationDuration={800}
              />
              <Line
                type="monotone"
                dataKey="value"
                strokeWidth={3}
                connectNulls
                isAnimationActive={true}
                animationDuration={1000}
                stroke="#10b981"
                activeDot={{ r: 7, strokeWidth: 2, fill: '#fff' }}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload?.value == null) return null;
                  const mood = Number(payload.value) as MoodValue;
                  const color = moodColors[mood];
                  return (
                    <circle 
                      cx={cx} 
                      cy={cy} 
                      r={8} 
                      fill={color}
                      stroke="#fff"
                      strokeWidth={2.5}
                      style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                    />
                  );
                }}
              />
            </LineChart>
          </ResponsiveContainer>
          {/* Mood legend on left - aligned with Y-axis positions */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between py-5">
            {[5, 4, 3, 2, 1].map(m => (
              <div key={`legend-${m}`} className="flex items-center justify-center" style={{ width: 28, height: 28 }}>
                <MoodFace value={m as MoodValue} size={28} />
              </div>
            ))}
          </div>
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
            {topTags.map((tag, index) => (
              <div key={tag.tagId} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-lg"><TagIcon id={tag.tagId} /></span>
                    <span className="font-medium capitalize">{tag.name}</span>
                  </div>
                  <span className="text-muted-foreground font-semibold">{tag.count}</span>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="absolute inset-0 h-full bg-gradient-to-r from-primary to-primary/80 rounded-full origin-left"
                    style={{ 
                      transform: `scaleX(${tag.percentage / 100})`,
                      transition: `transform 0.6s ease-out ${index * 0.1}s`
                    }}
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
