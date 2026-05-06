


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."ride_status" AS ENUM (
    'open',
    'accepted',
    'cancelled',
    'completed'
);


ALTER TYPE "public"."ride_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'driver',
    'customer'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


COMMENT ON TYPE "public"."user_role" IS 'Mögliche Rollen { driver, customer } Rolle für die Users der Rider.App';



CREATE OR REPLACE FUNCTION "public"."accept_ride"("p_driver_id" "uuid", "p_request_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_guest_id        uuid;
  v_pickup_location text;
  v_destination     text;
  v_price_eur       numeric(8, 2);
  v_pickup_code     varchar(4);
  v_ride_id         uuid;
BEGIN
  SELECT guest_id, pickup_location, destination, price_eur, pickup_code
    INTO v_guest_id, v_pickup_location, v_destination, v_price_eur, v_pickup_code
    FROM guest_requests
   WHERE id = p_request_id
     AND status = 'waiting'
   FOR UPDATE SKIP LOCKED;

  IF v_guest_id IS NULL THEN
    RETURN json_build_object('accepted', false, 'reason', 'already_taken');
  END IF;

  INSERT INTO rides (driver_id, guest_id, status, pickup_location, destination, price_eur, pickup_code)
  VALUES (p_driver_id, v_guest_id, 'pending', v_pickup_location, v_destination, v_price_eur, v_pickup_code)
  RETURNING id INTO v_ride_id;

  DELETE FROM guest_requests WHERE id = p_request_id;

  RETURN json_build_object(
    'accepted',  true,
    'ride_id',   v_ride_id,
    'price_eur', v_price_eur
  );
END;
$$;


ALTER FUNCTION "public"."accept_ride"("p_driver_id" "uuid", "p_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."atomic_match_ride"("p_role" "text", "p_record_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_driver_id       uuid;
  v_guest_id        uuid;
  v_availability_id uuid;
  v_request_id      uuid;
  v_ride_id         uuid;
  v_pickup_code     text;
BEGIN
  IF p_role = 'driver' THEN
    SELECT id, guest_id
      INTO v_request_id, v_guest_id
      FROM guest_requests
     WHERE status = 'waiting'
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;

    IF v_request_id IS NULL THEN
      RETURN json_build_object('matched', false);
    END IF;

    SELECT driver_id
      INTO v_driver_id
      FROM driver_availability
     WHERE id = p_record_id
     FOR UPDATE;

    v_availability_id := p_record_id;

  ELSE
    SELECT id, driver_id
      INTO v_availability_id, v_driver_id
      FROM driver_availability
     WHERE status = 'available'
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED;

    IF v_availability_id IS NULL THEN
      RETURN json_build_object('matched', false);
    END IF;

    SELECT guest_id
      INTO v_guest_id
      FROM guest_requests
     WHERE id = p_record_id
     FOR UPDATE;

    v_request_id := p_record_id;
  END IF;

  -- Generate a unique 4-digit pickup code (with leading zeros)
  v_pickup_code := lpad(floor(random() * 10000)::text, 4, '0');

  INSERT INTO rides (driver_id, guest_id, status, pickup_code)
  VALUES (v_driver_id, v_guest_id, 'pending', v_pickup_code)
  RETURNING id INTO v_ride_id;

  DELETE FROM driver_availability WHERE id = v_availability_id;
  DELETE FROM guest_requests WHERE id = v_request_id;

  RETURN json_build_object('matched', true, 'ride_id', v_ride_id);
END;
$$;


ALTER FUNCTION "public"."atomic_match_ride"("p_role" "text", "p_record_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_ride"("p_ride_id" "uuid", "p_location" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE rides
     SET status              = 'completed',
         actual_end_location = NULLIF(p_location, '')
   WHERE id        = p_ride_id
     AND driver_id = auth.uid()
     AND status    = 'picked_up';
END;
$$;


ALTER FUNCTION "public"."complete_ride"("p_ride_id" "uuid", "p_location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_pickup"("p_ride_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE rides
     SET status = 'picked_up'
   WHERE id       = p_ride_id
     AND guest_id = auth.uid()
     AND status   = 'pending';
END;
$$;


ALTER FUNCTION "public"."confirm_pickup"("p_ride_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_pickup_by_driver"("p_ride_id" "uuid", "p_code" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE rides
     SET status = 'picked_up'
   WHERE id        = p_ride_id
     AND driver_id = auth.uid()
     AND status    = 'pending'
     AND pickup_code = p_code;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;


ALTER FUNCTION "public"."confirm_pickup_by_driver"("p_ride_id" "uuid", "p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_stats"() RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
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


ALTER FUNCTION "public"."get_public_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) RETURNS double precision
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT 6371.0 * 2 * asin(sqrt(
    sin(radians((lat2 - lat1) / 2)) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) *
    sin(radians((lng2 - lng1) / 2)) ^ 2
  ))
$$;


ALTER FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.user_profile (user_id, first_name, family_name, role, currently_working)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'family_name',
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'customer'::public.user_role
    ),
    false
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."insert_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_ride_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."trg_ride_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_pickup_code"("p_ride_id" "uuid", "p_code" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_stored_code text;
  v_driver_id   uuid;
BEGIN
  SELECT pickup_code, driver_id
    INTO v_stored_code, v_driver_id
    FROM rides
   WHERE id = p_ride_id
     AND status = 'pending';

  IF v_stored_code IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Fahrt nicht gefunden');
  END IF;

  IF v_driver_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Nicht autorisiert');
  END IF;

  IF v_stored_code != p_code THEN
    RETURN json_build_object('success', false, 'error', 'Falscher Code');
  END IF;

  UPDATE rides SET status = 'active' WHERE id = p_ride_id;

  RETURN json_build_object('success', true);
END;
$$;


ALTER FUNCTION "public"."verify_pickup_code"("p_ride_id" "uuid", "p_code" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."driver_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "location" "text",
    "ride_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "driver_availability_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'matched'::"text"])))
);


ALTER TABLE "public"."driver_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guest_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'waiting'::"text" NOT NULL,
    "pickup_location" "text",
    "ride_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "destination" "text",
    "price_eur" numeric(8,2),
    "pickup_code" character varying(4),
    CONSTRAINT "guest_requests_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'matched'::"text"])))
);


ALTER TABLE "public"."guest_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ride_id" "uuid" NOT NULL,
    "reporter_id" "uuid" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ride_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_request" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "driver_id" "uuid",
    "pickup_location" "text" NOT NULL,
    "dropoff_location" "text" NOT NULL,
    "status" "public"."ride_status" DEFAULT 'open'::"public"."ride_status" NOT NULL,
    "accepted_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone
);


ALTER TABLE "public"."ride_request" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ride_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "reviewee_id" "uuid" NOT NULL,
    "stars" smallint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ride_reviews_stars_check" CHECK ((("stars" >= 1) AND ("stars" <= 5)))
);


