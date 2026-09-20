-- The chef records a phone agreement; this is not customer consent.
alter table public.food_requests add column if not exists chef_agreed_at timestamptz;

create or replace function public.food_request_chef_action(
 p_session_token text, p_id uuid, p_action text, p_data jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
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
  if r.requested_at<=now() then raise exception 'request expired'; end if;
  update public.food_requests set status='discussing',first_response_at=coalesce(first_response_at,now()) where id=p_id;
 elsif p_action='agreed' and r.status in ('discussing','proposed') then
  agreed_time:=coalesce(nullif(p_data->>'at','')::timestamptz,r.agreed_at,r.requested_at);
  if agreed_time<=now() or agreed_time>now()+interval '60 days' then raise exception 'new agreed time required'; end if;
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
end $$;

-- Existing grants are preserved by CREATE OR REPLACE; repeat the intended
-- capability-only access explicitly for reproducible installation.
revoke all on function public.food_request_chef_action(text,uuid,text,jsonb) from public;
grant execute on function public.food_request_chef_action(text,uuid,text,jsonb) to anon,authenticated;
