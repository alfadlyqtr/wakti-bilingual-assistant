import { useCallback } from 'react';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
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

function normalizeMailApiError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    const message = error.message?.trim() || fallbackMessage;
    if (/load failed|failed to fetch|networkerror/i.test(message)) {
      return new Error('Could not reach Gmail right now. Please try again.');
    }
    return new Error(message);
  }
  return new Error(fallbackMessage);
}

async function callGmailApi(action: string, params: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not logged in');

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/gmail-api`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action, ...params }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(typeof data.error === 'string' ? data.error : 'Mail request failed');
    }
    return data;
  } catch (error) {
    throw normalizeMailApiError(error, 'Mail request failed');
  }
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
