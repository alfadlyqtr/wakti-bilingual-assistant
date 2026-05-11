import { useCallback, useState } from 'react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
}

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
  const [activeFolder, setActiveFolder] = useState<'INBOX' | 'SENT'>('INBOX');

  const fetchMessages = useCallback(async (folder: 'INBOX' | 'SENT' = 'INBOX', pageNum = 1) => {
    if (!connectionId) return;
    setLoading(true);
    try {
      const data = await callImapApi('list_messages', {
        connection_id: connectionId,
        folder,
        page: pageNum,
      });
      if (pageNum === 1) {
        setMessages(data.messages || []);
      } else {
        setMessages(prev => [...prev, ...(data.messages || [])]);
      }
      setHasMore(data.hasMore || false);
      setPage(pageNum);
      setActiveFolder(folder);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [connectionId]);

  const fetchMessage = useCallback(async (uid: number, folder: string): Promise<ImapMessageFull | null> => {
    if (!connectionId) return null;
    try {
      const data = await callImapApi('get_message', {
        connection_id: connectionId,
        uid,
        folder,
      });
      return data as ImapMessageFull;
    } catch (err: any) {
      toast.error(err.message || 'Failed to load message');
      return null;
    }
  }, [connectionId]);

  const sendMessage = useCallback(async (to: string, subject: string, body: string): Promise<boolean> => {
    if (!connectionId) return false;
    try {
      await callImapApi('send_message', {
        connection_id: connectionId,
        to,
        subject,
        body,
      });
      toast.success('Email sent');
      return true;
    } catch (err: any) {
      toast.error(err.message || 'Failed to send email');
      return false;
    }
  }, [connectionId]);

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
    fetchMessages,
    fetchMessage,
    sendMessage,
    loadMore,
  };
}
