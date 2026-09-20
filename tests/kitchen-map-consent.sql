-- One transaction-only kitchen; never publish a guessed point for a real kitchen.
begin;
do $$
declare r jsonb; c uuid; t text; blocked boolean;
begin
 r:=public.chef_register('اختبار خريطة','0600000087','casablanca','اختبار','اختبار','m','483927');
 c:=(r->>'chef_id')::uuid;t:=r->>'session_token';
 execute 'set local role anon';
 r:=public.chef_location(t,33.57,-7.6);
 if (r->>'public_on_map')::boolean then raise exception 'FAIL fabricated consent';end if;
 if exists(select 1 from public.public_kitchen_locations() where chef_id=c) then raise exception 'FAIL point exposed without consent';end if;
 perform public.chef_location_visibility(t,true);
 if not exists(select 1 from public.public_kitchen_locations() where chef_id=c and lat=33.57 and lng=-7.6) then raise exception 'FAIL consented exact location missing';end if;
 blocked:=false;begin perform public.chef_location_visibility('invalid session',true);exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL invalid owner session';end if;
 perform public.chef_location_visibility(t,false);
 if exists(select 1 from public.public_kitchen_locations() where chef_id=c) then raise exception 'FAIL revoked consent still public';end if;
 perform public.chef_location(t,p_remove=>true);
 if public.chef_location(t) is not null then raise exception 'FAIL deleted location retained';end if;
 if has_table_privilege('anon','public.kitchen_locations','select') then raise exception 'FAIL private location table exposed';end if;
end $$;
rollback;
select 'PASS save privately, explicit consent publishes exact point, invalid session blocked, revocation hides, removal clears, no test records retained' as result;
