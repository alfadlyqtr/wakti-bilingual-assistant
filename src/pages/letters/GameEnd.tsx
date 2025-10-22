import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";

type Category = "person"|"place"|"plant"|"thing"|"animal";

export default function GameEnd() {
  const [params] = useSearchParams();
  const code = params.get('code') || '';
  const { language } = useTheme();
  const isArabicUI = useMemo(()=>language==='ar',[language]);
  const t = (en:string, ar:string)=> (isArabicUI?ar:en);

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [standings, setStandings] = useState<any[]>([]);
  const [highlights, setHighlights] = useState<{ rarest?: any; bestRound?: any }>({});

  useEffect(()=>{
    (async()=>{
      try{
        const { data: g, error: gErr } = await supabase
          .from('letters_games').select('id, code, lang, timer_sec, rounds_target').eq('code', code).single();
        if (gErr || !g) throw gErr || new Error('Game not found');
        setGame(g);

        const [{ data: ps }, { data: rs }] = await Promise.all([
          supabase.from('letters_players').select('id, display_name, avatar_url, is_ai, seat_index').eq('game_id', g.id).order('seat_index', { ascending: true }),
          supabase.from('letters_rounds').select('id, round_number, letter, duration_sec').eq('game_id', g.id).order('round_number', { ascending: true })
        ]);
        setPlayers(ps||[]);
        setRounds(rs||[]);

        // Ensure server-side scoring for all rounds
        const roundIds = (rs||[]).map((r:any)=>r.id);
        for (const rid of roundIds){ await supabase.rpc('letters_score_round', { p_round_id: rid }); }
        let allAnswers: any[] = [];
        if (roundIds.length){
          const { data: ans, error: aErr } = await supabase
            .from('letters_answers')
            .select('id, round_id, player_id, category, value_raw, value_norm, is_valid, score')
            .in('round_id', roundIds);
          if (aErr) throw aErr;
          allAnswers = ans || [];
        }

        // Trust server scores strictly (no client recompute)
        // Totals per player across all rounds
        const totals: Record<string, number> = {};
        for (const p of ps||[]) totals[p.id]=0;
        for (const a of allAnswers){ totals[a.player_id] = (totals[a.player_id]||0) + (a.score||0); }

        // Best single round
        const byRound: Record<string, Record<string, number>> = {};
        for (const a of allAnswers){
          if (!byRound[a.round_id]) byRound[a.round_id] = {};
          byRound[a.round_id][a.player_id] = (byRound[a.round_id][a.player_id]||0) + (a.score||0);
        }
        let bestRound: any = null;
        for (const rId of Object.keys(byRound)){
          for (const pId of Object.keys(byRound[rId])){
            const pts = byRound[rId][pId];
            if (!bestRound || pts > bestRound.points){ bestRound = { roundId: rId, playerId: pId, points: pts }; }
          }
        }

        // Rarest valid word
        let rarest: any = null;
        if (allAnswers.length){
          // Join with dictionaries
          const { data: dict } = await supabase
            .from('letters_dictionaries')
            .select('lang, category, term_norm, rarity_score')
            .eq('lang', g.lang);
          const rarityMap: Record<string, number> = {};
          (dict||[]).forEach((d:any)=>{
            rarityMap[`${d.category}:${d.term_norm}`] = d.rarity_score;
          });
          for (const a of allAnswers){
            if (!a.is_valid || !a.value_norm) continue;
            const key = `${a.category}:${a.value_norm}`;
            const rScore = rarityMap[key] ?? 0;
            if (!rarest || rScore > rarest.rarity){
              rarest = { playerId: a.player_id, category: a.category, term: a.value_raw, rarity: rScore };
            }
          }
        }

        // Standings sorted
        const rows = (ps||[]).map((p:any)=>({ player: p, total: totals[p.id]||0 }));
        rows.sort((a,b)=> b.total - a.total);
        setStandings(rows);
        setHighlights({ rarest, bestRound });
      }catch(e:any){
        console.error(e);
        toast.error(e?.message || t('Failed to load game end','فشل تحميل نهاية اللعبة'));
      }finally{
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[code]);

  function handleDownloadPDF(){
    // Temporary: use browser print (user can save as PDF)
    window.print();
  }

  if (loading) return <div className="p-4"><p className="text-muted-foreground">{t('Loading…','جاري التحميل…')}</p></div>;
  if (!game) return <div className="p-4"><p className="text-red-500">{t('Game not found','اللعبة غير موجودة')}</p></div>;

  // Podium (top 3)
  const top = standings.slice(0,3);
  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="glass-hero p-4 rounded-xl mb-4">
        <h1 className="text-xl font-semibold">{t('Game Over','انتهت اللعبة')} — {game.code}</h1>
        <p className="text-sm text-muted-foreground">{t('Rounds','الجولات')}: {rounds.length} • {t('Timer','المؤقت')}: {game.timer_sec}s</p>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-3 gap-3 items-end">
          {top[1] && (
            <div className="text-center bg-card rounded-xl p-3 shadow translate-y-2">
              <div className="text-2xl">🥈</div>
              <div className="font-semibold">{top[1].player.display_name}{top[1].player.is_ai?' (AI)':''}</div>
              <div className="text-lg">{top[1].total}</div>
            </div>
          )}
          {top[0] && (
            <div className="text-center bg-card rounded-xl p-5 shadow-lg scale-105">
              <div className="text-3xl">🥇</div>
              <div className="font-semibold">{top[0].player.display_name}{top[0].player.is_ai?' (AI)':''}</div>
              <div className="text-xl">{top[0].total}</div>
            </div>
          )}
          {top[2] && (
            <div className="text-center bg-card rounded-xl p-3 shadow translate-y-3">
              <div className="text-2xl">🥉</div>
              <div className="font-semibold">{top[2].player.display_name}{top[2].player.is_ai?' (AI)':''}</div>
              <div className="text-lg">{top[2].total}</div>
            </div>
          )}
        </div>
      </div>

      <div className="glass-hero p-4 rounded-xl mb-4">
        <h2 className="text-lg font-semibold mb-2">{t('Standings','الترتيب')}</h2>
        <div className="space-y-2">
          {standings.map((row, idx)=> (
            <div key={row.player.id} className="flex items-center justify-between p-2 rounded border">
              <div className="flex items-center gap-2"><span className="w-6 text-right">{idx+1}.</span> <span className="font-medium">{row.player.display_name}{row.player.is_ai?' (AI)':''}</span></div>
              <div className="font-semibold">{row.total}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-hero p-4 rounded-xl mb-4">
        <h2 className="text-lg font-semibold mb-2">{t('Highlights','أبرز النتائج')}</h2>
        <ul className="text-sm list-disc pl-5">
          {highlights.rarest && (
            <li>{t('Rarest valid word','أندر كلمة صحيحة')}: <strong>{highlights.rarest.term}</strong> — {t('category','الفئة')}: {highlights.rarest.category}</li>
          )}
          {highlights.bestRound && (
            <li>{t('Best single round','أفضل جولة')}: {(() => {
              const r = highscoresName(standings, highlights.bestRound.playerId);
              return `${r} — ${highlights.bestRound.points} ${t('points','نقطة')}`;
            })()}</li>
          )}
        </ul>
      </div>

      <div className="flex gap-2">
        <button onClick={handleDownloadPDF} className="px-4 py-2 rounded bg-indigo-600 text-white">{t('Download PDF','تنزيل PDF')}</button>
      </div>
    </div>
  );
}

function highscoresName(standings:any[], playerId:string){
  const row = standings.find(r=> r.player.id === playerId);
  return row ? row.player.display_name : 'Player';
}
