import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

export default function MusicStudio() {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState<'compose' | 'editor'>('compose');

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 space-y-4">
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

  // Inputs
  const [prompt, setPrompt] = useState('');
  const [variations, setVariations] = useState(1);
  const [duration, setDuration] = useState(30); // seconds
  const [seedLocked, setSeedLocked] = useState(false);
  const [seed, setSeed] = useState<string>('');
  // Preset styles list (expandable later)
  const STYLE_PRESETS = useMemo<string[]>(() => [
    // Strings & orchestral
    'strings','string quartet','violin lead','cello warm','orchestral','symphonic','chamber','cinematic','epic','dramatic','trailer','ambient strings','pizzicato','legato','staccato','lush pads','film score',
    // Arabic & regional
    'soft oud','oud solo','qanun','ney flute','arabic classical','khaleeji','shaabi','tarab','nasheed','maqam hijaz','maqam rast','khaleeji pop',
    // Genres
    'pop','indie pop','synthpop','rock','alt rock','soft rock','metal','lofi','boom bap','trap','drill','house','deep house','progressive house','edm','trance','techno','dubstep','drum & bass','reggaeton','afrobeats','r&b','soul','jazz','jazzy','blues','country','folk','acoustic','piano','piano solo','acoustic guitar','fingerstyle','bossa nova','latin','k-pop','bollywood',
    // Moods
    'intimate','romantic','gentle','uplifting','calm','nostalgic','melancholic','moody','dark','bright','happy','sad','hopeful','mysterious','euphoric','energetic','chill','meditative','focus','study',
    // Electronic textures
    'analog synth','retro 80s','synthwave','retrowave','ambient','downtempo','future bass','glitch','IDM'
  ], []);

  // Include/Exclude as chip lists
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [showIncludePicker, setShowIncludePicker] = useState(false);
  const [showExcludePicker, setShowExcludePicker] = useState(false);
  const includeAnchorRef = useRef<HTMLDivElement | null>(null);
  const excludeAnchorRef = useRef<HTMLDivElement | null>(null);
  const [includeRect, setIncludeRect] = useState<{top:number,left:number,width:number} | null>(null);
  const [excludeRect, setExcludeRect] = useState<{top:number,left:number,width:number} | null>(null);
  // Minimal mode only: styles include/exclude + prompt + duration
  const [submitting, setSubmitting] = useState(false);
  const [audios, setAudios] = useState<Array<{ url: string; mime: string; meta?: any; createdAt: number; saved?: boolean }>>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [songsUsed, setSongsUsed] = useState(0);
  const [songsRemaining, setSongsRemaining] = useState(5);

  // 3000 character cap across request fields (prompt only; styles do NOT count)
  const totalChars = useMemo(() => {
    const count = (s: string) => Array.from(s || '').length;
    return count(prompt || '');
  }, [prompt]);

  const limit = 500;
  const remaining = Math.max(0, limit - totalChars);
  const overLimit = totalChars > limit;

  // Helpers to mirror styles into the prompt as plain wording (Option A)
  function stripStylesSuffix(text: string) {
    // Remove any trailing "Include styles: ..." or "Exclude styles: ..." sentences we previously added
    return text
      .replace(/\s*Include styles:[^\.]*\.?\s*$/i, '')
      .replace(/\s*Exclude styles:[^\.]*\.?\s*$/i, '')
      .trim();
  }

  function buildStylesSuffix() {
    const parts: string[] = [];
    if (includeTags.length > 0) parts.push(`Include styles: ${includeTags.join(', ')}`);
    if (excludeTags.length > 0) parts.push(`Exclude styles: ${excludeTags.join(', ')}`);
    return parts.join('. ');
  }

  // Sync chips -> prompt wording whenever styles change
  useEffect(() => {
    const suffix = buildStylesSuffix();
    const base = stripStylesSuffix(prompt);
    const withSpace = suffix ? (base ? base + '. ' : '') + suffix : base;
    // Enforce 500-char cap by truncating base if needed
    if (withSpace.length > limit) {
      const suffixLen = suffix.length + (base ? 2 : 0); // ". " if base not empty
      const maxBase = Math.max(0, limit - (suffix ? suffixLen : 0));
      const trimmedBase = base.slice(0, maxBase);
      const rebuilt = suffix ? (trimmedBase ? trimmedBase + '. ' : '') + suffix : trimmedBase;
      if (rebuilt !== prompt) setPrompt(rebuilt);
    } else {
      if (withSpace !== prompt) setPrompt(withSpace);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeTags, excludeTags]);

  const handleGenerate = async () => {
    if (overLimit) return;
    setSubmitting(true);
    try {
      // Check song count quota (5 songs per month)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { count, error: countError } = await supabase
        .from('user_music_tracks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth.toISOString());
      
      if (countError) throw countError;
      
      const songsThisMonth = count || 0;
      const songsRemainingLocal = 5 - songsThisMonth;
      
      if (songsThisMonth >= 5) {
        toast.error(language==='ar' ? 'لقد وصلت إلى الحد الأقصى 5 أغاني شهريا' : 'Monthly limit reached: 5 songs per month');
        return;
      }
      
      // Full prompt already contains styles wording (Option A)
      const fullPrompt = prompt;
      
      // Call Runware directly from frontend
      const runwareResponse = await fetch('https://api.runware.ai/v1/inference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
          audioSettings: {
            sampleRate: 44100,
            bitrate: 128
          }
        }])
      });

      const result = await runwareResponse.json();
      console.log('Runware full response:', result);
      console.log('Response structure:', {
        hasData: !!result.data,
        isArray: Array.isArray(result),
        keys: Object.keys(result || {}),
        firstItem: result.data?.[0] || result[0] || result
      });

      if (!runwareResponse.ok || result.errors) {
        throw new Error(result.errors?.[0]?.message || 'Runware API error');
      }

      // Get audio from response - can be audioURL or audioDataURI
      const audioData = result?.data?.[0];
      const audioURL = audioData?.audioURL || audioData?.audioDataURI;
      console.log('Found audio:', audioURL ? 'YES' : 'NO');
      
      if (!audioURL) {
        console.error('Could not find audio. Full result:', JSON.stringify(result, null, 2));
        throw new Error('No audio returned from Runware');
      }

      // Convert base64 data URI to blob and upload to storage
      let storedUrl = audioURL;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user && audioURL.startsWith('data:')) {
          // Convert data URI to blob
          const response = await fetch(audioURL);
          const blob = await response.blob();
          
          // Upload to Supabase Storage
          const fileName = `${user.id}/${Date.now()}.mp3`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('music')
            .upload(fileName, blob, { contentType: 'audio/mpeg' });
          
          if (uploadError) throw uploadError;
          
          // Get public URL
          const { data: urlData } = supabase.storage.from('music').getPublicUrl(fileName);
          storedUrl = urlData.publicUrl;
          
          // Save to database
          const { error: dbError } = await supabase.from('user_music_tracks').insert({
            user_id: user.id,
            title: prompt.substring(0, 100),
            storage_path: fileName,
            duration_sec: Math.min(120, duration),
            prompt: prompt,
            cost_usd: audioData.cost || 0
          });
          
          if (dbError) console.error('DB save error:', dbError);
        }
      } catch (saveError) {
        console.error('Storage save error:', saveError);
        // Continue anyway - audio will still play from data URI
      }

      setAudios((prev) => [{ url: storedUrl, mime: 'audio/mpeg', meta: {}, createdAt: Date.now(), saved: true }, ...prev]);
      setLastError(null);

      toast.success(
        language==='ar'
          ? `تم الإنشاء. المتبقي: ${songsRemainingLocal - 1} من 5`
          : `Generated. Remaining: ${songsRemainingLocal - 1} of 5 songs`
      );

      // Update local quota counters
      setSongsUsed(songsThisMonth + 1);
      setSongsRemaining(Math.max(0, 5 - (songsThisMonth + 1)));
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('Music generate error:', e);
      setLastError(msg);
      toast.error((language==='ar' ? 'فشل العملية: ' : 'Operation failed: ') + msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Load monthly usage on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from('user_music_tracks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth.toISOString());
        const used = count || 0;
        setSongsUsed(used);
        setSongsRemaining(Math.max(0, 5 - used));
      } catch (_) {}
    })();
  }, []);

  // Position and outside-click handling for pickers
  useEffect(() => {
    function calcRects() {
      if (showIncludePicker && includeAnchorRef.current) {
        const r = includeAnchorRef.current.getBoundingClientRect();
        setIncludeRect({ top: r.bottom + 4, left: r.left, width: r.width });
      }
      if (showExcludePicker && excludeAnchorRef.current) {
        const r = excludeAnchorRef.current.getBoundingClientRect();
        setExcludeRect({ top: r.bottom + 4, left: r.left, width: r.width });
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
  }, [showIncludePicker, showExcludePicker]);

  useEffect(() => {
    function handleDocClick(ev: MouseEvent) {
      const t = ev.target as HTMLElement;
      // Close if click outside the anchor areas and outside the menus
      const menu = document.getElementById('include-picker-menu');
      const menu2 = document.getElementById('exclude-picker-menu');
      if (
        showIncludePicker &&
        !includeAnchorRef.current?.contains(t) &&
        menu && !menu.contains(t)
      ) setShowIncludePicker(false);
      if (
        showExcludePicker &&
        !excludeAnchorRef.current?.contains(t) &&
        menu2 && !menu2.contains(t)
      ) setShowExcludePicker(false);
    }
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [showIncludePicker, showExcludePicker]);

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-5 space-y-4 overflow-visible">
        <div className="grid md:grid-cols-2 gap-3">
          {/* Include */}
          <div className="space-y-2 relative" ref={includeAnchorRef}>
            <label className="text-xs font-medium block">{language === 'ar' ? 'أنماط مضمّنة' : 'Include styles'}</label>
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
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowIncludePicker((v)=>!v); setShowExcludePicker(false); }}>
                {language==='ar' ? 'إضافة نمط' : 'Add style'}
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

          {/* Exclude */}
          <div className="space-y-2 relative" ref={excludeAnchorRef}>
            <label className="text-xs font-medium block">{language === 'ar' ? 'أنماط مستبعدة' : 'Exclude styles'}</label>
            <div className="flex flex-wrap gap-2">
              {excludeTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm">
                  {tag}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setExcludeTags((prev) => prev.filter((t) => t !== tag))}
                  >×</button>
                </span>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowExcludePicker((v)=>!v); setShowIncludePicker(false); }}>
                {language==='ar' ? 'استبعاد نمط' : 'Exclude style'}
              </Button>
            </div>
            {showExcludePicker && excludeRect && createPortal(
              <div
                id="exclude-picker-menu"
                style={{ position: 'fixed', top: excludeRect.top, left: excludeRect.left, width: excludeRect.width, zIndex: 2147483647 }}
                className="max-h-56 overflow-auto rounded-md border bg-background shadow"
              >
                <ul className="p-2 space-y-1 text-sm">
                  {STYLE_PRESETS.map((opt) => {
                    const checked = excludeTags.includes(opt);
                    return (
                      <li key={opt} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1"
                        onClick={() => setExcludeTags((prev) => checked ? prev.filter(t=>t!==opt) : [...prev, opt])}
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
        <div className="flex flex-col md:flex-row md:items-start gap-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={language === 'ar' ? 'اكتب التوجيه...' : 'Prompt...'}
            rows={3}
            className="flex-1"
          />
          <Button
            disabled={overLimit || submitting}
            onClick={handleGenerate}
            className="self-start"
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
            <button
              type="button"
              aria-label={seedLocked ? (language==='ar'?'إلغاء قفل البذرة':'Unlock seed') : (language==='ar'?'قفل البذرة':'Lock seed')}
              className="px-2 py-1 rounded-md border hover:bg-accent hover:text-accent-foreground transition"
              onClick={() => setSeedLocked((v)=>!v)}
              title={seedLocked ? (language==='ar'?'إلغاء قفل البذرة':'Unlock seed') : (language==='ar'?'قفل البذرة':'Lock seed')}
            >
              {seedLocked ? '🔒' : '🔓'}
            </button>
            {submitting && <span className="text-emerald-600 animate-spin">🎵</span>}
          </div>
          <div className={`ml-auto font-medium ${overLimit ? 'text-red-600' : 'text-emerald-600'}`}>
            {language === 'ar' ? `المتبقي ${remaining} / 500` : `${remaining} / 500 remaining`}
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
              {language==='ar' ? 'ستظهر أحدث المشاريع هنا بعد الإنشاء.' : 'Recent projects will appear here after generation.'}
            </p>
            {lastError && (
              <p className="text-sm text-red-600">{lastError}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {audios.map((a, idx) => (
              <div key={a.createdAt + '-' + idx} className="flex items-center gap-3">
                <audio controls src={a.url} className="w-full" />
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
                        const { count } = await supabase
                          .from('user_music_tracks')
                          .select('*', { count: 'exact', head: true })
                          .eq('user_id', user.id)
                          .eq('storage_path', storagePath);
                        if (!count || count === 0) {
                          await supabase.from('user_music_tracks').insert({
                            user_id: user.id,
                            title: prompt.substring(0, 100),
                            storage_path: storagePath,
                            duration_sec: Math.min(120, duration),
                            prompt: prompt,
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
  const [tracks, setTracks] = useState<Array<{ id: string; created_at: string; prompt: string | null; include_styles: string[] | null; exclude_styles: string[] | null; requested_duration_seconds: number | null; signed_url: string | null; storage_path: string | null; mime: string | null }>>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_music_tracks')
        .select('id, created_at, prompt, include_styles, exclude_styles, requested_duration_seconds, signed_url, storage_path, mime')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setTracks(data || []);
    } catch (e) {
      // noop
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
        <div className="grid md:grid-cols-2 gap-4">
          {tracks.map((t) => (
            <Card key={t.id} className="p-4 md:p-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{t.requested_duration_seconds ? `${t.requested_duration_seconds}s` : ''}</div>
              </div>
              {t.prompt && <div className="text-sm truncate" title={t.prompt}>{t.prompt}</div>}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {(t.include_styles||[]).map((s)=> <span key={s} className="px-2 py-0.5 rounded-full bg-muted">{s}</span>)}
              </div>
              <audio controls src={t.signed_url || undefined} className="w-full" />
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
