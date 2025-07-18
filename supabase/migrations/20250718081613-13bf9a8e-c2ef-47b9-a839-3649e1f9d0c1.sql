
-- Remove all database notification triggers
DROP TRIGGER IF EXISTS message_notification ON public.messages;
DROP TRIGGER IF EXISTS maw3d_rsvp_notification ON public.maw3d_rsvps;
DROP TRIGGER IF EXISTS contact_request_notification ON public.contacts;
DROP TRIGGER IF EXISTS shared_task_completion_notification ON public.shared_task_completions;
DROP TRIGGER IF EXISTS tr_shared_response_notification ON public.tr_shared_responses;
DROP TRIGGER IF EXISTS trigger_task_notifications ON public.tr_shared_responses;

-- Remove all database notification functions
DROP FUNCTION IF EXISTS public.trigger_message_notification();
DROP FUNCTION IF EXISTS public.trigger_maw3d_rsvp_notification();
DROP FUNCTION IF EXISTS public.trigger_contact_request_notification();
DROP FUNCTION IF EXISTS public.trigger_shared_task_completion_notification();
DROP FUNCTION IF EXISTS public.trigger_tr_shared_response_notification();
DROP FUNCTION IF EXISTS public.queue_notification(uuid, text, text, text, jsonb, text, timestamp with time zone);

-- Remove database notification tables
DROP TABLE IF EXISTS public.notification_queue;
DROP TABLE IF EXISTS public.notification_history;
DROP TABLE IF EXISTS public.user_push_subscriptions;

-- Remove notification preferences column from profiles (if it was added by me)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notification_preferences;

-- Log the cleanup
INSERT INTO public.audit_logs (
  action, table_name, record_id, user_id, details
) VALUES (
  'notification_system_cleanup', 'system', 'notification_restoration', '00000000-0000-0000-0000-000000000000',
  jsonb_build_object(
    'action_type', 'database_notification_removal',
    'restored_at', now(),
    'description', 'Removed all database notification infrastructure to restore frontend-only useUnreadMessages system'
  )
);
