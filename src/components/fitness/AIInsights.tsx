import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { buildInsightsAggregate, generateAiInsights, pingAiInsights } from "@/services/whoopService";
import { Copy, Download, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
// Charts for insights have been moved to the Overview tab. Keep recharts imports out of this file to avoid bundle weight.
import { generatePDF } from "@/utils/pdfUtils";

export function AIInsights() {
  const { language } = useTheme();
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [agg, setAgg] = useState<any>(null);
  const [ai, setAi] = useState<{ daily_summary?: string; weekly_summary?: string; tips?: string[]; motivations?: string[]; long_summary?: string }>({});
  const printableRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle"|"checking"|"contacting"|"analyzing"|"ready"|"error">("idle");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await buildInsightsAggregate();
        setAgg(data);
      } catch (e) {
        console.error("aggregate error", e);
        toast.error(language === 'ar' ? 'تعذر تحميل البيانات' : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
    // Fix charts mis-sizing when tab becomes visible
    const t1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    const t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [language]);

  // Charts moved to Overview; no local chart data here.

  const onGenerate = async () => {
    try {
      setAiLoading(true);
      setPhase('checking');
      await pingAiInsights();
      setPhase('contacting');
      const resp = await generateAiInsights(language as 'en'|'ar');
      setPhase('analyzing');
      setAi(resp || {});
      setPhase('ready');
      toast.success(language === 'ar' ? 'تم إنشاء الرؤى' : 'Insights generated');
    } catch (e:any) {
      console.error("ai error", e);
      if (e?.message?.includes('missing_openai_key')) {
        toast.error('Server missing OPENAI_API_KEY');
      } else if (e?.message === 'ai_timeout') {
        toast.error(language==='ar' ? 'انتهت مهلة الذكاء الاصطناعي. حاول مرة أخرى.' : 'AI timed out. Please try again.');
      } else {
        toast.error(language === 'ar' ? 'تعذر إنشاء الرؤى' : 'Failed to generate insights');
      }
      setPhase('error');
    } finally {
      setAiLoading(false);
    }
  };

  const onCopy = async () => {
    const text = ai?.long_summary || composeText(ai);
    try { await navigator.clipboard.writeText(text); toast.success(language === 'ar' ? 'تم النسخ' : 'Copied'); } catch {}
  };

  const onDownload = async () => {
    const text = ai?.long_summary || composeText(ai);
    const blob = await generatePDF({
      title: language === 'ar' ? 'تقرير رؤى اللياقة' : 'Fitness Insights Report',
      content: { text },
      metadata: {
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now()+7*86400000).toISOString(),
        type: 'whoop_ai_insights'
      },
      language: (language === 'ar' ? 'ar' : 'en')
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wakti-insights-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl p-4 shadow-sm bg-white/5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">AI Insights</div>
          <Button onClick={onGenerate} disabled={aiLoading || loading}>
            <RefreshCcw className={aiLoading ? 'mr-2 h-4 w-4 animate-spin':'mr-2 h-4 w-4'} /> {aiLoading ? (language==='ar'?'جاري الإنشاء...':'Generating...') : (language==='ar'?'إنشاء الرؤى':'Generate Insights')}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {language==='ar' ? 'مدعوم من WAKTI AI — نستخدم بيانات موجزة ومجهولة لإنتاج ملخصات ونصائح داعمة.' : 'Powered by WAKTI AI — we use a compact, anonymized dataset to generate supportive summaries and tips.'}
        </div>
        <div className="text-[11px] text-muted-foreground mt-1">
          {phase === 'idle' && (language==='ar' ? 'جاهز.' : 'Ready.')}
          {phase === 'checking' && (language==='ar' ? 'التحقق من الخدمة...' : 'Checking service...')}
          {phase === 'contacting' && (language==='ar' ? 'جار الاتصال بـ WAKTI AI...' : 'Contacting WAKTI AI...')}
          {phase === 'analyzing' && (language==='ar' ? 'جاري التحليل...' : 'Analyzing...')}
          {phase === 'ready' && (language==='ar' ? 'تم التحضير.' : 'Prepared.')}
          {phase === 'error' && (language==='ar' ? 'حدث خطأ. حاول مرة أخرى.' : 'Error occurred. Try again.')}
        </div>
      </Card>

      {/* AI Output only (charts moved to Overview) */}
      <div className="grid grid-cols-1 gap-6">
        <Card ref={printableRef} className="rounded-2xl p-4 shadow-sm bg-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Coach Insights</div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onCopy}><Copy className="h-4 w-4 mr-2" />{language==='ar'?'نسخ':'Copy'}</Button>
              <Button variant="outline" onClick={onDownload}><Download className="h-4 w-4 mr-2" />{language==='ar'?'تنزيل PDF':'Download PDF'}</Button>
            </div>
          </div>
          <Section title={language==='ar'?'الملخص اليومي':'Daily Summary'}>{ai?.daily_summary || placeholder(language)}</Section>
          <Section title={language==='ar'?'الملخص الأسبوعي':'Weekly Summary'}>{ai?.weekly_summary || placeholder(language)}</Section>
          {!!(ai?.tips && ai.tips.length) && (
            <div className="mt-3">
              <div className="text-sm font-medium mb-1">{language==='ar'?'نصائح':'Tips'}</div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {ai.tips.map((t,i)=>(<li key={i}>{t}</li>))}
              </ul>
            </div>
          )}
          {!!(ai?.motivations && ai.motivations.length) && (
            <div className="mt-3">
              <div className="text-sm font-medium mb-1">{language==='ar'?'تحفيز':'Motivations'}</div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {ai.motivations.map((t,i)=>(<li key={i}>{t}</li>))}
              </ul>
            </div>
          )}
        </Card>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-sm font-medium mb-1">{title}</div>
      <div className="text-sm text-muted-foreground whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function placeholder(lang: string) {
  return lang==='ar'
    ? 'اضغط على "إنشاء الرؤى" للحصول على ملخصات وتوصيات مدرب لياقة.'
    : 'Click "Generate Insights" to get coach summaries and suggestions.';
}

function composeText(ai: any) {
  let out = '';
  if (ai?.daily_summary) out += `Daily Summary\n${ai.daily_summary}\n\n`;
  if (ai?.weekly_summary) out += `Weekly Summary\n${ai.weekly_summary}\n\n`;
  if (ai?.tips?.length) out += `Tips\n- ${ai.tips.join('\n- ')}\n\n`;
  if (ai?.motivations?.length) out += `Motivations\n- ${ai.motivations.join('\n- ')}`;
  return out || '';
}

function KVTable({ title, rows }: { title: string; rows: { k: string; v: string | number | null | undefined }[] }) {
  if (!rows || rows.length === 0) return (
    <div className="rounded-xl border p-3 bg-white/5">
      <div className="text-xs text-muted-foreground mb-2">{title}</div>
      <div className="text-xs text-muted-foreground">--</div>
    </div>
  );
  return (
    <div className="rounded-xl border p-3 bg-white/5">
      <div className="text-xs text-muted-foreground mb-2">{title}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {rows.map((r, i) => (
          <React.Fragment key={i}>
            <div className="text-muted-foreground">{r.k}</div>
            <div className="font-medium">{r.v as any ?? '--'}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function cycleRows(d:any){
  if(!d) return [] as any[];
  return [
    {k:'id', v: d.id},
    {k:'start', v: d.start},
    {k:'end', v: d.end},
    {k:'score_state', v: d.score_state},
    {k:'strain', v: d.score?.strain},
    {k:'avg_hr', v: d.score?.average_heart_rate},
    {k:'max_hr', v: d.score?.max_heart_rate},
    {k:'kJ', v: d.score?.kilojoule},
  ];
}
function sleepRows(d:any){
  if(!d) return [] as any[];
  const st = d?.score || {};
  const stage = st?.stage_summary || {};
  return [
    {k:'id', v: d.id},
    {k:'start', v: d.start},
    {k:'end', v: d.end},
    {k:'nap', v: String(!!d.nap)},
    {k:'performance_%', v: st?.sleep_performance_percentage ?? st?.performance ?? null},
    {k:'deep_min', v: stage.deep_sleep_milli ? Math.round(stage.deep_sleep_milli/60000) : null},
    {k:'rem_min', v: stage.rem_sleep_milli ? Math.round(stage.rem_sleep_milli/60000) : null},
    {k:'light_min', v: stage.light_sleep_milli ? Math.round(stage.light_sleep_milli/60000) : null},
  ];
}
function recoveryRows(d:any){
  if(!d) return [] as any[];
  const s = d?.score || {};
  return [
    {k:'sleep_id', v: d.sleep_id},
    {k:'cycle_id', v: d.cycle_id},
    {k:'recovery_%', v: s.recovery_score ?? d.recovery_score ?? null},
    {k:'rhr_bpm', v: s.resting_heart_rate ?? d.resting_heart_rate ?? null},
    {k:'hrv_ms', v: s.hrv_rmssd_milli ?? d.hrv_rmssd_milli ?? null},
    {k:'spo2_%', v: s.spo2_percentage ?? null},
    {k:'skin_temp_c', v: s.skin_temp_celsius ?? null},
  ];
}
function workoutRows(d:any){
  if(!d) return [] as any[];
  const s = d?.score || {};
  return [
    {k:'id', v: d.id},
    {k:'sport', v: d.sport_name},
    {k:'start', v: d.start},
    {k:'end', v: d.end},
    {k:'strain', v: s.strain ?? null},
    {k:'avg_hr', v: s.average_heart_rate ?? d.avg_hr_bpm ?? null},
    {k:'max_hr', v: s.max_heart_rate ?? null},
    {k:'kJ', v: s.kilojoule ?? null},
    {k:'distance_m', v: s.distance_meter ?? null},
    {k:'percent_recorded', v: s.percent_recorded ?? null},
  ];
}
