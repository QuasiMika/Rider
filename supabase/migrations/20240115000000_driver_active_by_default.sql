-- Drivers are active by default; only deactivated when reported
ALTER TABLE public.user_profile ALTER COLUMN currently_working SET DEFAULT true;

-- Activate all existing driver accounts that are still inactive
UPDATE public.user_profile SET currently_working = true WHERE role = 'driver' AND currently_working = false;
