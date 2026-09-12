-- Run as postgres in a single transaction; fixtures never persist or become public.
begin;
do $$
declare
 chef uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); offer uuid;
 response jsonb; oid uuid; blocked boolean;
 t text:=repeat('a',64); t2 text:=repeat('b',64); v jsonb;
begin
 -- New kitchens start active immediately during the free launch; phone verification stays a separate trust flag.
 insert into public.chefs(id,name,gender,phone,city,city_label,area,status,membership_type,membership_status,phone_verified,dishes)
 values(chef,'اختبار تفعيل فوري','f','0600000000','casablanca','الدار البيضاء','اختبار','pending','none','inactive',false,'[{"name":"كسكس","price":"40"}]');
 if not exists(select 1 from public.chefs where id=chef and status='active' and membership_type='honorary' and membership_status='active') then
   raise exception 'FAIL immediate kitchen activation';
 end if;

 insert into public.chefs(id,name,gender,phone,city,status) values(outsider,'اختبار آخر','m','0600000001','casablanca','pending');
 insert into public.chef_sessions(chef_id,token_hash,expires_at) values
 (chef,public._chef_session_hash('temporary-test-session'),now()+interval '1 hour'),
 (outsider,public._chef_session_hash('temporary-other-session'),now()+interval '1 hour');
 insert into public.chef_kitchen_profiles(chef_id,fulfilment_type) values(chef,'both');

 offer:=public.meal_offer_create('temporary-test-session',0,jsonb_build_object(
  'portion','حصة لشخص واحد','ingredients','قمح وخضر','quantity',2,
  'order_until',now()+interval '1 day','ready_at',now()+interval '2 days',
  'fulfilment_type','both','delivery_fee',15,'delivery_areas',jsonb_build_array('معاريف'),
  'pickup_instructions','عنوان اختبار خاص'));

 response:=public.place_meal_order(offer,2,'{"name":"زبون اختبار","phone":"0600000002","area":"معاريف","address":"عنوان الاختبار"}','delivery',t);
 if (response->>'total')::numeric<>95 then raise exception 'FAIL server total'; end if;
 if response->>'status'<>'accepted' then raise exception 'FAIL immediate confirmation'; end if;
 if (select allocated from public.meal_offers where id=offer)<>2 then raise exception 'FAIL immediate portion reservation'; end if;

 -- Retrying with the same private token is idempotent and does not reserve twice.
 if response<>public.place_meal_order(offer,2,'{"name":"زبون اختبار","phone":"0600000002","area":"معاريف","address":"عنوان الاختبار"}','delivery',t) then
   raise exception 'FAIL retry idempotency';
 end if;
 if (select allocated from public.meal_offers where id=offer)<>2 then raise exception 'FAIL duplicate reservation'; end if;

 select id into oid from public.orders where order_ref=response->>'order_ref';
 v:=public.customer_meal_order(t);
 if v->>'status'<>'accepted' or v->>'chef_phone' is null then raise exception 'FAIL confirmed tracking'; end if;

 blocked:=false;begin perform public.customer_meal_order(repeat('d',64));exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL invalid customer token';end if;

 -- No overselling after immediate reservation.
 blocked:=false;begin
   perform public.place_meal_order(offer,1,'{"name":"زبون ثان","phone":"0600000003"}','pickup',t2);
 exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL overselling';end if;

 -- Another kitchen cannot manage this order.
 blocked:=false;begin perform public.chef_meal_order_status('temporary-other-session',oid,'preparing');exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL cross chef access'; end if;

 -- Customer cancellation before preparation releases portions exactly once.
 perform public.customer_meal_action(t,'cancel','');
 if (select allocated from public.meal_offers where id=offer)<>0 then raise exception 'FAIL release portions';end if;
 blocked:=false;begin perform public.customer_meal_action(t,'cancel','');exception when others then blocked:=true;end;
 if (select allocated from public.meal_offers where id=offer)<>0 then raise exception 'FAIL double release';end if;

 -- A fresh confirmed order follows preparation -> ready -> delivered.
 response:=public.place_meal_order(offer,1,'{"name":"زبون ثان","phone":"0600000003"}','pickup',t2);
 select id into oid from public.orders where order_ref=response->>'order_ref';
 if (select allocated from public.meal_offers where id=offer)<>1 then raise exception 'FAIL second immediate reservation';end if;
 v:=public.customer_meal_order(t2); if v->>'pickup_instructions'<>'عنوان اختبار خاص' then raise exception 'FAIL pickup details';end if;
 perform public.chef_meal_order_status('temporary-test-session',oid,'preparing');
 perform public.chef_meal_order_status('temporary-test-session',oid,'ready');
 perform public.chef_meal_order_status('temporary-test-session',oid,'delivered');
 perform public.customer_meal_action(t2,'feedback','تجربة اختبار',true,true);
 perform public.customer_meal_action(t2,'complaint','بلاغ اختبار مؤقت');
 v:=public.customer_meal_order(t2);
 if v->>'feedback'<>'تجربة اختبار' or v->>'complaint'<>'بلاغ اختبار مؤقت' then raise exception 'FAIL feedback';end if;

 if has_table_privilege('anon','public.orders','SELECT') or has_table_privilege('anon','public.orders','INSERT') then raise exception 'FAIL public order access';end if;
 if has_table_privilege('anon','public.order_access','SELECT') then raise exception 'FAIL token access';end if;
end $$;
rollback;
select 'PASS: immediate kitchen activation, immediate order confirmation, server totals, idempotency, capacity, private tracking, cancellation release, ownership, transitions and grants; fixtures rolled back' as result;
