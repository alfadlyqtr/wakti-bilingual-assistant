import React from "react";
import { Card } from "@/components/ui/card";
import { Gauge, Flame } from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

export function StrainCard({ value, trainingLoad, avgHrBpm, avg7d }: { value?: number | null; trainingLoad?: number | null; avgHrBpm?: number | null; avg7d?: number | null }) {
  const v = typeof value === 'number' ? Math.max(0, Math.min(21, value)) : null;
  const pct = v != null ? Math.round((v / 21) * 100) : 0;
  const data = [{ name: 'strain', value: pct }];
  return (
    <Card className="rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]">
      <div className="text-xs text-muted-foreground mb-2">Day Strain</div>
      <div className="h-36 relative min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={data} innerRadius="72%" outerRadius="92%" startAngle={90} endAngle={-270}>
            <defs>
              <linearGradient id="strainGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
            <PolarAngleAxis type="number" domain={[0,100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={14} fill="url(#strainGrad)" background />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-semibold">{v != null ? v.toFixed(1) : "--"}</div>
          <div className="text-[11px] text-muted-foreground">0–21 scale</div>
        </div>
        {typeof avg7d === 'number' ? <MiniAvgRing pct={Math.max(0, Math.min(100, Math.round(((avg7d||0)/21)*100)))} /> : null}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        <span className="px-2 py-[2px] rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1"><Gauge className="h-3 w-3" />Load {typeof trainingLoad==='number' ? Math.round(trainingLoad*10)/10 : "--"}</span>
        <span className="px-2 py-[2px] rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1"><Flame className="h-3 w-3" />Avg HR {typeof avgHrBpm==='number' ? Math.round(avgHrBpm) : "--"} bpm</span>
      </div>
    </Card>
  );
}

function MiniAvgRing({ pct }: { pct: number }) {
  return (
    <div className="absolute -bottom-1 right-0 h-14 w-14">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart data={[{ name: 'avg', value: pct }]} innerRadius="70%" outerRadius="90%" startAngle={90} endAngle={-270}>
          <defs>
            <linearGradient id="strainAvgGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#c7d2fe" />
              <stop offset="100%" stopColor="#ddd6fe" />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={12} fill="url(#strainAvgGrad)" background />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">avg</div>
    </div>
  );
}
