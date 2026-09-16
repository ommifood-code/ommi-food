'use strict';

const adminMoney=v=>{const cents=Math.round(Number(v)*100);if(!Number.isFinite(cents))return 'غير محدد';const whole=Math.trunc(cents/100),part=Math.abs(cents%100);return `${whole} ${Math.abs(whole)>=3&&Math.abs(whole)<=10?'دراهم':'درهمًا'}${part?` و${part} سنتيمًا`:''}`;};
let adminOrdersVersion=0;
const orderLabels={pending:'بانتظار القبول',accepted:'مقبول',preparing:'قيد التحضير',ready:'جاهز',delivered:'تم التسليم',rejected:'مرفوض',cancelled:'ملغى',expired:'انتهت المهلة'};
function adminOrderTime(value){const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ar-MA',{timeZone:'Africa/Casablanca',dateStyle:'medium',timeStyle:'short'});}
async function loadAdminOrders(){
 const version=++adminOrdersVersion,box=document.getElementById('adminOrdersList');if(!box)return;if(!box.children.length)box.textContent='جاري تحميل الطلبات...';
 const fields='id,order_ref,chef_id,admin_contacted_at,serves,unit_price,chef_name,dish_name,customer_name,customer_phone,quantity,total,delivery_fee,fulfilment_type,delivery_area,customer_address,notes,status,order_until,ready_at,feedback,received_confirmed,would_repeat,complaint,complaint_resolved_at,created_at';
 const results=await Promise.all([
  db.from('orders').select(fields).not('offer_id','is',null).not('complaint','is',null).is('complaint_resolved_at',null).order('created_at').limit(200),
  db.from('orders').select(fields).not('offer_id','is',null).eq('status','pending').gt('order_until',new Date().toISOString()).order('created_at').limit(200),
  db.from('orders').select(fields).not('offer_id','is',null).order('created_at',{ascending:false}).limit(100)
 ]);
 const error=results.find(r=>r.error)?.error;
 const data=[...new Map(results.flatMap(r=>r.data||[]).map(o=>[o.id,o])).values()];
 const chefIds=[...new Set(data.map(o=>o.chef_id))];const phones=chefIds.length?await db.from('chefs').select('id,phone').in('id',chefIds):{data:[]};const phoneMap=new Map((phones.data||[]).map(c=>[c.id,c.phone]));
 if(version!==adminOrdersVersion)return;
 if(error){window.setAdminAttentionCounts?.('legacy',{urgent:0,complaints:0});box.textContent='تعذر تحميل سجل الطلبات. تحقق من جلسة الإدارة.';return;}
 const overdue=o=>o.status==='pending'&&o.order_until&&new Date(o.order_until)<=new Date();
 const openComplaint=o=>Boolean(o.complaint&&!o.complaint_resolved_at);
 const priority=o=>overdue(o)?0:o.status==='pending'?1:openComplaint(o)?2:3;
 data.sort((a,b)=>priority(a)-priority(b)||new Date(a.created_at)-new Date(b.created_at));
 const complaints=data.filter(openComplaint).length,late=data.filter(overdue).length;
 window.setAdminAttentionCounts?.('legacy',{urgent:late+complaints,complaints});
 box.innerHTML=data.length?'':'<p class="admin-empty">لا توجد طلبات في هذا السجل.</p>';
 document.getElementById('adminOrdersSummary').textContent=`بانتظار رد المطبخ: ${data.filter(o=>o.status==='pending'&&!overdue(o)).length} — فات موعدها: ${late} — المعروض: ${data.length} طلب — بلاغات مفتوحة: ${complaints}`;
 data.forEach(o=>{
  const lateOrder=overdue(o),status=lateOrder?'expired':o.status,card=document.createElement('article');
  card.className='meal-card admin-legacy-order-card'+(lateOrder||openComplaint(o)?' admin-priority-urgent':'')+(openComplaint(o)?' admin-open-complaint':'');
  card.innerHTML=`<strong>${e(o.chef_name)} — ${e(o.dish_name)}</strong><p>${e(orderLabels[status]||status)} · ${o.quantity} × طبق · ${adminMoney(o.total)}</p><p>كل طبق يكفي ${o.serves||'—'} أشخاص · ثمنه ${adminMoney(o.unit_price)}</p><p>الزبون: ${e(o.customer_name)} · <a href="tel:${e(o.customer_phone)}">${e(o.customer_phone)}</a></p><p>الموعد المطلوب: ${adminOrderTime(o.ready_at)}</p><p>الاستلام: ${o.fulfilment_type==='pickup'?'من المطبخ':'توصيل إلى '+e(o.delivery_area||'')+' — '+e(o.customer_address||'')}</p><p>ثمن التوصيل: ${adminMoney(o.delivery_fee||0)}</p>${o.notes?`<p>ملاحظة الزبون: ${e(o.notes)}</p>`:''}<p>${e(o.order_ref)}</p>${o.feedback?`<p>رأي الزبون: ${e(o.feedback)}</p>`:''}${o.received_confirmed!==null?`<p>الاستلام مؤكد من الزبون: ${o.received_confirmed?'نعم':'لا'} · يرغب في التكرار: ${o.would_repeat?'نعم':'لا'}</p>`:''}${o.complaint?`<p>البلاغ: ${e(o.complaint)}</p><p>${o.complaint_resolved_at?'تمت معالجته':'يحتاج متابعة'}</p>`:''}`;
  if(o.status==='pending'){
   const phone=phoneMap.get(o.chef_id),minutes=Math.max(0,Math.floor((Date.now()-new Date(o.created_at))/60000));
   card.insertAdjacentHTML('beforeend',`<p><strong>${lateOrder?'يحتاج متابعة — فات الموعد المطلوب':`يحتاج متابعة — ينتظر منذ ${minutes} دقيقة`}</strong></p>${phone?`<p>اتصل بالمطبخ: <a href="tel:${e(phone)}">${e(phone)}</a></p>`:'<p>تعذر تحميل رقم المطبخ. حدّث الصفحة.</p>'}${lateOrder?'<div class="admin-warning">اتصل بالمطبخ والزبون لتثبيت موعد جديد أو إنهاء الطلب.</div>':''}${o.admin_contacted_at?`<p>آخر اتصال مسجل: ${adminOrderTime(o.admin_contacted_at)}</p>`:''}`);
   const contacted=document.createElement('button');contacted.type='button';contacted.className='admin-secondary';contacted.textContent='سجّل أنني تابعت الطلب';contacted.onclick=async()=>{contacted.disabled=true;try{const result=await db.rpc('admin_contacted_meal_order',{p_order_id:o.id});if(result.error)throw result.error;await loadAdminOrders();}catch{toastMsg('تعذر تسجيل الاتصال.');}finally{contacted.disabled=false;}};card.append(contacted);
  }
  if(openComplaint(o)){const b=document.createElement('button');b.type='button';b.className='admin-secondary';b.textContent='تمت مراجعة البلاغ';b.onclick=async()=>{b.disabled=true;try{const{error:rpcError}=await db.rpc('admin_resolve_meal_complaint',{p_order_id:o.id});if(rpcError)throw rpcError;await loadAdminOrders();}catch{toastMsg('تعذر حفظ معالجة البلاغ.');b.disabled=false;}};card.append(b);}
  box.append(card);
 });
 window.applyAdminView?.();
}
document.getElementById('adminOrdersRefresh')?.addEventListener('click',()=>loadAdminOrders().catch(()=>toastMsg('تعذر الاتصال.')));

const freeLaunchAdminRender=render;render=function(rows){freeLaunchAdminRender(rows);loadAdminOrders().catch(()=>toastMsg('تعذر تحميل الطلبات'));};
if(!dashboard.hidden)loadAdminOrders().catch(()=>toastMsg('تعذر تحميل الطلبات'));

let adminRefreshBusy=false;
setInterval(async()=>{if(document.visibilityState==='hidden'||dashboard.hidden||adminRefreshBusy)return;adminRefreshBusy=true;try{await loadAdminOrders();}catch{toastMsg('تعذر تحديث الطلبات.');}finally{adminRefreshBusy=false;}},60000);
