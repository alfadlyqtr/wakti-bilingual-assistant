import React from "react";
import { Card } from "@/components/ui/card";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

export function StrainCard({ value, trainingLoad, avgHrBpm }: { value?: number | null; trainingLoad?: number | null; avgHrBpm?: number | null }) {
  const v = typeof value === 'number' ? Math.max(0, Math.min(21, value)) : null;
  const pct = v != null ? Math.round((v / 21) * 100) : 0;
  const data = [{ name: 'strain', value: pct }];
  return (
    <Card className="rounded-2xl p-4 shadow-sm bg-white/5">
      <div className="text-xs text-muted-foreground mb-2">Day Strain</div>
      <div className="h-28 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={data} innerRadius="70%" outerRadius="90%" startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0,100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={10} fill="#6366f1" background />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-semibold">{v != null ? v.toFixed(1) : "--"}</div>
          <div className="text-[10px] text-muted-foreground">0–21 scale</div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        <span className="px-2 py-[2px] rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Load {typeof trainingLoad==='number' ? Math.round(trainingLoad*10)/10 : "--"}</span>
        <span className="px-2 py-[2px] rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Avg HR {typeof avgHrBpm==='number' ? Math.round(avgHrBpm) : "--"} bpm</span>
      </div>
    </Card>
  );
}
