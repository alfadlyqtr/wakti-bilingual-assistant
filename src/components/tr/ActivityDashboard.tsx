// @ts-nocheck
import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp,
  ListChecks, RefreshCw
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
  const { sharedTasks, loading, refreshing, loadData, kpis, userStats, getTrendData } = useActivityData(tasks);

  const trendData = useMemo(() => getTrendData(timeRange), [getTrendData, timeRange]);

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

  if (sharedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10
          flex items-center justify-center shadow-[0_8px_32px_hsla(240,80%,50%,0.08)] mb-6">
          <TrendingUp className="h-9 w-9 text-indigo-400 dark:text-indigo-500" />
        </div>
        <p className="text-base font-bold text-foreground mb-2">
          {language === 'ar' ? 'لا توجد مهام مشتركة' : 'No shared tasks yet'}
        </p>
        <p className="text-sm text-muted-foreground/70 max-w-[260px] leading-relaxed">
          {language === 'ar' ? 'شارك مهمة لبدء تتبع الأداء' : 'Share a task to start tracking performance and activity.'}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: language === 'ar' ? 'مكتملة' : 'Completed',
            value: kpis.completed,
            icon: <CheckCircle2 className="h-4 w-4" />,
            bg: 'from-emerald-50 to-emerald-100/60 dark:from-emerald-500/25 dark:to-emerald-600/10',
            ib: 'bg-emerald-500/25 text-emerald-600 dark:text-emerald-400',
            border: 'border-emerald-300/70 dark:border-emerald-500/30',
            glow: 'shadow-[0_4px_20px_hsla(142,76%,45%,0.18)] dark:shadow-[0_4px_28px_hsla(142,76%,45%,0.25)]',
            valColor: 'text-emerald-700 dark:text-emerald-300',
          },
          {
            label: language === 'ar' ? 'معلقة' : 'Pending',
            value: kpis.pending,
            icon: <Clock className="h-4 w-4" />,
            bg: 'from-blue-50 to-blue-100/60 dark:from-blue-500/25 dark:to-blue-600/10',
            ib: 'bg-blue-500/25 text-blue-600 dark:text-blue-400',
            border: 'border-blue-300/70 dark:border-blue-500/30',
            glow: 'shadow-[0_4px_20px_hsla(210,100%,55%,0.18)] dark:shadow-[0_4px_28px_hsla(210,100%,55%,0.25)]',
            valColor: 'text-blue-700 dark:text-blue-300',
          },
          {
            label: language === 'ar' ? 'متأخرة' : 'Late',
            value: kpis.late,
            icon: <AlertTriangle className="h-4 w-4" />,
            bg: kpis.late > 0
              ? 'from-orange-50 to-orange-100/60 dark:from-orange-500/25 dark:to-orange-600/10'
              : 'from-slate-50 to-slate-100/60 dark:from-white/[0.05] dark:to-white/[0.02]',
            ib: kpis.late > 0 ? 'bg-orange-500/25 text-orange-600 dark:text-orange-400' : 'bg-slate-200/60 dark:bg-white/[0.06] text-muted-foreground',
            border: kpis.late > 0 ? 'border-orange-300/70 dark:border-orange-500/30' : 'border-slate-200/80 dark:border-white/[0.08]',
            glow: kpis.late > 0 ? 'shadow-[0_4px_20px_hsla(25,95%,55%,0.2)] dark:shadow-[0_4px_28px_hsla(25,95%,55%,0.3)]' : 'shadow-[0_2px_12px_hsla(0,0%,0%,0.06)]',
            valColor: kpis.late > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-foreground',
          },
          {
            label: language === 'ar' ? 'الأداء' : 'Performance',
            value: kpis.performance + '%',
            icon: <TrendingUp className="h-4 w-4" />,
            bg: 'from-purple-50 to-purple-100/60 dark:from-purple-500/25 dark:to-purple-600/10',
            ib: 'bg-purple-500/25 text-purple-600 dark:text-purple-400',
            border: 'border-purple-300/70 dark:border-purple-500/30',
            glow: 'shadow-[0_4px_20px_hsla(280,70%,55%,0.18)] dark:shadow-[0_4px_28px_hsla(280,70%,55%,0.25)]',
            valColor: 'text-purple-700 dark:text-purple-300',
          },
        ].map((k, i) => (
          <div key={i} className={`rounded-2xl p-4 bg-gradient-to-br ${k.bg} border ${k.border} ${k.glow}`}>
            <div className="mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.ib}`}>{k.icon}</div>
            </div>
            <p className={`text-2xl font-black ${k.valColor}`}>{k.value}</p>
            <p className="text-[11px] font-semibold text-muted-foreground/70 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Subtask progress strip ── */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-4
        bg-gradient-to-r from-indigo-50 to-purple-50/60 dark:from-indigo-500/15 dark:to-purple-500/10
        border border-indigo-200/70 dark:border-indigo-500/30
        shadow-[0_3px_16px_hsla(240,80%,50%,0.12)] dark:shadow-[0_3px_20px_hsla(240,80%,50%,0.2)]">
        <div className="flex items-center gap-2 flex-shrink-0">
          <ListChecks className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
          <span className="text-[12px] font-bold text-foreground">
            {language === 'ar' ? 'المهام الفرعية' : 'Subtasks'}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {[
            { val: kpis.completedSub, label: language === 'ar' ? 'منجزة' : 'Done', cls: 'text-emerald-500' },
            { val: kpis.totalSub - kpis.completedSub, label: language === 'ar' ? 'متبقية' : 'Left', cls: 'text-foreground' },
            { val: kpis.totalSub, label: language === 'ar' ? 'المجموع' : 'Total', cls: 'text-indigo-500' },
          ].map((s, i, arr) => (
            <React.Fragment key={i}>
              <div className="text-center">
                <p className={`text-base font-black ${s.cls}`}>{s.val}</p>
                <p className="text-[9px] text-muted-foreground/60">{s.label}</p>
              </div>
              {i < arr.length - 1 && <div className="w-px h-6 bg-slate-200 dark:bg-white/10" />}
            </React.Fragment>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-700"
              style={{ width: `${subPct}%` }} />
          </div>
          <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5 text-right">{subPct}%</p>
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* Area chart */}
        <div className="lg:col-span-2 rounded-2xl p-4
          bg-white dark:bg-white/[0.04]
          border border-slate-200 dark:border-white/[0.09]
          shadow-[0_4px_24px_hsla(0,0%,0%,0.10),0_1px_4px_hsla(0,0%,0%,0.06)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.5),0_1px_8px_hsla(210,100%,60%,0.08)]">
          <p className="text-[13px] font-bold text-foreground">
            {language === 'ar' ? 'اتجاه الإنجاز' : 'Completion Trend'}
          </p>
          <p className="text-[11px] text-muted-foreground/60 mb-4">
            {language === 'ar' ? 'الإنجازات والتعليقات عبر الزمن' : 'Completions & comments over time'}
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(210,100%,65%)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(210,100%,65%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142,76%,55%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(142,76%,55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsla(0,0%,50%,0.08)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsla(0,0%,50%,0.6)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsla(0,0%,50%,0.6)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="completions"
                name={language === 'ar' ? 'إنجازات' : 'Completions'}
                stroke="hsl(210,100%,65%)" strokeWidth={2.5} fill="url(#gBlue)"
                dot={false} activeDot={{ r: 4, fill: 'hsl(210,100%,65%)' }} />
              <Area type="monotone" dataKey="comments"
                name={language === 'ar' ? 'تعليقات' : 'Comments'}
                stroke="hsl(142,76%,55%)" strokeWidth={2.5} fill="url(#gGreen)"
                dot={false} activeDot={{ r: 4, fill: 'hsl(142,76%,55%)' }} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2">
            {[
              { color: 'hsl(210,100%,65%)', label: language === 'ar' ? 'إنجازات' : 'Completions' },
              { color: 'hsl(142,76%,55%)', label: language === 'ar' ? 'تعليقات' : 'Comments' },
            ].map((l, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 rounded-full" style={{ background: l.color }} />
                <span className="text-[10px] text-muted-foreground/60">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Donut pie */}
        <div className="rounded-2xl p-4
          bg-white dark:bg-white/[0.04]
          border border-slate-200 dark:border-white/[0.09]
          shadow-[0_4px_24px_hsla(0,0%,0%,0.10),0_1px_4px_hsla(0,0%,0%,0.06)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.5),0_1px_8px_hsla(280,70%,60%,0.08)]">
          <p className="text-[13px] font-bold text-foreground">
            {language === 'ar' ? 'حالة المهام' : 'Task Status'}
          </p>
          <p className="text-[11px] text-muted-foreground/60 mb-2">
            {language === 'ar' ? 'التوزيع' : 'Distribution'}
          </p>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={36} outerRadius={56}
                    paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-[11px] text-muted-foreground/70">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-14 h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ background: d.color, width: `${sharedTasks.length > 0 ? (d.value / sharedTasks.length) * 100 : 0}%` }} />
                      </div>
                      <span className="text-[11px] font-black text-foreground w-4 text-right">{d.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[160px] text-muted-foreground/40 text-sm">
              {language === 'ar' ? 'لا توجد بيانات' : 'No data'}
            </div>
          )}
        </div>
      </div>

      {/* ── Per-user bar chart ── */}
      {userBarData.length > 0 && (
        <div className="rounded-2xl p-4
          bg-white dark:bg-white/[0.04]
          border border-slate-200 dark:border-white/[0.09]
          shadow-[0_4px_24px_hsla(0,0%,0%,0.10),0_1px_4px_hsla(0,0%,0%,0.06)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.5),0_1px_8px_hsla(142,76%,50%,0.08)]">
          <p className="text-[13px] font-bold text-foreground">
            {language === 'ar' ? 'أداء المستخدمين' : 'User Performance'}
          </p>
          <p className="text-[11px] text-muted-foreground/60 mb-4">
            {language === 'ar' ? 'المهام الفرعية المنجزة مقابل المعلقة' : 'Subtasks completed vs pending per user'}
          </p>
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

      {/* ── User breakdown table ── */}
      <ActivityUserTable userStats={userStats} />

    </div>
  );
};
