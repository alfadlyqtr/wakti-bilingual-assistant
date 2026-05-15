import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Paperclip, Loader2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { SavedMediaAttachmentPicker, SavedMediaSelection } from '@/components/email/SavedMediaAttachmentPicker';
import { buildComposedEmailBodies, buildSignatureHtml, readEmailSignatureSettings } from '@/utils/emailSignature';

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
  htmlBody?: string;
  attachments: MailComposerAttachment[];
  threadId?: string;
}

interface MailComposerProps {
  onClose: () => void;
  onSend: (input: MailComposerSubmitInput) => Promise<boolean>;
  replyTo?: MailComposerReplyTo;
  fromLabel?: string | null;
  initialBody?: string;
}

const COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/webp', 'image/png']);
const MAX_ATTACHMENT_DIMENSION = 1920;
const IMAGE_COMPRESSION_QUALITY = 0.82;
const MIN_IMAGE_SIZE_FOR_COMPRESSION = 350 * 1024;

function splitRecipientList(value: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let angleDepth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previousChar = index > 0 ? value[index - 1] : '';

    if (char === '"' && previousChar !== '\\') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === '<') {
      angleDepth += 1;
    } else if (!inQuotes && char === '>') {
      angleDepth = Math.max(0, angleDepth - 1);
    }

    if (!inQuotes && angleDepth === 0 && (char === ',' || char === ';')) {
      const token = current.trim();
      if (token) tokens.push(token);
      current = '';
      continue;
    }

    current += char;
  }

  const lastToken = current.trim();
  if (lastToken) tokens.push(lastToken);
  return tokens;
}

function splitRecipients(value: string): string[] {
  return splitRecipientList(value);
}

async function fileToAttachment(file: Blob, name: string, contentType?: string): Promise<MailComposerAttachment> {
  const reader = new FileReader();
  return await new Promise((resolve, reject) => {
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const content = result.includes(',') ? result.split(',')[1] || '' : result;
      resolve({
        name,
        contentType: contentType || 'application/octet-stream',
        content,
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read attachment'));
    reader.readAsDataURL(file);
  });
}

async function loadImageSource(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      };
    } catch {
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = objectUrl;
    });
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressImageFile(file: File): Promise<Blob | null> {
  if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type) || file.size < MIN_IMAGE_SIZE_FOR_COMPRESSION) {
    return null;
  }

  try {
    const source = await loadImageSource(file);
    const scale = Math.min(1, MAX_ATTACHMENT_DIMENSION / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    source.draw(context, width, height);
    const outputType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, outputType, outputType === 'image/png' ? undefined : IMAGE_COMPRESSION_QUALITY);
    });
    if (!blob || blob.size >= file.size) return null;
    return blob;
  } catch {
    return null;
  }
}

function readFileAsBase64(file: File): Promise<MailComposerAttachment> {
  return new Promise(async (resolve, reject) => {
    try {
      const compressed = await compressImageFile(file);
      const attachment = await fileToAttachment(compressed || file, file.name, compressed?.type || file.type || 'application/octet-stream');
      resolve(attachment);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Failed to read attachment'));
    }
  });
}

function sanitizeAttachmentName(name: string) {
  return (name || 'attachment')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'attachment';
}

function extensionFromMimeType(contentType?: string | null) {
  if (!contentType) return '';
  const normalized = contentType.split(';')[0]?.trim().toLowerCase();
  switch (normalized) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/mp4':
      return 'm4a';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/ogg':
      return 'ogg';
    default:
      return normalized.includes('/') ? normalized.split('/')[1] || '' : '';
  }
}

function extensionFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const lastSegment = pathname.split('/').pop() || '';
    const ext = lastSegment.includes('.') ? lastSegment.split('.').pop() || '' : '';
    return ext.toLowerCase();
  } catch {
    return '';
  }
}

function ensureAttachmentName(name: string, contentType?: string | null, url?: string) {
  const safeName = sanitizeAttachmentName(name);
  if (/\.[a-z0-9]{2,5}$/i.test(safeName)) return safeName;
  const ext = extensionFromMimeType(contentType) || (url ? extensionFromUrl(url) : '');
  return ext ? `${safeName}.${ext}` : safeName;
}

function savedMediaBaseName(item: SavedMediaSelection) {
  const fallback = item.kind === 'image' ? 'wakti-image' : item.kind === 'video' ? 'wakti-video' : 'wakti-audio';
  return ensureAttachmentName(item.title || fallback, item.contentType, item.url);
}

