import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import LettersBackdrop from '@/components/letters/LettersBackdrop';
import { ArrowLeft, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function LettersPlay() {
  const { language } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { code } = useParams();
  const location = useLocation() as { state?: { roundDurationSec?: number, lateJoin?: boolean, hostName?: string, submitEndsRound?: boolean, hintsEnabled?: boolean, endOnFirstSubmit?: boolean } };
  const [gameTitle, setGameTitle] = React.useState<string | undefined>();
  const [hostName, setHostName] = React.useState<string | undefined>();
  const [hostUserId, setHostUserId] = React.useState<string | undefined>();
  const [gameLang, setGameLang] = React.useState<'en'|'ar'|undefined>();
  const [letterMode, setLetterMode] = React.useState<'auto'|'manual'|undefined>();
  const [manualLetter, setManualLetter] = React.useState<string | undefined>();
  const [roundsTotal, setRoundsTotal] = React.useState<number | undefined>();
  const [players, setPlayers] = React.useState<Array<{ user_id: string | null; name: string }>>([]);
  const [roundDuration, setRoundDuration] = React.useState<number>(location.state?.roundDurationSec || 60);
  const [remaining, setRemaining] = React.useState<number>(roundDuration);
  const [startedAt, setStartedAt] = React.useState<string | undefined>();
  const [currentLetter, setCurrentLetter] = React.useState<string>('');
  const [values, setValues] = React.useState<{name:string;place:string;plant:string;animal:string;thing:string}>({name:'',place:'',plant:'',animal:'',thing:''});
  const [phase, setPhase] = React.useState<'playing'|'scoring'|'done'>('playing');
  const [roundNo, setRoundNo] = React.useState<number>(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [roundId, setRoundId] = React.useState<string | undefined>();
  const [results, setResults] = React.useState<any[] | null>(null);
  const [hostPick, setHostPick] = React.useState<string>('A');
  const isHost = !!(user?.id && hostUserId && user.id === hostUserId);
  const [submittedLeftSec, setSubmittedLeftSec] = React.useState<number | null>(null);
  const [roundAnswers, setRoundAnswers] = React.useState<Record<string, {name?:string;place?:string;plant?:string;animal?:string;thing?:string}>>({});
  // Validation is always strict now
  const [submitEndsRoundFlag, setSubmitEndsRoundFlag] = React.useState<boolean>(!!location.state?.submitEndsRound);
  const [hintsEnabledFlag, setHintsEnabledFlag] = React.useState<boolean>(!!location.state?.hintsEnabled);
  const [hintLoading, setHintLoading] = React.useState<boolean>(false);
  const [hintText, setHintText] = React.useState<string | null>(null);
  const [hintUsed, setHintUsed] = React.useState<boolean>(false);
  const [hintCategory, setHintCategory] = React.useState<'name'|'place'|'plant'|'animal'|'thing'>('name');
  const [endOnFirstSubmitFlag, setEndOnFirstSubmitFlag] = React.useState<boolean>(!!location.state?.endOnFirstSubmit);
  const [hintsMap, setHintsMap] = React.useState<{name?:string|null; place?:string|null; plant?:string|null; animal?:string|null; thing?:string|null}>({});

  // Host-only: flip game to scoring and mark round ended
  async function endRoundNow() {
    if (!code || !roundId) return;
    if (!isHost) return; // Only host should authoritatively flip
    await supabase.from('letters_games').update({ phase: 'scoring' }).eq('code', code);
    await supabase.from('letters_rounds').update({ ended_at: new Date().toISOString(), status: 'scoring' }).eq('id', roundId);
    setPhase('scoring');
  }

  React.useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      if (!code) return;
      const { data } = await supabase
        .from('letters_games')
        .select('title, host_name, host_user_id, round_duration_sec, language, letter_mode, manual_letter, rounds_total, started_at, current_round_no, phase, validation_mode, submit_ends_round, hints_enabled, end_on_first_submit')
        .eq('code', code)
        .maybeSingle();
      if (!cancelled && data) {
        if (data.title) setGameTitle(data.title);
        if (data.host_name) setHostName(data.host_name);
        if (data.host_user_id) setHostUserId(data.host_user_id);
        if (!location.state?.roundDurationSec && typeof data.round_duration_sec === 'number') {
          setRoundDuration(data.round_duration_sec);
          setRemaining(data.round_duration_sec);
        }
        if (data.started_at) setStartedAt(data.started_at);
        if (data.language) setGameLang((data.language as 'en'|'ar'));
        if (data.letter_mode) setLetterMode((data.letter_mode as 'auto'|'manual'));
        if (data.manual_letter) setManualLetter(data.manual_letter);
        if (typeof data.rounds_total === 'number') setRoundsTotal(data.rounds_total);
        if (typeof data.current_round_no === 'number') setRoundNo(data.current_round_no);
        if (typeof data.phase === 'string') setPhase(data.phase as any);
        // validation_mode is enforced as 'strict' globally
        if (typeof data.submit_ends_round === 'boolean') setSubmitEndsRoundFlag(!!data.submit_ends_round);
        if (typeof data.hints_enabled === 'boolean') setHintsEnabledFlag(!!data.hints_enabled);
        if (typeof data.end_on_first_submit === 'boolean') setEndOnFirstSubmitFlag(!!data.end_on_first_submit);
      }
    }
    loadMeta();
    return () => { cancelled = true; };
  }, [code]);

  // Load hint usage status per player per round
  React.useEffect(() => {
    (async () => {
      setHintText(null);
      setHintsMap({});
      setHintUsed(false);
      if (!code || !user?.id || !roundNo) return;
      const { data } = await supabase
        .from('letters_hints_used')
        .select('id')
        .eq('game_code', code)
        .eq('round_no', roundNo)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setHintUsed(true);
    })();
  }, [code, user?.id, roundNo]);

  async function handleHint(cat: 'name'|'place'|'plant'|'animal'|'thing') {
    if (hintUsed || !hintsEnabledFlag || !code || !roundNo) return;
    setHintLoading(true);
    setHintText(null);
    try {
      // Enforce one-use-per-player-per-round server-side via unique constraint
      await supabase.from('letters_hints_used').insert({ game_code: code, round_no: roundNo, user_id: user?.id });
      setHintUsed(true);
      try {
        const payload: any = {
          game_code: code,
          round_no: roundNo,
          language: gameLang,
          letter: currentLetter,
          category: cat,
          partial: (values as any)[cat] || ''
        };
        const { data: res } = await supabase.functions.invoke('letters-hint', { body: payload });
        const text = res?.hint || res?.text || (language==='ar' ? 'كلمة شائعة مناسبة' : 'Common fitting word');
        setHintText(text);
        setHintsMap(prev => ({ ...prev, [cat]: text }));
        // Option A: auto-fill selected field only if it's empty; no auto-submit
        if (!(values as any)[cat]) {
          updateValue(cat as any, text);
        }
      } catch {
        setHintText(language==='ar' ? 'تلميح سريع غير متاح الآن.' : 'Quick hint is not available right now.');
      }
    } finally {
      setHintLoading(false);
    }
  }

  // Realtime: react when answers are inserted/updated to detect submission events
  React.useEffect(() => {
    if (!roundId) return;
    const ch = supabase.channel(`letters:submitted:${roundId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'letters_answers', filter: `round_id=eq.${roundId}` }, () => {
        if (phase === 'playing') {
          if (endOnFirstSubmitFlag) {
            // Race mode: host ends immediately on first submission
            endRoundNow();
          } else {
            checkAllSubmitted();
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'letters_answers', filter: `round_id=eq.${roundId}` }, () => {
        if (phase === 'playing') {
          if (endOnFirstSubmitFlag) {
            endRoundNow();
          } else {
            checkAllSubmitted();
          }
        }
      })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [roundId, phase, players, endOnFirstSubmitFlag]);

  React.useEffect(() => {
    setRemaining(roundDuration);
  }, [roundDuration]);

  React.useEffect(() => {
    let id: number | undefined;
    function compute() {
      if (!startedAt) {
        setRemaining(roundDuration);
        return;
      }
      const startedMs = new Date(startedAt).getTime();
      const nowMs = Date.now();
      const elapsed = Math.floor((nowMs - startedMs) / 1000);
      const left = Math.max(0, roundDuration - elapsed);
      setRemaining(left);
    }
    compute();
    id = window.setInterval(compute, 250) as unknown as number;
    return () => { if (id) clearInterval(id); };
  }, [roundDuration, startedAt]);

  // Realtime update for started_at in case client reaches Play before start
  React.useEffect(() => {
    if (!code) return;
    const channel = supabase.channel(`letters:play:${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'letters_games', filter: `code=eq.${code}` }, (payload: any) => {
        if (payload?.new?.started_at) setStartedAt(payload.new.started_at as string);
        if (typeof payload?.new?.round_duration_sec === 'number') setRoundDuration(payload.new.round_duration_sec as number);
        if (typeof payload?.new?.end_on_first_submit === 'boolean') setEndOnFirstSubmitFlag(!!payload?.new?.end_on_first_submit);
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [code]);

  // Deterministic auto letter per round
  function autoLetterForRound(c: string, lang: 'en'|'ar'|undefined, round: number) {
    const alphabet = (lang === 'ar')
      ? 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let seed = 0;
    for (let i = 0; i < c.length; i++) seed = (seed + c.charCodeAt(i) * (i + 1)) % alphabet.length;
    const idx = (seed + Math.max(0, round - 1)) % alphabet.length;
    return alphabet[idx] || alphabet[0];
  }

  // Load current letter when round or mode changes
  // CRITICAL: Only host computes letter. Players fetch from DB only.
  React.useEffect(() => {
    if (!code) return;
    if (!isHost) {
      // Non-host: don't compute, wait for DB sync
      return;
    }
    // Host only: compute and set letter
    if (letterMode === 'manual' && manualLetter) {
      setCurrentLetter(manualLetter);
    } else {
      setCurrentLetter(autoLetterForRound(code, gameLang, roundNo));
    }
    setHostPick(gameLang === 'ar' ? 'ا' : 'A');
  }, [letterMode, manualLetter, code, gameLang, roundNo, isHost]);

  // Ensure round row handling: host inserts, players fetch
  // CRITICAL FIX: Host inserts letter first, then ALL players (including host) fetch to ensure sync
  React.useEffect(() => {
    (async () => {
      if (!code || !startedAt || !roundNo) return;
      if (isHost) {
        if (!currentLetter) return;
        // Host: insert the computed letter into DB
        const up = await supabase
          .from('letters_rounds')
          .upsert({ game_code: code, round_no: roundNo, letter: currentLetter, status: 'playing', started_at: startedAt }, { onConflict: 'game_code,round_no' })
          .select('id, letter')
          .single();
        if (up.data?.id) setRoundId(up.data.id);
        // Host also syncs from DB to ensure consistency
        if (up.data?.letter && up.data.letter !== currentLetter) {
          setCurrentLetter(up.data.letter);
        }
      } else {
        // Non-host: ONLY fetch from DB, never compute locally
        let attempts = 0;
        const maxAttempts = 10;
        // Retry until we get the letter (wait for host to insert)
        while (attempts < maxAttempts) {
          const row = await supabase
            .from('letters_rounds')
            .select('id, letter, started_at')
            .eq('game_code', code)
            .eq('round_no', roundNo)
            .maybeSingle();
          if (row.data?.id) setRoundId(row.data.id);
          if (row.data?.letter) {
            setCurrentLetter(row.data.letter);
            if (row.data?.started_at) setStartedAt(row.data.started_at);
            break;
          }
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    })();
  }, [code, currentLetter, startedAt, roundNo, isHost]);


  async function checkAllSubmitted() {
    if (!roundId || players.length === 0) return false;
    // Only consider players with a user_id (authenticated)
    const expectedIds = players.map(p=>p.user_id).filter((id): id is string => !!id);
    // If some players don't have user_id (guest), skip early end to avoid false positives
    if (expectedIds.length !== players.length) return false;
    const { data: ans } = await supabase
      .from('letters_answers')
      .select('user_id, submitted_at')
      .eq('round_id', roundId);
    const submittedSet = new Set((ans||[]).filter(a=>a.submitted_at && a.user_id).map(a=>a.user_id as string));
    const all = expectedIds.every(id => submittedSet.has(id));
    if (all && phase === 'playing' && code) {
      // Always end early when everyone has submitted (host authoritative)
      if (isHost) {
        await supabase.from('letters_games').update({ phase: 'scoring' }).eq('code', code);
        await supabase.from('letters_rounds').update({ ended_at: new Date().toISOString(), status: 'scoring' }).eq('id', roundId);
        setPhase('scoring');
      }
      return all;
    }
    return false;
  }

  // When timer hits zero, transition to scoring (host only triggers the phase flip)
  React.useEffect(() => {
    if (remaining === 0 && phase === 'playing' && code) {
      (async () => {
        if (isHost) {
          await supabase.from('letters_games').update({ phase: 'scoring' }).eq('code', code);
          if (roundId) await supabase.from('letters_rounds').update({ ended_at: new Date().toISOString(), status: 'scoring' }).eq('id', roundId);
          setPhase('scoring');
        }
      })();
    }
  }, [remaining, phase, isHost, code, roundId]);

  // Safeguard: ensure roundId is present during scoring on all clients
  React.useEffect(() => {
    (async () => {
      if (phase !== 'scoring' || roundId || !code || !roundNo) return;
      const row = await supabase
        .from('letters_rounds')
        .select('id')
        .eq('game_code', code)
        .eq('round_no', roundNo)
        .maybeSingle();
      if (row.data?.id) setRoundId(row.data.id);
    })();
  }, [phase, roundId, code, roundNo]);

  // Realtime: keep the round letter and started_at in sync for all clients
  React.useEffect(() => {
    if (!code || !roundNo) return;
    const ch = supabase.channel(`letters:round:${code}:${roundNo}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'letters_rounds', filter: `game_code=eq.${code}` }, (payload: any) => {
        const rn = payload?.new?.round_no;
        if (typeof rn === 'number' && rn === roundNo) {
          if (payload?.new?.id && !roundId) setRoundId(payload.new.id as string);
          if (payload?.new?.letter && payload.new.letter !== currentLetter) setCurrentLetter(payload.new.letter as string);
          if (payload?.new?.started_at) setStartedAt(payload.new.started_at as string);
        }
      })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [code, roundNo, currentLetter, roundId]);

  // Subscribe to game phase changes (to catch 'done' or next round started by host)
  React.useEffect(() => {
    if (!code) return;
    const ch = supabase.channel(`letters:phase:${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'letters_games', filter: `code=eq.${code}` }, (payload: any) => {
        if (typeof payload?.new?.phase === 'string') setPhase(payload.new.phase as any);
        if (typeof payload?.new?.current_round_no === 'number') setRoundNo(payload.new.current_round_no as number);
        if (payload?.new?.started_at) setStartedAt(payload.new.started_at as string);
        if (typeof payload?.new?.submit_ends_round === 'boolean') setSubmitEndsRoundFlag(!!payload?.new?.submit_ends_round);
        if (typeof payload?.new?.hints_enabled === 'boolean') setHintsEnabledFlag(!!payload?.new?.hints_enabled);
        if (typeof payload?.new?.end_on_first_submit === 'boolean') setEndOnFirstSubmitFlag(!!payload?.new?.end_on_first_submit);
      })
      .subscribe();
    return () => { try { supabase.removeChannel(ch); } catch {} };
  }, [code]);

  // Navigate to final results on done
  React.useEffect(() => {
    if (phase === 'done' && code) {
      navigate(`/games/letters/results/${code}`);
    }
  }, [phase, code, navigate]);

  // When in scoring, host computes results once; others wait
  React.useEffect(() => {
    (async () => {
      if (phase !== 'scoring' || !code || !roundId || !gameLang || !currentLetter) return;
      // Check if already scored
      const { data: roundRow } = await supabase
        .from('letters_rounds')
        .select('scored_at')
        .eq('id', roundId)
        .maybeSingle();
      if (roundRow?.scored_at) return; // already done by host

      if (!isHost) return; // only host scores

      // Host fetches answers
      const { data: ans } = await supabase
        .from('letters_answers')
        .select('user_id, name, place, plant, animal, thing, submitted_at')
        .eq('round_id', roundId);
      const payload = {
        game_code: code,
        round_id: roundId,
        language: gameLang,
        letter: currentLetter,
        round_duration_sec: roundDuration,
        started_at: startedAt,
        answers: ans || [],
        validation_mode: 'strict',
      };
      try {
        const { data: res } = await supabase.functions.invoke('letters-teacher', { body: payload });
        const rows = res?.results || [];
        setResults(rows);
        if (rows.length) {
          const byId = new Map((ans||[]).map(a=>[a.user_id, a]));
          const roundRows = rows.map((r:any)=>{
            const a = byId.get(r.user_id) as any;
            const fields = {
              name: { value: a?.name || '', valid: !!r?.fields?.name?.valid, reason: r?.fields?.name?.reason || null },
              place: { value: a?.place || '', valid: !!r?.fields?.place?.valid, reason: r?.fields?.place?.reason || null },
              plant: { value: a?.plant || '', valid: !!r?.fields?.plant?.valid, reason: r?.fields?.plant?.reason || null },
              animal: { value: a?.animal || '', valid: !!r?.fields?.animal?.valid, reason: r?.fields?.animal?.reason || null },
              thing: { value: a?.thing || '', valid: !!r?.fields?.thing?.valid, reason: r?.fields?.thing?.reason || null },
            };
            return { game_code: code, round_id: roundId, user_id: r.user_id, base: r.base||0, bonus: r.bonus||0, total: r.total||0, fields };
          });
          // Upsert scores per (round_id, user_id)
          await supabase.from('letters_round_scores').upsert(roundRows, { onConflict: 'round_id,user_id' });
        }
        // Mark scored_at to gate other clients
        await supabase.from('letters_rounds').update({ scored_at: new Date().toISOString() }).eq('id', roundId);

        // If last round, end game (host authoritative)
        if (roundsTotal && roundNo >= roundsTotal) {
          await new Promise(r => setTimeout(r, 2000));
          await supabase.from('letters_games').update({ phase: 'done' }).eq('code', code);
          await supabase.from('letters_rounds').update({ status: 'done' }).eq('id', roundId);
          setPhase('done');
        }
      } catch {
        setResults(null);
      }
    })();
  }, [phase, code, roundId, gameLang, currentLetter, roundDuration, startedAt]);

  // Fetch answers for scoring UI (all clients) and keep a simple map for display
  React.useEffect(() => {
    (async () => {
      if (phase !== 'scoring' || !roundId) return;
      const { data } = await supabase
        .from('letters_answers')
        .select('user_id, name, place, plant, animal, thing')
        .eq('round_id', roundId);
      const map: Record<string, any> = {};
      (data||[]).forEach((a:any)=>{
        const key = String(a.user_id ?? 'null');
        map[key] = { name:a.name, place:a.place, plant:a.plant, animal:a.animal, thing:a.thing };
      });
      setRoundAnswers(map);
    })();
  }, [phase, roundId]);

  // Load round scores for breakdown and subscribe for updates
  React.useEffect(() => {
    (async () => {
      if (phase !== 'scoring' || !roundId) return;
      const { data } = await supabase
        .from('letters_round_scores')
        .select('user_id, base, bonus, total, fields')
        .eq('round_id', roundId);
      if (Array.isArray(data) && data.length) {
        const rows = data.map((r:any)=>({ user_id: r.user_id, base: r.base, bonus: r.bonus, total: r.total, fields: r.fields }));
        setResults(rows);
      }
      const ch = supabase.channel(`letters:lrs:${roundId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'letters_round_scores', filter: `round_id=eq.${roundId}` }, async () => {
          const { data } = await supabase
            .from('letters_round_scores')
            .select('user_id, base, bonus, total, fields')
            .eq('round_id', roundId);
          if (Array.isArray(data)) {
            const rows = data.map((r:any)=>({ user_id: r.user_id, base: r.base, bonus: r.bonus, total: r.total, fields: r.fields }));
            setResults(rows);
          }
        })
        .subscribe();
      return () => { try { supabase.removeChannel(ch); } catch {} };
    })();
  }, [phase, roundId]);

  async function handleSubmit() {
    if (submitting || submitted || !code || !roundId) return;
    setSubmitting(true);
    try {
      // Freeze local timer to current remaining
      if (startedAt) {
        const startedMs = new Date(startedAt).getTime();
        const nowMs = Date.now();
        const elapsed = Math.floor((nowMs - startedMs) / 1000);
        const left = Math.max(0, roundDuration - elapsed);
        setRemaining(left);
        setSubmittedLeftSec(left);
      }
      await supabase.from('letters_answers').upsert({
        game_code: code,
        round_id: roundId,
        user_id: user?.id || null,
        name: values.name || null,
        place: values.place || null,
        plant: values.plant || null,
        animal: values.animal || null,
        thing: values.thing || null,
        submitted_at: new Date().toISOString(),
        duration_ms: startedAt ? Math.max(0, Date.now() - new Date(startedAt).getTime()) : null,
      });
      setSubmitted(true);
      // Race mode: host will end via realtime listener; non-hosts do not flip locally
      if (endOnFirstSubmitFlag && phase === 'playing') {
        if (isHost) await endRoundNow();
      }
      // Regardless of race mode, if everyone has submitted, end early (host only)
      await checkAllSubmitted();
    } finally {
      setSubmitting(false);
    }
  }

  async function startNextRound() {
    if (!isHost || !code || !roundsTotal) return;
    const nextNo = roundNo + 1;
    const nextStarted = new Date().toISOString();
    const letter = (letterMode === 'manual' && hostPick) ? hostPick : autoLetterForRound(code!, gameLang!, nextNo);
    // Update game state
    await supabase.from('letters_games').update({
      current_round_no: nextNo,
      phase: 'playing',
      started_at: nextStarted,
    }).eq('code', code);
    // Insert new round row
    await supabase.from('letters_rounds').insert({
      game_code: code,
      round_no: nextNo,
      letter,
      status: 'playing',
      started_at: nextStarted,
    });
    // Reset local
    setRoundNo(nextNo);
    setPhase('playing');
    setStartedAt(nextStarted);
    setSubmitted(false);
    setValues({ name: '', place: '', plant: '', animal: '', thing: '' });
    setCurrentLetter(letter);
    setHintText(null);
    setHintsMap({});
    setHintUsed(false);
  }

  // When round number or started_at changes from host, align local state
  React.useEffect(() => {
    // This runs for all clients when host updates letters_games
    setSubmitted(false);
    setSubmittedLeftSec(null);
    setValues({ name: '', place: '', plant: '', animal: '', thing: '' });
    setResults(null);
    setHintText(null);
    setHintsMap({});
    setHintUsed(false);
  }, [roundNo, startedAt]);

  // Also unlock inputs whenever phase returns to 'playing'
  React.useEffect(() => {
    if (phase === 'playing') {
      setSubmitted(false);
      setSubmittedLeftSec(null);
    }
  }, [phase]);

  // Poll players list
  React.useEffect(() => {
    let active = true;
    async function fetchPlayers() {
      if (!code) return;
      const { data } = await supabase
        .from('letters_players')
        .select('user_id, name')
        .eq('game_code', code)
        .order('joined_at', { ascending: true });
      if (!active) return;
      if (Array.isArray(data)) setPlayers(data as any);
    }
    fetchPlayers();
    const id = setInterval(fetchPlayers, 2000);
    return () => { active = false; clearInterval(id); };
  }, [code]);

  function updateValue(k: keyof typeof values, v: string) {
    setValues(prev => ({ ...prev, [k]: v }));
  }

  return (
    <div className="container mx-auto p-3 max-w-4xl relative min-h-[100dvh]">
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
            {gameTitle || (language === 'ar' ? 'لعبة الحروف' : 'Letters Game')}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{language === 'ar' ? 'المضيف' : 'Host'}:</span>
          <span className="font-medium">{hostName || '-'}</span>
        </div>
      </div>

      <div className="glass-hero p-5 rounded-xl space-y-6 relative z-10 bg-white/60 dark:bg-gray-900/35">
        {location.state?.lateJoin && (
          <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 px-4 py-2">
            {language === 'ar'
              ? `تم بدء اللعبة بالفعل بواسطة ${location.state?.hostName || hostName || '-'}`
              : `Game already started by ${location.state?.hostName || hostName || '-'}`}
          </div>
        )}
        

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 bg-card/50">
            <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'الحرف' : 'Letter'}</div>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg flex items-center justify-center bg-gradient-to-br from-indigo-600 to-fuchsia-600 text-white shadow-md">
                <span className="text-3xl md:text-4xl font-black">{currentLetter || '-'}</span>
              </div>
              <div className={`ml-2 text-lg md:text-xl font-semibold tabular-nums ${remaining <= 10 ? 'text-red-600 animate-pulse' : ''}`}>{remaining}s</div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {language === 'ar' ? `الجولة ${roundNo} من ${roundsTotal ?? '-'}` : `Round ${roundNo} of ${roundsTotal ?? '-'}`}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {language === 'ar' ? 'اللغة' : 'Language'}: {gameLang === 'ar' ? (language === 'ar' ? 'العربية' : 'Arabic') : (language === 'ar' ? 'الإنجليزية' : 'English')}
            </div>
          </div>
          <div className="md:col-span-2 rounded-lg border p-4 bg-card/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'اسم' : 'Name'}</label>
                <input disabled={phase!=='playing' || submitted} placeholder={hintsMap.name || ''} className="mt-1 w-full rounded-md border px-3 py-2 bg-background" value={values.name} onChange={(e)=>updateValue('name', e.target.value)} />
                {hintsEnabledFlag && hintsMap.name && !values.name && (
                  <div className="mt-1 text-[11px] text-muted-foreground">{language==='ar'?'تلميح: ':'Hint: '}{hintsMap.name}</div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'مكان' : 'Place'}</label>
                <input disabled={phase!=='playing' || submitted} placeholder={hintsMap.place || ''} className="mt-1 w-full rounded-md border px-3 py-2 bg-background" value={values.place} onChange={(e)=>updateValue('place', e.target.value)} />
                {hintsEnabledFlag && hintsMap.place && !values.place && (
                  <div className="mt-1 text-[11px] text-muted-foreground">{language==='ar'?'تلميح: ':'Hint: '}{hintsMap.place}</div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'نبات' : 'Plant'}</label>
                <input disabled={phase!=='playing' || submitted} placeholder={hintsMap.plant || ''} className="mt-1 w-full rounded-md border px-3 py-2 bg-background" value={values.plant} onChange={(e)=>updateValue('plant', e.target.value)} />
                {hintsEnabledFlag && hintsMap.plant && !values.plant && (
                  <div className="mt-1 text-[11px] text-muted-foreground">{language==='ar'?'تلميح: ':'Hint: '}{hintsMap.plant}</div>
                )}
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'حيوان' : 'Animal'}</label>
                <input disabled={phase!=='playing' || submitted} placeholder={hintsMap.animal || ''} className="mt-1 w-full rounded-md border px-3 py-2 bg-background" value={values.animal} onChange={(e)=>updateValue('animal', e.target.value)} />
                {hintsEnabledFlag && hintsMap.animal && !values.animal && (
                  <div className="mt-1 text-[11px] text-muted-foreground">{language==='ar'?'تلميح: ':'Hint: '}{hintsMap.animal}</div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'شيء' : 'Thing'}</label>
                <input disabled={phase!=='playing' || submitted} placeholder={hintsMap.thing || ''} className="mt-1 w-full rounded-md border px-3 py-2 bg-background" value={values.thing} onChange={(e)=>updateValue('thing', e.target.value)} />
                {hintsEnabledFlag && hintsMap.thing && !values.thing && (
                  <div className="mt-1 text-[11px] text-muted-foreground">{language==='ar'?'تلميح: ':'Hint: '}{hintsMap.thing}</div>
                )}
              </div>
            </div>
            <div className="pt-3 flex items-center justify-between">
              {submittedLeftSec !== null && (
                <div className="text-xs text-muted-foreground">
                  {language==='ar' ? `استغرقت ${Math.max(0, roundDuration - (submittedLeftSec||0))}ث` : `You took ${Math.max(0, roundDuration - (submittedLeftSec||0))}s`}
                </div>
              )}
              {phase==='playing' ? (
                <div className="flex items-center gap-2">
                  {hintsEnabledFlag && (
                    <>
                      <select className="rounded-md border px-2 py-1 bg-background text-xs" value={hintCategory} onChange={(e)=>setHintCategory(e.target.value as any)}>
                        <option value="name">{language==='ar'?'اسم':'Name'}</option>
                        <option value="place">{language==='ar'?'مكان':'Place'}</option>
                        <option value="plant">{language==='ar'?'نبات':'Plant'}</option>
                        <option value="animal">{language==='ar'?'حيوان':'Animal'}</option>
                        <option value="thing">{language==='ar'?'شيء':'Thing'}</option>
                      </select>
                      <Button type="button" variant="secondary" disabled={hintUsed || hintLoading || submitted} onClick={()=>handleHint(hintCategory)}>
                        {hintUsed ? (language==='ar'?'تم استخدام التلميح':'Hint used') : (hintLoading ? (language==='ar'?'...':'...') : (language==='ar'?'تلميح سريع':'Quick Hint'))}
                      </Button>
                    </>
                  )}
                  <Button disabled={submitted || submitting} className="bg-indigo-600 hover:bg-indigo-700" onClick={handleSubmit}>
                    {submitted ? (language==='ar'?'تم الإرسال':'Submitted') : (submitting ? (language==='ar'?'جارٍ...':'Submitting...') : (language === 'ar' ? 'إرسال' : 'Submit'))}
                  </Button>
                </div>
              ) : null}
            </div>
            {/* per-field hint helper moved inline with fields below */}
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-card/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">{language === 'ar' ? 'اللاعبون' : 'Players'}</div>
            <div className="text-xs text-muted-foreground">{language==='ar' ? (phase==='scoring'?'عرض النتائج':'قيد اللعب') : (phase==='scoring'?'Showing results':'Playing')}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {players.map((p, i) => {
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
            })}
            {players.length === 0 && (
              <span className="text-xs text-muted-foreground">{language === 'ar' ? 'لا يوجد لاعبين بعد' : 'No players yet'}</span>
            )}
          </div>

          {phase==='scoring' && (
            <div className="mt-2 rounded-md border p-3 bg-muted/30">
              <div className="text-sm font-medium mb-2">{language==='ar'?'النتائج':'Results'}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {players.map((p, idx) => {
                  const r = (results || []).find((x:any)=>x.user_id===p.user_id);
                  const uidKey = String(p.user_id ?? 'null');
                  return (
                    <div key={(uidKey||'u')+idx} className="rounded-md border bg-card p-2 text-sm">
                      <div className="font-medium mb-1">{p.name}</div>
                      <div className="flex flex-col gap-1 text-xs">
                        {(['name','place','plant','animal','thing'] as const).map(key => {
                          const label = language==='ar' ? ({name:'اسم',place:'مكان',plant:'نبات',animal:'حيوان',thing:'شيء'} as any)[key] : key;
                          const resField:any = r?.fields?.[key];
                          const value = (resField?.value ?? roundAnswers?.[uidKey]?.[key] ?? '') as string;
                          const valid = (typeof resField?.valid === 'boolean') ? !!resField.valid : null;
                          const reason = resField?.reason || '';
                          const baseCls = valid===true ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
                                        : valid===false ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/20 dark:text-rose-200'
                                        : 'bg-muted text-muted-foreground';
                          return (
                            <div key={key} className={`px-2 py-1 rounded ${baseCls}`}>
                              <div className="flex items-center justify-between">
                                <span className="mr-2">{label}</span>
                                <span className="truncate max-w-[14rem] opacity-90">{String(value || '')}</span>
                                <span className="ml-2">{valid===true ? '✓' : valid===false ? '✗' : '…'}</span>
                              </div>
                              {valid===false && reason && (
                                <div className="mt-0.5 text-[11px] opacity-80">{String(reason)}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{language==='ar'?'المجموع':'Total'}: {r?.total ?? 0} {r?.bonus?`(+${r.bonus})`:''}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {phase==='scoring' && roundsTotal && roundNo < roundsTotal && (
            <div className="mt-3 flex items-center justify-between gap-3">
              {isHost ? (
                <>
                  {letterMode === 'manual' ? (
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{language==='ar'?'اختر الحرف للجولة التالية':'Pick letter for next round'}</div>
                      <select className="rounded-md border px-2 py-1 bg-background" value={hostPick} onChange={(e)=>setHostPick(e.target.value)}>
                        {(gameLang === 'ar' ? 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ').split('').map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={startNextRound}>
                        {language==='ar'?'بدء الجولة التالية':'Start next round'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-muted-foreground">{language==='ar'?'الوضع تلقائي: سيتم اختيار الحرف تلقائيًا':'Auto mode: next letter is automatic'}</div>
                      <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={startNextRound}>
                        {language==='ar'?'بدء الجولة التالية':'Start next round'}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">{letterMode==='manual' ? (language==='ar'?'بانتظار اختيار المضيف للجولة التالية...':'Waiting for host to pick next round letter...') : (language==='ar'?'بانتظار بدء الجولة التالية...':'Waiting for next round to start...')}</div>
              )}
            </div>
          )}
        </div>

        
      </div>
    </div>
  );
}
