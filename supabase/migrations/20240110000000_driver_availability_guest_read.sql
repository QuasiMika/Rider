-- Allow any authenticated user to read available drivers (for guest online-count display)
CREATE POLICY "Authenticated users can read available drivers"
  ON public.driver_availability FOR SELECT
  USING (auth.uid() IS NOT NULL AND status = 'available');

-- Enable realtime so guests receive live count updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_availability;
