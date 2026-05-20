-- Admin: fetch completed rides for a specific driver (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_admin_driver_rides(p_driver_id uuid)
RETURNS TABLE (
  id                  uuid,
  driver_id           uuid,
  guest_id            uuid,
  status              text,
  pickup_location     text,
  destination         text,
  actual_end_location text,
  price_eur           numeric,
  pickup_code         text,
  created_at          timestamptz,
  completed_at        timestamptz
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
    WHERE r.driver_id = p_driver_id
      AND r.status = 'completed'
    ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_driver_rides(uuid) TO authenticated;