ALTER TABLE "public"."ride_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ride_stats" (
    "id" boolean DEFAULT true NOT NULL,
    "completed_rides" bigint DEFAULT 0 NOT NULL,
    "total_distance_km" numeric(14,1) DEFAULT 0 NOT NULL,
    CONSTRAINT "ride_stats_id_check" CHECK ("id")
);


ALTER TABLE "public"."ride_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "driver_id" "uuid" NOT NULL,
    "guest_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pickup_location" "text",
    "destination" "text",
    "actual_end_location" "text",
    "price_eur" numeric(8,2),
    "pickup_code" "text",
    CONSTRAINT "rides_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'picked_up'::"text", 'active'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."rides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todos" (
    "id" bigint NOT NULL,
    "name" character varying DEFAULT 'TEST'::character varying NOT NULL
);


ALTER TABLE "public"."todos" OWNER TO "postgres";


ALTER TABLE "public"."todos" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."todos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_profile" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" character varying,
    "family_name" character varying,
    "currently_working" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "public"."user_role" DEFAULT 'customer'::"public"."user_role" NOT NULL
);


ALTER TABLE "public"."user_profile" OWNER TO "postgres";


ALTER TABLE ONLY "public"."driver_availability"
    ADD CONSTRAINT "driver_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guest_requests"
    ADD CONSTRAINT "guest_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ride_reports"
    ADD CONSTRAINT "ride_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ride_request"
    ADD CONSTRAINT "ride_request_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ride_reviews"
    ADD CONSTRAINT "ride_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ride_reviews"
    ADD CONSTRAINT "ride_reviews_ride_id_reviewer_id_key" UNIQUE ("ride_id", "reviewer_id");



