
-- Update default notification preferences to include admin_gifts
UPDATE public.profiles
SET notification_preferences = jsonb_set(
  COALESCE(notification_preferences, '{}'),
  '{admin_gifts}',
  'true'
)
WHERE notification_preferences IS NULL 
   OR NOT (notification_preferences ? 'admin_gifts');

-- Update the handle_new_user function to include admin_gifts in default preferences
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    username, 
    display_name,
    email,
    first_name,
    last_name,
    settings,
    notification_preferences
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    '{
      "widgets": {
        "tasksWidget": true,
        "calendarWidget": true,
        "remindersWidget": true,
        "quoteWidget": true
      },
      "notifications": {
        "pushNotifications": true,
        "emailNotifications": false
      },
      "privacy": {
        "profileVisibility": true,
        "activityStatus": true
      },
      "quotes": {
        "category": "mixed",
        "frequency": "daily"
      }
    }'::jsonb,
    '{
      "messages": true, 
      "event_rsvps": true, 
      "quiet_hours": {"end": "08:00", "start": "22:00", "enabled": false}, 
      "task_updates": true, 
      "contact_requests": true, 
      "calendar_reminders": true,
      "admin_gifts": true
    }'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error details but don't block signup
  RAISE NOTICE 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$function$;
