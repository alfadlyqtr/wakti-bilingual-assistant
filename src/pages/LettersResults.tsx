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

  return (
    <div className="container mx-auto p-3 max-w-5xl relative min-h-[100dvh]">
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
          {language==='ar' ? `المضيف: ${hostName || '-'}` : `Host: ${hostName || '-'}`}
        </div>
      </div>

      <div className="glass-hero p-5 rounded-xl space-y-6 relative z-10 bg-white/60 dark:bg-gray-900/35">
        <h1 className="text-2xl font-bold">{language==='ar' ? 'النتائج النهائية' : 'Final Results'}</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((r, idx) => (
            <div key={idx} className={`rounded-xl border p-4 text-center ${idx===0? 'bg-amber-50 dark:bg-amber-900/20' : idx===1? 'bg-slate-50 dark:bg-slate-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crown className={`${idx===0?'text-amber-500':'text-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">{language==='ar'? `المركز ${idx+1}` : `Place ${idx+1}`}</span>
              </div>
              <div className="text-lg font-semibold">{nameOf(r.user_id)}</div>
              <div className="text-2xl font-black">{r.total}</div>
            </div>
          ))}
          {top3.length === 0 && (
            <div className="md:col-span-3 text-sm text-muted-foreground">{language==='ar'?'لا توجد نتائج':'No results yet'}</div>
          )}
        </div>

        {rest.length > 0 && (
          <div className="rounded-lg border p-4 bg-card/50">
            <div className="text-sm font-medium mb-2">{language==='ar'?'لوحة المتصدرين':'Leaderboard'}</div>
            <div className="divide-y">
              {rest.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex w-6 justify-center text-muted-foreground">{i+4}</span>
                    <span className="font-medium">{nameOf(r.user_id)}</span>
                  </div>
                  <div className="font-semibold">{r.total}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={()=>navigate('/games')}>{language==='ar'?'عودة إلى الألعاب':'Back to Games'}</Button>
        </div>
      </div>
    </div>
  );
}
