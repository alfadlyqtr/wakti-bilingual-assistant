import React from "react";
import { Card } from "@/components/ui/card";
import { Bed, AlarmClock, Sparkles } from "lucide-react";
import { RadialBar, RadialBarChart, PolarAngleAxis, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export type SleepStages = { deep: number; rem: number; light: number; total: number };
export type SleepCardProps = {
  hours?: number | null;
  performancePct?: number | null;
  stages?: SleepStages | null;
  goalHours?: number; // default 8
  bedtime?: string | null; // ISO
  waketime?: string | null; // ISO
  nap?: boolean | null;
  efficiencyPct?: number | null; // asleep / in-bed
  avgHours7d?: number | null;
  miniHours?: number | null; // for week/day toggle
  miniLabel?: string; // label for mini ring: 'avg' | 'today'
};

const colors = {
  deep: "#6b5bff",
  rem: "#00bcd4",
  light: "#a0aec0",
};

export function SleepCard({ hours, performancePct, stages, goalHours = 8, bedtime, waketime, nap, efficiencyPct, avgHours7d, miniHours, miniLabel = 'avg' }: SleepCardProps) {
  const hrs = hours ?? 0;
  const pctOfGoal = Math.max(0, Math.min(100, Math.round(((hrs || 0) / goalHours) * 100)));
  const radial = [{ name: "sleep", value: pctOfGoal }];
  const stageData = stages && stages.total > 0 ? [
    { name: "Deep", value: Math.round(stages.deep / 60000), fill: colors.deep },
    { name: "REM", value: Math.round(stages.rem / 60000), fill: colors.rem },
    { name: "Light", value: Math.round(stages.light / 60000), fill: colors.light },
  ] : [];
  const bedStr = bedtime ? new Date(bedtime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const wakeStr = waketime ? new Date(waketime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
  const effStr = typeof efficiencyPct === 'number' ? `${Math.round(efficiencyPct)}%` : null;

  return (
    <Card className="rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-muted-foreground">Sleep (Last Night)</div>
        {nap ? <div className="text-[10px] px-2 py-[2px] rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">Nap</div> : null}
      </div>
      <div className="grid grid-cols-2 gap-3 items-center min-w-0">
        <div className="h-36 relative min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart data={radial} innerRadius="72%" outerRadius="92%" startAngle={90} endAngle={-270}>
              <defs>
                <linearGradient id="sleepGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={14} fill="url(#sleepGrad)" background />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-semibold leading-none">{hrs ? `${hrs.toFixed(1)}h` : "--"}</div>
            <div className="text-[11px] text-muted-foreground mt-1">{pctOfGoal}% of {goalHours}h</div>
          </div>
          {typeof (miniHours ?? avgHours7d) === 'number' ? (
            <MiniAvgRing pct={Math.max(0, Math.min(100, Math.round((((miniHours ?? avgHours7d) || 0)/goalHours)*100)))} label={miniLabel} />
          ) : null}
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageData} layout="vertical" margin={{ left: 24, right: 12, top: 5, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={40} />
              <Tooltip formatter={(v: any, _n: any, p: any) => {
                const total = stageData.reduce((a, x) => a + x.value, 0) || 1;
                const pct = Math.round((v / total) * 100);
                return [`${v} min (${pct}%)`, p?.payload?.name];
              }} />
              <Bar dataKey="value" radius={[6, 6, 6, 6]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
            <div className="truncate flex items-center gap-1">{bedStr ? (<><Bed className="h-3 w-3" />{bedStr}</>) : ""}</div>
            <div className="truncate flex items-center gap-1">{wakeStr ? (<><AlarmClock className="h-3 w-3" />{wakeStr}</>) : ""}</div>
          </div>
          <div className="text-[11px] text-muted-foreground text-right flex items-center justify-end gap-1">{effStr ? (<><Sparkles className="h-3 w-3" />{`Efficiency ${effStr}`}</>) : (performancePct ? `${Math.round(performancePct)}% perf.` : "")}</div>
        </div>
      </div>
    </Card>
  );
}

function MiniAvgRing({ pct, label = 'avg' }: { pct: number; label?: string }) {
  return (
    <div className="absolute -bottom-1 right-0 h-14 w-14">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart data={[{ name: 'avg', value: pct }]} innerRadius="70%" outerRadius="90%" startAngle={90} endAngle={-270}>
          <defs>
            <linearGradient id="sleepAvgGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#d1c4ff" />
              <stop offset="100%" stopColor="#c4b5fd" />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={12} fill="url(#sleepAvgGrad)" background />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">{label}</div>
    </div>
  );
}
