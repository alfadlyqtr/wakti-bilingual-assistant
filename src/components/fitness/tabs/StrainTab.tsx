import React, { useMemo } from "react";
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

  // Mock data for demonstration
  const mockStrainData = strainData || {
    dayStrain: 12.5,
    avgHr: 142,
    trainingLoad: 8.2,
    maxHr: 178
  };

  const mockYesterdayData = yesterdayData || {
    dayStrain: 10.8,
    avgHr: 138,
    trainingLoad: 7.1
  };

  const mockWeeklyData = weeklyData.length > 0 ? weeklyData : [
    { date: 'Mon', strain: 11.2, avgHr: 140, trainingLoad: 7.5 },
    { date: 'Tue', strain: 10.8, avgHr: 138, trainingLoad: 7.1 },
    { date: 'Wed', strain: 14.5, avgHr: 148, trainingLoad: 9.8 },
    { date: 'Thu', strain: 12.5, avgHr: 142, trainingLoad: 8.2 },
    { date: 'Fri', strain: 8.9, avgHr: 132, trainingLoad: 5.9 },
    { date: 'Sat', strain: 16.2, avgHr: 155, trainingLoad: 11.4 },
    { date: 'Sun', strain: 9.5, avgHr: 135, trainingLoad: 6.3 }
  ];

  const mockHourlyData = hourlyData.length > 0 ? hourlyData : [
    { hour: '6AM', strain: 0.2 },
    { hour: '7AM', strain: 1.8 },
    { hour: '8AM', strain: 3.2 },
    { hour: '9AM', strain: 4.1 },
    { hour: '10AM', strain: 5.8 },
    { hour: '11AM', strain: 7.2 },
    { hour: '12PM', strain: 8.5 },
    { hour: '1PM', strain: 9.8 },
    { hour: '2PM', strain: 10.9 },
    { hour: '3PM', strain: 11.7 },
    { hour: '4PM', strain: 12.1 },
    { hour: '5PM', strain: 12.5 }
  ];

  const getStrainColor = (strain: number) => {
    if (strain <= 7) return { color: '#10B981', text: 'text-emerald-400', bg: 'from-emerald-500/10 to-green-500/10', border: 'border-emerald-500/20', zone: 'Easy' };
    if (strain <= 14) return { color: '#F59E0B', text: 'text-yellow-400', bg: 'from-yellow-500/10 to-orange-500/10', border: 'border-yellow-500/20', zone: 'Moderate' };
    return { color: '#EF4444', text: 'text-red-400', bg: 'from-red-500/10 to-pink-500/10', border: 'border-red-500/20', zone: 'High' };
  };

  const strainColor = getStrainColor(mockStrainData.dayStrain);
  const strainProgress = (mockStrainData.dayStrain / 21) * 100;
  
  const avg7dStrain = Math.round((mockWeeklyData.reduce((sum, d) => sum + d.strain, 0) / mockWeeklyData.length) * 10) / 10;
  const avg7dTrainingLoad = Math.round((mockWeeklyData.reduce((sum, d) => sum + d.trainingLoad, 0) / mockWeeklyData.length) * 10) / 10;

  const compareValue = (current: number, yesterday: number, unit: string = '') => {
    const diff = current - yesterday;
    if (Math.abs(diff) < 0.1) return { icon: Minus, color: 'text-gray-400', text: `0${unit}` };
    if (diff > 0) return { icon: TrendingUp, color: 'text-emerald-400', text: `+${diff.toFixed(1)}${unit}` };
    return { icon: TrendingDown, color: 'text-red-400', text: `${diff.toFixed(1)}${unit}` };
  };

  const strainComparison = compareValue(mockStrainData.dayStrain, mockYesterdayData.dayStrain);
  const avgHrComparison = compareValue(mockStrainData.avgHr, mockYesterdayData.avgHr, ' bpm');
  const trainingLoadComparison = compareValue(mockStrainData.trainingLoad, mockYesterdayData.trainingLoad);

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

      {/* Main Strain Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Strain Gauge */}
        <Card className={`rounded-2xl p-6 bg-gradient-to-br ${strainColor.bg} ${strainColor.border}`}>
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

          <div className="relative h-36 w-36 sm:h-40 sm:w-40 mx-auto mb-6">
            <CircularProgressbar
              value={strainProgress}
              text={mockStrainData.dayStrain.toFixed(1)}
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
        <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
          <h3 className="font-semibold text-lg mb-6">
            {language === 'ar' ? 'إحصائيات الإجهاد' : 'Strain Stats'}
          </h3>

          <div className="space-y-4">
            {/* Today's strain */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-2">
                {language === 'ar' ? 'إجهاد اليوم' : 'Today\'s Strain'}
              </div>
              <div className={`text-2xl font-bold ${strainColor.text}`}>
                {mockStrainData.dayStrain.toFixed(1)}
              </div>
            </div>

            {/* Average HR */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-2">
                {language === 'ar' ? 'متوسط معدل ضربات القلب' : 'Average Heart Rate'}
              </div>
              <div className="text-2xl font-bold text-red-400">
                {mockStrainData.avgHr} bpm
              </div>
            </div>

            {/* Training Load */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-2">
                {language === 'ar' ? 'حمل التدريب' : 'Training Load'}
              </div>
              <div className="text-2xl font-bold text-purple-400">
                {mockStrainData.trainingLoad.toFixed(1)}
              </div>
            </div>

            {/* 7-day average */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="text-sm text-muted-foreground mb-2">
                {language === 'ar' ? 'متوسط 7 أيام' : '7-Day Average'}
              </div>
              <div className="text-2xl font-bold text-blue-400">
                {avg7dStrain}
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
              {language === 'ar' ? 'إجهاد اليوم' : 'Day Strain'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{mockStrainData.dayStrain.toFixed(1)}</span>
              <div className={`flex items-center gap-1 ${strainComparison.color}`}>
                <strainComparison.icon className="h-4 w-4" />
                <span className="text-sm">{strainComparison.text}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'متوسط معدل ضربات القلب' : 'Average Heart Rate'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{mockStrainData.avgHr} bpm</span>
              <div className={`flex items-center gap-1 ${avgHrComparison.color}`}>
                <avgHrComparison.icon className="h-4 w-4" />
                <span className="text-sm">{avgHrComparison.text}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'حمل التدريب' : 'Training Load'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{mockStrainData.trainingLoad.toFixed(1)}</span>
              <div className={`flex items-center gap-1 ${trainingLoadComparison.color}`}>
                <trainingLoadComparison.icon className="h-4 w-4" />
                <span className="text-sm">{trainingLoadComparison.text}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Strain Buildup */}
        <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
          <h3 className="font-semibold text-lg mb-4">
            {language === 'ar' ? 'تراكم الإجهاد اليومي' : 'Today\'s Strain Buildup'}
          </h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockHourlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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

        {/* Weekly Strain Trend */}
        <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
          <h3 className="font-semibold text-lg mb-4">
            {language === 'ar' ? 'اتجاه الإجهاد (7 أيام)' : 'Strain Trend (7 Days)'}
          </h3>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockWeeklyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
      </div>

      {/* Mini summary */}
      <Card className="rounded-2xl p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
        <p className="text-sm text-purple-300">
          {language === 'ar' 
            ? `إجهادك اليوم ${mockStrainData.dayStrain.toFixed(1)} في منطقة ${strainColor.zone} مع متوسط معدل ضربات القلب ${mockStrainData.avgHr} bpm`
            : `Your strain today is ${mockStrainData.dayStrain.toFixed(1)} in the ${strainColor.zone} zone with an average heart rate of ${mockStrainData.avgHr} bpm`
          }
        </p>
      </Card>
    </div>
  );
}
