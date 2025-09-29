import React from "react";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

type Workout = {
  start?: string;
  end?: string;
  sport_name?: string | null;
  strain?: number | null;
  data?: any;
};

export function WorkoutCard({ workout, history = [], range = 'day' as 'day'|'week' }: { workout?: Workout | null; history?: { start: string; strain?: number | null; kcal?: number | null }[]; range?: 'day'|'week' }) {
  const w = workout || {};
  const start = w.start ? new Date(w.start) : null;
  const end = w.end ? new Date(w.end) : null;
  const durMin = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
  const kcal = w?.data?.score?.kilojoule ? Math.round((w.data.score.kilojoule || 0) / 4.184) : null;
  const avgHr = w?.data?.score?.average_heart_rate ?? null;
  const maxHr = w?.data?.score?.max_heart_rate ?? null;
  const distM = w?.data?.score?.distance_meter ?? null;

  const zones = w?.data?.score?.zone_durations || null; // map of zone->milliseconds
  const zoneKeys = zones ? Object.keys(zones) : [];
  const totalZone = zones ? zoneKeys.reduce((a, k) => a + (zones[k] || 0), 0) : 0;

  const chartData = (history || []).map(h => ({
    name: new Date(h.start).toLocaleDateString(undefined,{ month:'short', day:'numeric'}),
    Strain: typeof h.strain==='number' ? Math.round(h.strain*10)/10 : null,
    Calories: h.kcal ?? null,
  }));

  return (
    <Card className="rounded-2xl p-4 border border-white/10 bg-white/5 backdrop-blur-md shadow-[0_10px_30px_-10px_rgba(0,0,0,0.25)]">
      <div className="text-xs text-muted-foreground mb-2">Workout</div>
      {range==='week' ? (
        <div className="h-40 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 12, bottom: 4 }}>
              <defs>
                <linearGradient id="strainStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="calStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e5e7eb22" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis hide />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }} />
              <Legend wrapperStyle={{ paddingTop: 4 }} />
              <Line type="monotone" dataKey="Strain" stroke="url(#strainStroke)" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Calories" stroke="url(#calStroke)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : workout ? (
        <div className="space-y-2">
          <div className="text-lg font-semibold">{w.sport_name || 'Workout'}</div>
          <div className="text-xs text-muted-foreground">
            {durMin != null ? `${durMin} min` : '--'} • Strain {w.strain != null ? w.strain.toFixed(1) : '--'} • {kcal != null ? `${kcal} kcal` : '--'}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-[2px] rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">Avg HR {avgHr != null ? Math.round(avgHr) : '--'} bpm</span>
            <span className="px-2 py-[2px] rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">Max HR {maxHr != null ? Math.round(maxHr) : '--'} bpm</span>
            <span className="px-2 py-[2px] rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">Distance {distM != null ? Math.round(distM/100)/10 : '--'} km</span>
          </div>
          {zones && totalZone > 0 && (
            <div className="mt-2 h-2 w-full rounded-full bg-white/10 overflow-hidden flex">
              {zoneKeys.map((k) => {
                const frac = (zones[k] || 0) / totalZone;
                const width = `${Math.max(0.01, frac) * 100}%`;
                const color = zoneColor(k);
                return <div key={k} style={{ width }} className={color} title={`${k}: ${Math.round((zones[k]||0)/60000)} min`} />;
              })}
            </div>
          )}
          <Accordion type="single" collapsible className="pt-2">
            <AccordionItem value="details">
              <AccordionTrigger className="text-xs">Details</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="text-muted-foreground">strain</div><div className="font-medium">{w.strain != null ? w.strain.toFixed(1) : '--'}</div>
                  <div className="text-muted-foreground">avg_hr</div><div className="font-medium">{avgHr != null ? Math.round(avgHr) : '--'}</div>
                  <div className="text-muted-foreground">max_hr</div><div className="font-medium">{maxHr != null ? Math.round(maxHr) : '--'}</div>
                  <div className="text-muted-foreground">kcal</div><div className="font-medium">{kcal != null ? kcal : '--'}</div>
                  <div className="text-muted-foreground">distance_km</div><div className="font-medium">{distM != null ? Math.round(distM/100)/10 : '--'}</div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">--</div>
      )}
    </Card>
  );
}

function zoneColor(k: string) {
  switch (k.toLowerCase()) {
    case 'zone_zero':
    case 'zone0':
      return 'bg-slate-400';
    case 'zone_one':
    case 'zone1':
      return 'bg-emerald-400';
    case 'zone_two':
    case 'zone2':
      return 'bg-lime-400';
    case 'zone_three':
    case 'zone3':
      return 'bg-yellow-400';
    case 'zone_four':
    case 'zone4':
      return 'bg-orange-400';
    case 'zone_five':
    case 'zone5':
      return 'bg-rose-500';
    default:
      return 'bg-purple-400';
  }
}