ALTER TABLE ONLY "public"."ride_stats"
    ADD CONSTRAINT "ride_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rides"
    ADD CONSTRAINT "rides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todos"
    ADD CONSTRAINT "todos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profile"
    ADD CONSTRAINT "user_profile_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_profile"
    ADD CONSTRAINT "user_profile_user_id_key" UNIQUE ("user_id");



CREATE UNIQUE INDEX "uniq_driver_available" ON "public"."driver_availability" USING "btree" ("driver_id") WHERE ("status" = 'available'::"text");



CREATE UNIQUE INDEX "uniq_guest_waiting" ON "public"."guest_requests" USING "btree" ("guest_id") WHERE ("status" = 'waiting'::"text");



CREATE OR REPLACE TRIGGER "rides_stats_trg" AFTER INSERT OR UPDATE OF "status" ON "public"."rides" FOR EACH ROW EXECUTE FUNCTION "public"."trg_ride_stats"();



ALTER TABLE ONLY "public"."driver_availability"
    ADD CONSTRAINT "driver_availability_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_availability"
    ADD CONSTRAINT "fk_driver_availability_ride" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."guest_requests"
    ADD CONSTRAINT "fk_guest_requests_ride" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."guest_requests"
    ADD CONSTRAINT "guest_requests_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_reports"
    ADD CONSTRAINT "ride_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_reports"
    ADD CONSTRAINT "ride_reports_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_request"
    ADD CONSTRAINT "ride_request_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_request"
    ADD CONSTRAINT "ride_request_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ride_reviews"
    ADD CONSTRAINT "ride_reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_reviews"
    ADD CONSTRAINT "ride_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ride_reviews"
    ADD CONSTRAINT "ride_reviews_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rides"
    ADD CONSTRAINT "rides_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."rides"
    ADD CONSTRAINT "rides_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_profile"
    ADD CONSTRAINT "user_profile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Authenticated users can read available drivers" ON "public"."driver_availability" FOR SELECT USING ((("auth"."uid"() IS NOT NULL) AND ("status" = 'available'::"text")));



CREATE POLICY "Customers and drivers can read relevant rides" ON "public"."ride_request" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "customer_id") OR ("auth"."uid"() = "driver_id") OR (("status" = 'open'::"public"."ride_status") AND (EXISTS ( SELECT 1
   FROM "public"."user_profile"
  WHERE (("user_profile"."user_id" = "auth"."uid"()) AND ("user_profile"."role" = 'driver'::"public"."user_role")))))));



CREATE POLICY "Customers can cancel own rides" ON "public"."ride_request" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "customer_id")) WITH CHECK (("auth"."uid"() = "customer_id"));



CREATE POLICY "Customers create own rides" ON "public"."ride_request" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "customer_id"));



CREATE POLICY "Driver can update ride request" ON "public"."ride_request" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Guest delete own requests" ON "public"."guest_requests" FOR DELETE TO "authenticated" USING (("guest_id" = "auth"."uid"()));



CREATE POLICY "Guest insert own requests" ON "public"."guest_requests" FOR INSERT TO "authenticated" WITH CHECK (("guest_id" = "auth"."uid"()));



CREATE POLICY "Ride participants can read" ON "public"."rides" FOR SELECT USING ((("driver_id" = "auth"."uid"()) OR ("guest_id" = "auth"."uid"())));



CREATE POLICY "Users can read own profile" ON "public"."user_profile" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can update own profile" ON "public"."user_profile" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users manage own availability" ON "public"."driver_availability" USING (("driver_id" = "auth"."uid"()));



