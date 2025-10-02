import React, { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Dumbbell } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

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


  return (
    <div className="space-y-4 md:space-y-6">
      {/* Mini-tabs for time range */}
      <div className="flex gap-3 mb-6 flex-wrap justify-center sm:justify-start mt-16">
        {(['1d', '1w', '2w', '1m', '3m', '6m'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => { onTimeRangeChange(range); try { localStorage.setItem('wakti:workouts:timeRange', range); } catch (_) {} }}
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

      {/* Latest Workout Card */}
      <Card className="rounded-2xl p-6 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-500/10 dark:to-red-500/10 border-orange-300 dark:border-orange-500/20 shadow-lg">
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

            <div className="grid grid-cols-2 gap-4">
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
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
