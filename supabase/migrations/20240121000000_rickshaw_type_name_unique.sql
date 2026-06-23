-- Admin-managed rickshaw models can share the same capacity. The model name is
-- the stable unique business key; capacity and price can vary independently.
DROP INDEX IF EXISTS public.rickshaw_types_capacity_key;

CREATE UNIQUE INDEX IF NOT EXISTS rickshaw_types_name_key
  ON public.rickshaw_types (lower(name));
