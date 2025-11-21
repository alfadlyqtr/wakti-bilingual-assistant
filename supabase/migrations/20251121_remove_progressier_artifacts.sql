-- Completely remove legacy Progressier notification infrastructure

-- Drop any queueing helper functions if they still exist
DROP FUNCTION IF EXISTS public.queue_notification(uuid, text, text, text, jsonb, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.queue_notification(uuid, text, text, text, jsonb, text);
DROP FUNCTION IF EXISTS public.queue_notification(uuid, text, text, text, jsonb);

-- Drop triggers that might still reference the notification queue
DROP TRIGGER IF EXISTS message_notification ON public.messages;
DROP TRIGGER IF EXISTS maw3d_rsvp_notification ON public.maw3d_rsvps;
DROP TRIGGER IF EXISTS contact_request_notification ON public.contacts;
DROP TRIGGER IF EXISTS shared_task_completion_notification ON public.shared_task_completions;
DROP TRIGGER IF EXISTS tr_shared_response_notification ON public.tr_shared_responses;
DROP TRIGGER IF EXISTS trigger_task_notifications ON public.tr_shared_responses;

-- Drop tables that stored Progressier-specific data
DROP TABLE IF EXISTS public.notification_queue;
DROP TABLE IF EXISTS public.notification_history;
DROP TABLE IF EXISTS public.user_push_subscriptions;
DROP TABLE IF EXISTS public.notification_preferences_audit;

-- Remove any leftover columns that referenced Progressier metadata
ALTER TABLE IF EXISTS public.profiles DROP COLUMN IF EXISTS notification_preferences;

-- Document removal for auditing purposes
INSERT INTO public.audit_logs (action, table_name, record_id, user_id, details)
VALUES (
  'progressier_removal',
  'system',
  'progressier_cleanup',
  '00000000-0000-0000-0000-000000000000',
  jsonb_build_object(
    'description', 'Removed all Progressier infrastructure (tables, triggers, functions, and columns)',
    'removed_at', now()
  )
)
ON CONFLICT DO NOTHING;
