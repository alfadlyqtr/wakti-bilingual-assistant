import { supabase } from "@/integrations/supabase/client";

export interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  status: 'pending' | 'approved' | 'blocked';
  created_at: string;
  updated_at: string;
  profiles?: {
    display_name: string;
    username: string;
    avatar_url?: string;
    email?: string;
  };
  is_favorite: boolean;
}

export interface ContactRequest {
  id: string;
  user_id: string;
  contact_id: string;
  status: 'pending';
  created_at: string;
  profile?: {
    display_name: string;
    username: string;
    avatar_url?: string;
    email?: string;
  };
}

export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  email?: string;
}

// Optimized single-query approach for getting contacts with relationship status
export async function getContacts() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;
  
  // Single optimized query using JOINs and aggregation
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select(`
      id,
      user_id,
      contact_id,
      is_favorite,
      profiles:contact_id(
        id, 
        username, 
        display_name, 
        avatar_url
      ),
      reciprocal_contacts:contacts!contacts_contact_id_fkey(
        user_id,
        status
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'approved');

  if (error) {
    console.error("Error fetching contacts:", error);
    throw error;
  }

  // Process relationship status efficiently
  const results = contacts?.map(contact => {
    let relationship: "mutual" | "you-added-them" | "they-added-you" = "you-added-them";
    
    // Check if there's a reciprocal approved contact relationship
    const reciprocalContact = contact.reciprocal_contacts?.find(
      (rc: any) => rc.user_id === contact.contact_id && rc.status === 'approved'
    );
    
    if (reciprocalContact) {
      relationship = "mutual";
    }

    return {
      id: contact.id,
      contact_id: contact.contact_id,
      is_favorite: contact.is_favorite,
      profile: contact.profiles,
      relationshipStatus: relationship,
    };
  }) || [];

  return results;
}

// Optimized batch function to get unread message counts for all contacts
export async function getBatchUnreadCounts(contactIds: string[]) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session || !contactIds.length) {
    return {};
  }

  const userId = session.session.user.id;

  // Single query to get all unread counts at once
  const { data: unreadCounts, error } = await supabase
    .from("messages")
    .select("sender_id")
    .eq("recipient_id", userId)
    .eq("is_read", false)
    .in("sender_id", contactIds);

  if (error) {
    console.error("Error fetching unread counts:", error);
    return {};
  }

  // Group by sender_id to count unread messages per contact
  const counts: Record<string, number> = {};
  unreadCounts?.forEach(msg => {
    counts[msg.sender_id] = (counts[msg.sender_id] || 0) + 1;
  });

  return counts;
}

// Get all pending contact requests for the current user
export async function getContactRequests() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Optimized single query with JOIN
  const { data: requests, error } = await supabase
    .from('contacts')
    .select(`
      id, 
      user_id, 
      created_at,
      profiles:user_id(
        id, 
        username, 
        display_name, 
        avatar_url
      )
    `)
    .eq('contact_id', userId)
    .eq('status', 'pending');
  
  if (error) {
    console.error("Error fetching contact requests:", error);
    throw error;
  }

  // Transform to expected format
  return requests?.map(request => ({
    id: request.id,
    user_id: request.user_id,
    contact_id: userId,
    status: 'pending' as const,
    created_at: request.created_at,
    profiles: request.profiles
  })) || [];
}

// Get all blocked contacts for the current user
export async function getBlockedContacts() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Optimized single query with JOIN
  const { data: blocked, error } = await supabase
    .from('contacts')
    .select(`
      id, 
      contact_id, 
      created_at,
      profiles:contact_id(
        id, 
        username, 
        display_name, 
        avatar_url
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'blocked');
  
  if (error) {
    console.error("Error fetching blocked contacts:", error);
    throw error;
  }

  // Transform to expected format
  return blocked?.map(contact => ({
    id: contact.id,
    user_id: userId,
    contact_id: contact.contact_id,
    status: 'blocked' as const,
    created_at: contact.created_at,
    profiles: contact.profiles
  })) || [];
}

