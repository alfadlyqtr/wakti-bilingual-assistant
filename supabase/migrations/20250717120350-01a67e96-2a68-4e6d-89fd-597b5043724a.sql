
-- Comprehensive Notification System Fix
-- This migration will clean up all conflicting notification functions and triggers,
-- then recreate them properly to ensure a working notification system

-- 1. DROP ALL EXISTING NOTIFICATION TRIGGERS AND FUNCTIONS TO START CLEAN
DROP TRIGGER IF EXISTS message_notification ON public.messages;
DROP TRIGGER IF EXISTS maw3d_rsvp_notification ON public.maw3d_rsvps;
DROP TRIGGER IF EXISTS contact_request_notification ON public.contacts;
DROP TRIGGER IF EXISTS tr_shared_response_notification ON public.tr_shared_responses;
DROP TRIGGER IF EXISTS shared_task_completion_notification ON public.shared_task_completions;

-- Drop old conflicting functions
DROP FUNCTION IF EXISTS public.trigger_task_notification();
DROP FUNCTION IF EXISTS public.trigger_task_notifications();

-- 2. RECREATE ALL NOTIFICATION FUNCTIONS WITH PROPER LOGIC

-- Message notifications (receiver gets notified)
CREATE OR REPLACE FUNCTION public.trigger_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sender_name TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Get sender's display name (not email)
  SELECT COALESCE(
    NULLIF(display_name, email), -- If display_name is not the email, use it
    NULLIF(display_name, ''),    -- If display_name is not empty, use it
    username,                    -- Otherwise try username
    'Someone'                    -- Fallback to 'Someone'
  ) INTO sender_name
  FROM public.profiles WHERE id = NEW.sender_id;
  
  notification_title := 'New Message';
  notification_body := COALESCE(sender_name, 'Someone') || ' sent you a message';
  
  -- Notify the RECEIVER (not sender)
  PERFORM public.queue_notification(
    NEW.recipient_id,  -- Receiver gets the notification
    'messages',
    notification_title,
    notification_body,
    jsonb_build_object(
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'message_type', NEW.message_type
    ),
    '/contacts',
    now()
  );
  
  RETURN NEW;
END;
$function$;

-- Maw3d RSVP notifications (event creator gets notified)
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

-- Contact request notifications (contact receives notification)
CREATE OR REPLACE FUNCTION public.trigger_contact_request_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  requester_name TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Only notify on new pending requests
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Get requester's display name (not email)
    SELECT COALESCE(
      NULLIF(display_name, email), -- If display_name is not the email, use it
      NULLIF(display_name, ''),    -- If display_name is not empty, use it
      username,                    -- Otherwise try username
      'Someone'                    -- Fallback to 'Someone'
    ) INTO requester_name
    FROM public.profiles WHERE id = NEW.user_id;
    
    notification_title := 'New Contact Request';
    notification_body := COALESCE(requester_name, 'Someone') || ' wants to connect with you';
    
    -- Notify the CONTACT (person being requested)
    PERFORM public.queue_notification(
      NEW.contact_id,
      'contact_requests',
      notification_title,
      notification_body,
      jsonb_build_object(
        'contact_id', NEW.id,
        'requester_id', NEW.user_id
      ),
      '/contacts',
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Shared task completion notifications (task owner gets notified)
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

-- 3. CREATE ALL NOTIFICATION TRIGGERS

-- Messages trigger (notify receiver)
CREATE TRIGGER message_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trigger_message_notification();

-- Maw3d RSVP trigger (notify event creator)
CREATE TRIGGER maw3d_rsvp_notification
  AFTER INSERT ON public.maw3d_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.trigger_maw3d_rsvp_notification();

-- Contact request trigger (notify contact)
CREATE TRIGGER contact_request_notification
  AFTER INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_contact_request_notification();

-- Shared task completion trigger (notify task owner)
CREATE TRIGGER shared_task_completion_notification
  AFTER INSERT ON public.shared_task_completions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_shared_task_completion_notification();

-- Keep the existing TR shared responses trigger (already working)
-- This one is already active and working correctly

-- 4. FIX DISPLAY NAMES THAT ARE SET TO EMAIL ADDRESSES
-- Update profiles where display_name is exactly the same as email
UPDATE public.profiles 
SET display_name = COALESCE(
  CASE 
    WHEN first_name IS NOT NULL AND last_name IS NOT NULL 
    THEN first_name || ' ' || last_name
    WHEN first_name IS NOT NULL 
    THEN first_name
    WHEN username IS NOT NULL 
    THEN username
    ELSE 'WAKTI User'
  END
)
WHERE display_name = email OR display_name IS NULL OR display_name = '';

-- Log the cleanup
INSERT INTO public.audit_logs (
  action, table_name, record_id, user_id, details
) VALUES (
  'notification_system_fix', 'system', 'notification_cleanup', '00000000-0000-0000-0000-000000000000',
  jsonb_build_object(
    'action_type', 'comprehensive_notification_cleanup',
    'fixed_at', now(),
    'description', 'Cleaned up conflicting notification functions and triggers, recreated all missing triggers, fixed display names'
  )
);
