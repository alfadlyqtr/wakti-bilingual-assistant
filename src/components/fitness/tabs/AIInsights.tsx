import React, { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Download, RefreshCw, Brain, TrendingUp, TrendingDown } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";
import { generateAiInsights, buildInsightsAggregate } from "@/services/whoopService";

type TimeRange = '1d' | '1w' | '2w' | '1m' | '3m' | '6m';

interface AIInsightsProps {
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
}

export function AIInsights({ timeRange, onTimeRangeChange }: AIInsightsProps) {
  const { language } = useTheme();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [aggregate, setAggregate] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const generateInsights = async () => {
    try {
      setLoading(true);
      const [agg, ai] = await Promise.all([
        buildInsightsAggregate(),
        generateAiInsights(language as 'en' | 'ar')
      ]);
      setAggregate(agg);
      setInsights(ai);
      toast.success(language === 'ar' ? 'تم إنشاء الرؤى' : 'Insights generated');
    } catch (error) {
      console.error('AI insights error:', error);
      toast.error(language === 'ar' ? 'فشل في إنشاء الرؤى' : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!insights) return;
    const text = `${insights.daily_summary || ''}\n\n${insights.weekly_summary || ''}\n\nTips:\n${(insights.tips || []).map((t: string) => `• ${t}`).join('\n')}\n\nMotivations:\n${(insights.motivations || []).map((m: string) => `• ${m}`).join('\n')}`;
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
      {/* Mini-tabs for time range */}
      <div className="flex gap-2 mb-6">
        {(['1d', '1w', '2w', '1m', '3m', '6m'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => onTimeRangeChange(range)}
            className={`px-3 py-1 rounded-full text-sm shadow-sm transition-all ${
              timeRange === range
                ? 'bg-indigo-500 text-white shadow-md'
                : 'bg-gray-100 hover:bg-indigo-200 text-gray-700'
            }`}
          >
            {range.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Generate Insights */}
      <Card className="rounded-2xl p-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Brain className="h-6 w-6 text-purple-400" />
            <div>
              <h3 className="font-semibold text-lg">
                {language === 'ar' ? 'رؤى الذكاء الاصطناعي' : 'AI Insights'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === 'ar' ? 'تحليل ذكي لبياناتك الصحية' : 'Intelligent analysis of your health data'}
              </p>
            </div>
          </div>
          <Button onClick={generateInsights} disabled={loading} className="bg-purple-500/20 hover:bg-purple-500/30">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading 
              ? (language === 'ar' ? 'جار التحليل...' : 'Analyzing...')
              : (language === 'ar' ? 'إنشاء الرؤى' : 'Generate Insights')
            }
          </Button>
        </div>
      </Card>

      {/* Insights Content */}
      {insights && (
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
              {insights.daily_summary || (language === 'ar' ? 'لا توجد بيانات كافية للملخص اليومي' : 'Insufficient data for daily summary')}
            </p>
          </Card>

          {/* Weekly Summary */}
          <Card className="rounded-2xl p-6 bg-white/5 border-white/10">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <TrendingDown className="h-5 w-5 text-blue-400" />
              {language === 'ar' ? 'الملخص الأسبوعي' : 'Weekly Summary'}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {insights.weekly_summary || (language === 'ar' ? 'لا توجد بيانات كافية للملخص الأسبوعي' : 'Insufficient data for weekly summary')}
            </p>
          </Card>

          {/* Tips & Motivations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tips */}
            <Card className="rounded-2xl p-6 bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20">
              <h3 className="font-semibold text-lg mb-4 text-emerald-400">
                {language === 'ar' ? 'نصائح' : 'Tips'}
              </h3>
              <ul className="space-y-2">
                {(insights.tips || []).map((tip: string, index: number) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-emerald-400 mt-1">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Motivations */}
            <Card className="rounded-2xl p-6 bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
              <h3 className="font-semibold text-lg mb-4 text-orange-400">
                {language === 'ar' ? 'تحفيز' : 'Motivations'}
              </h3>
              <ul className="space-y-2">
                {(insights.motivations || []).map((motivation: string, index: number) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-orange-400 mt-1">•</span>
                    <span>{motivation}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {!insights && (
        <Card className="rounded-2xl p-12 bg-white/5 border-white/10 text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-2">
            {language === 'ar' ? 'لا توجد رؤى بعد' : 'No Insights Yet'}
          </h3>
          <p className="text-muted-foreground">
            {language === 'ar' ? 'انقر على "إنشاء الرؤى" للحصول على تحليل ذكي لبياناتك' : 'Click "Generate Insights" to get intelligent analysis of your data'}
          </p>
        </Card>
      )}
    </div>
  );
}
