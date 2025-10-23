import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import LettersBackdrop from '@/components/letters/LettersBackdrop';
import { ArrowLeft, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function LettersPlay() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const { code } = useParams();
  const location = useLocation() as { state?: { roundDurationSec?: number, lateJoin?: boolean, hostName?: string } };
  const [gameTitle, setGameTitle] = React.useState<string | undefined>();
  const [hostName, setHostName] = React.useState<string | undefined>();
  const [gameLang, setGameLang] = React.useState<'en'|'ar'|undefined>();
  const [letterMode, setLetterMode] = React.useState<'auto'|'manual'|undefined>();
  const [manualLetter, setManualLetter] = React.useState<string | undefined>();
  const [roundsTotal, setRoundsTotal] = React.useState<number | undefined>();
  const [players, setPlayers] = React.useState<Array<{ user_id: string | null; name: string }>>([]);
  const [roundDuration, setRoundDuration] = React.useState<number>(location.state?.roundDurationSec || 60);
  const [remaining, setRemaining] = React.useState<number>(roundDuration);
  const [currentLetter, setCurrentLetter] = React.useState<string>('');
  const [values, setValues] = React.useState<{name:string;place:string;plant:string;animal:string;thing:string}>({name:'',place:'',plant:'',animal:'',thing:''});

  React.useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      if (!code) return;
      const { data } = await supabase
        .from('letters_games')
        .select('title, host_name, round_duration_sec, language, letter_mode, manual_letter, rounds_total')
        .eq('code', code)
        .maybeSingle();
      if (!cancelled && data) {
        if (data.title) setGameTitle(data.title);
        if (data.host_name) setHostName(data.host_name);
        if (!location.state?.roundDurationSec && typeof data.round_duration_sec === 'number') {
          setRoundDuration(data.round_duration_sec);
          setRemaining(data.round_duration_sec);
        }
        if (data.language) setGameLang((data.language as 'en'|'ar'));
        if (data.letter_mode) setLetterMode((data.letter_mode as 'auto'|'manual'));
        if (data.manual_letter) setManualLetter(data.manual_letter);
        if (typeof data.rounds_total === 'number') setRoundsTotal(data.rounds_total);
      }
    }
    loadMeta();
    return () => { cancelled = true; };
  }, [code]);

  React.useEffect(() => {
    setRemaining(roundDuration);
  }, [roundDuration]);

  React.useEffect(() => {
    const start = Date.now();
    let raf: number;
    function tick() {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, roundDuration - elapsed);
      setRemaining(left);
      if (left > 0) {
        raf = window.setTimeout(tick, 250) as unknown as number;
      }
    }
    tick();
    return () => {
      if (raf) clearTimeout(raf);
    };
  }, [roundDuration]);

  // Compute a deterministic auto letter if needed
  React.useEffect(() => {
    function letterFromCode(c: string) {
      const alphabet = (gameLang === 'ar')
        ? 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let sum = 0;
      for (let i = 0; i < c.length; i++) sum = (sum + c.charCodeAt(i) * (i + 1)) % alphabet.length;
      return alphabet[sum] || alphabet[0];
    }
    if (letterMode === 'manual' && manualLetter) {
      setCurrentLetter(manualLetter);
    } else if (code) {
      setCurrentLetter(letterFromCode(code));
    }
  }, [letterMode, manualLetter, code, gameLang]);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            <span className="font-medium">{language === 'ar' ? 'الوقت المتبقي' : 'Time remaining'}:</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">{remaining}s</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border p-4 bg-card/50">
            <div className="text-xs text-muted-foreground mb-1">{language === 'ar' ? 'الحرف' : 'Letter'}</div>
            <div className="text-3xl font-extrabold tracking-wide">{currentLetter || '-'}</div>
            <div className="mt-3 text-xs text-muted-foreground">
              {language === 'ar' ? 'الجولات' : 'Rounds'}: {roundsTotal ?? '-'}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {language === 'ar' ? 'اللغة' : 'Language'}: {gameLang === 'ar' ? (language === 'ar' ? 'العربية' : 'Arabic') : (language === 'ar' ? 'الإنجليزية' : 'English')}
            </div>
          </div>
          <div className="md:col-span-2 rounded-lg border p-4 bg-card/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'اسم' : 'Name'}</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2 bg-background" value={values.name} onChange={(e)=>updateValue('name', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'مكان' : 'Place'}</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2 bg-background" value={values.place} onChange={(e)=>updateValue('place', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'نبات' : 'Plant'}</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2 bg-background" value={values.plant} onChange={(e)=>updateValue('plant', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'حيوان' : 'Animal'}</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2 bg-background" value={values.animal} onChange={(e)=>updateValue('animal', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">{language === 'ar' ? 'شيء' : 'Thing'}</label>
                <input className="mt-1 w-full rounded-md border px-3 py-2 bg-background" value={values.thing} onChange={(e)=>updateValue('thing', e.target.value)} />
              </div>
            </div>
            <div className="pt-3 flex justify-end">
              <Button className="bg-indigo-600 hover:bg-indigo-700">{language === 'ar' ? 'إرسال' : 'Submit'}</Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-card/50">
          <div className="text-sm font-medium mb-2">{language === 'ar' ? 'اللاعبون' : 'Players'}</div>
          <div className="flex flex-wrap gap-2">
            {players.map((p, i) => (
              <span key={(p.user_id ?? 'anon') + i} className="inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs">
                {p.name}
              </span>
            ))}
            {players.length === 0 && (
              <span className="text-xs text-muted-foreground">{language === 'ar' ? 'لا يوجد لاعبين بعد' : 'No players yet'}</span>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={()=>setRoundDuration((d)=>d)}>{language === 'ar' ? 'تحديث المؤقت' : 'Refresh timer'}</Button>
        </div>
      </div>
    </div>
  );
}
