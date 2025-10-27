import { supabase, ensurePassport, getCurrentUserId } from "@/integrations/supabase/client";

export class UserEventLinksService {
  // Add an event to user's calendar
  static async addEventToCalendar(eventId: string): Promise<void> {
    console.log('Adding event to user calendar:', eventId);
    
    await ensurePassport();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      throw new Error('User must be logged in to add events to calendar');
    }

    const { error } = await supabase
      .from('user_event_links')
      .insert({
        user_id: userId,
        event_id: eventId
      });

    if (error) {
      // Handle unique constraint violation gracefully
      if (error.code === '23505') {
        throw new Error('Event is already in your calendar');
      }
      console.error('Error adding event to calendar:', error);
      throw error;
    }
    
    console.log('Event added to user calendar successfully');
  }

  // Remove an event from user's calendar
  static async removeEventFromCalendar(eventId: string): Promise<void> {
    console.log('Removing event from user calendar:', eventId);
    
    await ensurePassport();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      throw new Error('User must be logged in');
    }

    const { error } = await supabase
      .from('user_event_links')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', eventId);

    if (error) {
      console.error('Error removing event from calendar:', error);
      throw error;
    }
    
    console.log('Event removed from user calendar successfully');
  }

  // Check if event is in user's calendar
  static async isEventInUserCalendar(eventId: string): Promise<boolean> {
    await ensurePassport();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return false;
    }

    const { data, error } = await supabase
      .from('user_event_links')
      .select('id')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (error) {
      console.error('Error checking if event is in calendar:', error);
      return false;
    }

    return !!data;
  }

  // Get user's linked events
  static async getUserLinkedEvents(): Promise<any[]> {
    await ensurePassport();
    const userId = await getCurrentUserId();
    
    if (!userId) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_event_links')
      .select(`
        *,
        maw3d_events:event_id (*)
      `)
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) {
      console.error('Error fetching user linked events:', error);
      return [];
    }

    return data || [];
  }
}
