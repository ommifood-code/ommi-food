-- Free launch: activate new kitchens, never auto-confirm customer orders.
create function public.kitchen_phone_required() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select billing_enabled from public.subscription_settings where id),true)
$$;
revoke all on function public.kitchen_phone_required() from public;
grant execute on function public.kitchen_phone_required() to anon,authenticated;

create or replace function public.enforce_chef_publication_verification() returns trigger
language plpgsql set search_path='public' as $$
begin
 if public.kitchen_phone_required() and new.status='active' and new.membership_status='active'
 and new.membership_type in ('honorary','paid') and coalesce(new.phone_verified,false)=false then
 raise exception 'Phone must be verified before publication';
 end if;
 return new;
end $$;
revoke all on function public.enforce_chef_publication_verification() from public,anon,authenticated;
alter policy public_read_active_chefs on public.chefs using
 (status='active' and membership_status='active' and (phone_verified or not public.kitchen_phone_required()) and public.chef_subscription_valid(id));

CREATE OR REPLACE FUNCTION public.chef_meal_order_status(p_session_token text, p_order_id uuid, p_status text, p_reason text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.orders; o public.meal_offers; v_id uuid;
begin
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
 if not public.chef_subscription_valid(v_id) or not o.active or o.order_until<=now() or not exists(select 1 from public.chefs where id=v_id and status='active' and (phone_verified or not public.kitchen_phone_required()) and membership_status='active' and membership_type in ('honorary','paid')) then raise exception 'offer unavailable'; end if;
 if o.quantity-o.allocated<r.quantity then raise exception 'insufficient portions'; end if;
 update public.meal_offers set allocated=allocated+r.quantity where id=o.id;
 elsif p_status='cancelled' then
 update public.meal_offers set allocated=allocated-r.quantity where id=o.id;
 end if;
 update public.orders set status=p_status,status_reason=nullif(trim(p_reason),''),updated_at=now() where id=r.id;
end $function$;

CREATE OR REPLACE FUNCTION public.chef_register(p_name text, p_phone text, p_city text, p_city_label text, p_area text, p_gender text, p_pin text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_chef_id uuid;
  v_token text;
  v_phone text := trim(p_phone);
begin
  if nullif(trim(p_name),'') is null then raise exception 'invalid name'; end if;
  if v_phone !~ '^0[5-7][0-9]{8}$' then raise exception 'invalid phone'; end if;
  if p_gender not in ('f','m') then raise exception 'invalid gender'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'invalid pin'; end if;
  if nullif(trim(p_area),'') is null then raise exception 'invalid area'; end if;
  if exists(select 1 from public.chefs where phone=v_phone) then raise exception 'phone already registered'; end if;

  insert into public.chefs(name,phone,city,city_label,area,bio,gender,status,available,membership_type,membership_status)
  values(trim(p_name),v_phone,p_city,p_city_label,trim(p_area),null,p_gender,case when public.kitchen_phone_required() then 'pending' else 'active' end,false,case when public.kitchen_phone_required() then 'none' else 'honorary' end,case when public.kitchen_phone_required() then 'inactive' else 'active' end)
  returning id into v_chef_id;

  insert into public.chef_credentials(chef_id,pin_hash)
  values(v_chef_id, extensions.crypt(p_pin, extensions.gen_salt('bf', 10)));

  v_token := public._chef_new_session(v_chef_id);
  return jsonb_build_object('chef_id',v_chef_id,'session_token',v_token);
end;
$function$;

CREATE OR REPLACE FUNCTION public.place_meal_order(p_offer_id uuid, p_quantity integer, p_customer jsonb, p_fulfilment text, p_access_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.meal_offers; c public.chefs; v_id uuid:=gen_random_uuid(); v_ref text; v_hash text; v_fee numeric; v_phone text:=trim(p_customer->>'phone'); prior public.orders;
begin
 if p_access_token is null or p_access_token !~ '^[0-9a-f]{64}$' then raise exception 'invalid access token'; end if;
 v_hash:=public._chef_session_hash(p_access_token);
 perform pg_advisory_xact_lock(hashtextextended(v_hash,0));
 select r.* into prior from public.orders r join public.order_access a on a.order_id=r.id where a.token_hash=v_hash;
 if prior.id is not null then return jsonb_build_object('order_ref',prior.order_ref,'total',prior.total); end if;
 if p_quantity is null or p_quantity not between 1 and 50 or coalesce(v_phone,'') !~ '^0[5-7][0-9]{8}$'
 or length(trim(coalesce(p_customer->>'name',''))) not between 2 and 100 then raise exception 'invalid customer'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_phone,1));
 if (select count(*) from public.orders where customer_phone=v_phone and created_at>now()-interval '1 hour')>=5 then raise exception 'too many requests'; end if;
 select * into o from public.meal_offers where id=p_offer_id for update;
 select * into c from public.chefs where id=o.chef_id for share;
 if not public.chef_subscription_valid(c.id) or o.id is null or not o.active or o.order_until<=now() or p_quantity>o.quantity-o.allocated
 or c.status is distinct from 'active' or (public.kitchen_phone_required() and c.phone_verified is distinct from true) or c.membership_status is distinct from 'active' or coalesce(c.membership_type,'') not in ('honorary','paid') then raise exception 'offer unavailable'; end if;
 if p_fulfilment is null or p_fulfilment not in ('pickup','delivery') or (o.fulfilment_type<>'both' and o.fulfilment_type<>p_fulfilment) then raise exception 'invalid fulfilment'; end if;
 if p_fulfilment='delivery' and (not coalesce((p_customer->>'area')=any(o.delivery_areas),false) or length(trim(coalesce(p_customer->>'address',''))) not between 5 and 500) then raise exception 'invalid delivery address'; end if;
 if length(coalesce(p_customer->>'notes',''))>1000 then raise exception 'notes too long'; end if;
 v_fee:=case when p_fulfilment='delivery' then o.delivery_fee else 0 end;
 v_ref:='OF-'||replace(v_id::text,'-','');
 insert into public.orders(id,order_ref,chef_id,chef_name,dish_name,customer_name,customer_phone,customer_address,notes,status,
 offer_id,quantity,unit_price,delivery_fee,total,fulfilment_type,delivery_area,ready_at,order_until)
 values(v_id,v_ref,c.id,c.name,o.dish_name,trim(p_customer->>'name'),v_phone,
 case when p_fulfilment='delivery' then trim(p_customer->>'address') else 'الاستلام من المطبخ' end,p_customer->>'notes','pending',
 o.id,p_quantity,o.price,v_fee,o.price*p_quantity+v_fee,p_fulfilment,p_customer->>'area',o.ready_at,o.order_until);
 insert into public.order_access values(v_id,v_hash);
 return jsonb_build_object('order_ref',v_ref,'total',o.price*p_quantity+v_fee);
end $function$;
