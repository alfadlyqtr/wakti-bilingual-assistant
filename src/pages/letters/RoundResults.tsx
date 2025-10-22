import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";

type Category = "person"|"place"|"plant"|"thing"|"animal";

function startsWithLetter(lang: 'ar'|'en', letter: string, valueNorm: string): boolean {
  if (!valueNorm) return false;
  if (lang === 'en') return valueNorm[0]?.toLowerCase() === letter.toLowerCase();
  return valueNorm[0] === letter; // value_norm already normalized in PlayRound
}

export default function RoundResults() {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const navigate = useNavigate();
  const { language } = useTheme();

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<any>(null);
  const [round, setRound] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});

  const isArabicUI = useMemo(()=>language==='ar',[language]);
  const t = (en:string, ar:string)=> (isArabicUI?ar:en);

  useEffect(()=>{
    (async()=>{
      try{
        // Load game
        const { data: g, error: gErr } = await supabase
          .from('letters_games')
          .select('id, code, lang, rounds_target, timer_sec')
          .eq('code', code)
          .single();
        if (gErr || !g) throw gErr || new Error('Game not found');
        setGame(g);

        // Latest round
        const { data: r, error: rErr } = await supabase
          .from('letters_rounds')
          .select('id, game_id, round_number, letter, duration_sec, status, start_at')
          .eq('game_id', g.id)
          .order('round_number', { ascending: false })
          .limit(1)
          .single();
        if (rErr || !r) throw rErr || new Error('Round not found');
        setRound(r);

        const [{ data: ps }, { data: ans } ] = await Promise.all([
          supabase.from('letters_players').select('id, display_name, is_ai, seat_index').eq('game_id', g.id).order('seat_index', { ascending: true }),
          supabase.from('letters_answers').select('id, player_id, category, value_raw, value_norm, is_valid, is_unique, score, created_at').eq('round_id', r.id)
        ]);
        setPlayers(ps || []);
        let answersNow = (ans || []).map(a=>({ ...a, category: String(a.category).toLowerCase() }));
        // Fallback: if AI has no answers, generate and submit now
        const ai = (ps||[]).find(p=>p.is_ai);
        const aiHasAny = (answersNow||[]).some(a=>a.player_id===ai.id);
        const aiHasNonNull = (answersNow||[]).some(a=>a.player_id===ai.id && a.value_norm);
        if (ai && (!aiHasAny || !aiHasNonNull)){
          const cats: Array<'person'|'place'|'plant'|'thing'|'animal'> = ['person','place','plant','thing','animal'];
          let rows = cats.map(cat => ({ category: cat, value_raw: null as string|null, value_norm: null as string|null }));
          try {
            const { data: gen } = await supabase.functions.invoke('letters-ai-generate', { body: { lang: g.lang, letter: r.letter, difficulty: 'medium' } });
            rows = cats.map(cat => {
              let raw = gen?.answers?.[cat] || null;
              if (!raw) {
                raw = g.lang==='en' ? `${String(r.letter).toLowerCase()}${cat[0]}` : `${r.letter}${cat==='person'?'ش':cat==='place'?'م':cat==='plant'?'ن':cat==='thing'?'ش':'ح'}`;
              }
              return { category: cat, value_raw: raw, value_norm: g.lang==='en'? String(raw).toLowerCase(): String(raw) };
            });
            // Try to persist
            await supabase.rpc('letters_ai_submit', { p_round_id: r.id, p_player_id: ai.id, p_answers: rows as any });
            const { data: ansRefetch } = await supabase.from('letters_answers').select('id, player_id, category, value_raw, value_norm, is_valid, is_unique, score, created_at').eq('round_id', r.id);
            answersNow = (ansRefetch || []).map(a=>({ ...a, category: String(a.category).toLowerCase() }));
          } catch (e) {
            console.warn('AI fallback failed (using local display only)', e);
            const local = rows.filter(rw=>rw.value_raw).map(rw=>({
              id: undefined,
              round_id: r.id,
              player_id: ai.id,
              category: rw.category,
              value_raw: rw.value_raw,
              value_norm: rw.value_norm,
              is_valid: null,
              is_unique: null,
              score: null,
              created_at: new Date().toISOString()
            }));
            answersNow = (answersNow||[]).concat(local as any);
          }
        }
        // AI-only validation
        const items = (answersNow||[]).filter(a=>a.value_norm).map(a=>({ category: a.category, value: a.value_norm }));
        let results:any[] = [];
        try{
          const { data: vdata } = await supabase.functions.invoke('letters-validate', { body: { lang: g.lang, letter: r.letter, items } });
          results = (vdata?.results)||[];
        }catch(e){ console.warn('letters-validate failed', e); }

        // Map validation back to answers by category+value
        const resMap = new Map<string, any>();
        for (const res of results){
          resMap.set(`${String(res.category)}|${String(res.value)}`.toLowerCase(), res);
        }
        const updated = answersNow.map(a=>{
          const key = `${a.category}|${a.value_norm}`.toLowerCase();
          const rres = resMap.get(key);
          const is_valid = rres ? !!(rres.is_real && rres.starts_ok && rres.category_ok) : false;
          return { ...a, is_valid };
        });

        // Persist server-side and compute totals
        const payload = updated.map(a=>({ id: a.id, is_valid: a.is_valid }));
        let totalsNow:Record<string,number> = {};
        try{
          const { data: totalsRes } = await supabase.rpc('letters_apply_scores', { p_round_id: r.id, p_results: payload as any });
          (totalsRes||[]).forEach((row:any)=>{ totalsNow[row.player_id]=row.total; });
        }catch(e){ console.warn('letters_apply_scores failed', e); }

        setAnswers(updated);
        setTotals(totalsNow);
        // Lightweight polling to catch late AI submissions (max 5s)
        let tries = 0;
        const iv = setInterval(async ()=>{
          tries++;
          if (tries>5) { clearInterval(iv); return; }
          const { data: ans2 } = await supabase.from('letters_answers').select('id, player_id, category, value_raw, value_norm, is_valid, is_unique, score, created_at').eq('round_id', r.id);
          if ((ans2?.length||0) > (ans?.length||0)){
            // Re-run validator and apply
            const a2 = (ans2||[]).map(a=>({ ...a, category: String(a.category).toLowerCase() }));
            const items2 = a2.filter(a=>a.value_norm).map(a=>({ category: a.category, value: a.value_norm }));
            let results2:any[] = [];
            try{ const { data: v2 } = await supabase.functions.invoke('letters-validate', { body: { lang: g.lang, letter: r.letter, items: items2 } }); results2 = v2?.results||[]; }catch{}
            const map2 = new Map<string, any>();
            results2.forEach(res=> map2.set(`${String(res.category)}|${String(res.value)}`.toLowerCase(), res));
            const upd2 = a2.map(a=>{
              const rr = map2.get(`${a.category}|${a.value_norm}`.toLowerCase());
              const is_valid = rr ? !!(rr.is_real && rr.starts_ok && rr.category_ok) : false;
              return { ...a, is_valid };
            });
            const payload2 = upd2.map(a=>({ id: a.id, is_valid: a.is_valid }));
            const { data: t2 } = await supabase.rpc('letters_apply_scores', { p_round_id: r.id, p_results: payload2 as any });
            const totals2:Record<string,number> = {}; (t2||[]).forEach((row:any)=>totals2[row.player_id]=row.total);
            setAnswers(upd2);
            setTotals(totals2);
          }
        }, 1000);
        return () => clearInterval(iv);
      }catch(e:any){
        console.error(e);
        toast.error(e?.message || t('Failed to load results','فشل تحميل النتائج'));
      }finally{
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[code]);

  async function computeAndPersist(lang:'ar'|'en', letter:string, ps:any[], ans:any[]){
    // Trust server. If score is null, treat as invalid with 0 (no client fallback awarding).
    for (const a of ans){
      if (a.score == null){
        a.is_valid = false;
        a.score = 0;
      }
    }
    const totals: Record<string, number> = {};
    for (const p of ps){ totals[p.id] = 0; }
    for (const a of ans){ totals[a.player_id] = (totals[a.player_id]||0) + (a.score||0); }
    return { updatedAnswers: ans, totals };
  }

  function chunkBy<T>(arr:T[], n:number){
    const out:T[] [] = [] as any;
    for (let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n));
    return out;
  }

  async function handleNextRound(){
    try{
      // Create next round if applicable
      if (!game || !round) return;
      if (round.round_number >= game.rounds_target){
        navigate(`/letters/end?code=${game.code}`);
        return;
      }
      const letter = randomLetter(game.lang);
      const startedAt = new Date().toISOString();
      const { error } = await supabase.from('letters_rounds').insert({
        game_id: game.id,
        round_number: round.round_number + 1,
        letter,
        duration_sec:  game.timer_sec || 60,
        start_at: startedAt,
        status: 'playing'
      });
      if (error) throw error;
      // Broadcast round_start
      const channel = supabase.channel(`letters:game:${game.code}`);
      channel.subscribe((status)=>{ if (status==='SUBSCRIBED'){ channel.send({ type:'broadcast', event:'round_start', payload:{ round_number: round.round_number+1, letter, start_at: startedAt, duration_sec: game.timer_sec || 60 }}); channel.unsubscribe(); }});
      navigate(`/letters/play?code=${game.code}`);
    }catch(e:any){
      console.error(e);
      toast.error(e?.message || t('Failed to start next round','فشل بدء الجولة التالية'));
    }
  }

  async function handleEndGame(){
    try{
      if (!game) return;
      const { error } = await supabase.from('letters_games').update({ status: 'ended' }).eq('id', game.id);
      if (error) throw error;
      // Broadcast game_end
      const channel = supabase.channel(`letters:game:${game.code}`);
      channel.subscribe((status)=>{ if (status==='SUBSCRIBED'){ channel.send({ type:'broadcast', event:'game_end', payload:{} }); channel.unsubscribe(); }});
      navigate(`/letters/end?code=${game.code}`);
    }catch(e:any){
      console.error(e);
      toast.error(e?.message || t('Failed to end game','فشل إنهاء اللعبة'));
    }
  }

  if (loading) return <div className="p-4"><p className="text-muted-foreground">{t('Loading…','جاري التحميل…')}</p></div>;
  if (!game || !round) return <div className="p-4"><p className="text-red-500">{t('No results','لا توجد نتائج')}</p></div>;

  const categories: Category[] = ['person','place','plant','thing','animal'];
  const grid: Record<string, Record<Category, any>> = {};
  for (const p of players){ grid[p.id] = { person:null, place:null, plant:null, thing:null, animal:null }; }
  for (const a of answers){
    if (!grid[a.player_id]) continue;
    grid[a.player_id][a.category as Category] = a;
  }

  const isLastRound = round.round_number >= (game.rounds_target || 1);
  // Compute time used per player (max created_at - start_at)
  const timeUsed: Record<string, number> = {};
  if (round?.start_at){
    const startMs = new Date(round.start_at).getTime();
    for (const p of players){
      const A = answers.filter(a=>a.player_id===p.id && a.created_at);
      if (A.length){
        const maxMs = Math.max(...A.map(a=> new Date(a.created_at).getTime()));
        timeUsed[p.id] = Math.max(0, Math.round((maxMs - startMs)/1000));
      } else {
        timeUsed[p.id] = 0;
      }
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="glass-hero p-4 rounded-xl mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('Round Results','نتائج الجولة')}</h1>
          <div className="text-sm text-muted-foreground">
            {t('Letter','الحرف')}: <span className="font-medium">{round.letter}</span> • {t('Round','الجولة')} {round.round_number} {t('of','من')} {game.rounds_target} • {t('Duration','المدة')}: {round.duration_sec || game.timer_sec || 60}s
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleEndGame} className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700">{t('End Game','إنهاء اللعبة')}</button>
          {!isLastRound && (
            <button onClick={handleNextRound} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">{t('Next Round','الجولة التالية')}</button>
          )}
        </div>
      </div>

      <div className="overflow-auto rounded border">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-left">{t('Player','اللاعب')}</th>
              {categories.map(c=> <th key={c} className="p-2 text-left capitalize">{t(c.charAt(0).toUpperCase()+c.slice(1), c==='person'?'اسم شخص': c==='place'?'مكان': c==='plant'?'نبات': c==='thing'?'شيء':'حيوان')}</th>)}
              <th className="p-2 text-left">{t('Total','المجموع')}</th>
              <th className="p-2 text-left">{t('Time','الوقت')}</th>
            </tr>
          </thead>
          <tbody>
            {players.map(p=>{
              const total = totals[p.id] || 0;
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-2 font-medium">{p.display_name}{p.is_ai? ' (AI)':''}</td>
                  {categories.map(cat=>{
                    const a = grid[p.id][cat];
                    let marker = a?.is_valid ? '✓' : '✗';
                    const display = a?.value_raw || '';
                    return <td key={cat} className="p-2 whitespace-nowrap">{marker} {display}</td>;
                  })}
                  <td className="p-2 font-semibold">{total}</td>
                  <td className="p-2">{timeUsed[p.id] ? `${timeUsed[p.id]}s` : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function randomLetter(lang: 'ar'|'en'){
  const EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const AR = ["ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","و","ي"];
  const pool = lang==='ar'?AR:EN;
  return pool[Math.floor(Math.random()*pool.length)];
}
