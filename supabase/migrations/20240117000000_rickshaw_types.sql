-- Dynamische Rikschatypen als Stammdatenbasis für App und späteres Admin-UI.
CREATE TABLE IF NOT EXISTS public.rickshaw_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  price_multiplier numeric(8, 2) NOT NULL CHECK (price_multiplier > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rickshaw_types_capacity_key
  ON public.rickshaw_types (capacity);

INSERT INTO public.rickshaw_types (name, capacity, price_multiplier)
VALUES
  ('1-Personen-Rikscha', 1, 1),
  ('2-Personen-Rikscha', 2, 2),
  ('3-Personen-Rikscha', 3, 3),
  ('4-Personen-Rikscha', 4, 4)
ON CONFLICT (capacity) DO UPDATE
SET name = EXCLUDED.name,
    price_multiplier = EXCLUDED.price_multiplier,
    is_active = true;

ALTER TABLE public.rickshaw_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rickshaw types are readable" ON public.rickshaw_types;
CREATE POLICY "Rickshaw types are readable"
  ON public.rickshaw_types
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS rickshaw_type_id uuid REFERENCES public.rickshaw_types(id);

ALTER TABLE public.driver_availability
  ADD COLUMN IF NOT EXISTS min_passengers integer NOT NULL DEFAULT 1 CHECK (min_passengers > 0),
  ADD COLUMN IF NOT EXISTS max_passengers integer NOT NULL DEFAULT 4 CHECK (max_passengers >= min_passengers);

ALTER TABLE public.guest_requests
  ADD COLUMN IF NOT EXISTS passenger_count integer NOT NULL DEFAULT 1 CHECK (passenger_count > 0),
  ADD COLUMN IF NOT EXISTS rickshaw_type_id uuid REFERENCES public.rickshaw_types(id),
  ADD COLUMN IF NOT EXISTS rickshaw_price_multiplier numeric(8, 2) NOT NULL DEFAULT 1 CHECK (rickshaw_price_multiplier > 0);

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS passenger_count integer NOT NULL DEFAULT 1 CHECK (passenger_count > 0),
  ADD COLUMN IF NOT EXISTS rickshaw_type_id uuid REFERENCES public.rickshaw_types(id),
  ADD COLUMN IF NOT EXISTS rickshaw_price_multiplier numeric(8, 2) NOT NULL DEFAULT 1 CHECK (rickshaw_price_multiplier > 0);

UPDATE public.user_profile up
SET rickshaw_type_id = rt.id
FROM public.rickshaw_types rt
WHERE up.role = 'driver'
  AND up.rickshaw_type_id IS NULL
  AND rt.capacity = 4;

-- Store the driver-selected type from auth metadata on registration.
CREATE OR REPLACE FUNCTION public.insert_user_profile() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_rickshaw_type_id uuid;
BEGIN
  v_role := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'role', '')::public.user_role,
    'customer'::public.user_role
  );

  IF v_role = 'driver' THEN
    SELECT id
      INTO v_rickshaw_type_id
      FROM public.rickshaw_types
     WHERE is_active = true
       AND (
         id::text = NEW.raw_user_meta_data->>'rickshaw_type_id'
         OR capacity = COALESCE(NULLIF(NEW.raw_user_meta_data->>'rickshaw_capacity', '')::integer, 4)
       )
     ORDER BY CASE WHEN id::text = NEW.raw_user_meta_data->>'rickshaw_type_id' THEN 0 ELSE 1 END,
              capacity DESC
     LIMIT 1;
  END IF;

  INSERT INTO public.user_profile (
    user_id, first_name, family_name, role, currently_working, rickshaw_type_id
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'family_name',
    v_role,
    true,
    v_rickshaw_type_id
  );

  RETURN NEW;
END;
$$;

ALTER TABLE public.user_profile
  DROP CONSTRAINT IF EXISTS user_profile_driver_rickshaw_type_chk;

