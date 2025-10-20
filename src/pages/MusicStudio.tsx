import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';

export default function MusicStudio() {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState<'compose' | 'editor'>('compose');

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">{language === 'ar' ? 'استوديو الموسيقى' : 'Music Studio'}</h1>
        <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">{/* credits placeholder */}{language === 'ar' ? 'الرصيد: —' : 'Credits: —'}</span>
        </div>
      </header>

      <nav className="flex gap-2 border-b border-border pb-2">
        <Button variant={activeTab === 'compose' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('compose')}>
          {language === 'ar' ? 'إنشاء' : 'Compose'}
        </Button>
        <Button variant={activeTab === 'editor' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('editor')}>
          {language === 'ar' ? 'المحرر / المشروع' : 'Editor / Project'}
        </Button>
      </nav>

      {activeTab === 'compose' ? <ComposeTab /> : <EditorTab />}
    </div>
  );
}

function ComposeTab() {
  const { language } = useTheme();

  // Inputs
  const [prompt, setPrompt] = useState('');
  const [variations, setVariations] = useState(1);
  const [duration, setDuration] = useState(30); // seconds
  const [seedLocked, setSeedLocked] = useState(false);
  const [seed, setSeed] = useState<string>('');
  const [includeStyles, setIncludeStyles] = useState<string>('');
  const [excludeStyles, setExcludeStyles] = useState<string>('');
  const [bpm, setBpm] = useState<string>('');
  const [musicalKey, setMusicalKey] = useState<string>('');
  const [instrumentalOnly, setInstrumentalOnly] = useState(false);
  const [languageCode, setLanguageCode] = useState<'en' | 'ar'>('en');
  const [lyrics, setLyrics] = useState('');
  const [timingCues, setTimingCues] = useState('');
  const [promptInfluence, setPromptInfluence] = useState<number>(70);

  // 3000 character cap across request fields (prompt + lyrics + styles + cues)
  const totalChars = useMemo(() => {
    const fields = [prompt, lyrics, includeStyles, excludeStyles, timingCues];
    // Count by code points to be fair for Arabic/emojis
    const count = (s: string) => Array.from(s || '').length;
    return fields.reduce((acc, s) => acc + count(s), 0);
  }, [prompt, lyrics, includeStyles, excludeStyles, timingCues]);

  const limit = 3000;
  const remaining = Math.max(0, limit - totalChars);
  const overLimit = totalChars > limit;

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={language === 'ar' ? 'صِف أغنيتك...' : 'Describe your song...'}
            className="flex-1"
          />
          <Button disabled={overLimit}>
            {language === 'ar' ? 'إنشاء' : 'Generate'}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-1">
            <span>{variations}</span>
          </div>
          <div className="inline-flex items-center gap-1">
            <span>{formatDuration(duration)}</span>
          </div>
          <div className="inline-flex items-center gap-1">
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" checked={seedLocked} onChange={(e) => setSeedLocked(e.target.checked)} />
              <span>{language === 'ar' ? 'قفل البذرة' : 'Seed lock'}</span>
            </label>
            <Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="1234" className="h-7 w-24" />
          </div>
          <div className={`ml-auto font-medium ${overLimit ? 'text-red-600' : 'text-emerald-600'}`}>
            {language === 'ar' ? `المتبقي ${remaining} / 3000` : `${remaining} / 3000 remaining`}
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">{language === 'ar' ? 'أنماط مضمّنة' : 'Include styles'}</label>
            <Input value={includeStyles} onChange={(e)=>setIncludeStyles(e.target.value)} placeholder={language==='ar'? 'عود ناعم، رومانسي...' : 'soft oud, intimate, romantic...'} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">{language === 'ar' ? 'أنماط مستبعدة' : 'Exclude styles'}</label>
            <Input value={excludeStyles} onChange={(e)=>setExcludeStyles(e.target.value)} placeholder={language==='ar'? 'بدون طبول ثقيلة...' : 'no heavy drums, no harsh...'} />
          </div>
        </div>
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">BPM</label>
            <Input value={bpm} onChange={(e)=>setBpm(e.target.value)} placeholder="90" />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">{language === 'ar' ? 'المفتاح' : 'Key'}</label>
            <Input value={musicalKey} onChange={(e)=>setMusicalKey(e.target.value)} placeholder="A minor" />
          </div>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={instrumentalOnly} onChange={(e)=>setInstrumentalOnly(e.target.checked)} />
              <span>{language === 'ar' ? 'موسيقى فقط' : 'Instrumental only'}</span>
            </label>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">{language === 'ar' ? 'اللغة' : 'Language'}</label>
            <select className="w-full h-9 rounded-md border" value={languageCode} onChange={(e)=>setLanguageCode(e.target.value as any)}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">{language === 'ar' ? 'الكلمات (اختياري)' : 'Lyrics (optional)'}</label>
            <Textarea value={lyrics} onChange={(e)=>setLyrics(e.target.value)} rows={6} placeholder={language==='ar'? 'اكتب كلماتك هنا...' : 'Write your lyrics here...'} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">{language === 'ar' ? 'توقيت الغناء' : 'Timing cues'}</label>
            <Textarea value={timingCues} onChange={(e)=>setTimingCues(e.target.value)} rows={6} placeholder={language==='ar'? 'تبدأ الكلمات عند 0:15...' : 'lyrics begin at 0:15; instrumental only after 1:45...'} />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">{language === 'ar' ? 'التنوعات' : 'Variations'}</label>
            <Input type="number" min={1} max={5} value={variations} onChange={(e)=>setVariations(parseInt(e.target.value||'1'))} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">{language === 'ar' ? 'المدة (ثواني)' : 'Duration (seconds)'}</label>
            <Input type="number" min={10} max={300} value={duration} onChange={(e)=>setDuration(parseInt(e.target.value||'30'))} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">{language === 'ar' ? 'تأثير التوجيه' : 'Prompt influence'}</label>
            <input type="range" min={0} max={100} value={promptInfluence} onChange={(e)=>setPromptInfluence(parseInt(e.target.value))} className="w-full" />
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-5">
        <p className="text-sm text-muted-foreground">
          {language==='ar' ? 'سيتم عرض أحدث المشاريع هنا بعد الإنشاء. (هيكل فقط، بدون اتصال API)' : 'Recent projects will appear here after generation. (Skeleton only, no API)'}
        </p>
      </Card>
    </div>
  );
}

