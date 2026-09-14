begin;
do $$
declare r jsonb;c uuid;t text;offer uuid;offer2 uuid;req uuid:=gen_random_uuid();order_id uuid;blocked boolean;new_settings jsonb;
begin
 r:=public.chef_register('اختبار إعدادات المطبخ','0600000091','casablanca','الدار البيضاء','اختبار','m','483927');c:=(r->>'chef_id')::uuid;t:=r->>'session_token';
 new_settings:=jsonb_build_object('fulfilment_type','pickup','pickup_instructions','العنوان الأول للاختبار','work_days',jsonb_build_array('الجمعة'));
 execute 'set local role anon';
 r:=public.chef_order_settings(t,new_settings);
 if r->>'work_days'<>'الجمعة' or not(r->>'configured')::boolean then raise exception 'FAIL saved kitchen days';end if;
 if not exists(select 1 from public.public_kitchen_workdays() where chef_id=c and work_days='الجمعة') then raise exception 'FAIL public days';end if;
 blocked:=false;begin perform public.chef_order_settings('wrong',new_settings);exception when others then blocked:=true;end;if not blocked then raise exception 'FAIL wrong session preferences';end if;
 offer:=public.chef_publish_meal(t,'{"name":"كسكس","price":160}',jsonb_build_object('specialty','أكلات تقليدية وشعبية','serves',4),req);
 offer2:=public.chef_publish_meal(t,'{"name":"رفيسة","price":80}',jsonb_build_object('specialty','أكلات تقليدية وشعبية','serves',2),gen_random_uuid());
 r:=public.place_meal_order(offer,2,jsonb_build_object('name','زبون اختبار','phone','0600000092','requested_at',now()+interval '2 days'),'pickup',repeat('e',64));
 execute 'reset role';select id into order_id from public.orders where order_ref=r->>'order_ref';
 -- Every order already has the pickup snapshot, though the customer cannot read it before acceptance.
 if public.customer_meal_order(repeat('e',64))->>'pickup_instructions' is not null then raise exception 'FAIL pending pickup privacy';end if;
 perform public.chef_order_settings(t,new_settings||jsonb_build_object('pickup_instructions','العنوان الثاني للاختبار','work_days',jsonb_build_array('الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد')));
 if exists(select 1 from public.meal_pickup_details where offer_id in(offer,offer2) and instructions<>'العنوان الثاني للاختبار') then raise exception 'FAIL shared settings';end if;
 perform public.chef_update_meal(t,offer,'{"name":"كسكس جديد","price":200}',12,'');
 perform public.chef_meal_order_status(t,order_id,'accepted');
 r:=public.customer_meal_order(repeat('e',64));if r->>'pickup_instructions'<>'العنوان الأول للاختبار' then raise exception 'FAIL changed existing order pickup';end if;
 if r->>'dish_name'<>'كسكس' or (r->>'total')::numeric<>320 or (r->>'serves')::integer<>4 then raise exception 'FAIL agreement';end if;
 if array_length(string_to_array(public.chef_order_settings(t)->>'work_days','، '),1)<>7 then raise exception 'FAIL all days';end if;
 if has_table_privilege('anon','public.chef_kitchen_profiles','select') or has_table_privilege('authenticated','public.chef_kitchen_profiles','select') then raise exception 'FAIL private settings grants';end if;
end $$;
rollback;
select 'PASS: one kitchen settings source, public days only, no day barrier, reuse for second dish, immutable pickup/order agreement, owner and privacy checks' result;
