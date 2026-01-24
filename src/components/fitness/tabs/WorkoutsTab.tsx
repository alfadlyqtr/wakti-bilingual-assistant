import React, { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Dumbbell } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";

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
    // Extra fields to match WhoopDetails
    distanceKm?: number;
    elevationGainM?: number;
    dataQualityPct?: number;
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
  workoutHistory = []
}: WorkoutsTabProps) {
  const { language } = useTheme();

  // Load persisted timeRange once on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wakti:workouts:timeRange') as TimeRange | null;
      if (saved && saved !== timeRange) onTimeRangeChange(saved);
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use real WHOOP data - no fallback to mock data
  if (!latestWorkout) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {language === 'ar' ? 'لا توجد بيانات تمارين متاحة' : 'No workout data available'}
          </p>
        </div>
      </div>
    );
  }

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


  // Heart rate zones data for pie chart
  const hrZonesData = latestWorkout.zones ? [
    { name: language === 'ar' ? 'منخفض' : 'Low', value: latestWorkout.zones.low || 0, color: '#10B981' },
    { name: language === 'ar' ? 'متوسط' : 'Moderate', value: latestWorkout.zones.moderate || 0, color: '#F59E0B' },
    { name: language === 'ar' ? 'عالي' : 'High', value: latestWorkout.zones.high || 0, color: '#EF4444' }
  ].filter(zone => zone.value > 0) : [];

  // Filter real workout history data
  const realWorkoutHistory = workoutHistory && workoutHistory.length > 0 
    ? workoutHistory.filter(w => w.strain > 0 || w.calories > 0)
    : [];

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Time range buttons removed as requested */}

      {/* Latest Workout Card */}
      <Card id="pdf-workouts" className="mt-10 md:mt-12 rounded-2xl p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-500/10 dark:to-red-500/10 border-orange-300 dark:border-orange-500/20 shadow-lg">
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
              <span className="text-3xl">{getSportIcon(latestWorkout.sport)}</span>
              <div>
                <h4 className={`text-xl font-bold ${getSportColor(latestWorkout.sport)}`}>
                  {latestWorkout.sport}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {latestWorkout.duration} {language === 'ar' ? 'دقيقة' : 'minutes'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'الإجهاد' : 'Strain'}
                </div>
                <div className="text-xl font-bold text-purple-400">
                  {latestWorkout.strain.toFixed(1)}
                </div>
              </div>
              <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'السعرات' : 'Calories'}
                </div>
                <div className="text-xl font-bold text-orange-400">
                  {latestWorkout.calories}
                </div>
              </div>
              <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'متوسط النبض' : 'Avg HR'}
                </div>
                <div className="text-xl font-bold text-red-400">
                  {latestWorkout.avgHr} bpm
                </div>
              </div>
              <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'أقصى نبض' : 'Max HR'}
                </div>
                <div className="text-xl font-bold text-pink-400">
                  {latestWorkout.maxHr} bpm
                </div>
              </div>
              <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'المسافة' : 'Distance'}
                </div>
                <div className="text-xl font-bold text-blue-500">
                  {typeof latestWorkout.distanceKm === 'number' ? `${latestWorkout.distanceKm} km` : '--'}
                </div>
              </div>
              <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'الارتفاع المكتسب' : 'Elevation Gain'}
                </div>
                <div className="text-xl font-bold text-emerald-500">
                  {typeof latestWorkout.elevationGainM === 'number' ? `${latestWorkout.elevationGainM} m` : '--'}
                </div>
              </div>
              <div className="bg-white dark:bg-white/10 rounded-xl p-3 shadow-md border border-gray-200 dark:border-white/20">
                <div className="text-sm text-muted-foreground mb-1">
                  {language === 'ar' ? 'جودة البيانات' : 'Data Quality'}
                </div>
                <div className="text-xl font-bold text-teal-500">
                  {typeof latestWorkout.dataQualityPct === 'number' ? `${latestWorkout.dataQualityPct}%` : '--'}
                </div>
              </div>
            </div>
          </div>

          {/* Heart Rate Zones - Pie Chart */}
          {hrZonesData.length > 0 && (
            <div className="bg-white dark:bg-white/10 rounded-xl p-4 shadow-md border border-gray-200 dark:border-white/20">
              <h4 className="font-semibold mb-4 text-center">
                {language === 'ar' ? 'مناطق معدل ضربات القلب' : 'Heart Rate Zones'}
              </h4>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hrZonesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {hrZonesData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 12,
                      }}
                      formatter={(value: number) => [`${value}%`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {hrZonesData.map((zone) => (
                  <div key={zone.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                      <span>{zone.name}</span>
                    </div>
                    <span className="font-semibold">{zone.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Workout History Chart - Only show if we have real data */}
      {realWorkoutHistory.length > 0 && (
        <Card className="rounded-2xl p-6 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-white/5 dark:to-white/5 border-gray-200 dark:border-white/10 shadow-lg">
          <h3 className="font-semibold text-lg mb-4">
            {language === 'ar' ? 'سجل التمارين' : 'Workout History'}
          </h3>
          
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={realWorkoutHistory} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="strainGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="caloriesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  formatter={(value) => (
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      value === 'strain'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    }`}>
                      {value === 'strain' 
                        ? (language === 'ar' ? 'الإجهاد' : 'Strain')
                        : (language === 'ar' ? 'السعرات' : 'Calories')
                      }
                    </span>
                  )}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="strain" 
                  fill="url(#strainGradient)" 
                  radius={[6, 6, 0, 0]} 
                  name="strain"
                />
                <Bar 
                  yAxisId="right"
                  dataKey="calories" 
                  fill="url(#caloriesGradient)" 
                  radius={[6, 6, 0, 0]} 
                  name="calories"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Mini summary */}
          <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/10 to-orange-500/10 rounded-xl border border-purple-500/20">
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? `${realWorkoutHistory.length} تمرين في هذه الفترة`
                : `${realWorkoutHistory.length} workouts in this period`
              }
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
