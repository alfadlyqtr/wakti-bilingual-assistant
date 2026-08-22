import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

interface SharedMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string | null;
}

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://hxauxozopvpzpdygoqwf.supabase.co';

export default function SharedConversation() {
  const { token } = useParams<{ token: string }>();
  const { language } = useTheme();
  const isAr = language === 'ar';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [messages, setMessages] = useState<SharedMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/shared-conversation?token=${encodeURIComponent(token || '')}`);
        if (!resp.ok) {
          setError(resp.status === 404
            ? (isAr ? 'هذه المحادثة غير موجودة أو تم إلغاء مشاركتها' : 'This conversation was not found or is no longer shared')
            : (isAr ? 'تعذر تحميل المحادثة' : 'Could not load the conversation'));
          return;
        }
        const data = await resp.json();
        if (cancelled) return;
        setTitle(data.title || '');
        setMessages(Array.isArray(data.messages) ? data.messages : []);
      } catch {
        if (!cancelled) setError(isAr ? 'تعذر تحميل المحادثة' : 'Could not load the conversation');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, isAr]);

  const formatTime = (ts: string | null) => {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleString(isAr ? 'ar-QA' : 'en-GB', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  };

  return (
    // Self-contained scroll container: the app shell locks body scroll, so this
    // page scrolls itself — this is what makes it scrollable inside the app/WebView.
    <div
      className="h-[100dvh] overflow-y-auto overscroll-contain"
      dir={isAr ? 'rtl' : 'ltr'}
      style={{ background: 'linear-gradient(135deg, #0c0f14 0%, hsl(235 25% 7%) 50%, #0c0f14 100%)' }}
    >
      {/* Branded header */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0c0f14]/90 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm"
              style={{ background: 'linear-gradient(135deg, #060541 0%, hsl(260 70% 25%) 100%)', boxShadow: '0 0 25px hsla(210, 100%, 65%, 0.35)' }}
            >
              W
            </div>
            <div>
              <div className="text-sm font-bold text-[#f2f2f2] tracking-wide">WAKTI AI</div>
              <div className="text-[10px] text-[#858384]">{isAr ? 'محادثة مشتركة' : 'Shared Conversation'}</div>
            </div>
          </div>
          <Link
            to="/"
            className="text-xs font-semibold px-4 py-2 rounded-full text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #060541 0%, hsl(260 70% 25%) 100%)', boxShadow: '0 0 20px hsla(280, 70%, 65%, 0.3)' }}
          >
            {isAr ? 'جرّب وقتي' : 'Try Wakti'}
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-16">
        {loading && (
          <div className="flex items-center justify-center py-24 text-[#858384]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <AlertCircle className="h-8 w-8 text-[#858384]" />
            <p className="text-sm text-[#858384]">{error}</p>
            <Link to="/" className="text-xs font-semibold text-[#e9ceb0] underline">
              {isAr ? 'العودة إلى وقتي' : 'Back to Wakti'}
            </Link>
          </div>
        )}

        {!loading && !error && (
          <>
            {title && (
              <div className="mb-6 text-center">
                <h1 className="text-xl font-extrabold text-[#f2f2f2] tracking-tight">{title}</h1>
                <div className="mt-2 mx-auto h-px w-16" style={{ background: 'linear-gradient(90deg, transparent, hsla(210,100%,65%,0.6), transparent)' }} />
              </div>
            )}
            <div className="space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-[15px] leading-7 whitespace-pre-wrap break-words ${
                      msg.role === 'user'
                        ? 'text-white rounded-br-md'
                        : 'text-[#f2f2f2] rounded-bl-md border border-white/10'
                    }`}
                    style={msg.role === 'user'
                      ? { background: 'linear-gradient(135deg, #060541 0%, hsl(260 70% 25%) 100%)', boxShadow: '0 4px 20px hsla(243, 84%, 14%, 0.5)' }
                      : { background: 'linear-gradient(135deg, hsl(235 25% 10%) 0%, hsl(250 20% 12%) 100%)', boxShadow: '0 2px 16px hsla(0, 0%, 0%, 0.4)' }
                    }
                  >
                    {msg.content}
                  </div>
                  {msg.timestamp && (
                    <span className="mt-1 px-1 text-[10px] text-[#858384]">{formatTime(msg.timestamp)}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center gap-2">
              <div className="text-[10px] text-[#858384]">
                {isAr ? 'تمت المشاركة عبر' : 'Shared via'}
              </div>
              <div className="text-xs font-bold tracking-wide" style={{ background: 'linear-gradient(135deg, #f2f2f2, hsl(210 30% 80%))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                WAKTI AI · wakti.qa
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
