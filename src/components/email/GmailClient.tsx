import React, { useEffect, useState } from 'react';
import { useGmailMessages, GmailMessage, GmailMessageFull, GmailLabel } from '@/hooks/useGmailMessages';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Inbox, Send, Pencil, ChevronLeft, RefreshCw, Loader2,
  ChevronDown, X, Reply, Trash2, MailOpen,
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

interface ComposeProps {
  onClose: () => void;
  onSend: (to: string, subject: string, body: string, threadId?: string) => Promise<boolean>;
  replyTo?: { to: string; subject: string; threadId: string };
}

function ComposeModal({ onClose, onSend, replyTo }: ComposeProps) {
  const [to, setTo] = useState(replyTo?.to || '');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject.replace(/^Re:\s*/i, '')}` : '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) return;
    setSending(true);
    const ok = await onSend(to, subject, body, replyTo?.threadId);
    setSending(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2">
      <div className="w-full max-w-lg bg-[#0c0f14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="font-semibold text-sm">{replyTo ? 'Reply' : 'New Message'}</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
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
  message: GmailMessageFull;
  onBack: () => void;
  onReply: () => void;
}

function MessageView({ message, onBack, onReply }: MessageViewProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-1 pb-3 border-b border-border/40">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium truncate flex-1">{message.subject}</span>
        <button onClick={onReply} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-blue-400">
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

  useEffect(() => {
    if (connected) {
      gmail.fetchMessages('INBOX');
      gmail.fetchLabels().then(() => {});
    }
  }, [connected]);

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

  const handleSend = async (to: string, subject: string, body: string, threadId?: string) => {
    const ok = await gmail.sendMessage(to, subject, body, threadId);
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
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <GmailIcon size={16} />
          <span className="text-sm font-medium text-muted-foreground truncate max-w-[160px]">
            {emailAddress || 'Gmail'}
          </span>
          <Badge className="bg-green-600 text-white hover:bg-green-600 text-[10px] px-1.5 py-0">Connected</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => gmail.fetchMessages(gmail.activeFolder)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            {gmail.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
      <div className="flex items-center gap-1 flex-wrap">
        {SYSTEM_FOLDERS.map(f => (
          <button
            key={f.id}
            onClick={() => handleFolderSwitch(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              gmail.activeFolder === f.id
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground'
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
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all"
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
              <div className="divide-y divide-border/40">
                {gmail.messages.map(msg => (
                  <button
                    key={msg.id}
                    onClick={() => handleOpenMessage(msg)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-start gap-3"
                  >
                    <div className="mt-0.5 shrink-0">
                      {msg.isUnread ? (
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-transparent mt-1" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${msg.isUnread ? 'font-semibold' : 'font-normal text-muted-foreground'}`}>
                          {gmail.activeFolder === 'SENT' ? extractName(msg.to) : extractName(msg.from)}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(msg.date)}</span>
                      </div>
                      <div className={`text-sm truncate ${msg.isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {msg.subject}
                      </div>
                      <div className="text-xs text-muted-foreground/70 truncate mt-0.5">{msg.snippet}</div>
                    </div>
                  </button>
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

      {/* Compose modal */}
      {showCompose && (
        <ComposeModal
          onClose={handleCloseCompose}
          onSend={handleSend}
          replyTo={replyTo}
        />
      )}
    </div>
  );
}
