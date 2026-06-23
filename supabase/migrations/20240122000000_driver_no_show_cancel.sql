-- Allow a driver to mark arrival at the pickup point and cancel after a grace period.
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz;

ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;

ALTER TABLE public.rides
  ADD CONSTRAINT rides_status_check
  CHECK (status IN ('pending', 'arrived', 'picked_up', 'active', 'completed', 'cancelled'));

CREATE OR REPLACE FUNCTION public.mark_driver_arrived(p_ride_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE rides
     SET status = 'arrived',
         arrived_at = COALESCE(arrived_at, now())
   WHERE id = p_ride_id
     AND driver_id = auth.uid()
     AND status = 'pending';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_driver_arrived(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_pickup_by_driver(p_ride_id uuid, p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE rides
     SET status = 'picked_up'
   WHERE id = p_ride_id
     AND driver_id = auth.uid()
     AND status IN ('pending', 'arrived')
     AND pickup_code = p_code;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_pickup_by_driver(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_ride_no_show(p_ride_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE rides
     SET status = 'cancelled',
         completed_at = COALESCE(completed_at, now())
   WHERE id = p_ride_id
     AND driver_id = auth.uid()
     AND status = 'arrived'
     AND arrived_at <= now() - interval '5 minutes';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_ride_no_show(uuid) TO authenticated;

DROP POLICY IF EXISTS "ride_messages_insert" ON public.ride_messages;

CREATE POLICY "ride_messages_insert" ON public.ride_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.id = ride_id
        AND (r.driver_id = auth.uid() OR r.guest_id = auth.uid())
        AND r.status IN ('pending', 'arrived', 'picked_up', 'active')
    )
  );
