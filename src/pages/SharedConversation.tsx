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

  return (
    <div className="min-h-screen bg-[#fcfefd] dark:bg-[#0c0f14]" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Branded header */}
      <div className="sticky top-0 z-10 border-b border-[#e5e2d8] dark:border-white/10 bg-[#fcfefd]/95 dark:bg-[#0c0f14]/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#060541] flex items-center justify-center text-white font-black text-sm">W</div>
            <div>
              <div className="text-sm font-bold text-[#060541] dark:text-[#f2f2f2]">WAKTI AI</div>
              <div className="text-[10px] text-[#858384]">{isAr ? 'محادثة مشتركة' : 'Shared Conversation'}</div>
            </div>
          </div>
          <Link
            to="/"
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#060541] text-white hover:opacity-90 transition-opacity active:scale-95"
          >
            {isAr ? 'جرّب وقتي' : 'Try Wakti'}
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20 text-[#858384]">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <AlertCircle className="h-8 w-8 text-[#858384]" />
            <p className="text-sm text-[#606062] dark:text-[#858384]">{error}</p>
            <Link to="/" className="text-xs font-semibold text-[#060541] dark:text-[#e9ceb0] underline">
              {isAr ? 'العودة إلى وقتي' : 'Back to Wakti'}
            </Link>
          </div>
        )}

        {!loading && !error && (
          <>
            {title && (
              <h1 className="text-lg font-bold text-[#060541] dark:text-[#f2f2f2] mb-5">{title}</h1>
            )}
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap break-words ${
                      msg.role === 'user'
                        ? 'bg-[#060541] text-white rounded-br-md'
                        : 'bg-white dark:bg-[#161a22] border border-[#e5e2d8] dark:border-white/10 text-[#1f2430] dark:text-[#f2f2f2] rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center text-[10px] text-[#858384]">
              {isAr ? 'تمت المشاركة عبر WAKTI AI — wakti.qa' : 'Shared via WAKTI AI — wakti.qa'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
