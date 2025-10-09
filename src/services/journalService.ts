import { supabase } from "@/integrations/supabase/client";

export type JournalDay = {
  id: string;
  user_id: string;
  date: string; // yyyy-MM-dd local day string
  mood_value: number | null;
  tags: string[];
  note: string | null;
  morning_reflection: string | null;
  evening_reflection: string | null;
  gratitude_1: string | null;
  gratitude_2: string | null;
  gratitude_3: string | null;
  created_at?: string;
  updated_at?: string;
};

export type JournalCheckin = {
  id: string;
  user_id: string;
  date: string; // yyyy-MM-dd
  occurred_at: string;
  mood_value: number;
  tags: string[];
  note: string | null;
};

export const JournalService = {
  async getDay(date: string) {
    const { data, error } = await supabase
      .from("journal_days")
      .select("*")
      .eq("date", date)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async updateCheckinTags(id: string, tags: string[]) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) throw new Error("not_authenticated");
    const { data, error } = await supabase
      .from("journal_checkins")
      .update({ tags })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as JournalCheckin;
  },

  async upsertDay(payload: Omit<JournalDay, "id" | "created_at" | "updated_at" | "user_id">) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) throw new Error("not_authenticated");
    const { data, error } = await supabase
      .from("journal_days")
      .upsert({ user_id: user.id, ...payload }, { onConflict: "user_id,date" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async deleteLastCheckin(date: string, mood_value: number) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) throw new Error("not_authenticated");
    // Find latest checkin id for this date + mood
    const { data: found, error: findErr } = await supabase
      .from("journal_checkins")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", date)
      .eq("mood_value", mood_value)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!found?.id) return false;
    const { error: delErr } = await supabase
      .from("journal_checkins")
      .delete()
      .eq("id", found.id)
      .eq("user_id", user.id);
    if (delErr) throw delErr;
    return true;
  },

  async updateCheckinNote(id: string, note: string | null) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) throw new Error("not_authenticated");
    const { data, error } = await supabase
      .from("journal_checkins")
      .update({ note })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as JournalCheckin;
  },

  async getCheckinsForDay(date: string) {
    const { data, error } = await supabase
      .from("journal_checkins")
      .select("*")
      .eq("date", date)
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    return (data || []) as JournalCheckin[];
  },

  async getCheckinsSince(lastNDays = 60) {
    const since = new Date();
    since.setDate(since.getDate() - lastNDays);
    const yyyy = since.getFullYear();
    const mm = String(since.getMonth() + 1).padStart(2, "0");
    const dd = String(since.getDate()).padStart(2, "0");
    const sinceStr = `${yyyy}-${mm}-${dd}`;
    const { data, error } = await supabase
      .from("journal_checkins")
      .select("*")
      .gte("date", sinceStr)
      .order("date", { ascending: false })
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    return (data || []) as JournalCheckin[];
  },

  async addCheckin(payload: Omit<JournalCheckin, "id" | "user_id" | "occurred_at">) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) throw new Error("not_authenticated");
    const { data, error } = await supabase
      .from("journal_checkins")
      .insert({ user_id: user.id, occurred_at: new Date().toISOString(), ...payload })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async getTimeline(limitDays = 60) {
    // last N days of journal_days
    const since = new Date();
    since.setDate(since.getDate() - limitDays);
    const yyyy = since.getFullYear();
    const mm = String(since.getMonth() + 1).padStart(2, "0");
    const dd = String(since.getDate()).padStart(2, "0");
    const sinceStr = `${yyyy}-${mm}-${dd}`;
    const { data, error } = await supabase
      .from("journal_days")
      .select("*")
      .gte("date", sinceStr)
      .order("date", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getCalendarOverlay(lastNDays = 60) {
    const since = new Date();
    since.setDate(since.getDate() - lastNDays);
    const yyyy = since.getFullYear();
    const mm = String(since.getMonth() + 1).padStart(2, "0");
    const dd = String(since.getDate()).padStart(2, "0");
    const sinceStr = `${yyyy}-${mm}-${dd}`;
    const { data, error } = await supabase
      .from("journal_calendar_view")
      .select("date, mood_value")
      .gte("date", sinceStr);
    if (error) throw error;
    return (data || []) as { date: string; mood_value: number | null }[];
  },

  async ask(question: string, language: "en" | "ar", user_timezone: string) {
    const { data, error } = await supabase.functions.invoke("journal-qa", {
      body: { question, language, user_timezone }
    });
    if (error) throw error;
    return data;
  }
};
