-- Add destination to guest_requests.
-- pickup_location already existed as a nullable column.
ALTER TABLE public.guest_requests
  ADD COLUMN IF NOT EXISTS destination text;
