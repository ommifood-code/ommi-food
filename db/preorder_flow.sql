-- Scheduled meals and private order workflow. Existing kitchen/auth contracts stay intact.
create table public.meal_offers (
 id uuid primary key default gen_random_uuid(), chef_id uuid not null references public.chefs(id),
 dish_name text not null, price numeric(10,2) not null check(price>0 and price<=10000), image_url text,
 portion text not null check(length(portion) between 1 and 300),
 ingredients text not null check(length(ingredients) between 1 and 2000),
 allergens text not null check(length(allergens) between 1 and 1000),
 quantity integer not null check(quantity between 1 and 500), allocated integer not null default 0,
 order_until timestamptz not null, ready_at timestamptz not null,
 fulfilment_type text not null check(fulfilment_type in ('pickup','delivery','both')),
 delivery_fee numeric(10,2) not null default 0 check(delivery_fee between 0 and 1000),
 delivery_areas text[] not null default '{}', active boolean not null default true,
 created_at timestamptz not null default now(),
 check(allocated>=0 and allocated<=quantity), check(order_until<ready_at)
);
alter table public.meal_offers enable row level security;
create index meal_offers_chef_idx on public.meal_offers(chef_id);
create policy meal_offers_public on public.meal_offers for select to anon,authenticated
 using(active and order_until>now() and exists(select 1 from public.chefs c where c.id=chef_id
 and c.status='active'))); -- chefs RLS enforces verified phone and active membership
grant select on public.meal_offers to anon,authenticated;
revoke insert,update,delete on public.meal_offers from anon,authenticated;

-- Home pickup details are never part of the public offer.
create table public.meal_pickup_details(offer_id uuid primary key references public.meal_offers(id), instructions text not null);
alter table public.meal_pickup_details enable row level security;
revoke all on public.meal_pickup_details from anon,authenticated;

alter table public.orders add column offer_id uuid references public.meal_offers(id),
 add column quantity integer check(quantity between 1 and 50), add column unit_price numeric(10,2),
 add column delivery_fee numeric(10,2), add column total numeric(12,2),
 add column fulfilment_type text, add column delivery_area text,
 add column ready_at timestamptz, add column order_until timestamptz,
 add column updated_at timestamptz not null default now(), add column status_reason text,
 add column feedback text, add column received_confirmed boolean, add column would_repeat boolean,
 add column complaint text, add column complaint_resolved_at timestamptz;
create index orders_offer_idx on public.orders(offer_id);
create index orders_chef_idx on public.orders(chef_id);
create index orders_phone_created_idx on public.orders(customer_phone,created_at);
create table public.order_access(order_id uuid primary key references public.orders(id) on delete cascade,
 token_hash text not null unique);
alter table public.order_access enable row level security;
revoke all on public.order_access from anon,authenticated;
drop policy if exists "public read orders" on public.orders;
drop policy if exists "public insert orders" on public.orders;
alter table public.orders enable row level security;
create policy orders_admin_read on public.orders for select to authenticated using((select public.is_admin()));
revoke all on public.orders from anon;
revoke insert,update,delete on public.orders from authenticated;
grant select on public.orders to authenticated;

