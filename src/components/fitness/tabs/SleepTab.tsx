import React, { useMemo } from "react";
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

  // Mock data for demonstration
  const mockSleepData = sleepData || {
    hours: 7.5,
    goalHours: 8,
    performancePct: 85,
    stages: {
      deep: 90, // minutes
      rem: 120,
      light: 240,
      awake: 30
    },
    bedtime: '23:30',
    waketime: '07:00',
    efficiency: 92
  };

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

  const mockWeeklyData = weeklyData.length > 0 ? weeklyData : [
    { date: 'Mon', hours: 7.2, deep: 85, rem: 110, light: 230, awake: 35 },
    { date: 'Tue', hours: 6.8, deep: 75, rem: 105, light: 220, awake: 45 },
    { date: 'Wed', hours: 8.1, deep: 95, rem: 125, light: 260, awake: 25 },
    { date: 'Thu', hours: 7.5, deep: 90, rem: 120, light: 240, awake: 30 },
    { date: 'Fri', hours: 6.5, deep: 70, rem: 100, light: 210, awake: 50 },
    { date: 'Sat', hours: 8.5, deep: 100, rem: 135, light: 275, awake: 20 },
    { date: 'Sun', hours: 7.8, deep: 88, rem: 118, light: 245, awake: 28 }
  ];

  const hoursProgress = (mockSleepData.hours / mockSleepData.goalHours) * 100;
  
  const stageData = [
    { name: 'Deep', value: mockSleepData.stages.deep, color: SLEEP_COLORS.deep },
    { name: 'REM', value: mockSleepData.stages.rem, color: SLEEP_COLORS.rem },
    { name: 'Light', value: mockSleepData.stages.light, color: SLEEP_COLORS.light },
    { name: 'Awake', value: mockSleepData.stages.awake, color: SLEEP_COLORS.awake }
  ];

  const totalStageMinutes = stageData.reduce((sum, stage) => sum + stage.value, 0);

  const compareValue = (current: number, yesterday: number) => {
    const diff = current - yesterday;
    if (Math.abs(diff) < 0.1) return { icon: Minus, color: 'text-gray-400', text: '0' };
    if (diff > 0) return { icon: TrendingUp, color: 'text-emerald-400', text: `+${diff.toFixed(1)}` };
    return { icon: TrendingDown, color: 'text-red-400', text: diff.toFixed(1) };
  };

  const hoursComparison = compareValue(mockSleepData.hours, mockYesterdayData.hours);
  const performanceComparison = compareValue(mockSleepData.performancePct, mockYesterdayData.performancePct);

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

      {/* Main Sleep Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Multi-Ring Sleep Donut */}
        <Card className="rounded-2xl p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
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

          <div className="relative h-36 w-36 sm:h-40 sm:w-40 mx-auto mb-6">
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
            
            {/* Inner ring - Stage distribution */}
            <div className="absolute inset-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stageData}
                    cx="50%"
                    cy="50%"
                    innerRadius={20}
                    outerRadius={30}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-lg font-bold">{mockSleepData.hours.toFixed(1)}h</div>
              <div className="text-xs text-muted-foreground">
                {Math.round(hoursProgress)}%
              </div>
            </div>
          </div>

          {/* Sleep metrics in one row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="bg-white/5 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'وقت النوم' : 'Bedtime'}
              </div>
              <div className="text-sm sm:text-base font-bold text-blue-400">
                {mockSleepData.bedtime}
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'وقت الاستيقاظ' : 'Wake Time'}
              </div>
              <div className="text-sm sm:text-base font-bold text-orange-400">
                {mockSleepData.waketime}
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'الأداء' : 'Performance'}
              </div>
              <div className="text-sm sm:text-base font-bold text-purple-400">
                {mockSleepData.performancePct}%
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-2 sm:p-3 text-center">
              <div className="text-xs text-muted-foreground mb-1">
                {language === 'ar' ? 'الكفاءة' : 'Efficiency'}
              </div>
              <div className="text-sm sm:text-base font-bold text-emerald-400">
                {mockSleepData.efficiency}%
              </div>
            </div>
          </div>
        </Card>

        {/* Sleep Stages Breakdown */}
        <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
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
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: stage.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mini summary */}
          <div className="mt-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <p className="text-sm text-blue-300">
              {language === 'ar' 
                ? `حصلت على ${mockSleepData.stages.deep} دقيقة من النوم العميق و ${mockSleepData.stages.rem} دقيقة من نوم الأحلام`
                : `You got ${mockSleepData.stages.deep} minutes of deep sleep and ${mockSleepData.stages.rem} minutes of REM sleep`
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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'ساعات النوم' : 'Sleep Hours'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{mockSleepData.hours.toFixed(1)}h</span>
              <div className={`flex items-center gap-1 ${hoursComparison.color}`}>
                <hoursComparison.icon className="h-4 w-4" />
                <span className="text-sm">{hoursComparison.text}h</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'الأداء' : 'Performance'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{mockSleepData.performancePct}%</span>
              <div className={`flex items-center gap-1 ${performanceComparison.color}`}>
                <performanceComparison.icon className="h-4 w-4" />
                <span className="text-sm">{performanceComparison.text}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'النوم العميق' : 'Deep Sleep'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{mockSleepData.stages.deep}m</span>
              <div className={`flex items-center gap-1 ${
                mockSleepData.stages.deep > mockYesterdayData.stages.deep 
                  ? 'text-emerald-400' 
                  : mockSleepData.stages.deep < mockYesterdayData.stages.deep
                  ? 'text-red-400'
                  : 'text-gray-400'
              }`}>
                {mockSleepData.stages.deep > mockYesterdayData.stages.deep ? (
                  <><TrendingUp className="h-4 w-4" /><span className="text-sm">+{mockSleepData.stages.deep - mockYesterdayData.stages.deep}m</span></>
                ) : mockSleepData.stages.deep < mockYesterdayData.stages.deep ? (
                  <><TrendingDown className="h-4 w-4" /><span className="text-sm">{mockSleepData.stages.deep - mockYesterdayData.stages.deep}m</span></>
                ) : (
                  <><Minus className="h-4 w-4" /><span className="text-sm">0m</span></>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'نوم الأحلام' : 'REM Sleep'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{mockSleepData.stages.rem}m</span>
              <div className={`flex items-center gap-1 ${
                mockSleepData.stages.rem > mockYesterdayData.stages.rem 
                  ? 'text-emerald-400' 
                  : mockSleepData.stages.rem < mockYesterdayData.stages.rem
                  ? 'text-red-400'
                  : 'text-gray-400'
              }`}>
                {mockSleepData.stages.rem > mockYesterdayData.stages.rem ? (
                  <><TrendingUp className="h-4 w-4" /><span className="text-sm">+{mockSleepData.stages.rem - mockYesterdayData.stages.rem}m</span></>
                ) : mockSleepData.stages.rem < mockYesterdayData.stages.rem ? (
                  <><TrendingDown className="h-4 w-4" /><span className="text-sm">{mockSleepData.stages.rem - mockYesterdayData.stages.rem}m</span></>
                ) : (
                  <><Minus className="h-4 w-4" /><span className="text-sm">0m</span></>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 7-Day Sleep Trends */}
      <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
        <h3 className="font-semibold text-lg mb-4">
          {language === 'ar' ? 'اتجاهات النوم (7 أيام)' : 'Sleep Trends (7 Days)'}
        </h3>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mockWeeklyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
              <Bar dataKey="deep" stackId="stages" fill={SLEEP_COLORS.deep} name="Deep" />
              <Bar dataKey="rem" stackId="stages" fill={SLEEP_COLORS.rem} name="REM" />
              <Bar dataKey="light" stackId="stages" fill={SLEEP_COLORS.light} name="Light" />
              <Bar dataKey="awake" stackId="stages" fill={SLEEP_COLORS.awake} name="Awake" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
