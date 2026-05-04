import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LettersBackdrop from '@/components/letters/LettersBackdrop';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Brain, Sparkles, Timer } from 'lucide-react';

type LettersAiConfig = {
  title: string;
  language: 'en' | 'ar';
  letterMode: 'auto' | 'manual';
  manualLetter: string | null;
  roundsTotal: number;
  roundDurationSec: number;
  hintsEnabled: boolean;
  countdownSec: number;
};

type CategoryKey = 'name' | 'place' | 'plant' | 'animal' | 'thing';

type ValuesState = Record<CategoryKey, string>;

type RoundScoreRow = {
  user_id: string | null;
  base: number;
  bonus: number;
  total: number;
  fields?: Record<string, { valid?: boolean; reason?: string | null }>;
};

type RoundResult = {
  roundNo: number;
  letter: string;
  answers: Record<string, ValuesState>;
  scores: RoundScoreRow[];
};

const AI_CONFIG_STORAGE_KEY = 'wakti_letters_ai_config';
const EMPTY_VALUES: ValuesState = { name: '', place: '', plant: '', animal: '', thing: '' };
const CATEGORY_ORDER: CategoryKey[] = ['name', 'place', 'plant', 'animal', 'thing'];

export default function LettersAiPlay() {
  const { language } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: LettersAiConfig };
  const [config, setConfig] = useState<LettersAiConfig | null>(() => {
    if (location.state) return location.state;
    try {
      const raw = sessionStorage.getItem(AI_CONFIG_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LettersAiConfig) : null;
    } catch {
      return null;
    }
  });
  const [phase, setPhase] = useState<'countdown' | 'playing' | 'scoring' | 'done'>(config ? 'countdown' : 'done');
  const [roundNo, setRoundNo] = useState(1);
  const [countdownLeft, setCountdownLeft] = useState(config?.countdownSec ?? 3);
  const [remaining, setRemaining] = useState(config?.roundDurationSec ?? 60);
  const [currentLetter, setCurrentLetter] = useState('');
  const [values, setValues] = useState<ValuesState>(EMPTY_VALUES);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roundStartedAt, setRoundStartedAt] = useState<string | null>(null);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isArabic = language === 'ar';
  const playerName = useMemo(() => {
    return (user?.user_metadata?.full_name
      || user?.user_metadata?.display_name
      || user?.user_metadata?.username
      || user?.email?.split('@')[0]
      || (isArabic ? 'أنت' : 'You')) as string;
  }, [isArabic, user?.email, user?.user_metadata]);

  React.useEffect(() => {
    if (config) return;
    setLoadError(isArabic ? 'تعذر تحميل إعدادات مباراة الذكاء الاصطناعي.' : 'Could not load the AI match settings.');
  }, [config, isArabic]);

  React.useEffect(() => {
    if (!config) return;
    const nextLetter = getLetterForRound(config, roundNo);
    setCurrentLetter(nextLetter);
    setCountdownLeft(config.countdownSec);
    setRemaining(config.roundDurationSec);
    setValues(EMPTY_VALUES);
    setSubmitted(false);
    setSubmitting(false);
    setHintText(null);
    setHintUsed(false);
    setCurrentResult(null);
    setRoundStartedAt(null);
    setPhase('countdown');
  }, [config, roundNo]);

  React.useEffect(() => {
    if (!config || phase !== 'countdown') return;
    if (countdownLeft <= 0) {
      setRoundStartedAt(new Date().toISOString());
      setPhase('playing');
      setRemaining(config.roundDurationSec);
      return;
    }
    const timer = window.setTimeout(() => setCountdownLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [config, countdownLeft, phase]);

  React.useEffect(() => {
    if (!config || phase !== 'playing' || submitted || submitting) return;
    if (remaining <= 0) {
      void handleSubmit();
      return;
    }
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [config, phase, remaining, submitted, submitting]);

  function updateValue(key: CategoryKey, nextValue: string) {
    setValues((prev) => ({ ...prev, [key]: nextValue }));
  }

  function getLetterForRound(activeConfig: LettersAiConfig, activeRound: number) {
    if (activeConfig.letterMode === 'manual' && activeConfig.manualLetter) return activeConfig.manualLetter;
    const alphabet = activeConfig.language === 'ar'
      ? 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const seedSource = `${activeConfig.title}:${activeConfig.language}`;
    let seed = 0;
    for (let index = 0; index < seedSource.length; index += 1) {
      seed = (seed + seedSource.charCodeAt(index) * (index + 1)) % alphabet.length;
    }
    const letterIndex = (seed + Math.max(0, activeRound - 1)) % alphabet.length;
    return alphabet[letterIndex] || alphabet[0];
  }

  async function requestHint(category: CategoryKey, partial: string) {
    if (!config) return null;
    const payload = {
      game_code: `letters-ai-${roundNo}`,
      round_no: roundNo,
      language: config.language,
      letter: currentLetter,
      category,
      partial,
    };
    const { data } = await supabase.functions.invoke('letters-hint', { body: payload });
    return (data?.hint || data?.text || '').trim() || null;
  }

  async function handleHint(category: CategoryKey) {
    if (!config || hintUsed || !config.hintsEnabled || phase !== 'playing') return;
    setHintLoading(true);
    setHintText(null);
    try {
      const hint = await requestHint(category, values[category]);
      if (hint) {
        setHintUsed(true);
        setHintText(hint);
        if (!values[category]) {
          updateValue(category, hint);
        }
      } else {
        setHintText(isArabic ? 'لا يوجد تلميح متاح الآن.' : 'No hint is available right now.');
      }
    } catch {
      setHintText(isArabic ? 'تعذر جلب التلميح الآن.' : 'Could not fetch a hint right now.');
    } finally {
      setHintLoading(false);
    }
  }

  async function buildAiAnswers() {
    const aiAnswers = { ...EMPTY_VALUES };
    await Promise.all(CATEGORY_ORDER.map(async (category) => {
      try {
        const suggestion = await requestHint(category, '');
        aiAnswers[category] = suggestion || '';
      } catch {
        aiAnswers[category] = '';
      }
    }));
    return aiAnswers;
  }

  async function handleSubmit() {
    if (!config || phase !== 'playing' || submitting || submitted) return;
    setSubmitting(true);
    setSubmitted(true);
    setHintText(null);
    try {
      const aiAnswers = await buildAiAnswers();
      const submittedAt = new Date().toISOString();
      const aiSubmittedAt = new Date(new Date(roundStartedAt || submittedAt).getTime() + Math.max(15000, Math.floor(config.roundDurationSec * 650))).toISOString();
      const payload = {
        game_code: `letters-ai-${Date.now()}`,
        round_id: `letters-ai-round-${roundNo}`,
        language: config.language,
        letter: currentLetter,
        round_duration_sec: config.roundDurationSec,
        started_at: roundStartedAt || submittedAt,
        validation_mode: 'strict',
        answers: [
          {
            user_id: 'human-player',
            ...values,
            submitted_at: submittedAt,
          },
          {
            user_id: 'ai-player',
            ...aiAnswers,
            submitted_at: aiSubmittedAt,
          },
        ],
      };
      const { data } = await supabase.functions.invoke('letters-teacher', { body: payload });
      const resultRows = Array.isArray(data?.results) ? (data.results as RoundScoreRow[]) : [];
      const roundResult: RoundResult = {
        roundNo,
        letter: currentLetter,
        answers: {
          'human-player': { ...values },
          'ai-player': aiAnswers,
        },
        scores: resultRows,
      };
      setCurrentResult(roundResult);
      setHistory((prev) => [...prev, roundResult]);
      if (roundNo >= config.roundsTotal) {
        setPhase('done');
      } else {
        setPhase('scoring');
      }
    } catch {
      setLoadError(isArabic ? 'تعذر احتساب الجولة الآن.' : 'Could not score the round right now.');
      setSubmitted(false);
    } finally {
      setSubmitting(false);
    }
  }

  function nextRound() {
    if (!config) return;
    if (roundNo >= config.roundsTotal) {
      setPhase('done');
      return;
    }
    setRoundNo((value) => value + 1);
  }

  function totalFor(userId: string) {
    return history.reduce((sum, round) => {
      const score = round.scores.find((row) => row.user_id === userId)?.total || 0;
      return sum + score;
    }, 0);
  }

  function labelFor(userId: string | null) {
    if (userId === 'ai-player') return isArabic ? 'الذكاء الاصطناعي' : 'AI';
    return playerName;
  }

  const finalRows = useMemo(() => {
    const totals = [
      { user_id: 'human-player', total: totalFor('human-player') },
      { user_id: 'ai-player', total: totalFor('ai-player') },
    ];
    return totals.sort((first, second) => second.total - first.total);
  }, [history, playerName]);

  if (!config) {
    return (
      <div className="container mx-auto p-4 max-w-3xl min-h-[100dvh] flex items-center justify-center">
        <div className="rounded-xl border bg-card p-6 text-center space-y-4">
          <div className="text-lg font-semibold">{loadError || (isArabic ? 'تحميل...' : 'Loading...')}</div>
          <Button onClick={() => navigate('/games')}>{isArabic ? 'العودة إلى الألعاب' : 'Back to Games'}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 max-w-5xl relative min-h-[100dvh]">
      <LettersBackdrop density={60} />

      <div className="glass-hero px-5 py-4 mb-4 flex items-center justify-between gap-3 relative z-10 bg-white/60 dark:bg-gray-900/35">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/games/letters/ai')}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 bg-card text-foreground hover:bg-accent transition shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">{isArabic ? 'رجوع' : 'Back'}</span>
          </button>
          <div>
            <h1 className="text-xl font-semibold text-[#060541] dark:text-white">{config.title}</h1>
            <p className="text-sm text-muted-foreground">{isArabic ? 'مباراة كاملة ضد الذكاء الاصطناعي' : 'A full match against AI'}</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Brain className="h-4 w-4" />
          {isArabic ? 'خصم حي' : 'Live AI Opponent'}
        </div>
      </div>

      <div className="glass-hero p-5 rounded-xl space-y-6 relative z-10 bg-white/60 dark:bg-gray-900/35">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{isArabic ? `الجولة ${roundNo} من ${config.roundsTotal}` : `Round ${roundNo} of ${config.roundsTotal}`}</div>
            <div className="mt-1 text-3xl font-black text-[#060541] dark:text-white">{currentLetter}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-2">
              <Timer className="h-4 w-4" />
              {phase === 'countdown'
                ? (isArabic ? `تبدأ خلال ${countdownLeft}` : `Starts in ${countdownLeft}`)
                : phase === 'playing'
                  ? `${remaining}s`
                  : (isArabic ? 'احتساب النتائج' : 'Scoring')}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-2">
              <Sparkles className="h-4 w-4" />
              {config.language === 'ar' ? (isArabic ? 'العربية' : 'Arabic') : (isArabic ? 'الإنجليزية' : 'English')}
            </div>
          </div>
        </div>

        {loadError && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
            {loadError}
          </div>
        )}

        {phase !== 'done' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border bg-card/60 p-4 space-y-3">
              {CATEGORY_ORDER.map((category) => (
                <div key={category} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-[#060541] dark:text-white">
                      {categoryLabel(category, isArabic)}
                    </label>
                    {config.hintsEnabled && phase === 'playing' && (
                      <button
                        type="button"
                        disabled={hintLoading || hintUsed || submitted}
                        onClick={() => handleHint(category)}
                        className="text-xs font-medium text-emerald-700 disabled:opacity-50 dark:text-emerald-300"
                      >
                        {hintLoading ? (isArabic ? '...' : '...') : (isArabic ? 'تلميح' : 'Hint')}
                      </button>
                    )}
                  </div>
                  <Input
                    value={values[category]}
                    disabled={phase !== 'playing' || submitted}
                    onChange={(event) => updateValue(category, event.target.value)}
                    placeholder={inputPlaceholder(category, isArabic)}
                  />
                </div>
              ))}

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button variant="secondary" onClick={() => navigate('/games')}>
                  {isArabic ? 'إنهاء' : 'Exit'}
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={phase !== 'playing' || submitting || submitted} onClick={() => void handleSubmit()}>
                  {submitting ? (isArabic ? 'جارٍ الإرسال...' : 'Submitting...') : (isArabic ? 'إرسال الإجابات' : 'Submit Answers')}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card/60 p-4 space-y-4">
              <div>
                <div className="text-sm font-medium text-[#060541] dark:text-white">{isArabic ? 'المواجهة' : 'Matchup'}</div>
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border bg-white/70 px-4 py-3 dark:bg-black/20">
                    <div className="text-xs text-muted-foreground">{isArabic ? 'أنت' : 'You'}</div>
                    <div className="font-semibold mt-1">{playerName}</div>
                    <div className="text-sm text-muted-foreground mt-1">{isArabic ? 'العب نفس القواعد وسنحتسب النتيجة بالطريقة نفسها.' : 'You play by the same rules and get scored the same way.'}</div>
                  </div>
                  <div className="rounded-lg border bg-emerald-500/10 px-4 py-3">
                    <div className="text-xs text-emerald-700 dark:text-emerald-300">{isArabic ? 'الخصم' : 'Opponent'}</div>
                    <div className="font-semibold mt-1 text-[#060541] dark:text-white">{isArabic ? 'الذكاء الاصطناعي' : 'AI'}</div>
                    <div className="text-sm text-muted-foreground mt-1">{isArabic ? 'سيجيب في كل جولة ثم تُراجع الإجابات وتُحسب.' : 'It answers every round, then both sets are checked and scored.'}</div>
                  </div>
                </div>
              </div>

              {hintText && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                  {hintText}
                </div>
              )}

              {currentResult && (
                <div className="rounded-lg border bg-card/70 p-4 space-y-3">
                  <div className="text-sm font-medium">{isArabic ? 'نتيجة الجولة الحالية' : 'Current round result'}</div>
                  {currentResult.scores.map((row) => (
                    <div key={String(row.user_id)} className="rounded-md border bg-background/70 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{labelFor(row.user_id)}</div>
                        <div className="text-lg font-bold">{row.total}</div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{isArabic ? 'أساسي' : 'Base'}: {row.base} · {isArabic ? 'إضافي' : 'Bonus'}: {row.bonus}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {(phase === 'scoring' || phase === 'done') && currentResult && (
          <div className="rounded-xl border bg-card/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold text-[#060541] dark:text-white">{isArabic ? 'تفاصيل الجولة' : 'Round breakdown'}</div>
              {phase === 'scoring' ? (
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={nextRound}>
                  {roundNo >= config.roundsTotal ? (isArabic ? 'النتيجة النهائية' : 'Final result') : (isArabic ? 'الجولة التالية' : 'Next round')}
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {currentResult.scores.map((row) => {
                const answers = currentResult.answers[String(row.user_id)] || EMPTY_VALUES;
                return (
                  <div key={String(row.user_id)} className="rounded-lg border bg-background/70 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{labelFor(row.user_id)}</div>
                      <div className="text-xl font-bold">{row.total}</div>
                    </div>
                    <div className="space-y-2">
                      {CATEGORY_ORDER.map((category) => {
                        const field = row.fields?.[category];
                        const isValid = !!field?.valid;
                        return (
                          <div key={category} className={`rounded-md px-3 py-2 text-sm ${isValid ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200' : 'bg-rose-100 text-rose-900 dark:bg-rose-900/20 dark:text-rose-200'}`}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">{categoryLabel(category, isArabic)}</span>
                              <span className="truncate">{answers[category] || '-'}</span>
                            </div>
                            {!isValid && field?.reason ? <div className="mt-1 text-xs opacity-80">{field.reason}</div> : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="rounded-xl border bg-card/60 p-5 space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-[#060541] dark:text-white">{isArabic ? 'النتيجة النهائية' : 'Final result'}</h2>
              <p className="text-sm text-muted-foreground mt-1">{isArabic ? 'هذه نتيجة المباراة الكاملة ضد الذكاء الاصطناعي.' : 'This is the full match result against AI.'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {finalRows.map((row, index) => (
                <div key={row.user_id} className={`rounded-xl border p-5 ${index === 0 ? 'bg-emerald-500/10 border-emerald-300 dark:border-emerald-800' : 'bg-card'}`}>
                  <div className="text-xs text-muted-foreground">{index === 0 ? (isArabic ? 'الفائز' : 'Winner') : (isArabic ? 'المركز الثاني' : 'Runner-up')}</div>
                  <div className="mt-1 text-xl font-bold text-[#060541] dark:text-white">{labelFor(row.user_id)}</div>
                  <div className="mt-2 text-3xl font-black">{row.total}</div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border bg-background/60 p-4">
              <div className="text-sm font-medium mb-3">{isArabic ? 'كل الجولات' : 'All rounds'}</div>
              <div className="space-y-3">
                {history.map((round) => (
                  <div key={round.roundNo} className="rounded-md border bg-card px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{isArabic ? `الجولة ${round.roundNo}` : `Round ${round.roundNo}`}</div>
                      <div className="text-sm text-muted-foreground">{round.letter}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {round.scores.map((row) => (
                        <div key={String(row.user_id)} className="rounded-md border bg-background/70 px-3 py-2 flex items-center justify-between">
                          <span>{labelFor(row.user_id)}</span>
                          <span className="font-semibold">{row.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => navigate('/games/letters/ai')}>
                {isArabic ? 'إعداد مباراة جديدة' : 'New AI match'}
              </Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate('/games')}>
                {isArabic ? 'العودة إلى الألعاب' : 'Back to Games'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function categoryLabel(category: CategoryKey, isArabic: boolean) {
  if (!isArabic) return category.charAt(0).toUpperCase() + category.slice(1);
  return {
    name: 'الاسم',
    place: 'المكان',
    plant: 'النبات',
    animal: 'الحيوان',
    thing: 'الشيء',
  }[category];
}

function inputPlaceholder(category: CategoryKey, isArabic: boolean) {
  if (!isArabic) {
    return {
      name: 'Type a name',
      place: 'Type a place',
      plant: 'Type a plant',
      animal: 'Type an animal',
      thing: 'Type a thing',
    }[category];
  }
  return {
    name: 'اكتب اسمًا',
    place: 'اكتب مكانًا',
    plant: 'اكتب نباتًا',
    animal: 'اكتب حيوانًا',
    thing: 'اكتب شيئًا',
  }[category];
}
