revoke all on function public.confirm_order_receipt(uuid) from public;
revoke all on function public.confirm_order_receipt(uuid) from anon;
grant execute on function public.confirm_order_receipt(uuid) to authenticated;