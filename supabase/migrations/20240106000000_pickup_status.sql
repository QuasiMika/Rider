-- Allow guests to confirm pickup by sliding the slider (pending → picked_up → active).
-- Drop and recreate the status check constraint to include the new state.
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;

ALTER TABLE public.rides
  ADD CONSTRAINT rides_status_check
  CHECK (status IN ('pending', 'picked_up', 'active', 'completed'));

-- Security-definer function so guests can only advance their own ride from pending.
CREATE OR REPLACE FUNCTION public.confirm_pickup(p_ride_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rides
     SET status = 'picked_up'
   WHERE id       = p_ride_id
     AND guest_id = auth.uid()
     AND status   = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_pickup(uuid) TO authenticated;
