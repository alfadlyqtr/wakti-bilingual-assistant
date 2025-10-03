import React, { useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Moon, Bed, AlarmClock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import 'react-circular-progressbar/dist/styles.css';

type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';

interface SleepTabProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  sleepData?: {
    hours: number;
    goalHours: number;
    performancePct: number;
    stages: {
      deep: number;
      rem: number;
      light: number;
      awake: number;
    };
    bedtime: string;
    waketime: string;
    efficiency: number;
    // Additional sleep metrics
    respiratoryRate?: number;
    sleepConsistency?: number;
    disturbanceCount?: number;
    sleepCycleCount?: number;
    sleepDebt?: number;
  };
  yesterdayData?: {
    hours: number;
    performancePct: number;
    stages: {
      deep: number;
      rem: number;
      light: number;
      awake: number;
    };
  };
  weeklyData?: Array<{
    date: string;
    hours: number;
    deep: number;
    rem: number;
    light: number;
    awake: number;
  }>;
}

const SLEEP_COLORS = {
  deep: '#6A5ACD',
  rem: '#FF6384',
  light: '#36A2EB',
  awake: '#FFA600'
};

export function SleepTab({ 
  timeRange, 
  onTimeRangeChange, 
  sleepData,
  yesterdayData,
  weeklyData = []
}: SleepTabProps) {
  const { language } = useTheme();

  // Always use parent-managed timeRange (default 1D). No local persistence.

  // Use real WHOOP data - no fallback to mock data
  if (!sleepData) {
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
            {language === 'ar' ? 'لا توجد بيانات نوم متاحة' : 'No sleep data available'}
          </p>
        </div>
      </div>
    );
  }

  const realSleepData = sleepData;

  const mockYesterdayData = yesterdayData || {
    hours: 6.8,
    performancePct: 78,
    stages: {
      deep: 75,
      rem: 105,
      light: 220,
      awake: 45
    }
  };

  // Only use real data with valid values, no mock/dummy data
  const realWeeklyData = weeklyData && weeklyData.length > 0 
    ? weeklyData.filter(item => 
        item.hours !== null && 
        item.hours !== undefined && 
        item.hours > 0 &&
        (item.deep !== null || item.rem !== null || item.light !== null)
      )
    : [];

  const hoursProgress = (realSleepData.hours / realSleepData.goalHours) * 100;
  
  const stageData = [
    { name: language === 'ar' ? 'عميق' : 'Deep', value: realSleepData.stages.deep, color: SLEEP_COLORS.deep },
    { name: language === 'ar' ? 'أحلام' : 'REM', value: realSleepData.stages.rem, color: SLEEP_COLORS.rem },
    { name: language === 'ar' ? 'خفيف' : 'Light', value: realSleepData.stages.light, color: SLEEP_COLORS.light },
    { name: language === 'ar' ? 'استيقاظ' : 'Awake', value: realSleepData.stages.awake, color: SLEEP_COLORS.awake }
  ];

  const totalStageMinutes = stageData.reduce((sum, stage) => sum + stage.value, 0);

  // Prevent rendering numeric 0 in conditionals (React will print 0)
  const hasAnyAdvancedMetric = (
    (realSleepData.respiratoryRate !== undefined && realSleepData.respiratoryRate > 0) ||
    (realSleepData.sleepConsistency !== undefined && realSleepData.sleepConsistency > 0) ||
    (realSleepData.disturbanceCount !== undefined && realSleepData.disturbanceCount > 0) ||
    (realSleepData.sleepCycleCount !== undefined && realSleepData.sleepCycleCount > 0) ||
    (realSleepData.sleepDebt !== undefined && realSleepData.sleepDebt !== 0)
  );

  const compareValue = (current: number, yesterday: number) => {
    const diff = current - yesterday;
    if (Math.abs(diff) < 0.1) return { icon: Minus, color: 'text-gray-400', text: '0' };
    if (diff > 0) return { icon: TrendingUp, color: 'text-emerald-400', text: `+${diff.toFixed(1)}` };
    return { icon: TrendingDown, color: 'text-red-400', text: diff.toFixed(1) };
  };

  const hoursComparison = compareValue(realSleepData.hours, mockYesterdayData.hours);
  const performanceComparison = compareValue(realSleepData.performancePct, mockYesterdayData.performancePct);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mini-tabs for time range */}
      <div className="flex gap-3 mb-6 flex-wrap justify-center sm:justify-start mt-16">
        {(['1d', '1w', '2w', '1m', '3m', '6m'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => { onTimeRangeChange(range); }}
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

      {/* Main Sleep Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Multi-Ring Sleep Donut */}
        <Card className="rounded-2xl p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-500/10 dark:to-purple-500/10 border-blue-300 dark:border-blue-500/20 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <Moon className="h-6 w-6 text-blue-400" />
            <div>
              <h3 className="font-semibold text-lg">
                {language === 'ar' ? 'تحليل النوم' : 'Sleep Analysis'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'الليلة الماضية' : 'Last Night'}
              </p>
            </div>
          </div>

          <div className="gauge-3d relative h-36 w-36 sm:h-40 sm:w-40 mx-auto mb-6 rounded-full shadow-2xl bg-gradient-to-br from-white to-gray-100 border border-gray-200 dark:from-white/10 dark:to-white/5 dark:border-white/10">
            {/* Outer ring - Total hours vs goal */}
            <div className="absolute inset-0">
              <CircularProgressbar
                value={hoursProgress}
                styles={buildStyles({
                  pathColor: '#3B82F6',
                  trailColor: 'rgba(59, 130, 246, 0.1)',
                  strokeLinecap: 'round',
                })}
              />
            </div>
            
            {/* Inner solid circle to restore the classic donut center */}
            <div className="absolute inset-6 rounded-full bg-white/90 dark:bg-white/10 shadow-inner ring-1 ring-black/5 dark:ring-white/10" />

            {/* Inner ring - Stage distribution */}
            <div className="absolute inset-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={35}
                    paddingAngle={1}
                    dataKey="value"
                  >
                    {stageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value} min`, '']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Center text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center px-3 py-2 rounded-full bg-white/70 dark:bg-white/5 shadow-inner ring-1 ring-white/60 dark:ring-white/10 backdrop-blur-sm">
                <div className="text-lg font-bold text-gray-800 dark:text-white">{realSleepData.hours.toFixed(1)}h</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {Math.round(hoursProgress)}%
                </div>
              </div>
            </div>
          </div>

          {/* Sleep metrics in one row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
            <div className="bg-white dark:bg-white/10 rounded-xl p-2 sm:p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'المدة' : 'Duration'}
              </div>
              <div className="text-sm sm:text-base font-bold text-indigo-400">
                {realSleepData.hours.toFixed(1)}h
              </div>
            </div>
            <div className="bg-white dark:bg-white/10 rounded-xl p-2 sm:p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'وقت النوم' : 'Bedtime'}
              </div>
              <div className="text-sm sm:text-base font-bold text-blue-400">
                {realSleepData.bedtime}
              </div>
            </div>
            <div className="bg-white dark:bg-white/10 rounded-xl p-2 sm:p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'وقت الاستيقاظ' : 'Wake Time'}
              </div>
              <div className="text-sm sm:text-base font-bold text-orange-400">
                {realSleepData.waketime}
              </div>
            </div>
            <div className="bg-white dark:bg-white/10 rounded-xl p-2 sm:p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'الأداء' : 'Performance'}
              </div>
              <div className="text-sm sm:text-base font-bold text-purple-400">
                {realSleepData.performancePct}%
              </div>
            </div>
            <div className="bg-white dark:bg-white/10 rounded-xl p-2 sm:p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'الكفاءة' : 'Efficiency'}
              </div>
              <div className="text-sm sm:text-base font-bold text-emerald-400">
                {realSleepData.efficiency}%
              </div>
            </div>
          </div>

          {/* Extra metrics inline (to match card). Always show in 1D when values are available (>=0). */}
          {(
            timeRange === '1d' ||
            (realSleepData.sleepConsistency || realSleepData.respiratoryRate || realSleepData.sleepCycleCount || realSleepData.disturbanceCount !== undefined)
          ) && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {typeof realSleepData.sleepConsistency === 'number' && realSleepData.sleepConsistency >= 0 && (
                <div className="bg-white dark:bg-white/10 rounded-xl p-2 sm:p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
                  <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'الثبات' : 'Consistency'}</div>
                  <div className="text-sm sm:text-base font-bold text-emerald-500">{Math.round(realSleepData.sleepConsistency)}%</div>
                </div>
              )}
              {typeof realSleepData.respiratoryRate === 'number' && realSleepData.respiratoryRate > 0 && (
                <div className="bg-white dark:bg-white/10 rounded-xl p-2 sm:p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
                  <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'معدل التنفس' : 'Respiratory Rate'}</div>
                  <div className="text-sm sm:text-base font-bold text-cyan-500">{realSleepData.respiratoryRate.toFixed(1)} <span className="text-xs">{language === 'ar' ? 'ن/د' : 'bpm'}</span></div>
                </div>
              )}
              {typeof realSleepData.sleepCycleCount === 'number' && realSleepData.sleepCycleCount >= 0 && (
                <div className="bg-white dark:bg-white/10 rounded-xl p-2 sm:p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
                  <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'دورات النوم' : 'Sleep Cycles'}</div>
                  <div className="text-sm sm:text-base font-bold text-purple-500">{realSleepData.sleepCycleCount}</div>
                </div>
              )}
              {typeof realSleepData.disturbanceCount === 'number' && realSleepData.disturbanceCount >= 0 && (
                <div className="bg-white dark:bg-white/10 rounded-xl p-2 sm:p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
                  <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'الاضطرابات' : 'Disturbances'}</div>
                  <div className="text-sm sm:text-base font-bold text-yellow-500">{realSleepData.disturbanceCount}</div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Sleep Stages Breakdown */}
        <Card className="rounded-2xl p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-white/5 dark:to-white/5 border-purple-200 dark:border-white/10 shadow-lg">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-400 to-blue-400"></div>
            {language === 'ar' ? 'مراحل النوم' : 'Sleep Stages'}
          </h3>

          <div className="space-y-4">
            {stageData.map((stage) => {
              const percentage = (stage.value / totalStageMinutes) * 100;
              return (
                <div key={stage.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="font-medium">{stage.name}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold">{stage.value}m</span>
                      <span className="text-muted-foreground ml-1">
                        ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="relative w-full h-3 rounded-full bg-gradient-to-b from-white to-gray-100 border border-gray-200 shadow-inner overflow-hidden dark:from-white/10 dark:to-white/5 dark:border-white/10">
                    <div
                      className="relative h-full rounded-full transition-all duration-500 border border-black/10 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.15),0_2px_6px_rgba(0,0,0,0.08)]"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: stage.color
                      }}
                    >
                      <div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0))' }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mini summary */}
          <div className="mt-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <p className="text-sm text-blue-300">
              {language === 'ar' 
                ? `حصلت على ${realSleepData.stages.deep} دقيقة من النوم العميق و ${realSleepData.stages.rem} دقيقة من نوم الأحلام`
                : `You got ${realSleepData.stages.deep} minutes of deep sleep and ${realSleepData.stages.rem} minutes of REM sleep`
              }
            </p>
          </div>
        </Card>

        {/* Additional Sleep Metrics */}
        {hasAnyAdvancedMetric && (
          <Card className="rounded-2xl p-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-white/5 dark:to-white/5 border-green-200 dark:border-white/10 shadow-lg">
            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-400 to-blue-400"></div>
              {language === 'ar' ? 'مقاييس النوم المتقدمة' : 'Advanced Sleep Metrics'}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {realSleepData.respiratoryRate && realSleepData.respiratoryRate > 0 && (
                <div className="bg-white dark:bg-white/10 rounded-xl p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
                  <div className="text-xs text-muted-foreground mb-1">
                    {language === 'ar' ? 'معدل التنفس' : 'Respiratory Rate'}
                  </div>
                  <div className="text-lg font-bold text-cyan-400">
                    {realSleepData.respiratoryRate.toFixed(1)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'ar' ? 'نفس/دقيقة' : 'breaths/min'}
                  </div>
                </div>
              )}

              {realSleepData.sleepConsistency && realSleepData.sleepConsistency > 0 && (
                <div className="bg-white dark:bg-white/10 rounded-xl p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
                  <div className="text-xs text-muted-foreground mb-1">
                    {language === 'ar' ? 'ثبات النوم' : 'Sleep Consistency'}
                  </div>
                  <div className="text-lg font-bold text-green-400">
                    {Math.round(realSleepData.sleepConsistency)}%
                  </div>
                </div>
              )}

              {realSleepData.disturbanceCount !== undefined && realSleepData.disturbanceCount >= 0 && (
                <div className="bg-white dark:bg-white/10 rounded-xl p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
                  <div className="text-xs text-muted-foreground mb-1">
                    {language === 'ar' ? 'الاضطرابات' : 'Disturbances'}
                  </div>
                  <div className="text-lg font-bold text-yellow-400">
                    {realSleepData.disturbanceCount}
                  </div>
                </div>
              )}

              {realSleepData.sleepCycleCount && realSleepData.sleepCycleCount > 0 && (
                <div className="bg-white dark:bg-white/10 rounded-xl p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
                  <div className="text-xs text-muted-foreground mb-1">
                    {language === 'ar' ? 'دورات النوم' : 'Sleep Cycles'}
                  </div>
                  <div className="text-lg font-bold text-purple-400">
                    {realSleepData.sleepCycleCount}
                  </div>
                </div>
              )}

              {realSleepData.sleepDebt !== undefined && realSleepData.sleepDebt !== 0 && (
                <div className="bg-white dark:bg-white/10 rounded-xl p-3 text-center shadow-md border border-gray-200 dark:border-white/20">
                  <div className="text-xs text-muted-foreground mb-1">
                    {language === 'ar' ? 'دين النوم' : 'Sleep Debt'}
                  </div>
                  <div className={`text-lg font-bold ${realSleepData.sleepDebt > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {realSleepData.sleepDebt > 0 ? '+' : ''}{realSleepData.sleepDebt}m
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'ساعات النوم' : 'Sleep Hours'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{realSleepData.hours.toFixed(1)}h</span>
              <div className={`flex items-center gap-1 ${hoursComparison.color}`}>
                <hoursComparison.icon className="h-4 w-4" />
                <span className="text-sm">{hoursComparison.text}h</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'الأداء' : 'Performance'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{realSleepData.performancePct}%</span>
              <div className={`flex items-center gap-1 ${performanceComparison.color}`}>
                <performanceComparison.icon className="h-4 w-4" />
                <span className="text-sm">{performanceComparison.text}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'النوم العميق' : 'Deep Sleep'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{realSleepData.stages.deep}m</span>
              <div className={`flex items-center gap-1 ${
                realSleepData.stages.deep > mockYesterdayData.stages.deep 
                  ? 'text-emerald-400' 
                  : realSleepData.stages.deep < mockYesterdayData.stages.deep
                  ? 'text-red-400'
                  : 'text-gray-400'
              }`}>
                {realSleepData.stages.deep > mockYesterdayData.stages.deep ? (
                  <><TrendingUp className="h-4 w-4" /><span className="text-sm">+{realSleepData.stages.deep - mockYesterdayData.stages.deep}m</span></>
                ) : realSleepData.stages.deep < mockYesterdayData.stages.deep ? (
                  <><TrendingDown className="h-4 w-4" /><span className="text-sm">{realSleepData.stages.deep - mockYesterdayData.stages.deep}m</span></>
                ) : (
                  <><Minus className="h-4 w-4" /><span className="text-sm">0m</span></>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'نوم الأحلام' : 'REM Sleep'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{realSleepData.stages.rem}m</span>
              <div className={`flex items-center gap-1 ${
                realSleepData.stages.rem > mockYesterdayData.stages.rem 
                  ? 'text-emerald-400' 
                  : realSleepData.stages.rem < mockYesterdayData.stages.rem
                  ? 'text-red-400'
                  : 'text-gray-400'
              }`}>
                {realSleepData.stages.rem > mockYesterdayData.stages.rem ? (
                  <><TrendingUp className="h-4 w-4" /><span className="text-sm">+{realSleepData.stages.rem - mockYesterdayData.stages.rem}m</span></>
                ) : realSleepData.stages.rem < mockYesterdayData.stages.rem ? (
                  <><TrendingDown className="h-4 w-4" /><span className="text-sm">{realSleepData.stages.rem - mockYesterdayData.stages.rem}m</span></>
                ) : (
                  <><Minus className="h-4 w-4" /><span className="text-sm">0m</span></>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 7-Day Sleep Trends - Only show if we have real data */}
      {realWeeklyData.length > 0 && (
        <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
          <h3 className="font-semibold text-lg mb-4">
            {language === 'ar' ? 'اتجاهات النوم (7 أيام)' : 'Sleep Trends (7 Days)'}
          </h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={realWeeklyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => [
                  `${value}${name === 'hours' ? 'h' : 'm'}`,
                  name === 'hours' ? 'Total Sleep' : name.charAt(0).toUpperCase() + name.slice(1)
                ]}
              />
              <Legend />
              <Bar dataKey="deep" stackId="stages" fill={SLEEP_COLORS.deep} name={language === 'ar' ? 'عميق' : 'Deep'} />
              <Bar dataKey="rem" stackId="stages" fill={SLEEP_COLORS.rem} name={language === 'ar' ? 'أحلام' : 'REM'} />
              <Bar dataKey="light" stackId="stages" fill={SLEEP_COLORS.light} name={language === 'ar' ? 'خفيف' : 'Light'} />
              <Bar dataKey="awake" stackId="stages" fill={SLEEP_COLORS.awake} name={language === 'ar' ? 'استيقاظ' : 'Awake'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      )}
    </div>
  );
}
