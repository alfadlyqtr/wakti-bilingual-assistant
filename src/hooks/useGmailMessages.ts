import { useCallback, useState } from 'react';
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

  const fetchMessages = useCallback(async (folder = 'INBOX', pageToken?: string) => {
    setLoading(true);
    try {
      const data = await callGmailApi('list_messages', {
        folder,
        pageToken: pageToken || '',
        maxResults: 20,
      });
      if (pageToken) {
        setMessages(prev => [...prev, ...data.messages]);
      } else {
        setMessages(data.messages || []);
      }
      setNextPageToken(data.nextPageToken || null);
      setActiveFolder(folder);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMessage = useCallback(async (messageId: string): Promise<GmailMessageFull | null> => {
    try {
      const data = await callGmailApi('get_message', { messageId });
      return data as GmailMessageFull;
    } catch (err: any) {
      toast.error(err.message || 'Failed to load message');
      return null;
    }
  }, []);

  const sendMessage = useCallback(async (to: string, subject: string, body: string, threadId?: string) => {
    try {
      await callGmailApi('send_message', { to, subject, body, threadId });
      toast.success('Email sent');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
      return false;
    }
  }, []);

  const fetchLabels = useCallback(async () => {
    try {
      const data = await callGmailApi('list_labels');
      setLabels(data.labels || []);
    } catch (err: any) {
      console.error('Failed to load labels:', err);
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
    fetchLabels,
    loadMore,
  };
}
