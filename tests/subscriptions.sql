-- Current launch policy: free activation and no payment operations. Rollback only.
begin;
do $$
declare c uuid:=gen_random_uuid(); admin_id uuid; blocked boolean;
begin
 select user_id into admin_id from public.admin_users limit 1;
 if (select billing_enabled from public.subscription_settings where id) then raise exception 'FAIL launch not free'; end if;
 insert into public.chefs(id,name,gender,phone,city,status,dishes) values(c,'اختبار مجاني','m','0600000010','casablanca','pending','[{"name":"كسكس","price":40}]');
 insert into public.chef_sessions(chef_id,token_hash,expires_at) values(c,public._chef_session_hash('free-fixture'),now()+interval '1 hour');
 perform set_config('request.jwt.claim.sub','',true);
 blocked:=false;begin perform public.admin_activate_kitchen(c,true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL nonadmin activation';end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 blocked:=false;begin perform public.admin_activate_kitchen(c,false);exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL phone guard';end if;
 perform public.admin_activate_kitchen(c,true);
 if not exists(select 1 from public.chefs where id=c and status='active' and membership_status='active' and phone_verified and paid_until is null) then raise exception 'FAIL free activation';end if;
 if not public.chef_subscription_valid(c) then raise exception 'FAIL free entitlement';end if;
 update public.chefs set membership_type='paid',paid_until=now()-interval '1 day' where id=c;
 if not public.chef_subscription_valid(c) then raise exception 'FAIL expiry blocked free launch';end if;
 blocked:=false;begin perform public.submit_subscription_payment('free-fixture','TEST-REFERENCE');exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL payment claim during free launch';end if;
 blocked:=false;begin perform public.review_subscription_payment(gen_random_uuid(),true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL payment review during free launch';end if;
end $$;
rollback;
select 'PASS: free activation, admin-only publication, phone guard, no expiry gate, billing disabled; rolled back' as result;
