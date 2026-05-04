import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Brain } from 'lucide-react';
import LettersBackdrop from '@/components/letters/LettersBackdrop';

const AI_CONFIG_STORAGE_KEY = 'wakti_letters_ai_config';

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

export default function LettersAiSetup() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [gameTitle, setGameTitle] = useState('');
  const [langChoice, setLangChoice] = useState<'ar' | 'en'>('en');
  const [letterMode, setLetterMode] = useState<'auto' | 'manual'>('auto');
  const [manualLetter, setManualLetter] = useState('A');
  const [roundsMode, setRoundsMode] = useState<'1' | '3' | 'custom'>('3');
  const [customRounds, setCustomRounds] = useState(5);
  const [durationMode, setDurationMode] = useState<'60' | '90' | 'custom'>('60');
  const [customDuration, setCustomDuration] = useState<number>(60);
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(true);

  const enLetters = useMemo(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), []);
  const arLetters = useMemo(() => 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.split(''), []);
  const currentAlphabet = useMemo(() => (langChoice === 'ar' ? arLetters : enLetters), [arLetters, enLetters, langChoice]);

  React.useEffect(() => {
    if (letterMode === 'manual' && !currentAlphabet.includes(manualLetter)) {
      setManualLetter(currentAlphabet[0]);
    }
  }, [currentAlphabet, letterMode, manualLetter]);

  function handleStart() {
    const config: LettersAiConfig = {
      title: gameTitle.trim() || (language === 'ar' ? 'لعبة الحروف ضد الذكاء الاصطناعي' : 'Letters vs AI'),
      language: langChoice,
      letterMode,
      manualLetter: letterMode === 'manual' ? manualLetter : null,
      roundsTotal: roundsMode === 'custom' ? Math.max(1, Math.min(10, customRounds || 1)) : parseInt(roundsMode, 10),
      roundDurationSec: durationMode === 'custom' ? Math.max(15, Math.min(300, customDuration || 60)) : parseInt(durationMode, 10),
      hintsEnabled,
      countdownSec: 3,
    };

    try {
      sessionStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {}

    navigate('/games/letters/ai/play', { state: config });
  }

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
          <h1 className="text-xl font-semibold tracking-tight text-[#060541] dark:text-white">
            {language === 'ar' ? 'ابدأ ضد الذكاء الاصطناعي' : 'Start against AI'}
          </h1>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <Brain className="h-4 w-4" />
          {language === 'ar' ? 'خصم ذكي' : 'Smart Opponent'}
        </div>
      </div>

      <div className="glass-hero p-5 rounded-xl space-y-5 relative z-10 bg-white/60 dark:bg-gray-900/35">
        <p className="text-sm text-muted-foreground">
          {language === 'ar'
            ? 'اضبط الجولة ثم ابدأ مباراة كاملة ضد الذكاء الاصطناعي.'
            : 'Choose your setup, then play a full match against AI.'}
        </p>

        <div className="space-y-2">
          <Label htmlFor="letters-ai-title">{language === 'ar' ? 'العنوان' : 'Title'}</Label>
          <Input
            id="letters-ai-title"
            value={gameTitle}
            onChange={(e) => setGameTitle(e.target.value)}
            placeholder={language === 'ar' ? 'مثال: تحدي الحروف' : 'Example: Letters Challenge'}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{language === 'ar' ? 'لغة اللعبة' : 'Game language'}</Label>
            <Select value={langChoice} onValueChange={(v) => setLangChoice(v as 'ar' | 'en')}>
              <SelectTrigger>
                <SelectValue placeholder={language === 'ar' ? 'اختر لغة اللعبة' : 'Select game language'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{language === 'ar' ? 'الإنجليزية' : 'English'}</SelectItem>
                <SelectItem value="ar">{language === 'ar' ? 'العربية' : 'Arabic'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{language === 'ar' ? 'الحرف' : 'Letter'}</Label>
            <RadioGroup value={letterMode} onValueChange={(v) => setLetterMode(v as 'auto' | 'manual')} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="auto" id="ai-letter-auto" />
                <Label htmlFor="ai-letter-auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manual" id="ai-letter-manual" />
                <Label htmlFor="ai-letter-manual">{language === 'ar' ? 'يدوي' : 'Manual'}</Label>
              </div>
            </RadioGroup>
            {letterMode === 'manual' && (
              <Select value={manualLetter} onValueChange={setManualLetter}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={language === 'ar' ? 'اختر حرفًا' : 'Pick a letter'} />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-auto">
                  {currentAlphabet.map((letterOption) => (
                    <SelectItem key={letterOption} value={letterOption}>{letterOption}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{language === 'ar' ? 'مدة الجولة (ثوانٍ)' : 'Round duration (seconds)'}</Label>
            <RadioGroup value={durationMode} onValueChange={(v) => setDurationMode(v as '60' | '90' | 'custom')} className="flex gap-6">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <RadioGroupItem id="ai-dur60" value="60" />
                <Label htmlFor="ai-dur60">60</Label>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <RadioGroupItem id="ai-dur90" value="90" />
                <Label htmlFor="ai-dur90">90</Label>
              </div>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <RadioGroupItem id="ai-durCustom" value="custom" />
                <Label htmlFor="ai-durCustom">{language === 'ar' ? 'مخصص' : 'Custom'}</Label>
              </div>
            </RadioGroup>
            {durationMode === 'custom' && (
              <div className="mt-2">
                <Input type="number" min={15} max={300} value={customDuration} onChange={(e) => setCustomDuration(parseInt(e.target.value || '60', 10))} />
                <p className="text-xs text-muted-foreground mt-1">{language === 'ar' ? 'بين 15 و 300 ثانية' : 'Between 15 and 300 seconds'}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>{language === 'ar' ? 'الجولات' : 'Rounds'}</Label>
            <RadioGroup value={roundsMode} onValueChange={(v) => setRoundsMode(v as '1' | '3' | 'custom')} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="1" id="ai-rounds-1" />
                <Label htmlFor="ai-rounds-1">{language === 'ar' ? '١' : '1'}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="3" id="ai-rounds-3" />
                <Label htmlFor="ai-rounds-3">{language === 'ar' ? '٣' : '3'}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="custom" id="ai-rounds-custom" />
                <Label htmlFor="ai-rounds-custom">{language === 'ar' ? 'مخصص' : 'Custom'}</Label>
              </div>
            </RadioGroup>
            {roundsMode === 'custom' && (
              <div className="mt-2">
                <Input type="number" min={1} max={10} value={customRounds} onChange={(e) => setCustomRounds(parseInt(e.target.value || '5', 10))} />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4 bg-card/40 flex items-start gap-3">
          <input id="ai-opt-hints" type="checkbox" className="mt-1" checked={hintsEnabled} onChange={(e) => setHintsEnabled(e.target.checked)} />
          <div>
            <label htmlFor="ai-opt-hints" className="font-medium text-sm cursor-pointer">
              {language === 'ar' ? 'تفعيل التلميحات (مرة واحدة كل جولة)' : 'Enable hints (once per round)'}
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {language === 'ar'
                ? 'يمكنك استخدام تلميح ذكي واحد في كل جولة.'
                : 'You can use one smart hint in each round.'}
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate('/games')}>
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleStart}>
            {language === 'ar' ? 'ابدأ المباراة' : 'Start match'}
          </Button>
        </div>
      </div>
    </div>
  );
}
