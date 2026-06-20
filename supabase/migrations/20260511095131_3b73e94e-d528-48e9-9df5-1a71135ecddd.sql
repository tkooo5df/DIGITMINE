ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;