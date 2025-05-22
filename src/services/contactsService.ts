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

// Get all approved contacts for the current user
export async function getContacts() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Step 1: Get contact IDs from the contacts table
  const { data: rows, error: err1 } = await supabase
    .from('contacts')
    .select('contact_id')
    .eq('user_id', userId)
    .eq('status', 'approved');
  
  if (err1) {
    console.error("Error fetching contacts:", err1);
    throw err1;
  }

  const ids = rows.map(r => r.contact_id);
  if (!ids.length) return [];

  // Step 2: Get profiles for those IDs
  const { data: profiles, error: err2 } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', ids);
  
  if (err2) {
    console.error("Error fetching contact profiles:", err2);
    throw err2;
  }

  // Transform data to match expected format
  return profiles.map(profile => ({
    id: profile.id,
    contact_id: profile.id,
    profile: profile
  }));
}

// Get all pending contact requests for the current user
export async function getContactRequests() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Step 1: Get user IDs of people who sent requests
  const { data: rows, error: err1 } = await supabase
    .from('contacts')
    .select('id, user_id, created_at')
    .eq('contact_id', userId)
    .eq('status', 'pending');
  
  if (err1) {
    console.error("Error fetching contact requests:", err1);
    throw err1;
  }

  const requestIds = rows.map(r => r.id);
  const userIds = rows.map(r => r.user_id);
  const createdDates = rows.reduce((acc, row) => {
    acc[row.user_id] = row.created_at;
    acc[row.id] = row.id;
    return acc;
  }, {});
  
  if (!userIds.length) return [];

  // Step 2: Get profiles for those IDs
  const { data: profiles, error: err2 } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);
  
  if (err2) {
    console.error("Error fetching requestor profiles:", err2);
    throw err2;
  }

  // Transform data to match expected format
  return profiles.map(profile => {
    const requestId = Object.entries(createdDates).find(([id, userId]) => userId === profile.id)?.[0];
    return {
      id: requestId,
      user_id: profile.id,
      contact_id: userId,
      status: 'pending' as const,
      created_at: createdDates[profile.id],
      profiles: profile
    };
  });
}

// Get all blocked contacts for the current user
export async function getBlockedContacts() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Step 1: Get IDs of blocked contacts
  const { data: rows, error: err1 } = await supabase
    .from('contacts')
    .select('id, contact_id, created_at')
    .eq('user_id', userId)
    .eq('status', 'blocked');
  
  if (err1) {
    console.error("Error fetching blocked contacts:", err1);
    throw err1;
  }

  const ids = rows.map(r => r.contact_id);
  const contactInfo = rows.reduce((acc, row) => {
    acc[row.contact_id] = {
      id: row.id,
      created_at: row.created_at
    };
    return acc;
  }, {});
  
  if (!ids.length) return [];

  // Step 2: Get profiles for those IDs
  const { data: profiles, error: err2 } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', ids);
  
  if (err2) {
    console.error("Error fetching blocked profiles:", err2);
    throw err2;
  }

  // Transform data to match expected format
  return profiles.map(profile => ({
    id: contactInfo[profile.id].id,
    user_id: userId,
    contact_id: profile.id,
    status: 'blocked' as const,
    created_at: contactInfo[profile.id].created_at,
    profiles: profile
  }));
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

  // If auto-approve is enabled, insert as approved
  const status = recipientProfile.auto_approve_contacts === true ? "approved" : "pending";
  
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

  return data[0];
}

// Accept a contact request
export async function acceptContactRequest(requestId: string) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("contacts")
    .update({ status: "approved" })
    .eq("id", requestId)
    .select();

  if (error) {
    console.error("Error accepting contact request:", error);
    throw error;
  }

  return data[0];
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
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, auto_approve_contacts")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }

  return data;
}

// Get current user profile
export async function getCurrentUserProfile() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  return getUserProfile(session.session.user.id);
}

// Update user auto-approve contacts setting
export async function updateAutoApproveContacts(autoApprove: boolean) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  const { data, error } = await supabase
    .from("profiles")
    .update({ auto_approve_contacts: autoApprove })
    .eq("id", userId)
    .select("auto_approve_contacts");

  if (error) {
    console.error("Error updating auto-approve setting:", error);
    throw error;
  }

  return data[0];
}

// Delete a contact
export async function deleteContact(contactId: string): Promise<boolean> {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;
  
  // Find the contact record to delete
  const { data: contactRecord } = await supabase
    .from("contacts")
    .select("id")
    .eq("user_id", userId)
    .eq("contact_id", contactId)
    .eq("status", "approved")
    .limit(1);
  
  // If no contact record found, return false
  if (!contactRecord || contactRecord.length === 0) {
    console.error("Contact record not found for deletion");
    return false;
  }
  
  // Delete the contact record
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", contactRecord[0].id);

  if (error) {
    console.error("Error deleting contact:", error);
    throw error;
  }

  return true;
}
