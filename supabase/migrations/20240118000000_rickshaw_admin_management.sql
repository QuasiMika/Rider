-- Move rickshaw pricing from a multiplier to a real price per kilometer.
ALTER TABLE public.rickshaw_types
  ADD COLUMN IF NOT EXISTS price_per_km numeric(8, 2);

UPDATE public.rickshaw_types
SET price_per_km = CASE capacity
  WHEN 1 THEN 2.50
  WHEN 2 THEN 3.00
  WHEN 4 THEN 4.00
  ELSE COALESCE(price_per_km, price_multiplier * 2, 3.00)
END
WHERE price_per_km IS NULL;

ALTER TABLE public.rickshaw_types
  ALTER COLUMN price_per_km SET NOT NULL;

ALTER TABLE public.rickshaw_types
  DROP CONSTRAINT IF EXISTS rickshaw_types_price_per_km_chk;

ALTER TABLE public.rickshaw_types
  ADD CONSTRAINT rickshaw_types_price_per_km_chk CHECK (price_per_km > 0) NOT VALID;

-- Keep the old column in sync for already-deployed code paths while the app moves
-- to price_per_km. The old name should no longer be used for new features.
UPDATE public.rickshaw_types
SET price_multiplier = round(price_per_km / 2, 2);

-- First real models. Existing capacity-matching sample rows are reused so driver
-- references remain valid. Capacity 3 is deactivated as a legacy sample type.
INSERT INTO public.rickshaw_types (name, capacity, price_per_km, price_multiplier, is_active)
VALUES
  ('Klein', 1, 2.50, 1.25, true),
  ('Standard', 2, 3.00, 1.50, true),
  ('Groß', 4, 4.00, 2.00, true)
ON CONFLICT (capacity) DO UPDATE
SET name = EXCLUDED.name,
    price_per_km = EXCLUDED.price_per_km,
    price_multiplier = EXCLUDED.price_multiplier,
    is_active = true;

UPDATE public.rickshaw_types
SET is_active = false,
    name = CASE WHEN name LIKE '%3%' THEN '3-Personen-Rikscha (inaktiv)' ELSE name END
WHERE capacity = 3;

UPDATE public.user_profile up
SET rickshaw_type_id = replacement.id
FROM public.rickshaw_types current_type
CROSS JOIN LATERAL (
  SELECT id
  FROM public.rickshaw_types
  WHERE is_active = true
  ORDER BY capacity DESC, name ASC
  LIMIT 1
) replacement
WHERE up.role = 'driver'
  AND up.rickshaw_type_id = current_type.id
  AND current_type.is_active = false;

WITH legacy_type AS (
  SELECT id
  FROM public.rickshaw_types
  WHERE capacity = 3
  LIMIT 1
),
replacement AS (
  SELECT id
  FROM public.rickshaw_types
  WHERE is_active = true
    AND capacity <> 3
  ORDER BY capacity DESC, name ASC
  LIMIT 1
)
UPDATE public.guest_requests gr
SET rickshaw_type_id = replacement.id
FROM legacy_type, replacement
WHERE gr.rickshaw_type_id = legacy_type.id;

WITH legacy_type AS (
  SELECT id
  FROM public.rickshaw_types
  WHERE capacity = 3
  LIMIT 1
),
replacement AS (
  SELECT id
  FROM public.rickshaw_types
  WHERE is_active = true
    AND capacity <> 3
  ORDER BY capacity DESC, name ASC
  LIMIT 1
)
UPDATE public.rides r
SET rickshaw_type_id = replacement.id
FROM legacy_type, replacement
WHERE r.rickshaw_type_id = legacy_type.id;

DELETE FROM public.rickshaw_types
WHERE capacity = 3
  AND EXISTS (
    SELECT 1
    FROM public.rickshaw_types replacement
    WHERE replacement.is_active = true
      AND replacement.capacity <> 3
  );

ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS rickshaw_price_per_km numeric(8, 2);

ALTER TABLE public.guest_requests
  ADD COLUMN IF NOT EXISTS rickshaw_price_per_km numeric(8, 2);

UPDATE public.rides
SET rickshaw_price_per_km = COALESCE(rickshaw_price_per_km, rickshaw_price_multiplier * 2, 2)
WHERE rickshaw_price_per_km IS NULL;

