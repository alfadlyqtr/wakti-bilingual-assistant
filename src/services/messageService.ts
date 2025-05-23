
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_type: 'text' | 'image' | 'voice' | 'pdf';
  content?: string;
  media_url?: string;
  media_type?: string;
  voice_duration?: number;
  file_size?: number;
  created_at: string;
  is_read: boolean;
  sender?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
}

// Get messages between current user and a contact
export async function getMessages(contactId: string): Promise<DirectMessage[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;
  
  console.log("🔍 Fetching messages between:", { userId, contactId });

  // First, get all messages between these two users
  const { data: messagesData, error: messagesError } = await supabase
    .from("messages")
    .select(`
      id,
      sender_id,
      recipient_id,
      message_type,
      content,
      media_url,
      media_type,
      voice_duration,
      file_size,
      created_at,
      is_read
    `)
    .or(`and(sender_id.eq.${userId},recipient_id.eq.${contactId}),and(sender_id.eq.${contactId},recipient_id.eq.${userId})`)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("❌ Error fetching messages:", messagesError);
    throw messagesError;
  }

  console.log("📨 Raw messages from database:", messagesData?.length || 0, messagesData);

  if (!messagesData || messagesData.length === 0) {
    console.log("📭 No messages found");
    return [];
  }

  // Now get sender profiles for all unique sender IDs
  const senderIds = [...new Set(messagesData.map(msg => msg.sender_id))];
  console.log("👥 Fetching profiles for sender IDs:", senderIds);

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, username, avatar_url")
    .in("id", senderIds);

  if (profilesError) {
    console.error("❌ Error fetching profiles:", profilesError);
    // Continue without profiles rather than failing completely
  }

  console.log("👤 Fetched profiles:", profilesData);

  // Create a map of sender ID to profile
  const profilesMap = new Map();
  if (profilesData) {
    profilesData.forEach(profile => {
      profilesMap.set(profile.id, profile);
    });
  }

  // Combine messages with sender profiles
  const messagesWithProfiles = messagesData.map(message => {
    const senderProfile = profilesMap.get(message.sender_id);
    console.log(`📝 Message ${message.id}: sender=${message.sender_id}, profile=`, senderProfile);
    
    return {
      ...message,
      sender: senderProfile || {
        display_name: "Unknown User",
        username: "unknown",
        avatar_url: ""
      }
    };
  });

  console.log("✅ Final messages with profiles:", messagesWithProfiles.length, messagesWithProfiles);

  // Mark messages as read (only messages received by current user)
  try {
    await markAsRead(contactId);
  } catch (error) {
    console.error("⚠️ Error marking messages as read:", error);
  }

  return messagesWithProfiles;
}

// Get unread messages for notification indicator
export async function getUnreadMessages(contactId: string): Promise<number> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return 0;

  const userId = session.session.user.id;

  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("sender_id", contactId)
    .eq("recipient_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }

  return count || 0;
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

// Validate if users can message each other
async function validateCanMessage(recipientId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;
  
  try {
    const { data, error } = await supabase.rpc('can_users_message', {
      sender_id: userId,
      recipient_id: recipientId
    });

    if (error) {
      console.error("Error validating message permission:", error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error("Error in validateCanMessage:", error);
    return false;
  }
}

// Upload voice or PDF file
export async function uploadMessageAttachment(file: File, type: 'voice' | 'pdf'): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('message_attachments')
    .upload(fileName, file, {
      contentType: file.type,
      cacheControl: '3600'
    });

  if (error) {
    console.error("Error uploading file:", error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from('message_attachments')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// Send a message to a contact
export async function sendMessage(recipientId: string, messageData: {
  message_type: 'text' | 'image' | 'voice' | 'pdf';
  content?: string;
  media_url?: string;
  media_type?: string;
  voice_duration?: number;
  file_size?: number;
}): Promise<DirectMessage> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;
  
  console.log("📤 Sending message:", { recipientId, messageData, userId });
  
  const canMessage = await validateCanMessage(recipientId);
  if (!canMessage) {
    throw new Error("You cannot send messages to this user. Make sure you are both in each other's contact lists.");
  }
  
  const { data, error } = await supabase
    .from("messages")
    .insert({
      sender_id: userId,
      recipient_id: recipientId,
      message_type: messageData.message_type,
      content: messageData.content,
      media_url: messageData.media_url,
      media_type: messageData.media_type,
      voice_duration: messageData.voice_duration,
      file_size: messageData.file_size
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Error sending message:", error);
    throw error;
  }

  console.log("✅ Message sent successfully:", data);
  return data;
}

// Check if a contact is blocked
export async function getBlockStatus(contactId: string): Promise<{ isBlocked: boolean; isBlockedBy: boolean }> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;
  
  console.log("Checking block status between users:", { userId, contactId });
  
  try {
    // Check if current user has blocked the contact
    const { data: blockedByMe, error: error1 } = await supabase
      .from("contacts")
      .select("status")
      .eq("user_id", userId)
      .eq("contact_id", contactId)
      .single();
    
    if (error1 && error1.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
      console.error("Error checking if you blocked contact:", error1);
    }
    
    // Check if contact has blocked the current user
    const { data: blockedMe, error: error2 } = await supabase
      .from("contacts")
      .select("status")
      .eq("user_id", contactId)
      .eq("contact_id", userId)
      .single();
    
    if (error2 && error2.code !== 'PGRST116') {
      console.error("Error checking if contact blocked you:", error2);
    }
    
    const isBlocked = blockedByMe?.status === 'blocked';
    const isBlockedBy = blockedMe?.status === 'blocked';
    
    console.log("Block status results:", { isBlocked, isBlockedBy, blockedByMe, blockedMe });
    
    return { isBlocked, isBlockedBy };
  } catch (error) {
    console.error("Error in getBlockStatus:", error);
    // Default to not blocked in case of errors
    return { isBlocked: false, isBlockedBy: false };
  }
}

export const formatRecipient = (recipientData: any) => {
  if (!recipientData) return { displayName: "Unknown User", username: "unknown", avatarUrl: "" };

  const data = Array.isArray(recipientData) ? recipientData[0] : recipientData;
  
  if (!data) return { displayName: "Unknown User", username: "unknown", avatarUrl: "" };

  return {
    displayName: data?.display_name || data?.username || "Unknown User",
    username: data?.username || "unknown",
    avatarUrl: data?.avatar_url || ""
  };
};
