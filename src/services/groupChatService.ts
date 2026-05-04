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

export interface GroupChatConversation {
  id: string;
  name: string;
  is_group: boolean;
  created_by: string | null;
  updated_at: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_by: string | null;
  participants: GroupChatParticipant[];
  unread: boolean;
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
    .select("id, name, is_group, created_by, updated_at, last_message_text, last_message_at, last_message_by")
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
    .select("conversation_id, user_id, last_read_at, profiles:user_id(id, username, display_name, avatar_url)")
    .in("conversation_id", filteredConversationIds);

  if (participantError) {
    throw participantError;
  }

  const participantsByConversation = new Map<string, GroupChatParticipant[]>();
  (participantRows || []).forEach((row: any) => {
    const current = participantsByConversation.get(row.conversation_id) || [];
    current.push({
      user_id: row.user_id,
      last_read_at: row.last_read_at || null,
      profile: row.profiles || null,
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
    .select("id, name, is_group, created_by, updated_at, last_message_text, last_message_at, last_message_by")
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
    .select("conversation_id, user_id, last_read_at, profiles:user_id(id, username, display_name, avatar_url)")
    .eq("conversation_id", conversationId);

  if (participantError) {
    throw participantError;
  }

  const participants = (participantRows || []).map((row: any) => ({
    user_id: row.user_id,
    last_read_at: row.last_read_at || null,
    profile: row.profiles || null,
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
    participants,
    unread: Boolean(
      conversation.last_message_at &&
      conversation.last_message_by !== userId &&
      (!myParticipant?.last_read_at || new Date(conversation.last_message_at).getTime() > new Date(myParticipant.last_read_at).getTime())
    ),
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
    .select("id, conversation_id, sender_id, message_type, content, media_url, media_type, voice_duration, file_size, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const senderIds = Array.from(new Set((rows || []).map((row: any) => row.sender_id)));
  const profilesMap = new Map<string, any>();

  if (senderIds.length > 0) {
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id, display_name, username, avatar_url")
      .in("id", senderIds);

    (profiles || []).forEach((profile: any) => {
      profilesMap.set(profile.id, profile);
    });
  }

  return (rows || []).map((row: any) => ({
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
    sender: profilesMap.get(row.sender_id) || undefined,
  }));
}

export async function sendGroupConversationMessage(conversationId: string, content: string) {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("User not authenticated");
  }

  await ensurePassport();

  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Message cannot be empty");
  }

  const { data, error } = await (supabase as any)
    .from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      message_type: "text",
      content: trimmed,
    })
    .select("id, conversation_id, sender_id, message_type, content, created_at")
    .single();

  if (error) {
    throw error;
  }

  return data as GroupChatMessage;
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
