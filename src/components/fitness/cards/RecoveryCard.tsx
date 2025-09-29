import React from "react";
import { Card } from "@/components/ui/card";
import { Activity, HeartPulse } from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

export function RecoveryCard({ value, hrvMs, rhrBpm, avgPct7d, miniPct, miniLabel = 'avg' }: { value?: number | null; hrvMs?: number | null; rhrBpm?: number | null; avgPct7d?: number | null; miniPct?: number | null; miniLabel?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value ?? 0)));
  const color = pct >= 67 ? "#10b981" : pct >= 34 ? "#f59e0b" : "#ef4444";
  const data = [{ name: "recovery", value: pct }];
  const badgeMainLabel = miniLabel === 'avg' ? 'today' : 'avg';
  const miniVal = (miniPct ?? avgPct7d) ?? null;
  return (
    <Card className="rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]">
      <div className="text-xs text-muted-foreground mb-2">Recovery</div>
      <div className="h-36 relative min-w-0">
        {/* soft radial glow */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full blur-2xl" style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.18), rgba(132,204,22,0.06) 60%, transparent 70%)' }} />
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={data} innerRadius="72%" outerRadius="92%" startAngle={90} endAngle={-270}>
            <defs>
              <linearGradient id="recGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#84cc16" />
              </linearGradient>
            </defs>
            <PolarAngleAxis type="number" domain={[0,100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={14} fill={value!=null?"url(#recGrad)":color} background />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-semibold">{isNaN(pct) ? "--" : `${pct}%`}</div>
          <div className="text-[11px] text-muted-foreground">readiness</div>
        </div>
        {typeof (miniPct ?? avgPct7d) === 'number' ? <MiniAvgRing pct={Math.max(0, Math.min(100, Math.round((miniPct ?? avgPct7d)!)))} gradId="recAvgGrad" from="#bbf7d0" to="#a7f3d0" label={miniLabel} /> : null}
        {/* value badges */}
        <div className="absolute -top-1 left-0 flex gap-2 text-[11px]">
          <span className="px-2 py-[2px] rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">{badgeMainLabel} {isNaN(pct)?'--':`${pct}%`}</span>
          {miniVal != null ? (
            <span className="px-2 py-[2px] rounded-full bg-lime-500/10 text-lime-600 border border-lime-500/20">{miniLabel} {Math.round(miniVal)}%</span>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="px-2 py-[2px] rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1"><Activity className="h-3 w-3" />HRV {hrvMs != null ? Math.round(hrvMs) : "--"} ms</span>
        <span className="px-2 py-[2px] rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/20 flex items-center gap-1"><HeartPulse className="h-3 w-3" />RHR {rhrBpm != null ? Math.round(rhrBpm) : "--"} bpm</span>
      </div>
    </Card>
  );
}

function MiniAvgRing({ pct, gradId, from, to, label }: { pct: number; gradId: string; from: string; to: string; label: string }) {
  return (
    <div className="absolute -bottom-1 right-0 h-14 w-14">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart data={[{ name: 'avg', value: pct }]} innerRadius="70%" outerRadius="90%" startAngle={90} endAngle={-270}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={from} />
              <stop offset="100%" stopColor={to} />
            </linearGradient>
          </defs>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={12} fill={`url(#${gradId})`} background />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">{label}</div>
    </div>
  );
}
