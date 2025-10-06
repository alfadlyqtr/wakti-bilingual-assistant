import React, { useEffect, useMemo, useState } from "react";
import { JournalService, JournalDay } from "@/services/journalService";
import { useTheme } from "@/providers/ThemeProvider";

// Lightweight charts using simple divs for Phase 1 (no extra deps)
export const ChartsTab: React.FC = () => {
  const { language } = useTheme();
  const [items, setItems] = useState<JournalDay[]>([]);

  useEffect(() => {
    (async () => {
      const data = await JournalService.getTimeline(30);
      setItems(data);
    })();
  }, []);

  const moodCounts = useMemo(() => {
    const c: Record<number, number> = { 1:0,2:0,3:0,4:0,5:0 };
    for (const d of items) {
      if (d.mood_value) c[d.mood_value] = (c[d.mood_value] || 0) + 1;
    }
    return c;
  }, [items]);

  const topTags = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of items) {
      for (const t of d.tags || []) map[t] = (map[t] || 0) + 1;
    }
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,8);
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="journal-card p-4">
        <div className="text-sm mb-3 text-muted-foreground">{language === 'ar' ? 'عداد المزاج (آخر 30 يوماً)' : 'Mood Count (last 30 days)'}</div>
        <div className="grid grid-cols-5 gap-3">
          {[1,2,3,4,5].map(v => (
            <div key={v} className="text-center">
              <div className="text-3xl mb-1">{["","😡","😞","😐","🙂","😀"][v]}</div>
              <div className="text-sm font-semibold">{moodCounts[v] || 0}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="journal-card p-4">
        <div className="text-sm mb-3 text-muted-foreground">{language === 'ar' ? 'أكثر الوسوم' : 'Top Activities'}</div>
        <div className="flex flex-wrap gap-2">
          {topTags.length === 0 && <div className="text-muted-foreground text-sm">{language === 'ar' ? 'لا توجد بيانات' : 'No data'}</div>}
          {topTags.map(([tag, count]) => (
            <div key={tag} className="tag-chip px-3 py-1 text-sm active">{tag.replace('_',' ')} <span className="opacity-70">×{count}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
};