create function public.meal_offer_create(p_session_token text,p_dish_index integer,p_offer jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.chefs; d jsonb; k public.chef_kitchen_profiles; v_id uuid; v_mode text;
begin
 select ch.* into c from public.chefs ch join public.chef_sessions s on s.chef_id=ch.id
 where s.token_hash=public._chef_session_hash(p_session_token) and s.expires_at>now() and ch.status in ('pending','active');
 if c.id is null then raise exception 'invalid session'; end if;
 if p_dish_index is null or p_dish_index<0 then raise exception 'invalid dish'; end if;
 d:=c.dishes->p_dish_index;
 if d is null or nullif(trim(d->>'name'),'') is null then raise exception 'invalid dish'; end if;
 select * into k from public.chef_kitchen_profiles where chef_id=c.id;
 v_mode:=p_offer->>'fulfilment_type';
 if v_mode is null or k.fulfilment_type is null or not(v_mode=k.fulfilment_type or (k.fulfilment_type='both' and v_mode in ('pickup','delivery','both'))) then raise exception 'invalid fulfilment'; end if;
 if (p_offer->>'order_until')::timestamptz<=now() or (p_offer->>'ready_at')::timestamptz>now()+interval '60 days' then raise exception 'invalid dates'; end if;
 if v_mode in ('pickup','both') and length(trim(coalesce(p_offer->>'pickup_instructions',''))) not between 5 and 1000 then raise exception 'pickup instructions required'; end if;
 if v_mode in ('delivery','both') and (jsonb_typeof(p_offer->'delivery_areas') is distinct from 'array' or jsonb_array_length(p_offer->'delivery_areas') not between 1 and 30) then raise exception 'delivery areas required'; end if;
 insert into public.meal_offers(chef_id,dish_name,price,image_url,portion,ingredients,allergens,quantity,order_until,ready_at,fulfilment_type,delivery_fee,delivery_areas)
 values(c.id,d->>'name',(d->>'price')::numeric,d->>'image_url',trim(p_offer->>'portion'),trim(p_offer->>'ingredients'),trim(p_offer->>'allergens'),
 (p_offer->>'quantity')::integer,(p_offer->>'order_until')::timestamptz,(p_offer->>'ready_at')::timestamptz,v_mode,
 case when v_mode='pickup' then 0 else (p_offer->>'delivery_fee')::numeric end,
 case when v_mode='pickup' then '{}'::text[] else array(select trim(jsonb_array_elements_text(p_offer->'delivery_areas'))) end)
 returning id into v_id;
 insert into public.meal_pickup_details values(v_id,coalesce(p_offer->>'pickup_instructions',''));
 return v_id;
end $$;

create function public.chef_meal_offers(p_session_token text) returns setof public.meal_offers
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 select chef_id into v_id from public.chef_sessions where token_hash=public._chef_session_hash(p_session_token) and expires_at>now();
 if v_id is null then raise exception 'invalid session'; end if;
 return query select * from public.meal_offers where chef_id=v_id order by created_at desc limit 100;
end $$;

create function public.meal_offer_close(p_session_token text,p_offer_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.meal_offers o set active=false where o.id=p_offer_id and exists(select 1 from public.chef_sessions s where s.chef_id=o.chef_id and s.expires_at>now() and s.token_hash=public._chef_session_hash(p_session_token));
 if not found then raise exception 'invalid offer or session'; end if;
end $$;

create function public.place_meal_order(p_offer_id uuid,p_quantity integer,p_customer jsonb,p_fulfilment text,p_access_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
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
 if o.id is null or not o.active or o.order_until<=now() or p_quantity>o.quantity-o.allocated
 or c.status is distinct from 'active' or c.phone_verified is distinct from true or c.membership_status is distinct from 'active' or coalesce(c.membership_type,'') not in ('honorary','paid') then raise exception 'offer unavailable'; end if;
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
end $$;

create function public.customer_meal_order(p_access_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.orders; v_contact text; v_pickup text;
begin
 select o.* into r from public.orders o join public.order_access a on a.order_id=o.id where a.token_hash=public._chef_session_hash(p_access_token);
 if r.id is null then raise exception 'order not found'; end if;
 if r.status='pending' and r.order_until<=now() then r.status:='expired'; end if;
 if r.status in ('accepted','preparing','ready','delivered') then
 select phone into v_contact from public.chefs where id=r.chef_id;
 if r.fulfilment_type='pickup' then select instructions into v_pickup from public.meal_pickup_details where offer_id=r.offer_id; end if;
 end if;
 return jsonb_build_object('order_ref',r.order_ref,'dish_name',r.dish_name,'chef_name',r.chef_name,'status',r.status,'quantity',r.quantity,'unit_price',r.unit_price,'delivery_fee',r.delivery_fee,'total',r.total,
 'ready_at',r.ready_at,'order_until',r.order_until,'fulfilment_type',r.fulfilment_type,'status_reason',r.status_reason,'chef_phone',v_contact,'pickup_instructions',v_pickup,
 'feedback',r.feedback,'received_confirmed',r.received_confirmed,'would_repeat',r.would_repeat,'complaint',r.complaint,'complaint_resolved_at',r.complaint_resolved_at);
end $$;

create function public.chef_meal_orders(p_session_token text) returns setof public.orders
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 select chef_id into v_id from public.chef_sessions where token_hash=public._chef_session_hash(p_session_token) and expires_at>now();
 if v_id is null then raise exception 'invalid session'; end if;
 return query select * from public.orders where chef_id=v_id and offer_id is not null order by created_at desc limit 200;
end $$;

create function public.chef_meal_order_status(p_session_token text,p_order_id uuid,p_status text,p_reason text default '') returns void
language plpgsql security definer set search_path='' as $$
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
 if not o.active or o.order_until<=now() or not exists(select 1 from public.chefs where id=v_id and status='active' and phone_verified and membership_status='active' and membership_type in ('honorary','paid')) then raise exception 'offer unavailable'; end if;
 if o.quantity-o.allocated<r.quantity then raise exception 'insufficient portions'; end if;
 update public.meal_offers set allocated=allocated+r.quantity where id=o.id;
 elsif p_status='cancelled' then
 update public.meal_offers set allocated=allocated-r.quantity where id=o.id;
 end if;
 update public.orders set status=p_status,status_reason=nullif(trim(p_reason),''),updated_at=now() where id=r.id;
end $$;

create function public.customer_meal_action(p_access_token text,p_action text,p_text text default '',p_received boolean default null,p_repeat boolean default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.orders;
begin
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
end $$;

create function public.admin_resolve_meal_complaint(p_order_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'unauthorized'; end if;
 update public.orders set complaint_resolved_at=now() where id=p_order_id and complaint is not null;
end $$;

-- PIN sessions are checked inside chef RPCs; customer RPCs require a random private capability.
revoke all on function public.meal_offer_create(text,integer,jsonb),public.chef_meal_offers(text),public.meal_offer_close(text,uuid),
 public.place_meal_order(uuid,integer,jsonb,text,text),public.customer_meal_order(text),public.chef_meal_orders(text),
 public.chef_meal_order_status(text,uuid,text,text),public.customer_meal_action(text,text,text,boolean,boolean),public.admin_resolve_meal_complaint(uuid) from public;
grant execute on function public.meal_offer_create(text,integer,jsonb),public.chef_meal_offers(text),public.meal_offer_close(text,uuid),
 public.place_meal_order(uuid,integer,jsonb,text,text),public.customer_meal_order(text),public.chef_meal_orders(text),
 public.chef_meal_order_status(text,uuid,text,text),public.customer_meal_action(text,text,text,boolean,boolean) to anon,authenticated;
grant execute on function public.admin_resolve_meal_complaint(uuid) to authenticated;
