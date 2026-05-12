import { useCallback, useRef, useState } from 'react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  threadId?: string;
  attachments?: GmailDraftAttachment[];
}

type GmailFolderCache = {
  messages: GmailMessage[];
  nextPageToken: string | null;
};

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
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [activeFolder, setActiveFolder] = useState('INBOX');
  const folderCacheRef = useRef<Record<string, GmailFolderCache>>({});
  const messageCacheRef = useRef<Record<string, GmailMessageFull>>({});
  const labelsCacheRef = useRef<GmailLabel[] | null>(null);

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
      return messageCacheRef.current[messageId];
    }
    try {
      const data = await callGmailApi('get_message', { messageId });
      messageCacheRef.current[messageId] = data as GmailMessageFull;
      return data as GmailMessageFull;
    } catch (err: any) {
      toast.error(err.message || 'Failed to load message');
      return null;
    }
  }, []);

  const sendMessage = useCallback(async ({ to, cc, subject, body, threadId, attachments }: GmailDraftInput) => {
    try {
      await callGmailApi('send_message', {
        to,
        cc,
        subject,
        body,
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

  const trashMessage = useCallback(async (messageId: string): Promise<boolean> => {
    try {
      await callGmailApi('trash_message', { messageId });
      const nextMessages = messages.filter(message => message.id !== messageId);
      setMessages(nextMessages);
      folderCacheRef.current[activeFolder] = {
        messages: nextMessages,
        nextPageToken,
      };
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
    fetchMessages,
    fetchMessage,
    sendMessage,
    trashMessage,
    fetchLabels,
    loadMore,
  };
}
