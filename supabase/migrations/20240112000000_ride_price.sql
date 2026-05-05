-- Add server-calculated price to rides.
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS price_eur numeric(8, 2);

-- Update accept_ride to return pickup_location + destination in the result so the
-- caller (accept-ride edge function) can compute the price without a second query.
CREATE OR REPLACE FUNCTION public.accept_ride(
  p_driver_id  uuid,
  p_request_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guest_id        uuid;
  v_pickup_location text;
  v_destination     text;
  v_ride_id         uuid;
BEGIN
  SELECT guest_id, pickup_location, destination
    INTO v_guest_id, v_pickup_location, v_destination
    FROM guest_requests
   WHERE id = p_request_id
     AND status = 'waiting'
   FOR UPDATE SKIP LOCKED;

  IF v_guest_id IS NULL THEN
    RETURN json_build_object('accepted', false, 'reason', 'already_taken');
  END IF;

  INSERT INTO rides (driver_id, guest_id, status, pickup_location, destination)
  VALUES (p_driver_id, v_guest_id, 'pending', v_pickup_location, v_destination)
  RETURNING id INTO v_ride_id;

  DELETE FROM guest_requests WHERE id = p_request_id;

  RETURN json_build_object(
    'accepted',         true,
    'ride_id',          v_ride_id,
    'pickup_location',  v_pickup_location,
    'destination',      v_destination
  );
END;
$$;