async function savedMediaToAttachment(item: SavedMediaSelection): Promise<MailComposerAttachment> {
  const response = await fetch(item.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch saved media (${response.status})`);
  }

  const blob = await response.blob();
  const contentType = blob.type || item.contentType || 'application/octet-stream';
  const attachmentName = ensureAttachmentName(savedMediaBaseName(item), contentType, item.url);
  return fileToAttachment(blob, attachmentName, contentType);
}

export function MailComposer({ onClose, onSend, replyTo, fromLabel, initialBody = '' }: MailComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [signatureSettings] = useState(() => readEmailSignatureSettings());
  const [to, setTo] = useState(replyTo?.to || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : '');
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [attachments, setAttachments] = useState<MailComposerAttachment[]>([]);
  const [attachSourceOpen, setAttachSourceOpen] = useState(false);
  const [savedPickerOpen, setSavedPickerOpen] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(() => readEmailSignatureSettings().enabled);

  useEffect(() => {
    setTo(replyTo?.to || '');
    setSubject(replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : '');
    setBody(initialBody);
  }, [initialBody, replyTo]);

  const openAttachmentPicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
      }
    }

    input.click();
  }, []);

  const handleOpenAttachSource = useCallback(() => {
    setAttachSourceOpen(true);
  }, []);

  const handleAttachFromDevice = useCallback(() => {
    setAttachSourceOpen(false);
    openAttachmentPicker();
  }, [openAttachmentPicker]);

  const handleAttachFromSaved = useCallback(() => {
    setAttachSourceOpen(false);
    setSavedPickerOpen(true);
  }, []);

  const canSend = useMemo(() => {
    return splitRecipients(to).length > 0 && subject.trim().length > 0 && body.trim().length > 0 && !loadingAttachments;
  }, [body, loadingAttachments, subject, to]);

  const signaturePreviewHtml = useMemo(() => {
    if (!signatureSettings.enabled || !includeSignature) return '';
    return buildSignatureHtml(signatureSettings);
  }, [includeSignature, signatureSettings]);

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

  const handleSavedMediaSelect = useCallback(async (item: SavedMediaSelection) => {
    setLoadingAttachments(true);
    try {
      const attachment = await savedMediaToAttachment(item);
      setAttachments(prev => [...prev, attachment]);
      toast.success('Saved media attached');
    } catch (error) {
      console.error('Failed to attach saved media:', error);
      toast.error('Failed to attach saved media');
      throw error;
    } finally {
      setLoadingAttachments(false);
    }
  }, []);

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    const composedBodies = buildComposedEmailBodies(body, signatureSettings, includeSignature);
    const ok = await onSend({
      to: splitRecipients(to),
      cc: splitRecipients(cc),
      subject: subject.trim(),
      body: composedBodies.textBody,
      htmlBody: composedBodies.htmlBody,
      attachments,
      threadId: replyTo?.threadId,
    });
    setSending(false);
    if (ok) onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
        <div className="flex max-h-[calc(100dvh-0.75rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border border-border bg-card text-card-foreground shadow-2xl sm:max-h-[calc(100dvh-2rem)]">
          <div className="border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-foreground">{replyTo ? 'Reply' : 'Compose Email'}</div>
                {fromLabel ? <div className="mt-1 truncate text-xs text-muted-foreground">From: {fromLabel}</div> : null}
              </div>
              <button title="Close" onClick={onClose} className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
            <div className="grid gap-3">
              <div className="rounded-2xl border border-border bg-background/80 px-3 py-2.5">
                <label htmlFor="mail-composer-to" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">To</label>
                <input
                  id="mail-composer-to"
                  type="text"
                  value={to}
                  onChange={event => setTo(event.target.value)}
                  placeholder="name@email.com, another@email.com"
                  className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
              </div>

              <div className="rounded-2xl border border-border bg-background/80 px-3 py-2.5">
                <label htmlFor="mail-composer-cc" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">CC</label>
                <input
                  id="mail-composer-cc"
                  type="text"
                  value={cc}
                  onChange={event => setCc(event.target.value)}
                  placeholder="optional@email.com"
                  className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
              </div>

              <div className="rounded-2xl border border-border bg-background/80 px-3 py-2.5">
                <label htmlFor="mail-composer-subject" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Subject</label>
                <input
                  id="mail-composer-subject"
                  type="text"
                  value={subject}
                  onChange={event => setSubject(event.target.value)}
                  placeholder="Subject"
                  className="w-full border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/80 px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="mail-composer-body" className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Message</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    id="mail-composer-attachments"
                    type="file"
                    multiple
                    title="Choose attachments, photos, videos, or audio"
                    aria-label="Choose attachments, photos, videos, or audio"
                    onChange={handleAttachmentChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    title="Add attachments"
                    onClick={handleOpenAttachSource}
                    className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
                className="min-h-[180px] w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/70 sm:min-h-[220px]"
              />
            </div>

            <div className="rounded-2xl border border-border bg-background/80 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Email signature</div>
                  <div className="mt-1 text-xs text-muted-foreground">Add your Wakti signature to this email.</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{includeSignature ? 'On' : 'Off'}</span>
                  <Switch checked={includeSignature} onCheckedChange={setIncludeSignature} aria-label="Include email signature" />
                </div>
              </div>

              {includeSignature && signaturePreviewHtml ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-white">
                  <div
                    className="min-h-[144px] w-full bg-white p-4"
                    dangerouslySetInnerHTML={{ __html: signaturePreviewHtml }}
                  />
                </div>
              ) : null}
            </div>

            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.name}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-foreground/80">
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[180px] truncate">{attachment.name}</span>
                    <button
                      type="button"
                      title="Remove attachment"
                      onClick={() => handleRemoveAttachment(index)}
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
            <button onClick={onClose} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
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

      {attachSourceOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[22px] border border-[#060541]/12 bg-white p-4 text-[#060541] shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Attach</div>
                <div className="mt-1 text-xs text-[#060541]/60">Choose where to attach from.</div>
              </div>
              <button type="button" title="Close" onClick={() => setAttachSourceOpen(false)} className="rounded-xl p-2 text-[#060541]/55 transition-colors hover:bg-[#f4f6ff] hover:text-[#060541]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-2">
              <Button type="button" variant="outline" className="justify-start gap-2 border-[#060541]/12 text-[#060541] hover:bg-[#f7f8ff]" onClick={handleAttachFromDevice}>
                <Paperclip className="h-4 w-4" />
                From device
              </Button>
              <Button type="button" variant="outline" className="justify-start gap-2 border-[#060541]/12 text-[#060541] hover:bg-[#f7f8ff]" onClick={handleAttachFromSaved}>
                <Paperclip className="h-4 w-4" />
                From Wakti Saved
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {savedPickerOpen ? (
        <SavedMediaAttachmentPicker
          onClose={() => setSavedPickerOpen(false)}
          onSelect={handleSavedMediaSelect}
        />
      ) : null}
    </>
  );
}
