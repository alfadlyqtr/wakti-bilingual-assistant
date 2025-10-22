import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";

export default function JoinGame() {
  const { user } = useAuth();
  const { language } = useTheme();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);

  const isArabic = useMemo(() => language === "ar", [language]);
  const t = (en: string, ar: string) => (isArabic ? ar : en);

  function onChange(v: string) {
    // Uppercase and strip spaces; must start with W
    let s = (v || "").toUpperCase().replace(/\s+/g, "");
    setCode(s);
  }

  async function handleJoin() {
    try {
      if (!user) {
        toast.error(t("Please sign in first.", "يرجى تسجيل الدخول أولاً."));
        return;
      }
      if (!code || code.length !== 6 || !code.startsWith("W")) {
        toast.error(t("Enter a 6-character code starting with W.", "أدخل رمزاً من 6 أحرف يبدأ بحرف W."));
        return;
      }
      setJoining(true);

      const { data: game, error: gErr } = await supabase
        .from("letters_games")
        .select("id, status")
        .eq("code", code)
        .single();
      if (gErr || !game) throw new Error(t("Game not found.", "اللعبة غير موجودة."));
      if (game.status === "ended") throw new Error(t("Game has ended.", "انتهت اللعبة."));

      // Load current players to pick next seat
      const { data: players, error: pErr } = await supabase
        .from("letters_players")
        .select("id, seat_index")
        .eq("game_id", game.id)
        .order("seat_index", { ascending: true });
      if (pErr) throw pErr;

      const used = new Set((players || []).map(p => p.seat_index));
      let seat = -1;
      for (let i = 0; i < 5; i++) { if (!used.has(i)) { seat = i; break; } }
      if (seat === -1) throw new Error(t("Game is full.", "الغرفة ممتلئة."));

      // Upsert: if already joined before with same user, reuse seat (idempotent)
      const profileName = user.user_metadata?.full_name || user.email || "You";
      const avatar = user.user_metadata?.avatar_url || null;
      const { error: insertErr } = await supabase
        .from("letters_players")
        .insert({
          game_id: game.id,
          user_id: user.id,
          display_name: profileName,
          avatar_url: avatar,
          is_ai: false,
          seat_index: seat
        });
      if (insertErr && !insertErr.message?.includes("duplicate")) throw insertErr;

      toast.success(t("Joined!", "تم الانضمام!"));
      navigate(`/letters/play?code=${code}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t("Failed to join", "فشل الانضمام"));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">{t("Letters • Join Game","لعبة الحروف • انضم إلى لعبة")}</h1>
      <label className="block text-sm font-medium mb-1">{t("Enter Code","أدخل الرمز")}</label>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e)=>onChange(e.target.value)}
          placeholder="W_____"
          className="flex-1 px-3 py-2 rounded border font-mono tracking-widest"
          maxLength={6}
        />
        <button disabled={joining} onClick={handleJoin} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">
          {joining ? t("Joining…","جاري الانضمام…") : t("Join","انضم")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{t("Code must start with W","يجب أن يبدأ الرمز بحرف W")}</p>
    </div>
  );
}
