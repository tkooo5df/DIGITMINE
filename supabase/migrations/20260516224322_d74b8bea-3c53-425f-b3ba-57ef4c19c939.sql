ALTER TABLE public.payment_receipts
ADD COLUMN IF NOT EXISTS telegram_notified_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_payment_receipts_telegram_notified
ON public.payment_receipts (telegram_notified_at)
WHERE telegram_notified_at IS NOT NULL;