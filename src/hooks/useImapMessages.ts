import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadEmailAttachment, EmailMessageAttachment, EmailMessageAttachmentContent } from '@/utils/emailAttachmentDownload';

export interface ImapMessage {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  isUnread: boolean;
}

export interface ImapMessageFull {
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: { text: string; html: string };
  attachments: EmailMessageAttachment[];
}

export interface ImapMailboxInfo {
  login: string;
  exists: number;
  folder: string;
}

export interface ImapDraftAttachment {
  name: string;
  contentType?: string;
  content: string;
}

export interface ImapDraftInput {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: ImapDraftAttachment[];
}

type ImapFolderName = 'INBOX' | 'SENT';

type ImapFolderCache = {
  messages: ImapMessage[];
  hasMore: boolean;
  page: number;
  mailboxInfo: ImapMailboxInfo | null;
};

const IMAP_FOLDER_CACHE_STORAGE_KEY = 'wakti-imap-folder-cache-v1';

function normalizeImapBody(body: unknown): { text: string; html: string } {
  const safeBody = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    text: typeof safeBody.text === 'string' ? safeBody.text : '',
    html: typeof safeBody.html === 'string' ? safeBody.html : '',
  };
}

function normalizeImapAttachments(value: unknown): EmailMessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const safeItem = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const id = typeof safeItem.id === 'string' ? safeItem.id : '';
      const name = typeof safeItem.name === 'string' ? safeItem.name : '';
      if (!id || !name) return null;
      return {
        id,
        name,
        contentType: typeof safeItem.contentType === 'string' ? safeItem.contentType : null,
        size: typeof safeItem.size === 'number' ? safeItem.size : null,
        inline: safeItem.inline === true,
      } satisfies EmailMessageAttachment;
    })
    .filter(Boolean) as EmailMessageAttachment[];
}

