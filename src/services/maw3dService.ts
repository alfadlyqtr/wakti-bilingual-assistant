import { supabase } from "@/integrations/supabase/client";
import { Maw3dEvent, Maw3dRsvp, Maw3dInvitation, CreateEventFormData } from "@/types/maw3d";

export class Maw3dService {
  // Events
  static async createEvent(eventData: Omit<CreateEventFormData, 'invited_contacts'> & { created_by: string }): Promise<Maw3dEvent> {
    console.log('Creating Maw3d event:', eventData);
    
    // Prepare the data for database insertion - exclude invited_contacts and fix time fields
    const dbEventData = {
      ...eventData,
      // Convert time fields to null for all-day events
      start_time: eventData.is_all_day ? null : eventData.start_time,
      end_time: eventData.is_all_day ? null : eventData.end_time,
    };
    
    // Remove any fields that don't belong in the database
    delete (dbEventData as any).invited_contacts;
    
    const { data, error } = await supabase
      .from('maw3d_events')
      .insert(dbEventData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating event:', error);
      throw error;
    }
    console.log('Event created successfully:', data);
    return data;
  }

  static async getEvent(id: string): Promise<Maw3dEvent | null> {
    console.log('Fetching Maw3d event by ID:', id);
    
    const { data, error } = await supabase
      .from('maw3d_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching event by ID:', error);
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    console.log('Event fetched by ID:', data);
    return data;
  }

  static async getEventByShortId(shortId: string): Promise<Maw3dEvent | null> {
    console.log('Fetching Maw3d event by short ID:', shortId);
    
    const { data, error } = await supabase
      .from('maw3d_events')
      .select('*')
      .eq('short_id', shortId)
      .single();

    if (error) {
      console.error('Error fetching event by short ID:', error);
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    console.log('Event fetched by short ID:', data);
    return data;
  }

  static async getUserEvents(): Promise<Maw3dEvent[]> {
    console.log('Fetching user Maw3d events');
    
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.log('No authenticated user found');
      return [];
    }

    console.log('Fetching events for user:', userData.user.id);

    // The RLS policies will automatically handle access control
    // This will return events where:
    // 1. User is the creator (maw3d_view_own_events)
    // 2. Event is public (maw3d_view_public_events) 
    // 3. User is invited (maw3d_view_invited_events)
    const { data: events, error } = await supabase
      .from('maw3d_events')
      .select('*')
      .order('event_date', { ascending: true });

    if (error) {
      console.error('Error fetching user events:', error);
      throw error;
    }

    console.log('Fetched Maw3d events:', events?.length || 0);
    return events || [];
  }

