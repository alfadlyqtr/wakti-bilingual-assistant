import React, { useMemo } from "react";
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

  // Mock data for demonstration
  const mockCurrentData = currentData || {
    hrv: 42,
    rhr: 58
  };

  const mockYesterdayData = yesterdayData || {
    hrv: 38,
    rhr: 61
  };

  const mockWeeklyData = weeklyData.length > 0 ? weeklyData : [
    { date: 'Mon', hrv: 40, rhr: 59 },
    { date: 'Tue', hrv: 38, rhr: 61 },
    { date: 'Wed', hrv: 45, rhr: 56 },
    { date: 'Thu', hrv: 42, rhr: 58 },
    { date: 'Fri', hrv: 36, rhr: 63 },
    { date: 'Sat', hrv: 48, rhr: 54 },
    { date: 'Sun', hrv: 44, rhr: 57 }
  ];

  const avg7dHRV = Math.round(mockWeeklyData.reduce((sum, d) => sum + d.hrv, 0) / mockWeeklyData.length);
  const avg7dRHR = Math.round(mockWeeklyData.reduce((sum, d) => sum + d.rhr, 0) / mockWeeklyData.length);
  
  const deltaHRVVsLastWeek = mockCurrentData.hrv - mockYesterdayData.hrv;
  const deltaRHRVsLastWeek = mockCurrentData.rhr - mockYesterdayData.rhr;

  const compareValue = (current: number, yesterday: number, unit: string = '') => {
    const diff = current - yesterday;
    if (Math.abs(diff) < 0.1) return { icon: Minus, color: 'text-gray-400', text: `0${unit}` };
    if (diff > 0) return { icon: TrendingUp, color: 'text-emerald-400', text: `+${diff.toFixed(1)}${unit}` };
    return { icon: TrendingDown, color: 'text-red-400', text: `${diff.toFixed(1)}${unit}` };
  };

  const hrvComparison = compareValue(mockCurrentData.hrv, mockYesterdayData.hrv, 'ms');
  const rhrComparison = compareValue(mockCurrentData.rhr, mockYesterdayData.rhr, 'bpm');

  // For RHR, lower is better, so we invert the color logic
  const rhrComparisonAdjusted = {
    ...rhrComparison,
    color: rhrComparison.color === 'text-emerald-400' ? 'text-red-400' : 
           rhrComparison.color === 'text-red-400' ? 'text-emerald-400' : 
           'text-gray-400'
  };

  return (
    <div className="space-y-6">
      {/* Mini-tabs for time range */}
      <Card className="rounded-2xl p-4 bg-white/5 border-white/10">
        <Tabs value={timeRange} onValueChange={(value) => onTimeRangeChange(value as TimeRange)}>
          <TabsList className="grid w-full grid-cols-6 bg-white/10">
            <TabsTrigger value="1d" className="text-xs">1D</TabsTrigger>
            <TabsTrigger value="1w" className="text-xs">1W</TabsTrigger>
            <TabsTrigger value="2w" className="text-xs">2W</TabsTrigger>
            <TabsTrigger value="1m" className="text-xs">1M</TabsTrigger>
            <TabsTrigger value="3m" className="text-xs">3M</TabsTrigger>
            <TabsTrigger value="6m" className="text-xs">6M</TabsTrigger>
          </TabsList>
        </Tabs>
      </Card>

      {/* Current HRV & RHR Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* HRV Card */}
        <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20">
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
              {mockCurrentData.hrv}ms
            </div>
            <div className="text-sm text-muted-foreground">
              {language === 'ar' ? 'القراءة الحالية' : 'Current Reading'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'متوسط 7 أيام' : '7-Day Avg'}
              </div>
              <div className="text-xl font-bold text-emerald-300">
                {avg7dHRV}ms
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
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
              {mockCurrentData.hrv >= 40 
                ? (language === 'ar' ? 'تقلب جيد - نظام عصبي متوازن' : 'Good variability - balanced nervous system')
                : (language === 'ar' ? 'تقلب منخفض - قد تحتاج راحة' : 'Lower variability - may need recovery')
              }
            </p>
          </div>
        </Card>

        {/* RHR Card */}
        <Card className="rounded-2xl p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
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
              {mockCurrentData.rhr} bpm
            </div>
            <div className="text-sm text-muted-foreground">
              {language === 'ar' ? 'القراءة الحالية' : 'Current Reading'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-sm text-muted-foreground mb-1">
                {language === 'ar' ? 'متوسط 7 أيام' : '7-Day Avg'}
              </div>
              <div className="text-xl font-bold text-blue-300">
                {avg7dRHR} bpm
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
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
              {mockCurrentData.rhr <= 60 
                ? (language === 'ar' ? 'معدل ممتاز - لياقة جيدة' : 'Excellent rate - good fitness')
                : mockCurrentData.rhr <= 70
                ? (language === 'ar' ? 'معدل جيد - ضمن المعدل الطبيعي' : 'Good rate - within normal range')
                : (language === 'ar' ? 'معدل مرتفع - قد تحتاج تحسين اللياقة' : 'Elevated rate - may need fitness improvement')
              }
            </p>
          </div>
        </Card>
      </div>

      {/* Day Statistics - Today vs Yesterday */}
      <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-emerald-500/20">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-400" />
          {language === 'ar' ? 'إحصائيات اليوم' : 'Day Statistics'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'تقلب معدل ضربات القلب' : 'Heart Rate Variability'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{mockCurrentData.hrv}ms</span>
              <div className={`flex items-center gap-1 ${hrvComparison.color}`}>
                <hrvComparison.icon className="h-4 w-4" />
                <span className="text-sm">{hrvComparison.text}</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {language === 'ar' ? 'vs الأمس' : 'vs Yesterday'}: {mockYesterdayData.hrv}ms
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'معدل ضربات القلب أثناء الراحة' : 'Resting Heart Rate'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{mockCurrentData.rhr} bpm</span>
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

      {/* Dual-Line Chart */}
      <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
        <h3 className="font-semibold text-lg mb-4">
          {language === 'ar' ? 'اتجاه HRV و RHR (7 أيام)' : 'HRV & RHR Trend (7 Days)'}
        </h3>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockWeeklyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                stroke="url(#hrvGradient)" 
                strokeWidth={3}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
              />
              <Line 
                yAxisId="rhr"
                type="monotone" 
                dataKey="rhr" 
                stroke="url(#rhrGradient)" 
                strokeWidth={3}
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
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
    </div>
  );
}
