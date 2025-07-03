
import { supabase } from "@/integrations/supabase/client";
import { Maw3dEvent, Maw3dRsvp, CreateEventFormData } from "@/types/maw3d";

// Simple auth cache to avoid repeated getUser() calls
let authCache: { user: any; timestamp: number } | null = null;
const AUTH_CACHE_TTL = 60000; // 1 minute

export class Maw3dService {
  // Cached auth helper
  private static async getCachedUser() {
    const now = Date.now();
    
    if (authCache && (now - authCache.timestamp) < AUTH_CACHE_TTL) {
      return authCache.user;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError || !userData.user) {
      authCache = null;
      return null;
    }

    authCache = {
      user: userData.user,
      timestamp: now
    };

    return userData.user;
  }

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

    // Prepare the data for database insertion with enhanced time handling, language, auto_delete_enabled, and image_blur
    const dbEventData = {
      ...eventData,
      // Critical fix: Ensure time fields are properly handled for PostgreSQL
      start_time: eventData.is_all_day ? null : sanitizeTimeForDB(eventData.start_time),
      end_time: eventData.is_all_day ? null : sanitizeTimeForDB(eventData.end_time),
      language: eventData.language || 'en', // Default to English if not specified
      auto_delete_enabled: eventData.auto_delete_enabled !== undefined ? eventData.auto_delete_enabled : true, // Default to true
      image_blur: eventData.image_blur !== undefined ? eventData.image_blur : 0 // Default to 0
    };
    
    console.log('Prepared DB event data:', {
      ...dbEventData,
      start_time: dbEventData.start_time,
      end_time: dbEventData.end_time,
      is_all_day: dbEventData.is_all_day,
      language: dbEventData.language,
      auto_delete_enabled: dbEventData.auto_delete_enabled,
      image_blur: dbEventData.image_blur
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
    console.log('=== PHASE 1: DEBUG getEventByShortId ===');
    console.log('Input shortId:', shortId);
    console.log('Type of shortId:', typeof shortId);
    console.log('ShortId length:', shortId?.length);
    
    if (!shortId || typeof shortId !== 'string') {
      console.error('Invalid shortId provided:', shortId);
      throw new Error('Invalid shortId provided');
    }
    
    // Clean the shortId - remove maw3d_ prefix if present for database query
    const cleanShortId = shortId.startsWith('maw3d_') ? shortId : `maw3d_${shortId}`;
    
    console.log('Cleaned short ID for database query:', cleanShortId);
    
    try {
      console.log('Executing database query...');
      const startTime = performance.now();
      
      const { data, error } = await supabase
        .from('maw3d_events')
        .select('*')
        .eq('short_id', cleanShortId)
        .single();

      const endTime = performance.now();
      console.log(`Database query completed in ${endTime - startTime}ms`);

      if (error) {
        console.error('=== DATABASE QUERY ERROR ===');
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        if (error.code === 'PGRST116') {
          console.log('No event found with short ID:', cleanShortId);
          return null;
        }
        throw error;
      }
      
      console.log('=== PHASE 3: DATA VALIDATION ===');
      console.log('Raw event data received:', data);
      
      if (!data) {
        console.log('No data returned from database');
        return null;
      }
      
      // Validate required fields
      const requiredFields = ['id', 'title', 'event_date', 'created_by'];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        console.error('Missing required fields:', missingFields);
        throw new Error(`Event data is missing required fields: ${missingFields.join(', ')}`);
      }
      
      // Validate text_style field
      if (data.text_style && typeof data.text_style !== 'object') {
        console.warn('text_style is not an object, converting:', data.text_style);
        try {
          data.text_style = JSON.parse(data.text_style);
        } catch (e) {
          console.error('Failed to parse text_style:', e);
          data.text_style = {};
        }
      }
      
      console.log('=== EVENT VALIDATION SUCCESSFUL ===');
      console.log('Event title:', data.title);
      console.log('Event date:', data.event_date);
      console.log('Event language:', data.language);
      console.log('Text style:', data.text_style);
      
      return data;
    } catch (error) {
      console.error('=== UNEXPECTED ERROR IN getEventByShortId ===');
      console.error('Error:', error);
      throw error;
    }
  }

