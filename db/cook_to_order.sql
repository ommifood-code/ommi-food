-- Cook to order: no stock; the customer requests the time, the cook accepts it.
-- No existing order is rewritten. New orders snapshot the portion and requested time.
alter table public.meal_offers add column serves integer check(serves between 1 and 1000);
alter table public.orders add column serves integer check(serves between 1 and 1000), add column admin_contacted_at timestamptz;
alter table public.meal_offers alter column ingredients drop not null;
alter table public.meal_offers drop constraint meal_offers_ingredients_check;
alter table public.meal_offers add constraint meal_ingredients_optional check(length(ingredients)<=2000);
drop policy meal_offers_public on public.meal_offers;
create policy meal_offers_public on public.meal_offers for select to anon,authenticated using(active and exists(select 1 from public.chefs c where c.id=chef_id and c.status='active'));
-- Retired stock columns are removed, not replaced by an unlimited dummy balance.
alter table public.meal_offers drop column quantity, drop column allocated, drop column order_until, drop column ready_at;
create or replace function public.meal_offer_create(p_session_token text,p_dish_index integer,p_offer jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.chefs;d jsonb;v_id uuid;v_mode text;v_serves integer;
begin
 select ch.* into c from public.chefs ch join public.chef_sessions s on s.chef_id=ch.id where s.token_hash=public._chef_session_hash(p_session_token) and s.expires_at>now() and ch.status='active' and ch.membership_status='active';
 if c.id is null then raise exception 'invalid session';end if;
 if p_dish_index is null or p_dish_index<0 then raise exception 'invalid dish';end if;
 d:=c.dishes->p_dish_index;
 if d is null or nullif(trim(d->>'name'),'') is null then raise exception 'invalid dish';end if;
 v_mode:=p_offer->>'fulfilment_type';v_serves:=(p_offer->>'serves')::integer;
 if v_serves is null or v_serves not between 1 and 1000 then raise exception 'invalid portion';end if;
 if v_mode is null or v_mode not in ('pickup','delivery','both') then raise exception 'invalid fulfilment';end if;
 if v_mode in ('pickup','both') and length(trim(coalesce(p_offer->>'pickup_instructions',''))) not between 5 and 1000 then raise exception 'pickup instructions required';end if;
 if v_mode in ('delivery','both') and (jsonb_typeof(p_offer->'delivery_areas') is distinct from 'array' or jsonb_array_length(p_offer->'delivery_areas') not between 1 and 30) then raise exception 'delivery areas required';end if;
 insert into public.meal_offers(chef_id,dish_name,price,image_url,portion,serves,ingredients,fulfilment_type,delivery_fee,delivery_areas)
 values(c.id,d->>'name',(d->>'price')::numeric,d->>'image_url','يكفي '||v_serves||' أشخاص',v_serves,nullif(trim(p_offer->>'ingredients'),''),v_mode,
 case when v_mode='pickup' then 0 else coalesce((p_offer->>'delivery_fee')::numeric,0) end,
 case when v_mode='pickup' then '{}'::text[] else array(select trim(jsonb_array_elements_text(p_offer->'delivery_areas'))) end) returning id into v_id;
 insert into public.meal_pickup_details values(v_id,coalesce(p_offer->>'pickup_instructions',''));return v_id;
end $$;
CREATE OR REPLACE FUNCTION public.place_meal_order(p_offer_id uuid, p_quantity integer, p_customer jsonb, p_fulfilment text, p_access_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.meal_offers; c public.chefs; v_id uuid:=gen_random_uuid(); v_ref text; v_hash text; v_fee numeric; v_phone text:=trim(p_customer->>'phone'); prior public.orders; v_requested timestamptz;
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
 if not public.chef_subscription_valid(c.id) or o.id is null or not o.active 
 or c.status is distinct from 'active' or (public.kitchen_phone_required() and c.phone_verified is distinct from true) or c.membership_status is distinct from 'active' or coalesce(c.membership_type,'') not in ('honorary','paid') then raise exception 'offer unavailable'; end if;
 if p_fulfilment is null or p_fulfilment not in ('pickup','delivery') or (o.fulfilment_type<>'both' and o.fulfilment_type<>p_fulfilment) then raise exception 'invalid fulfilment'; end if;
 if p_fulfilment='delivery' and (not coalesce((p_customer->>'area')=any(o.delivery_areas),false) or length(trim(coalesce(p_customer->>'address',''))) not between 5 and 500) then raise exception 'invalid delivery address'; end if;
 if length(coalesce(p_customer->>'notes',''))>1000 then raise exception 'notes too long'; end if;
 v_requested:=(p_customer->>'requested_at')::timestamptz;
 if v_requested is null or v_requested<=now() or v_requested>now()+interval '60 days' then raise exception 'invalid requested time';end if;
 v_fee:=case when p_fulfilment='delivery' then o.delivery_fee else 0 end;
 v_ref:='OF-'||replace(v_id::text,'-','');
 insert into public.orders(id,order_ref,chef_id,chef_name,dish_name,customer_name,customer_phone,customer_address,notes,status,
 offer_id,quantity,unit_price,delivery_fee,total,fulfilment_type,delivery_area,ready_at,order_until,serves)
 values(v_id,v_ref,c.id,c.name,o.dish_name,trim(p_customer->>'name'),v_phone,
 case when p_fulfilment='delivery' then trim(p_customer->>'address') else 'الاستلام من المطبخ' end,p_customer->>'notes','pending',
 o.id,p_quantity,o.price,v_fee,o.price*p_quantity+v_fee,p_fulfilment,p_customer->>'area',v_requested,v_requested,o.serves);
 insert into public.order_access values(v_id,v_hash);
 return jsonb_build_object('order_ref',v_ref,'total',o.price*p_quantity+v_fee);
end $function$
;
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
 if not public.chef_subscription_valid(v_id) or not o.active or not exists(select 1 from public.chefs where id=v_id and status='active' and (phone_verified or not public.kitchen_phone_required()) and membership_status='active' and membership_type in ('honorary','paid')) then raise exception 'offer unavailable'; end if;
 end if;
 update public.orders set status=p_status,status_reason=nullif(trim(p_reason),''),updated_at=now() where id=r.id;
end $function$
;
CREATE OR REPLACE FUNCTION public.customer_meal_order(p_access_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r public.orders; v_contact text; v_pickup text;
begin
 select o.* into r from public.orders o join public.order_access a on a.order_id=o.id where a.token_hash=public._chef_session_hash(p_access_token);
 if r.id is null then raise exception 'order not found'; end if;
 if r.status='pending' and r.order_until<=now() then r.status:='expired'; end if;
 select phone into v_contact from public.chefs where id=r.chef_id;
 if r.status in ('accepted','preparing','ready','delivered') then
 if r.fulfilment_type='pickup' then select instructions into v_pickup from public.meal_pickup_details where offer_id=r.offer_id; end if;
 end if;
 return jsonb_build_object('order_ref',r.order_ref,'dish_name',r.dish_name,'chef_name',r.chef_name,'status',r.status,'quantity',r.quantity,'unit_price',r.unit_price,'delivery_fee',r.delivery_fee,'total',r.total,
 'serves',r.serves,'unit_label','طبق','ready_at',r.ready_at,'order_until',r.order_until,'fulfilment_type',r.fulfilment_type,'status_reason',r.status_reason,'chef_phone',v_contact,'pickup_instructions',v_pickup,
 'feedback',r.feedback,'received_confirmed',r.received_confirmed,'would_repeat',r.would_repeat,'complaint',r.complaint,'complaint_resolved_at',r.complaint_resolved_at);
end $function$
;
create or replace function public.meal_offer_availability(p_session_token text,p_offer_id uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_active is null then raise exception 'invalid availability';end if;
 update public.meal_offers o set active=p_active where o.id=p_offer_id and exists(select 1 from public.chef_sessions s join public.chefs c on c.id=s.chef_id where s.chef_id=o.chef_id and s.expires_at>now() and s.token_hash=public._chef_session_hash(p_session_token) and c.status='active' and c.membership_status='active');
 if not found then raise exception 'invalid offer or session';end if;
end $$;
create or replace function public.admin_contacted_meal_order(p_order_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'unauthorized';end if;
 update public.orders set admin_contacted_at=now() where id=p_order_id and status='pending';
end $$;
revoke all on function public.meal_offer_availability(text,uuid,boolean),public.admin_contacted_meal_order(uuid) from public,anon,authenticated;
grant execute on function public.meal_offer_availability(text,uuid,boolean) to anon,authenticated;
grant execute on function public.admin_contacted_meal_order(uuid) to authenticated;
-- Reuse the cook's own pickup/delivery settings when adding another dish.
create or replace function public.chef_meal_defaults(p_session_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;result jsonb;
begin
 select chef_id into v_id from public.chef_sessions where token_hash=public._chef_session_hash(p_session_token) and expires_at>now();
 if v_id is null then raise exception 'invalid session';end if;
 select jsonb_build_object('fulfilment_type',o.fulfilment_type,'delivery_areas',o.delivery_areas,'delivery_fee',o.delivery_fee,'pickup_instructions',p.instructions) into result
 from public.meal_offers o left join public.meal_pickup_details p on p.offer_id=o.id where o.chef_id=v_id order by o.created_at desc limit 1;
 return result;
end $$;
revoke all on function public.chef_meal_defaults(text) from public;
grant execute on function public.chef_meal_defaults(text) to anon,authenticated;
