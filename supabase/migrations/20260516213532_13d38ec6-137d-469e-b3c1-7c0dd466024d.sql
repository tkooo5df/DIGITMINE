
ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT;

CREATE TABLE IF NOT EXISTS public.telegram_admin_state (
  chat_id BIGINT PRIMARY KEY,
  awaiting_note_order_id UUID,
  awaiting_note_receipt_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_admin_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage telegram state"
ON public.telegram_admin_state
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
