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
    console.log('Fetching RSVPs for event:', eventId);
    
    const { data, error } = await supabase
      .from('maw3d_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching RSVPs:', error);
      throw error;
    }
    console.log('Fetched RSVPs:', data?.length || 0);
    return data || [];
  }

  static async createRsvp(eventId: string, response: 'accepted' | 'declined', guestName?: string): Promise<Maw3dRsvp> {
    console.log('Creating RSVP:', { eventId, response, guestName });
    
    const { data: userData } = await supabase.auth.getUser();
    
    const rsvpData: any = {
      event_id: eventId,
      response,
    };

    if (userData?.user) {
      rsvpData.user_id = userData.user.id;
    } else if (guestName) {
      rsvpData.guest_name = guestName;
    } else {
      throw new Error('Either user must be logged in or guest name must be provided');
    }

    const { data, error } = await supabase
      .from('maw3d_rsvps')
      .upsert(rsvpData, {
        onConflict: userData?.user ? 'event_id,user_id' : 'event_id,guest_name'
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating RSVP:', error);
      throw error;
    }
    console.log('RSVP created successfully:', data);
    return data;
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
