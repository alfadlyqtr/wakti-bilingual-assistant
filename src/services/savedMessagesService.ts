import { supabase } from "@/integrations/supabase/client";

/**
 * Save a message by updating the is_saved flag
 */
export async function saveMessage(
  userId: string, 
  messageId: string, 
  conversationId: string
) {
  const { data, error } = await supabase
    .from('messages')
    .update({ is_saved: true })
    .eq('id', messageId)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`); // Ensure user owns or received the message
    
  if (error) {
    console.error('Error saving message:', error);
    throw error;
  }
  
  return data;
}

/**
 * Unsave a message by updating the is_saved flag
 */
export async function unsaveMessage(
  userId: string, 
  messageId: string
) {
  const { error } = await supabase
    .from('messages')
    .update({ is_saved: false })
    .eq('id', messageId)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`); // Ensure user owns or received the message
    
  if (error) {
    console.error('Error unsaving message:', error);
    throw error;
  }
  
  return true;
}

/**
 * Check if a message is saved by checking the is_saved flag
 */
export async function isMessageSaved(
  userId: string, 
  messageId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('messages')
    .select('is_saved')
    .eq('id', messageId)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .maybeSingle();
    
  if (error) {
    console.error('Error checking saved status:', error);
    return false;
  }
  
  return data?.is_saved || false;
}

/**
 * Get all saved messages for a user
 */
export async function getSavedMessages(userId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('is_saved', true)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching saved messages:', error);
    throw error;
  }
  
  return data;
}
