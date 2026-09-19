'use strict';

let requestAdminVersion=0;
const priorAdminOrders=loadAdminOrders;
loadAdminOrders=async function(){await Promise.all([priorAdminOrders(),loadRequestAdmin()]);};

function requestAdminTime(value){
 if(!value)return '—';
 const d=new Date(value);if(Number.isNaN(d.getTime()))return '—';
 return d.toLocaleString('ar-MA',{timeZone:'Africa/Casablanca',dateStyle:'medium',timeStyle:'short'});
}
function requestAdminElapsed(value){
 const at=Date.parse(value);if(!Number.isFinite(at))return '—';
 const minutes=Math.max(0,Math.floor((Date.now()-at)/60000));
 if(minutes<60)return `${minutes} دقيقة`;
 const hours=Math.floor(minutes/60),days=Math.floor(hours/24);
 return days?`${days} يوم و${hours%24} ساعة`:`${hours} ساعة`;
}
function requestAdminOverdue(o){
 return !o.received_at&&['pending','discussing','proposed','accepted','preparing','ready'].includes(o.status)&&Number.isFinite(Date.parse(o.agreed_at||o.requested_at))&&Date.parse(o.agreed_at||o.requested_at)<Date.now();
}
function requestAdminStatus(o){
 if(o.received_at)return 'الاستلام مؤكد من الزبون';
 const labels={pending:'بانتظار رد المطبخ',discussing:'قبله المطبخ — بانتظار الاتفاق',proposed:'تفاصيل سابقة — تحتاج متابعة',accepted:'تم الاتفاق',preparing:'قيد التحضير',ready:'جاهز',delivered:'المطبخ أعلن التسليم',rejected:'لم يتم الاتفاق',cancelled:'ملغى'};
 return requestAdminOverdue(o)?'فات الموعد المطلوب':labels[o.status]||o.status||'غير محدد';
}
function requestAdminStats(m){
 const stats=[
  ['كل الطلبات',m.requests??0],
  ['أطباق خارج القائمة',m.custom_requests??0],
  ['استلام مؤكد',m.confirmed_received??0],
  ['تقييمات',m.rated??0],
  ['نتيجة غير مؤكدة',m.unknown_outcome??0],
  ['متوسط الرد',m.average_response_minutes==null?'—':`${m.average_response_minutes} دقيقة`],
  ['قيمة الاتفاقات المؤكدة',adminMoney(m.agreement_value)],
  ['أرقام طلبت أكثر من مرة',m.repeat_phone_count??0]
 ];
 const grid=document.getElementById('adminStatsGrid');
 if(grid)grid.innerHTML=stats.map(([label,value])=>`<div class="admin-stat"><strong>${e(value)}</strong><span>${e(label)}</span></div>`).join('');
 const note=document.getElementById('adminStatsNote');
 if(note)note.textContent='القيمة تشمل الأسعار المسجّلة والمؤكدة داخل التطبيق فقط. أثمان الاتفاقات الهاتفية غير المسجّلة غير محسوبة؛ ليست هذه مداخيل المنصة.';
}

