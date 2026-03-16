import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface JournalDayEntry {
  date: string;
  mood_value: number | null;
  note: string | null;
  morning_reflection: string | null;
  evening_reflection: string | null;
  created_at: string;
}

export interface JournalWidgetData {
  hasEntry: boolean;
  mood: number | null;
  lastUpdated: Date | null;
  todayEntry: JournalDayEntry | null;
  currentStreak: number;
  bestStreak: number;
  history: { date: string; mood: number }[]; // last 6 months of entries
}

function computeStreaks(dates: string[]): { current: number; best: number } {
  if (!dates.length) return { current: 0, best: 0 };
  const sorted = [...dates].sort();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else { cur = 1; }
  }

  // Current streak: must include today or yesterday
  const last = sorted[sorted.length - 1];
  if (last !== today && last !== yesterday) cur = 0;
  else {
    cur = 1;
    for (let i = sorted.length - 2; i >= 0; i--) {
      const next = new Date(sorted[i + 1]);
      const curr = new Date(sorted[i]);
      if ((next.getTime() - curr.getTime()) / 86400000 === 1) cur++;
      else break;
    }
  }

  return { current: cur, best: Math.max(best, cur) };
}

export function useJournalData(): JournalWidgetData {
  const { user } = useAuth();
  const [data, setData] = useState<JournalWidgetData>({
    hasEntry: false,
    mood: null,
    lastUpdated: null,
    todayEntry: null,
    currentStreak: 0,
    bestStreak: 0,
    history: [],
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

        const { data: entries } = await supabase
          .from("journal_entries")
          .select("id, date, mood_value, note, morning_reflection, evening_reflection, created_at")
          .eq("user_id", user.id)
          .gte("date", sixMonthsAgoStr)
          .order("date", { ascending: true });

        const all = (entries ?? []) as JournalDayEntry[];
        const todayEntry = all.find(e => e.date === today) ?? null;
        const { current, best } = computeStreaks(all.map(e => e.date));

        setData({
          hasEntry: !!todayEntry,
          mood: todayEntry?.mood_value ?? null,
          lastUpdated: todayEntry?.created_at ? new Date(todayEntry.created_at) : null,
          todayEntry,
          currentStreak: current,
          bestStreak: best,
          history: all
            .filter(e => e.mood_value !== null)
            .map(e => ({ date: e.date, mood: e.mood_value as number })),
        });
      } catch (error) {
        console.error("Error fetching journal data:", error);
      }
    };

    fetchData();
  }, [user]);

  return data;
}
