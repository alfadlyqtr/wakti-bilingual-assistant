-- Add voice usage tracking and expiration columns to user_voice_clones table
ALTER TABLE public.user_voice_clones 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '60 days');

-- Update existing records to have proper expiration dates
UPDATE public.user_voice_clones 
SET expires_at = created_at + INTERVAL '60 days',
    last_used_at = created_at
WHERE expires_at IS NULL OR last_used_at IS NULL;

-- Create function to cleanup expired voice clones
CREATE OR REPLACE FUNCTION public.cleanup_expired_voice_clones()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Delete expired voice clones
  DELETE FROM public.user_voice_clones
  WHERE expires_at < now();
  
  -- Log cleanup action
  RAISE NOTICE 'Cleaned up expired voice clones at %', now();
END;
$function$;

-- Create function to update voice activity (extends expiration)
CREATE OR REPLACE FUNCTION public.update_voice_activity(p_voice_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.user_voice_clones
  SET 
    last_used_at = now(),
    expires_at = now() + INTERVAL '60 days',
    updated_at = now()
  WHERE voice_id = p_voice_id;
END;
$function$;