  static async updateEvent(id: string, updates: Partial<Maw3dEvent>): Promise<Maw3dEvent> {
    console.log('Updating Maw3d event:', id, updates);
    
    const { data, error } = await supabase
      .from('maw3d_events')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating event:', error);
      throw error;
    }
    console.log('Event updated successfully:', data);
    return data;
  }

  static async deleteEvent(id: string): Promise<void> {
    console.log('Deleting Maw3d event:', id);
    
    const { error } = await supabase
      .from('maw3d_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
    console.log('Event deleted successfully');
  }

  // RSVPs
  static async getRsvps(eventId: string): Promise<Maw3dRsvp[]> {
    console.log('=== FETCHING RSVPs ===');
    console.log('Event ID:', eventId);
    
    const { data, error } = await supabase
      .from('maw3d_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching RSVPs:', error);
      throw error;
    }
    
    console.log('Raw RSVP data from database:', data);
    console.log('Number of RSVPs found:', data?.length || 0);
    
    if (data && data.length > 0) {
      data.forEach((rsvp, index) => {
        console.log(`RSVP ${index + 1}:`, {
          id: rsvp.id,
          event_id: rsvp.event_id,
          user_id: rsvp.user_id,
          guest_name: rsvp.guest_name,
          response: rsvp.response,
          created_at: rsvp.created_at
        });
      });
    }
    
    return data || [];
  }

  static async createRsvp(eventId: string, response: 'accepted' | 'declined', guestName?: string): Promise<Maw3dRsvp> {
    console.log('=== CREATING RSVP ===');
    console.log('Event ID:', eventId);
    console.log('Response:', response);
    console.log('Guest Name:', guestName);
    
    const { data: userData } = await supabase.auth.getUser();
    console.log('Current user:', userData?.user?.id || 'No user');
    
    const rsvpData: any = {
      event_id: eventId,
      response,
    };

    if (userData?.user) {
      rsvpData.user_id = userData.user.id;
      console.log('Creating RSVP for authenticated user:', userData.user.id);
      
      // Use upsert with proper conflict resolution for authenticated users
      const { data, error } = await supabase
        .from('maw3d_rsvps')
        .upsert(rsvpData, {
          onConflict: 'event_id,user_id'
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating RSVP for user:', error);
        throw error;
      }
      
      console.log('RSVP created/updated successfully for user:', data);
      return data;
    } else if (guestName) {
      const trimmedName = guestName.trim();
      rsvpData.guest_name = trimmedName;
      console.log('Creating RSVP for guest:', trimmedName);
      
      // For guests, first check if name already exists (case-insensitive)
      const { data: existingRsvp } = await supabase
        .from('maw3d_rsvps')
        .select('*')
        .eq('event_id', eventId)
        .ilike('guest_name', trimmedName)
        .maybeSingle();
        
      if (existingRsvp) {
        console.error('Guest name already exists:', existingRsvp);
        throw new Error('Someone with this name has already responded to this event');
      }
      
      // Insert new guest RSVP
      const { data, error } = await supabase
        .from('maw3d_rsvps')
        .insert(rsvpData)
        .select('*')
        .single();

      if (error) {
        console.error('Error creating RSVP for guest:', error);
        // Handle unique constraint violation
        if (error.code === '23505') {
          throw new Error('Someone with this name has already responded to this event');
        }
        throw error;
      }
      
      console.log('RSVP created successfully for guest:', data);
      return data;
    } else {
      const errorMsg = 'Either user must be logged in or guest name must be provided';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }

  static async updateRsvp(eventId: string, response: 'accepted' | 'declined'): Promise<Maw3dRsvp> {
    console.log('Updating RSVP:', { eventId, response });
    
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Must be logged in to update RSVP');

    const { data, error } = await supabase
      .from('maw3d_rsvps')
      .update({ response })
      .eq('event_id', eventId)
      .eq('user_id', userData.user.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating RSVP:', error);
      throw error;
    }
    console.log('RSVP updated successfully:', data);
    return data;
  }

  // Invitations
  static async createInvitations(eventId: string, userIds: string[]): Promise<Maw3dInvitation[]> {
    console.log('Creating invitations:', { eventId, userIds });
    
    const invitations = userIds.map(userId => ({
      event_id: eventId,
      invited_user_id: userId
    }));

    const { data, error } = await supabase
      .from('maw3d_invitations')
      .insert(invitations)
      .select('*');

    if (error) {
      console.error('Error creating invitations:', error);
      throw error;
    }
    console.log('Invitations created successfully:', data?.length || 0);
    return data || [];
  }

  static async getEventInvitations(eventId: string): Promise<Maw3dInvitation[]> {
    console.log('Fetching invitations for event:', eventId);
    
    const { data, error } = await supabase
      .from('maw3d_invitations')
      .select('*')
      .eq('event_id', eventId);

    if (error) {
      console.error('Error fetching invitations:', error);
      throw error;
    }
    console.log('Fetched invitations:', data?.length || 0);
    return data || [];
  }

  // Generate AI background using Runware
  static async generateAIBackground(prompt: string): Promise<string> {
    try {
      console.log('Generating AI background with prompt:', prompt);
      
      const response = await fetch('https://api.runware.ai/v1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            taskType: "authentication",
            apiKey: process.env.RUNWARE_API_KEY
          },
          {
            taskType: "imageInference",
            taskUUID: crypto.randomUUID(),
            positivePrompt: prompt,
            width: 1024,
            height: 1024,
            numberResults: 1,
            model: "runware:100@1",
            outputFormat: "WEBP"
          }
        ])
      });

      const result = await response.json();
      
      if (result.data && result.data.length > 1) {
        console.log('AI background generated successfully');
        return result.data[1].imageURL;
      }
      
      throw new Error('Failed to generate AI background');
    } catch (error) {
      console.error('Error generating AI background:', error);
      throw error;
    }
  }
}
