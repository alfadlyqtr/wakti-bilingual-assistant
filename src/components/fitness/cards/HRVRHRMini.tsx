import React from "react";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";

export function HRVRHRMini({ data }: { data: { date: string; hrv?: number | null; rhr?: number | null }[] }) {
  const chartData = data.map(d => ({
    name: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    hrv: d.hrv ?? null,
    rhr: d.rhr ?? null,
  }));
  return (
    <Card className="rounded-2xl p-4 shadow-sm bg-white/5">
      <div className="text-xs text-muted-foreground mb-2">HRV / RHR (7d)</div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip />
            <Line type="monotone" dataKey="hrv" stroke="#10b981" strokeWidth={2} dot={false} name="HRV" />
            <Line type="monotone" dataKey="rhr" stroke="#ef4444" strokeWidth={2} dot={false} name="RHR" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
