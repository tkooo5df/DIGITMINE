CREATE INDEX IF NOT EXISTS idx_order_messages_created_at_desc
ON public.order_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_messages_order_created_desc
ON public.order_messages (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
ON public.orders (created_at DESC);