import { supabase, ensurePassport, getCurrentUserId } from "@/integrations/supabase/client";
import { getContacts } from "@/services/contactsService";

export interface GroupChatParticipant {
  user_id: string;
  last_read_at: string | null;
  profile: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

export interface GroupConversationMessageReaction {
  id: string;
  conversation_message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface GroupChatConversation {
  id: string;
  name: string;
  is_group: boolean;
  created_by: string | null;
  updated_at: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_by: string | null;
  avatar_url: string | null;
  participants: GroupChatParticipant[];
  unread: boolean;
  ai_tone?: string | null;
  ai_response_length?: string | null;
  ai_response_style?: string | null;
  ai_search_enabled?: boolean | null;
}

export interface GroupChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: "text" | "image" | "voice" | "pdf";
  content: string | null;
  media_url?: string | null;
  media_type?: string | null;
  voice_duration?: number | null;
  file_size?: number | null;
  created_at: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
  edited_at?: string | null;
  reply_to_id?: string | null;
  reply_to?: {
    id: string;
    content?: string | null;
    sender_id: string;
    message_type: "text" | "image" | "voice" | "pdf";
    is_deleted?: boolean;
  } | null;
  reactions?: GroupConversationMessageReaction[];
  sender?: {
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  };
}

const SUPPORT_CONTACT_ID = "00000000-0000-0000-0000-000000000001";

export async function getEligibleGroupContacts() {
  const contacts = await getContacts();
  return contacts.filter((contact: any) => contact.relationshipStatus === "mutual" && contact.contact_id !== SUPPORT_CONTACT_ID);
}

export async function getMyGroupConversations(): Promise<GroupChatConversation[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  await ensurePassport();

  const { data: membershipRows, error: membershipError } = await (supabase as any)
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", userId);

  if (membershipError) {
    throw membershipError;
  }

  const conversationIds = Array.from(new Set((membershipRows || []).map((row: any) => row.conversation_id)));
  if (conversationIds.length === 0) {
    return [];
  }

  const { data: conversations, error: conversationError } = await (supabase as any)
    .from("conversations")
    .select("id, name, is_group, created_by, updated_at, last_message_text, last_message_at, last_message_by, avatar_url")
    .in("id", conversationIds)
    .eq("is_group", true);

  if (conversationError) {
    throw conversationError;
  }

  const filteredConversationIds = (conversations || []).map((conversation: any) => conversation.id);
  if (filteredConversationIds.length === 0) {
    return [];
  }

  const { data: participantRows, error: participantError } = await (supabase as any)
    .from("conversation_participants")
    .select("conversation_id, user_id, last_read_at")
    .in("conversation_id", filteredConversationIds);

  if (participantError) {
    throw participantError;
  }

  const allUserIds = Array.from(new Set((participantRows || []).map((row: any) => row.user_id)));
  const profilesMap = new Map<string, any>();
  if (allUserIds.length > 0) {
    const { data: profileRows } = await (supabase as any)
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", allUserIds);
    (profileRows || []).forEach((p: any) => profilesMap.set(p.id, p));
  }

  const participantsByConversation = new Map<string, GroupChatParticipant[]>();
  (participantRows || []).forEach((row: any) => {
    const current = participantsByConversation.get(row.conversation_id) || [];
    current.push({
      user_id: row.user_id,
      last_read_at: row.last_read_at || null,
      profile: profilesMap.get(row.user_id) || null,
    });
    participantsByConversation.set(row.conversation_id, current);
  });

  const membershipMap = new Map<string, string | null>();
  (membershipRows || []).forEach((row: any) => {
    membershipMap.set(row.conversation_id, row.last_read_at || null);
  });

  return (conversations || [])
    .map((conversation: any) => {
      const participants = participantsByConversation.get(conversation.id) || [];
      const myLastReadAt = membershipMap.get(conversation.id);
      const unread = Boolean(
        conversation.last_message_at &&
        conversation.last_message_by !== userId &&
        (!myLastReadAt || new Date(conversation.last_message_at).getTime() > new Date(myLastReadAt).getTime())
      );

      return {
        id: conversation.id,
        name: conversation.name || "Group chat",
        is_group: true,
        created_by: conversation.created_by || null,
        updated_at: conversation.updated_at || null,
        last_message_text: conversation.last_message_text || null,
        last_message_at: conversation.last_message_at || null,
        last_message_by: conversation.last_message_by || null,
        avatar_url: conversation.avatar_url || null,
        participants,
        unread,
      };
    })
    .sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });
}

