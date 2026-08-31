-- Allow the Rivo Admin support desk to read and manage customer problem reports.
-- The customer app remains restricted to the customer's own tickets.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customer_support_tickets'
      AND policyname = 'Super admins manage customer support tickets'
  ) THEN
    CREATE POLICY "Super admins manage customer support tickets"
      ON public.customer_support_tickets
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.admin_users a
          WHERE a.auth_user_id = auth.uid()
            AND a.role = 'super_admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.admin_users a
          WHERE a.auth_user_id = auth.uid()
            AND a.role = 'super_admin'
        )
      );
  END IF;
END
$$;
