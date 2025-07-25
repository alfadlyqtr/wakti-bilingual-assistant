
-- Update the get_or_create_user_voice_quota function to use 6000 characters instead of 5000
CREATE OR REPLACE FUNCTION public.get_or_create_user_voice_quota(p_user_id uuid)
RETURNS TABLE(characters_used integer, characters_limit integer, extra_characters integer, purchase_date timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  quota_record RECORD;
BEGIN
  -- Try to get existing voice usage record
  SELECT uvu.characters_used, uvu.characters_limit, uvu.extra_characters, uvu.purchase_date
  INTO quota_record
  FROM public.user_voice_usage uvu
  WHERE uvu.user_id = p_user_id;
  
  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO public.user_voice_usage (
      user_id, 
      characters_used, 
      characters_limit,
      extra_characters
    )
    VALUES (
      p_user_id,
      0,
      6000, -- Updated from 5000 to 6000 characters
      0
    )
    RETURNING characters_used, characters_limit, extra_characters, purchase_date
    INTO quota_record;
  END IF;
  
  -- Check if extra characters have expired (30 days)
  IF quota_record.purchase_date IS NOT NULL AND 
     quota_record.purchase_date < (now() - INTERVAL '30 days') THEN
    -- Reset expired extras
    UPDATE public.user_voice_usage
    SET extra_characters = 0, purchase_date = NULL, updated_at = now()
    WHERE user_id = p_user_id;
    
    quota_record.extra_characters := 0;
    quota_record.purchase_date := NULL;
  END IF;
  
  RETURN QUERY SELECT quota_record.characters_used, quota_record.characters_limit, quota_record.extra_characters, quota_record.purchase_date;
END;
$function$;

-- Update existing records to have 6000 character limit instead of 5000
UPDATE public.user_voice_usage 
SET characters_limit = 6000, updated_at = now() 
WHERE characters_limit = 5000;
