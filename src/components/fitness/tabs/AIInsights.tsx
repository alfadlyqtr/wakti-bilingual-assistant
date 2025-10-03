import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Brain, TrendingUp, TrendingDown, Sun, Clock, Moon, CheckCircle, Volume2, Pause, RotateCcw } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";
import { generateAiInsights, buildInsightsAggregate } from "@/services/whoopService";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import 'react-circular-progressbar/dist/styles.css';

type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';

interface AIInsightsProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  metrics?: any; // Same metrics data that WhoopDetails uses
  aiData?: any;  // Aggregate built by the page from the exact data shown
}

type TimeWindow = 'morning' | 'midday' | 'evening';

interface InsightData {
  daily_summary: string;
  weekly_summary: string;
  tips: string[];
  motivations: string[];
  visuals: Array<{
    title: string;
    type: 'donut' | 'line' | 'gauge';
    data_keys: string[];
    colors?: string[];
    center_text?: string;
    gradient?: boolean;
    color?: string;
    zones?: Array<{ min: number; max: number; color: string }>;
  }>;
}

const TIME_WINDOWS = {
  // Equal 8-hour splits starting at 4:00 AM local time
  morning: { start: '4:00 AM', end: '12:00 PM', label: 'Morning Summary', icon: Sun },
  midday: { start: '12:00 PM', end: '8:00 PM', label: 'Midday Summary', icon: Clock },
  evening: { start: '8:00 PM', end: '4:00 AM', label: 'Evening Summary', icon: Moon },
};

