create or replace function public.confirm_order_receipt(_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_already_completed boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;

  select exists (
    select 1
    from public.orders
    where id = _order_id
      and user_id = v_user_id
      and status = 'completed'
  ) into v_already_completed;

  if v_already_completed then
    return jsonb_build_object('ok', true, 'alreadyConfirmed', true);
  end if;

  update public.orders
  set status = 'completed', updated_at = now()
  where id = _order_id
    and user_id = v_user_id
    and delivered_payload is not null
    and status = 'delivered'
  returning id into v_order_id;

  if v_order_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_confirmable');
  end if;

  insert into public.order_messages (order_id, sender_id, is_admin, internal_note, body)
  values (v_order_id, v_user_id, false, false, '✅ أكدت استلام المنتج. شكراً لكم!');

  return jsonb_build_object('ok', true, 'alreadyConfirmed', false);
end;
$$;

grant execute on function public.confirm_order_receipt(uuid) to authenticated;