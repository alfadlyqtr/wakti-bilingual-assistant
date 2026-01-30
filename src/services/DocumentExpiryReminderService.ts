import { supabase } from '@/integrations/supabase/client';
import { parseISO, setHours, setMinutes, setSeconds, setMilliseconds, subMonths } from 'date-fns';

type DocExpiryScheduleInput = {
  userId: string;
  docId: string;
  docTitle: string;
  expiryDateIso: string;
};

type ExistingDocExpiryNotification = {
  id: string;
  onesignalId: string | null;
};

function computeDocExpiryReminderTime(expiryDateIso: string): Date | null {
  const expiry = parseISO(expiryDateIso);
  if (Number.isNaN(expiry.getTime())) return null;

  const reminderDay = subMonths(expiry, 1);
  const atNine = setMilliseconds(setSeconds(setMinutes(setHours(reminderDay, 9), 0), 0), 0);

  if (Number.isNaN(atNine.getTime())) return null;
  return atNine;
}

async function getAccessToken(): Promise<string | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  return sessionData?.session?.access_token ?? null;
}

export async function findExistingDocExpiryNotification(userId: string, docId: string): Promise<ExistingDocExpiryNotification | null> {
  const { data, error } = await (supabase as any)
    .from('notification_history')
    .select('id, data')
    .eq('user_id', userId)
    .eq('type', 'doc_expiry')
    .eq('push_sent', true)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return null;

  const rows: Array<{ id: string; data: any }> = data || [];
  const match = rows.find((r) => {
    const d = r?.data || {};
    return d?.doc_id === docId;
  });

  if (!match) return null;
  const onesignalId = (match.data || {})?.onesignal_notification_id ?? null;
  return { id: match.id, onesignalId };
}

export async function cancelDocExpiryNotification(params: {
  userId: string;
  notificationId: string;
  onesignalId: string;
}): Promise<{ success: boolean; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { success: false, error: 'Missing auth token' };

  const response = await fetch(
    'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/cancel-onesignal-notification',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user_id: params.userId,
        notification_id: params.notificationId,
        onesignal_notification_id: params.onesignalId,
      }),
    }
  );

  const result = await response.json().catch(() => ({}));
  if (response.ok && result.success) return { success: true };

  return { success: false, error: result?.error || 'Failed to cancel scheduled push' };
}

export async function scheduleDocExpiryPush(input: DocExpiryScheduleInput): Promise<{ success: boolean; error?: string }> {
  const scheduledFor = computeDocExpiryReminderTime(input.expiryDateIso);
  if (!scheduledFor) return { success: false, error: 'Invalid expiry date' };

  const oneMinuteAgo = Date.now() - 60000;
  if (scheduledFor.getTime() < oneMinuteAgo) {
    return { success: false, error: 'Reminder time is in the past' };
  }

  const { data: notifData, error: notifError } = await (supabase as any)
    .from('notification_history')
    .insert({
      user_id: input.userId,
      type: 'doc_expiry',
      title: 'Document Expiry Reminder',
      body: `${input.docTitle} expires in 1 month`,
      scheduled_for: scheduledFor.toISOString(),
      reminder_content: input.docTitle,
      push_sent: false,
      is_read: false,
      data: {
        source: 'my_docs',
        doc_id: input.docId,
        doc_title: input.docTitle,
        expiry_date: input.expiryDateIso,
      },
    })
    .select('id')
    .single();

  if (notifError) return { success: false, error: notifError.message };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'Missing auth token' };

  const response = await fetch(
    'https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/schedule-doc-expiry-push',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        user_id: input.userId,
        doc_id: input.docId,
        doc_title: input.docTitle,
        scheduled_for: scheduledFor.toISOString(),
        notification_id: notifData?.id,
      }),
    }
  );

  const result = await response.json().catch(() => ({}));
  if (response.ok && result.success) return { success: true };

  return { success: false, error: result?.error || 'Failed to schedule push' };
}

export async function rescheduleDocExpiryPush(input: DocExpiryScheduleInput): Promise<{ success: boolean; error?: string }> {
  const existing = await findExistingDocExpiryNotification(input.userId, input.docId);
  if (existing?.id && existing.onesignalId) {
    await cancelDocExpiryNotification({
      userId: input.userId,
      notificationId: existing.id,
      onesignalId: existing.onesignalId,
    });
  }

  return scheduleDocExpiryPush(input);
}