export function AIInsights({ timeRange, onTimeRangeChange, metrics, aiData }: AIInsightsProps) {
  const { language } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState<TimeWindow | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Check if current time is within a time window
  // Load persisted insights from localStorage
  const loadPersistedInsights = () => {
    try {
      const saved = localStorage.getItem('wakti-ai-insights');
      return saved ? JSON.parse(saved) : { morning: null, midday: null, evening: null };
    } catch {
      return { morning: null, midday: null, evening: null };
    }
  };

  const loadPersistedTimes = () => {
    try {
      const saved = localStorage.getItem('wakti-ai-insights-times');
      return saved ? JSON.parse(saved) : { morning: 0, midday: 0, evening: 0 };
    } catch {
      return { morning: 0, midday: 0, evening: 0 };
    }
  };

  // Check if current time is within a time window (equal 8-hour buckets starting 4 AM)
  const getCurrentTimeWindow = (): TimeWindow | null => {
    const currentHour = new Date().getHours();
    if (currentHour >= 4 && currentHour < 12) return 'morning';
    if (currentHour >= 12 && currentHour < 20) return 'midday';
    // 8 PM - 4 AM wraps past midnight
    return 'evening';
  };

  const isWindowActive = (window: TimeWindow): boolean => {
    return getCurrentTimeWindow() === window;
  };

  const getNextWindowTime = (window: TimeWindow): string => {
    return TIME_WINDOWS[window].start;
  };

  const getNextWindowStartTime = (): number => {
    const now = new Date();
    const currentHour = now.getHours();
    const next = new Date(now);
    if (currentHour < 4) {
      next.setHours(4, 0, 0, 0); // next is morning 4 AM
    } else if (currentHour < 12) {
      next.setHours(12, 0, 0, 0); // next is midday 12 PM
    } else if (currentHour < 20) {
      next.setHours(20, 0, 0, 0); // next is evening 8 PM
    } else {
      // after 8 PM → next is tomorrow 4 AM
      next.setDate(next.getDate() + 1);
      next.setHours(4, 0, 0, 0);
    }
    return next.getTime() - now.getTime();
  };

  // State variables
  const [insights, setInsights] = useState<Record<TimeWindow, any>>(loadPersistedInsights());
  const [activeWindow, setActiveWindow] = useState<TimeWindow | null>(() => {
    // Auto-set active window if we have insights for current time
    const currentWindow = getCurrentTimeWindow();
    const persistedInsights = loadPersistedInsights();
    if (currentWindow && persistedInsights[currentWindow]) {
      return currentWindow;
    }
    return null;
  });
  const [lastGenerated, setLastGenerated] = useState<Record<TimeWindow, number>>(loadPersistedTimes());
  
  // Audio playback state with caching
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [audioCache, setAudioCache] = useState<Map<string, string>>(new Map());
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
      }
    };
  }, [currentAudio]);

  // Persist insights to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('wakti-ai-insights', JSON.stringify(insights));
  }, [insights]);

  useEffect(() => {
    localStorage.setItem('wakti-ai-insights-times', JSON.stringify(lastGenerated));
  }, [lastGenerated]);

  // SIMPLE: Auto-generate insights on load
  useEffect(() => {
    if (!activeWindow && !loading) {
      console.log('Auto-generating morning insights...');
      generateInsights('morning');
    }
  }, []);

  const generateInsights = async (window: TimeWindow, forceGenerate = false) => {
    console.log('Generating insights for window:', window);
    
    // Check time restrictions unless forced
    if (!forceGenerate) {
      const currentWindow = getCurrentTimeWindow();
      const currentHour = new Date().getHours();
      
      console.log('Current hour:', currentHour, 'Current window:', currentWindow, 'Requested window:', window);
      
      if (!currentWindow) {
        toast.error(language === 'ar' 
          ? 'المدرب الذكي غير متاح حاليًا (11 مساءً - 5 صباحًا)' 
          : 'AI Coach not available now (11 PM - 5 AM)'
        );
        return;
      }
      
      if (window !== currentWindow) {
        // Show warning but allow generation with confirmation
        const windowName = window === 'morning' ? (language === 'ar' ? 'الصباح' : 'Morning') :
                          window === 'midday' ? (language === 'ar' ? 'منتصف النهار' : 'Midday') :
                          (language === 'ar' ? 'المساء' : 'Evening');
        
        const currentName = currentWindow === 'morning' ? (language === 'ar' ? 'الصباح' : 'Morning') :
                           currentWindow === 'midday' ? (language === 'ar' ? 'منتصف النهار' : 'Midday') :
                           (language === 'ar' ? 'المساء' : 'Evening');
        
        toast.error(language === 'ar' 
          ? `الوقت الحالي هو ${currentName}. ${windowName} متاح لاحقًا.` 
          : `Current time is ${currentName}. ${windowName} available later.`
        );
        return;
      }
    }
    
    // Prevent double-clicks and check cache (2x per window per day)
    if (loading === window) return;
    
    const now = Date.now();
    // Remove generation limits for testing
    
    // COMPLETELY REMOVE ALL CACHING - ALWAYS GENERATE FRESH
    // Clear any existing cache for this window
    setInsights(prev => ({ ...prev, [window]: null }));
    setLastGenerated(prev => ({ ...prev, [window]: 0 }));
    
    try {
      setLoading(window);
      console.log('Starting AI insights generation for window:', window);
      
      // Show loading immediately, then fetch data asynchronously
      setTimeout(async () => {
        try {
          // Get user's real name
          const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Champion";
          
          // Use the SAME metrics data that WhoopDetails uses - this is the real WHOOP data!
          console.log('Using direct metrics data:', metrics);
          console.log('Sleep performance:', metrics?.sleep?.performance_pct);
          console.log('Recovery score:', metrics?.recovery?.score);
          console.log('HRV ms:', metrics?.recovery?.hrv_ms);
          console.log('Day strain:', metrics?.cycle?.day_strain);
          
          // Check if we have any WHOOP data
          if (!metrics || (!metrics.sleep && !metrics.recovery && !metrics.cycle)) {
            console.warn('No WHOOP metrics available, using mock data');
            throw new Error('No WHOOP data available');
          }
          
          // Extract sleep hours from duration_sec or stage_summary
          const sleepHours = (() => {
            if (metrics?.sleep?.duration_sec) {
              return Math.round((metrics.sleep.duration_sec / 3600) * 10) / 10;
            }
            const stages = metrics?.sleep?.data?.score?.stage_summary;
            if (stages) {
              const totalMs = (stages.deep_sleep_milli || 0) + (stages.rem_sleep_milli || 0) + (stages.light_sleep_milli || 0);
              return totalMs ? Math.round((totalMs / 3600000) * 10) / 10 : null;
            }
            return null;
          })();
          
          // Create enhanced data using the REAL metrics (same as WhoopDetails)
          const enhancedData = {
            user_name: userName,
            current_time: new Date().toISOString(),
            time_window: window,
            // Use the EXACT same data structure that WhoopDetails displays
            key_metrics: {
              sleep_hours: sleepHours,
              sleep_performance: metrics?.sleep?.performance_pct,
              recovery_score: metrics?.recovery?.score,
              hrv_ms: metrics?.recovery?.hrv_ms,
              resting_hr: metrics?.recovery?.rhr_bpm,
              day_strain: metrics?.cycle?.day_strain,
              avg_heart_rate: metrics?.cycle?.avg_hr_bpm,
              workout_sport: metrics?.workout?.sport_name,
              workout_strain: metrics?.workout?.strain,
              workout_duration: metrics?.workout?.end && metrics?.workout?.start 
                ? Math.round((new Date(metrics.workout.end).getTime() - new Date(metrics.workout.start).getTime()) / 60000)
                : null
            },
            // Include raw metrics for AI to analyze
            raw_metrics: metrics,
            // Add rich context for AI
            insights_context: {
              time_of_day: window,
              user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              current_hour: new Date().getHours(),
              is_weekend: [0, 6].includes(new Date().getDay())
            }
          };
          
          console.log('Enhanced data for AI:', enhancedData);
          console.log('=== DEBUG AI DATA PAYLOAD ===');
          console.log('User:', user);
          console.log('Metrics:', metrics);
          console.log('Time Window:', window);
          console.log('Language:', language);
          
          const response = await generateAiInsights(language as 'en' | 'ar', {
            time_of_day: window,
            user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            data: aiData || undefined
          });
          
          console.log('=== AI RESPONSE ===');
          console.log('Response:', response);
          
          console.log('AI insights response:', response);
          
          setInsights(prev => ({
            ...prev,
            [window]: response
          }));
          
          setLastGenerated(prev => ({
            ...prev,
            [window]: now
          }));
          
          // Generation count tracking removed for testing
          
          setActiveWindow(window);
          toast.success(language === 'ar' ? 'تم إنشاء الرؤى' : 'Insights generated');
          
        } catch (error) {
          console.error('AI insights error:', error);
          
          // If WHOOP data is unavailable, use mock data for demo
          console.log('Using mock data for AI insights...');
          
          const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "Champion";
          
          const mockData = {
            user_name: userName,
            current_time: new Date().toISOString(),
            time_window: window,
            sleep_hours: 6.2,
            performance_score: 73,
            hrv_score: 45,
            strain_score: 8.7,
            sleep_performance: 78,
            resting_hr: 62,
            latest_workout: { sport: "Running", duration: 35, strain: 12.3 },
            today: {
              sleepHours: 6.2,
              recoveryPct: 73,
              hrvMs: 45,
              dayStrain: 8.7,
              sleepPerformancePct: 78,
              rhrBpm: 62
            }
          };
          
          try {
            const response = await generateAiInsights(language as 'en' | 'ar', {
              time_of_day: window,
              user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              data: mockData
            });
            
            setInsights(prev => ({
              ...prev,
              [window]: response
            }));
            
            setLastGenerated(prev => ({
              ...prev,
              [window]: Date.now()
            }));
            
            setActiveWindow(window);
            toast.success(language === 'ar' ? 'تم إنشاء الرؤى (بيانات تجريبية)' : 'Insights generated (demo data)');
            
          } catch (apiError) {
            console.error('API call failed even with mock data:', apiError);
            toast.error(language === 'ar' ? 'فشل في الاتصال بالخدمة' : 'Service connection failed');
          }
        } finally {
          setLoading(null);
        }
      }, 100); // Allow UI to update first
      
    } catch (error) {
      console.error('Critical error:', error);
      toast.error(language === 'ar' ? 'فشل في إنشاء الرؤى' : 'Failed to generate insights');
      setLoading(null);
    }
  };

  const currentInsight = insights[activeWindow];
  const hasAnyInsight = Object.values(insights).some(insight => insight !== null);
  const displayInsight = currentInsight || Object.values(insights).find(i => i !== null);
  
  // Debug logging
  console.log('Current active window:', activeWindow);
  console.log('All insights:', insights);
  console.log('Current insight:', currentInsight);
  console.log('Has any insight:', hasAnyInsight);
  console.log('Display insight:', displayInsight);

  const copyToClipboard = async () => {
    if (!displayInsight) return;
    const text = `${displayInsight.daily_summary || ''}\n\n${displayInsight.weekly_summary || ''}\n\nTips:\n${(displayInsight.tips || []).map((t: string) => `• ${t}`).join('\n')}\n\nMotivations:\n${(displayInsight.motivations || []).map((m: string) => `• ${m}`).join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(language === 'ar' ? 'تم النسخ' : 'Copied to clipboard');
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في النسخ' : 'Failed to copy');
    }
  };

  const speakText = async () => {
    // If already playing, pause it
    if (isPlaying && currentAudio) {
      currentAudio.pause();
      setIsPlaying(false);
      return;
    }
    
    // If paused, resume
    if (currentAudio && currentAudio.paused) {
      currentAudio.play();
      setIsPlaying(true);
      return;
    }
    
    if (!displayInsight) return;
    
    const text = `${displayInsight.daily_summary || ''}\n\n${displayInsight.weekly_summary || ''}\n\nTips:\n${(displayInsight.tips || []).map((t: string) => `${t}`).join('\n')}\n\nMotivations:\n${(displayInsight.motivations || []).map((m: string) => `${m}`).join('\n')}`;
    
    // Create cache key from text and language
    const cacheKey = `${language}-${text.substring(0, 100)}`;
    
    try {
      // Check if audio is cached
      if (audioCache.has(cacheKey)) {
        console.log('Using cached TTS audio');
        const cachedUrl = audioCache.get(cacheKey)!;
        const audio = new Audio(cachedUrl);
        
        // Set up event listeners
        audio.addEventListener('play', () => setIsPlaying(true));
        audio.addEventListener('pause', () => setIsPlaying(false));
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentAudio(null);
        });
        
        setCurrentAudio(audio);
        audio.play();
        toast.success(language === 'ar' ? 'جاري التشغيل' : 'Playing audio');
        return;
      }
      
      toast.info(language === 'ar' ? 'جاري التحويل إلى صوت...' : 'Converting to speech...');
      
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Select appropriate voice based on language
      const voiceId = language === 'ar' 
        ? 'ar-XA-Wavenet-C'  // Arabic female voice
        : 'en-US-Neural2-F'; // English female voice
      
      const response = await fetch(`${supabaseUrl}/functions/v1/voice-tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          text,
          voice_id: voiceId
        })
      });
      
      if (!response.ok) {
        throw new Error('TTS request failed');
      }
      
      // The response contains audio data
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Cache the audio URL
      setAudioCache(prev => new Map(prev).set(cacheKey, audioUrl));
      console.log('Cached TTS audio for key:', cacheKey);
      
      const audio = new Audio(audioUrl);
      
      // Set up event listeners
      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentAudio(null);
      });
      
      setCurrentAudio(audio);
      audio.play();
      
      toast.success(language === 'ar' ? 'جاري التشغيل' : 'Playing audio');
    } catch (error) {
      console.error('TTS error:', error);
      toast.error(language === 'ar' ? 'فشل تحويل النص إلى صوت' : 'Failed to convert text to speech');
    }
  };
  
  const rewindAudio = () => {
    if (currentAudio) {
      currentAudio.currentTime = Math.max(0, currentAudio.currentTime - 10);
      toast.info(language === 'ar' ? 'تراجع 10 ثواني' : 'Rewound 10 seconds');
    }
  };

  // PDF feature removed to prevent app freezing

  return (
    <div className="space-y-6">
      {/* Time Range Tabs */}
      <div className="flex gap-3 mb-6 flex-wrap justify-center sm:justify-start mt-16">
        {(['1d', '1w', '2w', '1m', '3m', '6m'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => onTimeRangeChange(range)}
            className={`px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold shadow-lg transition-all min-w-[50px] flex-shrink-0 active:scale-95 ${
              timeRange === range
                ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-indigo-500/50 border-2 border-indigo-400'
                : 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 hover:from-gray-200 hover:to-gray-300 dark:hover:from-white/20 dark:hover:to-white/10 text-gray-800 dark:text-gray-300 border-2 border-gray-300 dark:border-white/20 shadow-gray-400/30 dark:shadow-none'
            }`}
          >
            {range.toUpperCase()}
          </button>
        ))}
        
        {/* Clear Cache Button */}
        <button
          onClick={() => {
            // Clear ALL cache
            setInsights({} as Record<TimeWindow, any>);
            setLastGenerated({} as Record<TimeWindow, number>);
            localStorage.removeItem('wakti-ai-insights');
            localStorage.removeItem('wakti-ai-insights-times');
            toast.success(language === 'ar' ? 'تم مسح الذاكرة المؤقتة' : 'Cache cleared');
          }}
          className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-br from-red-100 to-red-200 dark:from-red-500/20 dark:to-red-500/10 hover:from-red-200 hover:to-red-300 dark:hover:from-red-500/30 dark:hover:to-red-500/20 text-red-700 dark:text-red-400 border-2 border-red-300 dark:border-red-500/30 shadow-lg shadow-red-400/30 dark:shadow-none transition-all flex-shrink-0 active:scale-95"
        >
          {language === 'ar' ? 'مسح الذاكرة' : 'Clear Cache'}
        </button>
      </div>

      {/* AI Insights Header */}
      <Card className="rounded-2xl p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 border-purple-300 dark:border-purple-500/20 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="h-8 w-8 text-purple-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent break-words">
              {language === 'ar' ? 'رؤى WAKTI AI' : 'WAKTI AI Insights'}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground break-words">
              {language === 'ar' ? 'مدربك الشخصي الذكي' : 'Your intelligent personal coach'}
            </p>
          </div>
        </div>

        {/* AI Coach Availability */}
        <div className="bg-gray-100 dark:bg-black/20 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-700 dark:text-gray-300 mb-2 font-medium">{language === 'ar' ? 'المدرب الذكي متاح خلال:' : 'AI Coach available during:'}</p>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">🌅 {language === 'ar' ? 'الصباح: 4:00 ص - 12:00 م' : 'Morning: 4:00 AM - 12:00 PM'}</span>
            <span className="flex items-center gap-1 text-orange-700 dark:text-orange-400">☀️ {language === 'ar' ? 'منتصف النهار: 12:00 م - 8:00 م' : 'Midday: 12:00 PM - 8:00 PM'}</span>
            <span className="flex items-center gap-1 text-purple-700 dark:text-purple-400">🌙 {language === 'ar' ? 'المساء: 8:00 م - 4:00 ص' : 'Evening: 8:00 PM - 4:00 AM'}</span>
          </div>
        </div>

        {/* Time Window Generation Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {(Object.entries(TIME_WINDOWS) as [TimeWindow, typeof TIME_WINDOWS[TimeWindow]][]).map(([window, config]) => {
            const Icon = config.icon;
            const isActive = isWindowActive(window);
            const hasInsight = !!insights[window];
            const isGenerating = loading === window;

            return (
              <Button
                key={window}
                onClick={() => generateInsights(window)}
                onDoubleClick={() => {
                  console.log('Force generating for window:', window);
                  // Clear cache and force regenerate
                  setInsights(prev => ({ ...prev, [window]: null }));
                  setLastGenerated(prev => ({ ...prev, [window]: 0 }));
                  generateInsights(window, true);
                  toast.info(language === 'ar' ? 'إنشاء جديد للرؤى...' : 'Generating fresh insights...');
                }}
                disabled={isGenerating}
                className={`h-20 flex-col gap-2 relative ${
                  isActive 
                    ? 'bg-white border-emerald-300 shadow-md hover:shadow-lg hover:border-emerald-400'
                    : 'bg-gray-100 hover:bg-gray-200 border-gray-300'
                } text-gray-900`}
                variant="outline"
                title={language === 'ar' ? 'انقر مرتين للإنشاء القسري' : 'Double-click to force generate'}
              >
                <Icon className={`h-6 w-6 ${isActive ? 'text-emerald-600' : 'text-gray-500'}`} />
                <div className="text-center min-w-0 flex-1">
                  <div className={`font-semibold text-xs sm:text-sm ${isActive ? 'text-gray-900' : 'text-gray-700'} break-words`}>
                    {config.label}
                  </div>
                  <div className={`text-xs ${isActive ? 'text-emerald-700' : 'text-gray-500'}`}>
                    {config.start} - {config.end}
                  </div>
                </div>
                
                {hasInsight && (
                  <CheckCircle className="absolute top-2 right-2 h-4 w-4 text-emerald-400" />
                )}
                
                {isGenerating && (
                  <RefreshCw className="absolute top-2 right-2 h-4 w-4 text-blue-400 animate-spin" />
                )}
                
                {/* Removed overlay for testing - buttons always clickable */}
              </Button>
            );
          })}
        </div>

        {/* Active Window Selector */}
        <div className="mt-6 flex gap-2 sm:gap-3 flex-wrap">
          {(Object.keys(TIME_WINDOWS) as TimeWindow[]).map((window) => (
            <button
              key={window}
              onClick={() => setActiveWindow(window)}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm transition-all min-w-0 flex-shrink-0 ${
                activeWindow === window
                  ? 'bg-white text-gray-900 border border-purple-300 shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
            >
              <span className="break-words">{TIME_WINDOWS[window].label}</span>
              {insights[window] && <span className="ml-2 text-emerald-600">✓</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* Insights Content */}
      {hasAnyInsight && (
        <div key={`insights-${activeWindow}-${hasAnyInsight}`} ref={printRef} className="space-y-6">
          {/* Daily Summary */}
          <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-white/5 dark:to-white/5 border-emerald-200 dark:border-white/10 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                {language === 'ar' ? 'الملخص اليومي' : 'Daily Summary'}
              </h3>
              <div className="flex gap-2">
                {isPlaying && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={rewindAudio}
                    className="h-8 w-8 p-0"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={speakText}
                  className={`h-8 px-2 text-xs ${isPlaying ? "bg-emerald-500/20 border-emerald-500 animate-pulse" : ""}`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-3 w-3 mr-1 text-emerald-400" />
                      <span className="hidden sm:inline">{language === 'ar' ? 'إيقاف' : 'Pause'}</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">{language === 'ar' ? 'استماع' : 'Speak'}</span>
                    </>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'نسخ' : 'Copy'}
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {displayInsight?.daily_summary || (language === 'ar' ? 'لا توجد بيانات كافية للملخص اليومي' : 'Insufficient data for daily summary')}
            </p>
          </Card>

          {/* Weekly Summary */}
          <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-white/5 dark:to-white/5 border-emerald-200 dark:border-white/10 shadow-lg">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <TrendingDown className="h-5 w-5 text-blue-400" />
              {language === 'ar' ? 'الملخص الأسبوعي' : 'Weekly Summary'}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {displayInsight?.weekly_summary || (language === 'ar' ? 'لا توجد بيانات كافية للملخص الأسبوعي' : 'Insufficient data for weekly summary')}
            </p>
          </Card>

          {/* Tips & Motivations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tips */}
            <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20">
              <h3 className="font-semibold text-lg mb-4 text-emerald-700 dark:text-emerald-400">
                {language === 'ar' ? 'نصائح' : 'Tips'}
              </h3>
              <ul className="space-y-3">
                {(displayInsight?.tips || []).map((tip: string, index: number) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300 font-medium">{tip}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Motivations */}
            <Card className="rounded-2xl p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
              <h3 className="font-semibold text-lg mb-4 text-orange-600 dark:text-orange-400">
                {language === 'ar' ? 'تحفيز' : 'Motivations'}
              </h3>
              <div className="space-y-3">
                {(displayInsight?.motivations || []).map((motivation: string, index: number) => (
                  <div key={index} className="p-3 bg-orange-100 dark:bg-orange-500/10 rounded-lg border border-orange-300 dark:border-orange-500/20">
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">{motivation}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* AI Generated Visuals - DISABLED until AI generates proper data */}
          {false && (displayInsight?.visuals && displayInsight.visuals.length > 0) && (
            <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-white/5 dark:to-white/5 border-emerald-200 dark:border-white/10 shadow-lg">
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" />
                {language === 'ar' ? 'الرسوم البيانية الذكية' : 'Smart Visuals'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(displayInsight?.visuals || []).map((visual, index) => (
                  <Card key={index} className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
                    <h4 className="font-medium mb-4 text-center">{visual.title}</h4>
                    <div className="h-32 flex items-center justify-center">
                      {visual.type === 'donut' && (
                        <div className="w-24 h-24">
                          <CircularProgressbar
                            value={75} // This would be calculated from visual.data_keys
                            text={visual.center_text || "75%"}
                            styles={buildStyles({
                              pathColor: visual.colors?.[0] || '#10B981',
                              textColor: '#fff',
                              trailColor: 'rgba(255,255,255,0.1)',
                            })}
                          />
                        </div>
                      )}
                      {visual.type === 'gauge' && (
                        <div className="w-24 h-24">
                          <CircularProgressbar
                            value={60} // This would be calculated from visual.data_keys
                            text="60%"
                            styles={buildStyles({
                              pathColor: visual.color || '#8B5CF6',
                              textColor: '#fff',
                              trailColor: 'rgba(255,255,255,0.1)',
                            })}
                          />
                        </div>
                      )}
                      {visual.type === 'line' && (
                        <div className="w-full h-full text-center text-muted-foreground">
                          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                          <span className="text-xs">Line Chart</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {!hasAnyInsight && (
        <Card className="rounded-2xl p-12 bg-gradient-to-br from-gray-50 to-slate-50 dark:from-white/5 dark:to-white/5 border-gray-200 dark:border-white/10 shadow-lg text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">
            {language === 'ar' ? 'لا توجد رؤى بعد' : 'No Insights Yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {language === 'ar' 
              ? 'اختر النافذة الزمنية المناسبة وانقر على "إنشاء الرؤى" للحصول على تحليل ذكي مخصص'
              : 'Select the appropriate time window and click "Generate Insights" for personalized AI analysis'
            }
          </p>
          <div className="text-sm text-muted-foreground">
            {language === 'ar' ? 'المدرب الذكي متاح في:' : 'AI Coach available during:'}
            <div className="mt-2 space-y-1">
              <div>🌅 {language === 'ar' ? 'الصباح' : 'Morning'}: 5:00 AM - 11:00 AM</div>
              <div>☀️ {language === 'ar' ? 'منتصف النهار' : 'Midday'}: 12:00 PM - 6:00 PM</div>
              <div>🌙 {language === 'ar' ? 'المساء' : 'Evening'}: 5:00 PM - 11:00 PM</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
