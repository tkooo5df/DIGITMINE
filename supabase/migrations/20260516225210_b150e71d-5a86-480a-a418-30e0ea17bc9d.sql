ALTER TABLE public.telegram_admin_state
ADD COLUMN IF NOT EXISTS app_message_id bigint;