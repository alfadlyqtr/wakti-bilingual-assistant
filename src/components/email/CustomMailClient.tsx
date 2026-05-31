import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useImapMessages, ImapMessage, ImapMessageFull } from '@/hooks/useImapMessages';
import { ImapConnection, ImapConnectionHealth } from '@/hooks/useEmailConnections';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MailComposer, MailComposerPreset, MailComposerSubmitInput } from '@/components/email/MailComposer';
import { EmailAiAssistant } from '@/components/email/EmailAiAssistant';
import { EmailMessageAttachments } from '@/components/email/EmailMessageAttachments';
import { EmailMessageAttachment } from '@/utils/emailAttachmentDownload';
import {
  Inbox, Send, Pencil, ChevronLeft, RefreshCw, Loader2,
  Reply, Forward, Plug, Settings2, Trash2, Search, X,
} from 'lucide-react';

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
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
  message: ImapMessage;
  activeFolder: 'INBOX' | 'SENT';
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

function MessageRow({ message, activeFolder, deleting, onOpen, onDelete }: MessageRowProps) {
  const personLabel = activeFolder === 'SENT'
    ? `To: ${extractName(message.to) || message.to}`
    : extractName(message.from) || message.from;
  const isUnread = activeFolder === 'INBOX' && message.isUnread;

  return (
    <div className={`group flex items-start gap-3 px-4 py-3 transition-colors sm:px-5 sm:py-3.5 ${isUnread ? 'bg-blue-500/[0.08] ring-1 ring-inset ring-blue-500/25 dark:bg-blue-500/[0.10] dark:ring-blue-400/25' : ''} hover:bg-[linear-gradient(180deg,rgba(243,245,255,0.96),rgba(239,242,255,0.96))] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.72),rgba(14,17,24,0.68))]`}>
      <div className="pt-1.5">
        <div className={`h-2.5 w-2.5 rounded-full ${isUnread ? 'bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.55)] dark:bg-blue-400 dark:shadow-[0_0_14px_rgba(96,165,250,0.7)]' : 'bg-[#060541]/14 dark:bg-muted-foreground/20'}`} />
      </div>

      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={`truncate text-sm ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>{personLabel}</div>
            <div className={`mt-0.5 truncate text-sm ${isUnread ? 'font-semibold text-foreground' : 'text-foreground/90'}`}>{message.subject || '(no subject)'}</div>
            <div className={`mt-1 truncate text-xs ${isUnread ? 'text-foreground/80 dark:text-blue-100/80' : 'text-muted-foreground'}`}>{message.snippet || 'No preview available'}</div>
          </div>
          <div className={`shrink-0 pt-0.5 text-[11px] ${isUnread ? 'text-blue-700 dark:text-blue-300' : 'text-muted-foreground'}`}>{formatDate(message.date)}</div>
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
  message: ImapMessageFull;
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
  const bodyText = formatPlainEmailBody(message.body?.text || message.snippet || '(empty message)', message.subject || '');

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

interface AccountSelectorProps {
  connections: ImapConnection[];
  health: Record<string, ImapConnectionHealth>;
  activeId: string;
  onChange: (id: string) => void;
}

function AccountSelector({ connections, health, activeId, onChange }: AccountSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {connections.map((connection) => {
        const status = health[connection.id]?.status;
        const statusClass = status === 'verified'
          ? 'bg-green-500'
          : status === 'failed'
            ? 'bg-red-500'
            : status === 'checking'
              ? 'bg-yellow-400'
              : 'bg-muted-foreground/40';

        return (
          <button
            key={connection.id}
            onClick={() => onChange(connection.id)}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${connection.id === activeId ? 'border-blue-500/40 bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(59,130,246,0.08))] text-[#060541] shadow-[0_10px_20px_rgba(59,130,246,0.12)] ring-1 ring-blue-500/15 dark:border-blue-500/60 dark:!bg-[linear-gradient(180deg,rgba(37,99,235,0.2),rgba(30,41,59,0.78))] dark:text-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:ring-1 dark:ring-blue-500/20' : 'border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.98))] text-[#060541]/74 shadow-[0_4px_12px_rgba(6,5,65,0.05)] hover:border-[#060541]/22 hover:bg-[#f3f5ff] hover:text-[#060541] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-muted-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))] dark:hover:text-foreground'}`}
          >
            <span className={`h-2 w-2 rounded-full ${statusClass}`} />
            <span className="max-w-[120px] truncate font-medium">{connection.display_name || connection.email_address || 'Account'}</span>
          </button>
        );
      })}
    </div>
  );
}

