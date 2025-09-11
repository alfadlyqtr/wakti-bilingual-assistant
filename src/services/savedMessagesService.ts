import { supabase } from "@/integrations/supabase/client";

/**
 * Save a message
 */
export async function saveMessage(
  userId: string, 
  messageId: string, 
  conversationId: string
) {
  const { data, error } = await supabase
    .from('saved_messages')
    .insert({
      user_id: userId,
      message_id: messageId,
      conversation_id: conversationId
    });
    
  if (error) {
    console.error('Error saving message:', error);
    throw error;
  }
  
  return data;
}

/**
 * Unsave a message
 */
export async function unsaveMessage(
  userId: string, 
  messageId: string
) {
  const { error } = await supabase
    .from('saved_messages')
    .delete()
    .eq('user_id', userId)
    .eq('message_id', messageId);
    
  if (error) {
    console.error('Error unsaving message:', error);
    throw error;
  }
  
  return true;
}

/**
 * Check if a message is saved by the current user
 */
export async function isMessageSaved(
  userId: string, 
  messageId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('saved_messages')
    .select('id')
    .eq('user_id', userId)
    .eq('message_id', messageId)
    .maybeSingle();
    
  if (error) {
    console.error('Error checking saved status:', error);
    return false;
  }
  
  return !!data;
}

/**
 * Get all saved messages for a user
 */
export async function getSavedMessages(userId: string) {
  const { data, error } = await supabase
    .from('saved_messages')
    .select(`
      id,
      message_id,
      saved_at,
      conversation_id,
      messages (
        id,
        content,
        created_at,
        sender_id,
        message_type
      )
    `)
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching saved messages:', error);
    throw error;
  }
  
  return data;
}
