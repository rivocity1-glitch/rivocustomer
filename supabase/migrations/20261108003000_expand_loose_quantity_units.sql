-- Expand loose quantity units to support countable packaged items such as bottles and packs.
-- Existing gram/kilogram/millilitre/litre products remain valid.
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_loose_quantity_limits_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_loose_quantity_limits_check
  CHECK (
    allow_loose_quantity = false
    OR (
      loose_min_quantity IS NOT NULL
      AND loose_min_quantity > 0
      AND loose_max_quantity IS NOT NULL
      AND loose_max_quantity >= loose_min_quantity
      AND loose_step_quantity IS NOT NULL
      AND loose_step_quantity > 0
      AND loose_unit IN (
        'Gm', 'Kg', 'Ml', 'Ltr',
        'Pcs', 'Bottle', 'Pack', 'Unit', 'Set', 'Dozen'
      )
    )
  );

COMMENT ON COLUMN public.products.loose_unit IS
  'Loose order unit: Gm, Kg, Ml, Ltr, Pcs, Bottle, Pack, Unit, Set or Dozen.';

NOTIFY pgrst, 'reload schema';