UPDATE public.guest_requests
SET rickshaw_price_per_km = COALESCE(rickshaw_price_per_km, rickshaw_price_multiplier * 2, 2)
WHERE rickshaw_price_per_km IS NULL;

DROP FUNCTION IF EXISTS public.get_rickshaw_types();

CREATE OR REPLACE FUNCTION public.get_rickshaw_types()
RETURNS TABLE (
  id uuid,
  name text,
  capacity integer,
  price_per_km numeric,
  is_active boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT rt.id, rt.name, rt.capacity, rt.price_per_km, rt.is_active, rt.created_at
  FROM public.rickshaw_types rt
  WHERE rt.is_active = true
  ORDER BY rt.capacity ASC, rt.name ASC
$$;

GRANT EXECUTE ON FUNCTION public.get_rickshaw_types() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_rickshaw_types()
RETURNS TABLE (
  id uuid,
  name text,
  capacity integer,
  price_per_km numeric,
  is_active boolean,
  assigned_drivers bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT rt.id, rt.name, rt.capacity, rt.price_per_km, rt.is_active,
           COUNT(up.user_id) FILTER (WHERE up.role = 'driver') AS assigned_drivers,
           rt.created_at
    FROM public.rickshaw_types rt
    LEFT JOIN public.user_profile up ON up.rickshaw_type_id = rt.id
    GROUP BY rt.id, rt.name, rt.capacity, rt.price_per_km, rt.is_active, rt.created_at
    ORDER BY rt.is_active DESC, rt.capacity ASC, rt.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_rickshaw_types() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_rickshaw_type(
  p_id uuid,
  p_name text,
  p_capacity integer,
  p_price_per_km numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NULLIF(trim(p_name), '') IS NULL THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_capacity IS NULL OR p_capacity <= 0 THEN
    RAISE EXCEPTION 'Capacity must be greater than zero';
  END IF;
  IF p_price_per_km IS NULL OR p_price_per_km <= 0 THEN
    RAISE EXCEPTION 'Price per kilometer must be greater than zero';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.rickshaw_types (name, capacity, price_per_km, price_multiplier, is_active)
    VALUES (trim(p_name), p_capacity, p_price_per_km, round(p_price_per_km / 2, 2), true)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.rickshaw_types
       SET name = trim(p_name),
           capacity = p_capacity,
           price_per_km = p_price_per_km,
           price_multiplier = round(p_price_per_km / 2, 2)
     WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Rickshaw type not found';
    END IF;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_rickshaw_type(uuid, text, integer, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.reassign_rickshaw_type_drivers(
  p_source_id uuid,
  p_replacement_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_replacement_id uuid;
BEGIN
  IF p_replacement_id IS NOT NULL AND p_replacement_id <> p_source_id THEN
    SELECT id INTO v_replacement_id
    FROM public.rickshaw_types
    WHERE id = p_replacement_id;
  ELSE
    SELECT id INTO v_replacement_id
    FROM public.rickshaw_types
    WHERE id <> p_source_id
      AND is_active = true
    ORDER BY capacity DESC, name ASC
    LIMIT 1;
  END IF;

  IF v_replacement_id IS NULL THEN
    RAISE EXCEPTION 'No replacement rickshaw type available';
  END IF;

  UPDATE public.user_profile
     SET rickshaw_type_id = v_replacement_id
   WHERE role = 'driver'
     AND rickshaw_type_id = p_source_id;

  RETURN v_replacement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_rickshaw_type_active(
  p_id uuid,
  p_active boolean,
  p_replacement_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count integer;
  v_total_count integer;
  v_replacement_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rickshaw_types WHERE id = p_id) THEN
    RAISE EXCEPTION 'Rickshaw type not found';
  END IF;

  IF p_active = false THEN
    SELECT COUNT(*) INTO v_total_count FROM public.rickshaw_types;
    SELECT COUNT(*) INTO v_active_count FROM public.rickshaw_types WHERE is_active = true;

    IF v_total_count <= 1 OR v_active_count <= 1 THEN
      RAISE EXCEPTION 'At least one active rickshaw type is required';
    END IF;

    v_replacement_id := public.reassign_rickshaw_type_drivers(p_id, p_replacement_id);
  END IF;

  UPDATE public.rickshaw_types
     SET is_active = p_active
   WHERE id = p_id;

  RETURN COALESCE(v_replacement_id, p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_rickshaw_type_active(uuid, boolean, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_rickshaw_type(
  p_id uuid,
  p_replacement_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count integer;
  v_replacement_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rickshaw_types WHERE id = p_id) THEN
    RAISE EXCEPTION 'Rickshaw type not found';
  END IF;

  SELECT COUNT(*) INTO v_total_count FROM public.rickshaw_types;
  IF v_total_count <= 1 THEN
    RAISE EXCEPTION 'At least one rickshaw type is required';
  END IF;

  v_replacement_id := public.reassign_rickshaw_type_drivers(p_id, p_replacement_id);

  UPDATE public.guest_requests
     SET rickshaw_type_id = v_replacement_id
   WHERE rickshaw_type_id = p_id;

  UPDATE public.rides
     SET rickshaw_type_id = v_replacement_id
   WHERE rickshaw_type_id = p_id;

  DELETE FROM public.rickshaw_types
   WHERE id = p_id;

  RETURN v_replacement_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_rickshaw_type(uuid, uuid) TO authenticated;

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
  v_request_capacity          integer;
  v_request_rickshaw_type_id  uuid;
  v_request_price_per_km      numeric(8, 2);
  v_driver_rickshaw_type_id   uuid;
  v_driver_capacity           integer;
  v_driver_price_per_km       numeric(8, 2);
  v_final_price_eur           numeric(8, 2);
  v_ride_id                   uuid;
BEGIN
  SELECT up.rickshaw_type_id, rt.capacity, rt.price_per_km
    INTO v_driver_rickshaw_type_id, v_driver_capacity, v_driver_price_per_km
    FROM user_profile up
    JOIN rickshaw_types rt ON rt.id = up.rickshaw_type_id
   WHERE up.user_id = p_driver_id
     AND up.role = 'driver'
     AND rt.is_active = true;

  IF v_driver_capacity IS NULL THEN
    RETURN json_build_object('accepted', false, 'reason', 'driver_rickshaw_missing');
  END IF;

  SELECT gr.guest_id, gr.pickup_location, gr.destination, gr.price_eur, gr.pickup_code, gr.passenger_count,
         gr.rickshaw_type_id,
         COALESCE(gr.rickshaw_price_per_km, gr.rickshaw_price_multiplier * 2, 2)
    INTO v_guest_id, v_pickup_location, v_destination, v_price_eur, v_pickup_code, v_passenger_count,
         v_request_rickshaw_type_id, v_request_price_per_km
    FROM guest_requests gr
   WHERE gr.id = p_request_id
     AND gr.status = 'waiting'
   FOR UPDATE SKIP LOCKED;

  IF v_guest_id IS NULL THEN
    RETURN json_build_object('accepted', false, 'reason', 'already_taken');
  END IF;

  IF v_request_rickshaw_type_id IS NOT NULL THEN
    SELECT capacity, COALESCE(v_request_price_per_km, price_per_km)
      INTO v_request_capacity, v_request_price_per_km
      FROM rickshaw_types
     WHERE id = v_request_rickshaw_type_id;
  END IF;

  v_request_capacity := COALESCE(v_request_capacity, v_passenger_count);
  v_request_price_per_km := COALESCE(v_request_price_per_km, 2);

  IF GREATEST(v_passenger_count, v_request_capacity) > v_driver_capacity THEN
    RETURN json_build_object('accepted', false, 'reason', 'capacity_too_small');
  END IF;

  IF v_request_price_per_km > v_driver_price_per_km THEN
    RETURN json_build_object('accepted', false, 'reason', 'price_class_too_low');
  END IF;

  v_final_price_eur := v_price_eur;

  INSERT INTO rides (
    driver_id, guest_id, status, pickup_location, destination, price_eur, pickup_code,
    passenger_count, rickshaw_type_id, rickshaw_price_multiplier, rickshaw_price_per_km
  )
  VALUES (
    p_driver_id, v_guest_id, 'pending', v_pickup_location, v_destination, v_final_price_eur, v_pickup_code,
    v_passenger_count, COALESCE(v_request_rickshaw_type_id, v_driver_rickshaw_type_id),
    round(v_request_price_per_km / 2, 2), v_request_price_per_km
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
