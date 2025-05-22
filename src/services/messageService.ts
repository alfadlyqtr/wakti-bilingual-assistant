
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_type: 'text' | 'image';
  content?: string;
  media_url?: string;
  media_type?: string;
  created_at: string;
  is_read: boolean;
  sender?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

// Type for the sender field as returned by Supabase
interface SenderProfile {
  display_name?: string;
  username?: string;
  avatar_url?: string;
}

// Get messages between current user and a contact
export async function getMessages(contactId: string): Promise<DirectMessage[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Get messages between current user and contact using messages table
  const { data, error } = await supabase
    .from("messages")
    .select(`
      id,
      sender_id,
      recipient_id,
      message_type,
      content,
      media_url,
      media_type,
      created_at,
      is_read,
      sender:profiles!sender_id(
        display_name,
        username,
        avatar_url
      )
    `)
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${userId})`)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }

  // Mark messages as read
  await markAsRead(contactId);

  // Transform the data to match our DirectMessage interface
  const transformedMessages: DirectMessage[] = data.map(message => {
    // Properly extract sender data regardless of format
    const senderData = message.sender as SenderProfile;
    
    return {
      ...message,
      sender: senderData ? {
        display_name: senderData.display_name,
        username: senderData.username,
        avatar_url: senderData.avatar_url
      } : undefined
    };
  });

  return transformedMessages;
}

// Mark messages as read
export async function markAsRead(senderId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('mark_messages_as_read', {
      other_user_id: senderId
    });

    if (error) throw error;
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
}

// Send a message to a contact
export async function sendMessage(recipientId: string, messageData: {
  message_type: 'text' | 'image';
  content?: string;
  media_url?: string;
  media_type?: string;
}): Promise<DirectMessage> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;
  
  // Send message using messages table
  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_id: userId,
      recipient_id: recipientId,
      message_type: messageData.message_type,
      content: messageData.content,
      media_url: messageData.media_url,
      media_type: messageData.media_type
    })
    .select()
    .single();

  if (error) {
    console.error("Error sending message:", error);
    throw error;
  }

  return data;
}

// Check if a contact is blocked
export async function getBlockStatus(contactId: string): Promise<{ isBlocked: boolean; isBlockedBy: boolean }> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;
  
  // Check if current user has blocked the contact
  const { data: blockedByMe, error: error1 } = await supabase
    .from("contacts")
    .select("status")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .single();
  
  // Check if contact has blocked the current user
  const { data: blockedMe, error: error2 } = await supabase
    .from("contacts")
    .select("status")
    .eq("user_id", contactId)
    .eq("contact_id", userId)
    .single();
  
  const isBlocked = blockedByMe?.status === 'blocked';
  const isBlockedBy = blockedMe?.status === 'blocked';
  
  return { isBlocked, isBlockedBy };
}

export const formatRecipient = (recipientData: any) => {
  if (!recipientData) return { displayName: "Unknown User", username: "unknown", avatarUrl: "" };

  // Handle both array and object formats safely
  const data = Array.isArray(recipientData) ? recipientData[0] : recipientData;
  
  // Ensure data is not undefined before accessing properties
  if (!data) return { displayName: "Unknown User", username: "unknown", avatarUrl: "" };

  return {
    displayName: data?.display_name || data?.username || "Unknown User",
    username: data?.username || "unknown",
    avatarUrl: data?.avatar_url || ""
  };
};
