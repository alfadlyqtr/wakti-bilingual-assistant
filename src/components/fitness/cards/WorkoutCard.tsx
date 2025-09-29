import React from "react";
import { Card } from "@/components/ui/card";

type Workout = {
  start?: string;
  end?: string;
  sport_name?: string | null;
  strain?: number | null;
  data?: any;
};

export function WorkoutCard({ workout }: { workout?: Workout | null }) {
  const w = workout || {};
  const start = w.start ? new Date(w.start) : null;
  const end = w.end ? new Date(w.end) : null;
  const durMin = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
  const kcal = w?.data?.score?.kilojoule ? Math.round((w.data.score.kilojoule || 0) / 4.184) : null;

  const zones = w?.data?.score?.zone_durations || null; // map of zone->milliseconds
  const zoneKeys = zones ? Object.keys(zones) : [];
  const totalZone = zones ? zoneKeys.reduce((a, k) => a + (zones[k] || 0), 0) : 0;

  return (
    <Card className="rounded-2xl p-4 shadow-sm bg-white/5">
      <div className="text-xs text-muted-foreground mb-2">Latest Workout</div>
      {workout ? (
        <div className="space-y-2">
          <div className="text-lg font-semibold">{w.sport_name || 'Workout'}</div>
          <div className="text-xs text-muted-foreground">
            {durMin != null ? `${durMin} min` : '--'} • Strain {w.strain != null ? w.strain.toFixed(1) : '--'} • {kcal != null ? `${kcal} kcal` : '--'}
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
