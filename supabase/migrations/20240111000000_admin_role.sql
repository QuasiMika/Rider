-- Add admin role to the enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';

-- Track when a ride was completed (used for avg duration in admin stats)
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Update complete_ride to stamp completed_at
CREATE OR REPLACE FUNCTION public.complete_ride(p_ride_id uuid, p_location text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rides
     SET status              = 'completed',
         actual_end_location = NULLIF(p_location, ''),
         completed_at        = now()
   WHERE id        = p_ride_id
     AND driver_id = auth.uid()
     AND status    = 'picked_up';
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_ride(uuid, text) TO authenticated;

-- Helper: check caller is admin (SECURITY DEFINER bypasses RLS to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profile
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Admin: read all rides
CREATE OR REPLACE FUNCTION public.get_admin_rides()
RETURNS TABLE (
  id               uuid,
  driver_id        uuid,
  guest_id         uuid,
  status           text,
  pickup_location  text,
  destination      text,
  actual_end_location text,
  price_eur        numeric,
  pickup_code      text,
  created_at       timestamptz,
  completed_at     timestamptz
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
    SELECT r.id, r.driver_id, r.guest_id, r.status::text,
           r.pickup_location, r.destination, r.actual_end_location,
           r.price_eur, r.pickup_code, r.created_at, r.completed_at
    FROM rides r
    ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_rides() TO authenticated;

-- Admin: read all drivers
CREATE OR REPLACE FUNCTION public.get_admin_drivers()
RETURNS TABLE (
  user_id          uuid,
  first_name       varchar,
  family_name      varchar,
  role             text,
  currently_working boolean,
  created_at       timestamptz
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
           up.currently_working, up.created_at
    FROM user_profile up
    WHERE up.role = 'driver'
    ORDER BY up.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_drivers() TO authenticated;

-- Admin: set driver active/inactive
CREATE OR REPLACE FUNCTION public.set_driver_working(p_driver_id uuid, p_working boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE user_profile
     SET currently_working = p_working
   WHERE user_id = p_driver_id AND role = 'driver';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_driver_working(uuid, boolean) TO authenticated;

-- Admin: dashboard statistics
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rides_today      int;
  v_active_drivers   int;
  v_avg_minutes      numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO v_rides_today
  FROM rides
  WHERE created_at >= CURRENT_DATE;

  SELECT COUNT(*) INTO v_active_drivers
  FROM user_profile
  WHERE role = 'driver' AND currently_working = true;

  SELECT ROUND(
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60)::numeric,
    1
  )
  INTO v_avg_minutes
  FROM rides
  WHERE status = 'completed' AND completed_at IS NOT NULL;

  RETURN json_build_object(
    'rides_today',           v_rides_today,
    'active_drivers',        v_active_drivers,
    'avg_duration_minutes',  COALESCE(v_avg_minutes, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated;
