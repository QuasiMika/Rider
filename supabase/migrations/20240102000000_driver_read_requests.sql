-- Allow any authenticated user to read waiting / matched guest requests.
-- Drivers need this to display the open ride-request list on the DriverPage.
CREATE POLICY "Authenticated users can read all guest requests"
  ON public.guest_requests FOR SELECT
  TO authenticated
  USING (true);
