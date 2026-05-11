import React, { useEffect, useState } from 'react';
import { useImapMessages, ImapMessage, ImapMessageFull } from '@/hooks/useImapMessages';
import { ImapConnection } from '@/hooks/useEmailConnections';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Inbox, Send, Pencil, ChevronLeft, RefreshCw, Loader2,
  X, Reply, Plug, Settings2, ChevronDown,
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

interface ComposeProps {
  onClose: () => void;
  onSend: (to: string, subject: string, body: string) => Promise<boolean>;
  replyTo?: { to: string; subject: string };
}

function ComposeModal({ onClose, onSend, replyTo }: ComposeProps) {
  const [to, setTo] = useState(replyTo?.to || '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    const ok = await onSend(to, subject, body);
    setSending(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2">
      <div className="w-full max-w-lg bg-[#0c0f14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">{replyTo ? 'Reply' : 'New Message'}</span>
          <button title="Close" onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">To</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="recipient@email.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/60 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Message</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={8}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500/60 transition-colors resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 pb-4">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Discard
          </button>
          <Button
            onClick={handleSend}
            disabled={sending || !to || !subject || !body}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface MessageViewProps {
  message: ImapMessageFull;
  onBack: () => void;
  onReply: () => void;
}

function MessageView({ message, onBack, onReply }: MessageViewProps) {
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
  activeId: string;
  onChange: (id: string) => void;
}

function AccountSelector({ connections, activeId, onChange }: AccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const active = connections.find(c => c.id === activeId);

  if (connections.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 transition-all max-w-[160px]"
      >
        <Plug className="h-3 w-3 text-[#E9CEB0] shrink-0" />
        <span className="truncate">{active?.display_name || active?.email_address || 'Account'}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 bg-[#0c0f14] border border-white/10 rounded-xl shadow-xl min-w-[180px] overflow-hidden">
          {connections.map(c => (
            <button
              key={c.id}
              onClick={() => { onChange(c.id); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors flex items-center gap-2 ${c.id === activeId ? 'text-blue-400' : ''}`}
            >
              <Plug className="h-3 w-3 text-[#E9CEB0] shrink-0" />
              <div className="min-w-0">
                <div className="truncate font-medium">{c.display_name || c.email_address}</div>
                <div className="truncate text-muted-foreground">{c.email_address}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface CustomMailClientProps {
  connections: ImapConnection[];
  onOpenSettings: () => void;
  language?: string;
}

export function CustomMailClient({ connections, onOpenSettings, language = 'en' }: CustomMailClientProps) {
  const [activeConnectionId, setActiveConnectionId] = useState(
    connections.find(c => c.is_primary)?.id || connections[0]?.id || ''
  );
  const imap = useImapMessages(activeConnectionId);

  const [selectedMessage, setSelectedMessage] = useState<ImapMessageFull | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string } | undefined>();

  const activeConn = connections.find(c => c.id === activeConnectionId);

  useEffect(() => {
    if (activeConnectionId) {
      setSelectedMessage(null);
      imap.fetchMessages('INBOX', 1);
    }
  }, [activeConnectionId]);

  // When connections list changes, keep active id valid
  useEffect(() => {
    if (connections.length > 0 && !connections.find(c => c.id === activeConnectionId)) {
      const newId = connections.find(c => c.is_primary)?.id || connections[0]?.id || '';
      setActiveConnectionId(newId);
    }
  }, [connections]);

  const handleOpenMessage = async (msg: ImapMessage) => {
    setLoadingMessage(true);
    const full = await imap.fetchMessage(msg.uid, imap.activeFolder);
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
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <AccountSelector
            connections={connections}
            activeId={activeConnectionId}
            onChange={id => setActiveConnectionId(id)}
          />
          {connections.length === 1 && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Plug className="h-3.5 w-3.5 text-[#E9CEB0] shrink-0" />
              <span className="text-sm font-medium text-muted-foreground truncate max-w-[160px]">
                {activeConn?.display_name || activeConn?.email_address}
              </span>
              <Badge className="bg-green-600 text-white hover:bg-green-600 text-[10px] px-1.5 py-0">Connected</Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            title="Refresh"
            onClick={() => imap.fetchMessages(imap.activeFolder, 1)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            {imap.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <Button
            size="sm"
            onClick={() => { setReplyTo(undefined); setShowCompose(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 h-7 text-xs px-3"
          >
            <Pencil className="h-3 w-3" />
            Compose
          </Button>
        </div>
      </div>

      {/* Folder tabs */}
      <div className="flex items-center gap-1">
        {(['INBOX', 'SENT'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setSelectedMessage(null); imap.fetchMessages(f, 1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              imap.activeFolder === f
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
            }`}
          >
            {f === 'INBOX' ? <Inbox className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
            {f === 'INBOX' ? 'Inbox' : 'Sent'}
          </button>
        ))}
      </div>

      {/* Message view or list */}
      <div className="rounded-xl border border-border/50 bg-background/30 overflow-hidden min-h-[300px]">
        {selectedMessage ? (
          <div className="p-4 h-full">
            {loadingMessage ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MessageView
                message={selectedMessage}
                onBack={() => setSelectedMessage(null)}
                onReply={handleReply}
              />
            )}
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
              <div className="divide-y divide-border/40">
                {imap.messages.map(msg => (
                  <button
                    key={msg.uid}
                    onClick={() => handleOpenMessage(msg)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-start gap-3"
                  >
                    <div className="mt-1.5 shrink-0 h-2 w-2 rounded-full bg-transparent" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate font-normal text-muted-foreground">
                          {imap.activeFolder === 'SENT' ? extractName(msg.to) : extractName(msg.from)}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(msg.date)}</span>
                      </div>
                      <div className="text-sm truncate text-foreground">{msg.subject}</div>
                      {msg.snippet && (
                        <div className="text-xs text-muted-foreground/70 truncate mt-0.5">{msg.snippet}</div>
                      )}
                    </div>
                  </button>
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
        <ComposeModal
          onClose={handleCloseCompose}
          onSend={imap.sendMessage}
          replyTo={replyTo}
        />
      )}
    </div>
  );
}
