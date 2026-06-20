CREATE TABLE IF NOT EXISTS public.telegram_processed_updates (
  update_id bigint PRIMARY KEY,
  processed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_processed_updates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'telegram_processed_updates'
      AND policyname = 'admins manage processed telegram updates'
  ) THEN
    CREATE POLICY "admins manage processed telegram updates"
    ON public.telegram_processed_updates
    FOR ALL
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role))
    WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;