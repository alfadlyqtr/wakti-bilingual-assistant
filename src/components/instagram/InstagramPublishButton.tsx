import { useState, useEffect, useCallback, useRef } from 'react';
import { Instagram, Loader2, Check, X, ExternalLink, Sparkles } from 'lucide-react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface IGAccount {
  id: string;
  instagram_username: string | null;
  instagram_name: string | null;
  profile_picture_url: string | null;
}

let sharedConnectionPromise: Promise<IGAccount | null> | null = null;
let sharedConnectionCache: { account: IGAccount | null; expiresAt: number } | null = null;
let codeExchangeInProgress = false;
let lastExchangedCode: string | null = null;

interface InstagramPublishButtonProps {
  mediaUrl: string;
  mediaType: 'image' | 'video' | 'reel';
  publishTarget?: 'feed' | 'reel';
  defaultCaption?: string;
  language?: 'en' | 'ar';
}

const META_APP_ID = import.meta.env.VITE_META_APP_ID || '';
const REDIRECT_URI = `${window.location.origin}/instagram-connect-callback`;
const IG_SCOPES = 'instagram_business_basic,instagram_business_content_publish';

async function fetchSharedConnectionStatus(): Promise<IGAccount | null> {
  const now = Date.now();
  if (sharedConnectionCache && sharedConnectionCache.expiresAt > now) {
    return sharedConnectionCache.account;
  }

  if (!sharedConnectionPromise) {
    sharedConnectionPromise = (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        sharedConnectionCache = { account: null, expiresAt: Date.now() + 5 * 60_000 };
        return null;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/instagram-connect-user?action=status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      const account = response.ok && data?.connected ? (data.account as IGAccount) : null;
      sharedConnectionCache = { account, expiresAt: Date.now() + 5 * 60_000 };
      return account;
    })().finally(() => {
      sharedConnectionPromise = null;
    });
  }

  return sharedConnectionPromise;
}

