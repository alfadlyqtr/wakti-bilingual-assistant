import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { JournalService, JournalDay } from "@/services/journalService";
import { Button } from "@/components/ui/button";
import { MoodFace, moodLabels, MoodValue } from "@/components/journal/icons/MoodFaces";
import { TagIcon } from "@/components/journal/TagIcon";

function getLocalDayString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export const JournalWidget: React.FC = () => {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [day, setDay] = useState<JournalDay | null>(null);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => getLocalDayString(), []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const d = await JournalService.getDay(today);
        setDay(d);
      } finally {
        setLoading(false);
      }
    })();
  }, [today]);

  const mood = day?.mood_value as MoodValue | null;
  const hasEvening = Boolean(day?.evening_reflection);

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">{language === 'ar' ? 'دفتر اليوم' : 'Today\'s Journal'}</div>
        <div className="text-xs opacity-70">{today}</div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        {mood ? <MoodFace value={mood} active size={40} /> : <div className="text-sm text-muted-foreground">{language === 'ar' ? 'بدون مزاج' : 'No mood yet'}</div>}
        {mood && <div className="text-sm">{language === 'ar' ? '' : moodLabels[mood]}</div>}
      </div>

      {day?.tags?.length ? (
        <div className="flex flex-wrap gap-2 mb-3">
          {day.tags.slice(0, 8).map(t => (
            <span key={t} className="chip-3d flex items-center gap-1 px-2 py-1 rounded-lg text-xs border">
              <TagIcon id={t} className="h-3.5 w-3.5" />
              {t.replace('_',' ')}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground mb-3">{language === 'ar' ? 'لا وسوم' : 'No tags yet'}</div>
      )}

      <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'ملاحظة' : 'Note'}</div>
      <div className="text-sm line-clamp-2 mb-4">
        {day?.note || (language === 'ar' ? '—' : '—')}
      </div>

      <div className="flex gap-2 justify-end">
        {!hasEvening && (
          <Button size="sm" variant="secondary" onClick={() => navigate('/journal?focus=evening')}>
            {language === 'ar' ? 'أكمل الليلة' : 'Continue Tonight'}
          </Button>
        )}
        <Button size="sm" onClick={() => navigate('/journal')}>{language === 'ar' ? 'فتح' : 'Open'}</Button>
      </div>
    </div>
  );
};
