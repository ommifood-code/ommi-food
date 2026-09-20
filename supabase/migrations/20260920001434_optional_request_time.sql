-- An unspecified appointment stays NULL; it is agreed directly with the kitchen.
-- Do not manufacture a deadline or expire requests whose time was never chosen.
alter table public.food_requests alter column requested_at drop not null;

CREATE OR REPLACE FUNCTION public.food_request_create(p_chef uuid, p_offer uuid, p_people integer, p_customer jsonb, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.chefs;o public.meal_offers;r public.food_requests;h text;phone text;dish text;dt timestamptz;ref text;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'invalid access token';end if;
 h:=public._chef_session_hash(p_token);perform pg_advisory_xact_lock(hashtextextended(h,7));select * into r from public.food_requests where access_hash=h;if found then return jsonb_build_object('order_ref',r.order_ref,'estimate',r.estimate);end if;
 phone:=trim(p_customer->>'phone');dt:=nullif(btrim(p_customer->>'requested_at'),'')::timestamptz;
 if p_people is null or p_people not between 1 and 1000 or coalesce(phone,'') !~ '^0[5-7][0-9]{8}$' or length(trim(coalesce(p_customer->>'name',''))) not between 2 and 100 or length(coalesce(p_customer->>'notes',''))>1000 then raise exception 'invalid customer';end if;
 if dt is not null and (not isfinite(dt) or dt<=now()) then raise exception 'invalid requested time';end if;
 perform pg_advisory_xact_lock(hashtextextended(phone,8));if (select count(*) from public.food_requests where customer_phone=phone and created_at>now()-interval '1 hour')>=5 then raise exception 'too many requests';end if;
 select * into c from public.chefs where id=p_chef for share;
 if c.id is null or c.status<>'active' or not public.chef_subscription_valid(c.id) or (public.kitchen_phone_required() and not c.phone_verified) then raise exception 'offer unavailable';end if;
 if p_offer is not null then select * into o from public.meal_offers where id=p_offer and chef_id=p_chef and active; if not found then raise exception 'offer unavailable';end if;dish:=o.dish_name;else dish:=trim(p_customer->>'dish');end if;
 if length(coalesce(dish,'')) not between 1 and 150 then raise exception 'invalid dish';end if;
 ref:='OF-'||replace(gen_random_uuid()::text,'-','');
 insert into public.food_requests(order_ref,chef_id,offer_id,access_hash,dish_name,people,reference_price,estimate,requested_at,customer_name,customer_phone,notes,fulfilment)
 values(ref,p_chef,p_offer,h,dish,p_people,o.reference_price,o.reference_price*p_people,dt,trim(p_customer->>'name'),phone,p_customer->>'notes',coalesce(p_customer->>'fulfilment','discuss')) returning * into r;
 insert into public.food_request_events(request_id,event,actor) values(r.id,'created','customer');return jsonb_build_object('order_ref',ref,'estimate',r.estimate);
end $function$
;

CREATE OR REPLACE FUNCTION public.food_request_chef_action(p_session_token text, p_id uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cid uuid; r public.food_requests; agreed_time timestamptz;
begin
 select chef_id into cid from public.chef_sessions
 where token_hash=public._chef_session_hash(p_session_token) and expires_at>now();
 if cid is null then raise exception 'invalid session'; end if;
 select * into r from public.food_requests where id=p_id and chef_id=cid for update;
 if not found then raise exception 'order not found'; end if;
 if r.received_at is not null then raise exception 'invalid transition'; end if;

 if p_action='discussing' and r.status='pending' then
  -- Keep the record for follow-up. "expired" is a derived display state,
  -- not a food_requests status, and must not silently close the request.
  if r.requested_at is not null and r.requested_at<=now() then raise exception 'request expired'; end if;
  update public.food_requests set status='discussing',first_response_at=coalesce(first_response_at,now()) where id=p_id;
 elsif p_action='agreed' and r.status in ('discussing','proposed') then
  agreed_time:=coalesce(nullif(p_data->>'at','')::timestamptz,r.agreed_at,r.requested_at);
  if agreed_time is not null and (not isfinite(agreed_time) or agreed_time<=now()) then raise exception 'new agreed time required'; end if;
  update public.food_requests set status='preparing',chef_agreed_at=now(),agreed_at=agreed_time,
   first_response_at=coalesce(first_response_at,now()) where id=p_id;
 elsif p_action in ('rejected','cancelled') and
  ((p_action='rejected' and r.status in ('pending','discussing','proposed')) or
   (p_action='cancelled' and r.status in ('discussing','proposed','accepted','preparing','ready'))) then
  if length(trim(coalesce(p_data->>'reason',''))) not between 3 and 500 then raise exception 'reason required'; end if;
  update public.food_requests set status=p_action,reason=trim(p_data->>'reason'),first_response_at=coalesce(first_response_at,now()) where id=p_id;
 elsif (p_action='preparing' and r.status='accepted') or
       (p_action='ready' and r.status in ('accepted','preparing')) or
       (p_action='delivered' and r.status in ('accepted','preparing','ready')) then
  update public.food_requests set status=p_action,
   chef_delivered_at=case when p_action='delivered' then now() else chef_delivered_at end where id=p_id;
 elsif p_action='reminder' and r.status='delivered' and r.reminder_count<2 and
       (r.last_reminder_at is null or r.last_reminder_at<now()-interval '24 hours') then
  update public.food_requests set last_reminder_at=now(),reminder_count=reminder_count+1 where id=p_id;
 else raise exception 'invalid transition'; end if;
 update public.food_requests set updated_at=now() where id=p_id;
 insert into public.food_request_events(request_id,event,actor) values(p_id,p_action,'chef');
end $function$
;

revoke all on function public.food_request_create(uuid,uuid,integer,jsonb,text) from public;
grant execute on function public.food_request_create(uuid,uuid,integer,jsonb,text) to anon,authenticated;
revoke all on function public.food_request_chef_action(text,uuid,text,jsonb) from public;
grant execute on function public.food_request_chef_action(text,uuid,text,jsonb) to anon,authenticated;