export async function createGroupConversation(groupName: string, memberIds: string[]) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  await ensurePassport();

  const { data, error } = await (supabase as any).rpc("create_group_conversation", {
    group_name: groupName,
    member_ids: memberIds,
  });

  if (error) {
    throw error;
  }

  return data as string;
}

export async function getGroupConversation(conversationId: string): Promise<GroupChatConversation | null> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  await ensurePassport();

  const { data: conversation, error: conversationError } = await (supabase as any)
    .from("conversations")
    .select("id, name, is_group, created_by, updated_at, last_message_text, last_message_at, last_message_by, avatar_url, ai_tone, ai_response_length, ai_response_style, ai_search_enabled")
    .eq("id", conversationId)
    .eq("is_group", true)
    .maybeSingle();

  if (conversationError) {
    throw conversationError;
  }

  if (!conversation) {
    return null;
  }

  const { data: participantRows, error: participantError } = await (supabase as any)
    .from("conversation_participants")
    .select("conversation_id, user_id, last_read_at")
    .eq("conversation_id", conversationId);

  if (participantError) {
    throw participantError;
  }

  const participantUserIds = Array.from(new Set((participantRows || []).map((row: any) => row.user_id)));
  const profilesMap2 = new Map<string, any>();
  if (participantUserIds.length > 0) {
    const { data: profileRows } = await (supabase as any)
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", participantUserIds);
    (profileRows || []).forEach((p: any) => profilesMap2.set(p.id, p));
  }

  const participants = (participantRows || []).map((row: any) => ({
    user_id: row.user_id,
    last_read_at: row.last_read_at || null,
    profile: profilesMap2.get(row.user_id) || null,
  }));

  const myParticipant = participants.find((participant) => participant.user_id === userId);

  return {
    id: conversation.id,
    name: conversation.name || "Group chat",
    is_group: true,
    created_by: conversation.created_by || null,
    updated_at: conversation.updated_at || null,
    last_message_text: conversation.last_message_text || null,
    last_message_at: conversation.last_message_at || null,
    last_message_by: conversation.last_message_by || null,
    avatar_url: conversation.avatar_url || null,
    participants,
    unread: Boolean(
      conversation.last_message_at &&
      conversation.last_message_by !== userId &&
      (!myParticipant?.last_read_at || new Date(conversation.last_message_at).getTime() > new Date(myParticipant.last_read_at).getTime())
    ),
    ai_tone: conversation.ai_tone || null,
    ai_response_length: conversation.ai_response_length || null,
    ai_response_style: conversation.ai_response_style || null,
    ai_search_enabled: conversation.ai_search_enabled ?? true,
  };
}

