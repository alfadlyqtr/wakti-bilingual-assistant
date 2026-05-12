import React, { useEffect, useState } from 'react';
import { useGmailMessages, GmailMessage, GmailMessageFull, GmailLabel } from '@/hooks/useGmailMessages';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MailComposer, MailComposerSubmitInput } from '@/components/email/MailComposer';
import {
  Inbox, Send, Pencil, ChevronLeft, RefreshCw, Loader2,
  ChevronDown, Reply, Trash2, MailOpen,
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
    <div className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04] sm:px-5 sm:py-3.5">
      <div className="pt-1.5">
        <div className={`h-2.5 w-2.5 rounded-full ${message.isUnread ? 'bg-blue-500' : 'bg-white/10'}`} />
      </div>

      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={`truncate text-sm ${message.isUnread ? 'font-semibold text-white' : 'font-medium text-white/88'}`}>
              {personLabel}
            </div>
            <div className={`mt-0.5 truncate text-sm ${message.isUnread ? 'text-white/92' : 'text-white/72'}`}>
              {message.subject || '(no subject)'}
            </div>
            <div className="mt-1 truncate text-xs text-white/45">
              {message.snippet || 'No preview available'}
            </div>
          </div>
          <div className="shrink-0 pt-0.5 text-[11px] text-white/45">{formatDate(message.date)}</div>
        </div>
      </button>

      <button
        title="Delete"
        onClick={onDelete}
        disabled={deleting}
        className="mt-0.5 shrink-0 rounded-xl p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-red-400 disabled:opacity-60"
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
  onDelete: () => void;
  deleting: boolean;
}

function MessageView({ message, onBack, onReply, onDelete, deleting }: MessageViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-1 pb-3 border-b border-border/40">
        <button title="Back" onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium truncate flex-1">{message.subject}</span>
        <button title="Reply" onClick={onReply} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-blue-400">
          <Reply className="h-4 w-4" />
        </button>
        <button title="Delete" onClick={onDelete} disabled={deleting} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-red-400 disabled:opacity-60">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
      <div className="py-3 border-b border-border/40 space-y-1">
        <div className="text-sm font-semibold">{extractName(message.from)}</div>
        <div className="text-xs text-muted-foreground">{message.from}</div>
        <div className="text-xs text-muted-foreground">To: {message.to}</div>
        <div className="text-xs text-muted-foreground">{formatDate(message.date)}</div>
      </div>
      <div className="flex-1 overflow-y-auto pt-3">
        {message.body.html ? (
          <div
            className="text-sm prose prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: message.body.html }}
          />
        ) : (
          <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
            {message.body.text || message.snippet}
          </pre>
        )}
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
}

export function GmailClient({ connected, emailAddress, onConnect, onDisconnect, language = 'en' }: GmailClientProps) {
  const gmail = useGmailMessages();
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageFull | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string; threadId: string } | undefined>();
  const [customFolders, setCustomFolders] = useState<GmailLabel[]>([]);
  const [showFolders, setShowFolders] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [deletingRowId, setDeletingRowId] = useState<string | null>(null);
  const connectedLabel = language === 'ar' ? 'متصل' : 'Connected';
  const composeLabel = language === 'ar' ? 'إنشاء' : 'Compose';
  const refreshLabel = language === 'ar' ? 'تحديث' : 'Refresh';
  const activeFolderLabel = gmail.activeFolder === 'INBOX'
    ? 'Inbox'
    : gmail.activeFolder === 'SENT'
      ? 'Sent'
      : gmail.activeFolder;
  const mailboxLine = emailAddress ? `${language === 'ar' ? 'الحساب' : 'Account'}: ${emailAddress}` : 'Gmail account';

  useEffect(() => {
    if (connected) {
      gmail.fetchMessages('INBOX');
      gmail.fetchLabels().then(() => {});
    }
  }, [connected, gmail.fetchLabels, gmail.fetchMessages]);

  useEffect(() => {
    if (gmail.labels.length > 0) {
      const userLabels = gmail.labels.filter(
        l => l.type === 'user' && !['CHAT', 'SPAM', 'TRASH'].includes(l.id)
      );
      setCustomFolders(userLabels);
    }
  }, [gmail.labels]);

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
    setShowCompose(true);
  };

  const handleCloseCompose = () => {
    setShowCompose(false);
    setReplyTo(undefined);
  };

  const handleSend = async (input: MailComposerSubmitInput) => {
    const ok = await gmail.sendMessage(input);
    if (ok && gmail.activeFolder === 'SENT') {
      gmail.fetchMessages('SENT');
    }
    return ok;
  };

  const handleFolderSwitch = (folderId: string) => {
    setSelectedMessage(null);
    setShowFolders(false);
    gmail.fetchMessages(folderId);
  };

  const handleRefresh = async () => {
    await gmail.fetchMessages(gmail.activeFolder, undefined, { forceRefresh: true });
    await gmail.fetchLabels({ forceRefresh: true });
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

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="rounded-full bg-white/5 p-4">
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
      <div className="rounded-[22px] border border-white/10 bg-[#0c0f14] p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/10">
                <GmailIcon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <span className="block max-w-full truncate text-base font-semibold text-white">{emailAddress || 'Gmail'}</span>
                  <Badge className="bg-green-600 text-white hover:bg-green-600 text-[10px] px-1.5 py-0">{connectedLabel}</Badge>
                </div>
                <div className="mt-1 max-w-full truncate text-xs text-white/55">{mailboxLine}</div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {emailAddress ? (
                <div className="max-w-full rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/70">
                  <span className="block max-w-[220px] truncate sm:max-w-[280px]">{emailAddress}</span>
                </div>
              ) : null}
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/75">
                {activeFolderLabel}
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
                {gmail.messages.length} shown
              </div>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:justify-end">
            <button
              onClick={handleRefresh}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition-colors hover:bg-white/10"
              title={refreshLabel}
            >
              {gmail.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                : 'border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10 hover:text-white'
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
              className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
            >
              More
              <ChevronDown className="h-3 w-3" />
            </button>
            {showFolders && (
              <div className="absolute top-full mt-1 left-0 z-20 bg-[#0c0f14] border border-white/10 rounded-xl shadow-xl min-w-[140px] overflow-hidden">
                {customFolders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleFolderSwitch(f.id)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors flex items-center gap-2"
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

      <div className="min-h-[360px] overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0f14]">
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
                onDelete={handleDeleteMessage}
                deleting={deletingMessage}
              />
            )}
          </div>
        ) : (
          <>
            {gmail.loading && gmail.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : gmail.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <Inbox className="h-8 w-8 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">No messages in {gmail.activeFolder === 'INBOX' ? 'Inbox' : gmail.activeFolder === 'SENT' ? 'Sent' : gmail.activeFolder}</span>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {gmail.messages.map(msg => (
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
                      className="text-xs"
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
        />
      )}
    </div>
  );
}