async function loadRequestAdmin(){
 const version=++requestAdminVersion;
 let section=document.getElementById('requestAdmin');
 if(!section){
  section=document.createElement('div');section.id='requestAdmin';
  document.getElementById('adminOrdersList')?.before(section);
 }
 const {data,error}=await db.rpc('food_request_admin');
 if(version!==requestAdminVersion)return;
 if(error){
  section.innerHTML='<p class="admin-load-error">تعذر تحميل طلبات الزبائن. حدّث الصفحة للمحاولة مجددًا.</p>';
  return;
 }
 const requests=Array.isArray(data?.requests)?data.requests:[];
 const metrics=data?.metrics||{};
 const overdue=o=>requestAdminOverdue(o);
 const openComplaint=o=>Boolean(o.complaint&&!o.complaint_resolved_at);
 const urgent=o=>overdue(o)||openComplaint(o);
 window.setAdminAttentionCounts?.('requests',{urgent:requests.filter(urgent).length,complaints:requests.filter(openComplaint).length});
 requestAdminStats(metrics);
 section.className='admin-request-content';
 section.innerHTML=`<div class="admin-request-overview"><div><strong>${requests.length}</strong><span>طلبًا في السجل</span></div><div><strong>${requests.filter(urgent).length}</strong><span>تحتاج متابعة الآن</span></div><div><strong>${requests.filter(o=>o.status==='pending').length}</strong><span>بانتظار رد المطبخ</span></div></div><div id="adminRequestCards"></div>`;
 const cards=document.getElementById('adminRequestCards');
 if(!requests.length){cards.innerHTML='<p class="admin-empty">لا توجد طلبات زبائن بعد.</p>';window.applyAdminView?.();return;}
 requests.sort((a,b)=>Number(urgent(b))-Number(urgent(a)||0)||Number(a.status!=='pending')-Number(b.status!=='pending')||Date.parse(a.created_at||0)-Date.parse(b.created_at||0));
 for(const o of requests){
  const card=document.createElement('article');
  card.className='meal-card admin-request-card'+(urgent(o)?' admin-priority-urgent':'')+(openComplaint(o)?' admin-open-complaint':'');
  const dish=e(o.dish_name||'طبق غير مسمى');
  const ref=e(o.order_ref||'—');
  const currentStatus=requestAdminStatus(o);
  const agreement=o.chef_agreed_at?`<div class="admin-agreement"><strong>المطبخ سجّل الاتفاق بعد التواصل</strong><p>الموعد: ${requestAdminTime(o.agreed_at)}</p></div>`:o.agreement_version?`<div class="admin-agreement"><strong>${o.customer_agreed_at?'الاتفاق الذي وافق عليه الزبون':'تفاصيل سابقة مقترحة'}</strong><p>${e(o.agreed_dish||o.dish_name)} · ${e(o.agreed_people||'—')} أشخاص · ${adminMoney(o.agreed_total)} · ${requestAdminTime(o.agreed_at)}</p><p>${e(o.agreed_fulfilment||'')}</p></div>`:'';
  card.innerHTML=`<div class="admin-request-heading"><h3>${dish} <small>— ${ref}</small></h3><strong class="admin-status ${urgent(o)?'late':''}">${e(currentStatus)}</strong></div><p>المطلوب: ${e(o.people??'—')} أشخاص · الموعد: ${requestAdminTime(o.requested_at)}</p><p>التقدير: ${adminMoney(o.estimate)}${o.offer_id?'':' · طبق طلبه الزبون خارج القائمة'}</p><p>الزبون: ${e(o.customer_name||'—')} — <a href="tel:${e(o.customer_phone||'')}">${e(o.customer_phone||'غير متوفر')}</a></p><p>المطبخ: ${e(o.chef_phone||'غير متوفر')}</p>${overdue(o)?'<div class="admin-warning"><strong>تأخر الطلب.</strong> اتصل بالمطبخ والزبون لتثبيت موعد جديد أو إنهاء الطلب.</div>':''}${agreement}<p>إعلان التسليم: ${o.chef_delivered_at?requestAdminTime(o.chef_delivered_at):'لم يسجّل'} · تأكيد الزبون: ${o.received_at?requestAdminTime(o.received_at):'غير معروف'}</p><p>التقييم: ${o.rating??'لم يقيّم'}${o.feedback?` — ${e(o.feedback)}`:''}</p>${o.reason?`<p>سبب الاعتذار أو الإلغاء: ${e(o.reason)}</p>`:''}${o.notes?`<p>رغبة الزبون: ${e(o.notes)}</p>`:''}${o.complaint?`<div class="admin-complaint"><strong>بلاغ ${o.complaint_resolved_at?'مراجع':'مفتوح'}:</strong> ${e(o.complaint)}</div>`:''}`;
  const action=(label,name)=>{
   const b=document.createElement('button');b.type='button';b.textContent=label;b.className='admin-secondary';
   b.onclick=async()=>{b.disabled=true;try{const r=await db.rpc('food_request_admin',{p_id:o.id,p_action:name});if(r.error)throw r.error;await loadRequestAdmin();}catch{toastMsg('تعذر حفظ المتابعة.');}finally{b.disabled=false;}};
   card.append(b);
  };
  if(!o.received_at&&['pending','discussing','proposed','accepted','preparing','ready'].includes(o.status)){
   card.insertAdjacentHTML('beforeend',`<p><strong>ينتظر منذ ${requestAdminElapsed(o.created_at)}</strong>${o.admin_contacted_at?` · آخر متابعة: ${requestAdminTime(o.admin_contacted_at)}`:''}</p>`);
   action('سجّل أنني تابعت الطلب','contacted');
  }
  if(openComplaint(o))action('تمت مراجعة البلاغ','resolve');
  cards.append(card);
 }
 window.applyAdminView?.();
}

const requestAdminRefresh=()=>loadAdminOrders().catch(()=>toastMsg('تعذر تحديث الطلبات.'));
document.getElementById('adminRequestsRefresh')?.addEventListener('click',requestAdminRefresh);
document.getElementById('adminStatsRefresh')?.addEventListener('click',requestAdminRefresh);
if(typeof dashboard==='undefined'||!dashboard.hidden)loadRequestAdmin().catch(()=>toastMsg('تعذر تحميل طلبات الزبائن'));
