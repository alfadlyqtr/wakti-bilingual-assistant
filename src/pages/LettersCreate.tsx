import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/providers/ThemeProvider';
import { AppLayout } from '@/components/AppLayout';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Copy, ArrowLeft } from 'lucide-react';
import LettersBackdrop from '@/components/letters/LettersBackdrop';

export default function LettersCreate() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [gameTitle, setGameTitle] = useState('');
  const [langChoice, setLangChoice] = useState<'ar'|'en'>('en');
  const [letterMode, setLetterMode] = useState<'auto'|'manual'>('auto');
  const [manualLetter, setManualLetter] = useState('A');
  const [roundsMode, setRoundsMode] = useState<'1'|'3'|'custom'>('1');
  const [customRounds, setCustomRounds] = useState(1);
  const [gameCode, setGameCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState<number>(5);

  const EN_LETTERS = useMemo(()=>"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),[]);

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
            {language === 'ar' ? 'إنشاء لعبة مشتركة' : 'Create shared game'}
          </h1>
        </div>
      </div>

      <div className="glass-hero p-5 rounded-xl space-y-5 relative z-10 bg-white/60 dark:bg-gray-900/35">
        <p className="text-sm text-muted-foreground">
          {language === 'ar' ? 'حتى 5 لاعبين فقط' : 'Up to 5 players only'}
        </p>
        <div className="space-y-2">
          <Label htmlFor="letters-title">{language === 'ar' ? 'العنوان' : 'Title'}</Label>
          <Input id="letters-title" value={gameTitle} onChange={(e)=>setGameTitle(e.target.value)} placeholder={language === 'ar' ? 'أدخل عنوانًا جميلًا للعبة' : 'Give your game a nice title'} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{language === 'ar' ? 'لغة اللعبة' : 'Game language'}</Label>
            <Select value={langChoice} onValueChange={(v)=>setLangChoice(v as 'ar'|'en')}>
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
            <RadioGroup value={letterMode} onValueChange={(v)=>setLetterMode(v as 'auto'|'manual')} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="auto" id="letter-auto" />
                <Label htmlFor="letter-auto">{language === 'ar' ? 'تلقائي' : 'Auto'}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manual" id="letter-manual" />
                <Label htmlFor="letter-manual">{language === 'ar' ? 'يدوي' : 'Manual'}</Label>
              </div>
            </RadioGroup>
            {letterMode === 'manual' && (
              <Select value={manualLetter} onValueChange={setManualLetter}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={language === 'ar' ? 'اختر حرفًا' : 'Pick a letter'} />
                </SelectTrigger>
                <SelectContent className="max-h-64 overflow-auto">
                  {EN_LETTERS.map(l => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{language === 'ar' ? 'الجولات' : 'Rounds'}</Label>
          <RadioGroup value={roundsMode} onValueChange={(v)=>setRoundsMode(v as '1'|'3'|'custom')} className="flex gap-4">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="1" id="rounds-1" />
              <Label htmlFor="rounds-1">{language === 'ar' ? '١' : '1'}</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="3" id="rounds-3" />
              <Label htmlFor="rounds-3">{language === 'ar' ? '٣' : '3'}</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="custom" id="rounds-custom" />
              <Label htmlFor="rounds-custom">{language === 'ar' ? 'مخصص' : 'Custom'}</Label>
            </div>
          </RadioGroup>
          {roundsMode === 'custom' && (
            <div className="mt-2">
              <Input type="number" min={1} max={10} value={customRounds} onChange={(e)=>setCustomRounds(parseInt(e.target.value||'1',10))} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>{language === 'ar' ? 'عدد اللاعبين' : 'Number of players'}</Label>
          <Select value={String(maxPlayers)} onValueChange={(v)=>setMaxPlayers(parseInt(v,10))}>
            <SelectTrigger>
              <SelectValue placeholder={language === 'ar' ? 'اختر عدد اللاعبين (حتى 5)' : 'Select number of players (up to 5)'} />
            </SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5].map(n => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{language === 'ar' ? 'الحد الأقصى ٥ لاعبين' : 'Maximum 5 players'}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="letters-code">{language === 'ar' ? 'رمز اللعبة' : 'Game code'}</Label>
          <div className="flex gap-2">
            <Input id="letters-code" value={gameCode} onChange={(e)=>setGameCode(e.target.value.toUpperCase())} placeholder={language === 'ar' ? 'رمز اختياري للمشاركة' : 'Optional code to share'} />
            <Button type="button" variant="secondary" onClick={()=>setGameCode('W' + Array.from({length:5},()=>String.fromCharCode(65+Math.floor(Math.random()*26))).join(''))}>{language === 'ar' ? 'توليد' : 'Generate'}</Button>
            <Button type="button" variant="outline" onClick={async()=>{ if(!gameCode) return; try{ await navigator.clipboard.writeText(gameCode); setCopied(true); setTimeout(()=>setCopied(false), 1500);}catch{}}}>
              <Copy className="mr-2 h-4 w-4" />{copied ? (language === 'ar' ? 'نُسخ' : 'Copied') : (language === 'ar' ? 'نسخ' : 'Copy')}
            </Button>
          </div>
        </div>

        <div className="pt-2">
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate('/games/letters/waiting', { state: { isHost: true, gameCode, maxPlayers, gameTitle, hostName: language === 'ar' ? 'أنت' : 'You' } })}>
            {language === 'ar' ? 'إنشاء' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}
