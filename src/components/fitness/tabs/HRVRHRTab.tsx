import React, { useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Heart, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';

interface HRVRHRTabProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  currentData?: {
    hrv: number;
    rhr: number;
  };
  yesterdayData?: {
    hrv: number;
    rhr: number;
  };
  weeklyData?: Array<{
    date: string;
    hrv: number;
    rhr: number;
  }>;
}

export function HRVRHRTab({ 
  timeRange, 
  onTimeRangeChange, 
  currentData,
  yesterdayData,
  weeklyData = []
}: HRVRHRTabProps) {
  const { language } = useTheme();

  // Load persisted timeRange once on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wakti:hrvrhr:timeRange') as TimeRange | null;
      if (saved && saved !== timeRange) onTimeRangeChange(saved);
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use real WHOOP data - no fallback to mock data
  if (!currentData) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2 mb-4 flex-wrap justify-center sm:justify-start mt-8">
          {(['1d', '1w', '2w', '1m', '3m', '6m'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`px-3 py-2 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium shadow-sm transition-all min-w-[44px] ${
                timeRange === range
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-gray-300 border border-white/20'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {language === 'ar' ? 'لا توجد بيانات HRV/RHR متاحة' : 'No HRV/RHR data available'}
          </p>
        </div>
      </div>
    );
  }

  const realCurrentData = currentData;

  const mockYesterdayData = yesterdayData || {
    hrv: 38,
    rhr: 61
  };

  // Only use real data with valid values, no mock/dummy data
  const realWeeklyData = weeklyData && weeklyData.length > 0 
    ? weeklyData.filter(item => 
        (item.hrv !== null && item.hrv !== undefined && item.hrv > 0) ||
        (item.rhr !== null && item.rhr !== undefined && item.rhr > 0)
      )
    : [];

  const avg7dHRV = realWeeklyData.length > 0 ? Math.round(realWeeklyData.reduce((sum, d) => sum + d.hrv, 0) / realWeeklyData.length) : 0;
  const avg7dRHR = realWeeklyData.length > 0 ? Math.round(realWeeklyData.reduce((sum, d) => sum + d.rhr, 0) / realWeeklyData.length) : 0;
  
  const deltaHRVVsLastWeek = realCurrentData.hrv - mockYesterdayData.hrv;
  const deltaRHRVsLastWeek = realCurrentData.rhr - mockYesterdayData.rhr;

  const compareValue = (current: number, yesterday: number, unit: string = '') => {
    const diff = current - yesterday;
    if (Math.abs(diff) < 0.1) return { icon: Minus, color: 'text-gray-400', text: `0${unit}` };
    if (diff > 0) return { icon: TrendingUp, color: 'text-emerald-400', text: `+${diff.toFixed(1)}${unit}` };
    return { icon: TrendingDown, color: 'text-red-400', text: `${diff.toFixed(1)}${unit}` };
  };

  const hrvComparison = compareValue(realCurrentData.hrv, mockYesterdayData.hrv, 'ms');
  const rhrComparison = compareValue(realCurrentData.rhr, mockYesterdayData.rhr, 'bpm');

  // For RHR, lower is better, so we invert the color logic
  const rhrComparisonAdjusted = {
    ...rhrComparison,
    color: rhrComparison.color === 'text-emerald-400' ? 'text-red-400' : 
           rhrComparison.color === 'text-red-400' ? 'text-emerald-400' : 
           'text-gray-400'
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mini-tabs for time range */}
      <div className="flex gap-3 mb-6 flex-wrap justify-center sm:justify-start mt-16">
        {(['1d', '1w', '2w', '1m', '3m', '6m'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => { onTimeRangeChange(range); try { localStorage.setItem('wakti:hrvrhr:timeRange', range); } catch (_) {} }}
            className={`px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold shadow-lg transition-all min-w-[50px] flex-shrink-0 active:scale-95 ${
              timeRange === range
                ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-indigo-500/50 border-2 border-indigo-400'
                : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 hover:from-gray-200 hover:to-gray-300 dark:hover:from-white/20 dark:hover:to-white/10 text-gray-800 dark:text-gray-300 border-2 border-gray-300 dark:border-white/20 shadow-gray-400/30 dark:shadow-none'
            }`}
          >
            {range.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Current HRV & RHR Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HRV Card */}
        <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10 border-emerald-300 dark:border-emerald-500/20 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <Activity className="h-6 w-6 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-lg">
                {language === 'ar' ? 'تقلب معدل ضربات القلب' : 'Heart Rate Variability'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'RMSSD (مللي ثانية)' : 'RMSSD (milliseconds)'}
              </p>
            </div>
          </div>

          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-emerald-400 mb-2">
              {realCurrentData.hrv}ms
            </div>
            <div className="text-sm text-muted-foreground">
              {language === 'ar' ? 'القراءة الحالية' : 'Current Reading'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'متوسط 7 أيام' : '7-Day Avg'}
              </div>
              <div className="text-xl font-bold text-emerald-300">
                {avg7dHRV}ms
              </div>
            </div>
            <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'التغيير' : 'Change'}
              </div>
              <div className={`text-xl font-bold ${hrvComparison.color.replace('text-', 'text-')}`}>
                {deltaHRVVsLastWeek >= 0 ? '+' : ''}{deltaHRVVsLastWeek.toFixed(1)}ms
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <p className="text-sm text-emerald-300">
              {realCurrentData.hrv >= 40 
                ? (language === 'ar' ? 'تقلب جيد - نظام عصبي متوازن' : 'Good variability - balanced nervous system')
                : (language === 'ar' ? 'تقلب منخفض - قد تحتاج راحة' : 'Lower variability - may need recovery')
              }
            </p>
          </div>
        </Card>

        {/* RHR Card */}
        <Card className="rounded-2xl p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/10 border-blue-300 dark:border-blue-500/20 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <Heart className="h-6 w-6 text-blue-400" />
            <div>
              <h3 className="font-semibold text-lg">
                {language === 'ar' ? 'معدل ضربات القلب أثناء الراحة' : 'Resting Heart Rate'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'ضربة في الدقيقة' : 'Beats per minute'}
              </p>
            </div>
          </div>

          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-blue-400 mb-2">
              {realCurrentData.rhr} bpm
            </div>
            <div className="text-sm text-muted-foreground">
              {language === 'ar' ? 'القراءة الحالية' : 'Current Reading'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'متوسط 7 أيام' : '7-Day Avg'}
              </div>
              <div className="text-xl font-bold text-blue-300">
                {avg7dRHR} bpm
              </div>
            </div>
            <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'التغيير' : 'Change'}
              </div>
              <div className={`text-xl font-bold ${rhrComparisonAdjusted.color.replace('text-', 'text-')}`}>
                {deltaRHRVsLastWeek >= 0 ? '+' : ''}{deltaRHRVsLastWeek.toFixed(1)} bpm
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <p className="text-sm text-blue-300">
              {realCurrentData.rhr <= 60 
                ? (language === 'ar' ? 'معدل ممتاز - لياقة جيدة' : 'Excellent rate - good fitness')
                : realCurrentData.rhr <= 70
                ? (language === 'ar' ? 'معدل جيد - ضمن المعدل الطبيعي' : 'Good rate - within normal range')
                : (language === 'ar' ? 'معدل مرتفع - قد تحتاج تحسين اللياقة' : 'Elevated rate - may need fitness improvement')
              }
            </p>
          </div>
        </Card>
      </div>

      {/* Day Statistics - Today vs Yesterday */}
      <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-500/10 dark:to-blue-500/10 border-emerald-300 dark:border-emerald-500/20 shadow-lg">
        <div className="mb-4">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            {language === 'ar' ? 'إحصائيات اليوم' : 'Day Statistics'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 ml-7">
            {language === 'ar' ? 'مقارنة اليوم مع الأمس' : 'Today vs Yesterday Comparison'}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'تقلب معدل ضربات القلب' : 'Heart Rate Variability'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{realCurrentData.hrv}ms</span>
              <div className={`flex items-center gap-1 ${hrvComparison.color}`}>
                <hrvComparison.icon className="h-4 w-4" />
                <span className="text-sm">{hrvComparison.text}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {language === 'ar' ? 'vs الأمس' : 'vs Yesterday'}: {mockYesterdayData.hrv}ms
            </div>
          </div>

          <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'معدل ضربات القلب أثناء الراحة' : 'Resting Heart Rate'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{realCurrentData.rhr} bpm</span>
              <div className={`flex items-center gap-1 ${rhrComparisonAdjusted.color}`}>
                <rhrComparison.icon className="h-4 w-4" />
                <span className="text-sm">{rhrComparison.text}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {language === 'ar' ? 'vs الأمس' : 'vs Yesterday'}: {mockYesterdayData.rhr} bpm
            </div>
          </div>
        </div>
      </Card>

      {/* Dual-Line Chart - Only show if we have real data */}
      {realWeeklyData.length > 0 && (
        <Card className="rounded-2xl p-6 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-white/5 dark:to-white/5 border-gray-200 dark:border-white/10 shadow-lg">
          <h3 className="font-semibold text-lg mb-4">
            {language === 'ar' ? 'اتجاه HRV و RHR (7 أيام)' : 'HRV & RHR Trend (7 Days)'}
          </h3>
          
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={realWeeklyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="hrvGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#34D399" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="rhrGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis yAxisId="hrv" orientation="left" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis yAxisId="rhr" orientation="right" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => [
                  `${value}${name === 'hrv' ? 'ms' : ' bpm'}`,
                  name === 'hrv' ? 'HRV' : 'RHR'
                ]}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                formatter={(value) => (
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    value === 'hrv' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  }`}>
                    {value === 'hrv' ? 'HRV (ms)' : 'RHR (bpm)'}
                  </span>
                )}
              />
              <Line 
                yAxisId="hrv"
                type="monotone" 
                dataKey="hrv" 
                stroke="#10B981" 
                strokeWidth={4}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8, stroke: '#10B981', strokeWidth: 3 }}
              />
              <Line 
                yAxisId="rhr"
                type="monotone" 
                dataKey="rhr" 
                stroke="#3B82F6" 
                strokeWidth={4}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8, stroke: '#3B82F6', strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Mini summary */}
        <div className="mt-4 p-4 bg-gradient-to-r from-emerald-500/10 to-blue-500/10 rounded-xl border border-emerald-500/20">
          <p className="text-sm text-muted-foreground">
            {language === 'ar' 
              ? `متوسط HRV هذا الأسبوع ${avg7dHRV}ms ومتوسط RHR ${avg7dRHR} bpm`
              : `Your average HRV this week is ${avg7dHRV}ms and average RHR is ${avg7dRHR} bpm`
            }
          </p>
        </div>
      </Card>
      )}
    </div>
  );
}