function EditorTab() {
  const { language } = useTheme();
  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">⏯</Button>
            <span className="text-sm text-muted-foreground">00:00 / 00:30</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">{language==='ar'?'حفظ':'Save'}</Button>
            <Button variant="outline" size="sm">{language==='ar'?'مشاركة':'Share'}</Button>
            <Button variant="outline" size="sm">{language==='ar'?'تنزيل':'Download'}</Button>
          </div>
        </div>
        <div className="mt-4 h-36 bg-muted/50 rounded-md flex items-center justify-center text-sm text-muted-foreground">
          {language==='ar' ? 'عنصر نائب للموجة الزمنية' : 'Timeline waveform placeholder'}
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 md:p-5">
          <h3 className="font-semibold mb-2">{language==='ar' ? 'المقاطع' : 'Sections'}</h3>
          <p className="text-sm text-muted-foreground">{language==='ar' ? 'قائمة المقاطع والقصائد (هيكل فقط)' : 'Section list and lyrics (skeleton only)'}</p>
        </Card>
        <Card className="p-4 md:p-5 md:col-span-2">
          <h3 className="font-semibold mb-2">{language==='ar' ? 'خصائص المقطع' : 'Section properties'}</h3>
          <p className="text-sm text-muted-foreground">{language==='ar' ? 'أسلوب، BPM، المفتاح، البذرة، مدّة (هيكل فقط)' : 'Style, BPM, key, seed, duration (skeleton only)'}</p>
        </Card>
      </div>
    </div>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
