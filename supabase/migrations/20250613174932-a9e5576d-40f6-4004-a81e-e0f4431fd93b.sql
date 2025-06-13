
-- Create table for storing user push subscriptions
CREATE TABLE public.user_push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  progressier_user_id TEXT,
  subscription_data JSONB,
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for notification queue
CREATE TABLE public.notification_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  deep_link TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create table for notification history
CREATE TABLE public.notification_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  deep_link TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  progressier_response JSONB,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add notification preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN notification_preferences JSONB DEFAULT '{
  "messages": true,
  "task_updates": true,
  "contact_requests": true,
  "event_rsvps": true,
  "calendar_reminders": true,
  "quiet_hours": {
    "enabled": false,
    "start": "22:00",
    "end": "08:00"
  }
}'::jsonb;

-- Enable RLS on new tables
ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_push_subscriptions
CREATE POLICY "Users can manage their own subscriptions" 
  ON public.user_push_subscriptions 
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for notification_queue
CREATE POLICY "Users can view their own notification queue" 
  ON public.notification_queue 
  FOR SELECT USING (auth.uid() = user_id);

-- RLS policies for notification_history
CREATE POLICY "Users can view their own notification history" 
  ON public.notification_history 
  FOR SELECT USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_user_push_subscriptions_user_id ON public.user_push_subscriptions(user_id);
CREATE INDEX idx_user_push_subscriptions_active ON public.user_push_subscriptions(user_id, is_active);
CREATE INDEX idx_notification_queue_user_status ON public.notification_queue(user_id, status);
CREATE INDEX idx_notification_queue_scheduled ON public.notification_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_notification_history_user_type ON public.notification_history(user_id, notification_type);

-- Create trigger for updated_at on user_push_subscriptions
CREATE TRIGGER update_user_push_subscriptions_updated_at
  BEFORE UPDATE ON public.user_push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to queue notifications
CREATE OR REPLACE FUNCTION public.queue_notification(
  p_user_id UUID,
  p_notification_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}',
  p_deep_link TEXT DEFAULT NULL,
  p_scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_id UUID;
BEGIN
  -- Check if user has notifications enabled for this type
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id 
    AND (notification_preferences->p_notification_type)::boolean IS NOT FALSE
  ) THEN
    INSERT INTO public.notification_queue (
      user_id,
      notification_type,
      title,
      body,
      data,
      deep_link,
      scheduled_for
    ) VALUES (
      p_user_id,
      p_notification_type,
      p_title,
      p_body,
      p_data,
      p_deep_link,
      p_scheduled_for
    ) RETURNING id INTO notification_id;
  END IF;
  
  RETURN notification_id;
END;
$$;

-- Function to trigger RSVP notifications
CREATE OR REPLACE FUNCTION public.trigger_rsvp_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_title TEXT;
  event_organizer UUID;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Get event details
  SELECT title, organizer_id INTO event_title, event_organizer
  FROM public.events WHERE id = NEW.event_id;
  
  -- Only notify organizer for new RSVPs
  IF TG_OP = 'INSERT' AND event_organizer IS NOT NULL THEN
    notification_title := 'New RSVP Response';
    notification_body := COALESCE(NEW.guest_name, 'Someone') || ' responded to your event: ' || event_title;
    
    PERFORM public.queue_notification(
      event_organizer,
      'event_rsvps',
      notification_title,
      notification_body,
      jsonb_build_object(
        'event_id', NEW.event_id,
        'rsvp_id', NEW.id,
        'response', NEW.response
      ),
      '/maw3d/manage/' || NEW.event_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to trigger message notifications
CREATE OR REPLACE FUNCTION public.trigger_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sender_name TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Get sender name
  SELECT display_name INTO sender_name
  FROM public.profiles WHERE id = NEW.sender_id;
  
  notification_title := 'New Message';
  notification_body := COALESCE(sender_name, 'Someone') || ' sent you a message';
  
  PERFORM public.queue_notification(
    NEW.recipient_id,
    'messages',
    notification_title,
    notification_body,
    jsonb_build_object(
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'message_type', NEW.message_type
    ),
    '/contacts'
  );
  
  RETURN NEW;
END;
$$;

-- Function to trigger contact request notifications
CREATE OR REPLACE FUNCTION public.trigger_contact_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  requester_name TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Only notify on new pending requests
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    -- Get requester name
    SELECT display_name INTO requester_name
    FROM public.profiles WHERE id = NEW.user_id;
    
    notification_title := 'New Contact Request';
    notification_body := COALESCE(requester_name, 'Someone') || ' wants to connect with you';
    
    PERFORM public.queue_notification(
      NEW.contact_id,
      'contact_requests',
      notification_title,
      notification_body,
      jsonb_build_object(
        'contact_id', NEW.id,
        'requester_id', NEW.user_id
      ),
      '/contacts'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to trigger task update notifications
CREATE OR REPLACE FUNCTION public.trigger_task_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  task_title TEXT;
  task_owner UUID;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- Get task details
  SELECT title, user_id INTO task_title, task_owner
  FROM public.tr_tasks WHERE id = NEW.task_id;
  
  -- Only notify task owner about shared task updates
  IF task_owner IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.response_type = 'completion' AND NEW.is_completed = true THEN
        notification_title := 'Task Completed';
        notification_body := NEW.visitor_name || ' completed: ' || task_title;
      ELSIF NEW.response_type = 'comment' THEN
        notification_title := 'New Comment';
        notification_body := NEW.visitor_name || ' commented on: ' || task_title;
      END IF;
      
      IF notification_title IS NOT NULL THEN
        PERFORM public.queue_notification(
          task_owner,
          'task_updates',
          notification_title,
          notification_body,
          jsonb_build_object(
            'task_id', NEW.task_id,
            'response_id', NEW.id,
            'response_type', NEW.response_type
          ),
          '/tr'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_rsvp_notifications
  AFTER INSERT ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.trigger_rsvp_notification();

CREATE TRIGGER trigger_message_notifications
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trigger_message_notification();

CREATE TRIGGER trigger_contact_notifications
  AFTER INSERT OR UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_contact_request_notification();

CREATE TRIGGER trigger_task_notifications
  AFTER INSERT ON public.tr_shared_responses
  FOR EACH ROW EXECUTE FUNCTION public.trigger_task_notification();
