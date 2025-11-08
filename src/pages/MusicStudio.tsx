import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { AudioPlayer } from '@/components/music/AudioPlayer';
import { Info, Wand2, Trash2 } from 'lucide-react';

// Helper function to download audio files on mobile
const handleDownload = async (url: string, filename: string) => {
  try {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    const response = await fetch(url);
    const blob = await response.blob();
    
    // On iOS, use Share API if available for better UX
    if (isIOS && navigator.share && navigator.canShare) {
      const file = new File([blob], filename, { type: 'audio/mpeg' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Wakti Music',
          text: 'Download your music'
        });
        return;
      }
    }
    
    // Fallback: Standard download approach
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    
    // Cleanup after a short delay
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    }, 100);
  } catch (error) {
    console.error('Download failed:', error);
    // Last resort: open in new tab
    window.open(url, '_blank');
  }
};

export default function MusicStudio() {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState<'compose' | 'editor'>('compose');


  return (
    <div className="w-full max-w-6xl mx-auto p-3 md:p-6 pb-20 md:pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">{language === 'ar' ? 'استوديو الموسيقى' : 'Music Studio'}</h1>
        <div />
      </div>

      <nav className="flex gap-2 border-b border-border pb-2">
        <Button variant={activeTab === 'compose' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('compose')}>
          {language === 'ar' ? 'إنشاء' : 'Compose'}
        </Button>
        <Button variant={activeTab === 'editor' ? 'default' : 'outline'} size="sm" onClick={() => setActiveTab('editor')}>
          {language === 'ar' ? 'المحفوظات' : 'Saved'}
        </Button>
      </nav>

      {activeTab === 'compose' ? <ComposeTab onSaved={()=>setActiveTab('editor')} /> : <EditorTab />}
    </div>
  );
}

