'use strict';
const orderLabels={pending:'بانتظار القبول',accepted:'مقبول',preparing:'قيد التحضير',ready:'جاهز',delivered:'تم التسليم',rejected:'مرفوض',cancelled:'ملغى',expired:'انتهت المهلة'};
async function loadAdminOrders(){
 const box=document.getElementById('adminOrdersList');box.textContent='جاري تحميل الطلبات...';
 const fields='id,order_ref,chef_name,dish_name,customer_name,customer_phone,quantity,total,status,order_until,ready_at,feedback,received_confirmed,would_repeat,complaint,complaint_resolved_at,created_at';
 const results=await Promise.all([
 db.from('orders').select(fields).not('offer_id','is',null).not('complaint','is',null).is('complaint_resolved_at',null).order('created_at').limit(200),
 db.from('orders').select(fields).not('offer_id','is',null).eq('status','pending').gt('order_until',new Date().toISOString()).order('created_at').limit(200),
 db.from('orders').select(fields).not('offer_id','is',null).order('created_at',{ascending:false}).limit(100)]);
 const error=results.find(r=>r.error)?.error;
 const data=[...new Map(results.flatMap(r=>r.data||[]).map(o=>[o.id,o])).values()];
 data.sort((a,b)=>priority(a)-priority(b));
 function priority(o){return o.complaint&&!o.complaint_resolved_at?0:o.status==='pending'&&new Date(o.order_until)>new Date()?1:2;}
 if(error){box.textContent='تعذر تحميل الطلبات. تحقق من جلسة الإدارة.';return;}
 box.innerHTML=data.length?'':'<p>لا توجد طلبات بعد.</p>';
 const complaints=data.filter(o=>o.complaint&&!o.complaint_resolved_at).length;
 document.getElementById('adminOrdersSummary').textContent=`المعروض: ${data.length} طلب — بلاغات مفتوحة: ${complaints} (الأولوية للبلاغات والطلبات المعلقة؛ حتى 200 لكل قائمة)`;
 data.forEach(o=>{const status=o.status==='pending'&&new Date(o.order_until)<=new Date()?'expired':o.status;const card=document.createElement('article');card.className='meal-card';card.innerHTML=`<strong>${e(o.chef_name)} — ${e(o.dish_name)}</strong><p>${e(orderLabels[status]||status)} · ${o.quantity} حصة · ${Number(o.total).toFixed(2)} درهم</p><p>${e(o.customer_name)} · ${e(o.customer_phone)}</p><p>${e(o.order_ref)}</p>${o.feedback?`<p>رأي الزبون: ${e(o.feedback)}</p>`:''}${o.received_confirmed!==null?`<p>الاستلام مؤكد من الزبون: ${o.received_confirmed?'نعم':'لا'} · يرغب في التكرار: ${o.would_repeat?'نعم':'لا'}</p>`:''}${o.complaint?`<p>البلاغ: ${e(o.complaint)}</p><p>${o.complaint_resolved_at?'تمت معالجته':'يحتاج متابعة'}</p>`:''}`;
 if(o.complaint&&!o.complaint_resolved_at){const b=document.createElement('button');b.className='admin-secondary';b.textContent='تمت متابعة البلاغ ومعالجته';b.onclick=async()=>{b.disabled=true;try{const{error}=await db.rpc('admin_resolve_meal_complaint',{p_order_id:o.id});if(error)throw error;await loadAdminOrders();}catch{toastMsg('تعذر حفظ معالجة البلاغ.');b.disabled=false;}};card.append(b);}box.append(card);});
}
document.getElementById('adminOrdersRefresh').onclick=()=>loadAdminOrders().catch(()=>toastMsg('تعذر الاتصال.'));


const freeLaunchAdminRender=render;render=function(rows){freeLaunchAdminRender(rows);loadAdminOrders().catch(()=>toastMsg("تعذر تحميل الطلبات"));};
if(!dashboard.hidden)loadAdminOrders().catch(()=>toastMsg("تعذر تحميل الطلبات"));
