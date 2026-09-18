-- Apply once after preorder_flow.sql. No commission and no payment-provider API.
alter table public.chefs add column paid_until timestamptz;
create table public.subscription_settings (
 id boolean primary key default true check(id), instructions text not null default '' check(length(instructions)<=2000)
);
insert into public.subscription_settings(id) values(true);
create table public.subscription_payments (
 id uuid primary key default gen_random_uuid(), chef_id uuid not null references public.chefs(id) on delete cascade,
 reference text not null check(length(reference) between 4 and 100), amount numeric not null default 50 check(amount=50),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid,
 reason text, period_start timestamptz, period_end timestamptz
);
create unique index subscription_one_pending on public.subscription_payments(chef_id) where status='pending';
create unique index subscription_reference_once on public.subscription_payments(reference) where status<>'rejected';
alter table public.subscription_settings enable row level security;
alter table public.subscription_payments enable row level security;
revoke all on public.subscription_settings,public.subscription_payments from anon,authenticated;

create function public.chef_subscription_valid(p_chef_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chefs where id=p_chef_id and
 (membership_type='honorary' or (membership_type='paid' and paid_until>now())))
$$;
revoke all on function public.chef_subscription_valid(uuid) from public;
grant execute on function public.chef_subscription_valid(uuid) to anon,authenticated;
alter policy public_read_active_chefs on public.chefs using
 (status='active' and membership_status='active' and phone_verified=true and public.chef_subscription_valid(id));

create function public.enforce_paid_subscription() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.membership_type='paid' and new.membership_status='active' and new.status='active'
 and (new.paid_until is null or new.paid_until<=now()) then raise exception 'subscription required'; end if;
 return new;
end $$;
create trigger check_paid_subscription before insert or update of membership_type,membership_status,status,paid_until
 on public.chefs for each row execute function public.enforce_paid_subscription();
revoke all on function public.enforce_paid_subscription() from public;

create function public.chef_subscription(p_session_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.chefs; v_id uuid;
begin
 select chef_id into v_id from public.chef_sessions where token_hash=public._chef_session_hash(p_session_token) and expires_at>now();
 if v_id is null then raise exception 'invalid session'; end if;
 select * into c from public.chefs where id=v_id;
 return jsonb_build_object('amount',50,'currency','MAD','membership',c.membership_type,'paid_until',c.paid_until,
 'instructions',(select instructions from public.subscription_settings where id),
 'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at desc) from
 (select id,reference,amount,status,created_at,reason,period_end from public.subscription_payments where chef_id=v_id order by created_at desc limit 12)p),'[]'::jsonb));
end $$;
create function public.submit_subscription_payment(p_session_token text,p_reference text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_chef uuid; v_id uuid; v_ref text:=upper(regexp_replace(trim(p_reference),'\s','','g'));
begin
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
end $$;

create function public.admin_subscription_settings(p_instructions text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 update public.subscription_settings set instructions=trim(coalesce(p_instructions,'')) where id;
end $$;
create function public.admin_subscriptions() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 return jsonb_build_object('instructions',(select instructions from public.subscription_settings where id),
 'payments',coalesce((select jsonb_agg(to_jsonb(p)) from
 (select p.*,c.name,c.phone,c.phone_verified,c.status as chef_status,c.paid_until from public.subscription_payments p join public.chefs c on c.id=p.chef_id
 order by (p.status='pending') desc,p.created_at desc limit 300)p),'[]'::jsonb),
 'expired',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'paid_until',paid_until)) from public.chefs
 where membership_type='paid' and (paid_until is null or paid_until<=now())),'[]'::jsonb));
end $$;
create function public.admin_activate_kitchen(p_chef_id uuid,p_phone_confirmed boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare c public.chefs;
begin
 if not public.is_admin() then raise exception 'Unauthorized'; end if;
 select * into c from public.chefs where id=p_chef_id for update;
 if c.id is null or c.status='rejected' or coalesce(jsonb_array_length(c.dishes),0)=0 then raise exception 'kitchen incomplete'; end if;
 if not public.chef_subscription_valid(c.id) then raise exception 'subscription required'; end if;
 if c.phone_verified is not true then
 if p_phone_confirmed is not true then raise exception 'phone confirmation required'; end if;
 perform public.verify_chef_phone(c.id);
 end if;
 perform public.approve_chef(c.id,c.membership_type);
end $$;
create function public.review_subscription_payment(p_payment_id uuid,p_approve boolean,p_reason text default '',p_publish boolean default false,p_phone_confirmed boolean default false)
 returns void language plpgsql security definer set search_path='' as $$
declare p public.subscription_payments; c public.chefs; v_start timestamptz;
begin
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
end $$;
revoke all on function public.chef_subscription(text),public.submit_subscription_payment(text,text),public.admin_subscription_settings(text),public.admin_subscriptions(),public.admin_activate_kitchen(uuid,boolean),public.review_subscription_payment(uuid,boolean,text,boolean,boolean) from public;
grant execute on function public.chef_subscription(text),public.submit_subscription_payment(text,text) to anon,authenticated;
grant execute on function public.admin_subscription_settings(text),public.admin_subscriptions(),public.admin_activate_kitchen(uuid,boolean),public.review_subscription_payment(uuid,boolean,text,boolean,boolean) to authenticated;
