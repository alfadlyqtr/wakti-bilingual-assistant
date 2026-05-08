import { supabase, ensurePassport, getCurrentUserId } from '@/integrations/supabase/client';
import { getContacts } from '@/services/contactsService';

export type TaskContactShareStatus = 'pending' | 'approved' | 'denied';

export interface TaskShareRecipient {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
}

export interface TaskContactShareRecord {
  id: string;
  task_id: string;
  assignee_id: string;
  assignee_name: string;
  status: TaskContactShareStatus;
  requested_at: string;
  responded_at?: string | null;
  task: {
    id: string;
    title: string;
    share_link?: string | null;
    due_date?: string | null;
    due_time?: string | null;
    priority?: string | null;
    user_id: string;
    is_shared: boolean;
  } | null;
  sender_snapshot: {
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
}

type TaskRow = {
  id: string;
  title: string;
  share_link?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  priority?: string | null;
  user_id: string;
  is_shared: boolean;
};

export async function getMutualTaskShareRecipients(): Promise<TaskShareRecipient[]> {
  await ensurePassport();
  const contacts = await getContacts();
  return (contacts || [])
    .filter((contact: any) => contact.relationshipStatus === 'mutual')
    .map((contact: any) => ({
      id: contact.contact_id,
      displayName: contact.profile?.display_name || contact.profile?.username || 'Wakti User',
      username: contact.profile?.username || 'user',
      avatarUrl: contact.profile?.avatar_url || undefined,
    }));
}

async function ensureTaskShareReady(taskId: string, userId: string): Promise<TaskRow> {
  const { data: existingTask, error: taskError } = await supabase
    .from('tr_tasks')
    .select('id, title, share_link, due_date, due_time, priority, user_id, is_shared')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single();

  if (taskError) throw taskError;
  if (!existingTask) throw new Error('Task not found');

  if (existingTask.is_shared && existingTask.share_link) {
    return existingTask as TaskRow;
  }

  const { data: updatedTask, error: updateError } = await supabase
    .from('tr_tasks')
    .update({ is_shared: true })
    .eq('id', taskId)
    .eq('user_id', userId)
    .select('id, title, share_link, due_date, due_time, priority, user_id, is_shared')
    .single();

  if (updateError) throw updateError;
  if (!updatedTask?.share_link) throw new Error('Could not prepare task for sharing');

  return updatedTask as TaskRow;
}

async function getSenderSnapshot(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, username, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return {
    display_name: data?.display_name || null,
    username: data?.username || null,
    avatar_url: data?.avatar_url || null,
  };
}

export async function sendTaskToContact(params: {
  recipientId: string;
  recipientName: string;
  taskId: string;
}): Promise<TaskContactShareRecord> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  await ensurePassport();

  const [task, senderSnapshot] = await Promise.all([
    ensureTaskShareReady(params.taskId, userId),
    getSenderSnapshot(userId),
  ]);

  const { data: existingAssignment, error: existingError } = await supabase
    .from('tr_task_assignments')
    .select('id, task_id, assignee_id, assignee_name, status, requested_at, responded_at')
    .eq('task_id', task.id)
    .eq('assignee_id', params.recipientId)
    .maybeSingle();

  if (existingError) throw existingError;

  let assignment: any = null;

  if (existingAssignment) {
    if (existingAssignment.status === 'approved') {
      throw new Error('Task already shared with this contact');
    }

    if (existingAssignment.status === 'pending') {
      throw new Error('Task share is already pending for this contact');
    }

    const { data: updatedAssignment, error: updateError } = await supabase
      .from('tr_task_assignments')
      .update({
        assignee_name: params.recipientName,
        status: 'pending',
        responded_at: null,
      })
      .eq('id', existingAssignment.id)
      .select('id, task_id, assignee_id, assignee_name, status, requested_at, responded_at')
      .single();

    if (updateError) throw updateError;
    assignment = updatedAssignment;
  } else {
    const { data: insertedAssignment, error: insertError } = await supabase
      .from('tr_task_assignments')
      .insert({
        task_id: task.id,
        assignee_id: params.recipientId,
        assignee_name: params.recipientName,
        status: 'pending',
      })
      .select('id, task_id, assignee_id, assignee_name, status, requested_at, responded_at')
      .single();

    if (insertError) throw insertError;
    assignment = insertedAssignment;
  }

  return {
    ...(assignment as TaskContactShareRecord),
    task,
    sender_snapshot: senderSnapshot,
  };
}

export async function getPendingTaskContactShares(): Promise<TaskContactShareRecord[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  await ensurePassport();

  const { data, error } = await supabase
    .from('tr_task_assignments')
    .select('id, task_id, assignee_id, assignee_name, status, requested_at, responded_at, task:tr_tasks(id, title, share_link, due_date, due_time, priority, user_id, is_shared)')
    .eq('assignee_id', userId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });

  if (error) throw error;

  const rows = (data || []) as any[];
  const ownerIds = Array.from(new Set(rows.map((row) => row.task?.user_id).filter(Boolean)));

  let profileMap = new Map<string, { display_name?: string | null; username?: string | null; avatar_url?: string | null }>();

  if (ownerIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', ownerIds);

    if (profilesError) throw profilesError;

    profileMap = new Map(
      (profiles || []).map((profile: any) => [
        profile.id,
        {
          display_name: profile.display_name || null,
          username: profile.username || null,
          avatar_url: profile.avatar_url || null,
        },
      ]),
    );
  }

  return rows.map((row) => ({
    id: row.id,
    task_id: row.task_id,
    assignee_id: row.assignee_id,
    assignee_name: row.assignee_name,
    status: row.status,
    requested_at: row.requested_at,
    responded_at: row.responded_at,
    task: row.task || null,
    sender_snapshot: row.task?.user_id ? profileMap.get(row.task.user_id) || null : null,
  }));
}

export async function acceptTaskContactShare(assignmentId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('accept_tr_task_share', { p_assignment_id: assignmentId });
  if (error) throw error;
}

export async function declineTaskContactShare(assignmentId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('decline_tr_task_share', { p_assignment_id: assignmentId });
  if (error) throw error;
}
