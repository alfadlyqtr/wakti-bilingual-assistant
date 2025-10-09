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

  if (loading || !lastCheckin) {
    return (
      <div 
        className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background p-4 shadow-md card-3d inner-bevel edge-liquid cursor-pointer hover:shadow-lg transition-shadow"
        onClick={() => navigate('/journal')}
      >
        <div className="text-sm text-muted-foreground text-center">
          {loading ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...') : (language === 'ar' ? 'لا توجد إدخالات' : 'No entries yet')}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="rounded-2xl border border-border/50 bg-gradient-to-b from-card to-background px-4 py-3 shadow-md card-3d inner-bevel edge-liquid cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate('/journal')}
    >
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {/* Time pill */}
        {time && (
          <span className="px-3 py-1.5 rounded-full bg-muted/50 text-xs font-medium flex items-center gap-1.5">
            <span>[{formatTime(time)}]</span>
          </span>
        )}
        
        {/* Mood emoji pill */}
        {mood && (
          <span className="px-2 py-1 rounded-full bg-muted/50 flex items-center">
            <MoodFace value={mood} size={24} />
          </span>
        )}

        {/* Tags pills */}
        {tags.slice(0, 3).map((tag: string) => (
          <span key={tag} className="px-3 py-1.5 rounded-full bg-primary/10 text-xs font-medium flex items-center gap-1.5">
            <TagIcon id={tag} className="h-3.5 w-3.5" />
            {tag.replace(/_/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
};
