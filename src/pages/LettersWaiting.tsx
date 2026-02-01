// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, ArrowLeft } from 'lucide-react';
import LettersBackdrop from '@/components/letters/LettersBackdrop';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

// Deterministic auto letter per round (same as in LettersPlay.tsx)
function autoLetterForRound(c: string, lang: 'en'|'ar'|undefined, round: number) {
  const alphabet = (lang === 'ar')
    ? 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'
    : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let seed = 0;
  for (let i = 0; i < c.length; i++) seed = (seed + c.charCodeAt(i) * (i + 1)) % alphabet.length;
  const idx = (seed + Math.max(0, round - 1)) % alphabet.length;
  return alphabet[idx] || alphabet[0];
}

export default function LettersWaiting() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { isHost?: boolean; gameCode?: string; gameTitle?: string; hostName?: string; maxPlayers?: number } };
  const isHost = !!location.state?.isHost;
  const [copied, setCopied] = useState(false);
  // Placeholder game code; in the future this would come from state/router.
  const [gameCode] = useState<string>(location.state?.gameCode || 'W123456');
  const [players, setPlayers] = useState<Array<{ user_id: string | null; name: string }>>([]);
  const [playersCount, setPlayersCount] = useState<number>(1);
  const [maxPlayers, setMaxPlayers] = useState<number>(location.state?.maxPlayers || 5);
  const [gameTitle, setGameTitle] = useState<string | undefined>(location.state?.gameTitle);
  const [hostName, setHostName] = useState<string | undefined>(location.state?.hostName);
  const [hostUserId, setHostUserId] = useState<string | undefined>();
  const [navigated, setNavigated] = useState(false);
  const startChannelRef = useRef<any>(null);
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(false);
  const [endOnFirstSubmit, setEndOnFirstSubmit] = useState<boolean>(false);
  const [gameLang, setGameLang] = useState<'en'|'ar'>('en');
  const [letterMode, setLetterMode] = useState<'auto'|'manual'>('auto');
  const [manualLetter, setManualLetter] = useState<string|null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!gameCode) return;
      // Try Supabase first
      const { data, error } = await supabase
        .from('letters_games')
        .select('title, host_name, host_user_id, max_players, hints_enabled, end_on_first_submit, phase, language, letter_mode, manual_letter')
        .eq('code', gameCode)
        .maybeSingle();
      if (!cancelled) {
        if (!error && data) {
          if (!gameTitle && data.title) setGameTitle(data.title);
          if (!hostName && data.host_name) setHostName(data.host_name);
          if (data.host_user_id) setHostUserId(data.host_user_id);
          if (typeof data.max_players === 'number' && !location.state?.maxPlayers) setMaxPlayers(data.max_players);
          if (typeof data.hints_enabled === 'boolean') setHintsEnabled(!!data.hints_enabled);
          if (typeof data.end_on_first_submit === 'boolean') setEndOnFirstSubmit(!!data.end_on_first_submit);
          if (data.language) setGameLang(data.language as 'en'|'ar');
          if (data.letter_mode) setLetterMode(data.letter_mode as 'auto'|'manual');
          if (data.manual_letter) setManualLetter(data.manual_letter);
          if ((data as any)?.phase === 'countdown' && !navigated) {
            setNavigated(true);
            navigate(`/games/letters/play/${gameCode}`, { state: { lateJoin: true, hintsEnabled, endOnFirstSubmit } });
          }
        } else {
          // Fallback to localStorage if available
          try {
            const raw = localStorage.getItem(`wakti_letters_game_${gameCode}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (!gameTitle && parsed?.title) setGameTitle(parsed.title);
              if (!hostName && parsed?.hostName) setHostName(parsed.hostName);
            }
          } catch {}
        }
      }
    }
    load();
    return () => { cancelled = true };
  }, [gameCode]);

  // Poll game started status and auto-navigate when started
  useEffect(() => {
    let active = true;
    async function pollStarted() {
      if (!gameCode || navigated) return;
      const { data } = await supabase
        .from('letters_games')
        .select('started_at, round_duration_sec, hints_enabled, end_on_first_submit, phase')
        .eq('code', gameCode)
        .maybeSingle();
      if (!active) return;
      if (data && ((data as any).phase === 'countdown' || data.started_at)) {
        setNavigated(true);
        navigate(`/games/letters/play/${gameCode}`, { state: { roundDurationSec: data.round_duration_sec, hintsEnabled: !!data.hints_enabled, endOnFirstSubmit: !!data.end_on_first_submit, lateJoin: true } });
      }
    }
    pollStarted();
    const id = setInterval(pollStarted, 1500);
    return () => { active = false; clearInterval(id); };
  }, [gameCode, navigated, navigate]);

  // Realtime subscribe for started flag (best-effort; falls back to polling if disabled)
  useEffect(() => {
    if (!gameCode || navigated) return;
    const channel = supabase.channel(`letters_games:${gameCode}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'letters_games', filter: `code=eq.${gameCode}` }, (payload: any) => {
        const started = payload?.new?.started_at;
        const phase = payload?.new?.phase;
        if ((phase === 'countdown' || started) && !navigated) {
          setNavigated(true);
          navigate(`/games/letters/play/${gameCode}`, { state: { roundDurationSec: payload?.new?.round_duration_sec, hintsEnabled: !!payload?.new?.hints_enabled, endOnFirstSubmit: !!payload?.new?.end_on_first_submit, lateJoin: true } });
        }
      })
      .subscribe();
    // Also subscribe to broadcast for instant start
    const startChannel = supabase.channel(`letters:start:${gameCode}`)
      .on('broadcast', { event: 'started' }, (payload: any) => {
        if (!navigated) {
          setNavigated(true);
          navigate(`/games/letters/play/${gameCode}`, { state: { roundDurationSec: payload?.roundDurationSec, hintsEnabled: !!payload?.hintsEnabled, endOnFirstSubmit: !!payload?.endOnFirstSubmit } });
        }
      })
      .subscribe();
    startChannelRef.current = startChannel;
    return () => {
      try { supabase.removeChannel(channel); } catch {}
      try { supabase.removeChannel(startChannel); } catch {}
    };
  }, [gameCode, navigated, navigate]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(gameCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  // Poll players list every 2 seconds
  useEffect(() => {
    let active = true;
    async function fetchPlayers() {
      if (!gameCode) return;
      const { data } = await supabase
        .from('letters_players')
        .select('user_id, name')
        .eq('game_code', gameCode)
        .order('joined_at', { ascending: true });
      if (!active) return;
      if (Array.isArray(data)) {
        setPlayers(data as any);
        setPlayersCount(data.length);
      }
    }
    fetchPlayers();
    const id = setInterval(fetchPlayers, 2000);
    return () => { active = false; clearInterval(id); };
  }, [gameCode]);

  return (
    <div className="container mx-auto p-3 max-w-3xl relative min-h-[100dvh]">
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
          <h1 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-600 bg-clip-text text-transparent drop-shadow">
            {language === 'ar' ? 'بانتظار الآخرين' : 'Waiting for others'}
          </h1>
        </div>
      </div>

      <div className="glass-hero p-5 rounded-xl space-y-6 relative z-10 bg-white/60 dark:bg-gray-900/35">
        <p className="text-muted-foreground">
          {language === 'ar'
            ? 'بانتظار انضمام اللاعبين… شارك رمز اللعبة مع أصدقائك.'
            : 'Waiting for players to join… Share the game code with your friends.'}
        </p>

        {(gameTitle || hostName) && (
          <div className="rounded-lg border p-4 bg-card/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gameTitle && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'عنوان اللعبة' : 'Game title'}</div>
                  <div className="font-medium">{gameTitle}</div>
                </div>
              )}
              {hostName && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'المضيف' : 'Host'}</div>
                  <div className="font-medium">{hostName}</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="wg-code">{language === 'ar' ? 'رمز اللعبة' : 'Game code'}</Label>
          <div className="flex gap-2">
            <Input id="wg-code" value={gameCode} readOnly />
            <Button type="button" variant="outline" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? (language === 'ar' ? 'نُسخ' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-card/50">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{language === 'ar' ? 'اللاعبون' : 'Players'}</div>
            <Badge variant="secondary" className="rounded-full">
              {playersCount}/{maxPlayers}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {players.length > 0 ? (
              players.map((p, i) => {
                const isHostChip = (hostUserId && p.user_id === hostUserId) || (!hostUserId && hostName && p.name === hostName);
                return (
                  <span
                    key={(p.user_id ?? 'anon') + i}
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs border ${isHostChip ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200 border-amber-400' : 'bg-secondary border-transparent'}`}
                  >
                    {p.name}
                    {isHostChip && (
                      <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] border border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                        {language === 'ar' ? 'المضيف' : 'Host'}
                      </span>
                    )}
                  </span>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">{language === 'ar' ? 'سيظهر اللاعبون هنا عند الانضمام.' : 'Players will appear here as they join.'}</p>
            )}
          </div>
        </div>

        {isHost && (
          <div className="pt-2 flex items-center justify-end">
            <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={playersCount < 2}
              title={playersCount < 2 ? (language === 'ar' ? 'يتطلب لاعبين على الأقل' : 'Requires at least 2 players') : undefined}
              onClick={async()=>{
                if (!gameCode) return;
                try {
                  const nowIso = new Date().toISOString();
                  // Start DB-driven countdown (Option B)
                  await supabase.from('letters_games').update({ phase: 'countdown', countdown_start_at: nowIso, countdown_sec: 3, current_round_no: 1, started_at: null }).eq('code', gameCode);
                  // SYNC FIX: Create round row immediately so non-host can preview letter during countdown
                  const letter = (letterMode === 'manual' && manualLetter) ? manualLetter : autoLetterForRound(gameCode, gameLang, 1);
                  await supabase.from('letters_rounds').upsert({ game_code: gameCode, round_no: 1, letter, status: 'countdown' }, { onConflict: 'game_code,round_no' });
                } catch {}
                setNavigated(true);
                navigate(`/games/letters/play/${gameCode}`, { state: { roundDurationSec: (location.state as any)?.roundDurationSec, hintsEnabled, endOnFirstSubmit, lateJoin: true } });
              }}
            >
              {language === 'ar' ? 'ابدأ اللعبة الآن' : 'Start game now'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
