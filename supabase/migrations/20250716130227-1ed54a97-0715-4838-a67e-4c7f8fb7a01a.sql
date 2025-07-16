
-- Fix the Maw3d RSVP notification trigger to properly queue notifications
-- The existing trigger might not be working correctly

-- First, check if the trigger exists and drop it if it does
DROP TRIGGER IF EXISTS maw3d_rsvp_notification ON public.maw3d_rsvps;

-- Recreate the trigger function with proper error handling
CREATE OR REPLACE FUNCTION public.trigger_maw3d_rsvp_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  event_title TEXT;
  event_creator_id UUID;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Get event details and creator
  SELECT title, created_by INTO event_title, event_creator_id
  FROM public.maw3d_events WHERE id = NEW.event_id;
  
  -- Only notify the event creator about new RSVPs (not their own)
  IF event_creator_id IS NOT NULL AND event_creator_id != NEW.user_id THEN
    notification_title := 'New RSVP Response';
    notification_body := NEW.guest_name || ' responded ' || NEW.response || ' to: ' || event_title;
    
    -- Queue the notification
    PERFORM public.queue_notification(
      event_creator_id,
      'event',
      notification_title,
      notification_body,
      jsonb_build_object(
        'event_id', NEW.event_id,
        'rsvp_id', NEW.id,
        'response', NEW.response,
        'guest_name', NEW.guest_name
      ),
      '/maw3d',
      now()
    );
    
    -- Log for debugging
    RAISE NOTICE 'Maw3d RSVP notification queued for user % about event %', event_creator_id, event_title;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger
CREATE TRIGGER maw3d_rsvp_notification
  AFTER INSERT ON public.maw3d_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.trigger_maw3d_rsvp_notification();
