import React, { useEffect, useState } from 'react';
import { useImapMessages, ImapMessage, ImapMessageFull } from '@/hooks/useImapMessages';
import { ImapConnection, ImapConnectionHealth } from '@/hooks/useEmailConnections';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MailComposer, MailComposerSubmitInput } from '@/components/email/MailComposer';
import {
  Inbox, Send, Pencil, ChevronLeft, RefreshCw, Loader2,
  Reply, Plug, Settings2, Trash2,
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

  return (
    <div className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04] sm:px-5 sm:py-3.5">
      <div className="pt-1.5">
        <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
      </div>

      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white/88">{personLabel}</div>
            <div className="mt-0.5 truncate text-sm text-white/92">{message.subject || '(no subject)'}</div>
            <div className="mt-1 truncate text-xs text-white/45">{message.snippet || 'No preview available'}</div>
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
  message: ImapMessageFull;
  onBack: () => void;
  onReply: () => void;
  onDelete: () => void;
  deleting: boolean;
}

function MessageView({ message, onBack, onReply, onDelete, deleting }: MessageViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 pb-3 border-b border-border/40">
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
            {message.body.text || message.snippet || '(empty message)'}
          </pre>
        )}
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
            className={`flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${connection.id === activeId ? 'border-blue-500/60 bg-blue-500/10 text-foreground shadow-sm' : 'border-border/60 bg-background/40 text-muted-foreground hover:bg-white/5 hover:text-foreground'}`}
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
}

export function CustomMailClient({ connections, health, onOpenSettings, language = 'en' }: CustomMailClientProps) {
  const [activeConnectionId, setActiveConnectionId] = useState(
    connections.find(c => c.is_primary)?.id || connections[0]?.id || ''
  );
  const imap = useImapMessages(activeConnectionId);

  const [selectedMessage, setSelectedMessage] = useState<ImapMessageFull | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [realFolderName, setRealFolderName] = useState('INBOX');
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string } | undefined>();
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

  useEffect(() => {
    if (connections.length > 0 && !connections.find(c => c.id === activeConnectionId)) {
      const newId = connections.find(c => c.is_primary)?.id || connections[0]?.id || '';
      setActiveConnectionId(newId);
    }
  }, [activeConnectionId, connections]);

  const handleOpenMessage = async (msg: ImapMessage) => {
    setLoadingMessage(true);
    setSelectedMessage(null);
    const full = await imap.fetchMessage(msg.uid, realFolderName);
    setLoadingMessage(false);
    if (full) {
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
    setShowCompose(true);
  };

  const handleCloseCompose = () => {
    setShowCompose(false);
    setReplyTo(undefined);
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
    imap.fetchMessages(imap.activeFolder, 1, { forceRefresh: true }).then((result: any) => {
      if (result?.folder) setRealFolderName(result.folder);
    }).catch(() => {});
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;
    setDeletingMessage(true);
    const deleted = await imap.deleteMessage(selectedMessage.uid, realFolderName);
    if (deleted) {
      setSelectedMessage(null);
      const result = await imap.fetchMessages(imap.activeFolder, 1, { forceRefresh: true });
      if (result?.folder) setRealFolderName(result.folder);
    }
    setDeletingMessage(false);
  };

  const handleDeleteFromList = async (message: ImapMessage) => {
    setDeletingRowUid(message.uid);
    await imap.deleteMessage(message.uid, realFolderName);
    setDeletingRowUid(null);
  };

  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="rounded-full bg-white/5 p-4">
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
      <div className="rounded-[22px] border border-white/10 bg-[#0c0f14] p-3 sm:p-4 space-y-3">
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
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Plug className="h-4 w-4 text-[#E9CEB0] shrink-0" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <span className="block max-w-full truncate text-base font-semibold text-white">{activeEmail || activeConn?.display_name || 'Custom mail'}</span>
                  {activeHealth?.status === 'verified' ? (
                    <Badge className="bg-green-600 text-white hover:bg-green-600 text-[10px] px-1.5 py-0">{connectedLabel}</Badge>
                  ) : activeHealth?.status === 'checking' ? (
                    <Badge variant="outline" className="border-yellow-400/40 text-yellow-400 text-[10px] px-1.5 py-0">{checkingLabel}</Badge>
                  ) : activeHealth?.status === 'failed' ? (
                    <Badge variant="outline" className="border-red-400/40 text-red-400 text-[10px] px-1.5 py-0">{failedLabel}</Badge>
                  ) : null}
                </div>
                {connections.length === 1 && activeConn?.display_name && activeConn.display_name !== activeEmail ? (
                  <div className="mt-1 truncate text-xs text-white/55">{activeConn.display_name}</div>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {showMailboxLoginChip ? (
                <div className="max-w-full rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/70">
                  <span className="block max-w-[220px] truncate sm:max-w-[280px]">{activeMailboxLogin}</span>
                </div>
              ) : null}
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/75">
                {activeMailboxFolder}
              </div>
              {activeMailboxCount !== null ? (
                <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
                  {activeMailboxCount} emails
                </div>
              ) : null}
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
                {imap.messages.length} shown
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
              className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 transition-colors hover:bg-white/10"
            >
              {imap.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
                : 'border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            {f === 'INBOX' ? <Inbox className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            {f === 'INBOX' ? inboxLabel : sentLabel}
          </button>
        ))}
      </div>

      <div className="min-h-[360px] overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0f14]">
        {selectedMessage ? (
          <div className="p-4 h-full sm:p-5">
            <MessageView
              message={selectedMessage}
              onBack={() => setSelectedMessage(null)}
              onReply={handleReply}
              onDelete={handleDeleteMessage}
              deleting={deletingMessage}
            />
          </div>
        ) : loadingMessage ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading message...</span>
          </div>
        ) : (
          <>
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
            ) : (
              <div className="divide-y divide-white/10">
                {imap.messages.map(msg => (
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
                      className="text-xs"
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
          onSend={async (input: MailComposerSubmitInput) => imap.sendMessage(input)}
          replyTo={replyTo}
          fromLabel={activeEmail || activeConn?.display_name || 'Custom mail'}
        />
      )}
    </div>
  );
}
