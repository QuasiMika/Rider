-- ── Stats table (single-row counter) ──────────────────────────────────────────
-- Reads are O(1). Writes happen only when a ride is completed (trigger below).

CREATE TABLE ride_stats (
  id               bool PRIMARY KEY DEFAULT true CHECK (id),  -- enforces single row
  completed_rides  bigint          NOT NULL DEFAULT 0,
  total_distance_km numeric(14, 1) NOT NULL DEFAULT 0
);

INSERT INTO ride_stats DEFAULT VALUES;

ALTER TABLE ride_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON ride_stats FOR SELECT USING (true);

-- ── Haversine (SQL, immutable — Postgres can cache/inline it) ─────────────────

CREATE OR REPLACE FUNCTION haversine_km(
  lat1 float8, lng1 float8,
  lat2 float8, lng2 float8
) RETURNS float8 LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371.0 * 2 * asin(sqrt(
    sin(radians((lat2 - lat1) / 2)) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) *
    sin(radians((lng2 - lng1) / 2)) ^ 2
  ))
$$;

-- ── Trigger: atomically increment counters on status → 'completed' ────────────

CREATE OR REPLACE FUNCTION trg_ride_stats()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  dist float8 := 0;
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status <> 'completed') THEN
    BEGIN
      IF NEW.pickup_location IS NOT NULL AND NEW.pickup_location <> ''
         AND NEW.destination  IS NOT NULL AND NEW.destination  <> ''
      THEN
        dist := haversine_km(
          split_part(NEW.pickup_location, ',', 1)::float8,
          split_part(NEW.pickup_location, ',', 2)::float8,
          split_part(NEW.destination,     ',', 1)::float8,
          split_part(NEW.destination,     ',', 2)::float8
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      dist := 0;  -- malformed coords must not abort the ride completion
    END;

    UPDATE ride_stats
    SET completed_rides   = completed_rides   + 1,
        total_distance_km = total_distance_km + dist
    WHERE id = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rides_stats_trg
AFTER INSERT OR UPDATE OF status ON rides
FOR EACH ROW EXECUTE FUNCTION trg_ride_stats();

-- ── Public RPC: single round-trip for all three stat values ──────────────────
-- SECURITY DEFINER so it can read pg_class (user count via reltuples = O(1)).
-- STABLE lets the planner cache the result within a transaction.

CREATE OR REPLACE FUNCTION get_public_stats()
RETURNS json LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT json_build_object(
    'completed_rides',   s.completed_rides,
    'total_distance_km', s.total_distance_km,
    'total_users', GREATEST(
      (
        SELECT reltuples::bigint
        FROM   pg_class c
        JOIN   pg_namespace n ON n.oid = c.relnamespace
        WHERE  c.relname  = 'user_profile'
          AND  n.nspname  = 'public'
          AND  c.relkind  = 'r'
      ), 0
    )
  )
  FROM ride_stats s
  WHERE s.id = true
$$;

GRANT EXECUTE ON FUNCTION get_public_stats() TO anon, authenticated;
