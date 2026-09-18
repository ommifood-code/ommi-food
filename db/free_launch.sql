-- Launch is free. Billing foundation remains dormant until an explicit future change.
alter table public.subscription_settings add column billing_enabled boolean not null default false;
create or replace function public.chef_subscription_valid(p_chef_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chefs where id=p_chef_id and
 (not coalesce((select billing_enabled from public.subscription_settings where id),false)
 or membership_type='honorary' or (membership_type='paid' and paid_until>now())))
$$;
create or replace function public.enforce_paid_subscription() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce((select billing_enabled from public.subscription_settings where id),false)
 and new.membership_type='paid' and new.membership_status='active' and new.status='active'
 and (new.paid_until is null or new.paid_until<=now()) then raise exception 'subscription required'; end if;
 return new;
end $$;
create or replace function public.admin_activate_kitchen(p_chef_id uuid,p_phone_confirmed boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare c public.chefs; v_free boolean;
begin
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 select * into c from public.chefs where id=p_chef_id for update;
 if c.id is null or c.status='rejected' or coalesce(jsonb_array_length(c.dishes),0)=0 then raise exception 'kitchen incomplete'; end if;
 v_free:=not coalesce((select billing_enabled from public.subscription_settings where id),false);
 if not public.chef_subscription_valid(c.id) then raise exception 'subscription required'; end if;
 if c.phone_verified is not true then
 if p_phone_confirmed is not true then raise exception 'phone confirmation required'; end if;
 perform public.verify_chef_phone(c.id);
 end if;
 perform public.approve_chef(c.id,case when v_free then 'honorary' else c.membership_type end);
end $$;

CREATE OR REPLACE FUNCTION public.review_subscription_payment(p_payment_id uuid, p_approve boolean, p_reason text DEFAULT ''::text, p_publish boolean DEFAULT false, p_phone_confirmed boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p public.subscription_payments; c public.chefs; v_start timestamptz;
begin
 if not coalesce((select billing_enabled from public.subscription_settings where id),false) then raise exception 'billing disabled during free launch'; end if;
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 if p_approve is null then raise exception 'decision required'; end if;
 select c0.* into c from public.chefs c0 join public.subscription_payments p0 on p0.chef_id=c0.id where p0.id=p_payment_id for update of c0;
 select * into p from public.subscription_payments where id=p_payment_id for update;
 if p.id is null then raise exception 'payment not found'; end if;
 if p.status<>'pending' then return; end if;
 if not p_approve then
 if length(trim(coalesce(p_reason,''))) not between 3 and 500 then raise exception 'reason required'; end if;
 update public.subscription_payments set status='rejected',reason=trim(p_reason),reviewed_at=now(),reviewed_by=auth.uid() where id=p.id; return;
 end if;
 v_start:=greatest(now(),coalesce(c.paid_until,now()));
 update public.chefs set paid_until=v_start+interval '1 month',membership_type='paid' where id=c.id;
 update public.subscription_payments set status='approved',reviewed_at=now(),reviewed_by=auth.uid(),period_start=v_start,period_end=v_start+interval '1 month' where id=p.id;
 if p_publish then perform public.admin_activate_kitchen(c.id,p_phone_confirmed); end if;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_subscription_payment(p_session_token text, p_reference text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_chef uuid; v_id uuid; v_ref text:=upper(regexp_replace(trim(p_reference),'\s','','g'));
begin
 if not coalesce((select billing_enabled from public.subscription_settings where id),false) then raise exception 'billing disabled during free launch'; end if;
 select chef_id into v_chef from public.chef_sessions where token_hash=public._chef_session_hash(p_session_token) and expires_at>now();
 if v_chef is null then raise exception 'invalid session'; end if;
 perform 1 from public.chefs where id=v_chef for update;
 if length(coalesce(v_ref,'')) not between 4 and 100 then raise exception 'invalid reference'; end if;
 if not exists(select 1 from public.subscription_settings where length(trim(instructions))>0) then raise exception 'payment instructions unavailable'; end if;
 select id into v_id from public.subscription_payments where chef_id=v_chef and status='pending';
 if v_id is not null then return v_id; end if;
 if (select count(*) from public.subscription_payments where chef_id=v_chef and created_at>now()-interval '1 day')>=5 then raise exception 'too many requests'; end if;
 insert into public.subscription_payments(chef_id,reference) values(v_chef,v_ref) returning id into v_id;
 return v_id;
end $function$;
revoke all on function public.admin_activate_kitchen(uuid,boolean) from public,anon;
grant execute on function public.admin_activate_kitchen(uuid,boolean) to authenticated;
revoke all on function public.enforce_paid_subscription() from public,anon,authenticated;
revoke all on function public.chef_subscription(text),public.submit_subscription_payment(text,text),public.review_subscription_payment(uuid,boolean,text,boolean,boolean),public.admin_subscription_settings(text),public.admin_subscriptions() from public,anon,authenticated;
