// @ts-nocheck
import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp,
  ListChecks, RefreshCw, LayoutGrid, ChevronDown
} from 'lucide-react';
import { TRTask } from '@/services/trService';
import { useTheme } from '@/providers/ThemeProvider';
import { useActivityData, ACCENT_COLORS, TimeRange } from './useActivityData';
import { ActivityUserTable } from './ActivityUserTable';

interface ActivityDashboardProps {
  tasks: TRTask[];
}

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: '1W', value: '1W' },
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
];

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-[11px] font-bold
      bg-[#0c0f14]/95 border border-white/10
      shadow-[0_8px_32px_hsla(0,0%,0%,0.6)] backdrop-blur-xl">
      <p className="text-white/50 mb-1.5 text-[10px]">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-1.5" style={{ color: p.color || p.fill || '#fff' }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
            style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-black ml-0.5">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

export const ActivityDashboard: React.FC<ActivityDashboardProps> = ({ tasks }) => {
  const { language } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const { allTasks, sharedTasks, subtasks, loading, refreshing, loadData, kpis, userStats, getTrendData } = useActivityData(tasks);

  const { taskTrend, subtaskTrend } = useMemo(() => getTrendData(timeRange), [getTrendData, timeRange]);

  const userBarData = useMemo(() =>
    userStats.slice(0, 8).map(u => ({
      name: u.name.split(' ')[0],
      completed: u.completedSubtasks,
      pending: Math.max(0, u.totalSubtasks - u.completedSubtasks),
      color: u.color,
    })), [userStats]);

  const pieData = useMemo(() => [
    { name: language === 'ar' ? 'مكتملة' : 'Completed', value: kpis.completed, color: 'hsl(142,76%,55%)' },
    { name: language === 'ar' ? 'معلقة' : 'Pending', value: kpis.pending, color: 'hsl(210,100%,65%)' },
    { name: language === 'ar' ? 'متأخرة' : 'Late', value: kpis.late, color: 'hsl(25,95%,60%)' },
  ].filter(d => d.value > 0), [kpis, language]);

  const subPct = kpis.totalSub > 0 ? Math.round((kpis.completedSub / kpis.totalSub) * 100) : 0;
  const subLeft = kpis.totalSub - kpis.completedSub;

  // Collapsible section state — only KPIs open by default
  const [openKPIs, setOpenKPIs] = useState(true);
  const [openSubtasks, setOpenSubtasks] = useState(false);
  const [openTaskTrend, setOpenTaskTrend] = useState(false);
  const [openSubtaskTrend, setOpenSubtaskTrend] = useState(false);
  const [openStatus, setOpenStatus] = useState(false);
  const [openUserPerf, setOpenUserPerf] = useState(false);
  const [openUserTable, setOpenUserTable] = useState(false);

  // Per-task subtask breakdown — only tasks that have subtasks
  const taskSubtaskRows = useMemo(() =>
    allTasks
      .map(t => {
        const subs = subtasks[t.id] || [];
        if (subs.length === 0) return null;
        const done = subs.filter(s => s.completed).length;
        const pct = Math.round((done / subs.length) * 100);
        return { id: t.id, title: t.title, total: subs.length, done, pct, taskCompleted: t.completed };
      })
      .filter(Boolean)
      .sort((a, b) => a.pct - b.pct), // least progress first
  [allTasks, subtasks]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200/40 dark:border-white/[0.06]" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#060541] dark:border-t-indigo-500 animate-spin" />
        </div>
        <p className="text-sm font-medium text-muted-foreground/60">
          {language === 'ar' ? 'جارٍ التحميل...' : 'Loading activity...'}
        </p>
      </div>
    );
  }

  if (allTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10
          flex items-center justify-center shadow-[0_8px_32px_hsla(240,80%,50%,0.08)] mb-6">
          <TrendingUp className="h-9 w-9 text-indigo-400 dark:text-indigo-500" />
        </div>
        <p className="text-base font-bold text-foreground mb-2">
          {language === 'ar' ? 'لا توجد مهام بعد' : 'No tasks yet'}
        </p>
        <p className="text-sm text-muted-foreground/70 max-w-[260px] leading-relaxed">
          {language === 'ar' ? 'أنشئ مهمة لبدء تتبع الأداء' : 'Create a task to start tracking performance and activity.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-[13px] font-bold text-foreground">
          {language === 'ar' ? 'لوحة النشاط' : 'Activity Dashboard'}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.06]">
            {TIME_RANGES.map(({ label, value }) => (
              <button key={value} onClick={() => setTimeRange(value)}
                className={`h-6 px-2.5 rounded-lg text-[11px] font-bold transition-all touch-manipulation
                  ${timeRange === value
                    ? 'bg-[#060541] dark:bg-indigo-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => loadData(true)} disabled={refreshing} title="Refresh"
            className="h-8 w-8 rounded-xl flex items-center justify-center
              bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400
              hover:bg-indigo-200 dark:hover:bg-indigo-500/30 disabled:opacity-50
              transition-all touch-manipulation active:scale-95">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <button onClick={() => setOpenKPIs(o => !o)}
        className="w-full flex items-center justify-between px-1 touch-manipulation">
        <p className="text-[12px] font-bold text-muted-foreground/60 uppercase tracking-wider">
          {language === 'ar' ? 'المؤشرات الرئيسية' : 'Key Metrics'}
        </p>
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center border border-slate-200 dark:border-white/10 flex-shrink-0">
          <ChevronDown className={`h-5 w-5 text-foreground/70 transition-transform duration-200 ${openKPIs ? '' : '-rotate-90'}`} />
        </div>
      </button>
      {openKPIs && <div className="grid grid-cols-2 gap-3">
        {/* Row 1: Total + Performance (wide feel) */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-[#060541]/5 to-indigo-100/60 dark:from-indigo-500/20 dark:to-indigo-600/10
          border border-indigo-200/80 dark:border-indigo-500/30
          shadow-[0_4px_20px_hsla(240,80%,50%,0.12)] dark:shadow-[0_4px_28px_hsla(240,80%,50%,0.2)]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <LayoutGrid className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-indigo-400/70 uppercase tracking-wider">
              {language === 'ar' ? 'المجموع' : 'Total'}
            </span>
          </div>
          <p className="text-3xl font-black text-indigo-700 dark:text-indigo-300">{kpis.total}</p>
          <p className="text-[11px] font-semibold text-muted-foreground/70 mt-0.5">
            {language === 'ar' ? 'إجمالي المهام' : 'All Tasks'}
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-gradient-to-br from-purple-50 to-purple-100/60 dark:from-purple-500/20 dark:to-purple-600/10
          border border-purple-200/80 dark:border-purple-500/30
          shadow-[0_4px_20px_hsla(280,70%,55%,0.14)] dark:shadow-[0_4px_28px_hsla(280,70%,55%,0.22)]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <TrendingUp className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-purple-400/70 uppercase tracking-wider">
              {language === 'ar' ? 'الأداء' : 'Score'}
            </span>
          </div>
          <p className={`text-3xl font-black ${kpis.performance >= 70 ? 'text-purple-700 dark:text-purple-300' : kpis.performance >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
            {kpis.performance}%
          </p>
          <p className="text-[11px] font-semibold text-muted-foreground/70 mt-0.5">
            {language === 'ar' ? 'معدل الإنجاز' : 'Completion Rate'}
          </p>
        </div>

        {/* Row 2: Completed + Pending + Late */}
        <div className="rounded-2xl p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-500/20 dark:to-emerald-600/10
          border border-emerald-200/80 dark:border-emerald-500/30
          shadow-[0_4px_20px_hsla(142,76%,45%,0.14)] dark:shadow-[0_4px_28px_hsla(142,76%,45%,0.22)]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider">
              {language === 'ar' ? 'مكتملة' : 'Done'}
            </span>
          </div>
          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300">{kpis.completed}</p>
          <p className="text-[11px] font-semibold text-muted-foreground/70 mt-0.5">
            {language === 'ar' ? 'مهام مكتملة' : 'Completed Tasks'}
          </p>
        </div>

        <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-blue-500/20 dark:to-blue-600/10
          border border-blue-200/80 dark:border-blue-500/30
          shadow-[0_4px_20px_hsla(210,100%,55%,0.14)] dark:shadow-[0_4px_28px_hsla(210,100%,55%,0.22)]">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-blue-400/70 uppercase tracking-wider">
              {language === 'ar' ? 'معلقة' : 'Pending'}
            </span>
          </div>
          <p className="text-3xl font-black text-blue-700 dark:text-blue-300">{kpis.pending}</p>
          <p className="text-[11px] font-semibold text-muted-foreground/70 mt-0.5">
            {language === 'ar' ? 'في الانتظار' : 'In Progress / Waiting'}
          </p>
        </div>
      </div>}

      {/* Late tasks — full width alert strip if any */}
      {kpis.late > 0 && (
        <div className="rounded-2xl px-4 py-3.5 flex items-center gap-3
          bg-gradient-to-r from-red-50 to-orange-50/60 dark:from-red-500/15 dark:to-orange-500/10
          border border-red-200/80 dark:border-red-500/30
          shadow-[0_4px_20px_hsla(0,80%,55%,0.14)] dark:shadow-[0_4px_28px_hsla(0,80%,55%,0.22)]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-red-500/20 text-red-600 dark:text-red-400 flex-shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-black text-red-700 dark:text-red-300">
              {kpis.late} {language === 'ar' ? (kpis.late === 1 ? 'مهمة متأخرة' : 'مهام متأخرة') : (kpis.late === 1 ? 'Overdue Task' : 'Overdue Tasks')}
            </p>
            <p className="text-[11px] text-red-500/70 dark:text-red-400/60">
              {language === 'ar' ? 'تجاوزت موعد الاستحقاق' : 'Past their due date — needs attention'}
            </p>
          </div>
          <span className="text-3xl font-black text-red-600 dark:text-red-400 flex-shrink-0">{kpis.late}</span>
        </div>
      )}

      {/* ── Subtask progress card ── */}
      {kpis.totalSub > 0 && (
        <div className="rounded-2xl overflow-hidden
          bg-white dark:bg-white/[0.04]
          border border-slate-200 dark:border-white/[0.09]
          shadow-[0_4px_24px_hsla(0,0%,0%,0.08)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.4)]">

          {/* Header */}
          <div className="px-4 pt-4 pb-3 bg-gradient-to-r from-indigo-50 to-purple-50/60 dark:from-indigo-500/15 dark:to-purple-500/10
            border-b border-indigo-100 dark:border-indigo-500/20">
            <button onClick={() => setOpenSubtasks(o => !o)}
              className="w-full flex items-center justify-between mb-2 touch-manipulation">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                  <ListChecks className="h-4 w-4" />
                </div>
                <span className="text-[13px] font-bold text-foreground">
                  {language === 'ar' ? 'المهام الفرعية' : 'Subtasks'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[13px] font-black ${subPct >= 70 ? 'text-emerald-600 dark:text-emerald-400' : subPct >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {subPct}%
                </span>
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center border border-slate-200 dark:border-white/10 flex-shrink-0">
                  <ChevronDown className={`h-5 w-5 text-foreground/70 transition-transform duration-200 ${openSubtasks ? '' : '-rotate-90'}`} />
                </div>
              </div>
            </button>
            {/* Overall progress bar */}
            <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden mb-2">
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
                style={{ width: `${subPct}%` }} />
            </div>
            {/* Summary stats */}
            <div className="flex items-center gap-4">
              {[
                { val: kpis.completedSub, label: language === 'ar' ? 'منجزة' : 'Done', cls: 'text-emerald-600 dark:text-emerald-400' },
                { val: subLeft, label: language === 'ar' ? 'متبقية' : 'Left', cls: 'text-muted-foreground' },
                { val: kpis.totalSub, label: language === 'ar' ? 'المجموع' : 'Total', cls: 'text-indigo-600 dark:text-indigo-400' },
              ].map((s, i, arr) => (
                <React.Fragment key={i}>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[14px] font-black ${s.cls}`}>{s.val}</span>
                    <span className="text-[10px] text-muted-foreground/60">{s.label}</span>
                  </div>
                  {i < arr.length - 1 && <div className="w-px h-4 bg-slate-200 dark:bg-white/10" />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Per-task breakdown */}
          {openSubtasks && <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {taskSubtaskRows.map((row) => {
              const barColor = row.pct === 100
                ? 'bg-emerald-500'
                : row.taskCompleted
                  ? 'bg-emerald-400'
                  : row.pct >= 50
                    ? 'bg-indigo-500'
                    : 'bg-amber-500';
              const pctColor = row.pct === 100
                ? 'text-emerald-600 dark:text-emerald-400'
                : row.pct >= 50
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-amber-600 dark:text-amber-400';
              return (
                <div key={row.id} className="px-4 py-3 flex items-center gap-3">
                  {/* Task title */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[12px] font-semibold truncate ${row.taskCompleted ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                      {row.title}
                    </p>
                    {/* Mini progress bar */}
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden mt-1.5">
                      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                  {/* Count + pct */}
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-[12px] font-black ${pctColor}`}>{row.pct}%</p>
                    <p className="text-[10px] text-muted-foreground/50">{row.done}/{row.total}</p>
                  </div>
                </div>
              );
            })}
          </div>}
        </div>
      )}

      {/* ── Task Completion Trend ── */}
      <div className="rounded-2xl overflow-hidden
        bg-white dark:bg-white/[0.04]
        border border-slate-200 dark:border-white/[0.09]
        shadow-[0_4px_24px_hsla(0,0%,0%,0.10),0_1px_4px_hsla(0,0%,0%,0.06)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.5),0_1px_8px_hsla(210,100%,60%,0.08)]">
        <button onClick={() => setOpenTaskTrend(o => !o)}
          className="w-full flex items-center justify-between px-4 pt-4 pb-3 touch-manipulation">
          <div className="text-left">
            <p className="text-[13px] font-bold text-foreground">
              {language === 'ar' ? 'اتجاه إنجاز المهام' : 'Task Completion Trend'}
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              {language === 'ar' ? 'المكتملة والمتأخرة وقيد التنفيذ والمتجاوزة للموعد عبر الزمن (المهام)' : 'Completed, late, in-progress & overdue over time (Tasks)'}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center border border-slate-200 dark:border-white/10 flex-shrink-0">
            <ChevronDown className={`h-5 w-5 text-foreground/70 transition-transform duration-200 ${openTaskTrend ? '' : '-rotate-90'}`} />
          </div>
        </button>
        {openTaskTrend && (
          <div className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={taskTrend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBlueTask" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210,100%,65%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(210,100%,65%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOrangeTask" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(25,95%,60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(25,95%,60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGreenTask" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210,100%,65%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(210,100%,65%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRedTask" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0,85%,62%)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="hsl(0,85%,62%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsla(0,0%,50%,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsla(0,0%,50%,0.6)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsla(0,0%,50%,0.6)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="completions"
                  name={language === 'ar' ? 'إنجازات' : 'Completions'}
                  stroke="hsl(210,100%,65%)" strokeWidth={2.5} fill="url(#gBlueTask)"
                  dot={false} activeDot={{ r: 4, fill: 'hsl(210,100%,65%)' }} />
                <Area type="monotone" dataKey="lateDone"
                  name={language === 'ar' ? 'منجزة متأخرة' : 'Completed Late'}
                  stroke="hsl(25,95%,60%)" strokeWidth={2} fill="url(#gOrangeTask)"
                  dot={false} activeDot={{ r: 4, fill: 'hsl(25,95%,60%)' }} />
                <Area type="monotone" dataKey="inProgress"
                  name={language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
                  stroke="hsl(210,100%,45%)" strokeWidth={1.5} fill="url(#gGreenTask)"
                  strokeDasharray="4 2"
                  dot={false} activeDot={{ r: 4, fill: 'hsl(210,100%,45%)' }} />
                <Area type="monotone" dataKey="overdue"
                  name={language === 'ar' ? 'متأخرة' : 'Overdue'}
                  stroke="hsl(0,85%,62%)" strokeWidth={2} fill="url(#gRedTask)"
                  dot={false} activeDot={{ r: 4, fill: 'hsl(0,85%,62%)' }} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {[
                { color: 'hsl(210,100%,65%)', label: language === 'ar' ? 'إنجازات' : 'Completions' },
                { color: 'hsl(25,95%,60%)', label: language === 'ar' ? 'منجزة متأخرة' : 'Completed Late' },
                { color: 'hsl(210,100%,45%)', label: language === 'ar' ? 'قيد التنفيذ' : 'In Progress' },
                { color: 'hsl(0,85%,62%)', label: language === 'ar' ? 'متأخرة' : 'Overdue' },
              ].map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full" style={{ background: l.color }} />
                  <span className="text-[10px] text-muted-foreground/60">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Subtask Completion Trend ── */}
      <div className="rounded-2xl overflow-hidden
        bg-white dark:bg-white/[0.04]
        border border-slate-200 dark:border-white/[0.09]
        shadow-[0_4px_24px_hsla(0,0%,0%,0.10),0_1px_4px_hsla(0,0%,0%,0.06)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.5),0_1px_8px_hsla(280,70%,60%,0.08)]">
        <button onClick={() => setOpenSubtaskTrend(o => !o)}
          className="w-full flex items-center justify-between px-4 pt-4 pb-3 touch-manipulation">
          <div className="text-left">
            <p className="text-[13px] font-bold text-foreground">
              {language === 'ar' ? 'اتجاه إنجاز المهام الفرعية' : 'Subtask Completion Trend'}
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              {language === 'ar' ? 'المكتملة والمتأخرة وقيد التنفيذ والمتجاوزة للموعد عبر الزمن (المهام الفرعية)' : 'Completed, late, in-progress & overdue over time (Subtasks)'}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center border border-slate-200 dark:border-white/10 flex-shrink-0">
            <ChevronDown className={`h-5 w-5 text-foreground/70 transition-transform duration-200 ${openSubtaskTrend ? '' : '-rotate-90'}`} />
          </div>
        </button>
        {openSubtaskTrend && (
          <div className="px-4 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={subtaskTrend} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="gBlueSub" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210,100%,65%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(210,100%,65%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOrangeSub" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(25,95%,60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(25,95%,60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gGreenSub" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(210,100%,65%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(210,100%,65%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gRedSub" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0,85%,62%)" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="hsl(0,85%,62%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsla(0,0%,50%,0.08)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsla(0,0%,50%,0.6)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsla(0,0%,50%,0.6)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="completions"
                  name={language === 'ar' ? 'إنجازات' : 'Completions'}
                  stroke="hsl(210,100%,65%)" strokeWidth={2.5} fill="url(#gBlueSub)"
                  dot={false} activeDot={{ r: 4, fill: 'hsl(210,100%,65%)' }} />
                <Area type="monotone" dataKey="lateDone"
                  name={language === 'ar' ? 'منجزة متأخرة' : 'Completed Late'}
                  stroke="hsl(25,95%,60%)" strokeWidth={2} fill="url(#gOrangeSub)"
                  dot={false} activeDot={{ r: 4, fill: 'hsl(25,95%,60%)' }} />
                <Area type="monotone" dataKey="inProgress"
                  name={language === 'ar' ? 'قيد التنفيذ' : 'In Progress'}
                  stroke="hsl(210,100%,45%)" strokeWidth={1.5} fill="url(#gGreenSub)"
                  strokeDasharray="4 2"
                  dot={false} activeDot={{ r: 4, fill: 'hsl(210,100%,45%)' }} />
                <Area type="monotone" dataKey="overdue"
                  name={language === 'ar' ? 'متأخرة' : 'Overdue'}
                  stroke="hsl(0,85%,62%)" strokeWidth={2} fill="url(#gRedSub)"
                  dot={false} activeDot={{ r: 4, fill: 'hsl(0,85%,62%)' }} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {[
                { color: 'hsl(210,100%,65%)', label: language === 'ar' ? 'إنجازات' : 'Completions' },
                { color: 'hsl(25,95%,60%)', label: language === 'ar' ? 'منجزة متأخرة' : 'Completed Late' },
                { color: 'hsl(210,100%,45%)', label: language === 'ar' ? 'قيد التنفيذ' : 'In Progress' },
                { color: 'hsl(0,85%,62%)', label: language === 'ar' ? 'متأخرة' : 'Overdue' },
              ].map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full" style={{ background: l.color }} />
                  <span className="text-[10px] text-muted-foreground/60">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Task Status (Donut) ── */}
      <div className="rounded-2xl overflow-hidden
        bg-white dark:bg-white/[0.04]
        border border-slate-200 dark:border-white/[0.09]
        shadow-[0_4px_24px_hsla(0,0%,0%,0.10),0_1px_4px_hsla(0,0%,0%,0.06)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.5),0_1px_8px_hsla(280,70%,60%,0.08)]">
        <button onClick={() => setOpenStatus(o => !o)}
          className="w-full flex items-center justify-between px-4 pt-4 pb-3 touch-manipulation">
          <div className="text-left">
            <p className="text-[13px] font-bold text-foreground">
              {language === 'ar' ? 'حالة المهام' : 'Task Status'}
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              {language === 'ar' ? 'توزيع المهام حسب الحالة' : 'Distribution across all tasks'}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center border border-slate-200 dark:border-white/10 flex-shrink-0">
            <ChevronDown className={`h-5 w-5 text-foreground/70 transition-transform duration-200 ${openStatus ? '' : '-rotate-90'}`} />
          </div>
        </button>
        {openStatus && (
          <div className="px-4 pb-4">
            {pieData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 relative">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={56}
                        paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[18px] font-black text-foreground">{allTasks.length}</span>
                    <span className="text-[9px] text-muted-foreground/50">{language === 'ar' ? 'مهمة' : 'tasks'}</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-[12px] font-semibold text-muted-foreground/80 truncate">{d.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ background: d.color, width: `${allTasks.length > 0 ? (d.value / allTasks.length) * 100 : 0}%` }} />
                        </div>
                        <span className="text-[13px] font-black text-foreground w-5 text-right">{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[120px] text-muted-foreground/40 text-sm">
                {language === 'ar' ? 'لا توجد بيانات' : 'No data'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Per-user bar chart ── */}
      {userBarData.length > 0 && (
        <div className="rounded-2xl overflow-hidden
          bg-white dark:bg-white/[0.04]
          border border-slate-200 dark:border-white/[0.09]
          shadow-[0_4px_24px_hsla(0,0%,0%,0.10),0_1px_4px_hsla(0,0%,0%,0.06)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.5),0_1px_8px_hsla(142,76%,50%,0.08)]">
          <button onClick={() => setOpenUserPerf(o => !o)}
            className="w-full flex items-center justify-between px-4 pt-4 pb-3 touch-manipulation">
            <div className="text-left">
              <p className="text-[13px] font-bold text-foreground">
                {language === 'ar' ? 'أداء المستخدمين' : 'User Performance'}
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                {language === 'ar' ? 'المهام الفرعية المنجزة مقابل المعلقة' : 'Subtasks completed vs remaining — shared tasks'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center border border-slate-200 dark:border-white/10 flex-shrink-0">
              <ChevronDown className={`h-5 w-5 text-foreground/70 transition-transform duration-200 ${openUserPerf ? '' : '-rotate-90'}`} />
            </div>
          </button>
          {openUserPerf && (
            <div className="px-4 pb-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={userBarData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={14} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsla(0,0%,50%,0.08)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsla(0,0%,50%,0.6)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsla(0,0%,50%,0.6)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="completed" name={language === 'ar' ? 'منجزة' : 'Completed'} radius={[4, 4, 0, 0]}>
                    {userBarData.map((u, i) => <Cell key={i} fill={u.color} />)}
                  </Bar>
                  <Bar dataKey="pending" name={language === 'ar' ? 'معلقة' : 'Pending'}
                    radius={[4, 4, 0, 0]} fill="hsla(0,0%,50%,0.15)" />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-indigo-400" />
                  <span className="text-[10px] text-muted-foreground/60">{language === 'ar' ? 'منجزة' : 'Completed'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-1.5 rounded-full bg-slate-300 dark:bg-white/20" />
                  <span className="text-[10px] text-muted-foreground/60">{language === 'ar' ? 'معلقة' : 'Pending'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── User breakdown table ── */}
      {userStats.length > 0 && (
        <div className="rounded-2xl overflow-hidden
          bg-white dark:bg-white/[0.04]
          border border-slate-200 dark:border-white/[0.09]
          shadow-[0_4px_24px_hsla(0,0%,0%,0.08)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.4)]">
          <button onClick={() => setOpenUserTable(o => !o)}
            className="w-full flex items-center justify-between px-4 pt-4 pb-3 touch-manipulation">
            <div className="text-left">
              <p className="text-[13px] font-bold text-foreground">
                {language === 'ar' ? 'تفاصيل المستخدمين' : 'User Breakdown'}
              </p>
              <p className="text-[11px] text-muted-foreground/60">
                {userStats.length} {language === 'ar' ? 'مستخدم' : 'users'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center border border-slate-200 dark:border-white/10 flex-shrink-0">
              <ChevronDown className={`h-5 w-5 text-foreground/70 transition-transform duration-200 ${openUserTable ? '' : '-rotate-90'}`} />
            </div>
          </button>
          {openUserTable && <ActivityUserTable userStats={userStats} />}
        </div>
      )}

    </div>
  );
};
