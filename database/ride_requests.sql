CREATE TYPE public.ride_status AS ENUM ('open', 'accepted', 'cancelled');

CREATE TABLE public.ride_request (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  customer_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pickup_location  text NOT NULL,
  dropoff_location text NOT NULL,
  status           public.ride_status NOT NULL DEFAULT 'open',
  accepted_at      timestamptz,
  cancelled_at     timestamptz
);

CREATE TABLE public.ride_request_rejection (
  ride_id     uuid NOT NULL REFERENCES public.ride_request(id) ON DELETE CASCADE,
  driver_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ride_id, driver_id)
);

ALTER TABLE public.ride_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_request_rejection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers create own rides"
ON public.ride_request FOR INSERT TO authenticated
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers and drivers can read relevant rides"
ON public.ride_request FOR SELECT TO authenticated
USING (
  auth.uid() = customer_id
  OR auth.uid() = driver_id
  OR (
    status = 'open'
    AND EXISTS (
      SELECT 1
      FROM public.user_profile
      WHERE user_id = auth.uid()
        AND role = 'driver'
    )
  )
);

CREATE POLICY "Customers can cancel own rides"
ON public.ride_request FOR UPDATE TO authenticated
USING (auth.uid() = customer_id)
WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Drivers can accept open rides"
ON public.ride_request FOR UPDATE TO authenticated
USING (
  status = 'open'
  AND EXISTS (
    SELECT 1
    FROM public.user_profile
    WHERE user_id = auth.uid()
      AND role = 'driver'
  )
)
WITH CHECK (
  auth.uid() = driver_id
  AND status = 'accepted'
);

CREATE POLICY "Drivers manage own rejections"
ON public.ride_request_rejection FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = driver_id
  AND EXISTS (
    SELECT 1
    FROM public.user_profile
    WHERE user_id = auth.uid()
      AND role = 'driver'
  )
);

CREATE POLICY "Drivers read own rejections"
ON public.ride_request_rejection FOR SELECT TO authenticated
USING (auth.uid() = driver_id);
