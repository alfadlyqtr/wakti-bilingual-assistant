import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { JournalService } from "@/services/journalService";
import { Button } from "@/components/ui/button";
import { MoodFace, MoodValue } from "@/components/journal/icons/MoodFaces";
import { TagIcon } from "@/components/journal/TagIcon";
import { Hand, Clock } from "lucide-react";

function getLocalDayString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export const JournalWidget: React.FC = () => {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [lastTwo, setLastTwo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const checkins = await JournalService.getCheckinsSince(30);
        const sorted = [...checkins].sort((a, b) => {
          const ta = a.occurred_at ? new Date(a.occurred_at).getTime() : 0;
          const tb = b.occurred_at ? new Date(b.occurred_at).getTime() : 0;
          return tb - ta;
        });
        setLastTwo(sorted.slice(0, 2));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  };

  const Row = ({ ci }: { ci: any }) => {
    const mood = ci?.mood_value as MoodValue | null;
    const tags: string[] = ci?.tags || [];
    const time = ci?.occurred_at ? new Date(ci.occurred_at) : null;
    return (
      <div className="w-full rounded-full border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {time && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-xs text-foreground/90 shadow-sm">
              <span>[{formatTime(time)}]</span>
              <Clock className="h-3.5 w-3.5 opacity-70" />
            </span>
          )}
          {mood && (
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/90 px-1.5 py-0.5 shadow-sm">
              <MoodFace value={mood} size={22} />
            </span>
          )}
          {tags.slice(0, 6).map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-xs text-foreground/90 shadow-sm">
              <TagIcon id={t} className="h-5 w-5" />
              {t.replace(/_/g, ' ')}
            </span>
          ))}
          {ci?.note && (
            <span className="inline-flex items-center rounded-full border border-border/70 bg-background/90 px-2 py-0.5 text-xs text-foreground/90 max-w-full truncate shadow-sm">
              {ci.note}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative group" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Glass layers to match other widgets */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 rounded-xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/15 via-transparent to-purple-500/15 rounded-xl"></div>

      {/* Drag handle */}
      <div className={`absolute top-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 bg-primary/20 border-primary/30 cursor-grab active:cursor-grabbing scale-110 ${language === 'ar' ? 'right-2' : 'left-2'}`}>
        <Hand className="h-3 w-3 text-primary/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="mb-3">
          <h3 className="font-semibold text-lg bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            {language === 'ar' ? 'دفتر اليوم' : "Today's Journal"}
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : lastTwo.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">{language === 'ar' ? 'لا توجد إدخالات' : 'No entries yet'}</div>
        ) : (
          <div className="space-y-3">
            {lastTwo.map((ci) => (
              <Row key={ci.id || ci.occurred_at} ci={ci} />
            ))}
          </div>
        )}

        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/journal')}
            className="w-full border bg-primary/10 backdrop-blur-sm border-primary/30 hover:bg-primary/20 text-foreground transition-all duration-300"
          >
            {language === 'ar' ? 'فتح' : 'Open'}
          </Button>
        </div>
      </div>
    </div>
  );
};
