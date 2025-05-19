import { supabase } from "@/integrations/supabase/client";

export interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_text: string | null;
  last_message_at: string;
  last_message_by: string | null;
  is_group: boolean;
  participants?: {
    user_id: string;
    profile?: {
      display_name: string;
      username: string;
      avatar_url?: string;
    };
  }[];
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: 'text' | 'image' | 'voice';
  content?: string;
  media_url?: string;
  media_type?: string;
  media_duration?: number;
  created_at: string;
  expires_at: string;
  is_read: boolean;
  sender?: {
    display_name: string;
    username: string;
    avatar_url?: string;
  };
}

// Get all conversations for current user
export async function getConversations(): Promise<Conversation[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Get all conversations where user is a participant
  const { data: participations, error: participationsError } = await supabase
    .from("conversation_participants")
    .select(`
      conversation_id
    `)
    .eq("user_id", userId);

  if (participationsError) {
    console.error("Error fetching participations:", participationsError);
    throw participationsError;
  }

  if (!participations || participations.length === 0) {
    return [];
  }

  const conversationIds = participations.map(p => p.conversation_id);

  // Get conversation details
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select(`
      id,
      created_at,
      updated_at,
      last_message_text,
      last_message_at,
      last_message_by,
      is_group
    `)
    .in("id", conversationIds)
    .order("last_message_at", { ascending: false });

  if (conversationsError) {
    console.error("Error fetching conversations:", conversationsError);
    throw conversationsError;
  }

  // Get participants and unread messages count for each conversation
  const enhancedConversations: Conversation[] = await Promise.all(
    conversations.map(async (conversation) => {
      // Get participants
      const { data: participants, error: participantsError } = await supabase
        .from("conversation_participants")
        .select(`
          user_id,
          profiles:user_id (
            display_name,
            username,
            avatar_url
          )
        `)
        .eq("conversation_id", conversation.id);

      if (participantsError) {
        console.error("Error fetching participants:", participantsError);
        return {
          ...conversation,
          participants: []
        } as Conversation;
      }

      // Get unread messages count
      const { count, error: countError } = await supabase
        .from("messages")
        .select("id", { count: 'exact', head: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", userId)
        .eq("is_read", false);

      if (countError) {
        console.error("Error counting unread messages:", countError);
      }

      return {
        ...conversation,
        participants,
        unread_count: count || 0
      } as Conversation;
    })
  );

  return enhancedConversations;
}

// Filter conversations by search query
export async function searchConversations(query: string) {
  const conversations = await getConversations();
  
  if (!query) return conversations;
  
  const lowerCaseQuery = query.toLowerCase();
  
  return conversations.filter(conversation => {
    // Check last message text
    if (conversation.last_message_text && 
        conversation.last_message_text.toLowerCase().includes(lowerCaseQuery)) {
      return true;
    }
    
    // Check participant names
    if (conversation.participants) {
      for (const participant of conversation.participants) {
        if (participant.profile) {
          const { display_name, username } = participant.profile;
          if ((display_name && display_name.toLowerCase().includes(lowerCaseQuery)) || 
              (username && username.toLowerCase().includes(lowerCaseQuery))) {
            return true;
          }
        }
      }
    }
    
    return false;
  });
}

// Get a single conversation by ID
export async function getConversationById(conversationId: string): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      id,
      created_at,
      updated_at,
      last_message_text,
      last_message_at,
      last_message_by,
      is_group
    `)
    .eq("id", conversationId)
    .single();

  if (error) {
    console.error("Error fetching conversation:", error);
    throw error;
  }

  // Get participants
  const { data: participants, error: participantsError } = await supabase
    .from("conversation_participants")
    .select(`
      user_id,
      profiles:user_id (
        display_name,
        username,
        avatar_url
      )
    `)
    .eq("conversation_id", conversationId);

  if (participantsError) {
    console.error("Error fetching participants:", participantsError);
    throw participantsError;
  }

  return {
    ...data,
    participants
  } as Conversation;
}

// Create a new conversation with another user
export async function createConversation(otherUserId: string): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // First check if conversation already exists between these users
  const { data: participations } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  if (participations && participations.length > 0) {
    const conversationIds = participations.map(p => p.conversation_id);
    
    const { data: otherParticipations } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", otherUserId)
      .in("conversation_id", conversationIds);
    
    if (otherParticipations && otherParticipations.length > 0) {
      // Get the non-group conversation they share
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .in("id", otherParticipations.map(p => p.conversation_id))
        .eq("is_group", false);
      
      if (conversations && conversations.length > 0) {
        return conversations[0].id;
      }
    }
  }

  // Create a new conversation
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .insert({
      is_group: false,
      last_message_at: new Date().toISOString()
    })
    .select()
    .single();

  if (conversationError) {
    console.error("Error creating conversation:", conversationError);
    throw conversationError;
  }

  // Add current user as participant
  const { error: currentUserError } = await supabase
    .from("conversation_participants")
    .insert({
      conversation_id: conversation.id,
      user_id: userId
    });

  if (currentUserError) {
    console.error("Error adding current user as participant:", currentUserError);
    throw currentUserError;
  }

  // Add other user as participant
  const { error: otherUserError } = await supabase
    .from("conversation_participants")
    .insert({
      conversation_id: conversation.id,
      user_id: otherUserId
    });

  if (otherUserError) {
    console.error("Error adding other user as participant:", otherUserError);
    throw otherUserError;
  }

  return conversation.id;
}

// Get messages for a conversation
export async function getMessages(conversationId: string) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const { data: messages, error } = await supabase
    .from("messages")
    .select(`
      id,
      conversation_id,
      sender_id,
      message_type,
      content,
      media_url,
      media_type,
      media_duration,
      created_at,
      expires_at,
      is_read,
      profiles:sender_id (
        display_name,
        username,
        avatar_url
      )
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }

  // Mark messages as read
  const userId = session.session.user.id;
  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .eq("is_read", false);

  const transformedMessages = messages.map(message => ({
    ...message,
    sender: message.profiles
  }));

  return transformedMessages;
}

// Send a message
export async function sendMessage(conversationId: string, message: {
  message_type: 'text' | 'image' | 'voice';
  content?: string;
  media_url?: string;
  media_type?: string;
  media_duration?: number;
}) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Add message
  const { data: newMessage, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: userId,
      message_type: message.message_type,
      content: message.content,
      media_url: message.media_url,
      media_type: message.media_type,
      media_duration: message.media_duration
    })
    .select()
    .single();

  if (messageError) {
    console.error("Error sending message:", messageError);
    throw messageError;
  }

  // Update conversation's last message
  let lastMessageText = '';
  if (message.message_type === 'text' && message.content) {
    lastMessageText = message.content.length > 50 ? 
      message.content.substring(0, 50) + '...' : 
      message.content;
  } else if (message.message_type === 'image') {
    lastMessageText = '📷 Image';
  } else if (message.message_type === 'voice') {
    lastMessageText = '🎤 Voice message';
  }

  const { error: conversationError } = await supabase
    .from("conversations")
    .update({
      last_message_text: lastMessageText,
      last_message_at: new Date().toISOString(),
      last_message_by: userId
    })
    .eq("id", conversationId);

  if (conversationError) {
    console.error("Error updating conversation:", conversationError);
    // Don't throw here since the message was sent successfully
  }

  return newMessage;
}
