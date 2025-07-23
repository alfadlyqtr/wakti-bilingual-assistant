
-- Fix the get_or_create_user_voice_quota function to resolve column ambiguity and RLS issues
CREATE OR REPLACE FUNCTION public.get_or_create_user_voice_quota(p_user_id uuid)
RETURNS TABLE(characters_used integer, characters_limit integer, extra_characters integer, purchase_date timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  quota_record RECORD;
  v_characters_used INTEGER;
  v_characters_limit INTEGER;
  v_extra_characters INTEGER;
  v_purchase_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Try to get existing voice usage record
  SELECT 
    uvu.characters_used, 
    uvu.characters_limit, 
    uvu.extra_characters, 
    uvu.purchase_date
  INTO 
    v_characters_used,
    v_characters_limit,
    v_extra_characters,
    v_purchase_date
  FROM public.user_voice_usage uvu
  WHERE uvu.user_id = p_user_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    -- Set default values
    v_characters_used := 0;
    v_characters_limit := 6000;
    v_extra_characters := 0;
    v_purchase_date := NULL;
    
    -- Insert new record with explicit column names to avoid ambiguity
    INSERT INTO public.user_voice_usage (
      user_id, 
      characters_used, 
      characters_limit,
      extra_characters,
      purchase_date,
      created_at,
      updated_at
    )
    VALUES (
      p_user_id,
      v_characters_used,
      v_characters_limit,
      v_extra_characters,
      v_purchase_date,
      now(),
      now()
    );
    
    RAISE NOTICE 'Created new voice quota record for user %', p_user_id;
  END IF;
  
  -- Check if extra characters have expired (30 days)
  IF v_purchase_date IS NOT NULL AND 
     v_purchase_date < (now() - INTERVAL '30 days') THEN
    -- Reset expired extras
    UPDATE public.user_voice_usage
    SET 
      extra_characters = 0, 
      purchase_date = NULL, 
      updated_at = now()
    WHERE user_id = p_user_id;
    
    v_extra_characters := 0;
    v_purchase_date := NULL;
    
    RAISE NOTICE 'Reset expired extra characters for user %', p_user_id;
  END IF;
  
  -- Return the quota information
  RETURN QUERY SELECT 
    v_characters_used, 
    v_characters_limit, 
    v_extra_characters, 
    v_purchase_date;
END;
$function$;

-- Test the function with the specific user to ensure it works
DO $$
DECLARE
  test_user_id UUID := 'b5c8a5c4-8b1f-4a2e-9d3c-7f6e5d4c3b2a'::UUID; -- Replace with actual user ID if needed
  result RECORD;
BEGIN
  -- Test the function
  SELECT * INTO result FROM public.get_or_create_user_voice_quota(test_user_id);
  RAISE NOTICE 'Function test result: characters_used=%, characters_limit=%, extra_characters=%, purchase_date=%', 
    result.characters_used, result.characters_limit, result.extra_characters, result.purchase_date;
END;
$$;

-- Ensure RLS policies allow the function to work properly
-- Check if user_voice_usage table has proper RLS policies
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE n.nspname = 'public' AND c.relname = 'user_voice_usage' AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.user_voice_usage ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'Enabled RLS on user_voice_usage table';
  END IF;
  
  -- Create policy for users to access their own voice usage data if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'user_voice_usage' AND policyname = 'Users can access their own voice usage'
  ) THEN
    CREATE POLICY "Users can access their own voice usage" 
      ON public.user_voice_usage 
      FOR ALL 
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
    RAISE NOTICE 'Created RLS policy for user_voice_usage';
  END IF;
END;
$$;

-- Add function to safely test user quota access
CREATE OR REPLACE FUNCTION public.test_user_voice_quota_access(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  quota_result RECORD;
  result_json jsonb;
BEGIN
  BEGIN
    -- Test quota function
    SELECT * INTO quota_result FROM public.get_or_create_user_voice_quota(p_user_id);
    
    result_json := jsonb_build_object(
      'success', true,
      'user_id', p_user_id,
      'characters_used', quota_result.characters_used,
      'characters_limit', quota_result.characters_limit,
      'extra_characters', quota_result.extra_characters,
      'purchase_date', quota_result.purchase_date,
      'remaining_characters', (quota_result.characters_limit - quota_result.characters_used + quota_result.extra_characters),
      'message', 'Voice quota access successful'
    );
    
    RAISE NOTICE 'Voice quota test successful for user %', p_user_id;
    
  EXCEPTION WHEN OTHERS THEN
    result_json := jsonb_build_object(
      'success', false,
      'user_id', p_user_id,
      'error', SQLERRM,
      'sqlstate', SQLSTATE,
      'message', 'Voice quota access failed'
    );
    
    RAISE NOTICE 'Voice quota test failed for user %: %', p_user_id, SQLERRM;
  END;
  
  RETURN result_json;
END;
$function$;
