-- Execute as one call. Nothing from these fixtures persists.
begin;
do $$
declare c uuid;t text;offer uuid;r jsonb;customer jsonb;token text;req uuid;i integer;blocked boolean;
 future_time timestamptz:=now()+interval '180 days';
begin
 r:=public.chef_register('اختبار موعد اختياري','0600000084','casablanca','الدار البيضاء','اختبار','m','483927');
 c:=(r->>'chef_id')::uuid;t:=r->>'session_token';
 perform public.chef_order_settings(t,'{"fulfilment_type":"pickup","pickup_instructions":"عنوان اختبار خاص"}');
 execute 'set local role anon';
 offer:=public.chef_save_reference_dish(t,null,'{"name":"طبق اختبار","price":40}','{"specialty":"أكلات تقليدية وشعبية"}',gen_random_uuid());
 for i in 1..4 loop
  token:=lpad(i::text,64,'d');
  customer:=jsonb_build_object('name','زبون اختبار','phone','0600000085');
  if i=2 then customer:=customer||'{"requested_at":""}'::jsonb;
  elsif i=3 then customer:=customer||'{"requested_at":null}'::jsonb;
  elsif i=4 then customer:=customer||jsonb_build_object('requested_at',future_time);end if;
  perform public.food_request_create(c,offer,2,customer,token);
  r:=public.food_request_customer(token);req:=(r->>'id')::uuid;
  if i<4 and r->>'requested_at' is not null then raise exception 'FAIL invented request time';end if;
  if i=4 and (r->>'requested_at')::timestamptz<>future_time then raise exception 'FAIL supplied date was not preserved';end if;
  if (r->>'estimate')::numeric<>80 then raise exception 'FAIL changed estimate';end if;
  perform public.food_request_chef_action(t,req,'discussing');
  perform public.food_request_chef_action(t,req,'agreed');
  r:=public.food_request_customer(token);
  if r->>'status'<>'preparing' or r->>'chef_agreed_at' is null then raise exception 'FAIL optional time blocks preparation';end if;
  if i<4 and r->>'agreed_at' is not null then raise exception 'FAIL invented agreement time';end if;
  if r->>'customer_agreed_at' is not null then raise exception 'FAIL fabricated customer consent';end if;
 end loop;
 blocked:=false;
 begin
  perform public.food_request_create(c,offer,2,customer||jsonb_build_object('requested_at',now()-interval '1 day'),lpad('5',64,'d'));
 exception when others then if sqlerrm<>'invalid requested time' then raise;end if;blocked:=true;end;
 if not blocked then raise exception 'FAIL explicit past date accepted';end if;
 execute 'reset role';
end $$;
select 'PASS omitted, empty and null times accepted without invented deadlines; explicit future time preserved without 60-day cap; kitchen accepts and starts preparation' as result;
rollback;
