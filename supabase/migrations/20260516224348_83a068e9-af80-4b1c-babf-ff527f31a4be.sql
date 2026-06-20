ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
ADD COLUMN IF NOT EXISTS telegram_message_id bigint,
ADD COLUMN IF NOT EXISTS telegram_notified_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_orders_telegram_notified
ON public.orders (telegram_notified_at)
WHERE telegram_notified_at IS NOT NULL;