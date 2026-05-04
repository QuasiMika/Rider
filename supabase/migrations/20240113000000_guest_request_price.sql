-- Drivers must see the estimated price before deciding to accept a request.
ALTER TABLE public.guest_requests
  ADD COLUMN IF NOT EXISTS price_eur numeric(8, 2);

-- accept_ride: copy price_eur from guest_requests into the new ride row so the
-- price is preserved without a second calculation.  Also return price_eur to the
-- caller so the edge function can include it in its response.
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
  v_price_eur       numeric(8, 2);
  v_ride_id         uuid;
BEGIN
  SELECT guest_id, pickup_location, destination, price_eur
    INTO v_guest_id, v_pickup_location, v_destination, v_price_eur
    FROM guest_requests
   WHERE id = p_request_id
     AND status = 'waiting'
   FOR UPDATE SKIP LOCKED;

  IF v_guest_id IS NULL THEN
    RETURN json_build_object('accepted', false, 'reason', 'already_taken');
  END IF;

  INSERT INTO rides (driver_id, guest_id, status, pickup_location, destination, price_eur)
  VALUES (p_driver_id, v_guest_id, 'pending', v_pickup_location, v_destination, v_price_eur)
  RETURNING id INTO v_ride_id;

  DELETE FROM guest_requests WHERE id = p_request_id;

  RETURN json_build_object(
    'accepted',  true,
    'ride_id',   v_ride_id,
    'price_eur', v_price_eur
  );
END;
$$;
