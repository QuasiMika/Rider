-- Driver accept flow: drivers explicitly choose a request instead of being auto-matched.

-- Drop the FOR ALL policy and replace with role-specific ones so drivers can SELECT
-- waiting requests (needed for the request list and realtime subscription).
DROP POLICY IF EXISTS "Users manage own requests" ON public.guest_requests;

CREATE POLICY "Guest insert own requests"
  ON public.guest_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (guest_id = auth.uid());

CREATE POLICY "Guest update own requests"
  ON public.guest_requests
  FOR UPDATE
  TO authenticated
  USING (guest_id = auth.uid());

CREATE POLICY "Guest delete own requests"
  ON public.guest_requests
  FOR DELETE
  TO authenticated
  USING (guest_id = auth.uid());

-- Guests see their own requests; drivers see all waiting requests
CREATE POLICY "Users view requests"
  ON public.guest_requests
  FOR SELECT
  TO authenticated
  USING (
    guest_id = auth.uid()
    OR (
      status = 'waiting'
      AND EXISTS (
        SELECT 1 FROM public.user_profile
        WHERE user_id = auth.uid()
          AND role = 'driver'
      )
    )
  );

-- Expose guest_requests to realtime so drivers receive new requests live
ALTER PUBLICATION supabase_realtime ADD TABLE public.guest_requests;

-- Atomic accept: driver claims a specific waiting request.
-- Uses FOR UPDATE SKIP LOCKED so two drivers racing to accept the same
-- request can never both succeed — the loser gets accepted: false.
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
  v_guest_id uuid;
  v_ride_id  uuid;
BEGIN
  SELECT guest_id
    INTO v_guest_id
    FROM guest_requests
   WHERE id = p_request_id
     AND status = 'waiting'
   FOR UPDATE SKIP LOCKED;

  IF v_guest_id IS NULL THEN
    RETURN json_build_object('accepted', false, 'reason', 'already_taken');
  END IF;

  INSERT INTO rides (driver_id, guest_id, status)
  VALUES (p_driver_id, v_guest_id, 'pending')
  RETURNING id INTO v_ride_id;

  DELETE FROM guest_requests WHERE id = p_request_id;

  RETURN json_build_object('accepted', true, 'ride_id', v_ride_id);
END;
$$;
