-- Immediate launch flow: kitchens activate on registration and meal orders confirm instantly.
-- Safe to apply once after free_launch.sql and subscription_order_guards.sql.

create or replace function public.activate_new_kitchen_immediately()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.status='pending' then
    update public.chefs
       set status='active',
           membership_type='honorary',
           membership_status='active'
     where id=new.id;
  end if;
  return new;
end
$$;

drop trigger if exists activate_new_kitchen_immediately on public.chefs;
create trigger activate_new_kitchen_immediately
after insert on public.chefs
for each row execute function public.activate_new_kitchen_immediately();

-- During the free launch a kitchen is public as soon as it is active.
-- We do not fake phone verification; the verification flag remains available for later trust controls.
drop policy if exists public_read_active_chefs on public.chefs;
create policy public_read_active_chefs on public.chefs
for select to anon,authenticated
using (
  status='active'
  and membership_status='active'
  and public.chef_subscription_valid(id)
);

-- Public meal offers inherit the same immediate-active rule.
drop policy if exists meal_offers_public on public.meal_offers;
create policy meal_offers_public on public.meal_offers
for select to anon,authenticated
using (
  active
  and order_until>now()
  and exists (
    select 1
      from public.chefs c
     where c.id=chef_id
       and c.status='active'
       and c.membership_status='active'
       and public.chef_subscription_valid(c.id)
  )
);

create or replace function public.place_meal_order(
  p_offer_id uuid,
  p_quantity integer,
  p_customer jsonb,
  p_fulfilment text,
  p_access_token text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  o public.meal_offers;
  c public.chefs;
  v_id uuid:=gen_random_uuid();
  v_ref text;
  v_hash text;
  v_fee numeric;
  v_phone text:=trim(p_customer->>'phone');
  prior public.orders;
begin
  if p_access_token is null or p_access_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid access token';
  end if;

  v_hash:=public._chef_session_hash(p_access_token);
  perform pg_advisory_xact_lock(hashtextextended(v_hash,0));

  select r.* into prior
    from public.orders r
    join public.order_access a on a.order_id=r.id
   where a.token_hash=v_hash;
  if prior.id is not null then
    return jsonb_build_object('order_ref',prior.order_ref,'total',prior.total,'status',prior.status);
  end if;

  if p_quantity is null or p_quantity not between 1 and 50
     or coalesce(v_phone,'') !~ '^0[5-7][0-9]{8}$'
     or length(trim(coalesce(p_customer->>'name',''))) not between 2 and 100 then
    raise exception 'invalid customer';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_phone,1));
  if (select count(*) from public.orders where customer_phone=v_phone and created_at>now()-interval '1 hour')>=5 then
    raise exception 'too many requests';
  end if;

  select * into o from public.meal_offers where id=p_offer_id for update;
  if o.id is null then raise exception 'offer unavailable'; end if;
  select * into c from public.chefs where id=o.chef_id for share;

  if not public.chef_subscription_valid(c.id)
     or not o.active
     or o.order_until<=now()
     or p_quantity>o.quantity-o.allocated
     or c.status is distinct from 'active'
     or c.membership_status is distinct from 'active'
     or coalesce(c.membership_type,'') not in ('honorary','paid') then
    raise exception 'offer unavailable';
  end if;

  if p_fulfilment is null or p_fulfilment not in ('pickup','delivery')
     or (o.fulfilment_type<>'both' and o.fulfilment_type<>p_fulfilment) then
    raise exception 'invalid fulfilment';
  end if;

  if p_fulfilment='delivery' and (
       not coalesce((p_customer->>'area')=any(o.delivery_areas),false)
       or length(trim(coalesce(p_customer->>'address',''))) not between 5 and 500
     ) then
    raise exception 'invalid delivery address';
  end if;

  if length(coalesce(p_customer->>'notes',''))>1000 then
    raise exception 'notes too long';
  end if;

  v_fee:=case when p_fulfilment='delivery' then o.delivery_fee else 0 end;
  v_ref:='OF-'||replace(v_id::text,'-','');

  -- Reserve portions atomically at checkout. No later kitchen-accept step exists for new orders.
  update public.meal_offers
     set allocated=allocated+p_quantity
   where id=o.id;

  insert into public.orders(
    id,order_ref,chef_id,chef_name,dish_name,customer_name,customer_phone,
    customer_address,notes,status,offer_id,quantity,unit_price,delivery_fee,total,
    fulfilment_type,delivery_area,ready_at,order_until
  ) values (
    v_id,v_ref,c.id,c.name,o.dish_name,trim(p_customer->>'name'),v_phone,
    case when p_fulfilment='delivery' then trim(p_customer->>'address') else 'الاستلام من المطبخ' end,
    p_customer->>'notes','accepted',o.id,p_quantity,o.price,v_fee,
    o.price*p_quantity+v_fee,p_fulfilment,p_customer->>'area',o.ready_at,o.order_until
  );

  insert into public.order_access values(v_id,v_hash);
  return jsonb_build_object('order_ref',v_ref,'total',o.price*p_quantity+v_fee,'status','accepted');
end
$$;

create or replace function public.customer_meal_action(
  p_access_token text,
  p_action text,
  p_text text default '',
  p_received boolean default null,
  p_repeat boolean default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.orders;
  o public.meal_offers;
begin
  select ord.* into r
    from public.orders ord
    join public.order_access a on a.order_id=ord.id
   where a.token_hash=public._chef_session_hash(p_access_token)
   for update of ord;

  if r.id is null then raise exception 'order not found'; end if;
  if length(coalesce(p_text,''))>2000 then raise exception 'text too long'; end if;

  if p_action='cancel' and r.status in ('pending','accepted') and r.order_until>now() then
    if r.status='accepted' then
      select * into o from public.meal_offers where id=r.offer_id for update;
      update public.meal_offers
         set allocated=greatest(0,allocated-r.quantity)
       where id=r.offer_id;
    end if;
    update public.orders
       set status='cancelled',status_reason='ألغاه الزبون قبل بدء التحضير',updated_at=now()
     where id=r.id;
  elsif p_action='feedback' and r.status='delivered' and p_received is not null and p_repeat is not null then
    update public.orders
       set feedback=p_text,received_confirmed=p_received,would_repeat=p_repeat,updated_at=now()
     where id=r.id;
  elsif p_action='complaint' and length(trim(coalesce(p_text,'')))>=5 then
    update public.orders
       set complaint=p_text,complaint_resolved_at=null,updated_at=now()
     where id=r.id;
  else
    raise exception 'invalid action';
  end if;
end
$$;

-- Convert still-valid legacy pending orders from the preview to the new immediate-confirm model.
do $$
declare
  r public.orders;
  o public.meal_offers;
begin
  for r in
    select * from public.orders
     where offer_id is not null and status='pending' and order_until>now()
     order by created_at,id
  loop
    select * into o from public.meal_offers where id=r.offer_id for update;
    if o.id is not null and o.active and o.order_until>now() and o.quantity-o.allocated>=r.quantity then
      update public.meal_offers set allocated=allocated+r.quantity where id=o.id;
      update public.orders set status='accepted',status_reason=null,updated_at=now() where id=r.id;
    else
      update public.orders
         set status='cancelled',status_reason='تعذر تأكيد الطلب تلقائيًا بعد تحديث نظام الحجز',updated_at=now()
       where id=r.id;
    end if;
  end loop;
end
$$;

revoke all on function public.activate_new_kitchen_immediately() from public,anon,authenticated;
