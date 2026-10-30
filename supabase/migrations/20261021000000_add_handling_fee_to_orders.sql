-- Stores the handling fee calculated at checkout so order totals remain auditable.
-- Apply this migration to the Supabase project before deploying the customer app.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS handling_fee numeric(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.handling_fee IS
  'Handling fee charged to the customer for this vendor order, in INR.';
