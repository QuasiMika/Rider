CREATE TABLE ride_reviews (
  id          uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     uuid     NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  reviewer_id uuid     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id uuid     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars       smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, reviewer_id)
);

ALTER TABLE ride_reviews ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may read reviews (needed for public profile display)
CREATE POLICY "ride_reviews_select"
  ON ride_reviews FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only participants of the ride may submit a review
CREATE POLICY "ride_reviews_insert"
  ON ride_reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM rides
      WHERE rides.id = ride_reviews.ride_id
        AND (rides.driver_id = auth.uid() OR rides.guest_id = auth.uid())
    )
  );
