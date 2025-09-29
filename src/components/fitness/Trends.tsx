import React, { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { fetchSleepHistory, fetchRecoveryHistory, fetchWorkoutsHistory, fetchCycleHistory } from "@/services/whoopService";

export function Trends() {
  const [range, setRange] = useState<"day"|"week"|"month">("day");
  const [sleep, setSleep] = useState<any[]>([]);
  const [recovery, setRecovery] = useState<any[]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const days = range === 'day' ? 7 : range === 'week' ? 28 : 90;
      const [s, r, w, c] = await Promise.all([
        fetchSleepHistory(Math.min(days, 30)),
        fetchRecoveryHistory(Math.min(days, 30)),
        fetchWorkoutsHistory(days),
        fetchCycleHistory(Math.min(days, 30))
      ]);
      setSleep(s);
      setRecovery(r);
      setWorkouts(w);
      setCycles(c);
    };
    load();
  }, [range]);

  const sleepBars = useMemo(() => (
    sleep.map((d) => ({
      name: new Date(d.start).toLocaleDateString(undefined,{month:'short',day:'numeric'}),
      Deep: Math.round((d.stages.deep||0)/60000),
      REM: Math.round((d.stages.rem||0)/60000),
      Light: Math.round((d.stages.light||0)/60000),
    }))
  ), [sleep]);

  const recoveryLines = useMemo(() => (
    recovery.map((d) => ({
      name: new Date(d.date).toLocaleDateString(undefined,{month:'short',day:'numeric'}),
      Recovery: d.recovery ?? null,
      HRV: d.hrv ?? null,
      RHR: d.rhr ?? null,
    }))
  ), [recovery]);

  const workoutsLines = useMemo(() => (
    workouts.map((w) => ({
      name: new Date(w.start).toLocaleDateString(undefined,{month:'short',day:'numeric'}),
      Strain: w.strain ?? null,
      Calories: w.kcal ?? null,
    }))
  ), [workouts]);

  const weeklyLoad = useMemo(() => {
    // approximate weekly training load from cycles.training_load if available, else strain sum
    const byWeek = new Map<string, { Load: number; AvgHR: number[] }>();
    cycles.forEach((c) => {
      const dt = new Date(c.start);
      const key = `${dt.getFullYear()}-W${weekOfYear(dt)}`;
      const prev = byWeek.get(key) || { Load: 0, AvgHR: [] };
      prev.Load += (typeof c.training_load === 'number' ? c.training_load : (typeof c.day_strain === 'number' ? c.day_strain : 0));
      if (typeof c.avg_hr_bpm === 'number') prev.AvgHR.push(c.avg_hr_bpm);
      byWeek.set(key, prev);
    });
    const keys = Array.from(byWeek.keys()).sort();
    return keys.map((k) => ({
      name: k,
      Load: Math.round(byWeek.get(k)!.Load * 10) / 10,
      "Avg HR": avg(byWeek.get(k)!.AvgHR) || null,
    }));
  }, [cycles]);

  return (
    <Card className="rounded-2xl p-4 shadow-sm bg-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">Trends</div>
        <Tabs value={range} onValueChange={(v)=>setRange(v as any)}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Sleep history (stacked minutes)</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleepBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Deep" stackId="a" fill="#6b5bff" />
                <Bar dataKey="REM" stackId="a" fill="#00bcd4" />
                <Bar dataKey="Light" stackId="a" fill="#a0aec0" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <MiniTip text={sleepTip(sleep)} />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Recovery / HRV / RHR</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recoveryLines}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Recovery" stroke="#10b981" dot={false} />
                <Line type="monotone" dataKey="HRV" stroke="#22c55e" dot={false} />
                <Line type="monotone" dataKey="RHR" stroke="#ef4444" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <MiniTip text={recoveryTip(recovery)} />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <div className="text-xs text-muted-foreground">Workouts (strain & calories)</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={workoutsLines}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Strain" stroke="#6366f1" dot={false} />
                <Line type="monotone" dataKey="Calories" stroke="#f59e0b" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <MiniTip text={workoutTip(workouts)} />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <div className="text-xs text-muted-foreground">Weekly load & Avg HR</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyLoad}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Load" stroke="#7c3aed" dot={false} />
                <Line type="monotone" dataKey="Avg HR" stroke="#ef4444" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  );
}

function avg(arr: number[]) { if (!arr || arr.length===0) return null; return Math.round(arr.reduce((a,b)=>a+b,0)/arr.length); }
function weekOfYear(d: Date) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7; dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  return Math.ceil((((dt as any)- (yearStart as any)) / 86400000 + 1)/7);
}

function MiniTip({ text }: { text: string }) {
  return <div className="text-[11px] text-muted-foreground bg-white/5 border rounded-xl p-2">{text}</div>;
}

function sleepTip(s: any[]) {
  if (!s || s.length===0) return "No recent sleep data.";
  const last = s[s.length-1];
  const hrs = last.hours ?? 0; const goal = 8;
  if (hrs < 7) return "Try sleeping 30–60 minutes earlier tonight to boost recovery.";
  if (hrs >= goal) return "Great job meeting your sleep goal. Keep consistency to improve REM.";
  return "You're close to your sleep goal. Aim for steady bedtimes for more deep sleep.";
}
function recoveryTip(r: any[]) {
  if (!r || r.length===0) return "No recent recovery data.";
  const last = r[r.length-1]?.recovery ?? 0;
  if (last >= 67) return "Recovery is high. Good day to push training.";
  if (last >= 34) return "Moderate recovery. Train smart and watch hydration.";
  return "Low recovery. Prioritize rest, breath work, and light activity.";
}
function workoutTip(w: any[]) {
  if (!w || w.length===0) return "No workouts logged recently.";
  const totalStrain = Math.round((w.reduce((a,b)=>a+(b.strain||0),0))*10)/10;
  return `Last ${w.length} workouts: total strain ${totalStrain}. Keep progressive overload within comfort.`;
}
