-- ============================================================
-- Rider — Standalone Postgres Schema
-- ============================================================
-- Use this file when running the REST API against a plain
-- Postgres instance (no Supabase).
--
-- If you ARE using Supabase (local or hosted), skip this file
-- and run your migrations instead:
--
--   supabase db push            # apply all migrations
--   # or for local dev:
--   supabase start              # starts local Postgres + applies migrations automatically
--
-- Key differences from the Supabase schema:
--   • No auth.users — users are stored in public.users
--   • No RLS policies — auth is enforced by the Express middleware
--   • No supabase_realtime publication
--   • confirm_pickup / complete_ride are not needed (REST API uses direct UPDATE)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ── User role enum ────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('driver', 'customer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Users ─────────────────────────────────────────────────────
-- Replaces auth.users + user_profile.
-- Passwords are hashed externally (or use Supabase Auth and keep the
-- auth.users FK variant instead).

CREATE TABLE IF NOT EXISTS public.users (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text        NOT NULL UNIQUE,
  first_name     varchar(100),
  family_name    varchar(100),
  role           user_role   NOT NULL DEFAULT 'customer',
  currently_working boolean  NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Guest requests ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.guest_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status           text        NOT NULL DEFAULT 'waiting'
                               CHECK (status IN ('waiting', 'matched')),
  pickup_location  text,
  destination      text,
  price_eur        numeric(8, 2),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Only one waiting request per guest
CREATE UNIQUE INDEX IF NOT EXISTS uniq_guest_waiting
  ON public.guest_requests (guest_id)
  WHERE status = 'waiting';

-- ── Driver availability ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.driver_availability (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'available'
                          CHECK (status IN ('available', 'matched')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Only one available row per driver
CREATE UNIQUE INDEX IF NOT EXISTS uniq_driver_available
  ON public.driver_availability (driver_id)
  WHERE status = 'available';

-- ── Rides ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rides (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           uuid        NOT NULL REFERENCES public.users(id),
  guest_id            uuid        NOT NULL REFERENCES public.users(id),
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'picked_up', 'active', 'completed')),
  pickup_location     text,
  destination         text,
  actual_end_location text,
  price_eur           numeric(8, 2),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Ride reports ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ride_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     uuid        NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  reporter_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Ride reviews ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ride_reviews (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id     uuid        NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  reviewer_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewee_id uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  stars       smallint    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, reviewer_id)
);

-- ── Ride stats (single-row counter, O(1) reads) ───────────────

CREATE TABLE IF NOT EXISTS public.ride_stats (
  id                bool        PRIMARY KEY DEFAULT true CHECK (id),
  completed_rides   bigint      NOT NULL DEFAULT 0,
  total_distance_km numeric(14, 1) NOT NULL DEFAULT 0
);

INSERT INTO public.ride_stats DEFAULT VALUES
  ON CONFLICT DO NOTHING;

-- ── Functions ─────────────────────────────────────────────────

-- Haversine distance in km (immutable — Postgres can cache/inline it)
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 float8, lng1 float8,
  lat2 float8, lng2 float8
) RETURNS float8 LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371.0 * 2 * asin(sqrt(
    sin(radians((lat2 - lat1) / 2)) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) *
    sin(radians((lng2 - lng1) / 2)) ^ 2
  ))
$$;

-- Atomically accept a guest request.
-- Uses FOR UPDATE SKIP LOCKED: two concurrent drivers can never both succeed.
-- Returns { accepted: true, ride_id, price_eur } or { accepted: false, reason }.
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
  v_guest_id        uuid;
  v_pickup_location text;
  v_destination     text;
  v_price_eur       numeric(8, 2);
  v_ride_id         uuid;
BEGIN
  SELECT guest_id, pickup_location, destination, price_eur
    INTO v_guest_id, v_pickup_location, v_destination, v_price_eur
    FROM guest_requests
   WHERE id = p_request_id
     AND status = 'waiting'
   FOR UPDATE SKIP LOCKED;

  IF v_guest_id IS NULL THEN
    RETURN json_build_object('accepted', false, 'reason', 'already_taken');
  END IF;

  INSERT INTO rides (driver_id, guest_id, status, pickup_location, destination, price_eur)
  VALUES (p_driver_id, v_guest_id, 'pending', v_pickup_location, v_destination, v_price_eur)
  RETURNING id INTO v_ride_id;

  DELETE FROM guest_requests WHERE id = p_request_id;

  RETURN json_build_object(
    'accepted',  true,
    'ride_id',   v_ride_id,
    'price_eur', v_price_eur
  );
END;
$$;

-- Trigger: increment stats when a ride reaches 'completed'
CREATE OR REPLACE FUNCTION public.trg_ride_stats()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  dist float8 := 0;
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status <> 'completed') THEN
    BEGIN
      IF NEW.pickup_location IS NOT NULL AND NEW.pickup_location <> ''
         AND NEW.destination  IS NOT NULL AND NEW.destination  <> ''
      THEN
        dist := public.haversine_km(
          split_part(NEW.pickup_location, ',', 1)::float8,
          split_part(NEW.pickup_location, ',', 2)::float8,
          split_part(NEW.destination,     ',', 1)::float8,
          split_part(NEW.destination,     ',', 2)::float8
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      dist := 0;
    END;

    UPDATE public.ride_stats
       SET completed_rides   = completed_rides   + 1,
           total_distance_km = total_distance_km + dist
     WHERE id = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rides_stats_trg ON public.rides;
CREATE TRIGGER rides_stats_trg
  AFTER INSERT OR UPDATE OF status ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.trg_ride_stats();

-- Public stats — single round-trip for the landing page counters
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS json LANGUAGE sql STABLE AS $$
  SELECT json_build_object(
    'completed_rides',   s.completed_rides,
    'total_distance_km', s.total_distance_km,
    'total_users', (SELECT COUNT(*) FROM public.users)
  )
  FROM public.ride_stats s
  WHERE s.id = true
$$;
