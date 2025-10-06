import React, { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { JournalService } from "@/services/journalService";

export const AskTab: React.FC = () => {
  const { language } = useTheme();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const ask = async () => {
    if (!q.trim()) return;
    try {
      setLoading(true);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const data = await JournalService.ask(q.trim(), language as any, tz);
      setResult(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="journal-card p-3 flex gap-2">
        <Input className="flex-1 input-enhanced" value={q} onChange={e => setQ(e.target.value)} placeholder={language === 'ar' ? 'اسأل دفترك...' : 'Ask your journal...'} onKeyDown={e => { if (e.key === 'Enter') ask(); }} />
        <Button onClick={ask} disabled={loading} className="btn-shine" data-saving={loading ? 'true' : 'false'}>{loading ? (language === 'ar' ? 'جارٍ...' : 'Asking...') : (language === 'ar' ? 'اسأل' : 'Ask')}</Button>
      </div>

      {result && (
        <div className="journal-card p-4">
          <div className="text-sm text-muted-foreground mb-2">{language === 'ar' ? 'الإجابة' : 'Answer'}</div>
          {result.question && <div className="text-sm mb-2">❓ {result.question}</div>}
          {result.stats && (
            <div className="text-sm mb-2">
              <div className="font-medium mb-1">{language === 'ar' ? 'إحصائيات' : 'Stats'}</div>
              {result.stats.mood_counts && (
                <div className="flex gap-3 text-sm">
                  <div>😀 {result.stats.mood_counts[5] || 0}</div>
                  <div>🙂 {result.stats.mood_counts[4] || 0}</div>
                  <div>😐 {result.stats.mood_counts[3] || 0}</div>
                  <div>😞 {result.stats.mood_counts[2] || 0}</div>
                  <div>😡 {result.stats.mood_counts[1] || 0}</div>
                </div>
              )}
              {Array.isArray(result.stats.most_common_tags) && result.stats.most_common_tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {result.stats.most_common_tags.map((t: any) => (
                    <span key={t.tag} className="tag-chip active px-2 py-0.5 text-xs">{t.tag} ×{t.count}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          {result.summary && <div className="text-sm">📝 {result.summary}</div>}
        </div>
      )}
    </div>
  );
};