ALTER TABLE public.user_profile
  ADD CONSTRAINT user_profile_driver_rickshaw_type_chk
  CHECK (
    (role = 'driver' AND rickshaw_type_id IS NOT NULL)
    OR (role <> 'driver' AND rickshaw_type_id IS NULL)
  ) NOT VALID;

-- Realtime für spätere Admin-Änderungen an den Stammdaten.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.rickshaw_types;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Admin-/App-Lese-RPC, damit Clients nicht direkt Tabellenlogik kennen müssen.
CREATE OR REPLACE FUNCTION public.get_rickshaw_types()
RETURNS TABLE (
  id uuid,
  name text,
  capacity integer,
  price_multiplier numeric,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT rt.id, rt.name, rt.capacity, rt.price_multiplier, rt.is_active, rt.created_at
  FROM public.rickshaw_types rt
  WHERE rt.is_active = true
  ORDER BY rt.capacity ASC, rt.name ASC
$$;

GRANT EXECUTE ON FUNCTION public.get_rickshaw_types() TO anon, authenticated;

-- Server-side guard: a driver can accept only requests within their own capacity.
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
  v_guest_id                  uuid;
  v_pickup_location           text;
  v_destination               text;
  v_price_eur                 numeric(8, 2);
  v_pickup_code               text;
  v_passenger_count           integer;
  v_request_rickshaw_type_id  uuid;
  v_request_price_multiplier  numeric(8, 2);
  v_driver_rickshaw_type_id   uuid;
  v_driver_capacity           integer;
  v_driver_price_multiplier   numeric(8, 2);
  v_final_price_eur           numeric(8, 2);
  v_ride_id                   uuid;
BEGIN
  SELECT up.rickshaw_type_id, rt.capacity, rt.price_multiplier
    INTO v_driver_rickshaw_type_id, v_driver_capacity, v_driver_price_multiplier
    FROM user_profile up
    JOIN rickshaw_types rt ON rt.id = up.rickshaw_type_id
   WHERE up.user_id = p_driver_id
     AND up.role = 'driver'
     AND rt.is_active = true;

  IF v_driver_capacity IS NULL THEN
    RETURN json_build_object('accepted', false, 'reason', 'driver_rickshaw_missing');
  END IF;

  SELECT guest_id, pickup_location, destination, price_eur, pickup_code, passenger_count,
         rickshaw_type_id, rickshaw_price_multiplier
    INTO v_guest_id, v_pickup_location, v_destination, v_price_eur, v_pickup_code, v_passenger_count,
         v_request_rickshaw_type_id, v_request_price_multiplier
    FROM guest_requests
   WHERE id = p_request_id
     AND status = 'waiting'
   FOR UPDATE SKIP LOCKED;

  IF v_guest_id IS NULL THEN
    RETURN json_build_object('accepted', false, 'reason', 'already_taken');
  END IF;

  IF v_passenger_count > v_driver_capacity THEN
    RETURN json_build_object('accepted', false, 'reason', 'capacity_too_small');
  END IF;

  v_final_price_eur := CASE
    WHEN v_price_eur IS NULL THEN NULL
    ELSE round((v_price_eur / COALESCE(NULLIF(v_request_price_multiplier, 0), 1)) * v_driver_price_multiplier, 2)
  END;

  INSERT INTO rides (
    driver_id, guest_id, status, pickup_location, destination, price_eur, pickup_code,
    passenger_count, rickshaw_type_id, rickshaw_price_multiplier
  )
  VALUES (
    p_driver_id, v_guest_id, 'pending', v_pickup_location, v_destination, v_final_price_eur, v_pickup_code,
    v_passenger_count, v_driver_rickshaw_type_id, v_driver_price_multiplier
  )
  RETURNING id INTO v_ride_id;

  DELETE FROM guest_requests WHERE id = p_request_id;

  RETURN json_build_object(
    'accepted', true,
    'ride_id', v_ride_id,
    'price_eur', v_final_price_eur
  );
END;
$$;
