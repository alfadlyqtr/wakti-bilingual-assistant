
import { supabase } from "@/integrations/supabase/client";
import { Maw3dEvent, Maw3dRsvp, Maw3dInvitation, CreateEventFormData } from "@/types/maw3d";

export class Maw3dService {
  // Events
  static async createEvent(eventData: Omit<CreateEventFormData, 'invited_contacts'> & { created_by: string }): Promise<Maw3dEvent> {
    const { data, error } = await supabase
      .from('maw3d_events')
      .insert(eventData)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  static async getEvent(id: string): Promise<Maw3dEvent | null> {
    const { data, error } = await supabase
      .from('maw3d_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  static async getEventByShortId(shortId: string): Promise<Maw3dEvent | null> {
    const { data, error } = await supabase
      .from('maw3d_events')
      .select('*')
      .eq('short_id', shortId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  static async getUserEvents(): Promise<Maw3dEvent[]> {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      console.log('No authenticated user found');
      return [];
    }

    // Get events where user is creator OR invited (through invitations table)
    const { data: createdEvents, error: createdError } = await supabase
      .from('maw3d_events')
      .select('*')
      .eq('created_by', userData.user.id);

    if (createdError) throw createdError;

    // Get events where user is invited
    const { data: invitations, error: invitationsError } = await supabase
      .from('maw3d_invitations')
      .select('event_id')
      .eq('invited_user_id', userData.user.id);

    if (invitationsError) throw invitationsError;

    const invitedEventIds = invitations?.map(inv => inv.event_id) || [];
    
    let invitedEvents: Maw3dEvent[] = [];
    if (invitedEventIds.length > 0) {
      const { data, error } = await supabase
        .from('maw3d_events')
        .select('*')
        .in('id', invitedEventIds);

      if (error) throw error;
      invitedEvents = data || [];
    }

    // Get public events (exclude user's own events)
    const { data: publicEvents, error: publicError } = await supabase
      .from('maw3d_events')
      .select('*')
      .eq('is_public', true)
      .neq('created_by', userData.user.id);

    if (publicError) throw publicError;

    // Combine all events and remove duplicates
    const allEvents = [...(createdEvents || []), ...invitedEvents, ...(publicEvents || [])];
    const uniqueEvents = allEvents.filter((event, index, self) => 
      index === self.findIndex(e => e.id === event.id)
    );

    return uniqueEvents.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }

  static async updateEvent(id: string, updates: Partial<Maw3dEvent>): Promise<Maw3dEvent> {
    const { data, error } = await supabase
      .from('maw3d_events')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase
      .from('maw3d_events')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // RSVPs
  static async getRsvps(eventId: string): Promise<Maw3dRsvp[]> {
    const { data, error } = await supabase
      .from('maw3d_rsvps')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async createRsvp(eventId: string, response: 'accepted' | 'declined', guestName?: string): Promise<Maw3dRsvp> {
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

    if (error) throw error;
    return data;
  }

  static async updateRsvp(eventId: string, response: 'accepted' | 'declined'): Promise<Maw3dRsvp> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) throw new Error('Must be logged in to update RSVP');

    const { data, error } = await supabase
      .from('maw3d_rsvps')
      .update({ response })
      .eq('event_id', eventId)
      .eq('user_id', userData.user.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  // Invitations
  static async createInvitations(eventId: string, userIds: string[]): Promise<Maw3dInvitation[]> {
    const invitations = userIds.map(userId => ({
      event_id: eventId,
      invited_user_id: userId
    }));

    const { data, error } = await supabase
      .from('maw3d_invitations')
      .insert(invitations)
      .select('*');

    if (error) throw error;
    return data || [];
  }

  static async getEventInvitations(eventId: string): Promise<Maw3dInvitation[]> {
    const { data, error } = await supabase
      .from('maw3d_invitations')
      .select('*')
      .eq('event_id', eventId);

    if (error) throw error;
    return data || [];
  }

  // Generate AI background using Runware
  static async generateAIBackground(prompt: string): Promise<string> {
    try {
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
        return result.data[1].imageURL;
      }
      
      throw new Error('Failed to generate AI background');
    } catch (error) {
      console.error('Error generating AI background:', error);
      throw error;
    }
  }
}
