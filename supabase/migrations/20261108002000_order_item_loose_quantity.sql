-- Carry the measurement on an order line separately from package quantity.
-- Existing order_items.quantity continues to represent sellable packs / stock units.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS loose_quantity numeric(12,3),
  ADD COLUMN IF NOT EXISTS quantity_unit text;

COMMENT ON COLUMN public.order_items.loose_quantity IS 'Measured customer-selected quantity for loose products.';
COMMENT ON COLUMN public.order_items.quantity_unit IS 'Unit for loose_quantity, e.g. Gm, Kg, Ml or Ltr.';
