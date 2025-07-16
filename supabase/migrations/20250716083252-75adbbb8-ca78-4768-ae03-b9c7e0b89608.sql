
-- Add missing notification triggers for shared_task_completions table
CREATE OR REPLACE FUNCTION public.trigger_shared_task_completion_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  task_title TEXT;
  task_owner_id UUID;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Get task details and owner
  SELECT title, user_id INTO task_title, task_owner_id
  FROM public.my_tasks WHERE id = NEW.task_id;
  
  -- Only notify the task owner about completion
  IF task_owner_id IS NOT NULL THEN
    notification_title := 'Shared Task Update';
    notification_body := COALESCE(NEW.completed_by_name, 'Someone') || ' completed: ' || task_title;
    
    PERFORM public.queue_notification(
      task_owner_id,
      'shared_task',
      notification_title,
      notification_body,
      jsonb_build_object(
        'task_id', NEW.task_id,
        'completion_id', NEW.id,
        'completed_by', NEW.completed_by_name,
        'completion_type', NEW.completion_type
      ),
      '/tr',
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for shared_task_completions
DROP TRIGGER IF EXISTS shared_task_completion_notification ON public.shared_task_completions;
CREATE TRIGGER shared_task_completion_notification
  AFTER INSERT ON public.shared_task_completions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_shared_task_completion_notification();

-- Add missing notification triggers for maw3d_rsvps table
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
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for maw3d_rsvps
DROP TRIGGER IF EXISTS maw3d_rsvp_notification ON public.maw3d_rsvps;
CREATE TRIGGER maw3d_rsvp_notification
  AFTER INSERT ON public.maw3d_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.trigger_maw3d_rsvp_notification();

-- Remove obsolete tr_shared_responses trigger if it exists
DROP TRIGGER IF EXISTS tr_shared_response_notification ON public.tr_shared_responses;
DROP FUNCTION IF EXISTS public.trigger_tr_shared_response_notification();
