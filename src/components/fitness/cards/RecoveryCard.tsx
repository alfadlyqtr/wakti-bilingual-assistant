import React from "react";
import { Card } from "@/components/ui/card";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

export function RecoveryCard({ value }: { value?: number | null }) {
  const pct = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  const color = pct >= 67 ? "#10b981" : pct >= 34 ? "#f59e0b" : "#ef4444";
  const data = [{ name: "recovery", value: pct }];
  return (
    <Card className="rounded-2xl p-4 shadow-sm bg-white/5">
      <div className="text-xs text-muted-foreground mb-2">Recovery</div>
      <div className="h-28 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={data} innerRadius="70%" outerRadius="90%" startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0,100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={10} fill={color} background />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-semibold">{isNaN(pct) ? "--" : `${pct}%`}</div>
          <div className="text-[10px] text-muted-foreground">readiness</div>
        </div>
      </div>
    </Card>
  );
}
