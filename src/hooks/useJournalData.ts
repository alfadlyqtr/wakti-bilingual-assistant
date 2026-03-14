import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useJournalData() {
  const { user } = useAuth();
  const [data, setData] = useState<{
    hasEntry: boolean;
    mood: number | null;
    lastUpdated: Date | null;
  }>({
    hasEntry: false,
    mood: null,
    lastUpdated: null,
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        const { data: entry } = await supabase
          .from("journal_entries")
          .select("id, mood_value, created_at")
          .eq("user_id", user.id)
          .eq("date", today)
          .maybeSingle();

        setData({
          hasEntry: !!entry,
          mood: entry?.mood_value ?? null,
          lastUpdated: entry?.created_at ? new Date(entry.created_at) : null,
        });
      } catch (error) {
        console.error("Error fetching journal data:", error);
      }
    };

    fetchData();
  }, [user]);

  return data;
}
