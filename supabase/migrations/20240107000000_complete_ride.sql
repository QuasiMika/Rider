-- Store where the ride actually ended (driver's GPS at completion time).
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS actual_end_location text;

-- Driver slides the slider → calls this function.
-- Validates: caller must be the driver and ride must be in picked_up state.
CREATE OR REPLACE FUNCTION public.complete_ride(p_ride_id uuid, p_location text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rides
     SET status              = 'completed',
         actual_end_location = NULLIF(p_location, '')
   WHERE id        = p_ride_id
     AND driver_id = auth.uid()
     AND status    = 'picked_up';
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_ride(uuid, text) TO authenticated;
