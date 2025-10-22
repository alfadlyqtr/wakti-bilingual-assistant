import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";

type Category = "person" | "place" | "plant" | "thing" | "animal";

function normalize(enOrAr: "en"|"ar", value: string): string {
  let v = (value || "").trim();
  if (enOrAr === "en") return v.toLowerCase();
  // basic Arabic normalization: remove diacritics and normalize taa marbuta/ya forms
  v = v.replace(/[\u064B-\u0652]/g, ""); // remove tashkeel
  v = v.replace(/ة/g, "ه");
  v = v.replace(/ى/g, "ي");
  return v;
}

export default function PlayRound() {
  const [params] = useSearchParams();
  const code = params.get("code") || "";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useTheme();
  const [loading, setLoading] = useState(true);

  const [game, setGame] = useState<any>(null);
  const [round, setRound] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);

  const [answers, setAnswers] = useState<Record<Category, string>>({
    person: "",
    place: "",
    plant: "",
    thing: "",
    animal: "",
  });

  const isArabicUI = useMemo(() => language === "ar", [language]);
  const t = (en: string, ar: string) => (isArabicUI ? ar : en);

  useEffect(() => {
    (async () => {
      try {
        if (!user) return; // Auth gate; App enforces layout
        if (!code || code.length !== 6 || !code.startsWith("W")) {
          toast.error(t("Invalid code.", "رمز غير صالح."));
          return;
        }
        // Load game
        const { data: g, error: gErr } = await supabase
          .from("letters_games")
          .select("id, code, lang, timer_sec, rounds_target, speed_bonus_enabled, status")
          .eq("code", code)
          .single();
        if (gErr || !g) throw gErr || new Error("Game not found");
        setGame(g);

        // Load current playing round (max round_number with status playing)
        const { data: r, error: rErr } = await supabase
          .from("letters_rounds")
          .select("id, game_id, round_number, letter, start_at, duration_sec, status")
          .eq("game_id", g.id)
          .order("round_number", { ascending: false })
          .limit(1)
          .single();
        if (rErr || !r) throw rErr || new Error("Round not found");
        setRound(r);

        // Load player record
        const { data: p, error: pErr } = await supabase
          .from("letters_players")
          .select("id, display_name, seat_index")
          .eq("game_id", g.id)
          .eq("user_id", user.id)
          .single();
        if (pErr || !p) throw pErr || new Error("You are not a player in this game");
        setPlayer(p);

        // Setup countdown
        const start = r.start_at ? new Date(r.start_at).getTime() : Date.now();
        const end = start + (r.duration_sec * 1000);
        const tick = () => {
          const now = Date.now();
          setTimeLeft(Math.max(0, Math.ceil((end - now) / 1000)));
          if (now >= end) {
            // Hard lock
            setSubmitted(true);
          }
        };
        tick();
        const iv = setInterval(tick, 250);
        return () => clearInterval(iv);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || t("Failed to load round", "فشل تحميل الجولة"));
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, user?.id]);

  // Realtime channel subscription for this game code
  useEffect(() => {
    if (!code) return;
    const channel = supabase.channel(`letters:game:${code}`);
    const onBroadcast = (payload: any) => {
      const { event, payload: data } = payload as any;
      if (event === 'round_start') {
        // Sync round info and reset inputs if round number changes
        setRound((prev: any) => ({
          ...(prev || {}),
          round_number: data.round_number,
          letter: data.letter,
          start_at: data.start_at,
          duration_sec: data.duration_sec,
          status: 'playing',
        }));
        setSubmitted(false);
        setAnswers({ person: "", place: "", plant: "", thing: "", animal: "" });
      } else if (event === 'navigate' && data?.to === 'results') {
        navigate(`/letters/results?code=${code}`);
      } else if (event === 'game_end') {
        navigate(`/letters/end?code=${code}`);
      }
    };
    channel.on('broadcast', { event: 'round_start' }, onBroadcast);
    channel.on('broadcast', { event: 'navigate' }, onBroadcast);
    channel.on('broadcast', { event: 'game_end' }, onBroadcast);
    channel.subscribe();
    return () => { channel.unsubscribe(); };
  }, [code, navigate]);

  function setVal(cat: Category, v: string) {
    setAnswers(a => ({ ...a, [cat]: v }));
  }

  async function handleSubmit() {
    try {
      if (!game || !round || !player) return;
      if (submitted) return;
      const langNorm = game.lang as "ar" | "en";

      const rows = (Object.keys(answers) as Category[]).map((cat) => ({
        round_id: round.id,
        player_id: player.id,
        category: cat,
        value_raw: answers[cat] || null,
        value_norm: answers[cat] ? normalize(langNorm, answers[cat]) : null,
        is_submitted: true
      }));

      // Insert answers; unique constraint handles idempotency per category
      const { error: aErr } = await supabase.from("letters_answers").insert(rows);
      if (aErr) throw aErr;
      setSubmitted(true);
      toast.success(t("Submitted!","تم الإرسال!"));

      // Broadcast navigate to results so VS AI flow proceeds immediately
      const channel = supabase.channel(`letters:game:${game.code}`);
      channel.subscribe((status)=>{
        if (status === 'SUBSCRIBED') {
          channel.send({ type:'broadcast', event:'navigate', payload:{ to:'results' }});
          channel.unsubscribe();
        }
      });
      navigate(`/letters/results?code=${game.code}`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || t("Failed to submit","فشل الإرسال"));
    }
  }

  if (loading) {
    return <div className="p-4"><p className="text-muted-foreground">{t("Loading…","جاري التحميل…")}</p></div>;
  }
  if (!game || !round) {
    return <div className="p-4"><p className="text-red-500">{t("Game not available","اللعبة غير متاحة")}</p></div>;
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold">{t("Play Round","العب الجولة")}</h1>
        <div className="text-lg font-mono">⏱ {timeLeft}s</div>
      </div>
      <div className="glass-hero p-4 rounded-xl mb-4">
        <div className="text-sm text-muted-foreground">{t("Letter","الحرف")}</div>
        <div className="text-4xl font-extrabold tracking-wide">{round.letter}</div>
      </div>

      <div className={`space-y-3 ${submitted ? 'opacity-60 pointer-events-none' : ''}`}>
        <Field label={t("Person","اسم شخص")} value={answers.person} onChange={(v)=>setVal('person', v)} />
        <Field label={t("Place","مكان")} value={answers.place} onChange={(v)=>setVal('place', v)} />
        <Field label={t("Plant","نبات")} value={answers.plant} onChange={(v)=>setVal('plant', v)} />
        <Field label={t("Thing","شيء")} value={answers.thing} onChange={(v)=>setVal('thing', v)} />
        <Field label={t("Animal","حيوان")} value={answers.animal} onChange={(v)=>setVal('animal', v)} />
      </div>

      <div className="pt-4 flex gap-2">
        <button disabled={submitted} onClick={handleSubmit} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">
          {submitted ? t("Submitted","تم الإرسال") : t("Submit","إرسال")}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">{t("Answers are hidden until the round ends.","الإجابات مخفية حتى نهاية الجولة.")}</p>
    </div>
  );
}

function Field({ label, value, onChange }:{ label:string; value:string; onChange:(v:string)=>void }){
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input value={value} onChange={(e)=>onChange(e.target.value)} className="w-full px-3 py-2 rounded border" />
    </div>
  );
}
