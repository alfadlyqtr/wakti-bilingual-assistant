import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useImapMessages, ImapMessage, ImapMessageFull } from '@/hooks/useImapMessages';
import { ImapConnection, ImapConnectionHealth } from '@/hooks/useEmailConnections';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MailComposer, MailComposerSubmitInput } from '@/components/email/MailComposer';
import { EmailAiAssistant } from '@/components/email/EmailAiAssistant';
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
  const isUnread = activeFolder === 'INBOX' && message.isUnread;

  return (
    <div className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[#f7f8ff] sm:px-5 sm:py-3.5 dark:hover:bg-accent/50">
      <div className="pt-1.5">
        <div className={`h-2.5 w-2.5 rounded-full ${isUnread ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.55)]' : 'bg-[#060541]/12 dark:bg-muted-foreground/20'}`} />
      </div>

      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={`truncate text-sm ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>{personLabel}</div>
            <div className={`mt-0.5 truncate text-sm ${isUnread ? 'font-semibold text-foreground' : 'text-foreground/90'}`}>{message.subject || '(no subject)'}</div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{message.snippet || 'No preview available'}</div>
          </div>
          <div className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">{formatDate(message.date)}</div>
        </div>
      </button>

      <button
        title="Delete"
        onClick={onDelete}
        disabled={deleting}
        className="mt-0.5 shrink-0 rounded-xl p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-red-500 disabled:opacity-60"
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
  aiPanel?: React.ReactNode;
}

function MessageView({ message, onBack, onReply, onDelete, deleting, aiPanel }: MessageViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 pb-3 border-b border-border/40">
        <button title="Back" onClick={onBack} className="p-1.5 rounded-lg transition-colors hover:bg-accent/70">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium truncate flex-1">{message.subject}</span>
        <button title="Reply" onClick={onReply} className="p-1.5 rounded-lg transition-colors hover:bg-accent/70 text-blue-500">
          <Reply className="h-4 w-4" />
        </button>
        <button title="Delete" onClick={onDelete} disabled={deleting} className="p-1.5 rounded-lg transition-colors hover:bg-accent/70 text-red-500 disabled:opacity-60">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </button>
      </div>
      <div className="py-3 border-b border-border/40 space-y-1">
        <div className="text-sm font-semibold">{extractName(message.from)}</div>
        <div className="text-xs text-muted-foreground">{message.from}</div>
        <div className="text-xs text-muted-foreground">To: {message.to}</div>
        <div className="text-xs text-muted-foreground">{formatDate(message.date)}</div>
      </div>
      {aiPanel ? (
        <div className="pointer-events-none sticky top-0 z-10 flex justify-end px-1 py-3">
          <div className="pointer-events-auto">{aiPanel}</div>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto pt-3">
        {message.body.html ? (
          <div
            className="prose prose-sm max-w-none break-words dark:prose-invert"
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
            className={`flex h-9 shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-all ${connection.id === activeId ? 'border-blue-500/40 bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(59,130,246,0.08))] text-[#060541] shadow-[0_6px_16px_rgba(59,130,246,0.12)] dark:border-blue-500/60 dark:bg-blue-500/10 dark:text-foreground dark:shadow-sm' : 'border-[#060541]/10 bg-white text-[#060541]/70 shadow-[0_1px_2px_rgba(6,5,65,0.05)] hover:bg-[#f7f8ff] hover:text-[#060541] dark:border-border/60 dark:bg-background/70 dark:text-muted-foreground dark:shadow-none dark:hover:bg-accent dark:hover:text-foreground'}`}
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
  const [refreshing, setRefreshing] = useState(false);
  const [realFolderName, setRealFolderName] = useState('INBOX');
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string } | undefined>();
  const [composerInitialBody, setComposerInitialBody] = useState('');
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
  const hasInboxCache = imap.hasCachedFolder('INBOX');
  const surfaceCardClass = 'space-y-3 rounded-[22px] border border-[#060541]/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,248,255,0.94))] p-3 text-[#060541] shadow-[0_10px_24px_rgba(6,5,65,0.05)] sm:p-4 dark:border-border dark:bg-card/95 dark:text-card-foreground dark:shadow-sm';
  const iconShellClass = 'flex h-10 w-10 items-center justify-center rounded-2xl border border-[#060541]/10 bg-white shadow-[0_1px_2px_rgba(6,5,65,0.04)] dark:border-border/70 dark:bg-background/70 dark:shadow-none';
  const chipClass = 'rounded-full border border-[#060541]/10 bg-white px-3 py-1 text-[11px] shadow-[0_1px_2px_rgba(6,5,65,0.04)] dark:border-border/70 dark:bg-background/70 dark:shadow-none';
  const iconButtonClass = 'rounded-xl border border-[#060541]/12 bg-white p-2.5 text-[#060541] shadow-[0_1px_2px_rgba(6,5,65,0.05)] transition-colors hover:bg-[#f7f8ff] dark:border-border/70 dark:bg-background/70 dark:text-foreground dark:shadow-none dark:hover:bg-accent dark:hover:text-accent-foreground';
  const folderButtonBaseClass = 'border border-[#060541]/10 bg-white text-[#060541]/72 shadow-[0_1px_2px_rgba(6,5,65,0.04)] hover:bg-[#f7f8ff] hover:text-[#060541] dark:border-border/70 dark:bg-background/70 dark:text-muted-foreground dark:shadow-none dark:hover:bg-accent dark:hover:text-accent-foreground';

  useEffect(() => {
    if (connections.length > 0 && !connections.find(c => c.id === activeConnectionId)) {
      const newId = connections.find(c => c.is_primary)?.id || connections[0]?.id || '';
      setActiveConnectionId(newId);
    }
  }, [activeConnectionId, connections]);

  useEffect(() => {
    if (!activeConnectionId) return;
    const hasInboxCache = imap.hasCachedFolder('INBOX');
    imap.fetchMessages('INBOX', 1, hasInboxCache ? { forceRefresh: true, background: true, quiet: true } : undefined)
      .then((result: any) => {
        if (result?.folder) setRealFolderName(result.folder);
      })
      .catch(() => {});
  }, [activeConnectionId, hasInboxCache, imap.fetchMessages]);

  const handleOpenMessage = async (msg: ImapMessage) => {
    setLoadingMessage(true);
    setSelectedMessage(null);
    const full = await imap.fetchMessage(msg.uid, realFolderName);
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

  const handleCloseCompose = () => {
    setShowCompose(false);
    setReplyTo(undefined);
    setComposerInitialBody('');
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
    imap.fetchMessages(imap.activeFolder, 1, { forceRefresh: true, background: imap.messages.length > 0, quiet: imap.messages.length > 0 }).then((result: any) => {
      if (result?.folder) setRealFolderName(result.folder);
    }).catch(() => {}).finally(() => {
      setRefreshing(false);
    });
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

  const selectedMessageAiSource = useMemo(() => {
    if (!selectedMessage) return null;
    return {
      subject: selectedMessage.subject,
      from: selectedMessage.from,
      to: selectedMessage.to,
      date: selectedMessage.date,
      snippet: selectedMessage.snippet,
      bodyText: selectedMessage.body.text || selectedMessage.snippet || '',
    };
  }, [selectedMessage]);

  const resolveRecentMessages = useCallback(async () => {
    const recent = imap.messages.slice(0, 5);
    const resolved = await Promise.all(recent.map(async (message) => {
      try {
        const full = await imap.fetchMessage(message.uid, realFolderName);
        return {
          subject: message.subject,
          from: message.from,
          to: message.to,
          date: message.date,
          snippet: message.snippet,
          bodyText: full?.body.text || message.snippet || '',
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
  }, [imap.fetchMessage, imap.messages, realFolderName]);

  if (connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <div className="rounded-full border border-border/60 bg-muted/40 p-4">
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
              <div className={`${chipClass} text-muted-foreground`}>
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

      <div className="min-h-[360px] overflow-hidden rounded-[22px] border border-[#060541]/10 bg-white text-[#060541] shadow-[0_10px_24px_rgba(6,5,65,0.05)] dark:border-border dark:bg-card/95 dark:text-card-foreground dark:shadow-sm">
        {selectedMessage ? (
          <div className="p-4 h-full sm:p-5">
            <MessageView
              message={selectedMessage}
              onBack={() => setSelectedMessage(null)}
              onReply={handleReply}
              onDelete={handleDeleteMessage}
              deleting={deletingMessage}
              aiPanel={selectedMessageAiSource ? (
                <EmailAiAssistant
                  mode="message"
                  language={language}
                  contextKey={`${activeConnectionId}:${selectedMessage.uid}`}
                  message={selectedMessageAiSource}
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
              <div className="divide-y divide-[#060541]/8 dark:divide-border">
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
          onSend={handleSend}
          replyTo={replyTo}
          fromLabel={activeEmail || activeConn?.display_name || 'Custom mail'}
          initialBody={composerInitialBody}
        />
      )}
    </div>
  );
}
