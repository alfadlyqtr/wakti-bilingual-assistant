import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/providers/ThemeProvider";
import { generateGameCode } from "@/utils/letters/code";
import { toast } from "sonner";

type Lang = "ar" | "en";

const EN_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const AR_LETTERS = [
  "ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","و","ي"
];

function randomLetter(lang: Lang) {
  const pool = lang === "ar" ? AR_LETTERS : EN_LETTERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function CreateGame() {
  const { user } = useAuth();
  const { language } = useTheme();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const aiParam = searchParams.get('ai');
  const diffParam = searchParams.get('diff') as 'easy'|'medium'|'hard'|'auto'|null;
  const roundsParam = parseInt(searchParams.get('rounds') || '');
  const timerParam = parseInt(searchParams.get('timer') || '');

  const [lang, setLang] = useState<Lang>(language === "ar" ? "ar" : "en");
  const [timer, setTimer] = useState<number>(timerParam===90?90:60);
  const [rounds, setRounds] = useState<number>(roundsParam===3?3:1);
  const [speedBonus, setSpeedBonus] = useState<boolean>(false);
  const [code, setCode] = useState<string>(generateGameCode());
  const [creating, setCreating] = useState<boolean>(false);
  const [createdGame, setCreatedGame] = useState<any>(null);
  const [letterMode, setLetterMode] = useState<'auto'|'pick'>('auto');
  const [pickedLetter, setPickedLetter] = useState<string>('');
  const [aiEnabled, setAiEnabled] = useState<boolean>(aiParam === '1');
  const [aiDifficulty, setAiDifficulty] = useState<'easy'|'medium'|'hard'|'auto'>(diffParam || 'medium');

  const isArabic = useMemo(() => lang === "ar", [lang]);

  const t = (en: string, ar: string) => (isArabic ? ar : en);

  async function handleCreate() {
    try {
      if (!user) { toast.error(t("Please sign in first.", "يرجى تسجيل الدخول أولاً.")); return; }
      setCreating(true);
      const { data: game, error: gameErr } = await supabase.rpc("letters_create_game", {
        p_lang: lang,
        p_timer_sec: timer,
        p_rounds_target: rounds,
        p_speed_bonus_enabled: speedBonus,
      });
      if (game && game.code) setCode(game.code);
      if (gameErr) throw gameErr;
      const displayName = user.user_metadata?.full_name || user.email || "You";
      const avatar_url = user.user_metadata?.avatar_url || null;
      const { error: playerErr } = await supabase.from("letters_players").insert({
        game_id: game.id,
        user_id: user.id,
        display_name: displayName,
        avatar_url,
        is_ai: false,
        seat_index: 0,
      });
      if (playerErr) throw playerErr;
      if (aiEnabled) {
        const { error: aiErr } = await supabase.from("letters_players").insert({
          game_id: game.id,
          user_id: null,
          display_name: (lang==='ar'? `واكتي (ذكاء اصطناعي ${aiDifficulty})` : `Wakti (AI ${aiDifficulty})`),
          avatar_url: null,
          is_ai: true,
          seat_index: 1,
          ai_difficulty: aiDifficulty,
        } as any);
        if (aiErr) throw aiErr;
      }
      setCreatedGame(game);
      toast.success(t("Game created. Pick a letter, then Start Round.", "تم إنشاء اللعبة. اختر حرفًا ثم ابدأ الجولة."));
    } catch (e:any) {
      console.error(e); toast.error(e?.message || t("Failed to create game", "فشل إنشاء اللعبة"));
    } finally { setCreating(false); }
  }

  async function handleStartRound() {
    try {
      if (!createdGame) return;
      const letter = letterMode === 'pick' && pickedLetter ? pickedLetter : randomLetter(lang);
      const startedAt = new Date().toISOString();
      const { error: roundErr } = await supabase.from("letters_rounds").insert({
        game_id: createdGame.id,
        round_number: 1,
        letter,
        duration_sec: timer,
        start_at: startedAt,
        status: "playing",
      });
      if (roundErr) throw roundErr;
      const channel = supabase.channel(`letters:game:${createdGame.code}`);
      channel.subscribe((status)=>{ if (status==='SUBSCRIBED'){ channel.send({ type:'broadcast', event:'round_start', payload:{ round_number:1, letter, start_at: startedAt, duration_sec: timer }}); channel.unsubscribe(); } });
      navigate(`/letters/play?code=${createdGame.code}`);
    } catch (e:any) { console.error(e); toast.error(e?.message || t("Failed to start round","فشل بدء الجولة")); }
  }

  async function handleStartVsAI() {
    try {
      if (!user) { toast.error(t("Please sign in first.", "يرجى تسجيل الدخول أولاً.")); return; }
      setCreating(true);
      if (!aiEnabled) { toast.error(t("Enable Play vs AI first","فعّل اللعب ضد الذكاء الاصطناعي أولاً")); return; }
      const { data: game, error: gameErr } = await supabase.rpc("letters_create_game", {
        p_lang: lang,
        p_timer_sec: timer,
        p_rounds_target: rounds,
        p_speed_bonus_enabled: false,
      });
      if (gameErr || !game) throw gameErr || new Error('create failed');
      const displayName = user.user_metadata?.full_name || user.email || 'You';
      const avatar_url = user.user_metadata?.avatar_url || null;
      const { error: p1Err } = await supabase.from('letters_players').insert({ game_id: game.id, user_id: user.id, display_name: displayName, avatar_url, is_ai: false, seat_index: 0 });
      if (p1Err) throw p1Err;
      const { error: p2Err } = await supabase.from('letters_players').insert({ game_id: game.id, user_id: null, display_name: (lang==='ar'? `واكتي (ذكاء اصطناعي ${aiDifficulty})` : `Wakti (AI ${aiDifficulty})`), avatar_url: null, is_ai: true, seat_index: 1, ai_difficulty: aiDifficulty } as any);
      if (p2Err) throw p2Err;
      const letter = letterMode === 'pick' && pickedLetter ? pickedLetter : randomLetter(lang);
      const startedAt = new Date().toISOString();
      const { error: rErr } = await supabase.from('letters_rounds').insert({ game_id: game.id, round_number: 1, letter, duration_sec: timer, start_at: startedAt, status: 'playing' });
      if (rErr) throw rErr;
      const channel = supabase.channel(`letters:game:${game.code}`);
      channel.subscribe((status)=>{ if (status==='SUBSCRIBED'){ channel.send({ type:'broadcast', event:'round_start', payload:{ round_number:1, letter, start_at: startedAt, duration_sec: timer }}); channel.unsubscribe(); } });

      // Compute delay now and schedule AI submission without blocking navigation (hard earlier, easy later)
      const delayFactor = aiDifficulty === 'easy' ? 0.9 : aiDifficulty === 'hard' ? 0.3 : aiDifficulty === 'auto' ? (0.5 + Math.random() * 0.3) : 0.6;
      const delayMs = Math.max(1000, Math.floor(timer * 1000 * delayFactor));
      setTimeout(async ()=>{
        try {
          // Select AI player id
          const { data: aiRow } = await supabase
            .from('letters_players')
            .select('id')
            .eq('game_id', game.id)
            .eq('is_ai', true)
            .limit(1)
            .single();
          if (!aiRow?.id) return;
          // Fetch round id
          const roundRes = await supabase
            .from('letters_rounds')
            .select('id')
            .eq('game_id', game.id)
            .eq('round_number', 1)
            .limit(1)
            .single();
          const roundId = roundRes.data?.id as string | undefined;
          if (!roundId) return;
          // Build answers based on difficulty
          const categories: Array<'person'|'place'|'plant'|'thing'|'animal'> = ['person','place','plant','thing','animal'];
          const targetCount = aiDifficulty === 'easy' ? 2 : aiDifficulty === 'hard' ? 5 : aiDifficulty === 'auto' ? (3 + Math.floor(Math.random()*3)) : 4;
          const picks = new Set(categories.slice(0).sort(()=>Math.random()-0.5).slice(0, targetCount));

          // 1) Try dictionary RPC for realistic words by letter
          let dict: Record<string,string>|null = null;
          try {
            const { data: djson } = await supabase.rpc('letters_ai_suggest', {
              p_lang: lang,
              p_letter: letter,
              p_categories: Array.from(picks) as any,
              p_pick: targetCount,
            } as any);
            if (djson && typeof djson === 'object'){
              dict = Object.fromEntries(Object.entries(djson as any).map(([k,v])=>[String(k).toLowerCase(), String(v||'')]));
            }
          } catch {}

          // 2) Try DeepSeek for any missing categories
          let deep: any = null;
          try {
            const missing = categories.filter(c=>picks.has(c) && !(dict && dict[c]));
            if (missing.length){
              const { data, error } = await supabase.functions.invoke('letters-ai-generate', {
                body: { lang, letter, difficulty: aiDifficulty }
              });
              if (!error) {
                const rawAns = (data as any)?.answers || null;
                if (rawAns && typeof rawAns === 'object'){
                  deep = Object.fromEntries(Object.entries(rawAns).map(([k,v])=>[String(k).toLowerCase(), v]));
                }
              }
            }
          } catch {}

          const makeWord = (cat:string) => {
            const ds = deep?.[cat];
            if (ds && typeof ds === 'string') return ds;
            if (lang==='en') return `${letter.toLowerCase()}${cat[0]}`;
            return `${letter}${cat==='person'?'ش':cat==='place'?'م':cat==='plant'?'ن':cat==='thing'?'ش':'ح'}`;
          };
          let rows = categories.filter(cat=>picks.has(cat)).map(cat => {
            const fromDict = dict?.[cat];
            const val = fromDict || makeWord(cat);
            return {
              category: cat,
              value_raw: val,
              value_norm: lang==='en' ? String(val).toLowerCase() : String(val),
            };
          });
          const terms = rows.map(r=>r.value_norm).filter(Boolean) as string[];
          if (terms.length){
            try{
              const { data: valres } = await supabase.rpc('letters_validate_words', { p_lang: lang, p_terms: terms } as any);
              const ok = new Set((valres||[]).filter((r:any)=>r.is_real).map((r:any)=>String(r.term_norm)));
              rows = rows.filter(r => r.value_norm && ok.has(String(r.value_norm)));
            }catch{}
          }
          await supabase.rpc('letters_ai_submit', { p_round_id: roundId, p_player_id: aiRow.id, p_answers: rows as any });
        } catch(e){ console.warn('AI submit failed', e); }
      }, delayMs);

      navigate(`/letters/play?code=${game.code}`);
    } catch (e:any) { console.error(e); toast.error(e?.message || t('Failed to start','فشل البدء')); }
    finally { setCreating(false); }
  }

  function handleRegenerate() {
    setCode(generateGameCode());
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t("Code copied", "تم نسخ الرمز"));
    } catch {
      toast.error(t("Copy failed", "فشل النسخ"));
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-center">{aiEnabled ? t("Letters • VS AI","لعبة الحروف • ضد الذكاء الاصطناعي") : t("Letters • Create Game","لعبة الحروف • إنشاء لعبة")}</h1>

      <div className="glass-hero p-6 rounded-xl space-y-5">
        {!aiEnabled && (
          <div>
            <label className="block text-sm font-medium mb-1">{t("Language","اللغة")}</label>
            <div className="flex gap-2">
              <button className={`px-3 py-2 rounded border ${lang==='ar'?'bg-indigo-600 text-white':'bg-card'}`} onClick={()=>setLang('ar')}>العربية</button>
              <button className={`px-3 py-2 rounded border ${lang==='en'?'bg-indigo-600 text-white':'bg-card'}`} onClick={()=>setLang('en')}>English</button>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">{t("Timer","المؤقت")}</label>
          <div className="flex gap-2">
            <button className={`px-3 py-2 rounded border ${timer===60?'bg-indigo-600 text-white':'bg-card'}`} onClick={()=>setTimer(60)}>60s</button>
            <button className={`px-3 py-2 rounded border ${timer===90?'bg-indigo-600 text-white':'bg-card'}`} onClick={()=>setTimer(90)}>90s</button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t("Rounds","الجولات")}</label>
          <div className="flex gap-2">
            <button className={`px-3 py-2 rounded border ${rounds===1?'bg-indigo-600 text-white':'bg-card'}`} onClick={()=>setRounds(1)}>{t('1 round','جولة واحدة')}</button>
            <button className={`px-3 py-2 rounded border ${rounds===3?'bg-indigo-600 text-white':'bg-card'}`} onClick={()=>setRounds(3)}>{t('3 rounds','٣ جولات')}</button>
          </div>
        </div>

        {!aiEnabled && (
          <div className="flex items-center gap-2">
            <input id="speed" type="checkbox" checked={speedBonus} onChange={(e)=>setSpeedBonus(e.target.checked)} />
            <label htmlFor="speed" className="text-sm">{t("Enable speed bonus (+3 if all 5 before time ends)","تفعيل مكافأة السرعة (+3 إذا أكملت 5 قبل انتهاء الوقت)")}</label>
          </div>
        )}

        {!aiEnabled && (
          <div>
            <label className="block text-sm font-medium mb-1">{t("Game Code","رمز اللعبة")}</label>
            <div className="flex gap-2 items-center">
              <div className="px-3 py-2 rounded border font-mono tracking-widest">{code.split("").join(" ")}</div>
              <button onClick={handleCopy} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700">{t("Copy","نسخ")}</button>
              <button onClick={handleRegenerate} className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700">{t("Regenerate","إعادة توليد")}</button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t("Code must start with W and expires after 30 min of inactivity.","الرمز يبدأ بحرف W وينتهي صلاحيته بعد ٣٠ دقيقة من عدم النشاط.")}</p>
          </div>
        )}

        {!aiEnabled && !createdGame && (
          <div className="flex gap-2 pt-2 justify-center">
            <button disabled={creating} onClick={handleCreate} className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50">
              {creating ? t("Creating…","جاري الإنشاء…") : t("Create","إنشاء")}
            </button>
          </div>
        )}

        {(!aiEnabled && createdGame) && (
          <div className="mt-6 space-y-3 border-t pt-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("Letter selection","اختيار الحرف")}</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input type="radio" name="letterMode" checked={letterMode==='auto'} onChange={()=>setLetterMode('auto')} /> {t("Auto","تلقائي")}
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="letterMode" checked={letterMode==='pick'} onChange={()=>setLetterMode('pick')} /> {t("Pick","اختيار")}
                </label>
                {letterMode==='pick' && (
                  <select value={pickedLetter} onChange={(e)=>setPickedLetter(e.target.value)} className="px-3 py-2 rounded border">
                    <option value="">{t("Select letter","اختر حرفًا")}</option>
                    {(isArabic ? AR_LETTERS : EN_LETTERS).map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleStartRound} disabled={letterMode==='pick' && !pickedLetter} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">
                {t("Start Round","بدء الجولة")}
              </button>
            </div>
          </div>
        )}

        {/* AI options + single-step Start when VS AI */}
        {aiEnabled && (
          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={aiEnabled} onChange={e=>setAiEnabled(e.target.checked)} />
              {t("Play vs AI","اللعب ضد الذكاء الاصطناعي")}
            </label>
            {aiEnabled && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{t("Difficulty","الصعوبة")}</span>
                  <select value={aiDifficulty} onChange={(e)=>setAiDifficulty(e.target.value as any)} className="px-3 py-2 rounded border">
                    <option value="easy">{t("Easy","سهل")}</option>
                    <option value="medium">{t("Medium","متوسط")}</option>
                    <option value="hard">{t("Hard","صعب")}</option>
                    <option value="auto">{t("Auto","تلقائي")}</option>
                  </select>
                </div>
                {/* Letter selection visible immediately in AI mode */}
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">{t("Letter selection","اختيار الحرف")}</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="letterMode" checked={letterMode==='auto'} onChange={()=>setLetterMode('auto')} /> {t("Auto","تلقائي")}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="letterMode" checked={letterMode==='pick'} onChange={()=>setLetterMode('pick')} /> {t("Pick","اختيار")}
                    </label>
                    {letterMode==='pick' && (
                      <select value={pickedLetter} onChange={(e)=>setPickedLetter(e.target.value)} className="px-3 py-2 rounded border">
                        <option value="">{t("Select letter","اختر حرفًا")}</option>
                        {(isArabic ? AR_LETTERS : EN_LETTERS).map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 pt-2 justify-center">
                  <button onClick={handleStartVsAI} disabled={creating || (letterMode==='pick' && !pickedLetter)} className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50">
                    {creating ? t("Starting…","...جاري البدء") : t("Start","ابدأ")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
