-- Customer-led requests. Existing orders retain their original agreement semantics.
alter table public.meal_offers add column reference_price numeric(10,2) check(reference_price between 1 and 10000), add column group_pricing boolean not null default false;
-- Only one-person offers have an unambiguous per-person reference. Others require cook review.
update public.meal_offers set reference_price=price where serves=1;
create table public.food_requests(
 id uuid primary key default gen_random_uuid(),order_ref text unique not null,chef_id uuid not null references public.chefs(id),offer_id uuid references public.meal_offers(id) on delete set null,
 access_hash text unique not null, dish_name text not null check(length(dish_name) between 1 and 150), people integer not null check(people between 1 and 1000),
 reference_price numeric(10,2),estimate numeric(12,2),requested_at timestamptz not null,
 customer_name text not null,customer_phone text not null,notes text,fulfilment text not null default 'discuss' check(fulfilment in ('discuss','pickup','delivery')),
 status text not null default 'pending' check(status in ('pending','discussing','proposed','accepted','preparing','ready','delivered','rejected','cancelled')),
 agreed_dish text,agreed_people integer check(agreed_people between 1 and 1000),agreed_total numeric(12,2) check(agreed_total between 0 and 1000000),agreed_at timestamptz,agreed_fulfilment text,
 agreement_version integer not null default 0,customer_agreed_at timestamptz,chef_delivered_at timestamptz,received_at timestamptz,rating integer check(rating between 1 and 5),feedback text,
 reason text,complaint text,complaint_resolved_at timestamptz,admin_contacted_at timestamptz,last_reminder_at timestamptz,reminder_count integer not null default 0,
 created_at timestamptz not null default now(),first_response_at timestamptz,updated_at timestamptz not null default now()
);
create index food_requests_chef_created on public.food_requests(chef_id,created_at desc);
create index food_requests_phone_created on public.food_requests(customer_phone,created_at desc);
alter table public.food_requests enable row level security;
revoke all on public.food_requests from anon,authenticated;
create table public.food_request_events(id bigint generated always as identity primary key,request_id uuid not null references public.food_requests(id) on delete cascade,event text not null,actor text not null,created_at timestamptz not null default now());
alter table public.food_request_events enable row level security;
revoke all on public.food_request_events from anon,authenticated;
create function public.food_request_create(p_chef uuid,p_offer uuid,p_people integer,p_customer jsonb,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.chefs;o public.meal_offers;r public.food_requests;h text;phone text;dish text;dt timestamptz;ref text;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'invalid access token';end if;
 h:=public._chef_session_hash(p_token);perform pg_advisory_xact_lock(hashtextextended(h,7));select * into r from public.food_requests where access_hash=h;if found then return jsonb_build_object('order_ref',r.order_ref,'estimate',r.estimate);end if;
 phone:=trim(p_customer->>'phone');dt:=(p_customer->>'requested_at')::timestamptz;
 if p_people is null or p_people not between 1 and 1000 or coalesce(phone,'') !~ '^0[5-7][0-9]{8}$' or length(trim(coalesce(p_customer->>'name',''))) not between 2 and 100 or length(coalesce(p_customer->>'notes',''))>1000 then raise exception 'invalid customer';end if;
 if dt is null or dt<=now() or dt>now()+interval '60 days' then raise exception 'invalid requested time';end if;
 perform pg_advisory_xact_lock(hashtextextended(phone,8));if (select count(*) from public.food_requests where customer_phone=phone and created_at>now()-interval '1 hour')>=5 then raise exception 'too many requests';end if;
 select * into c from public.chefs where id=p_chef for share;
 if c.id is null or c.status<>'active' or not public.chef_subscription_valid(c.id) or (public.kitchen_phone_required() and not c.phone_verified) then raise exception 'offer unavailable';end if;
 if p_offer is not null then select * into o from public.meal_offers where id=p_offer and chef_id=p_chef and active; if not found then raise exception 'offer unavailable';end if;dish:=o.dish_name;else dish:=trim(p_customer->>'dish');end if;
 if length(coalesce(dish,'')) not between 1 and 150 then raise exception 'invalid dish';end if;
 ref:='OF-'||replace(gen_random_uuid()::text,'-','');
 insert into public.food_requests(order_ref,chef_id,offer_id,access_hash,dish_name,people,reference_price,estimate,requested_at,customer_name,customer_phone,notes,fulfilment)
 values(ref,p_chef,p_offer,h,dish,p_people,o.reference_price,o.reference_price*p_people,dt,trim(p_customer->>'name'),phone,p_customer->>'notes',coalesce(p_customer->>'fulfilment','discuss')) returning * into r;
 insert into public.food_request_events(request_id,event,actor) values(r.id,'created','customer');return jsonb_build_object('order_ref',ref,'estimate',r.estimate);
end $$;
create function public.food_request_customer(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.food_requests;phone text;
begin select * into r from public.food_requests where access_hash=public._chef_session_hash(p_token);if not found then return null;end if;select c.phone into phone from public.chefs c where c.id=r.chef_id;return (to_jsonb(r)-'access_hash')||jsonb_build_object('request_v2',true,'chef_phone',phone);end $$;
create function public.food_requests_chef(p_session_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid;begin select chef_id into cid from public.chef_sessions where token_hash=public._chef_session_hash(p_session_token) and expires_at>now();if cid is null then raise exception 'invalid session';end if;
 return coalesce((select jsonb_agg((to_jsonb(r)-'access_hash')||jsonb_build_object('request_v2',true) order by created_at desc) from public.food_requests r where chef_id=cid),'[]'::jsonb);end $$;
create function public.food_request_chef_action(p_session_token text,p_id uuid,p_action text,p_data jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare cid uuid;r public.food_requests;begin
 select chef_id into cid from public.chef_sessions where token_hash=public._chef_session_hash(p_session_token) and expires_at>now();if cid is null then raise exception 'invalid session';end if;
 select * into r from public.food_requests where id=p_id and chef_id=cid for update;if not found then raise exception 'order not found';end if;
 if r.received_at is not null and p_action<>'delivered' then raise exception 'invalid transition';end if;
 if p_action='discussing' and r.status='pending' then update public.food_requests set status='discussing',first_response_at=coalesce(first_response_at,now()) where id=p_id;
 elsif p_action='propose' and r.status in ('pending','discussing','proposed') then
  if length(trim(coalesce(p_data->>'dish',''))) not between 1 and 150 or (p_data->>'people') is null or (p_data->>'total') is null or (p_data->>'at') is null or (p_data->>'at')::timestamptz<=now() or length(trim(coalesce(p_data->>'fulfilment',''))) not between 2 and 500 then raise exception 'invalid agreement';end if;
  update public.food_requests set status='proposed',agreed_dish=trim(p_data->>'dish'),agreed_people=(p_data->>'people')::integer,agreed_total=(p_data->>'total')::numeric,agreed_at=(p_data->>'at')::timestamptz,agreed_fulfilment=trim(p_data->>'fulfilment'),agreement_version=agreement_version+1,first_response_at=coalesce(first_response_at,now()) where id=p_id;
 elsif p_action in ('rejected','cancelled') and ((p_action='rejected' and r.status in ('pending','discussing','proposed')) or (p_action='cancelled' and r.status in ('accepted','preparing','ready'))) then
  if length(trim(coalesce(p_data->>'reason',''))) not between 3 and 500 then raise exception 'reason required';end if;update public.food_requests set status=p_action,reason=trim(p_data->>'reason'),first_response_at=coalesce(first_response_at,now()) where id=p_id;
 elsif (p_action='preparing' and r.status='accepted') or (p_action='ready' and r.status in ('accepted','preparing')) or (p_action='delivered' and r.status in ('accepted','preparing','ready')) then
  update public.food_requests set status=p_action,chef_delivered_at=case when p_action='delivered' then now() else chef_delivered_at end where id=p_id;
 elsif p_action='reminder' and r.status='delivered' and r.received_at is null and r.reminder_count<2 and (r.last_reminder_at is null or r.last_reminder_at<now()-interval '24 hours') then
  update public.food_requests set last_reminder_at=now(),reminder_count=reminder_count+1 where id=p_id;
 else raise exception 'invalid transition';end if;
 update public.food_requests set updated_at=now() where id=p_id;insert into public.food_request_events(request_id,event,actor) values(p_id,p_action,'chef');
end $$;
create function public.food_request_customer_action(p_token text,p_action text,p_data jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare r public.food_requests;begin
 select * into r from public.food_requests where access_hash=public._chef_session_hash(p_token) for update;if not found then raise exception 'order not found';end if;
 if p_action='agree' and r.status='proposed' and (p_data->>'version')::integer=r.agreement_version and r.agreed_at>now() then update public.food_requests set status='accepted',customer_agreed_at=now() where id=r.id;
 elsif p_action='discuss' and r.status='proposed' then update public.food_requests set status='discussing' where id=r.id;
 elsif p_action='cancel' and r.status in ('pending','discussing','proposed') then update public.food_requests set status='cancelled' where id=r.id;
 elsif p_action='received' and r.status in ('accepted','preparing','ready','delivered') and r.received_at is null then update public.food_requests set received_at=now() where id=r.id;
 elsif p_action='rate' and r.received_at is not null and r.rating is null then
  if (p_data->>'rating') is null or length(coalesce(p_data->>'feedback',''))>2000 then raise exception 'invalid rating';end if;update public.food_requests set rating=(p_data->>'rating')::integer,feedback=nullif(trim(p_data->>'feedback'),'') where id=r.id;
 elsif p_action='complaint' and r.complaint is null then
  if length(trim(coalesce(p_data->>'message',''))) not between 5 and 2000 then raise exception 'invalid complaint';end if;update public.food_requests set complaint=trim(p_data->>'message') where id=r.id;
 else raise exception 'invalid transition';end if;
 update public.food_requests set updated_at=now() where id=r.id;insert into public.food_request_events(request_id,event,actor) values(r.id,p_action,'customer');
end $$;
create function public.food_request_admin(p_id uuid default null,p_action text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin if not public.is_admin() then raise exception 'forbidden';end if;
 if p_action is not null then
  if p_action='contacted' then update public.food_requests set admin_contacted_at=now() where id=p_id;
  elsif p_action='resolve' then update public.food_requests set complaint_resolved_at=now() where id=p_id and complaint is not null;
  else raise exception 'invalid action';end if;
  if not found then raise exception 'order not found';end if;insert into public.food_request_events(request_id,event,actor) values(p_id,p_action,'admin');
 end if;
 return jsonb_build_object('requests',coalesce((select jsonb_agg(to_jsonb(x)-'access_hash') from (select r.*,c.phone chef_phone from public.food_requests r join public.chefs c on c.id=r.chef_id order by (r.status='pending') desc,r.created_at desc limit 500)x),'[]'::jsonb),
 'metrics',(select jsonb_build_object('requests',count(*),'custom_requests',count(*) filter(where offer_id is null),'confirmed_received',count(*) filter(where received_at is not null),'rated',count(rating),'unknown_outcome',count(*) filter(where received_at is null and status not in ('cancelled','rejected')),'agreement_value',coalesce(sum(agreed_total) filter(where customer_agreed_at is not null),0),'average_response_minutes',round(avg(extract(epoch from(first_response_at-created_at))/60)::numeric,1),'repeat_phone_count',(select count(*) from(select customer_phone from public.food_requests group by customer_phone having count(*)>1) t)) from public.food_requests));
end $$;
create function public.food_request_reputation() returns table(chef_id uuid,confirmed_received bigint,rating_count bigint,average_rating numeric) language sql security definer set search_path='' as $$
 select r.chef_id,count(*) filter(where r.received_at is not null),count(r.rating),round(avg(r.rating),1) from public.food_requests r join public.chefs c on c.id=r.chef_id where c.status='active' group by r.chef_id;
$$;
create function public.chef_save_reference_dish(p_session_token text,p_id uuid,p_dish jsonb,p_offer jsonb,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;begin
 if p_id is null then result:=public.chef_publish_meal(p_session_token,p_dish,p_offer||jsonb_build_object('serves',1),p_request);
 else perform public.chef_update_meal(p_session_token,p_id,p_dish,1,p_offer->>'ingredients');result:=p_id;end if;
 update public.meal_offers set reference_price=(p_dish->>'price')::numeric,group_pricing=coalesce((p_offer->>'group_pricing')::boolean,false) where id=result;return result;
end $$;
-- Explicit grants; bearer capabilities are validated inside every private endpoint.
revoke all on function public.food_request_create(uuid,uuid,integer,jsonb,text),public.food_request_customer(text),public.food_requests_chef(text),public.food_request_chef_action(text,uuid,text,jsonb),public.food_request_customer_action(text,text,jsonb),public.food_request_admin(uuid,text),public.food_request_reputation(),public.chef_save_reference_dish(text,uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.food_request_create(uuid,uuid,integer,jsonb,text),public.food_request_customer(text),public.food_requests_chef(text),public.food_request_chef_action(text,uuid,text,jsonb),public.food_request_customer_action(text,text,jsonb),public.food_request_reputation(),public.chef_save_reference_dish(text,uuid,jsonb,jsonb,uuid) to anon,authenticated;
grant execute on function public.food_request_admin(uuid,text) to authenticated;
