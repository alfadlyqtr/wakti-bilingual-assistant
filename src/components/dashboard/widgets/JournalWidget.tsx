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
  const [lastEntry, setLastEntry] = useState<JournalDay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const timeline = await JournalService.getTimeline(30);
        // Get the most recent entry
        if (timeline.length > 0) {
          setLastEntry(timeline[0]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mood = lastEntry?.mood_value as MoodValue | null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="text-sm text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  if (!lastEntry) {
    return (
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">{language === 'ar' ? 'آخر دخول' : 'Last Entry'}</div>
        </div>
        <div className="text-sm text-muted-foreground mb-4">{language === 'ar' ? 'لا توجد إدخالات' : 'No entries yet'}</div>
        <Button size="sm" onClick={() => navigate('/journal')} className="w-full">{language === 'ar' ? 'ابدأ الكتابة' : 'Start Writing'}</Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">{language === 'ar' ? 'آخر دخول' : 'Last Entry'}</div>
        <div className="text-xs opacity-70">{lastEntry.date}</div>
      </div>

      <div className="flex items-center gap-3 mb-3">
        {mood ? (
          <>
            <MoodFace value={mood} active size={36} />
            <div className="text-sm capitalize">{moodLabels[mood]}</div>
          </>
        ) : (
          <div className="text-sm text-muted-foreground">{language === 'ar' ? 'بدون مزاج' : 'No mood'}</div>
        )}
      </div>

      {lastEntry?.tags?.length ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {lastEntry.tags.slice(0, 4).map(t => (
            <span key={t} className="chip-3d flex items-center gap-1 px-2 py-1 rounded-lg text-xs border">
              <TagIcon id={t} className="h-3 w-3" />
              {t.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      ) : null}

      {lastEntry?.note && (
        <div className="text-sm line-clamp-2 mb-3 text-muted-foreground">
          {lastEntry.note}
        </div>
      )}

      <Button size="sm" onClick={() => navigate('/journal')} className="w-full">
        {language === 'ar' ? 'فتح الدفتر' : 'Open Journal'}
      </Button>
    </div>
  );
};
