-- Allow admins to delete order messages (clear conversations)
CREATE POLICY "admins delete messages"
ON public.order_messages
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));