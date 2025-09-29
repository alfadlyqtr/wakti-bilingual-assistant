import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { buildInsightsAggregate, generateAiInsights } from "@/services/whoopService";
import { Copy, Download, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { generatePDF } from "@/utils/pdfUtils";

export function AIInsights() {
  const { language } = useTheme();
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [agg, setAgg] = useState<any>(null);
  const [ai, setAi] = useState<{ daily_summary?: string; weekly_summary?: string; tips?: string[]; motivations?: string[]; long_summary?: string }>({});
  const printableRef = useRef<HTMLDivElement>(null);

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
  }, [language]);

  const sleepBars = useMemo(() => (
    (agg?.last7Days?.sleepHours || []).map((h:number, i:number) => ({ name: `D${i+1}`, Hours: h }))
  ), [agg]);

  const recLines = useMemo(() => (
    (agg?.last7Days?.recoveryPct || []).map((r:number, i:number) => ({
      name: `D${i+1}`,
      Recovery: r ?? null,
      HRV: agg?.last7Days?.hrvMs?.[i] ?? null,
      RHR: agg?.last7Days?.rhrBpm?.[i] ?? null,
    }))
  ), [agg]);

  const workoutsLines = useMemo(() => (
    (agg?.workouts || []).map((w:any) => ({
      name: new Date(w.start).toLocaleDateString(undefined,{month:'short',day:'numeric'}),
      Strain: w.strain ?? null,
      Calories: w.kcal ?? null,
    }))
  ), [agg]);

  const onGenerate = async () => {
    try {
      setAiLoading(true);
      const resp = await generateAiInsights(language as 'en'|'ar');
      setAi(resp || {});
      toast.success(language === 'ar' ? 'تم إنشاء الرؤى' : 'Insights generated');
    } catch (e:any) {
      console.error("ai error", e);
      if (e?.message?.includes('missing_openai_key')) {
        toast.error('Server missing OPENAI_API_KEY');
      } else {
        toast.error(language === 'ar' ? 'تعذر إنشاء الرؤى' : 'Failed to generate insights');
      }
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
          {language==='ar' ? 'يتم إرسال بيانات موجزة إلى نموذج gpt-4o-mini لتقديم ملخصات ودعم.' : 'A compact, anonymized dataset is sent to gpt-4o-mini to produce summaries and supportive tips.'}
        </div>
      </Card>

      {/* Charts & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl p-4 shadow-sm bg-white/5">
          <div className="text-xs text-muted-foreground mb-2">Sleep hours (7d)</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sleepBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Hours" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="rounded-2xl p-4 shadow-sm bg-white/5">
          <div className="text-xs text-muted-foreground mb-2">Recovery / HRV / RHR (7d)</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recLines}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Recovery" stroke="#10b981" dot={false} />
                <Line type="monotone" dataKey="HRV" stroke="#22c55e" dot={false} />
                <Line type="monotone" dataKey="RHR" stroke="#ef4444" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="rounded-2xl p-4 shadow-sm bg-white/5 lg:col-span-2">
          <div className="text-xs text-muted-foreground mb-2">Workouts (strain & calories)</div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={workoutsLines}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Strain" stroke="#6366f1" dot={false} />
                <Line type="monotone" dataKey="Calories" stroke="#f59e0b" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* AI Output */}
        <Card ref={printableRef} className="rounded-2xl p-4 shadow-sm bg-white/5 lg:col-span-2">
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
