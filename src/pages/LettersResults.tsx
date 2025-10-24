import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import LettersBackdrop from '@/components/letters/LettersBackdrop';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Crown } from 'lucide-react';

interface TotalRow { user_id: string | null; total: number }
interface Player { user_id: string | null; name: string }

export default function LettersResults() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const { code } = useParams();
  const [totals, setTotals] = React.useState<TotalRow[]>([]);
  const [players, setPlayers] = React.useState<Player[]>([]);
  const [hostName, setHostName] = React.useState<string | undefined>();
  const [breakdown, setBreakdown] = React.useState<Array<{ user_id: string | null; base: number; bonus: number; total: number; fields?: any }>>([]);
  const [roundList, setRoundList] = React.useState<Array<{id: string; round_no: number}>>([]);
  const [perRound, setPerRound] = React.useState<Record<string, Record<number, number>>>({});

  React.useEffect(() => {
    let active = true;
    async function load() {
      if (!code) return;
      const [{ data: t }, { data: p }, { data: g }] = await Promise.all([
        supabase.from('letters_totals').select('user_id, total').eq('game_code', code),
        supabase.from('letters_players').select('user_id, name').eq('game_code', code),
        supabase.from('letters_games').select('host_name').eq('code', code).maybeSingle(),
      ]);
      if (!active) return;
      let totalsData: TotalRow[] = (t || []) as any;
      // Fallback: aggregate from letters_round_scores when totals are empty
      if (!totalsData || totalsData.length === 0) {
        const { data: rs } = await supabase
          .from('letters_round_scores')
          .select('user_id, total')
          .eq('game_code', code);
        const map = new Map<string | null, number>();
        (rs || []).forEach(r => {
          const key = r.user_id ?? null;
          map.set(key, (map.get(key) || 0) + (r.total || 0));
        });
        totalsData = Array.from(map.entries()).map(([user_id, total]) => ({ user_id, total }));
      }
      setTotals((totalsData || []).sort((a,b)=> (b.total||0) - (a.total||0)));
      setPlayers(p || []);
      setHostName(g?.host_name || undefined);

      // Rounds list for per-round table
      const { data: rounds } = await supabase
        .from('letters_rounds')
        .select('id, round_no')
        .eq('game_code', code)
        .order('round_no', { ascending: true });
      setRoundList((rounds || []) as any);

      // Per-round scores across all players
      if (rounds && rounds.length > 0) {
        const roundIds = rounds.map(r=>r.id);
        const { data: prs } = await supabase
          .from('letters_round_scores')
          .select('user_id, round_id, total')
          .in('round_id', roundIds as any);
        const idToNo = new Map<string, number>((rounds||[]).map(r=>[String(r.id), r.round_no]));
        const map: Record<string, Record<number, number>> = {};
        (prs || []).forEach(r => {
          const uid = String(r.user_id ?? 'null');
          const rn = idToNo.get(String(r.round_id));
          if (typeof rn === 'number') {
            map[uid] = map[uid] || {};
            map[uid][rn] = (r.total || 0);
          }
        });
        setPerRound(map);
      } else {
        setPerRound({});
      }

      // Last round breakdown
      const { data: lastRound } = await supabase
        .from('letters_rounds')
        .select('id, round_no')
        .eq('game_code', code)
        .order('round_no', { ascending: false })
        .limit(1);
      const lastId = Array.isArray(lastRound) && lastRound[0]?.id;
      if (lastId) {
        const { data: bd } = await supabase
          .from('letters_round_scores')
          .select('user_id, base, bonus, total, fields')
          .eq('round_id', lastId);
        if (bd) setBreakdown(bd as any);
      } else {
        setBreakdown([]);
      }
    }
    load();
    return () => { active = false };
  }, [code]);

  // Realtime refresh when totals or round_scores change
  React.useEffect(() => {
    if (!code) return;
    const ch1 = supabase.channel(`letters:totals:${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'letters_totals', filter: `game_code=eq.${code}` }, () => {
        // Trigger reload
        (async () => {
          const { data } = await supabase.from('letters_totals').select('user_id, total').eq('game_code', code);
          if (data) setTotals((data as any).sort((a: any,b: any)=> (b.total||0) - (a.total||0)));
        })();
      })
      .subscribe();
    const ch2 = supabase.channel(`letters:scores:${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'letters_round_scores', filter: `game_code=eq.${code}` }, () => {
        // Fallback refresh via aggregation
        (async () => {
          const { data: rs } = await supabase.from('letters_round_scores').select('user_id, total').eq('game_code', code);
          const map = new Map<string | null, number>();
          (rs || []).forEach(r => {
            const key = r.user_id ?? null;
            map.set(key, (map.get(key) || 0) + (r.total || 0));
          });
          const agg = Array.from(map.entries()).map(([user_id, total]) => ({ user_id, total }));
          setTotals(agg.sort((a,b)=> (b.total||0) - (a.total||0)));
        })();
      })
      .subscribe();
    return () => {
      try { supabase.removeChannel(ch1); } catch {}
      try { supabase.removeChannel(ch2); } catch {}
    };
  }, [code]);

  function nameOf(user_id: string | null) {
    return players.find(p=>p.user_id===user_id)?.name || (language==='ar'? 'مجهول' : 'Unknown');
  }

  const top3 = totals.slice(0,3);
  const rest = totals.slice(3);
  const allTotals = totals;

  return (<div className="container mx-auto p-3 max-w-5xl relative min-h-[100dvh]">
      <LettersBackdrop density={60} />

      <div className="glass-hero px-5 py-4 mb-4 flex items-center justify-between gap-3 relative z-10 bg-white/60 dark:bg-gray-900/35">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/games')}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 bg-card text-foreground hover:bg-accent transition shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">{language === 'ar' ? 'رجوع' : 'Back'}</span>
          </button>
        </div>
        <div className="text-sm text-muted-foreground">
          {language==='ar' ? 'المضيف: ' : 'Host: '} {hostName || '-'}
        </div>
      </div>

      <div className="glass-hero p-5 rounded-xl space-y-6 relative z-10 bg-white/60 dark:bg-gray-900/35">
        <h1 className="text-2xl font-bold">{language==='ar' ? 'النتائج النهائية' : 'Final Results'}</h1>

        <div className="mt-6 grid grid-cols-1 gap-3">
        {top3.length === 0 ? (
          <div className="rounded-lg border p-5 bg-card/50 text-sm text-muted-foreground">
            {language==='ar'? 'لا توجد نتائج بعد' : 'No results yet'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {top3.map((row, idx) => (
              <div key={(row.user_id ?? 'u') + idx} className="rounded-lg border p-5 bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className={`h-5 w-5 ${idx===0?'text-yellow-500': idx===1?'text-slate-400':'text-amber-700'}`} />
                  <div className="text-xs text-muted-foreground">{language==='ar'?`المركز ${idx+1}`:`Place ${idx+1}`}</div>
                </div>
                <div className="text-lg font-semibold">{nameOf(row.user_id)}</div>
                <div className="text-2xl font-bold mt-1">{row.total || 0}</div>
              </div>
            ))}
          </div>
        )}

        {/* All players totals (Option B) */}
        {allTotals.length > 0 && (
          <div className="rounded-lg border p-4 bg-card/50">
            <div className="text-sm font-medium mb-2">{language==='ar'?'مجموع كل اللاعبين':'All players totals'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allTotals.map((row, i) => (
                <div key={(row.user_id ?? 'u') + i} className="rounded-md border bg-card p-3">
                  <div className="text-sm font-semibold">{nameOf(row.user_id)}</div>
                  <div className="text-xl font-bold mt-1">{row.total || 0}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-round table (Option C) */}
        {roundList.length > 0 && (
          <div className="rounded-lg border p-4 bg-card/50">
            <div className="text-sm font-medium mb-2">{language==='ar'?'نتائج كل جولة':'Per-round scores'}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left py-2 pr-2">{language==='ar'?'لاعب':'Player'}</th>
                    {roundList.map(r=> (
                      <th key={r.id} className="text-center py-2 px-2">{language==='ar'?`جولة ${r.round_no}`:`R${r.round_no}`}</th>
                    ))}
                    <th className="text-right py-2 pl-2">{language==='ar'?'المجموع':'Total'}</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, idx)=>{
                    const uid = String(p.user_id ?? 'null');
                    const rowMap = perRound[uid] || {};
                    const total = (allTotals.find(t=>String(t.user_id ?? 'null')===uid)?.total) || 0;
                    return (
                      <tr key={uid+idx} className="border-t">
                        <td className="py-2 pr-2 font-medium">{p.name}</td>
                        {roundList.map(r => (
                          <td key={r.id} className="text-center py-2 px-2 tabular-nums">{rowMap[r.round_no] ?? 0}</td>
                        ))}
                        <td className="text-right py-2 pl-2 font-semibold tabular-nums">{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {breakdown.length > 0 && (
          <div className="rounded-lg border p-4 bg-card/50">
            <div className="text-sm font-medium mb-2">{language==='ar'?'تفاصيل الجولة الأخيرة':'Last round breakdown'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {breakdown.map((b, i) => (
                <div key={(b.user_id ?? 'u') + i} className="rounded-md border bg-card p-3 text-sm">
                  <div className="font-medium mb-1">{nameOf(b.user_id)}</div>
                  <div className="flex flex-col gap-1 text-xs">
                    {(['name','place','plant','animal','thing'] as const).map((key) => {
                      const label = language==='ar' ? ({name:'اسم',place:'مكان',plant:'نبات',animal:'حيوان',thing:'شيء'} as any)[key] : key;
                      const valid = !!b.fields?.[key]?.valid;
                      const value = b.fields?.[key]?.value ?? '';
                      const reason = b.fields?.[key]?.reason || '';
                      return (
                        <div key={key} className={`px-2 py-1 rounded ${valid ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/20 dark:text-rose-200'}`}>
                          <div className="inline-flex w-full items-center justify-between">
                            <span className="mr-2">{label}</span>
                            <span className="truncate max-w-[14rem] opacity-90">{String(value || '')}</span>
                            <span className="ml-2">{valid ? '✓' : '✗'}</span>
                          </div>
                          {!valid && reason && (
                            <div className="mt-0.5 text-[11px] opacity-80">{String(reason)}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{language==='ar'?'المجموع':'Total'}: {b.total} {b.bonus ? ('(+' + b.bonus + ')') : ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {rest.length > 0 && (
          <div className="rounded-lg border p-4 bg-card/50">
            <div className="text-sm font-medium mb-2">{language==='ar'?'الترتيب':'Leaderboard'}</div>
            <div className="divide-y">
              {rest.map((r, i) => (
                <div key={(r.user_id ?? 'u') + i} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex w-6 justify-center text-muted-foreground">{i+4}</span>
                    <span className="font-medium">{nameOf(r.user_id)}</span>
                  </div>
                  <div className="font-semibold">{r.total || 0}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={()=>navigate('/games')}>{language==='ar'?'عودة إلى الألعاب':'Back to Games'}</Button>
        </div>
      </div>
    </div>);
}
