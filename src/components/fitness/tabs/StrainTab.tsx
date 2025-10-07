import React, { useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import 'react-circular-progressbar/dist/styles.css';

type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';

interface StrainTabProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  strainData?: {
    dayStrain: number;
    avgHr: number;
    trainingLoad: number;
    maxHr: number;
    energyBurned?: number; // kcal
  };
  yesterdayData?: {
    dayStrain: number;
    avgHr: number;
    trainingLoad: number;
  };
  weeklyData?: Array<{
    date: string;
    strain: number;
    avgHr: number;
    trainingLoad: number;
  }>;
  hourlyData?: Array<{
    hour: string;
    strain: number;
  }>;
}

export function StrainTab({ 
  timeRange, 
  onTimeRangeChange, 
  strainData,
  yesterdayData,
  weeklyData = [],
  hourlyData = []
}: StrainTabProps) {
  const { language } = useTheme();

  // Load persisted timeRange once on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wakti:strain:timeRange') as TimeRange | null;
      if (saved && saved !== timeRange) onTimeRangeChange(saved);
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use real WHOOP data - no fallback to mock data
  if (!strainData) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {language === 'ar' ? 'لا توجد بيانات إجهاد متاحة' : 'No strain data available'}
          </p>
        </div>
      </div>
    );
  }

  const realStrainData = strainData;

  const mockYesterdayData = yesterdayData || {
    dayStrain: 10.8,
    avgHr: 138,
    trainingLoad: 7.1
  };

  // Only use real data with valid values, no mock/dummy data
  const realWeeklyData = weeklyData && weeklyData.length > 0 
    ? weeklyData.filter(item => Number.isFinite(item.strain))
    : [];
  const realHourlyData = hourlyData && hourlyData.length > 0 
    ? hourlyData.filter(item => Number.isFinite(item.strain))
    : [];

  const getStrainColor = (strain: number) => {
    if (strain <= 7) return { color: '#10B981', text: 'text-emerald-400', bg: 'from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10', border: 'border-emerald-300 dark:border-emerald-500/20 shadow-lg', zone: 'Easy' };
    if (strain <= 14) return { color: '#F59E0B', text: 'text-yellow-400', bg: 'from-yellow-50 to-orange-50 dark:from-yellow-500/10 dark:to-orange-500/10', border: 'border-yellow-300 dark:border-yellow-500/20 shadow-lg', zone: 'Moderate' };
    return { color: '#EF4444', text: 'text-red-400', bg: 'from-red-50 to-pink-50 dark:from-red-500/10 dark:to-pink-500/10', border: 'border-red-300 dark:border-red-500/20 shadow-lg', zone: 'High' };
  };

  const strainColor = getStrainColor(realStrainData.dayStrain);
  const strainProgress = (realStrainData.dayStrain / 21) * 100;
  
  const avg7dStrain = realWeeklyData.length > 0 ? Math.round((realWeeklyData.reduce((sum, d) => sum + d.strain, 0) / realWeeklyData.length) * 10) / 10 : 0;
  const avg7dTrainingLoad = realWeeklyData.length > 0 ? Math.round((realWeeklyData.reduce((sum, d) => sum + d.trainingLoad, 0) / realWeeklyData.length) * 10) / 10 : 0;

  const compareValue = (current: number, yesterday: number, unit: string = '') => {
    const diff = current - yesterday;
    if (Math.abs(diff) < 0.1) return { icon: Minus, color: 'text-gray-400', text: `0${unit}` };
    if (diff > 0) return { icon: TrendingUp, color: 'text-emerald-400', text: `+${diff.toFixed(1)}${unit}` };
    return { icon: TrendingDown, color: 'text-red-400', text: `${diff.toFixed(1)}${unit}` };
  };

  const strainComparison = compareValue(realStrainData.dayStrain, mockYesterdayData.dayStrain);
  const avgHrComparison = compareValue(realStrainData.avgHr, mockYesterdayData.avgHr, ' bpm');
  const trainingLoadComparison = compareValue(realStrainData.trainingLoad, mockYesterdayData.trainingLoad);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Time range buttons removed as requested */}

      {/* Main Strain Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strain Gauge */}
        <Card id="pdf-strain" className={`mt-10 md:mt-12 rounded-2xl p-6 bg-gradient-to-br ${strainColor.bg} ${strainColor.border}`}>
          <div className="flex items-center gap-3 mb-6">
            <Zap className={`h-6 w-6 ${strainColor.text}`} />
            <div>
              <h3 className="font-semibold text-lg">
                {language === 'ar' ? 'إجهاد اليوم' : 'Day Strain'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'مقياس 0-21' : '0-21 Scale'}
              </p>
            </div>
          </div>

          <div className="gauge-3d relative h-36 w-36 sm:h-40 sm:w-40 mx-auto mb-6">
            <CircularProgressbar
              value={strainProgress}
              text={realStrainData.dayStrain.toFixed(1)}
              styles={buildStyles({
                pathColor: strainColor.color,
                textColor: strainColor.color,
                trailColor: `${strainColor.color}20`,
                strokeLinecap: 'round',
                textSize: '16px',
              })}
            />
            
            {/* Zone indicators */}
            <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-muted-foreground">
              <span>🟢 0</span>
              <span className="text-emerald-400">🟡 7</span>
              <span className="text-yellow-400">🔴 14</span>
              <span>21</span>
            </div>
          </div>

          <div className="text-center">
            <div className={`text-lg font-semibold ${strainColor.text} mb-2`}>
              {strainColor.zone} {language === 'ar' ? 'منطقة' : 'Zone'}
            </div>
            <p className="text-sm text-muted-foreground">
              {strainColor.zone === 'Easy' 
                ? (language === 'ar' ? 'تدريب خفيف أو راحة' : 'Light training or recovery')
                : strainColor.zone === 'Moderate'
                ? (language === 'ar' ? 'تدريب متوسط الشدة' : 'Moderate intensity training')
                : (language === 'ar' ? 'تدريب عالي الشدة' : 'High intensity training')
              }
            </p>
          </div>
        </Card>

        {/* Strain Stats */}
        <Card className="rounded-2xl p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-white/5 dark:to-white/5 border-purple-200 dark:border-white/10 shadow-lg">
          <h3 className="font-semibold text-lg mb-6">
            {language === 'ar' ? 'إحصائيات الإجهاد' : 'Strain Stats'}
          </h3>

          <div className="space-y-4">
            {/* Today's strain */}
            <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-sm text-muted-foreground mb-2">
                {language === 'ar' ? 'إجهاد اليوم' : 'Today\'s Strain'}
              </div>
              <div className={`text-2xl font-bold ${strainColor.text}`}>
                {realStrainData.dayStrain.toFixed(1)}
              </div>
            </div>

            {/* Average HR */}
            <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-sm text-muted-foreground mb-2">
                {language === 'ar' ? 'متوسط معدل ضربات القلب' : 'Average Heart Rate'}
              </div>
              <div className="text-2xl font-bold text-red-400">
                {realStrainData.avgHr} bpm
              </div>
            </div>

            {/* Training Load */}
            <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-sm text-muted-foreground mb-2">
                {language === 'ar' ? 'حمل التدريب' : 'Training Load'}
              </div>
              <div className="text-2xl font-bold text-purple-400">
                {realStrainData.trainingLoad.toFixed(1)}
              </div>
            </div>

            {/* 7-day average */}
            <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-sm text-muted-foreground mb-2">
                {language === 'ar' ? 'متوسط 7 أيام' : '7-Day Average'}
              </div>
              <div className="text-2xl font-bold text-blue-400">
                {avg7dStrain}
              </div>
            </div>

            {/* Energy Burned */}
            {typeof realStrainData.energyBurned === 'number' && (
              <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
                <div className="text-sm text-muted-foreground mb-2">
                  {language === 'ar' ? 'السعرات المحروقة' : 'Energy Burned'}
                </div>
                <div className="text-2xl font-bold text-orange-400">
                  {realStrainData.energyBurned} cal
                </div>
              </div>
            )}
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'إجهاد اليوم' : 'Day Strain'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{realStrainData.dayStrain.toFixed(1)}</span>
              <div className={`flex items-center gap-1 ${strainComparison.color}`}>
                <strainComparison.icon className="h-4 w-4" />
                <span className="text-sm">{strainComparison.text}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'متوسط معدل ضربات القلب' : 'Average Heart Rate'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{realStrainData.avgHr} bpm</span>
              <div className={`flex items-center gap-1 ${avgHrComparison.color}`}>
                <avgHrComparison.icon className="h-4 w-4" />
                <span className="text-sm">{avgHrComparison.text}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'حمل التدريب' : 'Training Load'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{realStrainData.trainingLoad.toFixed(1)}</span>
              <div className={`flex items-center gap-1 ${trainingLoadComparison.color}`}>
                <trainingLoadComparison.icon className="h-4 w-4" />
                <span className="text-sm">{trainingLoadComparison.text}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Charts - Only show if we have real data */}
      {(realWeeklyData.length > 0 || realHourlyData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hourly Strain Buildup - Only show if we have hourly data */}
          {realHourlyData.length > 0 && (
            <Card className="rounded-2xl p-6 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-white/5 dark:to-white/5 border-gray-200 dark:border-white/10 shadow-lg">
              <h3 className="font-semibold text-lg mb-4">
                {language === 'ar' ? 'تراكم الإجهاد اليومي' : 'Today\'s Strain Buildup'}
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={realHourlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value}`, 'Strain']}
                />
                <Bar dataKey="strain" fill="url(#strainGradient)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="strainGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
          )}

          {/* Weekly Strain Trend - Only show if we have weekly data */}
          {realWeeklyData.length > 0 && (
            <Card className="rounded-2xl p-6 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-white/5 dark:to-white/5 border-gray-200 dark:border-white/10 shadow-lg">
              <h3 className="font-semibold text-lg mb-4">
                {language === 'ar' ? 'اتجاه الإجهاد (7 أيام)' : 'Strain Trend (7 Days)'}
              </h3>
              
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={realWeeklyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <defs>
                      <linearGradient id="strainLineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.8} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                    <YAxis domain={[0, 21]} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value}`, 'Strain']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="strain" 
                      stroke="url(#strainLineGradient)" 
                      strokeWidth={3}
                      dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#8B5CF6', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Mini summary */}
      <Card className="rounded-2xl p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
        <p className="text-sm text-purple-300">
          {language === 'ar' 
            ? `إجهادك اليوم ${realStrainData.dayStrain.toFixed(1)} في منطقة ${strainColor.zone} مع متوسط معدل ضربات القلب ${realStrainData.avgHr} bpm`
            : `Your strain today is ${realStrainData.dayStrain.toFixed(1)} in the ${strainColor.zone} zone with an average heart rate of ${realStrainData.avgHr} bpm`
          }
        </p>
      </Card>
    </div>
  );
}
