-- Run as postgres in a single transaction; fixtures never persist or become public.
begin;
do $$
declare chef uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); offer uuid; response jsonb; oid uuid; blocked boolean; t text:=repeat('a',64); t2 text:=repeat('b',64); t3 text:=repeat('c',64); v jsonb;
begin
 insert into public.chefs(id,name,gender,phone,city,city_label,area,status,membership_type,membership_status,phone_verified,dishes)
 values(chef,'اختبار معاملة مؤقت','f','0600000000','casablanca','الدار البيضاء','اختبار','active','honorary','active',true,'[{"name":"كسكس","price":"40"}]');
 insert into public.chefs(id,name,gender,phone,city,status) values(outsider,'اختبار آخر','m','0600000001','casablanca','pending');
 insert into public.chef_sessions(chef_id,token_hash,expires_at) values(chef,public._chef_session_hash('temporary-test-session'),now()+interval '1 hour'),(outsider,public._chef_session_hash('temporary-other-session'),now()+interval '1 hour');
 insert into public.chef_kitchen_profiles(chef_id,fulfilment_type) values(chef,'both');
 offer:=public.meal_offer_create('temporary-test-session',0,jsonb_build_object('serves',1,'ingredients','قمح وخضر','allergens','يحتوي القمح','fulfilment_type','both','delivery_fee',15,'delivery_areas',jsonb_build_array('معاريف'),'pickup_instructions','عنوان اختبار خاص'));
 response:=public.place_meal_order(offer,2,('{"name":"زبون اختبار","phone":"0600000002","area":"معاريف","address":"عنوان الاختبار"}'::jsonb||jsonb_build_object('requested_at',now()+interval '2 days')),'delivery',t);
 if (response->>'total')::numeric<>95 then raise exception 'FAIL server total'; end if;
 if response<>public.place_meal_order(offer,2,('{"name":"زبون اختبار","phone":"0600000002","area":"معاريف","address":"عنوان الاختبار"}'::jsonb||jsonb_build_object('requested_at',now()+interval '2 days')),'delivery',t) then raise exception 'FAIL retry idempotency'; end if;
 select id into oid from public.orders where order_ref=response->>'order_ref';
 blocked:=false;begin perform public.chef_meal_order_status('temporary-other-session',oid,'accepted');exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL cross chef access'; end if;
 v:=public.customer_meal_order(t);if v->>'chef_phone' is null or v->>'pickup_instructions' is not null then raise exception 'FAIL order contact visibility';end if;
 blocked:=false;begin perform public.customer_meal_order(repeat('d',64));exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL invalid customer token';end if;
 response:=public.place_meal_order(offer,1,('{"name":"زبون ثان","phone":"0600000003"}'::jsonb||jsonb_build_object('requested_at',now()+interval '2 days')),'pickup',t2);
 perform public.chef_meal_order_status('temporary-test-session',oid,'accepted');
 blocked:=false;begin perform public.chef_meal_order_status('temporary-test-session',(select id from public.orders where order_ref=response->>'order_ref'),'accepted');exception when others then blocked:=true;end;
 if blocked then raise exception 'FAIL unexpected inventory limit';end if;
 blocked:=false;begin perform public.chef_meal_order_status('temporary-test-session',oid,'delivered');exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL skipped transition';end if;
 perform public.chef_meal_order_status('temporary-test-session',oid,'cancelled','اختبار تحرير الحصص');
 perform public.chef_meal_order_status('temporary-test-session',oid,'cancelled','إلغاء ثان لا يجب أن يحرر الحصص مرتين');
 select id into oid from public.orders where order_ref=response->>'order_ref';
 perform public.chef_meal_order_status('temporary-test-session',oid,'accepted');
 v:=public.customer_meal_order(t2);if v->>'pickup_instructions'<>'عنوان اختبار خاص' then raise exception 'FAIL pickup details';end if;
 perform public.chef_meal_order_status('temporary-test-session',oid,'preparing');
 perform public.chef_meal_order_status('temporary-test-session',oid,'ready');
 perform public.chef_meal_order_status('temporary-test-session',oid,'delivered');
 perform public.customer_meal_action(t2,'feedback','تجربة اختبار',true,true);
 perform public.customer_meal_action(t2,'complaint','بلاغ اختبار مؤقت');
 v:=public.customer_meal_order(t2);if v->>'feedback'<>'تجربة اختبار' or v->>'complaint'<>'بلاغ اختبار مؤقت' then raise exception 'FAIL feedback';end if;
 blocked:=false;begin perform public.place_meal_order(offer,1,('{"name":"زبون ثالث","phone":"0600000004","area":"حي غير مخدوم","address":"عنوان الاختبار"}'::jsonb||jsonb_build_object('requested_at',now()+interval '2 days')),'delivery',t3);exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL delivery area validation';end if;
 perform public.meal_offer_close('temporary-test-session',offer);
 blocked:=false;begin perform public.place_meal_order(offer,1,('{"name":"زبون ثالث","phone":"0600000004"}'::jsonb||jsonb_build_object('requested_at',now()+interval '2 days')),'pickup',t3);exception when others then blocked:=true;end;
 if not blocked then raise exception 'FAIL closed dish';end if;
 if has_table_privilege('anon','public.orders','SELECT') or has_table_privilege('anon','public.orders','INSERT') then raise exception 'FAIL public order access';end if;
 if has_table_privilege('anon','public.order_access','SELECT') then raise exception 'FAIL token access';end if;
end $$;
rollback;
select 'PASS: totals, retries, ownership, private tracking, no inventory, transitions, idempotent cancellation release, delivery, feedback, expiry, grants; fixtures rolled back' as result;


