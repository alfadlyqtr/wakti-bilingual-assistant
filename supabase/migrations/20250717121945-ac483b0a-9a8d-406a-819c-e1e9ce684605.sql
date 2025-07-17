
-- Update the trigger function to handle subtask completions properly
CREATE OR REPLACE FUNCTION public.trigger_tr_shared_response_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  task_title TEXT;
  subtask_title TEXT;
  task_owner_id UUID;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Get task details and owner from tr_tasks table
  SELECT title, user_id INTO task_title, task_owner_id
  FROM public.tr_tasks WHERE id = NEW.task_id;
  
  -- Only notify the task owner about responses
  IF task_owner_id IS NOT NULL THEN
    -- Handle different response types
    IF NEW.response_type = 'comment' THEN
      notification_title := 'New Comment on Shared Task';
      notification_body := COALESCE(NEW.visitor_name, 'Someone') || ' commented on: ' || task_title;
    ELSIF NEW.response_type = 'completion' AND NEW.is_completed = true THEN
      -- Check if this is a subtask completion or main task completion
      IF NEW.subtask_id IS NOT NULL THEN
        -- Get subtask title for subtask completions
        SELECT title INTO subtask_title
        FROM public.tr_subtasks WHERE id = NEW.subtask_id;
        
        notification_title := 'Shared Subtask Completed';
        notification_body := COALESCE(NEW.visitor_name, 'Someone') || ' completed subtask ''' || COALESCE(subtask_title, 'Unknown Subtask') || ''' in: ' || task_title;
      ELSE
        -- Main task completion
        notification_title := 'Shared Task Completed';
        notification_body := COALESCE(NEW.visitor_name, 'Someone') || ' completed: ' || task_title;
      END IF;
    ELSIF NEW.response_type = 'snooze_request' THEN
      notification_title := 'Snooze Request';
      notification_body := COALESCE(NEW.visitor_name, 'Someone') || ' requested to snooze: ' || task_title;
    ELSE
      -- Skip notification for other response types
      RETURN NEW;
    END IF;
    
    PERFORM public.queue_notification(
      task_owner_id,
      'shared_task',
      notification_title,
      notification_body,
      jsonb_build_object(
        'task_id', NEW.task_id,
        'response_id', NEW.id,
        'response_type', NEW.response_type,
        'visitor_name', NEW.visitor_name,
        'subtask_id', NEW.subtask_id,
        'subtask_title', subtask_title
      ),
      '/tr',
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;