export default function InstagramPublishButton({
  mediaUrl,
  mediaType,
  publishTarget = 'feed',
  defaultCaption = '',
  language = 'en',
}: InstagramPublishButtonProps) {
  const [igAccount, setIgAccount] = useState<IGAccount | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [caption, setCaption] = useState(defaultCaption);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<'feed' | 'reel'>(publishTarget as 'feed' | 'reel');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [polling, setPolling] = useState(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);

  const ar = language === 'ar';

  const checkConnection = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const account = await fetchSharedConnectionStatus();
      setIgAccount(account);
    } catch {
      setIgAccount(null);
    } finally {
      setCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const onChanged = (e: Event) => {
      const account = (e as CustomEvent).detail as IGAccount | null;
      setIgAccount(account);
    };
    window.addEventListener('ig-account-changed', onChanged);
    return () => window.removeEventListener('ig-account-changed', onChanged);
  }, [checkConnection]);

  // Handle OAuth callback code coming back from Meta — only ONE instance should exchange it
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const igCode = params.get('ig_publish_code') || localStorage.getItem('ig_publish_code');
    if (!igCode) return;

    // Guard: skip if already exchanged or another instance is doing it
    if (codeExchangeInProgress || lastExchangedCode === igCode) return;
    codeExchangeInProgress = true;
    lastExchangedCode = igCode;

    // Clean URL and localStorage immediately so other instances won't pick it up
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
    try { localStorage.removeItem('ig_publish_code'); } catch { /* ignore */ }
    try { localStorage.removeItem('ig_publish_return_to'); } catch { /* ignore */ }

    const exchangeCode = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('instagram-connect-user', {
          body: { action: 'exchange_code', code: igCode, redirect_uri: REDIRECT_URI },
        });
        // Extract actual error detail from FunctionsHttpError
        let errorDetail = error?.message || '';
        if (error && 'context' in error) {
          try {
            const ctx = error.context as Response;
            const txt = await ctx.text();
            console.error('[IG connect] error body:', txt);
            errorDetail = txt;
          } catch { /* ignore */ }
        }
        console.error('[IG connect] invoke error:', error, 'detail:', errorDetail, 'data:', JSON.stringify(data));
        if (error || !data?.success) {
          throw new Error(data?.error || errorDetail || 'Connection failed');
        }
        sharedConnectionCache = { account: data.account, expiresAt: Date.now() + 5 * 60_000 };
        setIgAccount(data.account);
        window.dispatchEvent(new CustomEvent('ig-account-changed', { detail: data.account }));
        toast.success(ar ? 'تم ربط حساب Instagram!' : 'Instagram connected!');
        setShowPanel(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(ar ? `فشل الربط: ${msg}` : `Connection failed: ${msg}`);
      } finally {
        codeExchangeInProgress = false;
      }
    };
    exchangeCode();
  }, [ar]);

  const handleGenerateCaption = async () => {
    setGeneratingCaption(true);
    try {
      const { data, error } = await supabase.functions.invoke('instagram-connect-user', {
        body: { action: 'generate_caption', media_url: mediaUrl, media_type: mediaType, user_hint: caption, language: ar ? 'ar' : 'en' },
      });
      if (error || !data?.caption) throw new Error(data?.error || 'No caption generated');
      setCaption(data.caption);
    } catch {
      toast.error(ar ? 'فشل توليد التعليق' : 'Failed to generate caption');
    } finally {
      setGeneratingCaption(false);
    }
  };

  const handleConnect = () => {
    if (!META_APP_ID) {
      toast.error(ar ? 'معرّف تطبيق Meta غير متوفر' : 'Meta App ID not configured');
      return;
    }
    const state = btoa(JSON.stringify({
      origin: window.location.origin,
      source: 'media_publish',
      return_to: `${window.location.pathname}${window.location.search}`,
    }));
    const oauthUrl = `https://www.instagram.com/oauth/authorize?client_id=${META_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${IG_SCOPES}&response_type=code&state=${state}`;
    window.location.href = oauthUrl;
  };

  const handleDisconnect = async () => {
    await supabase.functions.invoke('instagram-connect-user', {
      body: { action: 'disconnect' },
    });
    sharedConnectionCache = { account: null, expiresAt: Date.now() + 5 * 60_000 };
    setIgAccount(null);
    window.dispatchEvent(new CustomEvent('ig-account-changed', { detail: null }));
    setShowPanel(false);
    toast.success(ar ? 'تم قطع الاتصال بـ Instagram' : 'Instagram disconnected');
  };

  const pollStatus = useCallback(async (jobId: string) => {
    setPolling(true);
    let attempts = 0;
    const maxAttempts = 24; // 2 minutes max polling (5s interval)

    const poll = async () => {
      attempts++;
      try {
        const { data, error } = await supabase.functions.invoke('instagram-publish-status', {
          body: { job_id: jobId },
        });
        if (error || !data) throw new Error('Poll failed');

        if (data.status === 'published') {
          setPublished(true);
          setPublishing(false);
          setPolling(false);
          setPendingJobId(null);
          toast.success(ar ? 'تم النشر على Instagram!' : 'Published to Instagram!');
          return;
        }
        if (data.status === 'failed') {
          throw new Error(data.error || 'Publish failed');
        }
        // Still processing
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000);
        } else {
          throw new Error('Timed out waiting for video to process');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setPublishing(false);
        setPolling(false);
        setPendingJobId(null);
        toast.error(ar ? `فشل النشر: ${msg}` : `Publish failed: ${msg}`);
      }
    };

    await poll();
  }, [ar]);

  const handlePublish = async () => {
    if (!mediaUrl || !igAccount) return;
    setPublishing(true);

    try {
      const { data, error } = await supabase.functions.invoke('instagram-publish-media', {
        body: {
          media_type: mediaType,
          media_url: mediaUrl,
          caption,
          publish_target: selectedTarget,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Publish failed');
      }

      if (data.status === 'published') {
        setPublished(true);
        setPublishing(false);
        setShowPanel(false);
        toast.success(ar ? 'تم النشر على Instagram!' : 'Published to Instagram!');
      } else if (data.status === 'processing') {
        // Video/Reel is processing — start polling
        setPendingJobId(data.job_id);
        await pollStatus(data.job_id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPublishing(false);
      toast.error(ar ? `فشل النشر: ${msg}` : `Publish failed: ${msg}`);
    }
  };

  if (checkingStatus) return null;

  // Published state
  if (published) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 text-pink-400 text-sm font-semibold">
        <Check className="h-4 w-4" />
        {ar ? 'تم النشر!' : 'Posted!'}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Instagram button */}
      <button
        onClick={() => {
          if (!igAccount) {
            handleConnect();
          } else {
            setShowPanel((p) => !p);
          }
        }}
        disabled={publishing || polling}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-orange-500/20 hover:from-pink-500/30 hover:via-purple-500/30 hover:to-orange-500/30 border border-pink-500/30 text-pink-500 dark:text-pink-400 disabled:opacity-60"
      >
        {publishing || polling ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Instagram className="h-4 w-4" />
        )}
        {publishing
          ? (ar ? 'جاري النشر...' : 'Publishing...')
          : polling
          ? (ar ? 'جاري المعالجة...' : 'Processing...')
          : igAccount
          ? (ar ? 'نشر على Instagram' : 'Post to Instagram')
          : (ar ? 'ربط Instagram' : 'Connect Instagram')}
      </button>

      {/* Publish panel */}
      {showPanel && igAccount && (
        <div
          className="absolute bottom-full mb-2 right-0 z-50 w-72 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-md shadow-2xl shadow-black/40 p-4 space-y-3"
          style={{ direction: ar ? 'rtl' : 'ltr' }}
        >
          {/* Account info */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {igAccount.profile_picture_url ? (
                <img src={igAccount.profile_picture_url} alt="" className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center">
                  <Instagram className="h-4 w-4 text-white" />
                </div>
              )}
              <span className="text-sm font-semibold truncate max-w-[120px]">
                @{igAccount.instagram_username || igAccount.instagram_name}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleDisconnect}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-1 rounded-lg hover:bg-destructive/10"
              >
                {ar ? 'فصل' : 'Disconnect'}
              </button>
              <button
                onClick={() => setShowPanel(false)}
                className="p-1 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {ar ? 'التعليق' : 'Caption'}
              </label>
              <button
                onClick={handleGenerateCaption}
                disabled={generatingCaption || !caption.trim()}
                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-gradient-to-r from-pink-500/15 to-purple-500/15 hover:from-pink-500/25 hover:to-purple-500/25 border border-pink-500/20 text-pink-500 dark:text-pink-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generatingCaption ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {ar ? 'تحسين التعليق' : 'Enhance Caption'}
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={ar ? 'اكتب شيئاً عن الصورة... مثال: شعاري الجديد — ثم اضغط تحسين التعليق (اختياري)' : 'Describe the image... e.g. my new logo launch — then hit Enhance Caption (optional)'}
              rows={3}
              maxLength={500}
              className="w-full text-sm rounded-xl border border-border/60 bg-muted/40 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-pink-500/50 placeholder:text-muted-foreground/50"
            />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{caption.length}/500</p>
          </div>

          {/* Publish target selector for video */}
          {(mediaType === 'video' || mediaType === 'reel') && (
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                {ar ? 'نوع النشر' : 'Publish as'}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedTarget('reel')}
                  className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                    selectedTarget === 'reel'
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white border-transparent'
                      : 'border-border/60 text-muted-foreground hover:border-pink-500/40'
                  }`}
                >
                  🎬 {ar ? 'ريل' : 'Reel'}
                </button>
                <button
                  onClick={() => setSelectedTarget('feed')}
                  className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${
                    selectedTarget === 'feed'
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white border-transparent'
                      : 'border-border/60 text-muted-foreground hover:border-pink-500/40'
                  }`}
                >
                  📷 {ar ? 'منشور' : 'Post'}
                </button>
              </div>
            </div>
          )}

          {/* Publish button */}
          <button
            onClick={handlePublish}
            disabled={publishing || polling}
            className="w-full py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500 text-white hover:opacity-90 active:scale-95 transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {publishing || polling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {polling ? (ar ? 'جاري المعالجة...' : 'Processing...') : (ar ? 'جاري النشر...' : 'Publishing...')}
              </>
            ) : (
              <>
                <Instagram className="h-4 w-4" />
                {ar ? 'نشر الآن' : 'Publish Now'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
