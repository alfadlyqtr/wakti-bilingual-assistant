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
  const [audios, setAudios] = useState<Array<{ url: string; mime: string; meta?: any; createdAt: number }>>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  // 3000 character cap across request fields (prompt only; styles do NOT count)
  const totalChars = useMemo(() => {
    const count = (s: string) => Array.from(s || '').length;
    return count(prompt || '');
  }, [prompt]);

  const limit = 3000;
  const remaining = Math.max(0, limit - totalChars);
  const overLimit = totalChars > limit;

  const handleGenerate = async () => {
    if (overLimit) return;
    setSubmitting(true);
    try {
      const chars = totalChars;
      const { data, error } = await supabase.functions.invoke('music-apply-quota', {
        body: { mode: 'precheck', chars }
      });
      if (error) throw error;
      const allowed = data?.allowed;
      const rem = data?.remaining;
      if (!allowed) {
        toast.error(language==='ar' ? 'نفدت الحصة الشهرية' : 'Monthly limit reached');
        return;
      }
      // Generate audio via Runware proxy edge function (structured composition plan)
      const gen = await supabase.functions.invoke('runware-music', {
        body: {
          prompt,
          stylesInclude: includeTags,
          stylesExclude: excludeTags,
          duration: Math.min(180, duration),
          seed: seedLocked ? (seed || undefined) : undefined
        }
      });
      if (gen.error) throw gen.error;
      const payload = gen.data as { ok?: boolean; audio?: string; mime?: string; url?: string; path?: string; meta?: any };
      if (!payload?.ok) throw new Error('Generation failed');

      console.debug('elevenlabs-music payload:', payload);
      let mediaUrl = '';
      if (payload.url) {
        mediaUrl = payload.url;
      } else if (payload.audio && payload.mime) {
        const bstr = atob(payload.audio);
        const bytes = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) bytes[i] = bstr.charCodeAt(i);
        const blob = new Blob([bytes], { type: payload.mime });
        mediaUrl = URL.createObjectURL(blob);
      } else if (payload.path) {
        // Try public URL fallback if bucket is public
        try {
          const { data } = supabase.storage.from('music').getPublicUrl(payload.path);
          if (data?.publicUrl) {
            mediaUrl = data.publicUrl;
          }
          console.debug('storage path fallback', payload.path, '->', data?.publicUrl);
        } catch (_) {}
      } else {
        throw new Error('No audio URL or data in response');
      }
      setAudios((prev) => [{ url: mediaUrl, mime: payload.mime || 'audio/mpeg', meta: payload.meta, createdAt: Date.now() }, ...prev]);
      setLastError(null);

      // Commit quota after successful generation using same chars
      await supabase.functions.invoke('music-apply-quota', { body: { mode: 'commit', chars } });

      toast.success(
        language==='ar'
          ? `تم الإنشاء. المتبقي هذا الشهر: ${rem}`
          : `Generated. Remaining this month: ${rem}`
      );
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error('Music generate error:', e);
      setLastError(msg);
      toast.error((language==='ar' ? 'فشل العملية: ' : 'Operation failed: ') + msg);
    } finally {
      setSubmitting(false);
    }
  };

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
              onChange={(e)=> setDuration(Math.min(180, Math.max(10, parseInt(e.target.value||'30'))))}
            >
              <option value={10}>↔ 0:10</option>
              <option value={30}>↔ 0:30</option>
              <option value={60}>↔ 1:00</option>
              <option value={90}>↔ 1:30</option>
              <option value={120}>↔ 2:00</option>
              <option value={180}>↔ 3:00</option>
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
            {language === 'ar' ? `المتبقي ${remaining} / 3000` : `${remaining} / 3000 remaining`}
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
