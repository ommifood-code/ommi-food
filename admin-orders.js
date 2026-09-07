'use strict';
const orderLabels={pending:'بانتظار القبول',accepted:'مقبول',preparing:'قيد التحضير',ready:'جاهز',delivered:'تم التسليم',rejected:'مرفوض',cancelled:'ملغى',expired:'انتهت المهلة'};
async function loadAdminOrders(){
 const box=document.getElementById('adminOrdersList');box.textContent='جاري تحميل الطلبات...';
 const{data,error}=await db.from('orders').select('id,order_ref,chef_name,dish_name,customer_name,customer_phone,quantity,total,status,order_until,ready_at,feedback,received_confirmed,would_repeat,complaint,complaint_resolved_at').not('offer_id','is',null).order('created_at',{ascending:false}).limit(200);
 if(error){box.textContent='تعذر تحميل الطلبات. تحقق من جلسة الإدارة.';return;}
 box.innerHTML=data.length?'':'<p>لا توجد طلبات بعد.</p>';
 const complaints=data.filter(o=>o.complaint&&!o.complaint_resolved_at).length;
 document.getElementById('adminOrdersSummary').textContent=`آخر ${data.length} طلب — بلاغات مفتوحة: ${complaints}`;
 data.forEach(o=>{const status=o.status==='pending'&&new Date(o.order_until)<=new Date()?'expired':o.status;const card=document.createElement('article');card.className='meal-card';card.innerHTML=`<strong>${e(o.chef_name)} — ${e(o.dish_name)}</strong><p>${e(orderLabels[status]||status)} · ${o.quantity} حصة · ${Number(o.total).toFixed(2)} درهم</p><p>${e(o.customer_name)} · ${e(o.customer_phone)}</p><p>${e(o.order_ref)}</p>${o.feedback?`<p>رأي الزبون: ${e(o.feedback)}</p>`:''}${o.received_confirmed!==null?`<p>الاستلام مؤكد من الزبون: ${o.received_confirmed?'نعم':'لا'} · يرغب في التكرار: ${o.would_repeat?'نعم':'لا'}</p>`:''}${o.complaint?`<p>البلاغ: ${e(o.complaint)}</p><p>${o.complaint_resolved_at?'تمت معالجته':'يحتاج متابعة'}</p>`:''}`;
 if(o.complaint&&!o.complaint_resolved_at){const b=document.createElement('button');b.className='admin-secondary';b.textContent='تمت متابعة البلاغ ومعالجته';b.onclick=async()=>{b.disabled=true;try{const{error}=await db.rpc('admin_resolve_meal_complaint',{p_order_id:o.id});if(error)throw error;await loadAdminOrders();}catch{toastMsg('تعذر حفظ معالجة البلاغ.');b.disabled=false;}};card.append(b);}box.append(card);});
}
document.getElementById('adminOrdersRefresh').onclick=()=>loadAdminOrders().catch(()=>toastMsg('تعذر الاتصال.'));
