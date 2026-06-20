drop function if exists public.confirm_order_receipt(uuid);

create or replace function public.prevent_customer_order_tampering()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if auth.uid() = old.user_id
    and old.status = 'delivered'
    and new.status = 'completed'
    and old.delivered_payload is not null
    and new.id = old.id
    and new.order_number = old.order_number
    and new.user_id = old.user_id
    and new.product_id = old.product_id
    and new.offer_id = old.offer_id
    and new.quantity = old.quantity
    and new.unit_price_usd = old.unit_price_usd
    and new.total_usd = old.total_usd
    and new.total_dzd = old.total_dzd
    and new.exchange_rate_used = old.exchange_rate_used
    and new.payment_method = old.payment_method
    and new.payment_status = old.payment_status
    and new.delivery_type = old.delivery_type
    and new.coupon_id is not distinct from old.coupon_id
    and new.internal_notes is not distinct from old.internal_notes
    and new.delivered_payload is not distinct from old.delivered_payload
    and new.delivered_at is not distinct from old.delivered_at
    and new.created_at = old.created_at
  then
    new.updated_at = now();
    return new;
  end if;

  raise exception 'Only receipt confirmation is allowed';
end;
$$;

revoke all on function public.prevent_customer_order_tampering() from public;
revoke all on function public.prevent_customer_order_tampering() from anon;
revoke all on function public.prevent_customer_order_tampering() from authenticated;

drop trigger if exists prevent_customer_order_tampering on public.orders;
create trigger prevent_customer_order_tampering
before update on public.orders
for each row
execute function public.prevent_customer_order_tampering();

drop policy if exists "users confirm delivered orders" on public.orders;
create policy "users confirm delivered orders"
on public.orders
for update
to authenticated
using (
  user_id = auth.uid()
  and status = 'delivered'
  and delivered_payload is not null
)
with check (
  user_id = auth.uid()
  and status = 'completed'
);