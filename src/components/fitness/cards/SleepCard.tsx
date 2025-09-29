import React from "react";
import { Card } from "@/components/ui/card";
import { RadialBar, RadialBarChart, PolarAngleAxis, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export type SleepStages = { deep: number; rem: number; light: number; total: number };
export type SleepCardProps = {
  hours?: number | null;
  performancePct?: number | null;
  stages?: SleepStages | null;
  goalHours?: number; // default 8
};

const colors = {
  deep: "#6b5bff",
  rem: "#00bcd4",
  light: "#a0aec0",
};

export function SleepCard({ hours, performancePct, stages, goalHours = 8 }: SleepCardProps) {
  const hrs = hours ?? 0;
  const pctOfGoal = Math.max(0, Math.min(100, Math.round(((hrs || 0) / goalHours) * 100)));
  const radial = [{ name: "sleep", value: pctOfGoal }];
  const stageData = stages && stages.total > 0 ? [
    { name: "Deep", value: Math.round(stages.deep / 60000), fill: colors.deep },
    { name: "REM", value: Math.round(stages.rem / 60000), fill: colors.rem },
    { name: "Light", value: Math.round(stages.light / 60000), fill: colors.light },
  ] : [];

  return (
    <Card className="rounded-2xl p-4 shadow-sm bg-white/5">
      <div className="text-xs text-muted-foreground mb-2">Sleep (Last Night)</div>
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart data={radial} innerRadius="70%" outerRadius="90%" startAngle={90} endAngle={-270}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" cornerRadius={10} fill="#7c3aed" background />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-center -mt-16">
            <div className="text-2xl font-semibold">{hrs ? `${hrs.toFixed(1)}h` : "--"}</div>
            <div className="text-xs text-muted-foreground">{pctOfGoal}% of {goalHours}h</div>
          </div>
        </div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stageData} layout="vertical" margin={{ left: 20, right: 10, top: 5, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={40} />
              <Tooltip formatter={(v: any) => [`${v} min`, ""]} />
              <Bar dataKey="value" radius={[6, 6, 6, 6]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-[10px] text-muted-foreground text-right">{performancePct ? `${Math.round(performancePct)}% perf.` : ""}</div>
        </div>
      </div>
    </Card>
  );
}