export async function getGroupConversationMessages(conversationId: string): Promise<GroupChatMessage[]> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  await ensurePassport();

  const { data: rows, error } = await (supabase as any)
    .from("conversation_messages")
    .select("id, conversation_id, sender_id, message_type, content, media_url, media_type, voice_duration, file_size, created_at, is_deleted, deleted_at, edited_at, reply_to_id, reply_to:reply_to_id(id, content, sender_id, message_type, is_deleted)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  const senderIds = Array.from(new Set((rows || []).map((row: any) => row.sender_id)));
  const profilesMap = new Map<string, any>();
  const reactionsMap = new Map<string, GroupConversationMessageReaction[]>();

  if (senderIds.length > 0) {
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", senderIds);

    (profiles || []).forEach((profile: any) => {
      profilesMap.set(profile.id, profile);
    });
  }

  const messageIds = (rows || []).map((row: any) => row.id);
  if (messageIds.length > 0) {
    const { data: reactions } = await (supabase as any)
      .from("conversation_message_reactions")
      .select("id, conversation_message_id, user_id, emoji, created_at")
      .in("conversation_message_id", messageIds);

    (reactions || []).forEach((reaction: GroupConversationMessageReaction) => {
      const list = reactionsMap.get(reaction.conversation_message_id) || [];
      list.push(reaction);
      reactionsMap.set(reaction.conversation_message_id, list);
    });
  }

  // Latest 100 in desc order — reverse to chronological (oldest first) for UI rendering
  return (rows || []).reverse().map((row: any) => ({
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    message_type: row.message_type,
    content: row.content || null,
    media_url: row.media_url || null,
    media_type: row.media_type || null,
    voice_duration: row.voice_duration ?? null,
    file_size: row.file_size ?? null,
    created_at: row.created_at,
    is_deleted: row.is_deleted ?? false,
    deleted_at: row.deleted_at ?? null,
    edited_at: row.edited_at ?? null,
    reply_to_id: row.reply_to_id ?? null,
    reply_to: row.reply_to || null,
    reactions: reactionsMap.get(row.id) || [],
    sender: profilesMap.get(row.sender_id) || undefined,
  }));
}

export async function uploadGroupMessageAttachment(file: File, type: 'image' | 'voice' | 'pdf'): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  await ensurePassport();
  const fileExt = file.name.split('.').pop() || 'bin';
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
  const { error } = await (supabase as any).storage
    .from('message_attachments')
    .upload(fileName, file, { contentType: file.type, cacheControl: '3600' });
  if (error) throw error;
  const { data: urlData } = (supabase as any).storage
    .from('message_attachments')
    .getPublicUrl(fileName);
  return (urlData.publicUrl || '').trim();
}

export async function sendGroupConversationMessage(
  conversationId: string,
  payload: string | {
    message_type: 'text' | 'image' | 'voice' | 'pdf';
    content?: string;
    media_url?: string;
    media_type?: string;
    voice_duration?: number;
    file_size?: number;
    reply_to_id?: string | null;
  }
) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  await ensurePassport();

  let insertData: any;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) throw new Error("Message cannot be empty");
    insertData = { conversation_id: conversationId, sender_id: userId, message_type: 'text', content: trimmed };
  } else {
    insertData = { conversation_id: conversationId, sender_id: userId, ...payload };
  }

  const { data, error } = await (supabase as any)
    .from("conversation_messages")
    .insert(insertData)
    .select("id, conversation_id, sender_id, message_type, content, media_url, media_type, voice_duration, file_size, created_at, is_deleted, deleted_at, reply_to_id")
    .single();

  if (error) {
    throw error;
  }

  return data as GroupChatMessage;
}

export async function addGroupReaction(messageId: string, emoji: string): Promise<GroupConversationMessageReaction> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  await ensurePassport();

  const { error: clearError } = await (supabase as any)
    .from("conversation_message_reactions")
    .delete()
    .eq("conversation_message_id", messageId)
    .eq("user_id", userId);

  if (clearError) {
    throw clearError;
  }

  const { data, error } = await (supabase as any)
    .from("conversation_message_reactions")
    .insert({ conversation_message_id: messageId, user_id: userId, emoji })
    .select("id, conversation_message_id, user_id, emoji, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data as GroupConversationMessageReaction;
}

