import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { buildInsightsAggregate, generateAiInsights, getSavedInsight, pingAiInsights } from "@/services/whoopService";
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
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState<'morning'|'midday'|'evening'|'auto'>('auto');
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await buildInsightsAggregate();
        setAgg(data);
        
        // AUTO-LOAD CACHED INSIGHTS for ALL windows on mount
        const windows: ('morning' | 'midday' | 'evening')[] = ['morning', 'midday', 'evening'];
        const currentHour = new Date().getHours();
        let autoWindow: 'morning' | 'midday' | 'evening' = 'evening';
        if (currentHour >= 4 && currentHour < 12) autoWindow = 'morning';
        else if (currentHour >= 12 && currentHour < 20) autoWindow = 'midday';

        for (const win of windows) {
          const cached = await getSavedInsight(win);
          if (cached) {
            // If it's the active window and no AI data yet, set it
            if (win === autoWindow) {
              setAi(cached);
              setPhase('ready');
            }
          }
        }
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

  const activeWindow = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 20) return 'midday';
    return 'evening';
  }, [lastSyncTime]);

  // Handle time window switching with cache support
    useEffect(() => {
        if (selectedTimeOfDay !== 'auto') {
            (async () => {
                const cached = await getSavedInsight(selectedTimeOfDay);
                if (cached) {
                    setAi(cached);
                    setPhase('ready');
                } else {
                    setAi({});
                    setPhase('idle');
                }
            })();
        } else {
            // Auto mode: check cache for the active window
            (async () => {
                const win = activeWindow;
                const cached = await getSavedInsight(win);
                if (cached) {
                    setAi(cached);
                    setPhase('ready');
                } else {
                    setAi({});
                    setPhase('idle');
                }
            })();
        }
    }, [selectedTimeOfDay, activeWindow]);

  const onGenerate = async () => {
    try {
      setAiLoading(true);
      setPhase('checking');
      await pingAiInsights();
      
      // CRITICAL: Fetch FRESH data right before generating AI insights
      setPhase('contacting');
      console.log('=== GENERATING AI INSIGHTS ===');
      console.log('Timestamp:', new Date().toISOString());
      
      // Force cache bust by adding timestamp
      const cacheBuster = Date.now();
      console.log('Cache buster:', cacheBuster);
      const freshData = await buildInsightsAggregate();
      
      console.log('=== FRESH DATA FETCHED ===');
      console.log('Sleep Hours:', freshData?.today?.sleepHours);
      console.log('Recovery %:', freshData?.today?.recoveryPct);
      console.log('HRV ms:', freshData?.today?.hrvMs);
      console.log('RHR bpm:', freshData?.today?.rhrBpm);
      console.log('Strain:', freshData?.today?.dayStrain);
      console.log('Sleep Performance %:', freshData?.today?.sleepPerformancePct);
      console.log('Full today object:', freshData?.today);
      
      // Update the preview with fresh data
      setAgg(freshData);
      
      // Determine time of day based on selection or auto
      let timeOfDay: string;
      if (selectedTimeOfDay === 'auto') {
        const hour = new Date().getHours();
        
        // Refined Logic (Matching UI labels in Vitality Dashboard):
        // Morning: 4:00 AM - 11:59 AM (Focus: Sleep analysis & Daily prep)
        // Midday: 12:00 PM - 7:59 PM (Focus: Activity & Mid-day flow)
        // Evening: 8:00 PM - 3:59 AM (Focus: Wind-down & Next-day prep)
        if (hour >= 4 && hour < 12) {
          timeOfDay = 'morning';
        } else if (hour >= 12 && hour < 20) {
          timeOfDay = 'midday';
        } else {
          timeOfDay = 'evening';
        }
      } else {
        timeOfDay = selectedTimeOfDay;
      }
      
      // Pass the FRESH data to AI (not the old cached agg)
      console.log('=== SENDING TO AI ===');
      console.log('Time of Day:', timeOfDay);
      console.log('Language:', language);
      console.log('Data being sent:', JSON.stringify(freshData?.today, null, 2));
      
      // SHOW USER EXACTLY WHAT'S BEING SENT
      const dataPreview = `Sleep: ${freshData?.today?.sleepHours}h | Recovery: ${freshData?.today?.recoveryPct}% | HRV: ${freshData?.today?.hrvMs}ms | Strain: ${freshData?.today?.dayStrain} | RHR: ${freshData?.today?.rhrBpm}bpm`;
      console.log('SENDING TO AI:', dataPreview);
      toast.info(`Sending: ${dataPreview}`, { duration: 5000 });
      
      const resp = await generateAiInsights(language as 'en'|'ar', {
        data: freshData,
        time_of_day: timeOfDay,
        user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        force_refresh: true // Always force refresh when user clicks "Generate"
      });
      
      console.log('=== AI RESPONSE RECEIVED ===');
      console.log('Response:', resp);
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
      {/* CRITICAL: Data Being Sent to AI - ALWAYS VISIBLE */}
      <Card className="rounded-2xl p-3 shadow-sm bg-red-500/10 border-red-500/30">
        <div className="text-xs font-bold text-red-400 mb-2">⚠️ DATA BEING SENT TO AI RIGHT NOW:</div>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div><span className="text-gray-400">Sleep:</span> <span className="text-white font-bold">{agg?.today?.sleepHours || 0}h</span></div>
          <div><span className="text-gray-400">Recovery:</span> <span className="text-white font-bold">{agg?.today?.recoveryPct || 0}%</span></div>
          <div><span className="text-gray-400">HRV:</span> <span className="text-white font-bold">{agg?.today?.hrvMs || 0}ms</span></div>
          <div><span className="text-gray-400">RHR:</span> <span className="text-white font-bold">{agg?.today?.rhrBpm || 0}bpm</span></div>
          <div><span className="text-gray-400">Strain:</span> <span className="text-white font-bold">{agg?.today?.dayStrain || 0}</span></div>
          <div><span className="text-gray-400">Sleep Perf:</span> <span className="text-white font-bold">{agg?.today?.sleepPerformancePct || 0}%</span></div>
        </div>
        <div className="text-[10px] text-gray-400 mt-2">If these numbers are wrong, AI will be wrong. Click Generate to refresh.</div>
      </Card>
      
      <Card className="rounded-2xl p-4 shadow-sm bg-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">{language === 'ar' ? 'رؤى WAKTI AI' : 'WAKTI AI Insights'}</div>
          <Button onClick={onGenerate} disabled={aiLoading || loading} size="sm" className="h-8 px-3 text-xs">
            <RefreshCcw className={aiLoading ? 'mr-2 h-4 w-4 animate-spin':'mr-2 h-4 w-4'} /> {aiLoading ? (language==='ar'?'جاري الإنشاء...':'Generating...') : (language==='ar'?'إنشاء الرؤى':'Generate Insights')}
          </Button>
        </div>
        
        {/* Time of Day Selector - AUTO GENERATES when clicked */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setSelectedTimeOfDay('auto'); setTimeout(() => onGenerate(), 100); }}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 ${
              selectedTimeOfDay === 'auto' 
                ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            {language === 'ar' ? 'تلقائي' : 'Auto'}
            {selectedTimeOfDay === 'auto' && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
          </button>
          <button
            onClick={() => { setSelectedTimeOfDay('morning'); setTimeout(() => onGenerate(), 100); }}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors relative ${
              (selectedTimeOfDay === 'morning' || (selectedTimeOfDay === 'auto' && activeWindow === 'morning'))
                ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            🌅 {language === 'ar' ? 'صباح' : 'Morning'}
            <span className="ml-1 text-[10px] opacity-70">4-12 PM</span>
            {(selectedTimeOfDay === 'auto' && activeWindow === 'morning') && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0c0f14] z-10" />
            )}
          </button>
          <button
            onClick={() => { setSelectedTimeOfDay('midday'); setTimeout(() => onGenerate(), 100); }}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors relative ${
              (selectedTimeOfDay === 'midday' || (selectedTimeOfDay === 'auto' && activeWindow === 'midday'))
                ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            ☀️ {language === 'ar' ? 'ظهر' : 'Midday'}
            <span className="ml-1 text-[10px] opacity-70">12-8 PM</span>
            {(selectedTimeOfDay === 'auto' && activeWindow === 'midday') && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0c0f14] z-10" />
            )}
          </button>
          <button
            onClick={() => { setSelectedTimeOfDay('evening'); setTimeout(() => onGenerate(), 100); }}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors relative ${
              (selectedTimeOfDay === 'evening' || (selectedTimeOfDay === 'auto' && activeWindow === 'evening'))
                ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            🌙 {language === 'ar' ? 'مساء' : 'Evening'}
            <span className="ml-1 text-[10px] opacity-70">8 PM-4 AM</span>
            {(selectedTimeOfDay === 'auto' && activeWindow === 'evening') && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0c0f14] z-10" />
            )}
          </button>
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
            <div className="text-sm font-medium">{language === 'ar' ? 'رؤى المدرب' : 'Coach Insights'}</div>
            <div className="flex items-center gap-2 flex-nowrap">
              <Button variant="secondary" size="sm" className="h-8 px-3 text-xs" onClick={onCopy}>
                <Copy className="h-4 w-4 mr-2" />{language==='ar'?'نسخ':'Copy'}
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={onDownload}>
                <Download className="h-4 w-4 mr-2" />{language==='ar'?'PDF':'PDF'}
              </Button>
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
