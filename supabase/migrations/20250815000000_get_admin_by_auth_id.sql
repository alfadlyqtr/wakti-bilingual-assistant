-- Return admin user row for a given Auth user id
CREATE OR REPLACE FUNCTION public.get_admin_by_auth_id(auth_user_id uuid)
RETURNS admin_users
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.admin_users
  WHERE auth_user_id = get_admin_by_auth_id.auth_user_id
  LIMIT 1;
$$;
