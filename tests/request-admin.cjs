const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const w=new JSDOM('<div id="adminStatsGrid"></div><div id="adminStatsNote"></div><div id="adminOrdersList"></div>',{runScripts:'dangerously'}).window;
const now=Date.now(),past=new Date(now-7200000).toISOString(),future=new Date(now+3600000).toISOString();
const base={dish_name:'طلب اختبار',people:3,estimate:120,customer_name:'زبون',customer_phone:'0600000002',chef_phone:'0600000001',created_at:past,requested_at:past};
const rows=[{...base,id:'late',status:'preparing',chef_agreed_at:past,agreed_at:past},{...base,id:'rescheduled',status:'preparing',chef_agreed_at:past,agreed_at:future},{...base,id:'received',status:'ready',received_at:past},{...base,id:'complaint',status:'pending',requested_at:future,complaint:'تأخر التواصل'}];
const calls=[],errors=[];w.addEventListener('error',e=>errors.push(e.error));
w.e=s=>String(s??'');w.adminMoney=v=>v==null?'غير محدد':v+' درهمًا';w.toastMsg=()=>{};w.loadAdminOrders=async()=>{};
w.db={rpc:async(name,args)=>{calls.push([name,args]);if(args?.p_action==='resolve')rows.find(r=>r.id===args.p_id).complaint_resolved_at=future;if(args?.p_action==='contacted')rows.find(r=>r.id===args.p_id).admin_contacted_at=future;return{data:{requests:rows,metrics:{requests:rows.length}}};}};
const rules=w.document.createElement('script');rules.textContent=fs.readFileSync(path.join(__dirname,'../order-rules.js'),'utf8');w.document.body.append(rules);
const script=w.document.createElement('script');script.textContent=fs.readFileSync(path.join(__dirname,'../food-request-admin.js'),'utf8');w.document.body.append(script);
(async()=>{
 await w.loadRequestAdmin();assert.equal(w.requestAdminOverdue({...base,status:'pending',requested_at:null}),false,'unscheduled request is not overdue');assert.equal(w.requestAdminOverdue(rows.find(r=>r.id==='late')),true);assert.equal(w.requestAdminOverdue(rows.find(r=>r.id==='rescheduled')),false,'new agreed time used');assert.equal(w.requestAdminOverdue(rows.find(r=>r.id==='received')),false,'receipt ends lateness');
 const cards=[...w.document.querySelectorAll('.admin-request-card')];assert.equal(cards.filter(c=>c.classList.contains('admin-priority-urgent')).length,2);assert.equal(w.document.querySelectorAll('.admin-open-complaint').length,1);
 const late=cards.find(c=>c.textContent.includes('سجّل أنني تابعت الطلب')&&c.textContent.includes('المطبخ سجّل الاتفاق'));
 assert.ok(late);await late.querySelector('button').onclick();assert.equal(rows.find(r=>r.id==='late').status,'preparing','admin follow-up does not accept or finish');
 const complaint=w.document.querySelector('.admin-open-complaint');const button=[...complaint.querySelectorAll('button')].find(b=>b.textContent==='تمت مراجعة البلاغ');assert.ok(button);await button.onclick();assert.equal(w.document.querySelectorAll('.admin-open-complaint').length,0);assert.equal(rows.find(r=>r.id==='complaint').status,'pending','review does not resolve order');
 assert.ok(calls.some(([name,args])=>name==='food_request_admin'&&args?.p_action==='resolve'));assert.deepEqual(errors,[]);console.log('PASS admin overdue/receipt classification, revised time, complaint review, manual follow-up without changing order status');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>w.close());
