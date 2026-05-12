import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Loader2, Send, X } from 'lucide-react';

export interface MailComposerAttachment {
  name: string;
  contentType?: string;
  content: string;
}

export interface MailComposerReplyTo {
  to: string;
  subject: string;
  threadId?: string;
}

export interface MailComposerSubmitInput {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  attachments: MailComposerAttachment[];
  threadId?: string;
}

interface MailComposerProps {
  onClose: () => void;
  onSend: (input: MailComposerSubmitInput) => Promise<boolean>;
  replyTo?: MailComposerReplyTo;
  fromLabel?: string | null;
}

function splitRecipients(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function readFileAsBase64(file: File): Promise<MailComposerAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const content = result.includes(',') ? result.split(',')[1] || '' : result;
      resolve({
        name: file.name,
        contentType: file.type || 'application/octet-stream',
        content,
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read attachment'));
    reader.readAsDataURL(file);
  });
}

export function MailComposer({ onClose, onSend, replyTo, fromLabel }: MailComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [to, setTo] = useState(replyTo?.to || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachments, setAttachments] = useState<MailComposerAttachment[]>([]);

  const canSend = useMemo(() => {
    return splitRecipients(to).length > 0 && subject.trim().length > 0 && body.trim().length > 0 && !loadingAttachments;
  }, [body, loadingAttachments, subject, to]);

  const handleAttachmentChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    setLoadingAttachments(true);
    try {
      const nextAttachments = await Promise.all(files.map(readFileAsBase64));
      setAttachments(prev => [...prev, ...nextAttachments]);
    } finally {
      setLoadingAttachments(false);
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    const ok = await onSend({
      to: splitRecipients(to),
      cc: splitRecipients(cc),
      subject: subject.trim(),
      body,
      attachments,
      threadId: replyTo?.threadId,
    });
    setSending(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0f14] shadow-2xl">
        <div className="border-b border-white/10 bg-white/[0.02] px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-semibold text-white">{replyTo ? 'Reply' : 'Compose Email'}</div>
              {fromLabel ? <div className="mt-1 text-xs text-white/55 truncate">From: {fromLabel}</div> : null}
            </div>
            <button title="Close" onClick={onClose} className="rounded-xl p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <label htmlFor="mail-composer-to" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/45">To</label>
              <input
                id="mail-composer-to"
                type="text"
                value={to}
                onChange={event => setTo(event.target.value)}
                placeholder="name@email.com, another@email.com"
                className="w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-white/30"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <label htmlFor="mail-composer-cc" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/45">CC</label>
              <input
                id="mail-composer-cc"
                type="text"
                value={cc}
                onChange={event => setCc(event.target.value)}
                placeholder="optional@email.com"
                className="w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-white/30"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <label htmlFor="mail-composer-subject" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-white/45">Subject</label>
              <input
                id="mail-composer-subject"
                type="text"
                value={subject}
                onChange={event => setSubject(event.target.value)}
                placeholder="Subject"
                className="w-full border-0 bg-transparent p-0 text-sm text-white outline-none placeholder:text-white/30"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor="mail-composer-body" className="text-[11px] font-medium uppercase tracking-wide text-white/45">Message</label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  id="mail-composer-attachments"
                  type="file"
                  multiple
                  title="Choose attachments"
                  aria-label="Choose attachments"
                  onChange={handleAttachmentChange}
                  className="hidden"
                />
                <button
                  type="button"
                  title="Add attachments"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {loadingAttachments ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  Attach
                </button>
              </div>
            </div>
            <textarea
              id="mail-composer-body"
              value={body}
              onChange={event => setBody(event.target.value)}
              placeholder="Write your message..."
              rows={10}
              className="min-h-[220px] w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-white outline-none placeholder:text-white/30"
            />
          </div>

          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <div key={`${attachment.name}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80">
                  <Paperclip className="h-3 w-3" />
                  <span className="max-w-[180px] truncate">{attachment.name}</span>
                  <button
                    type="button"
                    title="Remove attachment"
                    onClick={() => handleRemoveAttachment(index)}
                    className="rounded-full p-0.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 sm:px-5">
          <button onClick={onClose} className="text-sm text-white/55 transition-colors hover:text-white">
            Cancel
          </button>
          <Button
            onClick={handleSend}
            disabled={sending || !canSend}
            className="h-10 gap-2 rounded-xl bg-blue-600 px-5 text-white hover:bg-blue-700"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
