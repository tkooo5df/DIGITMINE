
CREATE TABLE IF NOT EXISTS public.telegram_chat_prefs (
  chat_id bigint PRIMARY KEY,
  language text NOT NULL DEFAULT 'ar',
  currency text NOT NULL DEFAULT 'DZD',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telegram_chat_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage chat prefs"
ON public.telegram_chat_prefs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
