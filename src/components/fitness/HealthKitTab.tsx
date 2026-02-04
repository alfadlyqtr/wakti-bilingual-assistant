/**
 * HealthKit Tab Component
 * Elegant card-based UI for Apple HealthKit data
 * Follows WAKTI design system with premium aesthetics
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { openInSafari } from '@/integrations/natively/browserBridge';
import { 
  Heart, 
  Footprints, 
  Flame, 
  Moon, 
  Activity, 
  Dumbbell,
  Shield,
  ShieldCheck,
  ShieldX,
  Smartphone,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Target,
  Zap,
  BarChart3,
  Settings
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import {
  isNativelyIOSApp,
  isHealthKitSDKAvailable,
  checkHealthKitAvailability,
  requestHealthKitPermissions,
  getTodayHealthSummary,
  getSleepAnalysis,
  getWorkouts,
  getCharacteristics,
  type HealthKitActivitySummary,
  type HealthKitSleepAnalysis,
  type HealthKitWorkout,
  type HealthKitCharacteristics
} from '@/integrations/natively/healthkitBridge';

type PermissionStatus = 'unknown' | 'checking' | 'unavailable' | 'needs_permission' | 'granted' | 'denied';
type MetricView = 'overview' | 'steps' | 'heart' | 'energy' | 'sleep';
type TimeRange = 'hourly' | 'daily' | 'weekly' | 'monthly';

const APP_STORE_URL = 'https://apps.apple.com/us/app/wakti-ai/id6755150700';

// Sample data generators for demo (will be replaced with real HealthKit data)
const generateHourlyData = () => Array.from({ length: 24 }, (_, i) => ({
  time: `${i.toString().padStart(2, '0')}:00`,
  value: Math.floor(Math.random() * 800) + 200,
  goal: 500
}));

const generateDailyData = () => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
  time: day,
  value: Math.floor(Math.random() * 4000) + 6000,
  goal: 10000
}));

const generateWeeklyData = () => Array.from({ length: 4 }, (_, i) => ({
  time: `Week ${i + 1}`,
  value: Math.floor(Math.random() * 20000) + 50000,
  goal: 70000
}));

const generateMonthlyData = () => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map(month => ({
  time: month,
  value: Math.floor(Math.random() * 100000) + 200000,
  goal: 300000
}));

interface HealthData {
  steps: number;
  heartRate: { avg: number; latest: number } | null;
  activeEnergy: number;
  activity: HealthKitActivitySummary | null;
  sleep: HealthKitSleepAnalysis[];
  workouts: HealthKitWorkout[];
  characteristics: HealthKitCharacteristics | null;
  restingHeartRate: number | null;
  hrv: number | null;
}

export function HealthKitTab() {
  const { language } = useTheme();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeView, setActiveView] = useState<MetricView>('overview');
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const [goals, setGoals] = useState(() => {
    try {
      const saved = localStorage.getItem('healthkit_goals');
      return saved ? JSON.parse(saved) : { steps: 10000, heart: 80, energy: 500, sleep: 8 };
    } catch { return { steps: 10000, heart: 80, energy: 500, sleep: 8 }; }
  });

  const isArabic = language === 'ar';

  const openAppStore = () => {
    try {
      const opened = openInSafari(APP_STORE_URL);
      if (!opened) window.open(APP_STORE_URL, '_blank', 'noopener,noreferrer');
    } catch {
      window.open(APP_STORE_URL, '_blank', 'noopener,noreferrer');
    }
  };

  // Save goals to localStorage
  const saveGoals = (newGoals: typeof goals) => {
    setGoals(newGoals);
    localStorage.setItem('healthkit_goals', JSON.stringify(newGoals));
    setShowGoalEditor(false);
  };

  // Get chart data based on time range
  const getChartData = useCallback(() => {
    switch (timeRange) {
      case 'hourly': return generateHourlyData();
      case 'daily': return generateDailyData();
      case 'weekly': return generateWeeklyData();
      case 'monthly': return generateMonthlyData();
      default: return generateDailyData();
    }
  }, [timeRange]);

  // Check availability on mount
  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    setPermissionStatus('checking');
    
    // First check if we're in Natively iOS app
    if (!isNativelyIOSApp()) {
      console.log('[HealthKitTab] Not running in Natively iOS app');
      setPermissionStatus('unavailable');
      return;
    }

    // Check if SDK is available
    if (!isHealthKitSDKAvailable()) {
      console.log('[HealthKitTab] HealthKit SDK not available');
      setPermissionStatus('unavailable');
      return;
    }

    // Check device availability (iPhone only)
    const available = await checkHealthKitAvailability();
    if (!available) {
      console.log('[HealthKitTab] HealthKit not available on this device');
      setPermissionStatus('unavailable');
      return;
    }

    // SDK available - try to fetch data directly
    // If we can get data, permission was already granted
    // This handles the case where user already granted permission in a previous session
    console.log('[HealthKitTab] SDK available, attempting to fetch data to check permission status...');
    
    try {
      const summary = await getTodayHealthSummary();
      console.log('[HealthKitTab] Health summary result:', {
        steps: summary.steps,
        hasHeartRate: !!summary.heartRate,
        activeEnergy: summary.activeEnergy,
        hasActivity: !!summary.activity,
      });
      
      // If we got any data, permission is granted
      // Note: Even with permission, some data might be 0 if user hasn't moved today
      // So we check if the call succeeded, not if values are > 0
      setPermissionStatus('granted');
      
      // Set the data we already fetched
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const [sleep, workouts, characteristics] = await Promise.all([
        getSleepAnalysis(weekAgo, now, 7),
        getWorkouts(weekAgo, now, 10),
        getCharacteristics()
      ]);
      
      setHealthData({
        steps: summary.steps,
        heartRate: summary.heartRate,
        activeEnergy: summary.activeEnergy,
        activity: summary.activity,
        sleep,
        workouts,
        characteristics,
        restingHeartRate: summary.restingHeartRate,
        hrv: summary.hrv
      });
      setLastUpdated(new Date());
      
    } catch (err) {
      console.log('[HealthKitTab] Could not fetch data, needs permission:', err);
      setPermissionStatus('needs_permission');
    }
  };

  const requestPermissions = async () => {
    setLoading(true);
    try {
      const granted = await requestHealthKitPermissions([
        'STEPS',
        'HEART_RATE',
        'ACTIVE_ENERGY',
        'SLEEP_ANALYSIS',
        'ACTIVITY_SUMMARY',
        'WORKOUTS',
        'HRV',
        'RHR'
      ]);

      if (granted) {
        setPermissionStatus('granted');
        await fetchHealthData();
      } else {
        setPermissionStatus('denied');
      }
    } catch (err) {
      console.error('[HealthKitTab] Permission error:', err);
      setPermissionStatus('denied');
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthData = useCallback(async () => {
    setRefreshing(true);
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [summary, sleep, workouts, characteristics] = await Promise.all([
        getTodayHealthSummary(),
        getSleepAnalysis(weekAgo, now, 7),
        getWorkouts(weekAgo, now, 10),
        getCharacteristics()
      ]);

      setHealthData({
        steps: summary.steps,
        heartRate: summary.heartRate,
        activeEnergy: summary.activeEnergy,
        activity: summary.activity,
        sleep,
        workouts,
        characteristics,
        restingHeartRate: summary.restingHeartRate,
        hrv: summary.hrv
      });
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[HealthKitTab] Fetch error:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Metric detail view component
  const renderMetricDetail = (metric: 'steps' | 'heart' | 'energy' | 'sleep') => {
    const configs = {
      steps: {
        title: isArabic ? 'الخطوات' : 'Steps',
        icon: Footprints,
        gradient: 'from-blue-500 to-cyan-500',
        color: '#06b6d4',
        bgGradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30',
        unit: isArabic ? 'خطوة' : 'steps'
      },
      heart: {
        title: isArabic ? 'نبض القلب' : 'Heart Rate',
        icon: Heart,
        gradient: 'from-rose-500 to-pink-500',
        color: '#ec4899',
        bgGradient: 'from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30',
        unit: 'BPM'
      },
      energy: {
        title: isArabic ? 'الطاقة النشطة' : 'Active Energy',
        icon: Flame,
        gradient: 'from-orange-500 to-amber-500',
        color: '#f59e0b',
        bgGradient: 'from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30',
        unit: 'kcal'
      },
      sleep: {
        title: isArabic ? 'النوم' : 'Sleep',
        icon: Moon,
        gradient: 'from-indigo-500 to-purple-500',
        color: '#8b5cf6',
        bgGradient: 'from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30',
        unit: isArabic ? 'ساعة' : 'hours'
      }
    };
    
    const config = configs[metric];
    const Icon = config.icon;
    const goal = goals[metric];

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView('overview')}
            className="rounded-full w-10 h-10 p-0 active:bg-slate-100 dark:active:bg-slate-800"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{config.title}</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isArabic ? 'البيانات متاحة في تطبيق iOS فقط' : 'Data available in iOS app only'}
              </p>
            </div>
          </div>
        </div>

        {/* Main Info Card */}
        <Card className={`relative overflow-hidden rounded-3xl border-0 bg-gradient-to-br ${config.bgGradient} p-6 shadow-xl`}>
          <div className="flex flex-col items-center text-center gap-4 py-8">
            <div className={`w-20 h-20 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
              <Icon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                {config.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {isArabic ? 'بيانات متاحة فقط في تطبيق iOS' : 'Data only available in iOS app'}
              </p>
            </div>
          </div>

          {/* iOS-only notice */}
          <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4 mt-4">
            <div className="flex items-center gap-3 justify-center">
              <Smartphone className="w-5 h-5 text-slate-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isArabic ? 'متاح حصريًا على تطبيق Wakti iOS' : 'Exclusively available on Wakti iOS app'}
              </span>
            </div>
          </div>
        </Card>

        {/* Feature description */}
        <Card className="rounded-2xl p-6 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 shadow-lg">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">
            {isArabic ? 'ما يمكنك تتبعه' : 'What you can track'}
          </h3>
          
          {metric === 'steps' && (
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {isArabic
                ? 'تتبع خطواتك اليومية ومراقبة نشاطك البدني على مدار اليوم والأسبوع. قم بتعيين أهداف شخصية وتتبع التقدم المحرز.'  
                : 'Track your daily steps and monitor your physical activity throughout the day and week. Set personal goals and track progress.'}
            </p>
          )}

          {metric === 'heart' && (
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {isArabic
                ? 'مراقبة معدل ضربات قلبك في الوقت الفعلي ومتوسطات الراحة والنشاط. تتبع الاتجاهات على مدار اليوم والأسبوع.'  
                : 'Monitor your heart rate in real-time and track resting and active averages. Track trends throughout the day and week.'}
            </p>
          )}

          {metric === 'energy' && (
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {isArabic
                ? 'تتبع السعرات الحرارية النشطة المحروقة خلال اليوم. راقب معدل النشاط والتقدم نحو أهدافك اليومية.'  
                : 'Track active calories burned throughout the day. Monitor your activity rate and progress toward daily goals.'}
            </p>
          )}

          {metric === 'sleep' && (
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              {isArabic
                ? 'تحليل أنماط نومك، بما في ذلك مراحل النوم العميق والخفيف. مراقبة مدة النوم والجودة لتحسين صحتك.'  
                : 'Analyze your sleep patterns, including deep and light sleep phases. Monitor duration and quality to improve your health.'}
            </p>
          )}
        </Card>

        {/* Download CTA */}
        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-5 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">
                  {isArabic ? 'احصل على تطبيق Wakti' : 'Get the Wakti App'}
                </h3>
                <p className="text-emerald-100/80 text-xs">
                  {isArabic ? 'لتفعيل HealthKit' : 'To enable HealthKit'}
                </p>
              </div>
            </div>
            <Button
              onClick={openAppStore}
              className="bg-white text-emerald-600 font-bold px-5 py-2.5 rounded-xl shadow-lg active:scale-95 active:bg-gray-50 transition-all"
            >
              <span className="mr-1.5"></span>
              App Store
            </Button>
          </div>
        </Card>
      </div>
    );
  };

  // Sample data generators have been removed

  // Render unavailable state (not on iPhone / not in Natively)
  if (permissionStatus === 'unavailable') {
    // If user clicked on a metric, show the detail view (demo mode)
    if (activeView !== 'overview') {
      return renderMetricDetail(activeView as 'steps' | 'heart' | 'energy' | 'sleep');
    }
    
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center py-4">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl mb-4">
            <Heart className="w-10 h-10 text-white" fill="currentColor" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Apple HealthKit
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto">
            {isArabic 
              ? 'تتبع صحتك مع بيانات Apple Health - الخطوات، نبض القلب، النوم والمزيد'
              : 'Track your health with Apple Health data - steps, heart rate, sleep & more'}
          </p>
        </div>

        {/* Feature Icons - What you can track */}
        <Card className="rounded-2xl p-6 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 text-center">
            {isArabic ? 'ما يمكنك تتبعه' : 'What you can track'}
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {[
              { key: 'steps' as const, icon: Footprints, label: isArabic ? 'الخطوات' : 'Steps', gradient: 'from-blue-500 to-cyan-500' },
              { key: 'heart' as const, icon: Heart, label: isArabic ? 'القلب' : 'Heart', gradient: 'from-rose-500 to-pink-500' },
              { key: 'energy' as const, icon: Flame, label: isArabic ? 'الطاقة' : 'Energy', gradient: 'from-orange-500 to-amber-500' },
              { key: 'sleep' as const, icon: Moon, label: isArabic ? 'النوم' : 'Sleep', gradient: 'from-indigo-500 to-purple-500' }
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveView(item.key)}
                className="flex flex-col items-center gap-2 cursor-pointer active:opacity-80 transition-opacity"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md active:scale-95 transition-transform`}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{item.label}</span>
              </button>
            ))}
          </div>
        </Card>

        {/* iOS Only Notice */}
        <div className="flex items-center justify-center gap-3 py-4">
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <span className="text-amber-700 dark:text-amber-300 font-semibold text-sm">
              {isArabic ? 'متاح على تطبيق iOS فقط' : 'Available on iOS App Only'}
            </span>
          </div>
        </div>

        {/* Download CTA */}
        <Card className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 p-5 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base">
                  {isArabic ? 'فعّل HealthKit' : 'Enable HealthKit'}
                </h3>
                <p className="text-emerald-100/80 text-xs">
                  {isArabic ? 'حمّل التطبيق على iOS' : 'Download on iOS'}
                </p>
              </div>
            </div>
            <Button
              onClick={openAppStore}
              className="bg-white text-emerald-600 font-bold px-5 py-2.5 rounded-xl shadow-lg active:scale-95 active:bg-gray-50 transition-all"
            >
              <span className="mr-1.5"></span>
              App Store
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Render checking state
  if (permissionStatus === 'checking') {
    return (
      <div className="space-y-6 p-2">
        <Card className="relative overflow-hidden rounded-3xl border border-blue-200 dark:border-blue-500/30 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-sm text-blue-600 dark:text-blue-400">
              {isArabic ? 'جار التحقق من التوفر...' : 'Checking availability...'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Render permission request state
  if (permissionStatus === 'needs_permission' || permissionStatus === 'denied') {
    return (
      <div className="space-y-6 p-2">
        <Card className="relative overflow-hidden rounded-3xl border-2 border-emerald-200 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-900/20 dark:via-teal-900/20 dark:to-cyan-900/20 p-6 md:p-8 shadow-xl">
          {/* Decorative gradient orbs */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-cyan-400/20 to-blue-400/20 rounded-full blur-3xl" />
          
          <div className="relative flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              {permissionStatus === 'denied' ? (
                <ShieldX className="w-12 h-12 text-white" />
              ) : (
                <Shield className="w-12 h-12 text-white" />
              )}
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
              {isArabic ? 'اتصل بـ Apple Health' : 'Connect Apple Health'}
            </h3>

            {/* Description */}
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md leading-relaxed">
              {permissionStatus === 'denied' 
                ? (isArabic 
                    ? 'تم رفض الإذن. يرجى تمكين الوصول إلى HealthKit في إعدادات جهازك.'
                    : 'Permission was denied. Please enable HealthKit access in your device settings.')
                : (isArabic 
                    ? 'اسمح لـ Wakti بقراءة بيانات صحتك لعرض الخطوات ومعدل ضربات القلب والنوم والتمارين في لوحة الحيوية الخاصة بك.'
                    : 'Allow Wakti to read your health data to display steps, heart rate, sleep, and workouts in your Vitality dashboard.')
              }
            </p>

            {/* Data types we'll access */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
              {[
                { icon: Footprints, label: isArabic ? 'الخطوات' : 'Steps', color: 'text-blue-500' },
                { icon: Heart, label: isArabic ? 'القلب' : 'Heart', color: 'text-red-500' },
                { icon: Moon, label: isArabic ? 'النوم' : 'Sleep', color: 'text-indigo-500' },
                { icon: Dumbbell, label: isArabic ? 'التمارين' : 'Workouts', color: 'text-orange-500' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white/60 dark:bg-white/5 border border-white/50 dark:border-white/10">
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Connect Button */}
            <Button
              onClick={requestPermissions}
              disabled={loading}
              className="w-full max-w-xs h-14 rounded-full text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-300 active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <ShieldCheck className="w-5 h-5 mr-2" />
              )}
              {loading 
                ? (isArabic ? 'جار الاتصال...' : 'Connecting...') 
                : (isArabic ? 'السماح بالوصول' : 'Allow Access')}
            </Button>

            {/* Privacy note */}
            <p className="text-xs text-gray-500 dark:text-gray-500 max-w-sm">
              {isArabic 
                ? 'بياناتك خاصة ولا تُباع أبدًا. نقرأ فقط لعرض رؤيتك.'
                : 'Your data is private and never sold. We only read to display your insights.'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Render connected state with health data
  return (
    <div className="space-y-4 p-2">
      {/* Header with refresh */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {isArabic ? 'متصل بـ Apple Health' : 'Connected to Apple Health'}
            </p>
            {lastUpdated && (
              <p className="text-xs text-gray-500">
                {isArabic ? 'آخر تحديث: ' : 'Last updated: '}
                {lastUpdated.toLocaleTimeString(isArabic ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchHealthData}
          disabled={refreshing}
          className="rounded-full"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Activity Summary Card */}
      <Card className="relative overflow-hidden rounded-3xl border border-blue-200 dark:border-blue-500/20 bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 dark:from-blue-900/20 dark:via-cyan-900/20 dark:to-teal-900/20 p-5 shadow-lg">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-2xl" />
        
        <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" />
          {isArabic ? 'نشاط اليوم' : "Today's Activity"}
        </h4>

        <div className="grid grid-cols-3 gap-4">
          {/* Steps */}
          <div className="flex flex-col items-center p-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-sm">
            <Footprints className="w-6 h-6 text-blue-500 mb-2" />
            <span className="text-2xl font-bold text-gray-800 dark:text-white">
              {healthData?.steps !== undefined && healthData?.steps !== null ? healthData.steps.toLocaleString() : '—'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isArabic ? 'خطوة' : 'steps'}
            </span>
          </div>

          {/* Heart Rate */}
          <div className="flex flex-col items-center p-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-sm">
            <Heart className="w-6 h-6 text-red-500 mb-2" />
            <span className="text-2xl font-bold text-gray-800 dark:text-white">
              {healthData?.heartRate?.latest !== undefined && healthData?.heartRate?.latest !== null ? healthData.heartRate.latest : '—'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isArabic ? 'نبضة/د' : 'bpm'}
            </span>
          </div>

          {/* Active Energy */}
          <div className="flex flex-col items-center p-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-sm">
            <Flame className="w-6 h-6 text-orange-500 mb-2" />
            <span className="text-2xl font-bold text-gray-800 dark:text-white">
              {healthData?.activeEnergy !== undefined && healthData?.activeEnergy !== null ? healthData.activeEnergy.toLocaleString() : '—'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isArabic ? 'سعرة' : 'kcal'}
            </span>
          </div>
        </div>

        {/* Additional Heart Metrics Row */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Resting Heart Rate */}
          <div className="flex flex-col items-center p-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-sm">
            <Heart className="w-5 h-5 text-pink-500 mb-2" />
            <span className="text-xl font-bold text-gray-800 dark:text-white">
              {healthData?.restingHeartRate !== undefined && healthData?.restingHeartRate !== null ? healthData.restingHeartRate : '—'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isArabic ? 'نبض الراحة' : 'Resting HR'}
            </span>
          </div>

          {/* HRV */}
          <div className="flex flex-col items-center p-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10 shadow-sm">
            <Activity className="w-5 h-5 text-purple-500 mb-2" />
            <span className="text-xl font-bold text-gray-800 dark:text-white">
              {healthData?.hrv !== undefined && healthData?.hrv !== null ? `${healthData.hrv}ms` : '—'}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {isArabic ? 'تقلب النبض' : 'HRV'}
            </span>
          </div>
        </div>
      </Card>

      {/* Activity Rings Card */}
      {healthData?.activity && (
        <Card className="relative overflow-hidden rounded-3xl border border-emerald-200 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 p-5 shadow-lg">
          <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            {isArabic ? 'حلقات النشاط' : 'Activity Rings'}
          </h4>

          <div className="grid grid-cols-3 gap-4">
            {/* Move */}
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16 mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-red-200 dark:text-red-900/30" />
                  <circle 
                    cx="32" cy="32" r="28" 
                    stroke="currentColor" strokeWidth="6" fill="none" 
                    className="text-red-500"
                    strokeDasharray={`${Math.min(100, ((healthData.activity.activeBurned || 0) / (healthData.activity.activeGoal || 500)) * 100) * 1.76} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <Flame className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{isArabic ? 'تحرك' : 'Move'}</span>
              <span className="text-xs text-gray-500">{healthData.activity.activeBurned || 0}/{healthData.activity.activeGoal || 500}</span>
            </div>

            {/* Exercise */}
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16 mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-green-200 dark:text-green-900/30" />
                  <circle 
                    cx="32" cy="32" r="28" 
                    stroke="currentColor" strokeWidth="6" fill="none" 
                    className="text-green-500"
                    strokeDasharray={`${Math.min(100, ((healthData.activity.exerciseTime || 0) / (healthData.activity.exerciseGoal || 30)) * 100) * 1.76} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <Dumbbell className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{isArabic ? 'تمرين' : 'Exercise'}</span>
              <span className="text-xs text-gray-500">{healthData.activity.exerciseTime || 0}/{healthData.activity.exerciseGoal || 30}m</span>
            </div>

            {/* Stand */}
            <div className="flex flex-col items-center">
              <div className="relative w-16 h-16 mb-2">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-cyan-200 dark:text-cyan-900/30" />
                  <circle 
                    cx="32" cy="32" r="28" 
                    stroke="currentColor" strokeWidth="6" fill="none" 
                    className="text-cyan-500"
                    strokeDasharray={`${Math.min(100, ((healthData.activity.standHours || 0) / (healthData.activity.standGoal || 12)) * 100) * 1.76} 176`}
                    strokeLinecap="round"
                  />
                </svg>
                <Activity className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-cyan-500" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{isArabic ? 'وقوف' : 'Stand'}</span>
              <span className="text-xs text-gray-500">{healthData.activity.standHours || 0}/{healthData.activity.standGoal || 12}h</span>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Workouts Card */}
      {healthData?.workouts && healthData.workouts.length > 0 && (
        <Card className="relative overflow-hidden rounded-3xl border border-orange-200 dark:border-orange-500/20 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 p-5 shadow-lg">
          <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-orange-500" />
            {isArabic ? 'التمارين الأخيرة' : 'Recent Workouts'}
          </h4>

          <div className="space-y-3">
            {healthData.workouts.slice(0, 3).map((workout, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
                    <Dumbbell className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{workout.workoutName || 'Workout'}</p>
                    <p className="text-xs text-gray-500">
                      {Math.round(workout.duration / 60)} {isArabic ? 'دقيقة' : 'min'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                    {workout.totalBurned || 0} {isArabic ? 'سعرة' : 'kcal'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Sleep Card */}
      {healthData?.sleep && healthData.sleep.length > 0 && (
        <Card className="relative overflow-hidden rounded-3xl border border-indigo-200 dark:border-indigo-500/20 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-5 shadow-lg">
          <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-4 flex items-center gap-2">
            <Moon className="w-4 h-4 text-indigo-500" />
            {isArabic ? 'النوم الأخير' : 'Recent Sleep'}
          </h4>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                <Moon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">
                  {healthData.sleep[0]?.asleep 
                    ? `${Math.round(healthData.sleep[0].asleep / 60 * 10) / 10}h`
                    : '—'}
                </p>
                <span className="inline-flex items-center gap-1 text-xs font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-3 py-1 rounded-full shadow-md shadow-blue-500/20 dark:shadow-blue-400/20">
                  <Settings className="w-3 h-3" />
                  {isArabic ? 'تعيين' : 'Set'}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* No data state */}
      {!healthData && !refreshing && (
        <Card className="rounded-3xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-gray-400" />
            <p className="text-sm text-gray-500">
              {isArabic ? 'لا توجد بيانات صحية متاحة بعد.' : 'No health data available yet.'}
            </p>
            <Button onClick={fetchHealthData} variant="outline" className="rounded-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              {isArabic ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
