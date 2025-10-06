import React, { useEffect, useState } from "react";
import { JournalService, JournalDay } from "@/services/journalService";
import { useTheme } from "@/providers/ThemeProvider";

export const TimelineTab: React.FC = () => {
  const { language } = useTheme();
  const [items, setItems] = useState<JournalDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await JournalService.getTimeline(60);
        setItems(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-muted-foreground">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</div>;

  if (!items.length) return (
    <div className="journal-card p-6 text-center text-muted-foreground">
      {language === 'ar' ? 'لا توجد إدخالات بعد' : 'No entries yet'}
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map((d) => (
        <div key={d.id} className="journal-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">{d.date}</div>
            <div className="text-2xl">{[null,'😡','😞','😐','🙂','😀'][d.mood_value ?? 0]}</div>
          </div>
          {d.tags && d.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {d.tags.map(t => (
                <span key={t} className="tag-chip px-3 py-0.5 text-xs">{t.replace('_',' ')}</span>
              ))}
            </div>
          )}
          {d.morning_reflection && <div className="text-sm">{d.morning_reflection}</div>}
          {d.evening_reflection && <div className="text-sm mt-1">{d.evening_reflection}</div>}
          {d.note && <div className="text-sm mt-1 italic opacity-80">{d.note}</div>}
        </div>
      ))}
    </div>
  );
};
