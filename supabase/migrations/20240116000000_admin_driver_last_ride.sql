-- Recreate get_admin_drivers with last_ride_at for activity status
DROP FUNCTION IF EXISTS public.get_admin_drivers();

CREATE OR REPLACE FUNCTION public.get_admin_drivers()
RETURNS TABLE (
  user_id           uuid,
  first_name        varchar,
  family_name       varchar,
  role              text,
  currently_working boolean,
  created_at        timestamptz,
  email             text,
  last_ride_at      timestamptz
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
           au.email::text,
           MAX(r.created_at) AS last_ride_at
    FROM user_profile up
    JOIN auth.users au ON au.id = up.user_id
    LEFT JOIN rides r ON r.driver_id = up.user_id AND r.status = 'completed'
    WHERE up.role = 'driver'
    GROUP BY up.user_id, up.first_name, up.family_name, up.role,
             up.currently_working, up.created_at, au.email
    ORDER BY up.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_drivers() TO authenticated;
