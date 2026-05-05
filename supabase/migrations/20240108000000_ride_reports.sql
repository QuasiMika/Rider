CREATE TABLE ride_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     uuid        NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  reporter_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ride_reports ENABLE ROW LEVEL SECURITY;

-- Only participants of the ride may insert a report
CREATE POLICY "ride_reports_insert"
  ON ride_reports FOR INSERT
  WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_reports.ride_id
        AND (rides.driver_id = auth.uid() OR rides.guest_id = auth.uid())
    )
  );

-- Users may view only reports they submitted
CREATE POLICY "ride_reports_select"
  ON ride_reports FOR SELECT
  USING (reporter_id = auth.uid());
