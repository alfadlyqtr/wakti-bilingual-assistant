
-- Create voice translation monthly quota table
CREATE TABLE public.user_voice_translation_quotas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_date TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  translation_count INTEGER NOT NULL DEFAULT 0,
  extra_translations INTEGER NOT NULL DEFAULT 0,
  purchase_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, monthly_date)
);

-- Enable RLS
ALTER TABLE public.user_voice_translation_quotas ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own voice translation quotas" 
  ON public.user_voice_translation_quotas 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice translation quotas" 
  ON public.user_voice_translation_quotas 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice translation quotas" 
  ON public.user_voice_translation_quotas 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_voice_translation_quota_updated_at
  BEFORE UPDATE ON public.user_voice_translation_quotas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get or create user voice translation quota
CREATE OR REPLACE FUNCTION public.get_or_create_voice_translation_quota(p_user_id uuid)
RETURNS TABLE(translation_count integer, extra_translations integer, purchase_date timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  quota_record RECORD;
BEGIN
  -- Try to get current month's quota
  SELECT uvtq.translation_count, uvtq.extra_translations, uvtq.purchase_date
  INTO quota_record
  FROM public.user_voice_translation_quotas uvtq
  WHERE uvtq.user_id = p_user_id AND uvtq.monthly_date = current_month;
  
  -- If no record exists for this month, create one
  IF NOT FOUND THEN
    -- Get the latest extra_translations from previous records
    SELECT uvtq.extra_translations, uvtq.purchase_date
    INTO quota_record
    FROM public.user_voice_translation_quotas uvtq
    WHERE uvtq.user_id = p_user_id
    ORDER BY uvtq.monthly_date DESC
    LIMIT 1;
    
    -- Create new record for current month
    INSERT INTO public.user_voice_translation_quotas (
      user_id, 
      translation_count, 
      monthly_date, 
      extra_translations, 
      purchase_date
    )
    VALUES (
      p_user_id,
      0,
      current_month,
      COALESCE(quota_record.extra_translations, 0),
      quota_record.purchase_date
    )
    RETURNING translation_count, extra_translations, purchase_date
    INTO quota_record;
  END IF;
  
  -- Check if extra translations have expired (30 days)
  IF quota_record.purchase_date IS NOT NULL AND 
     quota_record.purchase_date < (now() - INTERVAL '30 days') THEN
    -- Reset expired extras
    UPDATE public.user_voice_translation_quotas
    SET extra_translations = 0, purchase_date = NULL, updated_at = now()
    WHERE user_id = p_user_id AND monthly_date = current_month;
    
    quota_record.extra_translations := 0;
    quota_record.purchase_date := NULL;
  END IF;
  
  RETURN QUERY SELECT quota_record.translation_count, quota_record.extra_translations, quota_record.purchase_date;
END;
$function$;

-- Function to increment voice translation usage
CREATE OR REPLACE FUNCTION public.increment_voice_translation_usage(p_user_id uuid)
RETURNS TABLE(success boolean, translation_count integer, extra_translations integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  current_count INTEGER;
  current_extras INTEGER;
  max_monthly CONSTANT INTEGER := 10;
BEGIN
  -- Get current quota
  SELECT uvtq.translation_count, uvtq.extra_translations
  INTO current_count, current_extras
  FROM public.user_voice_translation_quotas uvtq
  WHERE uvtq.user_id = p_user_id AND uvtq.monthly_date = current_month;
  
  -- If no record exists, create one first
  IF NOT FOUND THEN
    PERFORM public.get_or_create_voice_translation_quota(p_user_id);
    current_count := 0;
    current_extras := 0;
  END IF;
  
  -- Check if user can translate
  IF current_count < max_monthly THEN
    -- Increment monthly count
    UPDATE public.user_voice_translation_quotas
    SET translation_count = translation_count + 1, updated_at = now()
    WHERE user_id = p_user_id AND monthly_date = current_month;
    
    current_count := current_count + 1;
    RETURN QUERY SELECT TRUE, current_count, current_extras;
  ELSIF current_extras > 0 THEN
    -- Use extra translation
    UPDATE public.user_voice_translation_quotas
    SET extra_translations = extra_translations - 1, updated_at = now()
    WHERE user_id = p_user_id AND monthly_date = current_month;
    
    current_extras := current_extras - 1;
    RETURN QUERY SELECT TRUE, current_count, current_extras;
  ELSE
    -- No translations available
    RETURN QUERY SELECT FALSE, current_count, current_extras;
  END IF;
END;
$function$;

-- Function to purchase extra voice translations
CREATE OR REPLACE FUNCTION public.purchase_extra_voice_translations(p_user_id uuid, p_count integer)
RETURNS TABLE(success boolean, new_extra_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  current_month TEXT := to_char(now(), 'YYYY-MM');
  current_extras INTEGER;
BEGIN
  -- Ensure user quota exists for current month
  PERFORM public.get_or_create_voice_translation_quota(p_user_id);
  
  -- Add extra voice translations
  UPDATE public.user_voice_translation_quotas
  SET 
    extra_translations = extra_translations + p_count,
    purchase_date = now(),
    updated_at = now()
  WHERE user_id = p_user_id AND monthly_date = current_month
  RETURNING extra_translations INTO current_extras;
  
  RETURN QUERY SELECT TRUE, current_extras;
END;
$function$;
