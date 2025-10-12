import React, { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JournalService } from "@/services/journalService";

const STORAGE_KEY = "asktab:last";

export const AskTab: React.FC = () => {
  const { language } = useTheme();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  // Restore last session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.q) setQ(data.q);
      if (data.result) setResult(data.result);
    } catch {}
  }, []);

  // Auto-detect intent from question
  const detectedIntent = useMemo(() => {
    const t = q.toLowerCase();
    if (/tag|وسم|activity|نشاط/.test(t)) return "top_tags";
    if (/morning|صباح/.test(t)) return "mornings";
    if (/evening|night|مساء|ليل/.test(t)) return "evenings";
    if (/note|ملاحظة/.test(t)) return "notes";
    if (/streak|سلسلة/.test(t)) return "streak";
    if (/trend|اتجاه/.test(t)) return "trend";
    if (/count|عدد/.test(t)) return "count";
    if (/mood|مزاج/.test(t)) return "moods";
    return "summary";
  }, [q]);

  const ask = async () => {
    if (!q.trim() || loading) return;
    try {
      setLoading(true);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const data = await JournalService.ask(q.trim(), language as any, tz, {
        intent: detectedIntent,
        tips: true
      });
      setResult(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ q, result: data }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Pure Q&A input */}
      <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-card to-background p-3 shadow-md">
        <div className="flex gap-2">
          <Input className="flex-1 input-enhanced" value={q} onChange={e => setQ(e.target.value)} placeholder={language === 'ar' ? 'اسأل دفترك...' : 'Ask your journal...'} onKeyDown={e => { if (e.key === 'Enter') ask(); }} />
          <Button
            onClick={ask}
            disabled={loading}
            aria-busy={loading ? true : undefined}
            aria-live="polite"
            className={`btn-shine ${loading ? 'animate-pulse cursor-wait shadow-glow' : ''}`}
            data-saving={loading ? 'true' : 'false'}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-primary-foreground" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                {language === 'ar' ? 'جارٍ...' : 'Asking...'}
              </span>
            ) : (
              <span>{language === 'ar' ? 'اسأل' : 'Ask'}</span>
            )}
          </Button>
        </div>
      </div>

      {result && (
        <div className="rounded-2xl border border-[#3b2bbd] bg-[radial-gradient(1200px_400px_at_10%_-20%,hsl(var(--card))_0%,hsl(var(--background))_55%)] p-5 shadow-[0_0_0_1px_#3b2bbd,0_10px_40px_rgba(0,0,0,0.35)]">
          {result.question && <div className="text-sm mb-2 text-foreground/90">❓ {result.question}</div>}
          {/* Requested info */}
          {result.stats && (
            <div className="text-sm mb-3">
              {(() => {
                const moodNames = language === 'ar'
                  ? {1: 'سيئ جداً', 2: 'سيئ', 3: 'عادي', 4: 'جيد', 5: 'ممتاز'}
                  : {1: 'awful', 2: 'bad', 3: 'meh', 4: 'good', 5: 'rad'};
                const intentKey = result.resolved_intent || detectedIntent;
                // Tags only
                if (intentKey === 'top_tags' && Array.isArray(result.stats.most_common_tags) && result.stats.most_common_tags.length > 0) {
                  return (
                <div className="flex flex-wrap gap-2">
                  {result.stats.most_common_tags.map((t: any) => (
                    <span key={t.tag} className="px-2 py-0.5 text-xs rounded-md border border-[#4736f1] bg-[#17133b] text-[#bfbdf8] dark:border-[#4736f1] dark:bg-[#17133b] dark:text-[#bfbdf8]">{t.tag} ×{t.count}</span>
                  ))}
                </div>
                  );
                }
                // Gratitude only
                if (intentKey === 'gratitude' && Array.isArray(result.stats.gratitude_items) && result.stats.gratitude_items.length > 0) {
                  return (
                    <ul className="list-disc pl-5 text-xs text-foreground/85 space-y-1">
                      {result.stats.gratitude_items.map((g: any, idx: number) => (
                        <li key={`${g.date}-${idx}`}>{g.text}</li>
                      ))}
                    </ul>
                  );
                }
                // Moods/count: show only the single most frequent mood (smart highlight), not full breakdown
                if ((intentKey === 'moods' || intentKey === 'count' || intentKey === 'trend' || intentKey === 'summary') && result.stats.mood_counts) {
                  const mc = result.stats.mood_counts as Record<number, number>;
                  let bestK: 1|2|3|4|5 = 3; let bestV = -1;
                  ([5,4,3,2,1] as (1|2|3|4|5)[]).forEach(k => { const v = (mc as any)[k] || 0; if (v > bestV) { bestV = v; bestK = k; } });
                  if (bestV <= 0) return null;
                  return (
                    <div className="inline-flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-md border border-[#4736f1] bg-[#17133b] text-[#e7e6ff] dark:border-[#4736f1] dark:bg-[#17133b] dark:text-[#e7e6ff]">
                        Top mood: {moodNames[bestK]} ({bestV})
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
          {/* Summary & Tip */}
          {result.summary && <div className="text-sm text-foreground/90">📝 {result.summary}</div>}
          {result.tips && (
            <div className="mt-2 text-[13px] text-muted-foreground">💡 {result.tips}</div>
          )}
        </div>
      )}
    </div>
  );
};
