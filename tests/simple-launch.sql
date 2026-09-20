begin;
do $$
declare r jsonb;c uuid;t text;other_t text;oid uuid;offer uuid;req uuid:=gen_random_uuid();d jsonb:=('{"name":"كسكس اختبار","price":40}'::jsonb||jsonb_build_object('requested_at',now()+interval '2 days'));p jsonb;n integer;blocked boolean;
begin
 r:=public.chef_register('اختبار المسار المبسط','0600000091','casablanca','الدار البيضاء','اختبار','m','483927');c:=(r->>'chef_id')::uuid;t:=r->>'session_token';
 p:=jsonb_build_object('specialty','أكلات تقليدية وشعبية','serves',1,'ingredients','قمح وخضر','fulfilment_type','pickup','pickup_instructions','عنوان خاص للاختبار');
 execute 'set local role anon';
 perform public.chef_location(t,33.57314,-7.62314);
 r:=public.chef_location(t);if (r->>'lat')::numeric<>33.57314 then raise exception 'FAIL owner location';end if;
 select count(*) into n from public.public_kitchen_locations() where chef_id=c and lat<>33.57314 and lng<>-7.62314;
 if n<>1 then raise exception 'FAIL coarse public location';end if;
 blocked:=false;begin perform public.chef_location('invalid',33.57,-7.62);exception when others then blocked:=true;end;if not blocked then raise exception 'FAIL invalid session';end if;
 blocked:=false;begin perform public.chef_location(t,34.02,-6.84);exception when others then blocked:=true;end;if not blocked then raise exception 'FAIL outside launch';end if;
 offer:=public.chef_publish_meal(t,d,p,req);
 if public.chef_publish_meal(t,d,p,req)<>offer then raise exception 'FAIL duplicate meal';end if;
 r:=public.place_meal_order(offer,2,('{"name":"زبون الاختبار","phone":"0600000092"}'::jsonb||jsonb_build_object('requested_at',now()+interval '2 days')),'pickup',repeat('c',64));
 if public.customer_meal_order(repeat('c',64))->>'status'<>'pending' then raise exception 'FAIL automatic acceptance';end if;
 execute 'reset role';
 if (select jsonb_array_length(dishes) from public.chefs where id=c)<>1 then raise exception 'FAIL duplicate dish';end if;
 select id into oid from public.orders where order_ref=r->>'order_ref';
 perform public.chef_meal_order_status(t,oid,'accepted');
 perform public.chef_meal_order_status(t,oid,'cancelled','اختبار');perform public.chef_meal_order_status(t,oid,'cancelled','اختبار');
 update public.chefs set membership_status='inactive' where id=c;
 if exists(select 1 from public.public_kitchen_locations() where chef_id=c) then raise exception 'FAIL suspended map';end if;
 if has_table_privilege('anon','public.kitchen_locations','select') or has_table_privilege('authenticated','public.kitchen_locations','select') then raise exception 'FAIL exact location exposed';end if;
end $$;
rollback;
select 'PASS: private/coarse location, session, city, atomic publish, idempotent retry, pending order, acceptance, cancellation, suspension; fixtures rolled back' result;
