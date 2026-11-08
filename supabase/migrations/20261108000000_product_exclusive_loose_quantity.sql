-- RivoCity product merchandising and loose-quantity options.
-- Safe additive migration: existing products remain unchanged and default to standard ordering.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_exclusive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_loose_quantity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loose_min_quantity numeric(12,3),
  ADD COLUMN IF NOT EXISTS loose_max_quantity numeric(12,3),
  ADD COLUMN IF NOT EXISTS loose_step_quantity numeric(12,3),
  ADD COLUMN IF NOT EXISTS loose_unit text;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_loose_quantity_limits_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_loose_quantity_limits_check
  CHECK (
    allow_loose_quantity = false
    OR (
      loose_min_quantity IS NOT NULL AND loose_min_quantity > 0
      AND loose_max_quantity IS NOT NULL AND loose_max_quantity >= loose_min_quantity
      AND loose_step_quantity IS NOT NULL AND loose_step_quantity > 0
      AND loose_unit IN ('Gm', 'Kg', 'Ml', 'Ltr')
    )
  );

COMMENT ON COLUMN public.products.is_exclusive IS 'Vendor marks product as a RivoCity exclusive for customer-facing merchandising.';
COMMENT ON COLUMN public.products.allow_loose_quantity IS 'Allows customers to order a measured quantity rather than a fixed pack.';
COMMENT ON COLUMN public.products.loose_min_quantity IS 'Minimum permitted quantity in loose_unit.';
COMMENT ON COLUMN public.products.loose_max_quantity IS 'Maximum permitted quantity in loose_unit.';
COMMENT ON COLUMN public.products.loose_step_quantity IS 'Allowed quantity increment in loose_unit.';
COMMENT ON COLUMN public.products.loose_unit IS 'Unit for loose quantity: Gm, Kg, Ml, or Ltr.';

CREATE INDEX IF NOT EXISTS idx_products_exclusive_active
  ON public.products (is_exclusive, status)
  WHERE is_exclusive = true;