CREATE POLICY "Users view requests" ON "public"."guest_requests" FOR SELECT TO "authenticated" USING ((("guest_id" = "auth"."uid"()) OR (("status" = 'waiting'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."user_profile"
  WHERE (("user_profile"."user_id" = "auth"."uid"()) AND ("user_profile"."role" = 'driver'::"public"."user_role")))))));



ALTER TABLE "public"."driver_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guest_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read" ON "public"."ride_stats" FOR SELECT USING (true);



ALTER TABLE "public"."ride_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ride_reports_insert" ON "public"."ride_reports" FOR INSERT WITH CHECK ((("reporter_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."rides"
  WHERE (("rides"."id" = "ride_reports"."ride_id") AND (("rides"."driver_id" = "auth"."uid"()) OR ("rides"."guest_id" = "auth"."uid"())))))));



CREATE POLICY "ride_reports_select" ON "public"."ride_reports" FOR SELECT USING (("reporter_id" = "auth"."uid"()));



ALTER TABLE "public"."ride_request" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ride_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ride_reviews_insert" ON "public"."ride_reviews" FOR INSERT WITH CHECK ((("reviewer_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."rides"
  WHERE (("rides"."id" = "ride_reviews"."ride_id") AND (("rides"."driver_id" = "auth"."uid"()) OR ("rides"."guest_id" = "auth"."uid"())))))));



CREATE POLICY "ride_reviews_select" ON "public"."ride_reviews" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."ride_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select allowed" ON "public"."todos" FOR SELECT USING (true);



ALTER TABLE "public"."todos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profile" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_ride"("p_driver_id" "uuid", "p_request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_ride"("p_driver_id" "uuid", "p_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_ride"("p_driver_id" "uuid", "p_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."atomic_match_ride"("p_role" "text", "p_record_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."atomic_match_ride"("p_role" "text", "p_record_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."atomic_match_ride"("p_role" "text", "p_record_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_ride"("p_ride_id" "uuid", "p_location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_ride"("p_ride_id" "uuid", "p_location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_ride"("p_ride_id" "uuid", "p_location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_pickup"("p_ride_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_pickup"("p_ride_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_pickup"("p_ride_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_pickup_by_driver"("p_ride_id" "uuid", "p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_pickup_by_driver"("p_ride_id" "uuid", "p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_pickup_by_driver"("p_ride_id" "uuid", "p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."haversine_km"("lat1" double precision, "lng1" double precision, "lat2" double precision, "lng2" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."insert_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_ride_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_ride_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_ride_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_pickup_code"("p_ride_id" "uuid", "p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_pickup_code"("p_ride_id" "uuid", "p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_pickup_code"("p_ride_id" "uuid", "p_code" "text") TO "service_role";



GRANT ALL ON TABLE "public"."driver_availability" TO "anon";
GRANT ALL ON TABLE "public"."driver_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_availability" TO "service_role";



GRANT ALL ON TABLE "public"."guest_requests" TO "anon";
GRANT ALL ON TABLE "public"."guest_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_requests" TO "service_role";



GRANT ALL ON TABLE "public"."ride_reports" TO "anon";
GRANT ALL ON TABLE "public"."ride_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_reports" TO "service_role";



GRANT ALL ON TABLE "public"."ride_request" TO "anon";
GRANT ALL ON TABLE "public"."ride_request" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_request" TO "service_role";



GRANT ALL ON TABLE "public"."ride_reviews" TO "anon";
GRANT ALL ON TABLE "public"."ride_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."ride_stats" TO "anon";
GRANT ALL ON TABLE "public"."ride_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."ride_stats" TO "service_role";



GRANT ALL ON TABLE "public"."rides" TO "anon";
GRANT ALL ON TABLE "public"."rides" TO "authenticated";
GRANT ALL ON TABLE "public"."rides" TO "service_role";



GRANT ALL ON TABLE "public"."todos" TO "anon";
GRANT ALL ON TABLE "public"."todos" TO "authenticated";
GRANT ALL ON TABLE "public"."todos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."todos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_profile" TO "anon";
GRANT ALL ON TABLE "public"."user_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profile" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







