import React from "react";
import { Card } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export function HRVRHRMini({ data }: { data: { date: string; hrv?: number | null; rhr?: number | null }[] }) {
  const chartData = data.map(d => ({
    name: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    hrv: d.hrv ?? null,
    rhr: d.rhr ?? null,
  }));
  return (
    <Card className="rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-muted-foreground">HRV / RHR (7d)</div>
      </div>
      <div className="h-32 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 8, right: 12, top: 8, bottom: 4 }}>
            <defs>
              <linearGradient id="hrvStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#34d399" stopOpacity={0.9} />
              </linearGradient>
              <linearGradient id="rhrStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#fb7185" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e5e7eb22" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} tickMargin={6} />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }} formatter={(v:any, n:any)=>[v, n==='hrv'?'HRV':'RHR']} />
            <Legend wrapperStyle={{ paddingTop: 4 }} formatter={(v)=>{
              return (
                <span className="px-2 py-[2px] rounded-full text-xs" style={{
                  backgroundColor: v==='hrv'? 'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)',
                  color: v==='hrv'? '#10b981':'#ef4444',
                  border: `1px solid ${v==='hrv'?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)'}`
                }}>{v==='hrv'? 'HRV' : 'RHR'}</span>
              ) as any;
            }} />
            <Line type="monotone" dataKey="hrv" stroke="url(#hrvStroke)" strokeWidth={2.5} dot={false} name="hrv" />
            <Line type="monotone" dataKey="rhr" stroke="url(#rhrStroke)" strokeWidth={2.5} dot={false} name="rhr" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
