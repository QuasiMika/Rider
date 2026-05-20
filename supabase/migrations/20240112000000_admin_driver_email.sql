-- Extend get_admin_drivers to include email from auth.users
CREATE OR REPLACE FUNCTION public.get_admin_drivers()
RETURNS TABLE (
  user_id           uuid,
  first_name        varchar,
  family_name       varchar,
  role              text,
  currently_working boolean,
  created_at        timestamptz,
  email             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT up.user_id, up.first_name, up.family_name, up.role::text,
           up.currently_working, up.created_at,
           au.email::text
    FROM user_profile up
    JOIN auth.users au ON au.id = up.user_id
    WHERE up.role = 'driver'
    ORDER BY up.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_drivers() TO authenticated;
