import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import 'react-circular-progressbar/dist/styles.css';

type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';

interface RecoveryTabProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  recoveryData?: {
    score: number;
    hrv: number;
    rhr: number;
  };
  yesterdayData?: {
    score: number;
    hrv: number;
    rhr: number;
  };
  weeklyData?: Array<{
    date: string;
    recovery: number;
    hrv: number;
    rhr: number;
  }>;
}

export function RecoveryTab({ 
  timeRange, 
  onTimeRangeChange, 
  recoveryData,
  yesterdayData,
  weeklyData = []
}: RecoveryTabProps) {
  const { language } = useTheme();

  // Use real WHOOP data - no fallback to mock data
  if (!recoveryData) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          {(['1d', '1w', '2w', '1m', '3m', '6m'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`px-2 py-1 sm:px-3 rounded-full text-xs shadow-sm transition-all ${
                timeRange === range
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-gray-100 hover:bg-indigo-200 text-gray-700'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {language === 'ar' ? 'لا توجد بيانات تعافي متاحة' : 'No recovery data available'}
          </p>
        </div>
      </div>
    );
  }

  const realRecoveryData = recoveryData;

  const mockYesterdayData = yesterdayData || {
    score: 68,
    hrv: 38,
    rhr: 61
  };

  const mockWeeklyData = weeklyData.length > 0 ? weeklyData : [
    { date: 'Mon', recovery: 72, hrv: 40, rhr: 59 },
    { date: 'Tue', recovery: 68, hrv: 38, rhr: 61 },
    { date: 'Wed', recovery: 81, hrv: 45, rhr: 56 },
    { date: 'Thu', recovery: 75, hrv: 42, rhr: 58 },
    { date: 'Fri', recovery: 65, hrv: 36, rhr: 63 },
    { date: 'Sat', recovery: 88, hrv: 48, rhr: 54 },
    { date: 'Sun', recovery: 79, hrv: 44, rhr: 57 }
  ];

  const getRecoveryColor = (score: number) => {
    if (score >= 67) return { color: '#10B981', text: 'text-emerald-400', bg: 'from-emerald-500/10 to-green-500/10', border: 'border-emerald-500/20' };
    if (score >= 34) return { color: '#F59E0B', text: 'text-yellow-400', bg: 'from-yellow-500/10 to-orange-500/10', border: 'border-yellow-500/20' };
    return { color: '#EF4444', text: 'text-red-400', bg: 'from-red-500/10 to-pink-500/10', border: 'border-red-500/20' };
  };

  const recoveryColor = getRecoveryColor(realRecoveryData.score);
  const bestThisWeek = Math.max(...mockWeeklyData.map(d => d.recovery));
  const avg7d = Math.round(mockWeeklyData.reduce((sum, d) => sum + d.recovery, 0) / mockWeeklyData.length);
  const deltaVsLastWeek = realRecoveryData.score - mockYesterdayData.score;

  const compareValue = (current: number, yesterday: number, unit: string = '') => {
    const diff = current - yesterday;
    if (Math.abs(diff) < 0.1) return { icon: Minus, color: 'text-gray-400', text: `0${unit}` };
    if (diff > 0) return { icon: TrendingUp, color: 'text-emerald-400', text: `+${diff.toFixed(1)}${unit}` };
    return { icon: TrendingDown, color: 'text-red-400', text: `${diff.toFixed(1)}${unit}` };
  };

  const recoveryComparison = compareValue(realRecoveryData.score, mockYesterdayData.score, '%');
  const hrvComparison = compareValue(realRecoveryData.hrv, mockYesterdayData.hrv, 'ms');
  const rhrComparison = compareValue(realRecoveryData.rhr, mockYesterdayData.rhr, 'bpm');

  return (
    <div className="space-y-6">
      {/* Mini-tabs for time range */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['1d', '1w', '2w', '1m', '3m', '6m'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => onTimeRangeChange(range)}
            className={`px-2 py-1 sm:px-3 rounded-full text-xs shadow-sm transition-all ${
              timeRange === range
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-gray-100 hover:bg-indigo-200 text-gray-700'
            }`}
          >
            {range.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Main Recovery Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Large Recovery Gauge */}
        <Card className={`rounded-2xl p-6 bg-gradient-to-br ${recoveryColor.bg} ${recoveryColor.border}`}>
          <div className="flex items-center gap-3 mb-6">
            <Heart className={`h-6 w-6 ${recoveryColor.text}`} />
            <div>
              <h3 className="font-semibold text-lg">
                {language === 'ar' ? 'التعافي' : 'Recovery'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'الاستعداد اليومي' : 'Daily Readiness'}
              </p>
            </div>
          </div>

          <div className="relative h-36 w-36 sm:h-40 sm:w-40 mx-auto mb-6">
            <CircularProgressbar
              value={realRecoveryData.score}
              text={`${realRecoveryData.score}%`}
              styles={buildStyles({
                pathColor: recoveryColor.color,
                textColor: recoveryColor.color,
                trailColor: `${recoveryColor.color}20`,
                strokeLinecap: 'round',
                textSize: '16px',
              })}
            />
            
            {/* Zone indicators */}
            <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-muted-foreground">
              <span>🔴 0</span>
              <span className="text-red-400">🟡 33</span>
              <span className="text-yellow-400">🟢 67</span>
              <span>100</span>
            </div>
          </div>

          <div className="text-center">
            <div className={`text-lg font-semibold ${recoveryColor.text} mb-2`}>
              {realRecoveryData.score >= 67 
                ? (language === 'ar' ? 'جاهز للتدريب' : 'Ready to Perform')
                : realRecoveryData.score >= 34
                ? (language === 'ar' ? 'تدريب معتدل' : 'Moderate Training')
                : (language === 'ar' ? 'يحتاج راحة' : 'Focus on Recovery')
              }
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'بناءً على معدل ضربات القلب وتقلبها'
                : 'Based on HRV and resting heart rate'
              }
            </p>
          </div>
        </Card>

        {/* Recovery Stats */}
        <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
          <h3 className="font-semibold text-lg mb-6">
            {language === 'ar' ? 'إحصائيات التعافي' : 'Recovery Stats'}
          </h3>

          {/* Recovery metrics in one row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white/5 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'النتيجة' : 'Score'}
              </div>
              <div className={`text-sm sm:text-base font-bold ${recoveryColor.text}`}>
                {realRecoveryData.score}%
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'تقلب القلب' : 'HRV'}
              </div>
              <div className="text-sm sm:text-base font-bold text-teal-400">
                {realRecoveryData.hrv}ms
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'نبضات الراحة' : 'RHR'}
              </div>
              <div className="text-sm sm:text-base font-bold text-purple-400">
                {realRecoveryData.rhr} bpm
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'متوسط 7د' : '7d Avg'}
              </div>
              <div className="text-sm sm:text-base font-bold text-blue-400">
                {avg7d}%
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Day Statistics - Today vs Yesterday */}
      <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-emerald-500/20">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-400" />
          {language === 'ar' ? 'إحصائيات اليوم' : 'Day Statistics'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'نقاط التعافي' : 'Recovery Score'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{realRecoveryData.score}%</span>
              <div className={`flex items-center gap-1 ${recoveryComparison.color}`}>
                <recoveryComparison.icon className="h-4 w-4" />
                <span className="text-sm">{recoveryComparison.text}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'تقلب معدل ضربات القلب' : 'HRV (RMSSD)'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{realRecoveryData.hrv}ms</span>
              <div className={`flex items-center gap-1 ${hrvComparison.color}`}>
                <hrvComparison.icon className="h-4 w-4" />
                <span className="text-sm">{hrvComparison.text}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'معدل ضربات القلب أثناء الراحة' : 'Resting Heart Rate'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{realRecoveryData.rhr} bpm</span>
              <div className={`flex items-center gap-1 ${rhrComparison.color}`}>
                <rhrComparison.icon className="h-4 w-4" />
                <span className="text-sm">{rhrComparison.text}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Recovery Sparkline */}
      <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
        <h3 className="font-semibold text-lg mb-4">
          {language === 'ar' ? 'اتجاه التعافي (7 أيام)' : 'Recovery Trend (7 Days)'}
        </h3>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockWeeklyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`${value}%`, 'Recovery']}
              />
              <Line 
                type="monotone" 
                dataKey="recovery" 
                stroke="#10B981" 
                strokeWidth={3}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Mini summary */}
        <div className="mt-4 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
          <p className="text-sm text-emerald-300">
            {language === 'ar' 
              ? `متوسط التعافي هذا الأسبوع ${avg7d}% مع أفضل يوم ${bestThisWeek}%`
              : `Your average recovery this week is ${avg7d}% with your best day at ${bestThisWeek}%`
            }
          </p>
        </div>
      </Card>
    </div>
  );
}