function readStoredFolderCache(): Record<string, ImapFolderCache> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(IMAP_FOLDER_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredFolderCache(value: Record<string, ImapFolderCache>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(IMAP_FOLDER_CACHE_STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

const globalFolderCache: Record<string, ImapFolderCache> = readStoredFolderCache();
const globalMessageCache: Record<string, ImapMessageFull> = {};

async function callImapApi(action: string, params: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not logged in');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/imap-api`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...params }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export function useImapMessages(connectionId: string) {
  const [messages, setMessages] = useState<ImapMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [activeFolder, setActiveFolder] = useState<ImapFolderName>('INBOX');
  const [mailboxInfo, setMailboxInfo] = useState<ImapMailboxInfo | null>(null);
  const folderCacheRef = useRef<Record<string, ImapFolderCache>>(globalFolderCache);
  const messageCacheRef = useRef<Record<string, ImapMessageFull>>(globalMessageCache);

  const getFolderCacheKey = useCallback((folder: ImapFolderName) => `${connectionId}:${folder}`, [connectionId]);
  const getMessageCacheKey = useCallback((folder: string, uid: number) => `${connectionId}:${folder}:${uid}`, [connectionId]);
  const hasCachedFolder = useCallback((folder: ImapFolderName = 'INBOX') => {
    if (!connectionId) return false;
    return Boolean(folderCacheRef.current[getFolderCacheKey(folder)]);
  }, [connectionId, getFolderCacheKey]);

  useEffect(() => {
    if (!connectionId) {
      setMessages([]);
      setHasMore(false);
      setPage(1);
      setActiveFolder('INBOX');
      setMailboxInfo(null);
      return;
    }

    const cached = folderCacheRef.current[`${connectionId}:INBOX`];
    setMessages(cached?.messages || []);
    setHasMore(cached?.hasMore || false);
    setPage(cached?.page || 1);
    setActiveFolder('INBOX');
    setMailboxInfo(cached?.mailboxInfo || null);
  }, [connectionId]);

  const fetchMessages = useCallback(async (
    folder: ImapFolderName = 'INBOX',
    pageNum = 1,
    options?: { forceRefresh?: boolean; background?: boolean; quiet?: boolean }
  ) => {
    if (!connectionId) return null;
    const cacheKey = getFolderCacheKey(folder);
    const cached = folderCacheRef.current[cacheKey];

    if (pageNum === 1 && cached && !options?.forceRefresh) {
      if (!options?.background) {
        setMessages(cached.messages);
        setHasMore(cached.hasMore);
        setPage(cached.page);
        setActiveFolder(folder);
        setMailboxInfo(cached.mailboxInfo);
      }
      return {
        messages: cached.messages,
        hasMore: cached.hasMore,
        folder: cached.mailboxInfo?.folder || folder,
        mailbox: cached.mailboxInfo
          ? { login: cached.mailboxInfo.login, exists: cached.mailboxInfo.exists }
          : undefined,
      };
    }

    if (!options?.background) {
      setLoading(true);
    }
    try {
      const data = await callImapApi('list_messages', {
        connection_id: connectionId,
        folder,
        page: pageNum,
      });
      const nextMessages = pageNum === 1
        ? (data.messages || [])
        : [...(folderCacheRef.current[cacheKey]?.messages || []), ...(data.messages || [])];
      const nextMailboxInfo = data.mailbox
        ? {
            login: data.mailbox.login,
            exists: Number(data.mailbox.exists || 0),
            folder: data.folder || folder,
          }
        : folderCacheRef.current[cacheKey]?.mailboxInfo || null;

      if (!options?.background) {
        setMessages(nextMessages);
        setHasMore(data.hasMore || false);
        setPage(pageNum);
        setActiveFolder(folder);
        setMailboxInfo(nextMailboxInfo);
      }
      folderCacheRef.current[cacheKey] = {
        messages: nextMessages,
        hasMore: Boolean(data.hasMore),
        page: pageNum,
        mailboxInfo: nextMailboxInfo,
      };
      writeStoredFolderCache(folderCacheRef.current);
      return data;
    } catch (err: any) {
      if (!options?.quiet) {
        toast.error(err.message || 'Failed to load messages');
      }
      return null;
    } finally {
      if (!options?.background) {
        setLoading(false);
      }
    }
  }, [connectionId, getFolderCacheKey]);

  const fetchMessage = useCallback(async (
    uid: number,
    folder: string,
    options?: { forceRefresh?: boolean }
  ): Promise<ImapMessageFull | null> => {
    if (!connectionId) return null;
    const cacheKey = getMessageCacheKey(folder, uid);
    if (messageCacheRef.current[cacheKey] && !options?.forceRefresh) {
      return {
        ...messageCacheRef.current[cacheKey],
        body: normalizeImapBody(messageCacheRef.current[cacheKey].body),
        attachments: normalizeImapAttachments(messageCacheRef.current[cacheKey].attachments),
      } satisfies ImapMessageFull;
    }
    try {
      const data = await callImapApi('get_message', {
        connection_id: connectionId,
        uid,
        folder,
      });
      if (!data || typeof data !== 'object') {
        return null;
      }
      const normalized = {
        ...(data as ImapMessageFull),
        body: normalizeImapBody((data as Partial<ImapMessageFull>).body),
        attachments: normalizeImapAttachments((data as Partial<ImapMessageFull>).attachments),
      } satisfies ImapMessageFull;
      messageCacheRef.current[cacheKey] = normalized;
      return normalized;
    } catch (err: any) {
      toast.error(err.message || 'Failed to load message');
      return null;
    }
  }, [connectionId, getMessageCacheKey]);

  const sendMessage = useCallback(async ({ to, cc, subject, body, htmlBody, attachments }: ImapDraftInput): Promise<boolean> => {
    if (!connectionId) return false;
    try {
      await callImapApi('send_message', {
        connection_id: connectionId,
        to,
        cc,
        subject,
        body,
        htmlBody,
        attachments: attachments || [],
      });
      toast.success('Email sent');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
      return false;
    }
  }, [connectionId]);

  const getAttachmentContent = useCallback(async (uid: number, folder: string, attachment: EmailMessageAttachment): Promise<EmailMessageAttachmentContent | null> => {
    if (!connectionId) return null;
    try {
      const data = await callImapApi('download_attachment', {
        connection_id: connectionId,
        uid,
        folder,
        attachmentId: attachment.id,
      });
      if (!data?.content) {
        throw new Error('Attachment download failed');
      }
      return {
        content: String(data.content),
        name: String(data.name || attachment.name || 'attachment'),
        contentType: typeof data.contentType === 'string' ? data.contentType : attachment.contentType,
        size: typeof data.size === 'number' ? data.size : attachment.size,
      } satisfies EmailMessageAttachmentContent;
    } catch (err: any) {
      toast.error(err.message || 'Failed to download attachment');
      return null;
    }
  }, [connectionId]);

  const downloadAttachment = useCallback(async (uid: number, folder: string, attachment: EmailMessageAttachment) => {
    try {
      const data = await getAttachmentContent(uid, folder, attachment);
      if (!data?.content) {
        throw new Error('Attachment download failed');
      }
      downloadEmailAttachment({
        content: data.content,
        name: data.name,
        contentType: data.contentType,
      });
      return true;
    } catch {
      return false;
    }
  }, [getAttachmentContent]);

  const markMessageAsRead = useCallback((uid: number, folder: ImapFolderName = 'INBOX') => {
    const folderKey = getFolderCacheKey(folder);
    const sourceMessages = folderCacheRef.current[folderKey]?.messages || (folder === activeFolder ? messages : []);
    const nextMessages = sourceMessages.map((message) => (
      message.uid === uid ? { ...message, isUnread: false } : message
    ));

    if (folder === activeFolder) {
      setMessages(nextMessages);
    }

    if (folderCacheRef.current[folderKey]) {
      folderCacheRef.current[folderKey] = {
        ...folderCacheRef.current[folderKey],
        messages: nextMessages,
      };
      writeStoredFolderCache(folderCacheRef.current);
    }
  }, [activeFolder, getFolderCacheKey, messages]);

  const deleteMessage = useCallback(async (uid: number, folder: string): Promise<boolean> => {
    if (!connectionId) return false;
    try {
      await callImapApi('delete_message', {
        connection_id: connectionId,
        uid,
        folder,
      });

      const folderKey = getFolderCacheKey(activeFolder);
      const nextMessages = (folderCacheRef.current[folderKey]?.messages || messages).filter(message => message.uid !== uid);
      const nextMailboxInfo = folderCacheRef.current[folderKey]?.mailboxInfo
        ? {
            ...folderCacheRef.current[folderKey]!.mailboxInfo!,
            exists: Math.max(0, folderCacheRef.current[folderKey]!.mailboxInfo!.exists - 1),
          }
        : mailboxInfo;

      setMessages(nextMessages);
      if (nextMailboxInfo) {
        setMailboxInfo(nextMailboxInfo);
      }
      folderCacheRef.current[folderKey] = {
        messages: nextMessages,
        hasMore: folderCacheRef.current[folderKey]?.hasMore || false,
        page: folderCacheRef.current[folderKey]?.page || page,
        mailboxInfo: nextMailboxInfo,
      };
      writeStoredFolderCache(folderCacheRef.current);

      Object.keys(messageCacheRef.current)
        .filter((key) => key.startsWith(`${connectionId}:`) && key.endsWith(`:${uid}`))
        .forEach((key) => {
          delete messageCacheRef.current[key];
        });

      toast.success('Email moved to trash');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete email');
      return false;
    }
  }, [activeFolder, connectionId, getFolderCacheKey, mailboxInfo, messages, page]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      fetchMessages(activeFolder, page + 1);
    }
  }, [hasMore, loading, activeFolder, page, fetchMessages]);

  return {
    messages,
    loading,
    hasMore,
    activeFolder,
    mailboxInfo,
    hasCachedFolder,
    fetchMessages,
    fetchMessage,
    sendMessage,
    getAttachmentContent,
    downloadAttachment,
    markMessageAsRead,
    deleteMessage,
    loadMore,
  };
}
