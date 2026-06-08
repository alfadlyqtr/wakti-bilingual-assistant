CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  profile_suffix text;
  profile_email text;
  profile_username text;
  profile_display_name text;
BEGIN
  profile_suffix := substr(NEW.id::text, 1, 8);
  profile_email := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'email'), ''), NULLIF(TRIM(NEW.email), ''));
  profile_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    CASE
      WHEN NEW.is_anonymous THEN 'guest' || profile_suffix
      ELSE 'user' || profile_suffix
    END
  );
  profile_display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    CASE
      WHEN NEW.is_anonymous THEN 'Guest ' || profile_suffix
      ELSE profile_email
    END,
    'User ' || profile_suffix
  );

  INSERT INTO public.profiles (
    id,
    username,
    display_name,
    email,
    first_name,
    last_name,
    settings
  )
  VALUES (
    NEW.id,
    profile_username,
    profile_display_name,
    profile_email,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
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
    }'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$function$;
