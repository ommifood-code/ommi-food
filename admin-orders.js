'use strict';
const orderLabels={pending:'بانتظار القبول',accepted:'مقبول',preparing:'قيد التحضير',ready:'جاهز',delivered:'تم التسليم',rejected:'مرفوض',cancelled:'ملغى',expired:'انتهت المهلة'};
async function loadAdminOrders(){
 const box=document.getElementById('adminOrdersList');box.textContent='جاري تحميل الطلبات...';
 const fields='id,order_ref,chef_id,admin_contacted_at,serves,unit_price,chef_name,dish_name,customer_name,customer_phone,quantity,total,status,order_until,ready_at,feedback,received_confirmed,would_repeat,complaint,complaint_resolved_at,created_at';
 const results=await Promise.all([
 db.from('orders').select(fields).not('offer_id','is',null).not('complaint','is',null).is('complaint_resolved_at',null).order('created_at').limit(200),
 db.from('orders').select(fields).not('offer_id','is',null).eq('status','pending').gt('order_until',new Date().toISOString()).order('created_at').limit(200),
 db.from('orders').select(fields).not('offer_id','is',null).order('created_at',{ascending:false}).limit(100)]);
 const error=results.find(r=>r.error)?.error;
 const data=[...new Map(results.flatMap(r=>r.data||[]).map(o=>[o.id,o])).values()];
 const chefIds=[...new Set(data.map(o=>o.chef_id))];const phones=chefIds.length?await db.from('chefs').select('id,phone').in('id',chefIds):{data:[]};const phoneMap=new Map((phones.data||[]).map(c=>[c.id,c.phone]));
 data.sort((a,b)=>priority(a)-priority(b));
 function priority(o){return o.status==='pending'&&new Date(o.order_until)>new Date()?0:o.complaint&&!o.complaint_resolved_at?1:2;}
 if(error){box.textContent='تعذر تحميل الطلبات. تحقق من جلسة الإدارة.';return;}
 box.innerHTML=data.length?'':'<p>لا توجد طلبات بعد.</p>';
 const complaints=data.filter(o=>o.complaint&&!o.complaint_resolved_at).length;
 document.getElementById('adminOrdersSummary').textContent=`بانتظار رد المطبخ: ${data.filter(o=>o.status==='pending'&&new Date(o.order_until)>new Date()).length} — المعروض: ${data.length} طلب — بلاغات مفتوحة: ${complaints} (الأولوية للطلبات التي تحتاج اتصالًا والبلاغات؛ حتى 200 لكل قائمة)`;
 data.forEach(o=>{const status=o.status==='pending'&&new Date(o.order_until)<=new Date()?'expired':o.status;const card=document.createElement('article');card.className='meal-card';card.innerHTML=`<strong>${e(o.chef_name)} — ${e(o.dish_name)}</strong><p>${e(orderLabels[status]||status)} · ${o.quantity} × طبق · ${Number(o.total).toFixed(2)} درهم</p><p>كل طبق يكفي ${o.serves||"—"} أشخاص · ثمنه ${Number(o.unit_price).toFixed(2)} درهم</p><p>الزبون: ${e(o.customer_name)} · <a href="tel:${e(o.customer_phone)}">${e(o.customer_phone)}</a></p><p>الموعد المطلوب: ${new Intl.DateTimeFormat("ar-MA",{timeZone:"Africa/Casablanca",dateStyle:"medium",timeStyle:"short"}).format(new Date(o.ready_at))}</p><p>${e(o.order_ref)}</p>${o.feedback?`<p>رأي الزبون: ${e(o.feedback)}</p>`:''}${o.received_confirmed!==null?`<p>الاستلام مؤكد من الزبون: ${o.received_confirmed?'نعم':'لا'} · يرغب في التكرار: ${o.would_repeat?'نعم':'لا'}</p>`:''}${o.complaint?`<p>البلاغ: ${e(o.complaint)}</p><p>${o.complaint_resolved_at?'تمت معالجته':'يحتاج متابعة'}</p>`:''}`;
 if(status==='pending'){
 const phone=phoneMap.get(o.chef_id),minutes=Math.max(0,Math.floor((Date.now()-new Date(o.created_at))/60000));card.insertAdjacentHTML('beforeend',`<p><strong>يحتاج متابعة — ينتظر منذ ${minutes} دقيقة</strong></p>${phone?`<p>اتصل بالمطبخ: <a href="tel:${e(phone)}">${e(phone)}</a></p>`:'<p>تعذر تحميل رقم المطبخ. حدّث الصفحة.</p>'}${o.admin_contacted_at?`<p>آخر اتصال مسجل: ${new Date(o.admin_contacted_at).toLocaleString('ar-MA',{timeZone:'Africa/Casablanca'})}</p>`:''}`);
 const contacted=document.createElement('button');contacted.className='admin-secondary';contacted.textContent='سجل أنني اتصلت بالمطبخ';contacted.onclick=async()=>{contacted.disabled=true;const result=await db.rpc('admin_contacted_meal_order',{p_order_id:o.id});if(result.error){toastMsg('تعذر تسجيل الاتصال.');contacted.disabled=false;return;}await loadAdminOrders();};card.append(contacted);
 }
 if(o.complaint&&!o.complaint_resolved_at){const b=document.createElement('button');b.className='admin-secondary';b.textContent='تمت متابعة البلاغ ومعالجته';b.onclick=async()=>{b.disabled=true;try{const{error}=await db.rpc('admin_resolve_meal_complaint',{p_order_id:o.id});if(error)throw error;await loadAdminOrders();}catch{toastMsg('تعذر حفظ معالجة البلاغ.');b.disabled=false;}};card.append(b);}box.append(card);});
}
document.getElementById('adminOrdersRefresh').onclick=()=>loadAdminOrders().catch(()=>toastMsg('تعذر الاتصال.'));


const freeLaunchAdminRender=render;render=function(rows){freeLaunchAdminRender(rows);loadAdminOrders().catch(()=>toastMsg("تعذر تحميل الطلبات"));};
if(!dashboard.hidden)loadAdminOrders().catch(()=>toastMsg("تعذر تحميل الطلبات"));

// Refresh while the administrator is present; no promise of background alerts.
let adminRefreshBusy=false;
setInterval(async()=>{if(document.visibilityState==='hidden'||dashboard.hidden||adminRefreshBusy)return;adminRefreshBusy=true;try{await loadAdminOrders();}catch{toastMsg('تعذر تحديث الطلبات.');}finally{adminRefreshBusy=false;}},60000);
