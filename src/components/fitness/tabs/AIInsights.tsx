import React, { useState, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, RefreshCw, Brain, TrendingUp, TrendingDown, Sun, Clock, Moon, CheckCircle } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";
import { generateAiInsights, buildInsightsAggregate } from "@/services/whoopService";
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
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
  morning: { start: '05:00', end: '08:00', label: 'Morning Readiness', icon: Sun },
  midday: { start: '12:00', end: '15:00', label: 'Performance Check', icon: Clock },
  evening: { start: '17:00', end: '20:00', label: 'Recovery Focus', icon: Moon }
};

export function AIInsights({ timeRange, onTimeRangeChange }: AIInsightsProps) {
  const { language } = useTheme();
  const [loading, setLoading] = useState<TimeWindow | null>(null);
  const [insights, setInsights] = useState<Record<TimeWindow, InsightData | null>>({
    morning: null,
    midday: null,
    evening: null
  });
  const [activeWindow, setActiveWindow] = useState<TimeWindow>('morning');
  const printRef = useRef<HTMLDivElement>(null);

  // Check if current time is within a time window
  const getCurrentTimeWindow = (): TimeWindow | null => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    for (const [window, config] of Object.entries(TIME_WINDOWS)) {
      if (currentTime >= config.start && currentTime <= config.end) {
        return window as TimeWindow;
      }
    }
    return null;
  };

  const isWindowActive = (window: TimeWindow): boolean => {
    return getCurrentTimeWindow() === window;
  };

  const getNextWindowTime = (window: TimeWindow): string => {
    return TIME_WINDOWS[window].start;
  };

  const generateInsights = async (window: TimeWindow) => {
    if (!isWindowActive(window)) {
      toast.error(language === 'ar' 
        ? `متاح في ${getNextWindowTime(window)}` 
        : `Available at ${getNextWindowTime(window)}`
      );
      return;
    }

    try {
      setLoading(window);
      const aggregate = await buildInsightsAggregate();
      
      // Call the enhanced Edge Function with time context
      const response = await generateAiInsights(language as 'en' | 'ar', {
        time_of_day: window,
        user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        data: aggregate
      });
      
      setInsights(prev => ({
        ...prev,
        [window]: response
      }));
      
      toast.success(language === 'ar' ? 'تم إنشاء الرؤى' : 'Insights generated');
    } catch (error) {
      console.error('AI insights error:', error);
      toast.error(language === 'ar' ? 'فشل في إنشاء الرؤى' : 'Failed to generate insights');
    } finally {
      setLoading(null);
    }
  };

  const currentInsight = insights[activeWindow];

  const copyToClipboard = async () => {
    if (!currentInsight) return;
    const text = `${currentInsight.daily_summary || ''}\n\n${currentInsight.weekly_summary || ''}\n\nTips:\n${(currentInsight.tips || []).map((t: string) => `• ${t}`).join('\n')}\n\nMotivations:\n${(currentInsight.motivations || []).map((m: string) => `• ${m}`).join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success(language === 'ar' ? 'تم النسخ' : 'Copied to clipboard');
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في النسخ' : 'Failed to copy');
    }
  };

  const downloadPDF = async () => {
    if (!printRef.current) return;
    try {
      // Dynamic import to avoid bundle size issues
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).jsPDF;
      
      const canvas = await html2canvas(printRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF();
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`wakti-insights-${Date.now()}.pdf`);
      toast.success(language === 'ar' ? 'تم تنزيل PDF' : 'PDF downloaded');
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في تنزيل PDF' : 'Failed to download PDF');
    }
  };

  return (
    <div className="space-y-6">
      {/* Time Range Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['1d', '1w', '2w', '1m', '3m', '6m'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => onTimeRangeChange(range)}
            className={`px-2 py-1 sm:px-3 rounded-full text-xs sm:text-sm shadow-sm transition-all ${
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
          <Brain className="h-8 w-8 text-purple-400" />
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {language === 'ar' ? 'رؤى WAKTI AI' : 'WAKTI AI Insights'}
            </h2>
            <p className="text-muted-foreground">
              {language === 'ar' ? 'مدربك الشخصي الذكي' : 'Your intelligent personal coach'}
            </p>
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
                disabled={!isActive || isGenerating}
                className={`h-20 flex-col gap-2 relative ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 hover:from-emerald-500/30 hover:to-blue-500/30 border-emerald-500/30' 
                    : 'bg-gray-500/10 hover:bg-gray-500/20 border-gray-500/20'
                }`}
                variant="outline"
              >
                <Icon className={`h-6 w-6 ${isActive ? 'text-emerald-400' : 'text-gray-400'}`} />
                <div className="text-center">
                  <div className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-gray-400'}`}>
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
                
                {!isActive && (
                  <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-gray-300">
                      {language === 'ar' ? `متاح في ${config.start}` : `Available at ${config.start}`}
                    </span>
                  </div>
                )}
              </Button>
            );
          })}
        </div>

        {/* Active Window Selector */}
        <div className="mt-6 flex gap-2">
          {(Object.keys(TIME_WINDOWS) as TimeWindow[]).map((window) => (
            <button
              key={window}
              onClick={() => setActiveWindow(window)}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                activeWindow === window
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-500/50'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              {TIME_WINDOWS[window].label}
              {insights[window] && <span className="ml-2 text-emerald-400">✓</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* Insights Content */}
      {currentInsight && (
        <div ref={printRef} className="space-y-6">
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
                <Button variant="outline" size="sm" onClick={downloadPDF}>
                  <Download className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'تنزيل PDF' : 'Download PDF'}
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {currentInsight.daily_summary || (language === 'ar' ? 'لا توجد بيانات كافية للملخص اليومي' : 'Insufficient data for daily summary')}
            </p>
          </Card>

          {/* Weekly Summary */}
          <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <TrendingDown className="h-5 w-5 text-blue-400" />
              {language === 'ar' ? 'الملخص الأسبوعي' : 'Weekly Summary'}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {currentInsight.weekly_summary || (language === 'ar' ? 'لا توجد بيانات كافية للملخص الأسبوعي' : 'Insufficient data for weekly summary')}
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
                {(currentInsight.tips || []).map((tip: string, index: number) => (
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
                {(currentInsight.motivations || []).map((motivation: string, index: number) => (
                  <div key={index} className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                    <p className="text-sm font-medium text-orange-200">{motivation}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* AI Generated Visuals */}
          {currentInsight.visuals && currentInsight.visuals.length > 0 && (
            <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
              <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-400" />
                {language === 'ar' ? 'الرسوم البيانية الذكية' : 'Smart Visuals'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentInsight.visuals.map((visual, index) => (
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

      {!currentInsight && (
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
              <div>🌅 {language === 'ar' ? 'الصباح' : 'Morning'}: 05:00 - 08:00</div>
              <div>☀️ {language === 'ar' ? 'منتصف النهار' : 'Midday'}: 12:00 - 15:00</div>
              <div>🌙 {language === 'ar' ? 'المساء' : 'Evening'}: 17:00 - 20:00</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
