
-- Update the get_or_create_user_voice_quota function to handle service role authentication better
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
  -- Log the function call for debugging
  RAISE NOTICE 'get_or_create_user_voice_quota called for user: %', p_user_id;
  
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
    v_characters_limit := 6000; -- Updated from 5000 to 6000 characters
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
    
    RAISE NOTICE 'Created new voice quota record for user % with limit %', p_user_id, v_characters_limit;
  ELSE
    -- Update existing records that might have old 5000 limit to 6000
    IF v_characters_limit < 6000 THEN
      UPDATE public.user_voice_usage
      SET 
        characters_limit = 6000, 
        updated_at = now()
      WHERE user_id = p_user_id;
      
      v_characters_limit := 6000;
      RAISE NOTICE 'Updated character limit to 6000 for user %', p_user_id;
    END IF;
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
    
  RAISE NOTICE 'Returning quota for user %: used=%, limit=%, extra=%', p_user_id, v_characters_used, v_characters_limit, v_extra_characters;
END;
$function$;

-- Ensure all existing records have the updated 6000 character limit
UPDATE public.user_voice_usage 
SET characters_limit = 6000, updated_at = now() 
WHERE characters_limit < 6000;
