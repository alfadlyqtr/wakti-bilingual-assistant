import React from "react";
import { Card } from "@/components/ui/card";
import { useTheme } from "@/providers/ThemeProvider";
import { Moon, Heart, Zap, Dumbbell, Clock, Calendar, Activity, Brain, Bed, AlarmClock, TrendingUp } from "lucide-react";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

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

  const formatDate = (isoString?: string) => {
    if (!isoString) return '--';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return '--';
    }
  };

  const formatCalories = (kilojoules?: number) => {
    if (!kilojoules) return '--';
    const calories = Math.round(kilojoules / 4.184);
    return `${calories} cal`;
  };

  // Extract comprehensive sleep data like Sleep tab does
  const sleepStages = metrics?.sleep?.data?.score?.stage_summary;
  const deepSleepMin = sleepStages?.deep_sleep_milli ? Math.round(sleepStages.deep_sleep_milli / 60000) : 0;
  const remSleepMin = sleepStages?.rem_sleep_milli ? Math.round(sleepStages.rem_sleep_milli / 60000) : 0;
  const lightSleepMin = sleepStages?.light_sleep_milli ? Math.round(sleepStages.light_sleep_milli / 60000) : 0;
  const awakeMilli = sleepStages?.total_in_bed_milli ? 
    sleepStages.total_in_bed_milli - (sleepStages.deep_sleep_milli || 0) - (sleepStages.rem_sleep_milli || 0) - (sleepStages.light_sleep_milli || 0) : 0;
  const awakeMin = Math.round(awakeMilli / 60000);

  const totalSleepHours = metrics?.sleep?.duration_sec ? (metrics.sleep.duration_sec / 3600) : 0;

  // Extract comprehensive recovery data
  const recoveryData = metrics?.recovery?.data?.score;
  
  // Extract comprehensive strain data
  const strainData = metrics?.cycle?.data?.score;
  
  // Extract comprehensive workout data
  const workoutData = metrics?.workout?.data?.score;
  
  return (
    <Card className="rounded-2xl p-6 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-indigo-500/20 shadow-xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center shadow-lg">
          <Heart className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            {language === 'ar' ? 'تفاصيل WHOOP الشاملة' : 'Comprehensive WHOOP Analysis'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === 'ar' ? 'تحليل مفصل وشامل لجميع بياناتك الصحية' : 'Detailed analysis of all your health metrics'}
          </p>
        </div>
      </div>

      {/* Sleep Analysis Section - Like Sleep Tab */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 flex items-center justify-center">
            <Moon className="h-4 w-4 text-white" />
          </div>
          <h4 className="text-lg font-semibold text-blue-400">
            {language === 'ar' ? 'تحليل النوم المفصل' : 'Detailed Sleep Analysis'}
          </h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Sleep Overview with Circular Chart */}
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-blue-300">{language === 'ar' ? 'ملخص النوم' : 'Sleep Overview'}</h5>
              <Bed className="h-5 w-5 text-blue-400" />
            </div>
            
            <div className="w-32 h-32 mx-auto mb-4">
              <CircularProgressbar
                value={totalSleepHours}
                maxValue={10}
                text={`${totalSleepHours.toFixed(1)}h`}
                styles={buildStyles({
                  textColor: '#60A5FA',
                  pathColor: '#3B82F6',
                  trailColor: '#1E293B',
                  textSize: '16px'
                })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-center">
                <div className="text-muted-foreground">{language === 'ar' ? 'وقت النوم' : 'Bedtime'}</div>
                <div className="font-medium text-blue-300">{formatTime(metrics?.sleep?.start)}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">{language === 'ar' ? 'الاستيقاظ' : 'Wake Time'}</div>
                <div className="font-medium text-blue-300">{formatTime(metrics?.sleep?.end)}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">{language === 'ar' ? 'الأداء' : 'Performance'}</div>
                <div className="font-medium text-blue-300">{metrics?.sleep?.performance_pct ? `${Math.round(metrics.sleep.performance_pct)}%` : '--'}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">{language === 'ar' ? 'الكفاءة' : 'Efficiency'}</div>
                <div className="font-medium text-blue-300">
                  {sleepStages?.total_in_bed_milli ? 
                    `${Math.round(((sleepStages.deep_sleep_milli || 0) + (sleepStages.rem_sleep_milli || 0) + (sleepStages.light_sleep_milli || 0)) / sleepStages.total_in_bed_milli * 100)}%` 
                    : '--'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Sleep Stages Breakdown */}
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-blue-300">{language === 'ar' ? 'مراحل النوم' : 'Sleep Stages'}</h5>
              <Brain className="h-5 w-5 text-blue-400" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                  <span className="text-sm">{language === 'ar' ? 'عميق' : 'Deep'}</span>
                </div>
                <span className="font-medium text-indigo-300">{deepSleepMin}m</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-sm">{language === 'ar' ? 'حركة العين السريعة' : 'REM'}</span>
                </div>
                <span className="font-medium text-purple-300">{remSleepMin}m</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                  <span className="text-sm">{language === 'ar' ? 'خفيف' : 'Light'}</span>
                </div>
                <span className="font-medium text-blue-300">{lightSleepMin}m</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                  <span className="text-sm">{language === 'ar' ? 'مستيقظ' : 'Awake'}</span>
                </div>
                <span className="font-medium text-orange-300">{awakeMin}m</span>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-blue-500/20">
              <div className="text-xs text-muted-foreground text-center">
                {language === 'ar' ? 
                  `حصلت على ${deepSleepMin} دقيقة من النوم العميق و ${remSleepMin} دقيقة من نوم حركة العين السريعة` :
                  `You got ${deepSleepMin} minutes of deep sleep and ${remSleepMin} minutes of REM sleep`
                }
              </div>
            </div>
          </div>

          {/* Day Statistics */}
          <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-blue-300">{language === 'ar' ? 'إحصائيات اليوم' : 'Day Statistics'}</h5>
              <Calendar className="h-5 w-5 text-blue-400" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                <div className="text-lg font-bold text-blue-300">{totalSleepHours.toFixed(1)}h</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'ساعات النوم' : 'Sleep Hours'}</div>
                <div className="text-xs text-green-400">vs 8h</div>
              </div>
              
              <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                <div className="text-lg font-bold text-blue-300">{metrics?.sleep?.performance_pct ? `${Math.round(metrics.sleep.performance_pct)}%` : '--'}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'الأداء' : 'Performance'}</div>
                <div className="text-xs text-red-400">vs 100%</div>
              </div>
              
              <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                <div className="text-lg font-bold text-indigo-300">{deepSleepMin}m</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'النوم العميق' : 'Deep Sleep'}</div>
                <div className="text-xs text-green-400">+57m</div>
              </div>
              
              <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                <div className="text-lg font-bold text-purple-300">{remSleepMin}m</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'نوم REM' : 'REM Sleep'}</div>
                <div className="text-xs text-red-400">-4m</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recovery Analysis Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-400 to-green-400 flex items-center justify-center">
            <Heart className="h-4 w-4 text-white" />
          </div>
          <h4 className="text-lg font-semibold text-emerald-400">
            {language === 'ar' ? 'تحليل التعافي المفصل' : 'Detailed Recovery Analysis'}
          </h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recovery Score with Gauge */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-emerald-300">{language === 'ar' ? 'نقاط التعافي' : 'Recovery Score'}</h5>
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            
            <div className="w-32 h-32 mx-auto mb-4">
              <CircularProgressbar
                value={metrics?.recovery?.score || 0}
                maxValue={100}
                text={`${Math.round(metrics?.recovery?.score || 0)}%`}
                styles={buildStyles({
                  textColor: '#10B981',
                  pathColor: '#059669',
                  trailColor: '#1E293B',
                  textSize: '16px'
                })}
              />
            </div>
            
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-2">
                {language === 'ar' ? 'حالة التعافي' : 'Recovery Status'}
              </div>
              <div className="font-medium text-emerald-300">
                {(metrics?.recovery?.score || 0) >= 67 ? 
                  (language === 'ar' ? 'ممتاز' : 'Excellent') :
                  (metrics?.recovery?.score || 0) >= 34 ? 
                  (language === 'ar' ? 'جيد' : 'Good') :
                  (language === 'ar' ? 'يحتاج راحة' : 'Needs Rest')
                }
              </div>
            </div>
          </div>

          {/* HRV Analysis */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-emerald-300">{language === 'ar' ? 'تحليل HRV' : 'HRV Analysis'}</h5>
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            
            <div className="text-center mb-4">
              <div className="text-3xl font-bold text-emerald-300">{metrics?.recovery?.hrv_ms || '--'}ms</div>
              <div className="text-sm text-muted-foreground">{language === 'ar' ? 'متوسط HRV' : 'HRV Average'}</div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">{language === 'ar' ? 'معدل نبضات الراحة' : 'Resting HR'}</span>
                <span className="font-medium text-emerald-300">{metrics?.recovery?.rhr_bpm || '--'} bpm</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">{language === 'ar' ? 'التباين' : 'Variability'}</span>
                <span className="font-medium text-emerald-300">
                  {recoveryData?.hrv_rmssd_milli ? `${Math.round(recoveryData.hrv_rmssd_milli)}ms` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Recovery Trends */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-emerald-300">{language === 'ar' ? 'اتجاهات التعافي' : 'Recovery Trends'}</h5>
              <TrendingUp className="h-5 w-5 text-emerald-400" />
            </div>
            
            <div className="space-y-4">
              <div className="text-center p-3 bg-emerald-500/10 rounded-lg">
                <div className="text-lg font-bold text-emerald-300">{metrics?.recovery?.score || '--'}%</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'اليوم' : 'Today'}</div>
              </div>
              
              <div className="text-center p-3 bg-emerald-500/10 rounded-lg">
                <div className="text-lg font-bold text-emerald-300">{metrics?.recovery?.hrv_ms || '--'}ms</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'HRV اليوم' : 'Today HRV'}</div>
              </div>
              
              <div className="text-center p-3 bg-emerald-500/10 rounded-lg">
                <div className="text-lg font-bold text-emerald-300">{metrics?.recovery?.rhr_bpm || '--'}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'معدل الراحة' : 'Resting HR'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strain Analysis Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-400 to-red-400 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <h4 className="text-lg font-semibold text-orange-400">
            {language === 'ar' ? 'تحليل الإجهاد المفصل' : 'Detailed Strain Analysis'}
          </h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Current Strain */}
          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-orange-300">{language === 'ar' ? 'الإجهاد الحالي' : 'Current Strain'}</h5>
              <Zap className="h-5 w-5 text-orange-400" />
            </div>
            
            <div className="w-32 h-32 mx-auto mb-4">
              <CircularProgressbar
                value={metrics?.cycle?.day_strain || 0}
                maxValue={21}
                text={`${(metrics?.cycle?.day_strain || 0).toFixed(1)}`}
                styles={buildStyles({
                  textColor: '#F59E0B',
                  pathColor: '#EF4444',
                  trailColor: '#1E293B',
                  textSize: '16px'
                })}
              />
            </div>
            
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-2">
                {language === 'ar' ? 'مستوى الإجهاد' : 'Strain Level'}
              </div>
              <div className="font-medium text-orange-300">
                {(metrics?.cycle?.day_strain || 0) >= 15 ? 
                  (language === 'ar' ? 'عالي' : 'High') :
                  (metrics?.cycle?.day_strain || 0) >= 8 ? 
                  (language === 'ar' ? 'متوسط' : 'Moderate') :
                  (language === 'ar' ? 'منخفض' : 'Low')
                }
              </div>
            </div>
          </div>

          {/* Heart Rate Analysis */}
          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-orange-300">{language === 'ar' ? 'تحليل معدل النبض' : 'Heart Rate Analysis'}</h5>
              <Heart className="h-5 w-5 text-orange-400" />
            </div>
            
            <div className="space-y-4">
              <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                <div className="text-lg font-bold text-orange-300">{metrics?.cycle?.avg_hr_bpm || '--'}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'متوسط النبض' : 'Average HR'}</div>
              </div>
              
              <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                <div className="text-lg font-bold text-orange-300">{strainData?.average_heart_rate || '--'}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'نبض النشاط' : 'Activity HR'}</div>
              </div>
              
              <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                <div className="text-lg font-bold text-orange-300">{strainData?.max_heart_rate || '--'}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'أقصى نبض' : 'Max HR'}</div>
              </div>
            </div>
          </div>

          {/* Training Load */}
          <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-orange-300">{language === 'ar' ? 'حمل التدريب' : 'Training Load'}</h5>
              <Activity className="h-5 w-5 text-orange-400" />
            </div>
            
            <div className="space-y-4">
              <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                <div className="text-lg font-bold text-orange-300">{metrics?.cycle?.training_load || '--'}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'حمل اليوم' : 'Today Load'}</div>
              </div>
              
              <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                <div className="text-lg font-bold text-orange-300">{strainData?.kilojoule ? Math.round(strainData.kilojoule / 4.184) : '--'}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'السعرات' : 'Calories'}</div>
              </div>
              
              <div className="text-center p-3 bg-orange-500/10 rounded-lg">
                <div className="text-lg font-bold text-orange-300">{(metrics?.cycle?.day_strain || 0).toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'إجهاد اليوم' : 'Day Strain'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Workout Analysis Section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-red-400 to-pink-400 flex items-center justify-center">
            <Dumbbell className="h-4 w-4 text-white" />
          </div>
          <h4 className="text-lg font-semibold text-red-400">
            {language === 'ar' ? 'تحليل التمرين المفصل' : 'Detailed Workout Analysis'}
          </h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Workout Overview */}
          <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-red-300">{language === 'ar' ? 'نوع النشاط' : 'Activity Type'}</h5>
              <Dumbbell className="h-5 w-5 text-red-400" />
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-red-300 mb-2">
                {metrics?.workout?.sport_name || '--'}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDate(metrics?.workout?.start)}
              </div>
            </div>
          </div>

          {/* Duration & Time */}
          <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-red-300">{language === 'ar' ? 'المدة والوقت' : 'Duration & Time'}</h5>
              <Clock className="h-5 w-5 text-red-400" />
            </div>
            
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-lg font-bold text-red-300">
                  {metrics?.workout?.start && metrics?.workout?.end ? 
                    formatDuration((new Date(metrics.workout.end).getTime() - new Date(metrics.workout.start).getTime()) / 1000) : 
                    '--'
                  }
                </div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'المدة' : 'Duration'}</div>
              </div>
              
              <div className="text-center">
                <div className="text-sm font-medium text-red-300">{formatTime(metrics?.workout?.start)}</div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'وقت البداية' : 'Start Time'}</div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-red-300">{language === 'ar' ? 'مقاييس الأداء' : 'Performance Metrics'}</h5>
              <TrendingUp className="h-5 w-5 text-red-400" />
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">{language === 'ar' ? 'الإجهاد' : 'Strain'}</span>
                <span className="font-medium text-red-300">{metrics?.workout?.strain || '--'}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">{language === 'ar' ? 'متوسط النبض' : 'Avg HR'}</span>
                <span className="font-medium text-red-300">{workoutData?.average_heart_rate || '--'} bpm</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">{language === 'ar' ? 'أقصى نبض' : 'Max HR'}</span>
                <span className="font-medium text-red-300">{workoutData?.max_heart_rate || '--'} bpm</span>
              </div>
            </div>
          </div>

          {/* Energy & Distance */}
          <div className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-semibold text-red-300">{language === 'ar' ? 'الطاقة والمسافة' : 'Energy & Distance'}</h5>
              <Zap className="h-5 w-5 text-red-400" />
            </div>
            
            <div className="space-y-3">
              <div className="text-center">
                <div className="text-lg font-bold text-red-300">
                  {formatCalories(workoutData?.kilojoule)}
                </div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'السعرات المحروقة' : 'Calories Burned'}</div>
              </div>
              
              <div className="text-center">
                <div className="text-sm font-medium text-red-300">
                  {workoutData?.distance_meter ? `${(workoutData.distance_meter / 1000).toFixed(2)} km` : '--'}
                </div>
                <div className="text-xs text-muted-foreground">{language === 'ar' ? 'المسافة' : 'Distance'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Legacy Sleep Details - Keeping for compatibility */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-400 to-indigo-400 flex items-center justify-center">
              <Moon className="h-3 w-3 text-white" />
            </div>
            <h4 className="font-semibold text-blue-400">
              {language === 'ar' ? 'ملخص النوم' : 'Sleep Summary'}
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
