-- Keep expired meal requests as history, but make `expired` authoritative.
-- No order is deleted. Expiry is normalized on customer/chef/admin access.

create or replace function public.expire_due_meal_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  update public.orders
     set status = 'expired',
         status_reason = coalesce(nullif(status_reason,''), 'انتهت مهلة قبول الطلب دون رد من المطبخ'),
         updated_at = now()
   where offer_id is not null
     and status = 'pending'
     and order_until is not null
     and order_until <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_due_meal_orders() from public, anon, authenticated;

create or replace function public.customer_meal_order(p_access_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r public.orders; v_contact text; v_pickup text;
begin
 perform public.expire_due_meal_orders();
 select o.* into r from public.orders o join public.order_access a on a.order_id=o.id where a.token_hash=public._chef_session_hash(p_access_token);
 if r.id is null then raise exception 'order not found'; end if;
 select phone into v_contact from public.chefs where id=r.chef_id;
 if r.status in ('accepted','preparing','ready','delivered') and r.fulfilment_type='pickup' then v_pickup:=r.pickup_snapshot; end if;
 return jsonb_build_object('order_ref',r.order_ref,'dish_name',r.dish_name,'chef_name',r.chef_name,'status',r.status,'quantity',r.quantity,'unit_price',r.unit_price,'delivery_fee',r.delivery_fee,'total',r.total,
 'serves',r.serves,'unit_label','طبق','ready_at',r.ready_at,'order_until',r.order_until,'fulfilment_type',r.fulfilment_type,'status_reason',r.status_reason,'chef_phone',v_contact,'pickup_instructions',v_pickup,
 'feedback',r.feedback,'received_confirmed',r.received_confirmed,'would_repeat',r.would_repeat,'complaint',r.complaint,'complaint_resolved_at',r.complaint_resolved_at);
end;
$$;

create or replace function public.chef_meal_orders(p_session_token text)
returns setof public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
 select chef_id into v_id from public.chef_sessions where token_hash=public._chef_session_hash(p_session_token) and expires_at>now();
 if v_id is null then raise exception 'invalid session'; end if;
 perform public.expire_due_meal_orders();
 return query select * from public.orders where chef_id=v_id and offer_id is not null order by created_at desc limit 200;
end;
$$;

create or replace function public.chef_meal_order_status(p_session_token text, p_order_id uuid, p_status text, p_reason text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r public.orders; o public.meal_offers; v_id uuid;
begin
 perform public.expire_due_meal_orders();
 select chef_id into v_id from public.chef_sessions where token_hash=public._chef_session_hash(p_session_token) and expires_at>now();
 if v_id is null then raise exception 'invalid session'; end if;
 select * into r from public.orders where id=p_order_id and chef_id=v_id and offer_id is not null for update;
 if r.id is null then raise exception 'order not found'; end if;
 if p_status=r.status then return; end if;
 if p_status is null or not((r.status='pending' and r.order_until>now() and p_status in ('accepted','rejected'))
 or (r.status='accepted' and p_status in ('preparing','cancelled')) or (r.status='preparing' and p_status in ('ready','cancelled'))
 or (r.status='ready' and p_status in ('delivered','cancelled'))) then raise exception 'invalid transition'; end if;
 if p_status in ('cancelled','rejected') and length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'reason required'; end if;
 select * into o from public.meal_offers where id=r.offer_id for update;
 if p_status='accepted' then
   if not public.chef_subscription_valid(v_id) or not o.active or not exists(select 1 from public.chefs where id=v_id and status='active' and (phone_verified or not public.kitchen_phone_required()) and membership_status='active' and membership_type in ('honorary','paid')) then raise exception 'offer unavailable'; end if;
 end if;
 update public.orders set status=p_status,status_reason=nullif(trim(p_reason),''),updated_at=now() where id=r.id;
end;
$$;

create or replace function public.customer_meal_action(p_access_token text, p_action text, p_text text default '', p_received boolean default null, p_repeat boolean default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r public.orders;
begin
 perform public.expire_due_meal_orders();
 select o.* into r from public.orders o join public.order_access a on a.order_id=o.id where a.token_hash=public._chef_session_hash(p_access_token) for update of o;
 if r.id is null then raise exception 'order not found'; end if;
 if length(coalesce(p_text,''))>2000 then raise exception 'text too long'; end if;
 if p_action='cancel' and r.status='pending' and r.order_until>now() then
   update public.orders set status='cancelled',status_reason='ألغاه الزبون قبل القبول',updated_at=now() where id=r.id;
 elsif p_action='feedback' and r.status='delivered' and p_received is not null and p_repeat is not null then
   update public.orders set feedback=p_text,received_confirmed=p_received,would_repeat=p_repeat,updated_at=now() where id=r.id;
 elsif p_action='complaint' and length(trim(coalesce(p_text,'')))>=5 then
   update public.orders set complaint=p_text,complaint_resolved_at=null,updated_at=now() where id=r.id;
 else raise exception 'invalid action'; end if;
end;
$$;

create or replace function public.admin_expire_due_meal_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 return public.expire_due_meal_orders();
end;
$$;
revoke all on function public.admin_expire_due_meal_orders() from public, anon;
grant execute on function public.admin_expire_due_meal_orders() to authenticated;