function ComposeTab({ onSaved }: { onSaved?: ()=>void }) {
  const { language } = useTheme();

  // Inputs (split prompt)
  const [title, setTitle] = useState('');
  const [styleText, setStyleText] = useState('');
  const [lyricsText, setLyricsText] = useState('');
  const [variations, setVariations] = useState(1);
  const [duration, setDuration] = useState(30); // seconds
  
  // Preset styles list (genres only)
  const STYLE_PRESETS = useMemo<string[]>(() => {
    if (language === 'ar') {
      return [
        'آر آند بي','بوب','بوب الثمانينات','بوب التسعينات','روك','روك آند رول','سوفت روك','ميتال ثقيل','كانتري','جاز','سول','هيب هوب','راب','خليجي بوب','لاتين','ريغيتون','أفروبيتس','سينث بوب','إندي بوب','لوفاي','هاوس','ديب هاوس','ترانس','تيكنو','دبسْتِب','درَم آند بَيس','كي-بوب','بوليوود'
      ];
    }
    return [
      'R&B','pop','80s pop','90s pop','rock','rock and roll','soft rock','heavy metal','country','jazz','soul','hip hop','rap','khaleeji pop','latin','reggaeton','afrobeats','synthpop','indie pop','lofi','house','deep house','trance','techno','dubstep','drum & bass','k-pop','bollywood'
    ];
  }, [language]);

  // Mode/Mood presets (unique values only)
  const MODE_PRESETS = useMemo<string[]>(() => {
    if (language === 'ar') {
      return [
        'سعيد', 'حزين', 'هادئ', 'مفعم بالطاقة', 'رومانسي', 'مظلم', 'ساطع', 'نوستالجي', 'تأملي', 'استرخاء', 'تركيز', 'ملحمي', 'مثير', 'غامض', 'مبهج'
      ];
    }
    return [
      'happy', 'sad', 'calm', 'energetic', 'romantic', 'dark', 'bright', 'nostalgic', 'meditative', 'relaxing', 'focus', 'epic', 'exciting', 'mysterious', 'uplifting'
    ];
  }, [language]);

  const INSTRUMENT_PRESETS = useMemo<string[]>(() => {
    if (language === 'ar') {
      return [
        'عود','قانون','ناي','رق','دربوكة','طبلة','طار','مزمار','رباب',
        'كمان','فيولا','تشيلو','كونترباص','فرقة أوتار',
        'بيانو','بيانو كهربائي','أورغ','أكورديون',
        'جيتار أكوستيك','جيتار كهربائي','جيتار 12 وتر','جيتار كلاسيكي','جيتار نايلون',
        'باص جيتار','باص وترى','سينث باص',
        'طقم درامز','إيقاع','تومز','سنير','هاي-هات','صنجات','تصفيق يدوي',
        'فلوت','كلارينيت','أوبوا','باسون','ساكسفون','ترومبيت','ترومبون','هورن فرنسي',
        'هارب','سيليستا','فيبرفون','ماريمبا','زيلوفون',
        'سينث ليد','سينث باد','باد دافئ','باد تناظري','باد أوتار','بلاك','أربجياتور'
      ];
    }
    return [
      'oud','qanun','ney','riq','darbuka','tabla','frame drum','mizmar','rebab',
      'violin','viola','cello','contrabass','string ensemble',
      'piano','electric piano','organ','accordion',
      'acoustic guitar','electric guitar','12‑string guitar','classical guitar','nylon guitar',
      'bass guitar','upright bass','synth bass',
      'drum kit','percussion','toms','snare','hi-hat','cymbals','hand claps',
      'flute','clarinet','oboe','bassoon','saxophone','trumpet','trombone','french horn',
      'harp','celesta','vibraphone','marimba','xylophone',
      'synth lead','synth pad','warm pad','analog pad','string pad','pluck','arpeggiator'
    ];
  }, [language]);

  // Include/Exclude as chip lists
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [instrumentTags, setInstrumentTags] = useState<string[]>([]);
  const [moodTags, setMoodTags] = useState<string[]>([]);
  const [showIncludePicker, setShowIncludePicker] = useState(false);
  const [showInstrumentPicker, setShowInstrumentPicker] = useState(false);
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const includeAnchorRef = useRef<HTMLDivElement | null>(null);
  const instrumentAnchorRef = useRef<HTMLDivElement | null>(null);
  const moodAnchorRef = useRef<HTMLDivElement | null>(null);
  const [includeRect, setIncludeRect] = useState<{top:number,left:number,width:number} | null>(null);
  const [instrumentRect, setInstrumentRect] = useState<{top:number,left:number,width:number} | null>(null);
  const [moodRect, setMoodRect] = useState<{top:number,left:number,width:number} | null>(null);
  // Minimal mode only: styles include/exclude + prompt + duration
  const [submitting, setSubmitting] = useState(false);
  const [amping, setAmping] = useState(false);
  // Amp options modal state
  const [showAmpModal, setShowAmpModal] = useState(false);
  const [lyricsMode, setLyricsMode] = useState<'preserve'|'continue'|'generate'>('preserve');
  const [includeTempo, setIncludeTempo] = useState(true);
  const [includeKey, setIncludeKey] = useState(false);
  const [includeTimeSig, setIncludeTimeSig] = useState(false);
  const [includeStructure, setIncludeStructure] = useState(true);
  const [includeInstrumentsOpt, setIncludeInstrumentsOpt] = useState(true);
  const [langChoice, setLangChoice] = useState<'auto'|'en'|'ar'>('auto');
  const [noGenreDrift, setNoGenreDrift] = useState(true);
  const [noNewInstruments, setNoNewInstruments] = useState(true);
  const [audios, setAudios] = useState<Array<{ url: string; mime: string; meta?: any; createdAt: number; saved?: boolean }>>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [songsUsed, setSongsUsed] = useState(0);
  const [songsRemaining, setSongsRemaining] = useState(5);

  // Guard to ensure monthly usage loads only once (avoids StrictMode double-run logs)
  const usageLoadedRef = useRef(false);

  // Open the Amp options modal
  function handleAmp() {
    if (!styleText.trim() && !lyricsText.trim() && !title.trim()) return;
    setShowAmpModal(true);
  }

  // Amp options modal (lives inside ComposeTab)
  const ampModal = (
    showAmpModal && createPortal(
      <div className="fixed inset-0 z-[2147483647] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={()=>setShowAmpModal(false)} />
        <div className="relative w-[92vw] max-w-md rounded-lg border bg-background p-4 shadow-xl">
          <h3 className="font-semibold mb-3">{language==='ar'?'إعدادات التحسين (AMP)':'Amp options'}</h3>
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium mb-1">{language==='ar'?'وضع الكلمات':'Lyrics mode'}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="inline-flex items-center gap-2"><input type="radio" name="lyricsMode" checked={lyricsMode==='preserve'} onChange={()=>setLyricsMode('preserve')} />{language==='ar'?'حافظ عليها':'Preserve'}</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="lyricsMode" checked={lyricsMode==='continue'} onChange={()=>setLyricsMode('continue')} />{language==='ar'?'أكملها':'Continue'}</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="lyricsMode" checked={lyricsMode==='generate'} onChange={()=>setLyricsMode('generate')} />{language==='ar'?'أنشئ كاملة':'Generate full'}</label>
              </div>
            </div>

            <div>
              <div className="font-medium mb-1">{language==='ar'?'تضمين في السطر':'Include in line'}</div>
              <div className="grid grid-cols-2 gap-2">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeTempo} onChange={(e)=>setIncludeTempo(e.target.checked)} />{language==='ar'?'السرعة/BPM':'Tempo/BPM'}</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeKey} onChange={(e)=>setIncludeKey(e.target.checked)} />{language==='ar'?'المقام/السلم':'Key/Scale/Mode'}</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeTimeSig} onChange={(e)=>setIncludeTimeSig(e.target.checked)} />{language==='ar'?'الميزان':'Time signature'}</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeStructure} onChange={(e)=>setIncludeStructure(e.target.checked)} />{language==='ar'?'البنية':'Structure'}</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeInstrumentsOpt} onChange={(e)=>setIncludeInstrumentsOpt(e.target.checked)} />{language==='ar'?'الآلات':'Instrumentation'}</label>
              </div>
            </div>

            <div>
              <div className="font-medium mb-1">{language==='ar'?'اللغة':'Language'}</div>
              <div className="grid grid-cols-3 gap-2">
                <label className="inline-flex items-center gap-2"><input type="radio" name="langChoice" checked={langChoice==='auto'} onChange={()=>setLangChoice('auto')} />Auto</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="langChoice" checked={langChoice==='en'} onChange={()=>setLangChoice('en')} />English</label>
                <label className="inline-flex items-center gap-2"><input type="radio" name="langChoice" checked={langChoice==='ar'} onChange={()=>setLangChoice('ar')} />العربية</label>
              </div>
            </div>

            <div>
              <div className="font-medium mb-1">{language==='ar'?'السلامة':'Safety'}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={noGenreDrift} onChange={(e)=>setNoGenreDrift(e.target.checked)} />{language==='ar'?'ممنوع انحراف النوع/الأسلوب':'No genre drift'}</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={noNewInstruments} onChange={(e)=>setNoNewInstruments(e.target.checked)} />{language==='ar'?'لا آلات جديدة غير مذكورة':'No new instruments'}</label>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={()=>setShowAmpModal(false)}>{language==='ar'?'إلغاء':'Cancel'}</Button>
            <Button size="sm" onClick={handleAmpSubmit} aria-busy={amping}>{language==='ar'?'تحسين':'Amp'}</Button>
          </div>
        </div>
      </div>,
      document.body
    )
  );

  // Caps: style max 350, lyrics gets remaining up to overall 800 (title excluded from cap)
  const limit = 800;
  const styleCap = 350;
  const totalChars = useMemo(() => {
    const count = (s: string) => Array.from(s || '').length;
    return count(styleText || '') + count(lyricsText || '');
  }, [styleText, lyricsText]);
  const remainingOverall = Math.max(0, limit - totalChars);
  const lyricsCap = Math.max(0, limit - Array.from(styleText || '').length);
  const overLimit = totalChars > limit;

  // Helpers
  function stripStylesSuffix(text: string) { return (text || '').trim(); }

  function buildStylesSuffix() {
    const parts: string[] = [];
    if (includeTags.length > 0) parts.push(`${language==='ar' ? 'الأنماط' : 'Include styles'}: ${includeTags.join(', ')}`);
    if (instrumentTags.length > 0) parts.push(`${language==='ar' ? 'الآلات' : 'Instruments'}: ${instrumentTags.join(', ')}`);
    if (moodTags.length > 0) parts.push(`${language==='ar' ? 'المزاج' : 'Mode'}: ${moodTags.join(', ')}`);
    return parts.join('. ');
  }

  // No more mirroring chips into a single prompt; we compose at send-time

  // Ensure lyrics never exceed current cap when style changes
  useEffect(() => {
    const cap = Math.max(0, limit - Array.from(styleText || '').length);
    if (Array.from(lyricsText || '').length > cap) {
      setLyricsText(Array.from(lyricsText).slice(0, cap).join(''));
    }
  }, [styleText]);

  // New: AMP submit with options
  async function handleAmpSubmit() {
    if (!styleText.trim() && !lyricsText.trim() && !title.trim()) return;
    setAmping(true);
    try {
      const baseSummary = stripStylesSuffix(styleText);
      const baseLyrics = stripStylesSuffix(lyricsText);
      // Build an intent-preserving directive for music with selected options
      const wantsArabic = langChoice === 'ar' || (langChoice === 'auto' && language === 'ar');
      const includeBits: string[] = [];
      if (includeTempo) includeBits.push(wantsArabic ? 'السرعة/BPM' : 'tempo/BPM');
      if (includeKey) includeBits.push(wantsArabic ? 'المقام/السلم' : 'key/scale/mode');
      if (includeTimeSig) includeBits.push(wantsArabic ? 'الميزان' : 'time signature');
      if (includeStructure) includeBits.push(wantsArabic ? 'البنية' : 'structure');
      if (includeInstrumentsOpt) includeBits.push(wantsArabic ? 'الآلات' : 'instrumentation');
      const includeLine = includeBits.length ? (wantsArabic ? `ضمّن في السطر: ${includeBits.join(', ')}` : `Include in line: ${includeBits.join(', ')}`) : '';

      const safetyBits: string[] = [];
      if (noGenreDrift) safetyBits.push(wantsArabic ? 'ممنوع الانحراف عن النوع/الأسلوب' : 'no genre/style drift');
      if (noNewInstruments) safetyBits.push(wantsArabic ? 'لا تضف آلات غير مذكورة' : 'no adding new instruments unless missing');
      const safetyLine = safetyBits.length ? (wantsArabic ? `سلامة: ${safetyBits.join(', ')}` : `Safety: ${safetyBits.join(', ')}`) : '';

      const lyricsLine = (
        lyricsMode === 'preserve'
          ? (wantsArabic ? 'الكلمات: إن وجدت فاحفظها حرفيًا.' : 'Lyrics: if provided, preserve verbatim.')
          : lyricsMode === 'continue'
            ? (wantsArabic ? 'الكلمات: إن كانت موجودة فأكملها بنفس اللغة والمزاج والوزن.' : 'Lyrics: if provided, continue in same language, mood, and meter.')
            : (wantsArabic ? 'الكلمات: أنشئ كلمات كاملة موجزة قابلة للغناء تتماشى مع الأسلوب والمزاج والآلات.' : 'Lyrics: generate concise, singable full lyrics aligned to style, mood, and instruments.')
      );

      const languageHint = langChoice === 'auto' ? '' : (wantsArabic ? 'استخدم العربية.' : 'Use English.');

      const directiveCore = wantsArabic
        ? 'مهمة: حسّن هذا التوجيه لتوليد موسيقى فقط دون انحراف عن نية المستخدم. ركّز على الأسلوب والمزاج والبنية والإيقاع والسرعة والمقامات والآلات. أعد صياغته كسطر واحد موجز وجاهز للاستخدام.'
        : 'Task: Improve this strictly for music generation without drifting from user intent. Focus on style, mood, structure, tempo, scales/modes, and instruments. Return a single concise, production-ready line.';

      const durationLine = wantsArabic ? `المدة المستهدفة: ${Math.min(120, duration)} ثانية` : `Target duration: ${Math.min(120, duration)}s`;
      const titleLine = title ? (wantsArabic ? `العنوان: ${title}` : `Title: ${title}`) : '';
      const stylesLine = buildStylesSuffix();
      const contentLine = wantsArabic ? `ملخص الأسلوب: ${baseSummary}` : `Style brief: ${baseSummary}`;
      const lyricsContent = baseLyrics ? (wantsArabic ? `الكلمات:\n${baseLyrics}` : `Lyrics:\n${baseLyrics}`) : '';
      const directive = [directiveCore, includeLine, safetyLine, lyricsLine, languageHint, durationLine].filter(Boolean).join('\n');
      const composed = [directive, titleLine, contentLine, stylesLine, lyricsContent].filter(Boolean).join('\n');
      const { data, error } = await supabase.functions.invoke('prompt-amp', {
        body: { text: composed, mode: 'music' }
      });
      if (error) throw error;
      const improved = (data?.text || '').toString();
      if (!improved) throw new Error(language==='ar' ? 'تعذّر التحسين' : 'Amp failed');
      const capped = improved.slice(0, styleCap);
      setShowAmpModal(false);
      setStyleText(capped);
      toast.success(language==='ar' ? 'تم تحسين التوجيه' : 'Prompt enhanced');
    } catch (e: any) {
      toast.error((language==='ar' ? 'فشل التحسين: ' : 'Amp failed: ') + (e?.message || String(e)));
    } finally {
      setAmping(false);
    }
  }

  const handleGenerate = async () => {
    if (overLimit) return;
    setSubmitting(true);
    let placeholderRecordId: string | null = null;
    
    try {
      // Check song count quota (5 songs per month)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      
      // Fetch actual data instead of using count with head:true
      const { data: existingTracks, error: countError } = await (supabase as any)
        .from('user_music_tracks')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString());
      
      if (countError) throw countError;
      
      const songsThisMonth = existingTracks?.length || 0;
      
      if (songsThisMonth >= 5) {
        toast.error(language==='ar' ? 'لقد وصلت إلى الحد الأقصى 5 أغاني شهريا' : 'Monthly limit reached: 5 songs per month');
        return;
      }
      
      // Compose final prompt from split fields and chips (reusable)
      const wantsArabicGen = langChoice === 'ar' || (langChoice === 'auto' && language === 'ar');
      const stylesLineGen = buildStylesSuffix();
      const titleLineGen = title ? (wantsArabicGen ? `العنوان: ${title}` : `Title: ${title}`) : '';
      const durationLineGen = wantsArabicGen ? `المدة المستهدفة: ${Math.min(120, duration)} ثانية` : `Target duration: ${Math.min(120, duration)}s`;
      const contentLineGen = styleText ? (wantsArabicGen ? `ملخص الأسلوب: ${styleText}` : `Style brief: ${styleText}`) : '';
      const lyricsContentGen = lyricsText ? (wantsArabicGen ? `الكلمات:\n${lyricsText}` : `Lyrics:\n${lyricsText}`) : '';
      const fullPrompt = [titleLineGen, contentLineGen, stylesLineGen, durationLineGen, lyricsContentGen].filter(Boolean).join('\n');

      // INSERT PLACEHOLDER RECORD FIRST - ensures the generation counts toward limit
      const placeholderFileName = `${user.id}/${Date.now()}_pending.mp3`;
      const { data: placeholderData, error: placeholderError } = await (supabase as any)
        .from('user_music_tracks')
        .insert({
          user_id: user.id,
          prompt: fullPrompt,
          include_styles: includeTags.length ? includeTags : null,
          requested_duration_seconds: Math.min(120, duration),
          provider: 'runware',
          model: 'elevenlabs:1@1',
          storage_path: placeholderFileName,
          signed_url: null,
          mime: 'audio/mpeg',
          meta: {
            status: 'generating',
            ...(instrumentTags.length ? { instruments: instrumentTags } : {}),
            ...(moodTags.length ? { mood: moodTags } : {})
          } as any
        })
        .select('id')
        .single();
      
      if (placeholderError) throw placeholderError;
      placeholderRecordId = placeholderData?.id;
      
      // Update UI counter immediately
      setSongsUsed((v) => v + 1);
      setSongsRemaining((v) => Math.max(0, v - 1));
      
      // fullPrompt already composed above
      
      // Call Runware directly from frontend (as before)
      const runwareResponse = await fetch('https://api.runware.ai/v1/inference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // NOTE: client-side key usage restored per request
          'Authorization': 'Bearer uS1Bbyhfcs0dAigYhXwELRxBcCndER6M'
        },
        body: JSON.stringify([{
          taskType: 'audioInference',
          taskUUID: crypto.randomUUID(),
          model: 'elevenlabs:1@1',
          positivePrompt: fullPrompt,
          duration: Math.min(120, duration),
          outputFormat: 'MP3',
          deliveryMethod: 'sync',
          numberResults: 1,
          audioSettings: { sampleRate: 44100, bitrate: 128 }
        }])
      });
      
      const result = await runwareResponse.json();
      if (!runwareResponse.ok || result?.errors) {
        throw new Error(result?.errors?.[0]?.message || 'Runware API error');
      }
      
      // Accept audioURL or dataURI
      const audioData = Array.isArray(result?.data) ? result.data[0] : result?.data || result;
      const foundUrl = audioData?.audioURL || audioData?.audioDataURI || audioData?.dataURI;
      if (!foundUrl) throw new Error('No audio returned from Runware');
      
      // Upload to Supabase Storage, then UPDATE the placeholder record
      let storedUrl = foundUrl as string;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        
        const response = await fetch(foundUrl);
        const blob = await response.blob();
        const mime = blob.type || 'audio/mpeg';
        const ext = mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'mp3';
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from('music').upload(fileName, blob, { contentType: mime, upsert: false });
        if (up.error) throw up.error;
        const { data: urlData } = supabase.storage.from('music').getPublicUrl(fileName);
        storedUrl = urlData.publicUrl;
        
        // UPDATE the placeholder record with actual data
        if (placeholderRecordId) {
          const { error: updateError } = await (supabase as any)
            .from('user_music_tracks')
            .update({
              storage_path: fileName,
              signed_url: storedUrl,
              mime: mime,
              meta: {
                status: 'completed',
                ...(audioData?.cost ? { cost_usd: audioData.cost } : {}),
                ...(instrumentTags.length ? { instruments: instrumentTags } : {}),
                ...(moodTags.length ? { mood: moodTags } : {})
              } as any
            })
            .eq('id', placeholderRecordId);
          
          if (updateError) throw updateError;
        }
        
        // Reflect saved state (counter already updated above)
        setAudios((prev) => [{ url: storedUrl, mime, meta: {}, createdAt: Date.now(), saved: true }, ...prev]);
        onSaved?.();
      } catch (saveError) {
        console.error('Storage/DB save error:', saveError);
        // Even if save fails, the placeholder record exists and counts toward limit
        // Mark as failed in DB
        if (placeholderRecordId) {
          await (supabase as any)
            .from('user_music_tracks')
            .update({
              meta: { status: 'failed', error: String(saveError) } as any
            })
            .eq('id', placeholderRecordId);
        }
        // Still show playable result
        setAudios((prev) => [{ url: storedUrl, mime: 'audio/mpeg', meta: {}, createdAt: Date.now(), saved: false }, ...prev]);
      }

      setLastError(null);

      toast.success(language==='ar' ? 'تم الإنشاء' : 'Generated');
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('Music generate error:', e);
      setLastError(msg);
      
      // Mark placeholder as failed if it exists
      // Keep the record so it counts toward monthly limit (user consumed an API attempt)
      if (placeholderRecordId) {
        await (supabase as any)
          .from('user_music_tracks')
          .update({
            meta: { status: 'failed', error: msg } as any
          })
          .eq('id', placeholderRecordId)
          .catch((err: any) => console.error('Failed to update placeholder:', err));
      }
      
      toast.error((language==='ar' ? 'فشل العملية: ' : 'Operation failed: ') + msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Load monthly usage on mount (guarded)
  useEffect(() => {
    if (usageLoadedRef.current) return;
    usageLoadedRef.current = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (import.meta && import.meta.env && import.meta.env.DEV) {
            console.log('[MusicStudio] No user found');
          }
          return;
        }
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          console.log('[MusicStudio] User ID:', user.id);
        }
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          console.log('[MusicStudio] Start of month (UTC):', startOfMonth.toISOString());
        }
        // Fetch actual data instead of using count with head:true
        const { data, error } = await (supabase as any)
          .from('user_music_tracks')
          .select('id')
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth.toISOString());
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          console.log('[MusicStudio] Query result:', { dataLength: data?.length, error });
        }
        const used = data?.length || 0;
        if (import.meta && import.meta.env && import.meta.env.DEV) {
          console.log('[MusicStudio] Setting songs used:', used);
        }
        setSongsUsed(used);
        setSongsRemaining(Math.max(0, 5 - used));
      } catch (e) {
        console.error('[MusicStudio] Error loading usage:', e);
      }
    })();
  }, []);

  // Position and outside-click handling for pickers
  useEffect(() => {
    function calcRects() {
      if (showIncludePicker && includeAnchorRef.current) {
        const r = includeAnchorRef.current.getBoundingClientRect();
        setIncludeRect({ top: r.bottom + 4, left: r.left, width: r.width });
      }
      if (showInstrumentPicker && instrumentAnchorRef.current) {
        const r = instrumentAnchorRef.current.getBoundingClientRect();
        setInstrumentRect({ top: r.bottom + 4, left: r.left, width: r.width });
      }
      if (showMoodPicker && moodAnchorRef.current) {
        const r = moodAnchorRef.current.getBoundingClientRect();
        setMoodRect({ top: r.bottom + 4, left: r.left, width: r.width });
      }
    }
    calcRects();
    const onScroll = () => calcRects();
    const onResize = () => calcRects();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [showIncludePicker, showInstrumentPicker, showMoodPicker]);

  useEffect(() => {
    function handleDocClick(ev: MouseEvent) {
      const t = ev.target as HTMLElement;
      // Close if click outside the anchor areas and outside the menus
      const menu = document.getElementById('include-picker-menu');
      const menu2 = document.getElementById('instrument-picker-menu');
      const menu3 = document.getElementById('mood-picker-menu');
      if (
        showIncludePicker &&
        !includeAnchorRef.current?.contains(t) &&
        menu && !menu.contains(t)
      ) setShowIncludePicker(false);
      if (
        showInstrumentPicker &&
        !instrumentAnchorRef.current?.contains(t) &&
        menu2 && !menu2.contains(t)
      ) setShowInstrumentPicker(false);
      if (
        showMoodPicker &&
        !moodAnchorRef.current?.contains(t) &&
        menu3 && !menu3.contains(t)
      ) setShowMoodPicker(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [showIncludePicker, showInstrumentPicker, showMoodPicker]);

  return (
    <div className="space-y-4">
      {ampModal}
      <Card className="p-4 md:p-5 space-y-4 overflow-visible">
        <div className="grid md:grid-cols-3 gap-3">
          {/* Styles */}
          <div className="space-y-2 relative" ref={includeAnchorRef}>
            <label className="text-xs font-medium block">{language === 'ar' ? 'الأنماط' : 'Styles'}</label>
            <div className="flex flex-wrap gap-2">
              {includeTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm">
                  {tag}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setIncludeTags((prev) => prev.filter((t) => t !== tag))}
                  >×</button>
                </span>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowIncludePicker((v)=>!v); setShowInstrumentPicker(false); }}>
                {language==='ar' ? 'إضافة أنماط' : 'Add styles'}
              </Button>
            </div>
            {showIncludePicker && includeRect && createPortal(
              <div
                id="include-picker-menu"
                style={{ position: 'fixed', top: includeRect.top, left: includeRect.left, width: includeRect.width, zIndex: 2147483647 }}
                className="max-h-56 overflow-auto rounded-md border bg-background shadow"
              >
                <ul className="p-2 space-y-1 text-sm">
                  {STYLE_PRESETS.map((opt) => {
                    const checked = includeTags.includes(opt);
                    return (
                      <li key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                        onClick={() => setIncludeTags((prev) => checked ? prev.filter(t=>t!==opt) : [...prev, opt])}
                      >
                        <input type="checkbox" readOnly checked={checked} />
                        <span>{opt}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>, document.body)
            }
          </div>

          {/* Instruments */}
          <div className="space-y-2 relative" ref={instrumentAnchorRef}>
            <label className="text-xs font-medium block">{language === 'ar' ? 'الآلات' : 'Instruments'}</label>
            <div className="flex flex-wrap gap-2">
              {instrumentTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm">
                  {tag}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setInstrumentTags((prev) => prev.filter((t) => t !== tag))}
                  >×</button>
                </span>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowInstrumentPicker((v)=>!v); setShowIncludePicker(false); }}>
                {language==='ar' ? 'إضافة آلات' : 'Add instruments'}
              </Button>
            </div>
            {showInstrumentPicker && instrumentRect && createPortal(
              <div
                id="instrument-picker-menu"
                style={{ position: 'fixed', top: instrumentRect.top, left: instrumentRect.left, width: instrumentRect.width, zIndex: 2147483647 }}
                className="max-h-56 overflow-auto rounded-md border bg-background shadow"
              >
                <ul className="p-2 space-y-1 text-sm">
                  {INSTRUMENT_PRESETS.map((opt) => {
                    const checked = instrumentTags.includes(opt);
                    return (
                      <li key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                        onClick={() => setInstrumentTags((prev) => checked ? prev.filter(t=>t!==opt) : [...prev, opt])}
                      >
                        <input type="checkbox" readOnly checked={checked} />
                        <span>{opt}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>, document.body)
            }
          </div>

          {/* Mode/Mood */}
          <div className="space-y-2 relative" ref={moodAnchorRef}>
            <label className="text-xs font-medium block">{language === 'ar' ? 'المزاج' : 'Mode'}</label>
            <div className="flex flex-wrap gap-2">
              {moodTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm">
                  {tag}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setMoodTags((prev) => prev.filter((t) => t !== tag))}
                  >×</button>
                </span>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowMoodPicker((v)=>!v); setShowIncludePicker(false); setShowInstrumentPicker(false); }}>
                {language==='ar' ? 'إضافة مزاج' : 'Add mode'}
              </Button>
            </div>
            {showMoodPicker && moodRect && createPortal(
              <div
                id="mood-picker-menu"
                style={{ position: 'fixed', top: moodRect.top, left: moodRect.left, width: moodRect.width, zIndex: 2147483647 }}
                className="max-h-56 overflow-auto rounded-md border bg-background shadow"
              >
                <ul className="p-2 space-y-1 text-sm">
                  {MODE_PRESETS.map((opt) => {
                    const checked = moodTags.includes(opt);
                    return (
                      <li key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                        onClick={() => setMoodTags((prev) => checked ? prev.filter(t=>t!==opt) : [...prev, opt])}
                      >
                        <input type="checkbox" readOnly checked={checked} />
                        <span>{opt}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>, document.body)
            }
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-5 space-y-3">
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              value={title}
              onChange={(e)=> setTitle(e.target.value.slice(0,100))}
              placeholder={language==='ar' ? 'عنوان قصير (اختياري)' : 'Short title (optional)'}
              className="md:w-1/3"
            />
            <div className="flex-1 flex flex-col gap-2">
              <Textarea
                value={styleText}
                onChange={(e) => setStyleText(Array.from(e.target.value).slice(0, styleCap).join(''))}
                placeholder={language === 'ar' ? 'وصف الأسلوب/الفكرة (حتى 350 حرفًا)' : 'Style/idea brief (up to 350 chars)'}
                rows={3}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>{language==='ar' ? 'الأسلوب' : 'Style'}: {Array.from(styleText).length} / {styleCap}</span>
                <span>{language==='ar' ? 'الكل المتبقي' : 'Total remaining'}: {remainingOverall}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Textarea
              value={lyricsText}
              onChange={(e) => setLyricsText(Array.from(e.target.value).slice(0, lyricsCap).join(''))}
              placeholder={language === 'ar' ? 'الكلمات (اختياري — سيُستخدم المتبقي من الحروف)' : 'Lyrics (optional — uses remaining characters)'}
              rows={4}
              className="w-full"
            />
            <div className="text-xs text-muted-foreground">
              {language==='ar'
                ? `الكلمات: ${Array.from(lyricsText).length} / ${lyricsCap}`
                : `Lyrics: ${Array.from(lyricsText).length} / ${lyricsCap}`}
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button
              variant="outline"
              size="sm"
              disabled={amping || submitting || (!styleText.trim() && !lyricsText.trim() && !title.trim())}
              onClick={handleAmp}
              aria-busy={amping}
            >
              {amping ? (
                <span className="inline-flex items-center gap-1"><span className="animate-spin">✨</span><span>{language==='ar'?'تحسين…':'Amp…'}</span></span>
              ) : (
                <span className="inline-flex items-center gap-1"><Wand2 className="h-4 w-4" />{language==='ar'?'تحسين':'Amp'}</span>
              )}
            </Button>
            <Button
              disabled={overLimit || submitting}
              onClick={handleGenerate}
              className=""
              aria-busy={submitting}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin">🎵</span>
                  <span>{language==='ar' ? 'جارٍ الإنشاء...' : 'Generating…'}</span>
                </span>
              ) : (
                <span>{language === 'ar' ? 'إنشاء' : 'Generate'}</span>
              )}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-2">
            <select
              className="px-3 py-1 rounded-full border bg-background text-foreground shadow-sm"
              value={duration}
              onChange={(e)=> setDuration(Math.min(120, Math.max(10, parseInt(e.target.value||'30'))))}
            >
              <option value={10}>↔ 0:10</option>
              <option value={30}>↔ 0:30</option>
              <option value={60}>↔ 1:00</option>
              <option value={90}>↔ 1:30</option>
              <option value={120}>↔ 2:00</option>
            </select>
            
            {submitting && <span className="text-emerald-600 animate-spin">🎵</span>}
          </div>
          <div className={`ml-auto font-medium ${overLimit ? 'text-red-600' : 'text-emerald-600'}`}>
            {language === 'ar' ? `المتبقي الكلي ${remainingOverall} من ${limit}` : `Total remaining ${remainingOverall} / ${limit}`}
          </div>
          <div className="font-medium">
            {language === 'ar' ? `تم الاستخدام: ${songsUsed} من 5 هذا الشهر` : `Used ${songsUsed} of 5 this month`}
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-5 space-y-3">
        {audios.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {language==='ar' ? 'سيتم حفظ الموسيقى المُنشأة كمشاريع في علامة التبويب المحفوظات' : 'generated music will be saved as projects in the Save tab'}
            </p>
            {lastError && (
              <p className="text-sm text-red-600">{lastError}</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Save Reminder */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-muted">
              <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                {language === 'ar' 
                  ? 'تذكير: احفظ الموسيقى للوصول إليها لاحقاً من علامة التبويب "المحفوظات" وتنزيلها.'
                  : 'Reminder: Save your music to access it later from the "Saved" tab and download it.'}
              </p>
            </div>

            {audios.map((a, idx) => (
              <div key={a.createdAt + '-' + idx} className="space-y-3 p-3 md:p-4 rounded-lg border bg-card">
                <AudioPlayer src={a.url} className="w-full" />
                <div className="flex items-center gap-2 justify-end flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onPointerUp={() => handleDownload(a.url, `wakti-music-${a.createdAt}.mp3`)}
                  >
                    {language==='ar' ? 'تنزيل' : 'Download'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(a.url);
                      toast.success(language==='ar' ? 'تم نسخ الرابط' : 'URL copied');
                    }}
                  >
                    {language==='ar' ? 'نسخ الرابط' : 'Copy URL'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={a.saved}
                    onClick={async () => {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) throw new Error(language==='ar' ? 'سجّل الدخول للحفظ' : 'Sign in to save');
                        let storagePath: string | null = null;
                        let publicUrl = a.url;
                        // If already a public URL within our bucket, derive storage path
                        const marker = '/storage/v1/object/public/music/';
                        if (publicUrl.includes(marker)) {
                          storagePath = publicUrl.split(marker)[1] || null;
                        }
                        // Otherwise, fetch and upload
                        if (!storagePath) {
                          const response = await fetch(a.url);
                          const blob = await response.blob();
                          const fileName = `${user.id}/${Date.now()}.mp3`;
                          const up = await supabase.storage.from('music').upload(fileName, blob, { contentType: 'audio/mpeg', upsert: false });
                          if (up.error) throw up.error;
                          const { data: urlData } = supabase.storage.from('music').getPublicUrl(fileName);
                          publicUrl = urlData.publicUrl;
                          storagePath = fileName;
                        }
                        // Avoid duplicates: check existing by storage_path
                        if (storagePath) {
                          const { count } = await (supabase as any)
                            .from('user_music_tracks')
                            .select('*', { count: 'exact', head: true })
                            .eq('user_id', user.id)
                            .eq('storage_path', storagePath);

                          if (!count || count === 0) {
                            const wantsArabic = langChoice === 'ar' || (langChoice === 'auto' && language === 'ar');
                            const stylesLine = buildStylesSuffix();
                            const titleLine = title ? (wantsArabic ? `العنوان: ${title}` : `Title: ${title}`) : '';
                            const contentLine = styleText ? (wantsArabic ? `ملخص الأسلوب: ${styleText}` : `Style brief: ${styleText}`) : '';
                            const lyricsContent = lyricsText ? (wantsArabic ? `الكلمات:\n${lyricsText}` : `Lyrics:\n${lyricsText}`) : '';
                            const savePrompt = [titleLine, contentLine, stylesLine, lyricsContent].filter(Boolean).join('\n');
                            await (supabase as any).from('user_music_tracks').insert({
                              user_id: user.id,
                              title: (title || (styleText + ' ' + (lyricsText ? lyricsText.slice(0,40) : ''))).substring(0, 100),
                              storage_path: storagePath,
                              signed_url: publicUrl,
                              duration_sec: Math.min(120, duration),
                              prompt: savePrompt,
                            });
                          }
                        }
                        setAudios((prev) => prev.map((it, i) => i===idx ? { ...it, url: publicUrl, saved: true } : it));
                        toast.success(language==='ar' ? 'تم الحفظ. انتقل إلى المحفوظات.' : 'Saved. Switched to Saved.');
                        onSaved?.();
                      } catch (e: any) {
                        toast.error((language==='ar'?'تعذر الحفظ: ':'Save failed: ') + (e?.message || String(e)));
                      }
                    }}
                  >
                    {a.saved ? (language==='ar' ? 'تم الحفظ' : 'Saved') : (language==='ar' ? 'حفظ' : 'Save')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function EditorTab() {
  const { language } = useTheme();
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Array<{ id: string; created_at: string; prompt: string | null; include_styles: string[] | null; exclude_styles: string[] | null; requested_duration_seconds: number | null; signed_url: string | null; storage_path: string | null; mime: string | null; play_url?: string | null }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_music_tracks')
        .select('id, created_at, prompt, include_styles, exclude_styles, requested_duration_seconds, signed_url, storage_path, mime')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      // Simple approach like Tasjeel: use signed_url directly from database
      const withUrls = (data || []).map((t) => {
        // Use signed_url directly if available, otherwise construct from storage_path as fallback
        let playUrl: string | null = t.signed_url;
        if (!playUrl && t.storage_path) {
          const base = SUPABASE_URL.replace(/\/$/, '');
          const path = t.storage_path.startsWith('/') ? t.storage_path.slice(1) : t.storage_path;
          playUrl = `${base}/storage/v1/object/public/music/${path}`;
        }
        return { ...t, play_url: playUrl } as typeof t & { play_url: string | null };
      });
      setTracks(withUrls);
    } catch (e) {
      // noop
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (trackId: string, storagePath: string | null) => {
    const confirmMsg = language === 'ar' 
      ? 'هل أنت متأكد من حذف هذا المقطع؟' 
      : 'Are you sure you want to delete this track?';
    
    if (!confirm(confirmMsg)) return;

    try {
      // Delete from database
      const { error: dbError } = await (supabase as any)
        .from('user_music_tracks')
        .delete()
        .eq('id', trackId);

      if (dbError) throw dbError;

      // Delete from storage if storage_path exists
      if (storagePath) {
        const { error: storageError } = await supabase.storage
          .from('music')
          .remove([storagePath]);
        
        if (storageError) {
          console.warn('Storage deletion failed:', storageError);
          // Don't throw - DB deletion succeeded
        }
      }

      // Update UI
      setTracks(prev => prev.filter(t => t.id !== trackId));
      toast.success(language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
    } catch (e: any) {
      toast.error((language === 'ar' ? 'فشل الحذف: ' : 'Delete failed: ') + (e?.message || String(e)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{language==='ar' ? 'مشاريعي' : 'My Projects'}</h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? (language==='ar'?'يُحدَّث...':'Refreshing...') : (language==='ar'?'تحديث':'Refresh')}</Button>
      </div>

      {tracks.length === 0 ? (
        <Card className="p-4 md:p-5">
          <p className="text-sm text-muted-foreground">{language==='ar' ? 'لا توجد عناصر محفوظة بعد.' : 'No saved items yet.'}</p>
        </Card>
      ) : (
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {tracks.map((t) => (
            <Card key={t.id} className="p-3 md:p-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{t.requested_duration_seconds ? `${t.requested_duration_seconds}s` : ''}</div>
              </div>
              {t.prompt && <div className="text-sm truncate" title={t.prompt}>{t.prompt}</div>}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {(t.include_styles||[]).map((s)=> <span key={s} className="px-2 py-0.5 rounded-full bg-muted">{s}</span>)}
              </div>
              {t.play_url && (
                <div className="space-y-3">
                  <AudioPlayer src={t.play_url} className="w-full" />
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onPointerUp={() => handleDownload(t.play_url || '', `wakti-music-${t.id}.mp3`)}
                    >
                      {language==='ar' ? 'تنزيل' : 'Download'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(t.play_url || '');
                        toast.success(language==='ar' ? 'تم نسخ الرابط' : 'URL copied');
                      }}
                    >
                      {language==='ar' ? 'نسخ الرابط' : 'Copy URL'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(t.id, t.storage_path)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
