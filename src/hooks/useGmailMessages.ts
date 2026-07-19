import { useCallback } from 'react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  return {
    sendMessage,
  };
}