interface CustomMailClientProps {
  connections: ImapConnection[];
  health: Record<string, ImapConnectionHealth>;
  onOpenSettings: () => void;
  language?: string;
  operatorPreset?: MailComposerPreset | null;
  onOperatorPresetConsumed?: () => void;
}

export function CustomMailClient({ connections, health, onOpenSettings, language = 'en', operatorPreset = null, onOperatorPresetConsumed }: CustomMailClientProps) {
  const [activeConnectionId, setActiveConnectionId] = useState(
    connections.find(c => c.is_primary)?.id || connections[0]?.id || ''
  );
  const imap = useImapMessages(activeConnectionId);

  const [selectedMessage, setSelectedMessage] = useState<ImapMessageFull | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [realFolderName, setRealFolderName] = useState('INBOX');
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string } | undefined>();
  const [composerInitialBody, setComposerInitialBody] = useState('');
  const [activePreset, setActivePreset] = useState<MailComposerPreset | null>(operatorPreset);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [deletingRowUid, setDeletingRowUid] = useState<number | null>(null);

  const activeConn = connections.find(c => c.id === activeConnectionId);
  const activeHealth = activeConnectionId ? health[activeConnectionId] : undefined;
  const connectedLabel = language === 'ar' ? 'متصل فعليًا' : 'Verified';
  const checkingLabel = language === 'ar' ? 'جارٍ التحقق' : 'Checking';
  const failedLabel = language === 'ar' ? 'تحتاج مراجعة' : 'Needs attention';
  const mailboxLabel = language === 'ar' ? 'الصندوق الحالي' : 'Active mailbox';
  const inboxLabel = language === 'ar' ? 'الوارد' : 'Inbox';
  const sentLabel = language === 'ar' ? 'المرسل' : 'Sent';
  const composeLabel = language === 'ar' ? 'إنشاء' : 'Compose';
  const refreshLabel = language === 'ar' ? 'تحديث' : 'Refresh';
  const searchPlaceholder = language === 'ar' ? 'ابحث في المرسل أو الموضوع' : 'Search sender or subject';
  const noSearchResultsLabel = language === 'ar' ? 'لا توجد نتائج مطابقة' : 'No matching results';
  const unreadLabel = language === 'ar' ? 'غير مقروءة' : 'unread';
  const folderLabel = imap.activeFolder === 'SENT' ? sentLabel : inboxLabel;
  const activeEmail = activeConn?.email_address || activeHealth?.proof?.emailAddress || activeConn?.username || '';
  const activeMailboxLogin = imap.mailboxInfo?.login || activeHealth?.proof?.login || activeEmail || null;
  const showMailboxLoginChip = Boolean(activeMailboxLogin && activeMailboxLogin !== activeEmail);
  const activeMailboxFolder = imap.mailboxInfo?.folder && imap.mailboxInfo.folder.toUpperCase() !== imap.activeFolder
    ? `${folderLabel} · ${imap.mailboxInfo.folder}`
    : folderLabel;
  const activeMailboxCount = typeof imap.mailboxInfo?.exists === 'number'
    ? imap.mailboxInfo.exists
    : typeof activeHealth?.proof?.inboxCount === 'number'
      ? activeHealth.proof.inboxCount
      : null;
  const currentFolderRequest = imap.activeFolder === 'SENT' ? 'SENT' : (realFolderName || 'INBOX');
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const hasInboxCache = imap.hasCachedFolder('INBOX');
  const surfaceCardClass = 'space-y-3 rounded-[24px] border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(245,247,255,0.97))] p-3 text-[#060541] shadow-[0_16px_36px_rgba(6,5,65,0.08)] ring-1 ring-[#060541]/5 sm:p-4 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(16,20,29,0.98),rgba(10,12,18,0.96))] dark:text-card-foreground dark:shadow-[0_18px_36px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5';
  const iconShellClass = 'flex h-10 w-10 items-center justify-center rounded-2xl border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]';
  const chipClass = 'rounded-full border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.98))] px-3 py-1 text-[11px] shadow-[0_4px_12px_rgba(6,5,65,0.05)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]';
  const iconButtonClass = 'rounded-xl border border-[#060541]/16 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] p-2.5 text-[#060541] shadow-[0_4px_12px_rgba(6,5,65,0.06)] transition-colors hover:bg-[#f3f5ff] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))] dark:hover:text-accent-foreground';
  const folderButtonBaseClass = 'border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.98))] text-[#060541]/76 shadow-[0_4px_12px_rgba(6,5,65,0.05)] hover:border-[#060541]/24 hover:bg-[#f3f5ff] hover:text-[#060541] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-muted-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))] dark:hover:text-accent-foreground';
  const filteredMessages = useMemo(() => {
    if (!normalizedSearch) return imap.messages;

    return imap.messages.filter((message) => {
      const searchableText = [message.from, message.to, message.subject]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [imap.messages, normalizedSearch]);
  const unreadCount = useMemo(() => {
    if (imap.activeFolder !== 'INBOX') return 0;
    return imap.messages.filter((message) => message.isUnread).length;
  }, [imap.activeFolder, imap.messages]);

  useEffect(() => {
    if (connections.length > 0 && !connections.find(c => c.id === activeConnectionId)) {
      const newId = connections.find(c => c.is_primary)?.id || connections[0]?.id || '';
      setActiveConnectionId(newId);
    }
  }, [activeConnectionId, connections]);

  useEffect(() => {
    if (!activeConnectionId) return;
    const hasInboxCache = imap.hasCachedFolder('INBOX');
    imap.fetchMessages('INBOX', 1, hasInboxCache ? { forceRefresh: true, quiet: true } : undefined)
      .then((result: any) => {
        if (result?.folder) setRealFolderName(result.folder);
      })
      .catch(() => {});
  }, [activeConnectionId, hasInboxCache, imap.fetchMessages]);

  useEffect(() => {
    if (!activeConnectionId) return;
    const intervalId = window.setInterval(() => {
      imap.fetchMessages(imap.activeFolder, 1, { forceRefresh: true, quiet: true })
        .then((result: any) => {
          if (imap.activeFolder === 'SENT' && result?.folder) {
            setRealFolderName(result.folder);
          }
        })
        .catch(() => {});
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [activeConnectionId, imap.activeFolder, imap.fetchMessages]);

  useEffect(() => {
    if (!operatorPreset) return;
    setReplyTo(undefined);
    setComposerInitialBody(operatorPreset.body || '');
    setActivePreset(operatorPreset);
    setShowCompose(true);
    onOperatorPresetConsumed?.();
  }, [onOperatorPresetConsumed, operatorPreset]);

  const handleOpenMessage = async (msg: ImapMessage) => {
    setLoadingMessage(true);
    setSelectedMessage(null);
    const full = await imap.fetchMessage(msg.uid, currentFolderRequest);
    setLoadingMessage(false);
    if (full) {
      if (imap.activeFolder === 'INBOX' && msg.isUnread) {
        imap.markMessageAsRead(msg.uid, 'INBOX');
      }
      setSelectedMessage({
        ...full,
        subject: msg.subject,
        from: msg.from,
        to: msg.to,
        date: msg.date,
        snippet: msg.snippet,
      });
    }
  };

  const handleReply = () => {
    if (!selectedMessage) return;
    setReplyTo({ to: selectedMessage.from, subject: selectedMessage.subject });
    setComposerInitialBody('');
    setShowCompose(true);
  };

  const handleForward = () => {
    if (!selectedMessage) return;
    const originalBody = selectedMessage.body?.text || selectedMessage.snippet || '';
    const fwdSubject = selectedMessage.subject?.startsWith('Fwd:') ? selectedMessage.subject : `Fwd: ${selectedMessage.subject || ''}`;
    setReplyTo({ to: '', subject: fwdSubject });
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
    setReplyTo({ to: selectedMessage.from, subject: selectedMessage.subject });
    setComposerInitialBody(text);
    setShowCompose(true);
  }, [selectedMessage]);

  const handleSend = async (input: MailComposerSubmitInput) => {
    const ok = await imap.sendMessage(input);
    if (!ok) return false;
    const sentResult = await imap.fetchMessages('SENT', 1, {
      forceRefresh: true,
      background: imap.activeFolder !== 'SENT',
      quiet: true,
    });
    if (imap.activeFolder === 'SENT' && sentResult?.folder) {
      setRealFolderName(sentResult.folder);
    }
    return true;
  };

  const handleAccountChange = (id: string) => {
    setSelectedMessage(null);
    setRealFolderName('INBOX');
    setActiveConnectionId(id);
  };

  const handleFolderSwitch = (folder: 'INBOX' | 'SENT') => {
    setSelectedMessage(null);
    imap.fetchMessages(folder, 1).then((result: any) => {
      if (result?.folder) setRealFolderName(result.folder);
    }).catch(() => {});
  };

  const handleRefresh = () => {
    setRefreshing(true);
    imap.fetchMessages(imap.activeFolder, 1, { forceRefresh: true }).then((result: any) => {
      if (result?.folder) setRealFolderName(result.folder);
    }).catch(() => {}).finally(() => {
      setRefreshing(false);
    });
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    setDeletingMessage(true);
    const deleted = await imap.deleteMessage(selectedMessage.uid, currentFolderRequest);
    if (deleted) {
      setSelectedMessage(null);
      const result = await imap.fetchMessages(imap.activeFolder, 1, { forceRefresh: true });
      if (result?.folder) setRealFolderName(result.folder);
    }
    setDeletingMessage(false);
  };

  const handleDeleteFromList = async (message: ImapMessage) => {
    setDeletingRowUid(message.uid);
    await imap.deleteMessage(message.uid, currentFolderRequest);
    setDeletingRowUid(null);
  };

  const handleDownloadAttachment = useCallback(async (attachment: EmailMessageAttachment) => {
    if (!selectedMessage) return;
    setDownloadingAttachmentId(attachment.id);
    try {
      await imap.downloadAttachment(selectedMessage.uid, currentFolderRequest, attachment);
    } finally {
      setDownloadingAttachmentId(null);
    }
  }, [currentFolderRequest, imap, selectedMessage]);

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
    return await imap.getAttachmentContent(selectedMessage.uid, currentFolderRequest, attachment);
  }, [currentFolderRequest, imap, selectedMessage]);

  const resolveRecentMessages = useCallback(async () => {
    const recent = imap.messages.slice(0, 5);
    const resolved = await Promise.all(recent.map(async (message) => {
      try {
        const full = await imap.fetchMessage(message.uid, currentFolderRequest);
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
  }, [currentFolderRequest, imap.fetchMessage, imap.messages]);

  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="rounded-full border border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] p-4 shadow-[0_10px_24px_rgba(6,5,65,0.06)] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
          <Plug className="h-8 w-8 text-[#E9CEB0]" />
        </div>
        <div>
          <div className="font-semibold text-base mb-1">No custom mail accounts</div>
          <div className="text-sm text-muted-foreground">Add a custom IMAP account to read and send emails</div>
        </div>
        <Button onClick={onOpenSettings} variant="outline" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Open Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={surfaceCardClass}>
        {connections.length > 1 ? (
          <AccountSelector
            connections={connections}
            health={health}
            activeId={activeConnectionId}
            onChange={handleAccountChange}
          />
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className={iconShellClass}>
                <Plug className="h-4 w-4 text-[#E9CEB0] shrink-0" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <span className="block max-w-full truncate text-base font-semibold text-foreground">{activeEmail || activeConn?.display_name || 'Custom mail'}</span>
                  {activeHealth?.status === 'verified' ? (
                    <Badge className="bg-green-600 text-white hover:bg-green-600 text-[10px] px-1.5 py-0">{connectedLabel}</Badge>
                  ) : activeHealth?.status === 'checking' ? (
                    <Badge variant="outline" className="border-yellow-400/40 bg-yellow-50 text-yellow-600 text-[10px] px-1.5 py-0 dark:bg-transparent dark:text-yellow-400">{checkingLabel}</Badge>
                  ) : activeHealth?.status === 'failed' ? (
                    <Badge variant="outline" className="border-red-400/40 bg-red-50 text-red-500 text-[10px] px-1.5 py-0 dark:bg-transparent dark:text-red-400">{failedLabel}</Badge>
                  ) : null}
                </div>
                {connections.length === 1 && activeConn?.display_name && activeConn.display_name !== activeEmail ? (
                  <div className="mt-1 truncate text-xs text-muted-foreground">{activeConn.display_name}</div>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {showMailboxLoginChip ? (
                <div className={`${chipClass} max-w-full text-muted-foreground`}>
                  <span className="block max-w-[220px] truncate sm:max-w-[280px]">{activeMailboxLogin}</span>
                </div>
              ) : null}
              <div className={`${chipClass} text-foreground/80`}>
                {activeMailboxFolder}
              </div>
              {activeMailboxCount !== null ? (
                <div className={`${chipClass} text-muted-foreground`}>
                  {activeMailboxCount} emails
                </div>
              ) : null}
              {unreadCount > 0 ? (
                <div className={`${chipClass} text-blue-600 dark:text-blue-300`}>
                  {unreadCount} {unreadLabel}
                </div>
              ) : null}
              <div className={`${chipClass} text-muted-foreground`}>
                {filteredMessages.length} shown
              </div>
            </div>
            {activeHealth?.status === 'failed' && activeHealth.error ? (
              <div className="mt-2 text-xs text-red-400">{activeHealth.error}</div>
            ) : null}
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            <button
              title={refreshLabel}
              onClick={handleRefresh}
              className={iconButtonClass}
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

      <div className="flex items-center gap-1.5">
        {(['INBOX', 'SENT'] as const).map(f => (
          <button
            key={f}
            onClick={() => handleFolderSwitch(f)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
              imap.activeFolder === f
                ? 'bg-blue-600 text-white shadow-sm'
                : folderButtonBaseClass
            }`}
          >
            {f === 'INBOX' ? <Inbox className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            {f === 'INBOX' ? inboxLabel : sentLabel}
          </button>
        ))}
      </div>

      <div className="min-h-[360px] overflow-hidden rounded-[24px] border border-[#060541]/15 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(246,248,255,0.98))] text-[#060541] shadow-[0_16px_36px_rgba(6,5,65,0.08)] ring-1 ring-[#060541]/5 dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(16,20,29,0.98),rgba(10,12,18,0.96))] dark:text-card-foreground dark:shadow-[0_18px_36px_rgba(0,0,0,0.4)] dark:ring-1 dark:ring-white/5">
        {selectedMessage ? (
          <div className="p-4 h-full sm:p-5">
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
              canReply={imap.activeFolder !== 'SENT'}
              aiPanel={selectedMessageAiSource ? (
                <EmailAiAssistant
                  mode="message"
                  language={language}
                  contextKey={`${activeConnectionId}:${selectedMessage.uid}`}
                  message={selectedMessageAiSource}
                  attachments={selectedMessage.attachments}
                  resolveAttachmentContent={resolveSelectedAttachmentContent}
                  canReply={imap.activeFolder !== 'SENT'}
                  onUseAsReply={handleUseAiReply}
                  variant="floating"
                />
              ) : null}
            />
          </div>
        ) : loadingMessage ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading message...</span>
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
            {imap.loading && imap.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Connecting to mail server...</span>
              </div>
            ) : imap.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <Inbox className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">
                  No messages in {imap.activeFolder === 'INBOX' ? 'Inbox' : 'Sent'}
                </span>
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
                    key={msg.uid}
                    message={msg}
                    activeFolder={imap.activeFolder}
                    deleting={deletingRowUid === msg.uid}
                    onOpen={() => handleOpenMessage(msg)}
                    onDelete={() => handleDeleteFromList(msg)}
                  />
                ))}
                {imap.hasMore && (
                  <div className="px-4 py-3 flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={imap.loadMore}
                      disabled={imap.loading}
                      className="border-[#060541]/14 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(247,248,255,0.96))] text-xs text-[#060541] shadow-[0_4px_12px_rgba(6,5,65,0.05)] hover:bg-[#f3f5ff] dark:border-white/10 dark:!bg-[linear-gradient(180deg,rgba(20,24,34,0.92),rgba(12,15,20,0.9))] dark:text-foreground dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)] dark:hover:!bg-[linear-gradient(180deg,rgba(26,31,43,0.96),rgba(14,17,24,0.94))]"
                    >
                      {imap.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
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
          fromLabel={activeEmail || activeConn?.display_name || 'Custom mail'}
          initialBody={composerInitialBody}
          preset={activePreset}
        />
      )}
    </div>
  );
}
