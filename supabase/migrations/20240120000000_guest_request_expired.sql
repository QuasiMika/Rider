-- Allow guest requests to expire when no driver accepts within the search timeout.
ALTER TABLE public.guest_requests
  DROP CONSTRAINT IF EXISTS guest_requests_status_check;

ALTER TABLE public.guest_requests
  ADD CONSTRAINT guest_requests_status_check
  CHECK (status IN ('waiting', 'matched', 'expired'));

CREATE POLICY "Guest expire own waiting request"
  ON public.guest_requests FOR UPDATE TO authenticated
  USING (guest_id = auth.uid() AND status = 'waiting')
  WITH CHECK (guest_id = auth.uid() AND status = 'expired');
