
-- First, create a function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
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
    }'::jsonb
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error details but don't block signup
  RAISE NOTICE 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to backfill missing profiles for existing users
CREATE OR REPLACE FUNCTION public.backfill_missing_profiles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  missing_count INTEGER := 0;
  user_record RECORD;
BEGIN
  -- Find users without profiles
  FOR user_record IN 
    SELECT u.id, u.email, u.raw_user_meta_data, u.created_at
    FROM auth.users u
    LEFT JOIN public.profiles p ON u.id = p.id
    WHERE p.id IS NULL
  LOOP
    -- Create missing profile
    INSERT INTO public.profiles (
      id, 
      username, 
      display_name,
      email,
      first_name,
      last_name,
      settings,
      created_at
    )
    VALUES (
      user_record.id,
      COALESCE(user_record.raw_user_meta_data->>'username', 'user' || substr(user_record.id::text, 1, 8)),
      COALESCE(user_record.raw_user_meta_data->>'display_name', user_record.email),
      user_record.email,
      user_record.raw_user_meta_data->>'first_name',
      user_record.raw_user_meta_data->>'last_name',
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
      user_record.created_at
    );
    
    missing_count := missing_count + 1;
  END LOOP;
  
  RETURN missing_count;
END;
$$;

-- Run the backfill function to create missing profiles
SELECT public.backfill_missing_profiles();

-- Ensure avatars bucket exists with proper policies
INSERT INTO storage.buckets (id, name, public)  
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Update storage policies for avatars bucket
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated Users Can Upload" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated Users Can Update Their Own Avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated Users Can Delete Their Own Avatars" ON storage.objects;
  
  -- Create new policies
  CREATE POLICY "Public Read Access"
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'avatars');

  CREATE POLICY "Authenticated Users Can Upload"
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

  CREATE POLICY "Authenticated Users Can Update Their Own Avatars"
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

  CREATE POLICY "Authenticated Users Can Delete Their Own Avatars"
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some policies may already exist: %', SQLERRM;
END $$;
