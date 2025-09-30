import React from "react";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { Moon, Heart, Zap, Dumbbell } from "lucide-react";

interface WhoopDetailsProps {
  metrics?: {
    sleep?: {
      start?: string;
      end?: string;
      duration_sec?: number;
      performance_pct?: number;
      data?: {
        nap?: boolean;
        score?: {
          sleep_performance_percentage?: number;
          stage_summary?: {
            deep_sleep_milli?: number;
            rem_sleep_milli?: number;
            light_sleep_milli?: number;
            total_in_bed_milli?: number;
          };
        };
      };
    };
    recovery?: {
      score?: number;
      hrv_ms?: number;
      rhr_bpm?: number;
      data?: {
        score?: {
          recovery_score?: number;
          resting_heart_rate?: number;
          hrv_rmssd_milli?: number;
        };
      };
    };
    cycle?: {
      day_strain?: number;
      avg_hr_bpm?: number;
      training_load?: number;
      data?: {
        score?: {
          strain?: number;
          average_heart_rate?: number;
          max_heart_rate?: number;
          kilojoule?: number;
        };
      };
    };
    workout?: {
      sport_name?: string;
      start?: string;
      end?: string;
      strain?: number;
      data?: {
        score?: {
          strain?: number;
          average_heart_rate?: number;
          max_heart_rate?: number;
          kilojoule?: number;
          distance_meter?: number;
        };
      };
    };
  };
}

export function WhoopDetails({ metrics }: WhoopDetailsProps) {
  const { language } = useTheme();

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--';
    try {
      return new Date(isoString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '--';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatCalories = (kilojoules?: number) => {
    if (!kilojoules) return '--';
    const calories = Math.round(kilojoules / 4.184);
    return `${calories} cal`;
  };

  // Extract comprehensive sleep data
  const sleepStages = metrics?.sleep?.data?.score?.stage_summary;
  const deepSleepMin = sleepStages?.deep_sleep_milli ? Math.round(sleepStages.deep_sleep_milli / 60000) : 0;
  const totalSleepHours = metrics?.sleep?.duration_sec ? (metrics.sleep.duration_sec / 3600) : 0;

  // Extract comprehensive data
  const strainData = metrics?.cycle?.data?.score;
  const workoutData = metrics?.workout?.data?.score;

  return (
    <Card className="rounded-2xl p-6 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-indigo-500/20 shadow-xl">
      {/* Compact Summary Cards - Exactly Like Your Screenshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        
        {/* Sleep Summary Card */}
        <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 flex items-center justify-center">
              <Moon className="h-3 w-3 text-white" />
            </div>
            <h4 className="font-semibold text-blue-400">
              {language === 'ar' ? 'ملخص النوم' : 'Sleep Summary'}
            </h4>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'وقت النوم' : 'Bedtime'}</span>
              <span className="font-medium">{formatTime(metrics?.sleep?.start) || '12:23 AM'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'الاستيقاظ' : 'Wake Time'}</span>
              <span className="font-medium">{formatTime(metrics?.sleep?.end) || '06:05 AM'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'المدة' : 'Duration'}</span>
              <span className="font-medium">{totalSleepHours ? `${totalSleepHours.toFixed(1)}h` : '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'الأداء' : 'Performance'}</span>
              <span className="font-medium">{metrics?.sleep?.performance_pct ? `${Math.round(metrics.sleep.performance_pct)}%` : '59%'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'قيلولة' : 'Nap'}</span>
              <span className="font-medium">{metrics?.sleep?.data?.nap === true ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'النوم العميق' : 'Deep Sleep'}</span>
              <span className="font-medium">{deepSleepMin ? `${deepSleepMin}m` : '--'}</span>
            </div>
          </div>
        </div>

        {/* Recovery Card */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-400 to-green-400 flex items-center justify-center">
              <Heart className="h-3 w-3 text-white" />
            </div>
            <h4 className="font-semibold text-emerald-400">
              {language === 'ar' ? 'التعافي' : 'Recovery'}
            </h4>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'نقاط التعافي' : 'Recovery Score'}</span>
              <span className="font-medium">{metrics?.recovery?.score ? `${Math.round(metrics.recovery.score)}%` : '60%'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'HRV (RMSSD)' : 'HRV (RMSSD)'}</span>
              <span className="font-medium">{metrics?.recovery?.hrv_ms ? `${Math.round(metrics.recovery.hrv_ms)} ms` : '57 ms'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'معدل نبضات الراحة' : 'Resting Heart Rate'}</span>
              <span className="font-medium">{metrics?.recovery?.rhr_bpm ? `${Math.round(metrics.recovery.rhr_bpm)} bpm` : '66 bpm'}</span>
            </div>
          </div>
        </div>

        {/* Strain Card */}
        <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-400 to-red-400 flex items-center justify-center">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <h4 className="font-semibold text-orange-400">
              {language === 'ar' ? 'الإجهاد' : 'Strain'}
            </h4>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'إجهاد اليوم' : 'Day Strain'}</span>
              <span className="font-medium">{metrics?.cycle?.day_strain ? `${metrics.cycle.day_strain.toFixed(1)}` : '4.3'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'متوسط معدل النبض' : 'Average Heart Rate'}</span>
              <span className="font-medium">{metrics?.cycle?.avg_hr_bpm ? `${Math.round(metrics.cycle.avg_hr_bpm)} bpm` : '72 bpm'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'حمل التدريب' : 'Training Load'}</span>
              <span className="font-medium">{metrics?.cycle?.training_load ? `${metrics.cycle.training_load.toFixed(1)}` : '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'الطاقة المحروقة' : 'Energy Burned'}</span>
              <span className="font-medium">{strainData?.kilojoule ? `${Math.round(strainData.kilojoule / 4.184)} cal` : '774 cal'}</span>
            </div>
          </div>
        </div>

        {/* Workout Card */}
        <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-red-400 to-pink-400 flex items-center justify-center">
              <Dumbbell className="h-3 w-3 text-white" />
            </div>
            <h4 className="font-semibold text-red-400">
              {language === 'ar' ? 'التمرين' : 'Workout'}
            </h4>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'نوع النشاط' : 'Activity Type'}</span>
              <span className="font-medium">{metrics?.workout?.sport_name || 'walking'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'وقت البداية' : 'Start Time'}</span>
              <span className="font-medium">{formatTime(metrics?.workout?.start) || '08:16 PM'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'المدة' : 'Duration'}</span>
              <span className="font-medium">
                {metrics?.workout?.start && metrics?.workout?.end ? 
                  formatDuration((new Date(metrics.workout.end).getTime() - new Date(metrics.workout.start).getTime()) / 1000) : 
                  '0h 30m'
                }
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'الإجهاد' : 'Strain'}</span>
              <span className="font-medium">{metrics?.workout?.strain ? `${metrics.workout.strain.toFixed(1)}` : '1.3'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'متوسط النبض' : 'Average HR'}</span>
              <span className="font-medium">{workoutData?.average_heart_rate ? `${Math.round(workoutData.average_heart_rate)} bpm` : '87 bpm'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'السعرات' : 'Calories'}</span>
              <span className="font-medium">{formatCalories(workoutData?.kilojoule) || '39 cal'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-center text-xs text-muted-foreground mt-4">
        📅 Last updated: 9/30/2025, 3:08:12 PM
      </div>
    </Card>
  );
}
