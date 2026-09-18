-- Exact public kitchen map location requires explicit chef consent.
alter table public.kitchen_locations
  add column if not exists public_on_map boolean not null default false;

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
  insert into public.kitchen_locations(chef_id,latitude,longitude,updated_at)
  values(c,p_lat,p_lng,now())
  on conflict(chef_id) do update set latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now();
 end if;
 select jsonb_build_object('lat',latitude,'lng',longitude,'public_on_map',public_on_map) into r from public.kitchen_locations where chef_id=c;
 return r;
end $$;
revoke all on function public.chef_location(text,numeric,numeric,boolean) from public;
grant execute on function public.chef_location(text,numeric,numeric,boolean) to anon,authenticated;

create or replace function public.chef_location_visibility(p_session_token text,p_public_on_map boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c uuid; r jsonb;
begin
 select ch.id into c from public.chefs ch join public.chef_sessions s on s.chef_id=ch.id
 where s.token_hash=public._chef_session_hash(p_session_token) and s.expires_at>now() and ch.status in ('pending','active');
 if c is null then raise exception 'invalid session'; end if;
 if not exists(select 1 from public.kitchen_locations where chef_id=c) then raise exception 'location required'; end if;
 update public.kitchen_locations set public_on_map=coalesce(p_public_on_map,false),updated_at=now() where chef_id=c;
 select jsonb_build_object('lat',latitude,'lng',longitude,'public_on_map',public_on_map) into r from public.kitchen_locations where chef_id=c;
 return r;
end $$;
revoke all on function public.chef_location_visibility(text,boolean) from public;
grant execute on function public.chef_location_visibility(text,boolean) to anon,authenticated;

create or replace function public.public_kitchen_locations()
returns table(chef_id uuid,lat numeric,lng numeric)
language sql stable security definer set search_path='' as $$
 select l.chef_id,l.latitude,l.longitude
 from public.kitchen_locations l join public.chefs c on c.id=l.chef_id
 where l.public_on_map
 and c.city='casablanca' and c.status='active' and c.membership_status='active'
 and (c.phone_verified or not public.kitchen_phone_required()) and public.chef_subscription_valid(c.id)
$$;
revoke all on function public.public_kitchen_locations() from public;
grant execute on function public.public_kitchen_locations() to anon,authenticated;
