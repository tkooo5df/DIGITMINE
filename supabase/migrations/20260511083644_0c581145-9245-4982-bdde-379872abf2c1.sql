
-- enable realtime for order chat
ALTER TABLE public.order_messages REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='order_messages';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.order_messages';
  END IF;
END $$;

-- storage policies for receipts bucket: users can upload/read in their own folder (user_id/...)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='users upload own receipts') THEN
    CREATE POLICY "users upload own receipts" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id='receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='users read own receipts') THEN
    CREATE POLICY "users read own receipts" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id='receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
  END IF;
END $$;
