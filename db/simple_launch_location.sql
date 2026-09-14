-- Additive migration: private kitchen locations and one atomic meal creation flow.
create table if not exists public.kitchen_locations (
 chef_id uuid primary key references public.chefs(id) on delete cascade,
 latitude numeric not null check(latitude between -90 and 90),
 longitude numeric not null check(longitude between -180 and 180),
 updated_at timestamptz not null default now()
);
alter table public.kitchen_locations enable row level security;
revoke all on public.kitchen_locations from public,anon,authenticated;

create or replace function public.chef_location(p_session_token text,p_lat numeric default null,p_lng numeric default null,p_remove boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid; r jsonb;
begin
 select ch.id into c from public.chefs ch join public.chef_sessions s on s.chef_id=ch.id
 where s.token_hash=public._chef_session_hash(p_session_token) and s.expires_at>now() and ch.status in ('pending','active');
 if c is null then raise exception 'invalid session'; end if;
 if p_remove then delete from public.kitchen_locations where chef_id=c;
 elsif p_lat is not null or p_lng is not null then
  if p_lat is null or p_lng is null or p_lat not between 33.35 and 33.8 or p_lng not between -7.95 and -7.3 then raise exception 'outside launch city';end if;
  insert into public.kitchen_locations values(c,p_lat,p_lng,now()) on conflict(chef_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now();
 end if;
 select jsonb_build_object('lat',latitude,'lng',longitude) into r from public.kitchen_locations where chef_id=c;
 return r;
end $$;
revoke all on function public.chef_location(text,numeric,numeric,boolean) from public;
grant execute on function public.chef_location(text,numeric,numeric,boolean) to anon,authenticated;

-- Fixed coarse grid: exact home coordinates are never returned to the public,
-- even with repeated requests or different customer positions.
create or replace function public.public_kitchen_locations()
returns table(chef_id uuid,lat numeric,lng numeric)
language sql stable security definer set search_path='' as $$
 select l.chef_id,round(l.latitude/0.003)*0.003,round(l.longitude/0.003)*0.003
 from public.kitchen_locations l join public.chefs c on c.id=l.chef_id
 where c.city='casablanca' and c.status='active' and c.membership_status='active'
 and (c.phone_verified or not public.kitchen_phone_required()) and public.chef_subscription_valid(c.id)
$$;
revoke all on function public.public_kitchen_locations() from public;
grant execute on function public.public_kitchen_locations() to anon,authenticated;

alter table public.meal_offers add column if not exists creation_request uuid;
create unique index if not exists meal_creation_once on public.meal_offers(chef_id,creation_request) where creation_request is not null;
create or replace function public.chef_publish_meal(p_session_token text,p_dish jsonb,p_offer jsonb,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.chefs; idx integer; result uuid; ds jsonb;
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
 insert into public.chef_kitchen_profiles(chef_id,fulfilment_type,delivery_by) values(c.id,p_offer->>'fulfilment_type',case when p_offer->>'fulfilment_type'='pickup' then 'customer' else 'chef' end)
 on conflict(chef_id) do update set fulfilment_type=excluded.fulfilment_type;
 result:=public.meal_offer_create(p_session_token,idx,p_offer);
 update public.meal_offers set creation_request=p_request where id=result;
 return result;
end $$;
revoke all on function public.chef_publish_meal(text,jsonb,jsonb,uuid) from public;
grant execute on function public.chef_publish_meal(text,jsonb,jsonb,uuid) to anon,authenticated;