  static async getUserEvents(): Promise<Maw3dEvent[]> {
    console.log('⚡ FAST: Fetching user Maw3d events');
    
    const user = await this.getCachedUser();
    
    if (!user) {
      console.log('No authenticated user found');
      return [];
    }

    console.log('⚡ FAST: Fetching events for cached user:', user.id);

    // SINGLE OPTIMIZED QUERY: Only fetch events created by the current user
    const { data: events, error } = await supabase
      .from('maw3d_events')
      .select('*')
      .eq('created_by', user.id)
      .order('event_date', { ascending: true });

    if (error) {
      console.error('Error fetching user events:', error);
      throw error;
    }

    console.log('⚡ FAST: Fetched Maw3d events for user:', events?.length || 0);
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
      data.forEach((rsvp,  index) => {
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

  static async createRsvp(eventId: string, response: 'accepted' | 'declined', guestName: string, comment?: string): Promise<Maw3dRsvp> {
    console.log('=== CREATING GUEST RSVP ===');
    console.log('Event ID:', eventId);
    console.log('Response:', response);
    console.log('Guest Name:', guestName);
    console.log('Comment:', comment);
    
    // Guest name is required
    if (!guestName?.trim()) {
      const errorMsg = 'Guest name is required';
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const trimmedName = guestName.trim();
    const trimmedComment = comment?.trim() || null;
    
    // Check for duplicate names for this event
    const { data: existingRsvp } = await supabase
      .from('maw3d_rsvps')
      .select('id')
      .eq('event_id', eventId)
      .eq('guest_name', trimmedName)
      .single();

    if (existingRsvp) {
      throw new Error('Someone with this name has already responded to this event');
    }
    
    // Simple guest RSVP - no user_id needed
    const rsvpData = {
      event_id: eventId,
      response,
      guest_name: trimmedName,
      comment: trimmedComment,
      user_id: null // Always null for guest system
    };

    console.log('Creating RSVP for guest:', trimmedName);
    
    // Insert new guest RSVP
    const { data, error } = await supabase
      .from('maw3d_rsvps')
      .insert(rsvpData)
      .select('*')
      .single();

    if (error) {
      console.error('Error creating RSVP for guest:', error);
      throw error;
    }
    
    console.log('RSVP created successfully for guest:', data);
    return data;
  }

  // Generate AI background using the new simple edge function
  static async generateAIBackground(prompt: string): Promise<string> {
    try {
      console.log('🎨 Generating AI background using generate-maw3d-background with prompt:', prompt);
      
      // Get current user for authentication
      const user = await this.getCachedUser();
      
      if (!user) {
        throw new Error('User authentication required for AI background generation');
      }

      // Call the new simple edge function
      const { data, error } = await supabase.functions.invoke('generate-maw3d-background', {
        body: {
          prompt: prompt
        }
      });

      if (error) {
        console.error('Error calling generate-maw3d-background function:', error);
        throw new Error(`Failed to generate AI background: ${error.message}`);
      }

      console.log('🎨 Response from generate-maw3d-background:', data);

      if (!data.success) {
        console.error('Generation failed:', data.error);
        throw new Error(`AI background generation failed: ${data.error}`);
      }

      if (!data.imageUrl) {
        console.error('No image URL found in response:', data);
        throw new Error('No image URL returned from AI generation service');
      }

      console.log('🎨 AI background generated successfully:', data.imageUrl);
      return data.imageUrl;
    } catch (error) {
      console.error('Error generating AI background:', error);
      throw error;
    }
  }

  // Helper method to generate share URL for Maw3d events - RESTORED TO ORIGINAL FORMAT
  static getShareUrl(shortId: string): string {
    return `${window.location.origin}/maw3d/${shortId}`;
  }
}
