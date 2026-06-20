create or replace function public.prevent_customer_order_tampering()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_same_order_data boolean;
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  v_same_order_data := auth.uid() = old.user_id
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
    and new.delivery_type = old.delivery_type
    and new.coupon_id is not distinct from old.coupon_id
    and new.internal_notes is not distinct from old.internal_notes
    and new.delivered_payload is not distinct from old.delivered_payload
    and new.delivered_at is not distinct from old.delivered_at
    and new.created_at = old.created_at;

  if v_same_order_data
    and old.status = 'delivered'
    and new.status = 'completed'
    and new.payment_status = old.payment_status
    and old.delivered_payload is not null
  then
    new.updated_at = now();
    return new;
  end if;

  if v_same_order_data
    and old.payment_status = 'pending'
    and new.payment_status = 'submitted'
    and new.status = 'submitted'
    and exists (
      select 1 from public.payment_receipts r
      where r.order_id = old.id and r.user_id = auth.uid()
    )
  then
    new.updated_at = now();
    return new;
  end if;

  raise exception 'Only payment submission or receipt confirmation is allowed';
end;
$$;

revoke all on function public.prevent_customer_order_tampering() from public;
revoke all on function public.prevent_customer_order_tampering() from anon;
revoke all on function public.prevent_customer_order_tampering() from authenticated;

with target_order as (
  select id
  from public.orders
  where order_number = 'VLT-260511-1e73f'
)
update public.orders o
set payment_status = 'submitted', updated_at = now()
from target_order t
where o.id = t.id
  and o.payment_status = 'pending'
  and exists (select 1 from public.payment_receipts r where r.order_id = o.id);

with target_order as (
  select id
  from public.orders
  where order_number = 'VLT-260511-1e73f'
), duplicate_confirms as (
  select m.id,
         row_number() over (partition by m.order_id, m.body order by m.created_at asc) as rn
  from public.order_messages m
  join target_order t on t.id = m.order_id
  where m.body = '✅ أكدت استلام المنتج. شكراً لكم!'
)
delete from public.order_messages m
using duplicate_confirms d
where m.id = d.id
  and d.rn > 1;