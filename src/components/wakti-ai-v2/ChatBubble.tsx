
import React, { useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';
import { User, Bot, Image as ImageIcon, Search, MessageSquare, Copy, Save, Expand, Play, Pause, Loader2, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useState } from 'react';
import { ImageModal } from './ImageModal';
import { supabase } from '@/integrations/supabase/client';
import { getSelectedVoices } from './TalkBackSettings';
import { safeCopyToClipboard } from '@/utils/clipboardUtils';

// Proxy image URLs through our Edge Function to avoid COEP/CORS blocking
const SUPABASE_URL = 'https://hxauxozopvpzpdygoqwf.supabase.co';
function getProxiedImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;
  if (originalUrl.includes('im.runware.ai') || originalUrl.includes('supabase.co/storage')) {
    return `${SUPABASE_URL}/functions/v1/wakti-image-proxy?url=${encodeURIComponent(originalUrl)}`;
  }
  return originalUrl;
}

interface ChatBubbleProps {
  message: any;
  userProfile?: any;
  activeTrigger?: string;
}

export function ChatBubble({ message, userProfile, activeTrigger }: ChatBubbleProps) {
  const { language } = useTheme();
  const isUser = message.role === 'user';
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isFetchingAudio, setIsFetchingAudio] = useState(false);

  // Format message content with enhanced buddy-chat features
  const formatContent = (content: string) => {
    if (!content) return '';
    
    // Handle markdown-style links [text](url)
    let formattedContent = content.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-500 hover:text-blue-700 underline font-medium">$1</a>'
    );
    
    // Handle line breaks
    formattedContent = formattedContent.replace(/\n/g, '<br />');
    
    return formattedContent;
  };

  // Copy message content to clipboard
  const handleCopy = async () => {
    try {
      await safeCopyToClipboard(message.content);
      toast.success(language === 'ar' ? 'تم النسخ!' : 'Copied!', {
        description: language === 'ar' ? 'تم نسخ الرسالة إلى الحافظة' : 'Message copied to clipboard',
      });
    } catch (error) {
      console.error('Failed to copy message:', error);
      toast.error(language === 'ar' ? 'خطأ' : 'Error', {
        description: language === 'ar' ? 'فشل في نسخ الرسالة' : 'Failed to copy message',
      });
    }
  };

  // === iOS-SAFE TTS (aligned with ChatMessages.tsx) ===
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioUnlockedRef = useRef(false);
  const ttsRunIdRef = useRef(0);
  const ttsQueueRef = useRef<{ runId: number; chunks: string[]; index: number; objectUrls: string[] } | null>(null);

  // Create persistent audio element once (iOS requires reuse)
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      try { (audio as any).playsInline = true; } catch {}
      audioRef.current = audio;
    }
    return () => {
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch {}
        audioRef.current.src = '';
      }
    };
  }, []);

  const bufferToBase64 = (buffer: ArrayBuffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const cleanupQueue = () => {
    const q = ttsQueueRef.current;
    if (q?.objectUrls?.length) {
      for (const u of q.objectUrls) {
        try { URL.revokeObjectURL(u); } catch {}
      }
    }
    ttsQueueRef.current = null;
  };

  const stopCurrentAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); audioSourceRef.current.disconnect(); } catch {}
      audioSourceRef.current = null;
    }
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const sanitizeForTTS = (raw: string) => {
    try {
      let t = raw || '';
      t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
      t = t.replace(/#{1,6}\s*/g, '');
      t = t.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1');
      t = t.replace(/`{1,3}[^`]*`{1,3}/g, ' ');
      t = t.replace(/`/g, ' ');
      t = t.replace(/^[>\-*+]\s*/gm, '');
      t = t.replace(/\|+/g, ', ');
      t = t.replace(/[:;]+/g, ', ');
      t = t.replace(/[\r\n]+/g, '. ');
      t = t.replace(/\s{2,}/g, ' ');
      return t.trim().slice(0, 1000);
    } catch {
      return (raw || '').slice(0, 1000);
    }
  };

  const splitTtsText = (input: string, maxChars: number = 240): string[] => {
    try {
      const cleaned = String(input || '').replace(/\s+/g, ' ').trim();
      if (!cleaned) return [];
      if (cleaned.length <= maxChars) return [cleaned];
      const parts = cleaned
        .split(/(?<=[.!?\u061f])\s+/)
        .map(s => s.trim())
        .filter(Boolean);
      const out: string[] = [];
      let buf = '';
      const flush = () => {
        const v = buf.trim();
        if (v) out.push(v);
        buf = '';
      };
      for (const p of (parts.length ? parts : [cleaned])) {
        if (p.length > maxChars) {
          flush();
          for (let i = 0; i < p.length; i += maxChars) out.push(p.slice(i, i + maxChars).trim());
          continue;
        }
        if (!buf) buf = p;
        else if ((buf.length + 1 + p.length) <= maxChars) buf = `${buf} ${p}`;
        else { flush(); buf = p; }
      }
      flush();
      return out.length ? out : [cleaned.slice(0, maxChars)];
    } catch {
      return [String(input || '').slice(0, maxChars)];
    }
  };

  const handleSpeak = async () => {
    try {
      // If already speaking, toggle pause/resume
      if (isSpeaking) {
        const el = audioRef.current;
        if (el) {
          if (el.paused) {
            try { await el.play(); setIsPaused(false); } catch {}
          } else {
            try { el.pause(); setIsPaused(true); } catch {}
          }
        }
        return;
      }

      // Stop any current playback
      ttsRunIdRef.current += 1;
      cleanupQueue();
      stopCurrentAudio();

      let cleanText = sanitizeForTTS(message.content || '');
      if (!cleanText || cleanText.length < 3) {
        console.warn('[TTS-Bubble] No readable text after sanitization');
        return;
      }

      setIsSpeaking(true);
      setIsPaused(false);
      setIsFetchingAudio(true);

      // Mobile AudioContext unlock
      if (!audioUnlockedRef.current) {
        try {
          const ctx = getAudioContext();
          if (ctx.state === 'suspended') await ctx.resume();
          audioUnlockedRef.current = true;
        } catch {}
      }

      // Determine voice from TalkBack settings
      const isArabicText = /[\u0600-\u06FF]/.test(cleanText);
      const { ar, en } = getSelectedVoices();
      const voice_id = (isArabicText || language === 'ar') ? ar : en;
      const gender = voice_id.toLowerCase().includes('female') ? 'female' : 'male';

      // Auth + endpoint
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://hxauxozopvpzpdygoqwf.supabase.co';

      const runId = ttsRunIdRef.current;
      const chunks = splitTtsText(cleanText, 240);

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || ((navigator.platform === 'MacIntel') && (navigator.maxTouchPoints > 1));

      // --- WebAudio playback (primary) ---
      const playWithWebAudio = async (arrayBuffer: ArrayBuffer): Promise<boolean> => {
        try {
          const ctx = getAudioContext();
          if (ctx.state === 'suspended') await ctx.resume();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          audioSourceRef.current = source;
          source.onended = () => {
            setIsSpeaking(false); setIsPaused(false);
            audioSourceRef.current = null;
          };
          source.start(0);
          return true;
        } catch (err) {
          console.warn('[TTS-Bubble] WebAudio decode failed, trying HTML5:', err);
          return false;
        }
      };

      // --- HTML5 Audio fallback (iOS-safe with data URI) ---
      const playWithHTML5 = async (blob: Blob, contentType: string) => {
        const el = audioRef.current;
        if (!el) return;
        try { el.muted = false; el.volume = 1.0; } catch {}

        let audioUrl: string;
        if (isIOS) {
          try {
            const buf = await blob.arrayBuffer();
            const b64 = bufferToBase64(buf);
            audioUrl = `data:${contentType || 'audio/wav'};base64,${b64}`;
          } catch {
            audioUrl = URL.createObjectURL(blob);
          }
        } else {
          audioUrl = URL.createObjectURL(blob);
        }

        el.src = audioUrl;
        try { el.load(); } catch {}
        el.onended = () => { setIsSpeaking(false); setIsPaused(false); };
        el.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
        try { await el.play(); } catch (err) {
          console.error('[TTS-Bubble] HTML5 play() rejected:', err);
          setIsSpeaking(false); setIsPaused(false);
        }
      };

      // --- Fetch audio from voice-tts ---
      const fetchChunkBytes = async (chunkText: string) => {
        const resp = await fetch(`${supabaseUrl}/functions/v1/voice-tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'audio/wav, audio/mpeg, audio/*',
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ text: chunkText, voice_id, gender, style: 'neutral' })
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          throw new Error(`TTS failed: ${resp.status} ${errText}`);
        }
        const mime = resp.headers.get('content-type') || 'audio/mpeg';
        const buf = await resp.arrayBuffer();
        return { mime, buf };
      };

      // Single chunk: use WebAudio (fast) with HTML5 fallback
      if (chunks.length <= 1) {
        const { mime, buf } = await fetchChunkBytes(cleanText);
        setIsFetchingAudio(false);
        if (!buf || buf.byteLength === 0) {
          setIsSpeaking(false);
          return;
        }
        const webOk = await playWithWebAudio(buf);
        if (!webOk) {
          const blob = new Blob([buf], { type: mime });
          await playWithHTML5(blob, mime);
        }
        return;
      }

      // Multi-chunk: sequential playback via HTML5 audio element
      const queue = { runId, chunks, index: 0, objectUrls: [] as string[] };
      ttsQueueRef.current = queue;
      const chunkPromises = chunks.map(c => fetchChunkBytes(c));

      const playChunkAt = async (idx: number) => {
        const q = ttsQueueRef.current;
        if (!q || q.runId !== runId) return;
        if (idx >= q.chunks.length) {
          setIsSpeaking(false); setIsPaused(false);
          cleanupQueue();
          return;
        }
        if (idx === 0) setIsFetchingAudio(false);
        q.index = idx;
        const { mime, buf } = await chunkPromises[idx];
        const blob = new Blob([buf], { type: mime || 'audio/mpeg' });

        const el = audioRef.current;
        if (!el) return;

        let audioUrl: string;
        if (isIOS) {
          try {
            const b64 = bufferToBase64(buf);
            audioUrl = `data:${mime || 'audio/wav'};base64,${b64}`;
          } catch {
            audioUrl = URL.createObjectURL(blob);
          }
        } else {
          audioUrl = URL.createObjectURL(blob);
          q.objectUrls.push(audioUrl);
        }

        el.onended = () => {
          const cur = ttsQueueRef.current;
          if (!cur || cur.runId !== runId) return;
          playChunkAt(idx + 1).catch(() => { setIsSpeaking(false); setIsPaused(false); cleanupQueue(); });
        };
        el.onerror = () => { setIsSpeaking(false); setIsPaused(false); cleanupQueue(); };
        el.src = audioUrl;
        try { el.load(); } catch {}
        try { await el.play(); } catch { setIsSpeaking(false); setIsPaused(false); cleanupQueue(); }
      };

      await playChunkAt(0);

    } catch (error) {
      console.error('[TTS-Bubble] Failed:', error);
      setIsSpeaking(false);
      setIsPaused(false);
      setIsFetchingAudio(false);
      cleanupQueue();
    }
  };

  // FIXED: Get correct mode indicator icon based on actual message context
  const getModeIcon = () => {
    // Check if message has browsing data (search mode)
    if (message.browsingUsed || message.browsingData) {
      return <Search className="w-3 h-3" />;
    }
    
    // Check if message has image (image mode)
    if (message.imageUrl || (message.attachedFiles && message.attachedFiles.some((f: any) => f.type?.startsWith('image/')))) {
      return <ImageIcon className="w-3 h-3" />;
    }
    
    // Default to chat mode
    return <MessageSquare className="w-3 h-3" />;
  };

  // FIXED: Get correct mode name based on actual message context
  const getModeName = () => {
    // Check if message has browsing data (search mode)
    if (message.browsingUsed || message.browsingData) {
      return language === 'ar' ? 'بحث' : 'Search';
    }
    
    // Check if message has image (image mode)
    if (message.imageUrl || (message.attachedFiles && message.attachedFiles.some((f: any) => f.type?.startsWith('image/')))) {
      return language === 'ar' ? 'صورة' : 'Image';
    }
    
    // Default to chat mode
    return language === 'ar' ? 'محادثة' : 'Chat';
  };

  // ADDED: Format timestamp
  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const msgTime = new Date(timestamp);
    const diffInHours = (now.getTime() - msgTime.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return msgTime.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else if (diffInHours < 48) {
      return language === 'ar' ? 'أمس' : 'Yesterday';
    } else {
      return msgTime.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  // ------ GENERATED IMAGE ACTIONS ------
  const [showImageModal, setShowImageModal] = useState(false);

  // Save image to downloads
  const handleSaveImage = async () => {
    try {
      const response = await fetch(message.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wakti-generated-image-${Date.now()}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(language === 'ar' ? 'تم حفظ الصورة' : 'Image saved!');
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في حفظ الصورة' : 'Failed to save image');
    }
  };

  // Copy generated image URL
  const handleCopyImageUrl = async () => {
    try {
      await navigator.clipboard.writeText(message.imageUrl);
      toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Image URL copied!');
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل في نسخ الرابط' : 'Failed to copy image URL');
    }
  };

  // Expand image: just opens the image modal
  const handleExpandImage = () => {
    setShowImageModal(true);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`
          flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
          ${isUser 
            ? 'bg-blue-500 text-white' 
            : 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
          }
        `}>
          {isUser ? (
            <User className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>

        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Message bubble with FIXED alignment */}
          <Card className={`
            p-3 max-w-full
            ${isUser 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'bg-card border-border'
            }
          `}>
            <div className="space-y-2">
              {/* FIXED: Mode indicator for assistant messages only - shows correct mode */}
              {!isUser && (
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {getModeIcon()}
                    <span className="capitalize">
                      {getModeName()}
                    </span>
                  </div>
                  {/* ADDED: Timestamp for assistant messages */}
                  <div className="text-xs text-muted-foreground">
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              )}

              {/* User message mode indicator and timestamp */}
              {isUser && (
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-white/60">
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
              )}

              {/* FIXED: Message content with proper alignment */}
              <div 
                className={`text-sm whitespace-pre-wrap ${isUser ? 'text-right' : 'text-left'}`}
                dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
              />

              {/* Image display - STANDARDIZED for both user and AI messages */}
              {Array.isArray(message.attachedFiles) && message.attachedFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 max-w-xs">
                  {message.attachedFiles.map((file: any, idx: number) =>
                    file.type && file.type.startsWith('image/') ? (
                      <img
                        key={idx}
                        src={file.preview || file.url || file.publicUrl}
                        alt={file.name || 'Uploaded image'}
                        className="rounded-lg border max-h-40 max-w-[140px] object-contain"
                        style={{ background: '#f6f6f8' }}
                      />
                    ) : null
                  )}
                </div>
              )}

              {/* Image display for assistant bubble (original logic) */}
              {message.imageUrl && (
                <div className="mt-2">
                  <img 
                    src={getProxiedImageUrl(message.imageUrl)} 
                    alt="Generated image" 
                    className="max-w-full h-auto rounded-lg border"
                    style={{ maxHeight: '300px' }}
                  />
                  {/* Mini action buttons for generated images */}
                  <div className="flex flex-row items-center gap-2 mt-2">
                    {/* Save Image */}
                    <button
                      aria-label={language === 'ar' ? 'حفظ' : 'Save image'}
                      className="p-1 rounded hover:bg-primary/10 active:bg-primary/20 transition-colors"
                      onClick={handleSaveImage}
                      type="button"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    {/* Copy Image URL */}
                    <button
                      aria-label={language === 'ar' ? 'نسخ الرابط' : 'Copy image url'}
                      className="p-1 rounded hover:bg-primary/10 active:bg-primary/20 transition-colors"
                      onClick={handleCopyImageUrl}
                      type="button"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {/* Expand/Zoom Image */}
                    <button
                      aria-label={language === 'ar' ? 'تكبير' : 'Expand image'}
                      className="p-1 rounded hover:bg-primary/10 active:bg-primary/20 transition-colors"
                      onClick={handleExpandImage}
                      type="button"
                    >
                      <Expand className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Image Modal for Expand */}
                  <ImageModal
                    isOpen={showImageModal}
                    onClose={() => setShowImageModal(false)}
                    imageUrl={message.imageUrl}
                    prompt={message.content}
                  />
                </div>
              )}

              {/* ENHANCED: Mini action buttons for ALL messages */}
              <div className="flex items-center gap-2 mt-2 pt-1 border-t border-border/30">
                {/* Mini Copy Button */}
                <button
                  onClick={handleCopy}
                  className="p-1 rounded-md hover:bg-muted/60 transition-colors"
                  title={language === 'ar' ? 'نسخ' : 'Copy'}
                >
                  <Copy className={`w-3 h-3 ${isUser ? 'text-white/70 hover:text-white' : 'text-muted-foreground'}`} />
                </button>
                
                {/* ENHANCED: Mini Speak Button - iOS-safe with WebAudio + HTML5 fallback */}
                <button
                  onPointerUp={handleSpeak}
                  className={`p-1 rounded-md transition-colors ${
                    isSpeaking 
                      ? 'text-green-600 bg-green-500/15 shadow-[0_0_8px_rgba(34,197,94,0.7)]' 
                      : 'hover:bg-muted/60'
                  }`}
                  title={isSpeaking && !isPaused ? (language==='ar'?'إيقاف مؤقت':'Pause') : (language==='ar'?'تشغيل':'Play')}
                >
                  {isFetchingAudio ? (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  ) : isSpeaking && !isPaused ? (
                    <Pause className="w-3 h-3" />
                  ) : (
                    <Play className={`w-3 h-3 ${isUser ? 'text-white/70 hover:text-white' : 'text-muted-foreground'}`} />
                  )}
                </button>
              </div>

              {/* Enhanced buddy-chat features */}
              {!isUser && message.buddyChat && (
                <div className="mt-3 space-y-2">
                  {/* Cross-mode suggestion */}
                  {message.buddyChat.crossModeSuggestion && (
                    <div className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded border-l-2 border-blue-400">
                      <span className="text-blue-600 dark:text-blue-400">
                        💡 {language === 'ar' 
                          ? 'اقتراح: جرب وضع'
                          : 'Suggestion: Try'
                        } {message.buddyChat.crossModeSuggestion} {language === 'ar' ? 'للحصول على نتائج أفضل' : 'mode for better results'}
                      </span>
                    </div>
                  )}

                  {/* Follow-up question */}
                  {message.buddyChat.followUpQuestion && (
                    <div className="text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded border-l-2 border-green-400">
                      <span className="text-green-600 dark:text-green-400">
                        🤔 {message.buddyChat.followUpQuestion}
                      </span>
                    </div>
                  )}

                  {/* Quick actions */}
                  {message.buddyChat.quickActions && message.buddyChat.quickActions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {message.buddyChat.quickActions.map((action: string, index: number) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="text-xs h-6 px-2"
                          onClick={() => {
                            // Handle quick action click - could dispatch to parent component
                            console.log('Quick action clicked:', action);
                          }}
                        >
                          {action}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Related topics */}
                  {message.buddyChat.relatedTopics && message.buddyChat.relatedTopics.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">
                        {language === 'ar' ? 'مواضيع ذات صلة:' : 'Related topics:'} 
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {message.buddyChat.relatedTopics.map((topic: string, index: number) => (
                          <Link
                            key={index}
                            to={`/search?q=${encodeURIComponent(topic)}`}
                            className="text-primary hover:underline"
                          >
                            #{topic}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
