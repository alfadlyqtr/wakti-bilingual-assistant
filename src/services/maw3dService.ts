import { supabase } from "@/integrations/supabase/client";
import { Maw3dEvent, Maw3dRsvp, CreateEventFormData } from "@/types/maw3d";

export class Maw3dService {
  // Events
  static async createEvent(eventData: Omit<CreateEventFormData, 'invited_contacts'> & { created_by: string, language?: string }): Promise<Maw3dEvent> {
    console.log('=== CREATING MAW3D EVENT ===');
    console.log('Raw event data received:', eventData);
    
    // Additional time field sanitization for database compatibility
    const sanitizeTimeForDB = (timeValue: string | null): string | null => {
      if (!timeValue || timeValue.trim() === '' || timeValue === 'null' || timeValue === 'undefined') {
        console.log('Time value is empty/null, returning null');
        return null;
      }
      const trimmed = timeValue.trim();
      console.log('Time value sanitized:', trimmed);
      return trimmed;
    };

    // Prepare the data for database insertion with enhanced time handling, language, and auto_delete_enabled
    const dbEventData = {
      ...eventData,
      // Critical fix: Ensure time fields are properly handled for PostgreSQL
      start_time: eventData.is_all_day ? null : sanitizeTimeForDB(eventData.start_time),
      end_time: eventData.is_all_day ? null : sanitizeTimeForDB(eventData.end_time),
      language: eventData.language || 'en', // Default to English if not specified
      auto_delete_enabled: eventData.auto_delete_enabled !== undefined ? eventData.auto_delete_enabled : true // Default to true
    };
    
    console.log('Prepared DB event data:', {
      ...dbEventData,
      start_time: dbEventData.start_time,
      end_time: dbEventData.end_time,
      is_all_day: dbEventData.is_all_day,
      language: dbEventData.language,
      auto_delete_enabled: dbEventData.auto_delete_enabled
    });
    
    // Remove any fields that don't belong in the database
    delete (dbEventData as any).invited_contacts;
    
    const { data, error } = await supabase
      .from('maw3d_events')
      .insert(dbEventData)
      .select('*')
      .single();

    if (error) {
      console.error('=== DATABASE INSERT ERROR ===');
      console.error('Error creating event:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    console.log('=== EVENT CREATED SUCCESSFULLY ===');
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

    // CRITICAL FIX: Only fetch events created by the current user
    const { data: events, error } = await supabase
      .from('maw3d_events')
      .select('*')
      .eq('created_by', userData.user.id)  // Filter by current user's ID
      .order('event_date', { ascending: true });

    if (error) {
      console.error('Error fetching user events:', error);
      throw error;
    }

    console.log('Fetched Maw3d events for user:', events?.length || 0);
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

  // RSVPs - Simplified guest-only system
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
          guest_name: rsvp.guest_name,
          response: rsvp.response,
          created_at: rsvp.created_at
        });
      });
    }
    
    return data || [];
  }

  static async createRsvp(eventId: string, response: 'accepted' | 'declined', guestName: string): Promise<Maw3dRsvp> {
    console.log('=== CREATING GUEST RSVP ===');
    console.log('Event ID:', eventId);
    console.log('Response:', response);
    console.log('Guest Name:', guestName);
    
    // Guest name is required
    if (!guestName?.trim()) {
      const errorMsg = 'Guest name is required';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const trimmedName = guestName.trim();
    
    // Simple guest RSVP - no user_id needed
    const rsvpData = {
      event_id: eventId,
      response,
      guest_name: trimmedName,
      user_id: null // Always null for guest system
    };

    console.log('Creating RSVP for guest:', trimmedName);
    
    // Insert new guest RSVP - the unique constraint will prevent duplicates
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

  // Helper method to generate share URL for Maw3d events
  static getShareUrl(shortId: string): string {
    return `${window.location.origin}/maw3d/${shortId}`;
  }
}
