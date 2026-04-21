-- Tables

CREATE TABLE IF NOT EXISTS public.driver_availability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'matched')),
  location    text,
  ride_id     uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guest_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'matched')),
  pickup_location  text,
  ride_id          uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid NOT NULL REFERENCES auth.users(id),
  guest_id    uuid NOT NULL REFERENCES auth.users(id),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Add FK constraints now that rides table exists
ALTER TABLE public.driver_availability
  ADD CONSTRAINT fk_driver_availability_ride
  FOREIGN KEY (ride_id) REFERENCES public.rides(id)
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.guest_requests
  ADD CONSTRAINT fk_guest_requests_ride
  FOREIGN KEY (ride_id) REFERENCES public.rides(id)
  DEFERRABLE INITIALLY DEFERRED;

-- RLS

ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides               ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own availability"
  ON public.driver_availability FOR ALL
  USING (driver_id = auth.uid());

CREATE POLICY "Users manage own requests"
  ON public.guest_requests FOR ALL
  USING (guest_id = auth.uid());

CREATE POLICY "Ride participants can read"
  ON public.rides FOR SELECT
  USING (driver_id = auth.uid() OR guest_id = auth.uid());

-- Realtime (needed for the useEffect subscription)
ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;

-- Atomic matching function
-- Uses FOR UPDATE SKIP LOCKED so concurrent calls can never claim
-- the same partner — the first caller wins, the rest get matched: false.

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
  v_driver_id      uuid;
  v_guest_id       uuid;
  v_availability_id uuid;
  v_request_id     uuid;
  v_ride_id        uuid;
BEGIN
  IF p_role = 'driver' THEN
    -- Caller is a driver: claim the oldest waiting guest request
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
    -- Caller is a guest: claim the oldest available driver
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

  -- Create ride
  INSERT INTO rides (driver_id, guest_id, status)
  VALUES (v_driver_id, v_guest_id, 'pending')
  RETURNING id INTO v_ride_id;

  -- Mark both sides as matched
  UPDATE driver_availability
     SET status = 'matched', ride_id = v_ride_id
   WHERE id = v_availability_id;

  UPDATE guest_requests
     SET status = 'matched', ride_id = v_ride_id
   WHERE id = v_request_id;

  RETURN json_build_object('matched', true, 'ride_id', v_ride_id);
END;
$$;
