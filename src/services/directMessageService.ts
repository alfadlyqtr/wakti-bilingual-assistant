
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

export interface Contact {
  id: string;
  contact_id: string;
  profile?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  };
  last_message?: DirectMessage;
  unread_count?: number;
}

// Get all contacts with their latest message
export async function getContactsWithMessages(): Promise<Contact[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Get all approved contacts
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select(`
      id,
      contact_id,
      profiles:contact_id (
        display_name,
        username,
        avatar_url
      )
    `)
    .eq("user_id", userId)
    .eq("status", "approved");

  if (error) {
    console.error("Error fetching contacts:", error);
    throw error;
  }

  // For each contact, get the latest message (if any)
  const contactsWithLastMessage = await Promise.all(
    contacts.map(async (contact) => {
      // Get latest message between current user and this contact
      const { data: latestMessage } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${userId},recipient_id.eq.${contact.contact_id}),and(sender_id.eq.${contact.contact_id},recipient_id.eq.${userId})`)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Get unread count
      const { count: unreadCount, error: countError } = await supabase
        .from("direct_messages")
        .select("id", { count: 'exact', head: true })
        .eq("recipient_id", userId)
        .eq("sender_id", contact.contact_id)
        .eq("is_read", false);

      if (countError) {
        console.error("Error counting unread messages:", countError);
      }

      return {
        ...contact,
        last_message: latestMessage || null,
        unread_count: unreadCount || 0
      } as Contact;
    })
  );

  return contactsWithLastMessage;
}

// Search contacts by name or username
export async function searchContacts(query: string): Promise<Contact[]> {
  const contacts = await getContactsWithMessages();
  
  if (!query) return contacts;
  
  const lowerCaseQuery = query.toLowerCase();
  
  return contacts.filter(contact => {
    const profile = contact.profile || {};
    const displayName = profile.display_name || "";
    const username = profile.username || "";
    
    return displayName.toLowerCase().includes(lowerCaseQuery) || 
           username.toLowerCase().includes(lowerCaseQuery) ||
           (contact.last_message?.content && 
            contact.last_message.content.toLowerCase().includes(lowerCaseQuery));
  });
}

// Get messages between current user and another user
export async function getMessagesWithContact(contactId: string): Promise<DirectMessage[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Get messages between current user and contact
  const { data, error } = await supabase
    .from("direct_messages")
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
      profiles:sender_id (
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
  await markMessagesAsRead(contactId);

  // Transform the data to match our DirectMessage interface
  const transformedMessages: DirectMessage[] = data.map(message => {
    // Fix: The profiles field is an object, not an array
    return {
      ...message,
      sender: message.profiles ? {
        display_name: message.profiles.display_name,
        username: message.profiles.username,
        avatar_url: message.profiles.avatar_url
      } : undefined
    };
  });

  return transformedMessages;
}

// Mark messages as read
export async function markMessagesAsRead(senderId: string): Promise<void> {
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

  // Send message
  const { data, error } = await supabase
    .from("direct_messages")
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
