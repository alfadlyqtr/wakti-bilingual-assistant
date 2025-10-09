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
  const [lastCheckin, setLastCheckin] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const checkins = await JournalService.getCheckinsSince(30);
        // Get the most recent check-in
        if (checkins.length > 0) {
          setLastCheckin(checkins[0]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mood = lastCheckin?.mood_value as MoodValue | null;
  const tags = lastCheckin?.tags || [];
  const time = lastCheckin?.occurred_at ? new Date(lastCheckin.occurred_at) : null;

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold">{language === 'ar' ? 'آخر دخول' : 'Last Entry'}</div>
        </div>
        <div className="text-sm text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  if (!lastCheckin) {
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
        {time && (
          <div className="text-xs opacity-70">[{formatTime(time)}]</div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-3">
        {mood && <MoodFace value={mood} active size={36} />}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {tags.slice(0, 4).map((tag: string) => (
            <span key={tag} className="chip-3d flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border">
              <TagIcon id={tag} className="h-4 w-4" />
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      <Button size="sm" onClick={() => navigate('/journal')} className="w-full">
        {language === 'ar' ? 'فتح الدفتر' : 'Open Journal'}
      </Button>
    </div>
  );
};
