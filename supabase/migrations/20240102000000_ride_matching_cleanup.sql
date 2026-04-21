-- Prevent multiple active records per user.
-- A driver can only have one 'available' row; a guest only one 'waiting' row.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_driver_available
  ON public.driver_availability (driver_id)
  WHERE status = 'available';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_guest_waiting
  ON public.guest_requests (guest_id)
  WHERE status = 'waiting';

-- Update atomic_match_ride: delete availability/request after matching
-- instead of updating status — the ride record is the source of truth.
CREATE OR REPLACE FUNCTION public.atomic_match_ride(
  p_role      text,
  p_record_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id       uuid;
  v_guest_id        uuid;
  v_availability_id uuid;
  v_request_id      uuid;
  v_ride_id         uuid;
BEGIN
  IF p_role = 'driver' THEN
    SELECT id, guest_id
      INTO v_request_id, v_guest_id
      FROM guest_requests
     WHERE status = 'waiting'
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;

    IF v_request_id IS NULL THEN
      RETURN json_build_object('matched', false);
    END IF;

    SELECT driver_id
      INTO v_driver_id
      FROM driver_availability
     WHERE id = p_record_id
     FOR UPDATE;

    v_availability_id := p_record_id;

  ELSE
    SELECT id, driver_id
      INTO v_availability_id, v_driver_id
      FROM driver_availability
     WHERE status = 'available'
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;

    IF v_availability_id IS NULL THEN
      RETURN json_build_object('matched', false);
    END IF;

    SELECT guest_id
      INTO v_guest_id
      FROM guest_requests
     WHERE id = p_record_id
     FOR UPDATE;

    v_request_id := p_record_id;
  END IF;

  INSERT INTO rides (driver_id, guest_id, status)
  VALUES (v_driver_id, v_guest_id, 'pending')
  RETURNING id INTO v_ride_id;

  -- Delete instead of updating: the ride record is the source of truth
  DELETE FROM driver_availability WHERE id = v_availability_id;
  DELETE FROM guest_requests WHERE id = v_request_id;

  RETURN json_build_object('matched', true, 'ride_id', v_ride_id);
END;
$$;
