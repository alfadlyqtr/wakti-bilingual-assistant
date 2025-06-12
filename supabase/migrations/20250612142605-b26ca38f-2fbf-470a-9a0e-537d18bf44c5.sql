
-- Update the increment_regular_search_usage function to always return success (no quota tracking)
CREATE OR REPLACE FUNCTION public.increment_regular_search_usage(p_user_id uuid)
 RETURNS TABLE(success boolean, regular_search_count integer, extra_regular_searches integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Always return success with unlimited searches (no quota tracking)
  RETURN QUERY SELECT TRUE, 0, 999999;
END;
$function$;
