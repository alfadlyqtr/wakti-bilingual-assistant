import React from "react";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { Moon, Heart, Zap, Dumbbell, Clock, Calendar } from "lucide-react";

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
      return new Date(isoString).toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
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
    return Math.round(kilojoules / 4.184);
  };

  const formatDistance = (meters?: number) => {
    if (!meters) return '--';
    return `${(meters / 1000).toFixed(2)} km`;
  };

  return (
    <Card className="rounded-2xl p-6 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-indigo-500/20 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center shadow-lg">
          <Heart className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            {language === 'ar' ? 'تفاصيل WHOOP' : 'WHOOP Details'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'تحليل شامل لبياناتك الصحية' : 'Comprehensive health data analysis'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Sleep Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 flex items-center justify-center">
              <Moon className="h-3 w-3 text-white" />
            </div>
            <h4 className="font-semibold text-blue-400">
              {language === 'ar' ? 'النوم' : 'Sleep'}
            </h4>
          </div>
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-4 shadow-lg">
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'وقت النوم' : 'Bedtime'}
                </div>
                <div className="font-medium">{formatTime(metrics?.sleep?.start)}</div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'وقت الاستيقاظ' : 'Wake Time'}
                </div>
                <div className="font-medium">{formatTime(metrics?.sleep?.end)}</div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'المدة' : 'Duration'}
                </div>
                <div className="font-medium">{formatDuration(metrics?.sleep?.duration_sec)}</div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'الأداء' : 'Performance'}
                </div>
                <div className="font-medium">
                  {metrics?.sleep?.performance_pct 
                    ? `${Math.round(metrics.sleep.performance_pct)}%` 
                    : '--'
                  }
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'قيلولة' : 'Nap'}
                </div>
                <div className="font-medium">
                  {metrics?.sleep?.data?.nap === true 
                    ? (language === 'ar' ? 'نعم' : 'Yes')
                    : metrics?.sleep?.data?.nap === false 
                    ? (language === 'ar' ? 'لا' : 'No')
                    : '--'
                  }
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'النوم العميق' : 'Deep Sleep'}
                </div>
                <div className="font-medium">
                  {metrics?.sleep?.data?.score?.stage_summary?.deep_sleep_milli 
                    ? `${Math.round(metrics.sleep.data.score.stage_summary.deep_sleep_milli / 60000)}m`
                    : '--'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recovery Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-emerald-400 to-green-400 flex items-center justify-center">
              <Heart className="h-3 w-3 text-white" />
            </div>
            <h4 className="font-semibold text-emerald-400">
              {language === 'ar' ? 'التعافي' : 'Recovery'}
            </h4>
          </div>
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl p-4 shadow-lg">
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'نقاط التعافي' : 'Recovery Score'}
                </div>
                <div className="font-medium">
                  {metrics?.recovery?.score 
                    ? `${Math.round(metrics.recovery.score)}%`
                    : '--'
                  }
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'تقلب معدل ضربات القلب' : 'HRV (RMSSD)'}
                </div>
                <div className="font-medium">
                  {metrics?.recovery?.hrv_ms 
                    ? `${Math.round(metrics.recovery.hrv_ms)} ms`
                    : '--'
                  }
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'معدل ضربات القلب أثناء الراحة' : 'Resting Heart Rate'}
                </div>
                <div className="font-medium">
                  {metrics?.recovery?.rhr_bpm 
                    ? `${Math.round(metrics.recovery.rhr_bpm)} bpm`
                    : '--'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Strain Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 flex items-center justify-center">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <h4 className="font-semibold text-yellow-400">
              {language === 'ar' ? 'الإجهاد' : 'Strain'}
            </h4>
          </div>
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4 shadow-lg">
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'إجهاد اليوم' : 'Day Strain'}
                </div>
                <div className="font-medium">
                  {metrics?.cycle?.day_strain 
                    ? metrics.cycle.day_strain.toFixed(1)
                    : '--'
                  }
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'متوسط معدل ضربات القلب' : 'Average Heart Rate'}
                </div>
                <div className="font-medium">
                  {metrics?.cycle?.avg_hr_bpm 
                    ? `${Math.round(metrics.cycle.avg_hr_bpm)} bpm`
                    : '--'
                  }
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'حمل التدريب' : 'Training Load'}
                </div>
                <div className="font-medium">
                  {metrics?.cycle?.training_load 
                    ? metrics.cycle.training_load.toFixed(1)
                    : '--'
                  }
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'الطاقة المستهلكة' : 'Energy Burned'}
                </div>
                <div className="font-medium">
                  {formatCalories(metrics?.cycle?.data?.score?.kilojoule)} cal
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Workout Details */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-orange-400 to-red-400 flex items-center justify-center">
              <Dumbbell className="h-3 w-3 text-white" />
            </div>
            <h4 className="font-semibold text-orange-400">
              {language === 'ar' ? 'التمرين' : 'Workout'}
            </h4>
          </div>
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-4 shadow-lg">
              <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'نوع التمرين' : 'Activity Type'}
                </div>
                <div className="font-medium">
                  {metrics?.workout?.sport_name || '--'}
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'وقت البداية' : 'Start Time'}
                </div>
                <div className="font-medium">{formatTime(metrics?.workout?.start)}</div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'المدة' : 'Duration'}
                </div>
                <div className="font-medium">
                  {metrics?.workout?.start && metrics?.workout?.end 
                    ? formatDuration((new Date(metrics.workout.end).getTime() - new Date(metrics.workout.start).getTime()) / 1000)
                    : '--'
                  }
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'الإجهاد' : 'Strain'}
                </div>
                <div className="font-medium">
                  {metrics?.workout?.strain 
                    ? metrics.workout.strain.toFixed(1)
                    : '--'
                  }
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'متوسط النبض' : 'Average HR'}
                </div>
                <div className="font-medium">
                  {metrics?.workout?.data?.score?.average_heart_rate 
                    ? `${Math.round(metrics.workout.data.score.average_heart_rate)} bpm`
                    : '--'
                  }
                </div>
                
                <div className="text-muted-foreground">
                  {language === 'ar' ? 'السعرات' : 'Calories'}
                </div>
                <div className="font-medium">
                  {formatCalories(metrics?.workout?.data?.score?.kilojoule)} cal
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-8 pt-6 border-t border-gradient-to-r from-purple-500/20 via-indigo-500/20 to-blue-500/20">
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-white/5 rounded-full px-4 py-2 mx-auto w-fit">
          <Calendar className="h-3 w-3 text-indigo-400" />
          <span>
            {language === 'ar' 
              ? `آخر تحديث: ${new Date().toLocaleString('ar-SA')}`
              : `Last updated: ${new Date().toLocaleString('en-US')}`
            }
          </span>
        </div>
      </div>
    </Card>
  );
}