// Search for users to add as contacts
export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Search by username, display_name or email
  const { data: users, error } = await supabase
    .from("profiles")
    .select(`
      id,
      username,
      display_name,
      avatar_url,
      email
    `)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%,email.ilike.%${query}%`)
    .neq('id', userId)
    .limit(10);

  if (error) {
    console.error("Error searching users:", error);
    throw error;
  }

  return users;
}

// Check if a user is already in contacts
export async function checkIfUserInContacts(userId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const currentUserId = session.session.user.id;
  
  // Check if this user is already in the contacts list with any status
  const { data, error } = await supabase
    .from("contacts")
    .select("id, status")
    .eq("user_id", currentUserId)
    .eq("contact_id", userId)
    .limit(1);
    
  if (error) {
    console.error("Error checking contact status:", error);
    throw error;
  }
  
  // Return true if a contact entry exists and it's not blocked
  return data && data.length > 0 && data[0].status !== 'blocked';
}

// Send a contact request
export async function sendContactRequest(contactId: string) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;
  
  // First check if contact already exists
  const { data: existingContact, error: checkError } = await supabase
    .from("contacts")
    .select("id, status")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .limit(1);

  if (checkError) {
    console.error("Error checking existing contact:", checkError);
    throw checkError;
  }

  // If contact exists and is not blocked, return it
  if (existingContact && existingContact.length > 0 && existingContact[0].status !== 'blocked') {
    console.log("Contact already exists:", existingContact[0]);
    return existingContact[0];
  }

  try {
    // Check if recipient has auto-approve enabled
    const { data: recipientProfile, error: profileError } = await supabase
      .from("profiles")
      .select("auto_approve_contacts")
      .eq("id", contactId)
      .single();

    if (profileError) {
      console.error("Error checking recipient auto-approve settings:", profileError);
      throw profileError;
    }

    console.log("Recipient auto-approve setting:", recipientProfile.auto_approve_contacts);
    
    // If auto-approve is enabled, insert as approved
    const status = recipientProfile.auto_approve_contacts === true ? "approved" : "pending";
    console.log("Setting contact request status to:", status);
    
    // If contact exists but is blocked, update it instead of inserting
    if (existingContact && existingContact.length > 0) {
      const { data, error } = await supabase
        .from("contacts")
        .update({ status: status })
        .eq("id", existingContact[0].id)
        .select();

      if (error) {
        console.error("Error updating contact status:", error);
        throw error;
      }

      return data[0];
    }

    // Otherwise, insert a new contact
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        user_id: userId,
        contact_id: contactId,
        status: status
      })
      .select();

    if (error) {
      console.error("Error sending contact request:", error);
      throw error;
    }

    console.log("Contact request created with status:", status);
    return data[0];
  } catch (error) {
    console.error("Error in sendContactRequest:", error);
    throw error;
  }
}

// Accept a contact request and ensure bi-directional relationship
export async function acceptContactRequest(requestId: string): Promise<{ original: any, reciprocal: any }> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const currentUserId = session.session.user.id;

  // First, get the request details to identify the requester
  const { data: requestData, error: requestError } = await supabase
    .from("contacts")
    .select("user_id, contact_id")
    .eq("id", requestId)
    .single();

  if (requestError) {
    console.error("Error getting contact request details:", requestError);
    throw requestError;
  }

  // Ensure we're the recipient of this request
  if (requestData.contact_id !== currentUserId) {
    throw new Error("Cannot accept a request that wasn't sent to you");
  }

  const requesterId = requestData.user_id;

  // Update the original request to 'approved'
  const { data: originalRequest, error } = await supabase
    .from("contacts")
    .update({ status: "approved" })
    .eq("id", requestId)
    .select();

  if (error) {
    console.error("Error accepting contact request:", error);
    throw error;
  }

  // CRITICAL: Create bi-directional relationship
  // Check if we already have a reciprocal record for this relationship
  const { data: existingReciprocal } = await supabase
    .from("contacts")
    .select("id, status")
    .eq("user_id", currentUserId)
    .eq("contact_id", requesterId)
    .maybeSingle();

  let reciprocalRecord;
  
  if (existingReciprocal) {
    // Update existing reciprocal record to 'approved' if it's not already
    if (existingReciprocal.status !== 'approved') {
      const { data, error: updateError } = await supabase
        .from("contacts")
        .update({ status: "approved" })
        .eq("id", existingReciprocal.id)
        .select();
        
      if (updateError) {
        console.error("Error updating reciprocal contact:", updateError);
        throw updateError;
      }
      reciprocalRecord = data[0];
    } else {
      reciprocalRecord = existingReciprocal;
    }
  } else {
    // Create a new reciprocal record - THIS IS ESSENTIAL FOR BI-DIRECTIONAL MESSAGING
    const { data, error: insertError } = await supabase
      .from("contacts")
      .insert({
        user_id: currentUserId,
        contact_id: requesterId,
        status: "approved"
      })
      .select();
      
    if (insertError) {
      console.error("Error creating reciprocal contact:", insertError);
      throw insertError;
    }
    reciprocalRecord = data[0];
  }

  console.log("Bi-directional contact relationship established:", {
    original: originalRequest[0],
    reciprocal: reciprocalRecord
  });

  return { 
    original: originalRequest[0],
    reciprocal: reciprocalRecord
  };
}

// Reject a contact request
export async function rejectContactRequest(requestId: string) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", requestId);

  if (error) {
    console.error("Error rejecting contact request:", error);
    throw error;
  }

  return true;
}

// Block a contact
export async function blockContact(contactId: string) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // First check if contact exists
  const { data: existingContact, error: checkError } = await supabase
    .from("contacts")
    .select("id, user_id, contact_id, status")
    .or(`and(user_id.eq.${userId},contact_id.eq.${contactId}),and(user_id.eq.${contactId},contact_id.eq.${userId})`)
    .limit(1);

  if (checkError) {
    console.error("Error checking existing contact:", checkError);
    throw checkError;
  }

  // If contact exists, update or delete it
  if (existingContact && existingContact.length > 0) {
    const contact = existingContact[0];
    
    if (contact.user_id === userId) {
      // Current user is already the requester, update status
      const { data, error } = await supabase
        .from("contacts")
        .update({ status: "blocked" })
        .eq("id", contact.id)
        .select();

      if (error) {
        console.error("Error blocking contact:", error);
        throw error;
      }
      
      return data[0];
    } else {
      // Current user is the recipient, delete and create new blocked contact
      await supabase.from("contacts").delete().eq("id", contact.id);
    }
  }

  // Create a new blocked contact
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      contact_id: contactId,
      status: "blocked"
    })
    .select();

  if (error) {
    console.error("Error blocking contact:", error);
    throw error;
  }

  return data[0];
}

// Unblock a contact
export async function unblockContact(contactId: string) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Get the contact record before deleting it (for logging)
  const { data: contactRecord } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .eq("status", "blocked")
    .limit(1);

  console.log("Unblocking contact record:", contactRecord);

  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .eq("status", "blocked");

  if (error) {
    console.error("Error unblocking contact:", error);
    throw error;
  }

  return true;
}

// Get user profile by ID
export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, auto_approve_contacts")
      .eq("id", userId)
      .maybeSingle(); // Changed from single() to maybeSingle() to avoid errors

    if (error) {
      console.error("Error getting user profile:", error);
      throw error;
    }

    if (!data) {
      console.log("No profile found for user ID:", userId);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getUserProfile:", error);
    throw error;
  }
}

// Get current user profile
export async function getCurrentUserProfile() {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw new Error("User not authenticated");
    }

    return getUserProfile(session.session.user.id);
  } catch (error) {
    console.error("Error in getCurrentUserProfile:", error);
    throw error;
  }
}

// Update user auto-approve contacts setting
export async function updateAutoApproveContacts(autoApprove: boolean) {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      throw new Error("User not authenticated");
    }

    const userId = session.session.user.id;
    console.log("Updating auto-approve setting to:", autoApprove);

    const { data, error } = await supabase
      .from("profiles")
      .update({ auto_approve_contacts: autoApprove })
      .eq("id", userId)
      .select("auto_approve_contacts");

    if (error) {
      console.error("Error updating auto-approve setting:", error);
      throw error;
    }

    console.log("Auto-approve setting updated successfully:", data);
    return data[0];
  } catch (error) {
    console.error("Error in updateAutoApproveContacts:", error);
    throw error;
  }
}

// Delete a contact
export async function deleteContact(contactId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }
  
  console.log('Deleting contact with ID:', contactId);
  
  // Delete the contact record directly using its ID
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactId);

  if (error) {
    console.error("Error deleting contact:", error);
    throw error;
  }

  return true;
}

// Check if a user is blocked
export async function isUserBlocked(userId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const currentUserId = session.session.user.id;
  
  // Check if the current user has blocked this user
  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", currentUserId)
    .eq("contact_id", userId)
    .eq("status", "blocked")
    .limit(1);

  if (error) {
    console.error("Error checking if user is blocked:", error);
    throw error;
  }
  
  return data && data.length > 0;
}

// Check if current user is blocked by another user
export async function isBlockedByUser(userId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const currentUserId = session.session.user.id;
  
  // Check if this user has blocked the current user
  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("contact_id", currentUserId)
    .eq("status", "blocked")
    .limit(1);

  if (error) {
    console.error("Error checking if blocked by user:", error);
    throw error;
  }
  
  return data && data.length > 0;
}

// Check both directions of blocking
export async function getBlockStatus(userId: string): Promise<{
  isBlocked: boolean;
  isBlockedBy: boolean;
}> {
  const [isBlocked, isBlockedBy] = await Promise.all([
    isUserBlocked(userId),
    isBlockedByUser(userId)
  ]);
  
  return { isBlocked, isBlockedBy };
}

/**
 * Toggle contact favorite
 * @param contactId The contact relationship row id (not the user id!)
 * @param isFav    New favorite state (true/false)
 */
export async function toggleContactFavorite(contactId: string, isFav: boolean) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from("contacts")
    .update({ is_favorite: isFav })
    .eq("id", contactId)
    .select();

  if (error) {
    console.error("Error toggling favorite:", error);
    throw error;
  }

  return data && data.length > 0 ? data[0] : null;
}
