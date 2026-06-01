import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGmailMessages, GmailMessage, GmailMessageFull, GmailLabel } from '@/hooks/useGmailMessages';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MailComposer, MailComposerPreset, MailComposerSubmitInput } from '@/components/email/MailComposer';
import { EmailAiAssistant } from '@/components/email/EmailAiAssistant';
import { EmailMessageAttachments } from '@/components/email/EmailMessageAttachments';
import { EmailMessageAttachment } from '@/utils/emailAttachmentDownload';
import {
  Inbox, Send, Pencil, ChevronLeft, RefreshCw, Loader2,
  ChevronDown, Reply, Forward, Trash2, MailOpen, Search, X,
} from 'lucide-react';

function GmailIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function extractName(emailStr: string): string {
  if (!emailStr) return '';
  const match = emailStr.match(/^"?([^"<]+)"?\s*</);
  if (match) return match[1].trim();
  return emailStr.replace(/<.*>/, '').trim() || emailStr;
}

function extractEmailAddress(emailStr: string): string {
  if (!emailStr) return '';
  const bracketMatch = emailStr.match(/<([^>]+)>/);
  if (bracketMatch) return bracketMatch[1].trim();
  const plainMatch = emailStr.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return plainMatch ? plainMatch[0] : emailStr.trim();
}