export async function removeGroupReaction(messageId: string, emoji: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  await ensurePassport();

  const { error } = await (supabase as any)
    .from("conversation_message_reactions")
    .delete()
    .eq("conversation_message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji);

  if (error) {
    throw error;
  }
}

export async function editGroupMessage(messageId: string, newContent: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  await ensurePassport();

  const { data: msg } = await (supabase as any)
    .from("conversation_messages")
    .select("created_at")
    .eq("id", messageId)
    .single();

  if (!msg) throw new Error("Message not found");

  const createdAt = new Date(msg.created_at).getTime();
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  if (createdAt < tenMinutesAgo) {
    throw new Error("Message can only be edited within 10 minutes");
  }

  const { error } = await (supabase as any)
    .from("conversation_messages")
    .update({ content: newContent, edited_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", userId);

  if (error) throw error;
}

export async function deleteGroupMessage(messageId: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  await ensurePassport();

  const { data, error } = await (supabase as any).rpc("soft_delete_conversation_message", {
    p_message_id: messageId,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Message could not be deleted");
  }
}

export async function leaveGroupConversation(conversationId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  await ensurePassport();
  const { error } = await (supabase as any)
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateGroupAiSettings(
  conversationId: string,
  settings: { tone?: string; responseLength?: string; responseStyle?: string; searchEnabled?: boolean }
) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  await ensurePassport();

  const { data, error } = await (supabase as any)
    .rpc("update_group_ai_settings", {
      p_conversation_id: conversationId,
      p_tone: settings.tone || null,
      p_response_length: settings.responseLength || null,
      p_response_style: settings.responseStyle || null,
      p_search_enabled: settings.searchEnabled !== undefined ? settings.searchEnabled : null,
    });

  if (error) throw error;
  return data as boolean;
}

export async function renameGroupConversation(conversationId: string, newName: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Group name is required");
  if (trimmed.length > 80) throw new Error("Group name is too long");
  await ensurePassport();
  const { error } = await (supabase as any).rpc("rename_group_conversation", {
    group_conversation_id: conversationId,
    new_name: trimmed,
  });
  if (error) throw error;
}

export async function updateGroupAvatar(conversationId: string, avatarUrl: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  await ensurePassport();
  const { error } = await (supabase as any).rpc("update_group_avatar", {
    group_conversation_id: conversationId,
    avatar_url: avatarUrl,
  });
  if (error) throw error;
}

export async function addGroupMembers(conversationId: string, memberIds: string[]) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("User not authenticated");
  if (!memberIds.length) throw new Error("No members selected");
  await ensurePassport();

  // Verify I'm a member first
  const { data: me, error: meErr } = await (supabase as any)
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (meErr) throw meErr;
  if (!me) throw new Error("You are not a member of this group");

  // Insert new members
  const rows = memberIds.map((id) => ({
    conversation_id: conversationId,
    user_id: id,
    joined_at: new Date().toISOString(),
    last_read_at: new Date().toISOString(),
  }));

  const { error } = await (supabase as any)
    .from("conversation_participants")
    .insert(rows);
  if (error) throw error;
}

export async function addWaktiToGroup(conversationId: string) {
  await ensurePassport();
  const { data, error } = await (supabase as any).rpc("add_wakti_to_group", {
    group_conversation_id: conversationId,
  });
  if (error) throw error;
  return data;
}

export async function removeWaktiFromGroup(conversationId: string) {
  await ensurePassport();
  const { data, error } = await (supabase as any).rpc("remove_wakti_from_group", {
    group_conversation_id: conversationId,
  });
  if (error) throw error;
  return data;
}

export async function isWaktiInGroup(conversationId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("is_wakti_in_group", {
    group_conversation_id: conversationId,
  });
  if (error) throw error;
  return data || false;
}

export async function triggerWaktiAI(
  conversationId: string,
  payload: {
    trigger_type: "mention" | "welcome_back";
    message_id?: string;
    language?: string;
    sender_id?: string;
    sender_location?: { lat: number; lng: number };
  }
) {
  await ensurePassport();
  const { data, error } = await (supabase as any).functions.invoke("wakti-group-ai", {
    body: {
      conversation_id: conversationId,
      ...payload,
    },
  });
  if (error) throw error;
  return data;
}

export async function markGroupConversationRead(conversationId: string) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return;
  }

  await ensurePassport();

  const { error } = await (supabase as any).rpc("mark_conversation_read", {
    target_conversation_id: conversationId,
  });

  if (error) {
    throw error;
  }
}
