-- Ensure anonymous cleanup only targets users still anonymous after 7 days
CREATE OR REPLACE FUNCTION public.get_old_anonymous_user_ids()
RETURNS TABLE(id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public', 'auth', 'pg_temp'
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE COALESCE(u.is_anonymous, false) = true
    AND u.created_at < now() - interval '7 days'
    AND NOT EXISTS (
      SELECT 1
      FROM auth.identities i
      WHERE i.user_id = u.id
        AND COALESCE(i.provider, '') <> 'anonymous'
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_old_anonymous_user_ids() TO service_role;