interface MessageRowProps {
  message: GmailMessage;
  activeFolder: string;
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

function MessageRow({ message, activeFolder, deleting, onOpen, onDelete }: MessageRowProps) {
  const personLabel = activeFolder === 'SENT'
    ? `To: ${extractName(message.to) || message.to}`
    : extractName(message.from) || message.from;

  return (
    <div className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[linear-gradient(180deg,rgba(243,245,255,0.96),rgba(239,242,255,0.96))] sm:px-5 sm:py-3.5 dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.72),rgba(14,17,24,0.68))]">
      <div className="pt-1.5">
        <div className={`h-2.5 w-2.5 rounded-full ${message.isUnread ? 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]' : 'bg-[#060541]/14 dark:bg-muted-foreground/20'}`} />
      </div>

      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={`truncate text-sm ${message.isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
              {personLabel}
            </div>
            <div className={`mt-0.5 truncate text-sm ${message.isUnread ? 'text-foreground/90' : 'text-muted-foreground'}`}>
              {message.subject || '(no subject)'}
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">
              {message.snippet || 'No preview available'}
            </div>
          </div>
          <div className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">{formatDate(message.date)}</div>
        </div>
      </button>

      <button
        title="Delete"
        onClick={onDelete}
        disabled={deleting}
        className="mt-0.5 shrink-0 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-[#eef2ff] hover:text-red-500 disabled:opacity-60 dark:hover:bg-accent"
      >
        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

interface MessageViewProps {
  message: GmailMessageFull;
  onBack: () => void;
  onReply: () => void;
  onForward: () => void;
  onDelete: () => void;
  onDownloadAttachment: (attachment: EmailMessageAttachment) => void;
  downloadingAttachmentId?: string | null;
  deleting: boolean;
  language?: string;
  canReply?: boolean;
  aiPanel?: React.ReactNode;
}

function formatPlainEmailBody(body: string, subject: string): string {
  const normalized = body
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!normalized) return '';

  let cleaned = normalized;
  const trimmedSubject = subject.trim();
  if (trimmedSubject) {
    const escapedSubject = trimmedSubject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    cleaned = cleaned.replace(new RegExp(`^${escapedSubject}(?:\\s*[-:;,.–—]+\\s*|\\s+)`, 'i'), '').trim();
  }

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  if (/\n\s*\n/.test(cleaned)) {
    return cleaned;
  }

  const flattened = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const sentences = flattened
    .split(/(?<=[.!?؟])\s+(?=[A-Z0-9\u0600-\u06FF])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length >= 4) {
    const paragraphs: string[] = [];
    for (let index = 0; index < sentences.length; index += 2) {
      paragraphs.push(sentences.slice(index, index + 2).join(' '));
    }
    return paragraphs.join('\n\n');
  }

  return flattened;
}

function MessageView({ message, onBack, onReply, onForward, onDelete, onDownloadAttachment, downloadingAttachmentId = null, deleting, language = 'en', canReply = true, aiPanel }: MessageViewProps) {
  const senderName = extractName(message.from) || message.from || '—';
  const senderEmail = extractEmailAddress(message.from) || message.from || '—';
  const backLabel = language === 'ar' ? 'رجوع' : 'Back';
  const replyLabel = language === 'ar' ? 'رد' : 'Reply';
  const forwardLabel = language === 'ar' ? 'إعادة إرسال' : 'Forward';
  const senderLabel = language === 'ar' ? 'المرسل' : 'Sender';
  const emailLabel = language === 'ar' ? 'البريد الإلكتروني' : 'Email';
  const toLabel = language === 'ar' ? 'إلى' : 'To';
  const dateLabel = language === 'ar' ? 'التاريخ' : 'Date';
  const bodyHtml = message.body?.html || '';
  const bodyText = formatPlainEmailBody(message.body?.text || message.snippet || '', message.subject || '');

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-[#060541]/10 pb-4 dark:border-border/40">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onBack} className="shrink-0 gap-1.5 rounded-xl px-3 h-9 text-xs border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] text-[#060541] shadow-[0_4px_12px_rgba(6,5,65,0.05)] hover:bg-[#eef2ff] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))]">
            <ChevronLeft className="h-3.5 w-3.5" />
            {backLabel}
          </Button>
          {aiPanel ? <div className="shrink-0">{aiPanel}</div> : null}
          {canReply ? (
            <Button type="button" variant="outline" onClick={onReply} className="shrink-0 gap-1.5 rounded-xl px-3 h-9 text-xs border-blue-500/20 bg-blue-50 text-blue-600 shadow-[0_4px_12px_rgba(59,130,246,0.08)] hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:shadow-none dark:hover:bg-blue-500/20">
              <Reply className="h-3.5 w-3.5" />
              {replyLabel}
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onForward} className="shrink-0 gap-1.5 rounded-xl px-3 h-9 text-xs border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] text-[#060541] shadow-[0_4px_12px_rgba(6,5,65,0.05)] hover:bg-[#eef2ff] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))]">
            <Forward className="h-3.5 w-3.5" />
            {forwardLabel}
          </Button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground break-words">{message.subject || '(no subject)'}</h2>
          <button title="Delete" aria-label="Delete" onClick={onDelete} disabled={deleting} className="shrink-0 rounded-xl p-2 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-60 dark:hover:bg-red-500/10">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-[#060541]/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,249,255,0.96))] p-3 shadow-[0_8px_24px_rgba(6,5,65,0.05)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(18,22,31,0.92),rgba(11,14,21,0.9))] dark:shadow-[0_12px_28px_rgba(0,0,0,0.24)]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 rounded-xl border border-[#060541]/10 bg-white/75 px-3 py-2 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.88))]">
            <div className="text-left text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{senderLabel}</div>
            <div className="mt-1 text-left truncate text-sm font-semibold text-foreground">{senderName}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-[#060541]/10 bg-white/75 px-3 py-2 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.88))]">
            <div className="text-left text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{emailLabel}</div>
            <div className="mt-1 text-left truncate text-sm text-foreground/85">{senderEmail}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-[#060541]/10 bg-white/75 px-3 py-2 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.88))] sm:col-span-2 xl:col-span-1">
            <div className="text-left text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{toLabel}</div>
            <div className="mt-1 text-left truncate text-sm text-foreground/85">{message.to || '—'}</div>
          </div>
          <div className="min-w-0 rounded-xl border border-[#060541]/10 bg-white/75 px-3 py-2 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.88))]">
            <div className="text-left text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{dateLabel}</div>
            <div className="mt-1 text-left truncate text-sm text-foreground/85">{formatDate(message.date)}</div>
          </div>
        </div>
      </div>
      <EmailMessageAttachments
        attachments={message.attachments}
        downloadingId={downloadingAttachmentId}
        language={language}
        onDownload={onDownloadAttachment}
      />
      <div className="flex-1 min-h-0">
        <div className="h-full overflow-y-auto pt-4 pr-1">
          <div className="px-1 py-1">
            {bodyHtml ? (
              <div
                className="email-message-html text-sm text-foreground"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <div className="email-message-plain text-foreground">
                {bodyText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FolderItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  systemFolder: boolean;
}

const SYSTEM_FOLDERS: FolderItem[] = [
  { id: 'INBOX', label: 'Inbox', icon: <Inbox className="h-3.5 w-3.5" />, systemFolder: true },
  { id: 'SENT', label: 'Sent', icon: <Send className="h-3.5 w-3.5" />, systemFolder: true },
];

interface GmailClientProps {
  connected: boolean;
  emailAddress?: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  language?: string;
  operatorPreset?: MailComposerPreset | null;
  onOperatorPresetConsumed?: () => void;
}

export function GmailClient({ connected, emailAddress, onConnect, onDisconnect, language = 'en', operatorPreset = null, onOperatorPresetConsumed }: GmailClientProps) {
  const gmail = useGmailMessages();
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageFull | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string; threadId: string } | undefined>();
  const [composerInitialBody, setComposerInitialBody] = useState('');
  const [activePreset, setActivePreset] = useState<MailComposerPreset | null>(operatorPreset);
  const [customFolders, setCustomFolders] = useState<GmailLabel[]>([]);
  const [showFolders, setShowFolders] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const connectedLabel = language === 'ar' ? 'متصل' : 'Connected';
  const composeLabel = language === 'ar' ? 'إنشاء' : 'Compose';
  const refreshLabel = language === 'ar' ? 'تحديث' : 'Refresh';
  const searchPlaceholder = language === 'ar' ? 'ابحث في المرسل أو الموضوع' : 'Search sender or subject';
  const noSearchResultsLabel = language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching results';
  const activeFolderLabel = gmail.activeFolder === 'INBOX'
    ? 'Inbox'
    : gmail.activeFolder === 'SENT'
      ? 'Sent'
      : gmail.activeFolder;
  const mailboxLine = emailAddress ? `${language === 'ar' ? 'الحساب' : 'Account'}: ${emailAddress}` : 'Gmail account';
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const hasInboxCache = gmail.hasCachedFolder('INBOX');
  const surfaceCardClass = 'rounded-[24px] border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(245,247,255,0.97))] p-3 text-[#060541] shadow-[0_16px_36px_rgba(6,5,65,0.08)] ring-1 ring-[#060541]/5 sm:p-4 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(16,20,29,0.98),rgba(10,12,18,0.96))] dark:text-card-foreground dark:shadow-[0_18px_36px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5';
  const chipClass = 'rounded-full border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.98))] px-3 py-1 text-[11px] shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]';
  const iconButtonClass = 'rounded-xl border border-[#060541]/16 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] p-2.5 text-[#060541] shadow-[0_4px_12px_rgba(6,5,65,0.06)] transition-colors hover:bg-[#f3f5ff] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))] dark:hover:text-accent-foreground';
  const folderButtonBaseClass = 'border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.98))] text-[#060541]/76 shadow-[0_4px_12px_rgba(6,5,65,0.05)] hover:border-[#060541]/24 hover:bg-[#f3f5ff] hover:text-[#060541] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-muted-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))] dark:hover:text-accent-foreground';
  const filteredMessages = useMemo(() => {
    if (!normalizedSearch) return gmail.messages;

    return gmail.messages.filter((message) => {
      const searchableText = [message.from, message.to, message.subject]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [gmail.messages, normalizedSearch]);

  useEffect(() => {
    if (connected) {
      gmail.fetchMessages('INBOX', undefined, hasInboxCache ? { forceRefresh: true, background: true, quiet: true } : undefined);
      gmail.fetchLabels().then(() => {});
    }
  }, [connected, gmail.fetchLabels, gmail.fetchMessages, hasInboxCache]);

  useEffect(() => {
    if (gmail.labels.length > 0) {
      const userLabels = gmail.labels.filter(
        l => l.type === 'user' && !['CHAT', 'SPAM', 'TRASH'].includes(l.id)
      );
      setCustomFolders(userLabels);
    }
  }, [gmail.labels]);

  useEffect(() => {
    if (!operatorPreset) return;
    setReplyTo(undefined);
    setComposerInitialBody(operatorPreset.body || '');
    setActivePreset(operatorPreset);
    setShowCompose(true);
    onOperatorPresetConsumed?.();
  }, [onOperatorPresetConsumed, operatorPreset]);

  const handleOpenMessage = async (msg: GmailMessage) => {
    setLoadingMessage(true);
    const full = await gmail.fetchMessage(msg.id);
    setLoadingMessage(false);
    if (full) {
      setSelectedMessage(full);
      if (msg.isUnread) {
        gmail.fetchMessages(gmail.activeFolder);
      }
    }
  };

  const handleReply = () => {
    if (!selectedMessage) return;
    setReplyTo({
      to: selectedMessage.from,
      subject: selectedMessage.subject,
      threadId: selectedMessage.threadId,
    });
    setComposerInitialBody('');
    setShowCompose(true);
  };

  const handleForward = () => {
    if (!selectedMessage) return;
    const originalBody = selectedMessage.body?.text || selectedMessage.snippet || '';
    const fwdSubject = selectedMessage.subject?.startsWith('Fwd:') ? selectedMessage.subject : `Fwd: ${selectedMessage.subject || ''}`;
    setReplyTo({ to: '', subject: fwdSubject, threadId: '' });
    setComposerInitialBody(`\n\n-------- Forwarded Message --------\nFrom: ${selectedMessage.from}\nDate: ${selectedMessage.date}\nSubject: ${selectedMessage.subject}\n\n${originalBody}`);
    setShowCompose(true);
  };

  const handleCloseCompose = () => {
    setShowCompose(false);
    setReplyTo(undefined);
    setComposerInitialBody('');
    setActivePreset(null);
  };

  const handleUseAiReply = useCallback((text: string) => {
    if (!selectedMessage) return;
    setReplyTo({
      to: selectedMessage.from,
      subject: selectedMessage.subject,
      threadId: selectedMessage.threadId,
    });
    setComposerInitialBody(text);
    setShowCompose(true);
  }, [selectedMessage]);

  const handleSend = async (input: MailComposerSubmitInput) => {
    const ok = await gmail.sendMessage(input);
    if (!ok) return false;
    await gmail.fetchMessages('SENT', undefined, {
      forceRefresh: true,
      background: gmail.activeFolder !== 'SENT',
      quiet: true,
    });
    return ok;
  };

  const handleFolderSwitch = (folderId: string) => {
    setSelectedMessage(null);
    setShowFolders(false);
    gmail.fetchMessages(folderId);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await gmail.fetchMessages(gmail.activeFolder, undefined, { forceRefresh: true, background: gmail.messages.length > 0, quiet: gmail.messages.length > 0 });
      await gmail.fetchLabels({ forceRefresh: true });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    setDeletingMessage(true);
    const deleted = await gmail.trashMessage(selectedMessage.id);
    if (deleted) {
      setSelectedMessage(null);
      await gmail.fetchLabels({ forceRefresh: true });
    }
    setDeletingMessage(false);
  };

  const handleDeleteFromList = async (message: GmailMessage) => {
    setDeletingRowId(message.id);
    await gmail.trashMessage(message.id);
    await gmail.fetchLabels({ forceRefresh: true });
    setDeletingRowId(null);
  };

  const handleDownloadAttachment = useCallback(async (attachment: EmailMessageAttachment) => {
    if (!selectedMessage) return;
    setDownloadingAttachmentId(attachment.id);
    try {
      await gmail.downloadAttachment(selectedMessage.id, attachment);
    } finally {
      setDownloadingAttachmentId(null);
    }
  }, [gmail, selectedMessage]);

  const selectedMessageAiSource = useMemo(() => {
    if (!selectedMessage) return null;
    return {
      subject: selectedMessage.subject,
      from: selectedMessage.from,
      to: selectedMessage.to,
      date: selectedMessage.date,
      snippet: selectedMessage.snippet,
      bodyText: selectedMessage.body?.text || selectedMessage.snippet || '',
    };
  }, [selectedMessage]);

  const resolveSelectedAttachmentContent = useCallback(async (attachment: EmailMessageAttachment) => {
    if (!selectedMessage) return null;
    return await gmail.getAttachmentContent(selectedMessage.id, attachment);
  }, [gmail, selectedMessage]);

  const resolveRecentMessages = useCallback(async () => {
    const recent = gmail.messages.slice(0, 5);
    const resolved = await Promise.all(recent.map(async (message) => {
      try {
        const full = await gmail.fetchMessage(message.id);
        return {
          subject: message.subject,
          from: message.from,
          to: message.to,
          date: message.date,
          snippet: message.snippet,
          bodyText: full?.body?.text || message.snippet || '',
        };
      } catch {
        return {
          subject: message.subject,
          from: message.from,
          to: message.to,
          date: message.date,
          snippet: message.snippet,
          bodyText: message.snippet || '',
        };
      }
    }));
    return resolved;
  }, [gmail.fetchMessage, gmail.messages]);

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="rounded-full border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] p-4 shadow-[0_10px_24px_rgba(6,5,65,0.06)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
          <GmailIcon size={32} />
        </div>
        <div>
          <div className="font-semibold text-base mb-1">Gmail not connected</div>
          <div className="text-sm text-muted-foreground">Connect your Gmail account to read and send emails</div>
        </div>
        <Button onClick={onConnect} className="bg-[#060541] hover:bg-[#0a0a5c] text-white gap-2">
          <GmailIcon size={14} />
          Connect Gmail
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={surfaceCardClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
                <GmailIcon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <span className="block max-w-full truncate text-base font-semibold text-foreground">{emailAddress || 'Gmail'}</span>
                  <Badge className="bg-green-600 text-white hover:bg-green-600 text-[10px] px-1.5 py-0">{connectedLabel}</Badge>
                </div>
                <div className="mt-1 max-w-full truncate text-xs text-muted-foreground">{mailboxLine}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {emailAddress ? (
                <div className={`${chipClass} max-w-full text-muted-foreground`}>
                  <span className="block max-w-[220px] truncate sm:max-w-[280px]">{emailAddress}</span>
                </div>
              ) : null}
              <div className={`${chipClass} text-foreground/80`}>
                {activeFolderLabel}
              </div>
              <div className={`${chipClass} text-muted-foreground`}>
                {filteredMessages.length} shown
              </div>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            <button
              onClick={handleRefresh}
              className={iconButtonClass}
              title={refreshLabel}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <Button
              size="sm"
              onClick={() => { setReplyTo(undefined); setShowCompose(true); }}
              className="h-10 flex-1 rounded-xl bg-blue-600 px-4 text-white hover:bg-blue-700 gap-1.5 sm:flex-none"
            >
              <Pencil className="h-3.5 w-3.5" />
              {composeLabel}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {SYSTEM_FOLDERS.map(f => (
          <button
            key={f.id}
            onClick={() => handleFolderSwitch(f.id)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
              gmail.activeFolder === f.id
                ? 'bg-blue-600 text-white shadow-sm'
                : folderButtonBaseClass
            }`}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
        {customFolders.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowFolders(v => !v)}
              className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${folderButtonBaseClass}`}
            >
              More
              <ChevronDown className="h-3 w-3" />
            </button>
            {showFolders && (
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(246,248,255,0.98))] text-[#060541] shadow-[0_24px_50px_rgba(6,5,65,0.14)] ring-1 ring-[#060541]/5 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(16,20,29,0.98),rgba(10,12,18,0.96))] dark:text-popover-foreground dark:shadow-[0_24px_50px_rgba(0,0,0,0.45)] dark:ring-1 dark:ring-white/5">
                {customFolders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleFolderSwitch(f.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#eef2ff] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))]"
                  >
                    <MailOpen className="h-3 w-3 text-muted-foreground" />
                    {f.name}
                    {(f.messagesUnread ?? 0) > 0 && (
                      <span className="ml-auto text-[10px] bg-blue-600 text-white rounded-full px-1.5">{f.messagesUnread}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="min-h-[360px] overflow-hidden rounded-[24px] border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(246,248,255,0.98))] text-[#060541] shadow-[0_16px_36px_rgba(6,5,65,0.08)] ring-1 ring-[#060541]/5 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(16,20,29,0.98),rgba(10,12,18,0.96))] dark:text-card-foreground dark:shadow-[0_18px_36px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5">
        {selectedMessage ? (
          <div className="h-full p-4 sm:p-5">
            {loadingMessage ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MessageView
                message={selectedMessage}
                onBack={() => setSelectedMessage(null)}
                onReply={handleReply}
                onForward={handleForward}
                onDelete={handleDeleteMessage}
                onDownloadAttachment={handleDownloadAttachment}
                downloadingAttachmentId={downloadingAttachmentId}
                deleting={deletingMessage}
                language={language}
                canReply={gmail.activeFolder !== 'SENT'}
                aiPanel={selectedMessageAiSource ? (
                  <EmailAiAssistant
                    mode="message"
                    language={language}
                    contextKey={selectedMessage.id}
                    message={selectedMessageAiSource}
                    attachments={selectedMessage.attachments}
                    resolveAttachmentContent={resolveSelectedAttachmentContent}
                    canReply={gmail.activeFolder !== 'SENT'}
                    onStartReply={handleReply}
                    onUseAsReply={handleUseAiReply}
                    variant="floating"
                  />
                ) : null}
              />
            )}
          </div>
        ) : (
          <>
            <div className="border-b border-[#060541]/10 px-4 py-3 dark:border-border/50 sm:px-5">
              <div className="flex items-center gap-2 rounded-2xl border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,249,255,0.98))] px-3 py-2.5 shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
                <Search className="h-4 w-4 shrink-0 text-[#060541]/45 dark:text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-5 w-full bg-transparent text-sm text-[#060541] outline-none placeholder:text-[#060541]/36 dark:text-foreground dark:placeholder:text-muted-foreground"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    title={language === 'ar' ? 'مسح البحث' : 'Clear search'}
                    aria-label={language === 'ar' ? 'مسح البحث' : 'Clear search'}
                    onClick={() => setSearchQuery('')}
                    className="rounded-full p-1 text-[#060541]/55 transition-colors hover:bg-[#eef2ff] hover:text-[#060541] dark:text-muted-foreground dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))] dark:hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
            {gmail.loading && gmail.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{language === 'ar' ? 'جاري تحميل البريد...' : 'Loading your inbox...'}</span>
              </div>
            ) : gmail.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <Inbox className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">No messages in {gmail.activeFolder === 'INBOX' ? 'Inbox' : gmail.activeFolder === 'SENT' ? 'Sent' : gmail.activeFolder}</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <Search className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">{noSearchResultsLabel}</span>
              </div>
            ) : (
              <div className="divide-y divide-[#060541]/10 dark:divide-border">
                {filteredMessages.map(msg => (
                  <MessageRow
                    key={msg.id}
                    message={msg}
                    activeFolder={gmail.activeFolder}
                    deleting={deletingRowId === msg.id}
                    onOpen={() => handleOpenMessage(msg)}
                    onDelete={() => handleDeleteFromList(msg)}
                  />
                ))}
                {gmail.nextPageToken && (
                  <div className="px-4 py-3 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={gmail.loadMore}
                      disabled={gmail.loading}
                      className="border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] text-xs text-[#060541] shadow-[0_4px_12px_rgba(6,5,65,0.05)] hover:bg-[#f3f5ff] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))]"
                    >
                      {gmail.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Load more
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showCompose && (
        <MailComposer
          onClose={handleCloseCompose}
          onSend={handleSend}
          replyTo={replyTo}
          fromLabel={emailAddress || 'Gmail'}
          initialBody={composerInitialBody}
          preset={activePreset}
        />
      )}
    </div>
  );
}
