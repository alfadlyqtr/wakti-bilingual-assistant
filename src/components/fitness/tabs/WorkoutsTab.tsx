import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dumbbell, Clock, Zap, Flame, TrendingUp, TrendingDown, Minus, Play } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ScatterChart, Scatter } from "recharts";

type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';

interface WorkoutsTabProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  latestWorkout?: {
    sport: string;
    duration: number;
    strain: number;
    calories: number;
    avgHr: number;
    maxHr: number;
    zones?: { [key: string]: number };
  };
  yesterdayWorkout?: {
    duration: number;
    strain: number;
    calories: number;
  };
  workoutHistory?: Array<{
    date: string;
    sport: string;
    duration: number;
    strain: number;
    calories: number;
    avgHr: number;
  }>;
}

export function WorkoutsTab({ 
  timeRange, 
  onTimeRangeChange, 
  latestWorkout,
  yesterdayWorkout,
  workoutHistory = []
}: WorkoutsTabProps) {
  const { language } = useTheme();

  // Mock data for demonstration
  const mockLatestWorkout = latestWorkout || {
    sport: 'Cycling',
    duration: 45,
    strain: 14.2,
    calories: 520,
    avgHr: 152,
    maxHr: 178,
    zones: {
      'Zone 1': 300000, // 5 minutes in milliseconds
      'Zone 2': 900000, // 15 minutes
      'Zone 3': 1200000, // 20 minutes
      'Zone 4': 300000, // 5 minutes
      'Zone 5': 0
    }
  };

  const mockYesterdayWorkout = yesterdayWorkout || {
    duration: 35,
    strain: 11.8,
    calories: 420
  };

  const mockWorkoutHistory = workoutHistory.length > 0 ? workoutHistory : [
    { date: 'Mon', sport: 'Cycling', duration: 60, strain: 12.5, calories: 480, avgHr: 145 },
    { date: 'Tue', sport: 'Running', duration: 35, strain: 11.8, calories: 420, avgHr: 148 },
    { date: 'Wed', sport: 'Strength', duration: 50, strain: 13.2, calories: 380, avgHr: 135 },
    { date: 'Thu', sport: 'Running', duration: 45, strain: 14.2, calories: 520, avgHr: 152 },
    { date: 'Fri', sport: 'Yoga', duration: 30, strain: 6.5, calories: 180, avgHr: 95 },
    { date: 'Sat', sport: 'HIIT', duration: 25, strain: 16.8, calories: 350, avgHr: 165 },
    { date: 'Sun', sport: 'Walking', duration: 90, strain: 8.2, calories: 280, avgHr: 110 }
  ];

  const getSportIcon = (sport: string) => {
    const sportLower = sport.toLowerCase();
    if (sportLower.includes('run')) return '🏃';
    if (sportLower.includes('cycle') || sportLower.includes('bike')) return '🚴';
    if (sportLower.includes('swim')) return '🏊';
    if (sportLower.includes('strength') || sportLower.includes('weight')) return '🏋️';
    if (sportLower.includes('yoga')) return '🧘';
    if (sportLower.includes('walk')) return '🚶';
    if (sportLower.includes('hiit')) return '💪';
    return '🏃';
  };

  const getSportColor = (sport: string) => {
    const sportLower = sport.toLowerCase();
    if (sportLower.includes('run')) return 'text-red-400';
    if (sportLower.includes('cycle')) return 'text-blue-400';
    if (sportLower.includes('swim')) return 'text-cyan-400';
    if (sportLower.includes('strength')) return 'text-purple-400';
    if (sportLower.includes('yoga')) return 'text-green-400';
    if (sportLower.includes('walk')) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getZoneColor = (zone: string) => {
    switch (zone) {
      case 'Zone 1': return '#10B981';
      case 'Zone 2': return '#84CC16';
      case 'Zone 3': return '#F59E0B';
      case 'Zone 4': return '#F97316';
      case 'Zone 5': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const totalZoneTime = Object.values(mockLatestWorkout.zones || {}).reduce((sum, time) => sum + time, 0);
  const zoneData = Object.entries(mockLatestWorkout.zones || {}).map(([zone, time]) => ({
    zone,
    minutes: Math.round(time / 60000),
    percentage: totalZoneTime > 0 ? (time / totalZoneTime) * 100 : 0,
    color: getZoneColor(zone)
  }));

  const compareValue = (current: number, yesterday: number, unit: string = '') => {
    const diff = current - yesterday;
    if (Math.abs(diff) < 0.1) return { icon: Minus, color: 'text-gray-400', text: `0${unit}` };
    if (diff > 0) return { icon: TrendingUp, color: 'text-emerald-400', text: `+${diff.toFixed(1)}${unit}` };
    return { icon: TrendingDown, color: 'text-red-400', text: `${diff.toFixed(1)}${unit}` };
  };

  const durationComparison = compareValue(mockLatestWorkout.duration, mockYesterdayWorkout.duration, 'min');
  const strainComparison = compareValue(mockLatestWorkout.strain, mockYesterdayWorkout.strain);
  const caloriesComparison = compareValue(mockLatestWorkout.calories, mockYesterdayWorkout.calories, 'cal');

  const strainVsCaloriesData = mockWorkoutHistory.map(w => ({
    strain: w.strain,
    calories: w.calories,
    sport: w.sport
  }));

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

      {/* Latest Workout Card */}
      <Card className="rounded-2xl p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
        <div className="flex items-center gap-3 mb-6">
          <Dumbbell className="h-6 w-6 text-orange-400" />
          <div>
            <h3 className="font-semibold text-lg">
              {language === 'ar' ? 'آخر تمرين' : 'Latest Workout'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' ? 'الجلسة الأخيرة' : 'Most Recent Session'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workout Overview */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{getSportIcon(mockLatestWorkout.sport)}</span>
              <div>
                <h4 className={`text-xl font-bold ${getSportColor(mockLatestWorkout.sport)}`}>
                  {mockLatestWorkout.sport}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {mockLatestWorkout.duration} {language === 'ar' ? 'دقيقة' : 'minutes'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'الإجهاد' : 'Strain'}
                </div>
                <div className="text-xl font-bold text-purple-400">
                  {mockLatestWorkout.strain.toFixed(1)}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'السعرات' : 'Calories'}
                </div>
                <div className="text-xl font-bold text-orange-400">
                  {mockLatestWorkout.calories}
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'متوسط النبض' : 'Avg HR'}
                </div>
                <div className="text-xl font-bold text-red-400">
                  {mockLatestWorkout.avgHr} bpm
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'أقصى نبض' : 'Max HR'}
                </div>
                <div className="text-xl font-bold text-pink-400">
                  {mockLatestWorkout.maxHr} bpm
                </div>
              </div>
            </div>
          </div>

          {/* HR Zones */}
          <div>
            <h4 className="font-semibold mb-4">
              {language === 'ar' ? 'مناطق معدل ضربات القلب' : 'Heart Rate Zones'}
            </h4>
            <div className="space-y-3">
              {zoneData.map((zone) => (
                <div key={zone.zone} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{zone.zone}</span>
                    <span className="text-sm text-muted-foreground">
                      {zone.minutes}m ({zone.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${zone.percentage}%`,
                        backgroundColor: zone.color
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Day Statistics - Today vs Yesterday */}
      <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border-emerald-500/20">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-emerald-400" />
          {language === 'ar' ? 'إحصائيات اليوم' : 'Day Statistics'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'مدة التمرين' : 'Workout Duration'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{mockLatestWorkout.duration}min</span>
              <div className={`flex items-center gap-1 ${durationComparison.color}`}>
                <durationComparison.icon className="h-4 w-4" />
                <span className="text-sm">{durationComparison.text}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'إجهاد التمرين' : 'Workout Strain'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{mockLatestWorkout.strain.toFixed(1)}</span>
              <div className={`flex items-center gap-1 ${strainComparison.color}`}>
                <strainComparison.icon className="h-4 w-4" />
                <span className="text-sm">{strainComparison.text}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="text-sm text-muted-foreground mb-2">
              {language === 'ar' ? 'السعرات المحروقة' : 'Calories Burned'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">{mockLatestWorkout.calories}</span>
              <div className={`flex items-center gap-1 ${caloriesComparison.color}`}>
                <caloriesComparison.icon className="h-4 w-4" />
                <span className="text-sm">{caloriesComparison.text}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Workouts List */}
      <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
        <h3 className="font-semibold text-lg mb-4">
          {language === 'ar' ? 'التمارين الأخيرة' : 'Recent Workouts'}
        </h3>
        
        <div className="space-y-3">
          {mockWorkoutHistory.slice(0, 5).map((workout, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getSportIcon(workout.sport)}</span>
                <div>
                  <div className={`font-medium ${getSportColor(workout.sport)}`}>
                    {workout.sport}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {workout.date} • {workout.duration}min
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-center">
                  <div className="text-purple-400 font-semibold">{workout.strain.toFixed(1)}</div>
                  <div className="text-muted-foreground">Strain</div>
                </div>
                <div className="text-center">
                  <div className="text-orange-400 font-semibold">{workout.calories}</div>
                  <div className="text-muted-foreground">Cal</div>
                </div>
                <div className="text-center">
                  <div className="text-red-400 font-semibold">{workout.avgHr}</div>
                  <div className="text-muted-foreground">HR</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Strain vs Calories Chart */}
      <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
        <h3 className="font-semibold text-lg mb-4">
          {language === 'ar' ? 'الإجهاد مقابل السعرات' : 'Strain vs Calories'}
        </h3>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart data={strainVsCaloriesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="strain" 
                type="number" 
                domain={[0, 'dataMax + 2']}
                tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                label={{ value: 'Strain', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: '#9CA3AF' } }}
              />
              <YAxis 
                dataKey="calories" 
                type="number" 
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                label={{ value: 'Calories', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#9CA3AF' } }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.8)', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => [
                  name === 'strain' ? value.toFixed(1) : value,
                  name === 'strain' ? 'Strain' : 'Calories'
                ]}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.sport || ''}
              />
              <Scatter dataKey="calories" fill="#F97316" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Mini summary */}
        <div className="mt-4 p-4 bg-orange-500/10 rounded-xl border border-orange-500/20">
          <p className="text-sm text-orange-300">
            {language === 'ar' 
              ? `هذا الأسبوع: ${mockWorkoutHistory.length} تمارين بمتوسط ${Math.round(mockWorkoutHistory.reduce((sum, w) => sum + w.strain, 0) / mockWorkoutHistory.length * 10) / 10} إجهاد`
              : `This week: ${mockWorkoutHistory.length} workouts with average strain of ${Math.round(mockWorkoutHistory.reduce((sum, w) => sum + w.strain, 0) / mockWorkoutHistory.length * 10) / 10}`
            }
          </p>
        </div>
      </Card>
    </div>
  );
}
