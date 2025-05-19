
import { supabase } from "@/integrations/supabase/client";

export interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  status: 'pending' | 'approved' | 'blocked';
  created_at: string;
  updated_at: string;
  profile?: {
    display_name: string;
    username: string;
    avatar_url?: string;
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
  };
}

// Get all approved contacts for the current user
export async function getContacts() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Get contacts where current user is either the requester or the recipient
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select(`
      id,
      user_id,
      contact_id,
      status,
      created_at,
      profiles!contacts_contact_id_fkey (
        display_name,
        username,
        avatar_url
      )
    `)
    .or(`user_id.eq.${userId},contact_id.eq.${userId}`)
    .eq("status", "approved");

  if (error) {
    console.error("Error fetching contacts:", error);
    throw error;
  }

  // Transform data to normalize the contact structure
  return contacts.map((contact) => {
    // If current user is the contact_id, then the other user is user_id
    const isCurrentUserContact = contact.contact_id === userId;
    const contactId = isCurrentUserContact ? contact.user_id : contact.contact_id;
    
    // We need to fetch profile for the other user
    return {
      ...contact,
      contact_id: contactId,
      profile: contact.profiles
    };
  });
}

// Get all pending contact requests for the current user
export async function getContactRequests() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Only get requests where current user is the recipient
  const { data: requests, error } = await supabase
    .from("contacts")
    .select(`
      id,
      user_id,
      contact_id,
      status,
      created_at,
      profiles!contacts_user_id_fkey (
        display_name,
        username,
        avatar_url
      )
    `)
    .eq("contact_id", userId)
    .eq("status", "pending");

  if (error) {
    console.error("Error fetching contact requests:", error);
    throw error;
  }

  return requests;
}

// Get all blocked contacts for the current user
export async function getBlockedContacts() {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  // Only get contacts where current user is the blocker
  const { data: blocked, error } = await supabase
    .from("contacts")
    .select(`
      id,
      user_id,
      contact_id,
      status,
      created_at,
      profiles!contacts_contact_id_fkey (
        display_name,
        username,
        avatar_url
      )
    `)
    .eq("user_id", userId)
    .eq("status", "blocked");

  if (error) {
    console.error("Error fetching blocked contacts:", error);
    throw error;
  }

  return blocked;
}

// Search for users to add as contacts
export async function searchUsers(query: string) {
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
      avatar_url
    `)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .neq('id', userId)
    .limit(10);

  if (error) {
    console.error("Error searching users:", error);
    throw error;
  }

  return users;
}

// Send a contact request
export async function sendContactRequest(contactId: string) {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) {
    throw new Error("User not authenticated");
  }

  const userId = session.session.user.id;

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      contact_id: contactId,
      status: "pending"
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
    .select("id, username, display_name, avatar_url")
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
