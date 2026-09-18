-- Shared kitchen settings, informational workdays, immutable order pickup details.
alter table public.chef_kitchen_profiles add column order_settings_configured boolean not null default false,
 add column pickup_instructions text, add column delivery_areas text[] not null default '{}',
 add column delivery_fee numeric(10,2) not null default 0 check(delivery_fee between 0 and 1000);
alter table public.orders add column pickup_snapshot text;
-- Preserve settings already supplied by a cook, without copying one cook's data to another.
insert into public.chef_kitchen_profiles(chef_id,fulfilment_type,order_settings_configured,pickup_instructions,delivery_areas,delivery_fee)
 select distinct on(o.chef_id) o.chef_id,o.fulfilment_type,true,p.instructions,o.delivery_areas,o.delivery_fee
 from public.meal_offers o left join public.meal_pickup_details p on p.offer_id=o.id order by o.chef_id,o.created_at desc
 on conflict(chef_id) do update set fulfilment_type=excluded.fulfilment_type,order_settings_configured=true,pickup_instructions=excluded.pickup_instructions,delivery_areas=excluded.delivery_areas,delivery_fee=excluded.delivery_fee;
update public.orders r set pickup_snapshot=p.instructions from public.meal_pickup_details p where p.offer_id=r.offer_id and r.fulfilment_type='pickup';
create or replace function public.chef_order_settings(p_session_token text,p_settings jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid uuid;k public.chef_kitchen_profiles;mode text;days text;areas text[];fee numeric;pickup text;
 allowed text[]:=array['الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد'];
begin
 select c.id into cid from public.chefs c join public.chef_sessions s on s.chef_id=c.id where s.token_hash=public._chef_session_hash(p_session_token) and s.expires_at>now() and c.status='active' and c.membership_status='active' for update of c;
 if cid is null then raise exception 'invalid session';end if;
 select * into k from public.chef_kitchen_profiles where chef_id=cid;
 if p_settings is not null then
  mode:=p_settings->>'fulfilment_type';
  if mode is null or mode not in ('pickup','delivery','both') then raise exception 'invalid fulfilment';end if;
  pickup:=trim(coalesce(p_settings->>'pickup_instructions',''));
  if mode in ('pickup','both') and length(pickup) not between 5 and 1000 then raise exception 'pickup instructions required';end if;
  if mode in ('delivery','both') then
   if jsonb_typeof(p_settings->'delivery_areas') is distinct from 'array' or jsonb_array_length(p_settings->'delivery_areas') not between 1 and 30 then raise exception 'delivery areas required';end if;
   areas:=array(select distinct trim(x) from jsonb_array_elements_text(p_settings->'delivery_areas') x);
   if exists(select 1 from unnest(areas) x where length(x) not between 1 and 100) then raise exception 'delivery areas required';end if;
   fee:=(p_settings->>'delivery_fee')::numeric;
   if fee is null or fee not between 0 and 1000 then raise exception 'invalid delivery fee';end if;
  else areas:='{}';fee:=0;end if;
  days:=coalesce(k.work_days,'');
  if p_settings ? 'work_days' then
   if jsonb_typeof(p_settings->'work_days') is distinct from 'array' or jsonb_array_length(p_settings->'work_days')>7 then raise exception 'invalid work days';end if;
   if exists(select 1 from jsonb_array_elements_text(p_settings->'work_days') x where not(x=any(allowed))) then raise exception 'invalid work days';end if;
   select coalesce(string_agg(x,'، '),'') into days from unnest(allowed) x where p_settings->'work_days' ? x;
  end if;
  insert into public.chef_kitchen_profiles(chef_id,work_days,fulfilment_type,delivery_by,order_settings_configured,pickup_instructions,delivery_areas,delivery_fee)
  values(cid,days,mode,case when mode='pickup' then 'customer' else 'chef' end,true,pickup,areas,fee)
  on conflict(chef_id) do update set work_days=excluded.work_days,fulfilment_type=excluded.fulfilment_type,delivery_by=excluded.delivery_by,order_settings_configured=true,pickup_instructions=excluded.pickup_instructions,delivery_areas=excluded.delivery_areas,delivery_fee=excluded.delivery_fee,updated_at=now();
  -- Shared changes apply to future requests. Existing orders retain their snapshot.
  update public.meal_offers set fulfilment_type=mode,delivery_fee=fee,delivery_areas=areas where chef_id=cid;
  update public.meal_pickup_details p set instructions=pickup from public.meal_offers o where p.offer_id=o.id and o.chef_id=cid;
  select * into k from public.chef_kitchen_profiles where chef_id=cid;
 end if;
 return jsonb_build_object('configured',coalesce(k.order_settings_configured,false),'work_days',coalesce(k.work_days,''),'fulfilment_type',coalesce(k.fulfilment_type,'pickup'),'pickup_instructions',coalesce(k.pickup_instructions,''),'delivery_areas',coalesce(k.delivery_areas,'{}'),'delivery_fee',coalesce(k.delivery_fee,0));
end $$;
create or replace function public.chef_meal_defaults(p_session_token text) returns jsonb language sql security definer set search_path='' as $$
 select public.chef_order_settings(p_session_token);
$$;
create or replace function public.public_kitchen_workdays() returns table(chef_id uuid,work_days text) language sql security definer set search_path='' as $$
 select c.id,coalesce(k.work_days,'') from public.chefs c left join public.chef_kitchen_profiles k on k.chef_id=c.id
 where c.status='active' and c.membership_status='active' and c.membership_type in ('honorary','paid') and (c.phone_verified or not public.kitchen_phone_required()) and public.chef_subscription_valid(c.id);
$$;
revoke all on function public.chef_order_settings(text,jsonb),public.chef_meal_defaults(text),public.public_kitchen_workdays() from public,anon,authenticated;
grant execute on function public.chef_order_settings(text,jsonb),public.chef_meal_defaults(text),public.public_kitchen_workdays() to anon,authenticated;

CREATE OR REPLACE FUNCTION public.chef_publish_meal(p_session_token text, p_dish jsonb, p_offer jsonb, p_request uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.chefs; idx integer; result uuid; ds jsonb; settings jsonb;
begin
 select ch.* into c from public.chefs ch join public.chef_sessions s on s.chef_id=ch.id
 where s.token_hash=public._chef_session_hash(p_session_token) and s.expires_at>now() and ch.status='active' and ch.membership_status='active' for update of ch;
 if c.id is null then raise exception 'invalid session';end if;
 if p_request is null then raise exception 'request required';end if;
 select id into result from public.meal_offers where chef_id=c.id and creation_request=p_request;
 if result is not null then return result;end if;
 if nullif(trim(p_dish->>'name'),'') is null or length(p_dish->>'name')>150 or (p_dish->>'price') is null or (p_dish->>'price')::numeric not between 1 and 10000 then raise exception 'invalid dish';end if;
 if p_offer->>'specialty' is null or p_offer->>'specialty' not in ('أكلات تقليدية وشعبية','أكلات جهوية حسب المنطقة','أكلات تراثية وأصيلة','أكلات بيتية ولذيذة') then raise exception 'invalid specialty';end if;
 if p_dish->>'image_url' is not null and p_dish->>'image_url' not like 'https://%' then raise exception 'invalid image';end if;
 ds:=coalesce(c.dishes,'[]'::jsonb);
 select ord::integer-1 into idx from jsonb_array_elements(ds) with ordinality a(d,ord) where d->>'name'=trim(p_dish->>'name') and d->>'price'=p_dish->>'price' and coalesce(d->>'image_url','')=coalesce(p_dish->>'image_url','') limit 1;
 if idx is null then idx:=jsonb_array_length(ds);ds:=ds||jsonb_build_array(jsonb_build_object('name',trim(p_dish->>'name'),'price',(p_dish->>'price')::numeric,'image_url',p_dish->>'image_url'));end if;
 update public.chefs set dishes=ds,specialty=p_offer->>'specialty' where id=c.id;
 if p_offer ? 'fulfilment_type' then settings:=public.chef_order_settings(p_session_token,p_offer);else settings:=public.chef_order_settings(p_session_token);end if;
 if not (settings->>'configured')::boolean then raise exception 'kitchen settings required';end if;
 result:=public.meal_offer_create(p_session_token,idx,p_offer||settings);
 update public.meal_offers set creation_request=p_request where id=result;
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION public.place_meal_order(p_offer_id uuid, p_quantity integer, p_customer jsonb, p_fulfilment text, p_access_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare o public.meal_offers; c public.chefs; v_id uuid:=gen_random_uuid(); v_ref text; v_hash text; v_fee numeric; v_phone text:=trim(p_customer->>'phone'); prior public.orders; v_requested timestamptz; v_chef uuid;
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
 select chef_id into v_chef from public.meal_offers where id=p_offer_id;
 select * into c from public.chefs where id=v_chef for share;
 select * into o from public.meal_offers where id=p_offer_id for update;
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
 offer_id,quantity,unit_price,delivery_fee,total,fulfilment_type,delivery_area,ready_at,order_until,serves,pickup_snapshot)
 values(v_id,v_ref,c.id,c.name,o.dish_name,trim(p_customer->>'name'),v_phone,
 case when p_fulfilment='delivery' then trim(p_customer->>'address') else 'الاستلام من المطبخ' end,p_customer->>'notes','pending',
 o.id,p_quantity,o.price,v_fee,o.price*p_quantity+v_fee,p_fulfilment,p_customer->>'area',v_requested,v_requested,o.serves,case when p_fulfilment='pickup' then (select instructions from public.meal_pickup_details where offer_id=o.id) else null end);
 insert into public.order_access values(v_id,v_hash);
 return jsonb_build_object('order_ref',v_ref,'total',o.price*p_quantity+v_fee);
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
 if r.fulfilment_type='pickup' then v_pickup:=r.pickup_snapshot; end if;
 end if;
 return jsonb_build_object('order_ref',r.order_ref,'dish_name',r.dish_name,'chef_name',r.chef_name,'status',r.status,'quantity',r.quantity,'unit_price',r.unit_price,'delivery_fee',r.delivery_fee,'total',r.total,
 'serves',r.serves,'unit_label','طبق','ready_at',r.ready_at,'order_until',r.order_until,'fulfilment_type',r.fulfilment_type,'status_reason',r.status_reason,'chef_phone',v_contact,'pickup_instructions',v_pickup,
 'feedback',r.feedback,'received_confirmed',r.received_confirmed,'would_repeat',r.would_repeat,'complaint',r.complaint,'complaint_resolved_at',r.complaint_resolved_at);
end $function$
;
create or replace function public.chef_update_meal(p_session_token text,p_offer_id uuid,p_dish jsonb,p_serves integer,p_ingredients text default '') returns void
language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 select c.id into cid from public.chefs c join public.chef_sessions s on s.chef_id=c.id where s.token_hash=public._chef_session_hash(p_session_token) and s.expires_at>now() and c.status='active' and c.membership_status='active' for update of c;
 if cid is null then raise exception 'invalid session';end if;
 if length(trim(coalesce(p_dish->>'name',''))) not between 1 and 150 or (p_dish->>'price') is null or (p_dish->>'price')::numeric not between 1 and 10000 then raise exception 'invalid dish';end if;
 if p_dish->>'image_url' is not null and p_dish->>'image_url' not like 'https://%' then raise exception 'invalid image';end if;
 if p_serves is null or p_serves not between 1 and 1000 then raise exception 'invalid portion';end if;
 update public.meal_offers set dish_name=trim(p_dish->>'name'),price=(p_dish->>'price')::numeric,image_url=p_dish->>'image_url',serves=p_serves,portion='يكفي '||p_serves||' أشخاص',ingredients=nullif(trim(p_ingredients),'') where id=p_offer_id and chef_id=cid;
 if not found then raise exception 'invalid offer or session';end if;
 update public.chefs set dishes=(select coalesce(jsonb_agg(jsonb_build_object('name',dish_name,'price',price,'image_url',image_url) order by created_at),'[]'::jsonb) from public.meal_offers where chef_id=cid) where id=cid;
end $$;
revoke all on function public.chef_update_meal(text,uuid,jsonb,integer,text) from public,anon,authenticated;
grant execute on function public.chef_update_meal(text,uuid,jsonb,integer,text) to anon,authenticated;
