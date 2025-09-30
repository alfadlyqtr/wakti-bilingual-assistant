import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Brain, TrendingUp, TrendingDown, Sun, Clock, Moon, CheckCircle } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";
import { generateAiInsights, buildInsightsAggregate } from "@/services/whoopService";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import 'react-circular-progressbar/dist/styles.css';

type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';

interface AIInsightsProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
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
  morning: { start: '5:00 AM', end: '11:00 AM', label: 'Morning Summary', icon: Sun },
  midday: { start: '12:00 PM', end: '6:00 PM', label: 'Midday Summary', icon: Clock },
  evening: { start: '5:00 PM', end: '11:00 PM', label: 'Evening Summary', icon: Moon },
};

export function AIInsights({ timeRange, onTimeRangeChange }: AIInsightsProps) {
  const { language } = useTheme();
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

  // Check if current time is within a time window
  const getCurrentTimeWindow = (): TimeWindow | null => {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Morning: 5 AM - 11 AM
    if (currentHour >= 5 && currentHour <= 11) {
      return 'morning';
    }
    // Midday: 12 PM - 6 PM (12-18)
    if (currentHour >= 12 && currentHour <= 18) {
      return 'midday';
    }
    // Evening: 5 PM - 11 PM (17-23)
    if (currentHour >= 17 && currentHour <= 23) {
      return 'evening';
    }
    
    return null;
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
    
    // Calculate milliseconds until next window starts
    if (currentHour >= 5 && currentHour < 11) {
      // Morning window - next is midday (12 PM)
      const nextWindow = new Date(now);
      nextWindow.setHours(12, 0, 0, 0);
      return nextWindow.getTime() - now.getTime();
    } else if (currentHour >= 12 && currentHour < 17) {
      // Midday window - next is evening (5 PM)
      const nextWindow = new Date(now);
      nextWindow.setHours(17, 0, 0, 0);
      return nextWindow.getTime() - now.getTime();
    } else if (currentHour >= 17 && currentHour < 23) {
      // Evening window - next is tomorrow morning (5 AM)
      const nextWindow = new Date(now);
      nextWindow.setDate(nextWindow.getDate() + 1);
      nextWindow.setHours(5, 0, 0, 0);
      return nextWindow.getTime() - now.getTime();
    }
    
    // Outside all windows - next is morning (5 AM)
    const nextWindow = new Date(now);
    if (currentHour >= 23 || currentHour < 5) {
      if (currentHour >= 23) {
        nextWindow.setDate(nextWindow.getDate() + 1);
      }
      nextWindow.setHours(5, 0, 0, 0);
    }
    return nextWindow.getTime() - now.getTime();
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

  const generateInsights = async (window: TimeWindow) => {
    // Allow generation anytime for testing - remove time restrictions
    console.log('Generating insights for window:', window);
    
    // Prevent double-clicks and check cache (2x per window per day)
    if (loading === window) return;
    
    const now = Date.now();
    // Remove generation limits for testing
    
    // Check if we have cached insights that are still valid
    if (insights[window] && lastGenerated[window] > 0) {
      const timeSinceGeneration = now - lastGenerated[window];
      const nextWindowTime = getNextWindowStartTime();
      
      // Cache valid until next window starts
      if (timeSinceGeneration < nextWindowTime) {
        setActiveWindow(window);
        toast.success(language === 'ar' ? 'تم عرض الرؤى المحفوظة' : 'Showing cached insights');
        return;
      }
    }
    
    try {
      setLoading(window);
      console.log('Starting AI insights generation for window:', window);
      
      // Show loading immediately, then fetch data asynchronously
      setTimeout(async () => {
        try {
          console.log('Starting to build aggregate data...');
          const aggregate = await buildInsightsAggregate();
          console.log('Built aggregate data:', aggregate);
          
          // Check if aggregate is empty or null
          if (!aggregate || Object.keys(aggregate).length === 0) {
            console.warn('Aggregate data is empty, using mock data');
            throw new Error('No WHOOP data available');
          }
          
          // Add user info and make data more comprehensive
          const enhancedData = {
            ...aggregate,
            user_name: "Champion", // Add user name for personalization
            current_time: new Date().toISOString(),
            time_window: window,
            // Use actual data structure from buildInsightsAggregate
            sleep_hours: aggregate?.today?.sleepHours || 5.5,
            performance_score: aggregate?.today?.recoveryPct || 59,
            hrv_score: aggregate?.today?.hrvMs || 59,
            strain_score: aggregate?.today?.dayStrain || 12.4,
            sleep_performance: aggregate?.today?.sleepPerformancePct || 75,
            resting_hr: aggregate?.today?.rhrBpm || 65,
            latest_workout: aggregate?.today?.latestWorkout || null,
            // Add rich context for AI
            insights_context: {
              time_of_day: window,
              user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              current_hour: new Date().getHours(),
              is_weekend: [0, 6].includes(new Date().getDay())
            }
          };
          
          console.log('Enhanced data for AI:', enhancedData);
          
          const response = await generateAiInsights(language as 'en' | 'ar', {
            time_of_day: window,
            user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            data: enhancedData
          });
          
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
          
          const mockData = {
            user_name: "Champion",
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

  // PDF feature removed to prevent app freezing

  return (
    <div className="space-y-6">
      {/* Time Range Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['1d', '1w', '2w', '1m', '3m', '6m'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => onTimeRangeChange(range)}
            className={`px-2 py-1 sm:px-3 rounded-full text-xs sm:text-sm shadow-sm transition-all flex-shrink-0 ${
              timeRange === range
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-gray-100 hover:bg-indigo-200 text-gray-700'
            }`}
          >
            {range.toUpperCase()}
          </button>
        ))}
      </div>

      {/* AI Insights Header */}
      <Card className="rounded-2xl p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
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
        <div className="bg-black/20 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-300 mb-2">{language === 'ar' ? 'المدرب الذكي متاح خلال:' : 'AI Coach available during:'}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1 text-amber-400">
              🌅 {language === 'ar' ? 'الصباح: 5:00 - 11:00' : 'Morning: 5:00 AM - 11:00 AM'}
            </span>
            <span className="flex items-center gap-1 text-orange-400">
              ☀️ {language === 'ar' ? 'منتصف النهار: 12:00 - 6:00 مساءً' : 'Midday: 12:00 PM - 6:00 PM'}
            </span>
            <span className="flex items-center gap-1 text-purple-400">
              🌙 {language === 'ar' ? 'المساء: 5:00 - 11:00 مساءً' : 'Evening: 5:00 PM - 11:00 PM'}
            </span>
          </div>
        </div>

        {/* Time Window Generation Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(Object.entries(TIME_WINDOWS) as [TimeWindow, typeof TIME_WINDOWS[TimeWindow]][]).map(([window, config]) => {
            const Icon = config.icon;
            const isActive = isWindowActive(window);
            const hasInsight = !!insights[window];
            const isGenerating = loading === window;

            return (
              <Button
                key={window}
                onClick={() => generateInsights(window)}
                disabled={isGenerating}
                className={`h-20 flex-col gap-2 relative ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 hover:from-emerald-500/30 hover:to-blue-500/30 border-emerald-500/30' 
                    : 'bg-gray-500/10 hover:bg-gray-500/20 border-gray-500/20'
                }`}
                variant="outline"
              >
                <Icon className={`h-6 w-6 ${isActive ? 'text-emerald-400' : 'text-gray-400'}`} />
                <div className="text-center min-w-0 flex-1">
                  <div className={`font-semibold text-xs sm:text-sm ${isActive ? 'text-white' : 'text-gray-400'} break-words`}>
                    {config.label}
                  </div>
                  <div className={`text-xs ${isActive ? 'text-emerald-300' : 'text-gray-500'}`}>
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
        <div className="mt-6 flex gap-2 flex-wrap">
          {(Object.keys(TIME_WINDOWS) as TimeWindow[]).map((window) => (
            <button
              key={window}
              onClick={() => setActiveWindow(window)}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm transition-all min-w-0 flex-shrink-0 ${
                activeWindow === window
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <span className="break-words">{TIME_WINDOWS[window].label}</span>
              {insights[window] && <span className="ml-2 text-emerald-400">✓</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* Insights Content */}
      {hasAnyInsight && (
        <div key={`insights-${activeWindow}-${hasAnyInsight}`} ref={printRef} className="space-y-6">
          {/* Daily Summary */}
          <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                {language === 'ar' ? 'الملخص اليومي' : 'Daily Summary'}
              </h3>
              <div className="flex gap-2">
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
          <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
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
              <h3 className="font-semibold text-lg mb-4 text-emerald-400">
                {language === 'ar' ? 'نصائح' : 'Tips'}
              </h3>
              <ul className="space-y-3">
                {(displayInsight?.tips || []).map((tip: string, index: number) => (
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{tip}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Motivations */}
            <Card className="rounded-2xl p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
              <h3 className="font-semibold text-lg mb-4 text-orange-400">
                {language === 'ar' ? 'تحفيز' : 'Motivations'}
              </h3>
              <div className="space-y-3">
                {(displayInsight?.motivations || []).map((motivation: string, index: number) => (
                  <div key={index} className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <p className="text-sm font-medium text-orange-200">{motivation}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* AI Generated Visuals */}
          {(displayInsight?.visuals && displayInsight.visuals.length > 0) && (
            <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
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
        <Card className="rounded-2xl p-12 bg-white/5 border-white/10 text-center">
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
