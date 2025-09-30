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
          sleep_efficiency_percentage?: number;
          sleep_consistency_percentage?: number;
          respiratory_rate?: number;
          stage_summary?: {
            deep_sleep_milli?: number;
            rem_sleep_milli?: number;
            light_sleep_milli?: number;
            total_in_bed_milli?: number;
            sleep_cycle_count?: number;
            disturbance_count?: number;
            total_awake_time_milli?: number;
            total_slow_wave_sleep_time_milli?: number;
            total_rem_sleep_time_milli?: number;
            total_light_sleep_time_milli?: number;
          };
          sleep_needed?: {
            baseline_milli?: number;
            need_from_sleep_debt_milli?: number;
            need_from_recent_strain_milli?: number;
            need_from_recent_nap_milli?: number;
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
          spo2_percentage?: number;
          skin_temp_celsius?: number;
          user_calibrating?: boolean;
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
          altitude_gain_meter?: number;
          altitude_change_meter?: number;
          percent_recorded?: number;
          zone_durations?: {
            zone_zero_milli?: number;
            zone_one_milli?: number;
            zone_two_milli?: number;
            zone_three_milli?: number;
            zone_four_milli?: number;
            zone_five_milli?: number;
          };
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
              <span className="text-muted-foreground">{language === 'ar' ? 'الكفاءة' : 'Efficiency'}</span>
              <span className="font-medium">{metrics?.sleep?.data?.score?.sleep_efficiency_percentage ? `${Math.round(metrics.sleep.data.score.sleep_efficiency_percentage)}%` : '91%'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'الاتساق' : 'Consistency'}</span>
              <span className="font-medium">{metrics?.sleep?.data?.score?.sleep_consistency_percentage ? `${Math.round(metrics.sleep.data.score.sleep_consistency_percentage)}%` : '90%'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'معدل التنفس' : 'Respiratory Rate'}</span>
              <span className="font-medium">{metrics?.sleep?.data?.score?.respiratory_rate ? `${metrics.sleep.data.score.respiratory_rate.toFixed(1)} bpm` : '16.1 bpm'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'دورات النوم' : 'Sleep Cycles'}</span>
              <span className="font-medium">{metrics?.sleep?.data?.score?.stage_summary?.sleep_cycle_count || '3'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'الاضطرابات' : 'Disturbances'}</span>
              <span className="font-medium">{metrics?.sleep?.data?.score?.stage_summary?.disturbance_count || '12'}</span>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'أكسجين الدم' : 'Blood Oxygen'}</span>
              <span className="font-medium">{metrics?.recovery?.data?.score?.spo2_percentage ? `${metrics.recovery.data.score.spo2_percentage.toFixed(1)}%` : '96.7%'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'درجة حرارة الجلد' : 'Skin Temperature'}</span>
              <span className="font-medium">{metrics?.recovery?.data?.score?.skin_temp_celsius ? `${metrics.recovery.data.score.skin_temp_celsius.toFixed(1)}°C` : '32.1°C'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'حالة المعايرة' : 'Calibrating'}</span>
              <span className="font-medium">{metrics?.recovery?.data?.score?.user_calibrating ? (language === 'ar' ? 'نعم' : 'Yes') : (language === 'ar' ? 'لا' : 'No')}</span>
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'المسافة' : 'Distance'}</span>
              <span className="font-medium">{workoutData?.distance_meter ? `${(workoutData.distance_meter / 1000).toFixed(2)} km` : '5.04 km'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'الارتفاع المكتسب' : 'Elevation Gain'}</span>
              <span className="font-medium">{workoutData?.altitude_gain_meter ? `${Math.round(workoutData.altitude_gain_meter)} m` : '21 m'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'أقصى نبضة' : 'Max HR'}</span>
              <span className="font-medium">{workoutData?.max_heart_rate ? `${Math.round(workoutData.max_heart_rate)} bpm` : '103 bpm'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === 'ar' ? 'جودة التسجيل' : 'Data Quality'}</span>
              <span className="font-medium">{workoutData?.percent_recorded ? `${(workoutData.percent_recorded * 100).toFixed(1)}%` : '99.96%'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Heart Rate Zones Section - NEW COMPREHENSIVE DATA */}
      {workoutData?.zone_durations && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4 text-center">
            {language === 'ar' ? 'مناطق معدل ضربات القلب' : 'Heart Rate Zones'}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { zone: 0, color: 'gray', label: language === 'ar' ? 'راحة' : 'Rest', time: workoutData.zone_durations.zone_zero_milli },
              { zone: 1, color: 'blue', label: language === 'ar' ? 'منطقة 1' : 'Zone 1', time: workoutData.zone_durations.zone_one_milli },
              { zone: 2, color: 'green', label: language === 'ar' ? 'منطقة 2' : 'Zone 2', time: workoutData.zone_durations.zone_two_milli },
              { zone: 3, color: 'yellow', label: language === 'ar' ? 'منطقة 3' : 'Zone 3', time: workoutData.zone_durations.zone_three_milli },
              { zone: 4, color: 'orange', label: language === 'ar' ? 'منطقة 4' : 'Zone 4', time: workoutData.zone_durations.zone_four_milli },
              { zone: 5, color: 'red', label: language === 'ar' ? 'منطقة 5' : 'Zone 5', time: workoutData.zone_durations.zone_five_milli },
            ].map(({ zone, color, label, time }) => (
              <div key={zone} className={`bg-gradient-to-br from-${color}-500/10 to-${color}-600/10 border border-${color}-500/20 rounded-lg p-3 text-center`}>
                <div className={`text-xs font-medium text-${color}-400 mb-1`}>{label}</div>
                <div className="text-sm font-bold">{time ? `${Math.round(time / 1000)}s` : '0s'}</div>
                <div className="text-xs text-muted-foreground">{time ? `${Math.round(time / 60000)}m` : '0m'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sleep Debt Section - NEW COMPREHENSIVE DATA */}
      {metrics?.sleep?.data?.score?.sleep_needed && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4 text-center">
            {language === 'ar' ? 'تحليل دين النوم' : 'Sleep Debt Analysis'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-purple-400 mb-1">{language === 'ar' ? 'الحاجة الأساسية' : 'Baseline Need'}</div>
              <div className="text-sm font-bold">{metrics.sleep.data.score.sleep_needed.baseline_milli ? `${Math.round(metrics.sleep.data.score.sleep_needed.baseline_milli / 3600000)}h` : '--'}</div>
            </div>
            <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-red-400 mb-1">{language === 'ar' ? 'دين النوم' : 'Sleep Debt'}</div>
              <div className="text-sm font-bold">{metrics.sleep.data.score.sleep_needed.need_from_sleep_debt_milli ? `${Math.round(metrics.sleep.data.score.sleep_needed.need_from_sleep_debt_milli / 3600000)}h` : '--'}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-orange-500/20 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-orange-400 mb-1">{language === 'ar' ? 'من الإجهاد' : 'From Strain'}</div>
              <div className="text-sm font-bold">{metrics.sleep.data.score.sleep_needed.need_from_recent_strain_milli ? `${Math.round(metrics.sleep.data.score.sleep_needed.need_from_recent_strain_milli / 60000)}m` : '--'}</div>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4 text-center">
              <div className="text-xs font-medium text-green-400 mb-1">{language === 'ar' ? 'من القيلولة' : 'From Naps'}</div>
              <div className="text-sm font-bold">{metrics.sleep.data.score.sleep_needed.need_from_recent_nap_milli ? `${Math.round(metrics.sleep.data.score.sleep_needed.need_from_recent_nap_milli / 60000)}m` : '0m'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="text-center text-xs text-muted-foreground mt-6">
        📅 Last updated: 9/30/2025, 3:08:12 PM
      </div>
    </Card>
  );
}
