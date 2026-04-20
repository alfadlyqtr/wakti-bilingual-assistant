import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageCircle, X, Send, MessageSquareText, Mic, Image as ImageIcon, FileText, CheckCircle2,
} from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

/**
 * Item #8 post-Batch-B (message popup feature).
 * Shown by `MessageNotificationProvider` when a new direct message arrives
 * and the user is not currently viewing that sender's chat thread.
 */

export interface IncomingMessagePreview {
  messageId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  /** Human-readable preview (truncated at 80 chars by the provider) */
  preview: string;
  /** Raw message type — determines the preview icon */
  messageType: 'text' | 'image' | 'voice' | 'pdf';
  /** ISO timestamp for sort/display */
  createdAt: string;
}

interface MessageNotificationPopupProps {
  isOpen: boolean;
  message: IncomingMessagePreview | null;
  onClose: () => void;
  onOpenChat: () => void;
  /** Sends a text reply to the sender; returns true on success so the popup can auto-close. */
  onSendReply: (text: string) => Promise<boolean>;
}

const MAX_REPLY_CHARS = 200;

export function MessageNotificationPopup({
  isOpen,
  message,
  onClose,
  onOpenChat,
  onSendReply,
}: MessageNotificationPopupProps) {
  const { language } = useTheme();
  const isAr = language === 'ar';

  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset local state whenever a new message is shown
  useEffect(() => {
    if (isOpen && message) {
      setShowReply(false);
      setReplyText('');
      setIsSending(false);
      setJustSent(false);
    }
  }, [isOpen, message?.messageId]);

  // Focus the textarea when reply mode opens
  useEffect(() => {
    if (showReply) {
      // Small delay lets the enter animation settle before focusing
      const id = window.setTimeout(() => textareaRef.current?.focus(), 120);
      return () => window.clearTimeout(id);
    }
  }, [showReply]);

  if (!message) return null;

  const typeIcon = (() => {
    switch (message.messageType) {
      case 'voice': return <Mic className="h-3.5 w-3.5" />;
      case 'image': return <ImageIcon className="h-3.5 w-3.5" />;
      case 'pdf':   return <FileText className="h-3.5 w-3.5" />;
      default:      return <MessageSquareText className="h-3.5 w-3.5" />;
    }
  })();

  const initials = (message.senderName || '?')
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const charCount = replyText.length;
  const isOverLimit = charCount > MAX_REPLY_CHARS;
  const canSend = replyText.trim().length > 0 && !isOverLimit && !isSending;

  const handleSendClick = async () => {
    if (!canSend) return;
    setIsSending(true);
    try {
      const ok = await onSendReply(replyText.trim());
      if (ok) {
        setJustSent(true);
        setReplyText('');
        // Brief "Sent ✓" state, then close
        window.setTimeout(() => {
          onClose();
        }, 1200);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ scale: 0.86, opacity: 0, y: 36 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 24 }}
            transition={{ type: 'spring', duration: 0.55 }}
            className="relative z-10 w-full max-w-md"
          >
            <Card className="overflow-hidden border border-sky-400/25 bg-[linear-gradient(135deg,#0c0f14_0%,rgba(19,31,52,0.98)_45%,rgba(15,40,66,0.98)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(56,189,248,0.18)] text-white">
              <CardContent className="p-0">

                {/* Header — sender + badge + close */}
                <div className="relative overflow-hidden px-5 pt-5 pb-4">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.18),transparent_35%)]" />
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 z-10 rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={isAr ? 'إغلاق' : 'Close'}
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="relative z-10 flex items-start gap-4">
                    <Avatar className="h-16 w-16 border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
                      {message.senderAvatar ? (
                        <AvatarImage src={message.senderAvatar} alt={message.senderName} />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-sky-500/20 to-indigo-500/20 text-sky-200">
                        {initials || <MessageCircle className="h-6 w-6" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-200">
                        {typeIcon}
                        {isAr ? 'رسالة جديدة' : 'New Message'}
                      </div>
                      <h2 className="truncate text-lg font-extrabold leading-tight text-white">
                        {message.senderName}
                      </h2>
                      <p className="mt-1 text-xs text-white/60">
                        {isAr ? 'أرسل لك رسالة' : 'sent you a message'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body — message preview + actions */}
                <div className="border-t border-white/10 bg-black/10 px-5 py-4 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/85 break-words">
                    {message.preview}
                  </div>

                  {/* Reply mode: inline textarea */}
                  <AnimatePresence initial={false}>
                    {showReply && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                          <Textarea
                            ref={textareaRef}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={isAr ? 'اكتب ردك...' : 'Type your reply...'}
                            disabled={isSending || justSent}
                            rows={2}
                            className="min-h-[44px] resize-none border-0 bg-transparent text-sm text-white placeholder:text-white/40 focus-visible:ring-0"
                            maxLength={MAX_REPLY_CHARS + 40}
                            dir={isAr ? 'rtl' : 'ltr'}
                          />
                          <div className="flex items-center justify-between px-1 pt-1">
                            <span className={`text-[10px] ${isOverLimit ? 'text-red-400' : 'text-white/40'}`}>
                              {charCount}/{MAX_REPLY_CHARS}
                            </span>
                            {justSent ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {isAr ? 'تم الإرسال' : 'Sent'}
                              </span>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                onClick={handleSendClick}
                                disabled={!canSend}
                                className="h-8 gap-1 bg-sky-500 text-white hover:bg-sky-400 disabled:opacity-40"
                              >
                                <Send className="h-3.5 w-3.5" />
                                {isAr ? 'إرسال' : 'Send'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Action row */}
                  {!justSent && (
                    <div className="flex items-center gap-2">
                      {!showReply && (
                        <Button
                          type="button"
                          onClick={() => setShowReply(true)}
                          variant="outline"
                          className="flex-1 border border-sky-500/60 bg-transparent text-sky-300 hover:bg-sky-500/10 hover:text-sky-200 hover:border-sky-400"
                        >
                          <MessageSquareText className="mr-1 h-4 w-4" />
                          {isAr ? 'رد' : 'Reply'}
                        </Button>
                      )}
                      <Button
                        type="button"
                        onClick={onOpenChat}
                        variant="outline"
                        className="flex-1 border border-indigo-500/60 bg-transparent text-indigo-300 hover:bg-indigo-500/10 hover:text-indigo-200 hover:border-indigo-400"
                      >
                        <MessageCircle className="mr-1 h-4 w-4" />
                        {isAr ? 'فتح المحادثة' : 'Open chat'}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
