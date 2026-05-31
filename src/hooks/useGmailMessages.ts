import { useCallback, useRef, useState } from 'react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadEmailAttachment, EmailMessageAttachment, EmailMessageAttachmentContent } from '@/utils/emailAttachmentDownload';

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  labelIds: string[];
  isUnread: boolean;
}

export interface GmailMessageFull extends GmailMessage {
  body: { text: string; html: string };
  attachments: EmailMessageAttachment[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messagesTotal?: number;
  messagesUnread?: number;
}

export interface GmailDraftAttachment {
  name: string;
  contentType?: string;
  content: string;
}

export interface GmailDraftInput {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  body: string;
  htmlBody?: string;
  threadId?: string;
  attachments?: GmailDraftAttachment[];
}

type GmailFolderCache = {
  messages: GmailMessage[];
  nextPageToken: string | null;
};

const GMAIL_FOLDER_CACHE_STORAGE_KEY = 'wakti-gmail-folder-cache-v1';

function normalizeGmailBody(body: unknown): { text: string; html: string } {
  const safeBody = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    text: typeof safeBody.text === 'string' ? safeBody.text : '',
    html: typeof safeBody.html === 'string' ? safeBody.html : '',
  };
}

function normalizeGmailAttachments(value: unknown): EmailMessageAttachment[] {
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

function readStoredFolderCache(): Record<string, GmailFolderCache> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(GMAIL_FOLDER_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredFolderCache(value: Record<string, GmailFolderCache>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GMAIL_FOLDER_CACHE_STORAGE_KEY, JSON.stringify(value));
  } catch {}
}

const globalFolderCache: Record<string, GmailFolderCache> = readStoredFolderCache();

async function callGmailApi(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not logged in');

  const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api`, {
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

export function useGmailMessages() {
  const [messages, setMessages] = useState<GmailMessage[]>(() => globalFolderCache.INBOX?.messages || []);
  const [loading, setLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(() => globalFolderCache.INBOX?.nextPageToken || null);
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [activeFolder, setActiveFolder] = useState('INBOX');
  const folderCacheRef = useRef<Record<string, GmailFolderCache>>(globalFolderCache);
  const messageCacheRef = useRef<Record<string, GmailMessageFull>>({});
  const labelsCacheRef = useRef<GmailLabel[] | null>(null);

  const hasCachedFolder = useCallback((folder = 'INBOX') => {
    return Boolean(folderCacheRef.current[folder]);
  }, []);

  const fetchMessages = useCallback(async (folder = 'INBOX', pageToken?: string, options?: { forceRefresh?: boolean; background?: boolean; quiet?: boolean }) => {
    const cacheKey = folder;
    if (!pageToken && folderCacheRef.current[cacheKey] && !options?.forceRefresh) {
      if (!options?.background) {
        setMessages(folderCacheRef.current[cacheKey].messages);
        setNextPageToken(folderCacheRef.current[cacheKey].nextPageToken);
        setActiveFolder(folder);
      }
      return {
        messages: folderCacheRef.current[cacheKey].messages,
        nextPageToken: folderCacheRef.current[cacheKey].nextPageToken,
      };
    }

    if (!options?.background) {
      setLoading(true);
    }
    try {
      const data = await callGmailApi('list_messages', {
        folder,
        pageToken: pageToken || '',
        maxResults: 20,
      });
      const nextMessages = pageToken
        ? [...(folderCacheRef.current[cacheKey]?.messages || []), ...(data.messages || [])]
        : (data.messages || []);

      if (!options?.background) {
        setMessages(nextMessages);
        setNextPageToken(data.nextPageToken || null);
        setActiveFolder(folder);
      }
      folderCacheRef.current[cacheKey] = {
        messages: nextMessages,
        nextPageToken: data.nextPageToken || null,
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
  }, []);

  const fetchMessage = useCallback(async (messageId: string, options?: { forceRefresh?: boolean }): Promise<GmailMessageFull | null> => {
    if (messageCacheRef.current[messageId] && !options?.forceRefresh) {
      return {
        ...messageCacheRef.current[messageId],
        body: normalizeGmailBody(messageCacheRef.current[messageId].body),
        attachments: normalizeGmailAttachments(messageCacheRef.current[messageId].attachments),
      } satisfies GmailMessageFull;
    }
    try {
      const data = await callGmailApi('get_message', { messageId });
      if (!data || typeof data !== 'object') {
        return null;
      }
      const normalized = {
        ...(data as GmailMessageFull),
        body: normalizeGmailBody((data as Partial<GmailMessageFull>).body),
        attachments: normalizeGmailAttachments((data as Partial<GmailMessageFull>).attachments),
      } satisfies GmailMessageFull;
      messageCacheRef.current[messageId] = normalized;
      return normalized;
    } catch (err: any) {
      toast.error(err.message || 'Failed to load message');
      return null;
    }
  }, []);

  const sendMessage = useCallback(async ({ to, cc, subject, body, htmlBody, threadId, attachments }: GmailDraftInput) => {
    try {
      await callGmailApi('send_message', {
        to,
        cc,
        subject,
        body,
        htmlBody,
        threadId,
        attachments: attachments || [],
      });
      toast.success('Email sent');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
      return false;
    }
  }, []);

  const getAttachmentContent = useCallback(async (messageId: string, attachment: EmailMessageAttachment): Promise<EmailMessageAttachmentContent | null> => {
    try {
      const data = await callGmailApi('download_attachment', {
        messageId,
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
  }, []);

  const downloadAttachment = useCallback(async (messageId: string, attachment: EmailMessageAttachment) => {
    try {
      const data = await getAttachmentContent(messageId, attachment);
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

  const trashMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      await callGmailApi('trash_message', { messageId });
      const nextMessages = messages.filter(message => message.id !== messageId);
      setMessages(nextMessages);
      folderCacheRef.current[activeFolder] = {
        messages: nextMessages,
        nextPageToken,
      };
      writeStoredFolderCache(folderCacheRef.current);
      delete messageCacheRef.current[messageId];
      toast.success('Email moved to trash');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete email');
      return false;
    }
  }, [activeFolder, messages, nextPageToken]);

  const fetchLabels = useCallback(async (options?: { forceRefresh?: boolean }) => {
    if (labelsCacheRef.current && !options?.forceRefresh) {
      setLabels(labelsCacheRef.current);
      return labelsCacheRef.current;
    }
    try {
      const data = await callGmailApi('list_labels');
      setLabels(data.labels || []);
      labelsCacheRef.current = data.labels || [];
      return data.labels || [];
    } catch (err: any) {
      console.error('Failed to load labels:', err);
      return [];
    }
  }, []);

  const loadMore = useCallback(() => {
    if (nextPageToken) {
      fetchMessages(activeFolder, nextPageToken);
    }
  }, [nextPageToken, activeFolder, fetchMessages]);

  return {
    messages,
    loading,
    nextPageToken,
    labels,
    activeFolder,
    hasCachedFolder,
    fetchMessages,
    fetchMessage,
    sendMessage,
    getAttachmentContent,
    downloadAttachment,
    trashMessage,
    fetchLabels,
    loadMore,
  };
}
