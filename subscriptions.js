'use strict';
async function openSubscription(){
 const s=await mealRpc('chef_subscription',{p_session_token:chefSessionToken});
 const screen=mealPanel('chefSubscription','اشتراك مطبخي'),box=screen.querySelector('.meal-content');
 screen.querySelector('.back').onclick=async()=>{const c=await restoreChefSession(false);if(c)openKitchenDashboard(c);};
 const pending=s.payments.find(p=>p.status==='pending');
 box.innerHTML=`<h1>50 درهمًا في الشهر</h1><p>الأداء عبر كاش بليس. لا عمولة على الطلبات؛ ثمن الوجبات كامل للمطبخ.</p>
 <p>${s.membership==='honorary'?'مطبخك يستفيد حاليًا من عضوية شرفية.':s.paid_until?`اشتراكك ${new Date(s.paid_until)>new Date()?'ساري حتى':'انتهى في'} ${mealDate(s.paid_until)}`:'يبدأ شهر الاشتراك بعد تأكيد الإدارة لاستلام المبلغ.'}</p>
 ${s.instructions?`<div class="meal-card"><h2>تعليمات الأداء</h2><p style="white-space:pre-wrap">${escapeHtml(s.instructions)}</p></div>`:'<p>لم تُضف الإدارة تعليمات كاش بليس بعد. لا ترسل أي مبلغ قبل ظهور بيانات المستفيد هنا.</p>'}
 ${pending?'<p role="status">مرجع أدائك مسجل وبانتظار التحقق. لا ترسل المبلغ مرة أخرى.</p>':''}`;
 if(s.instructions&&!pending&&s.membership!=='honorary'){
 const f=document.createElement('form');f.className='meal-form';
 f.innerHTML='<label>مرجع إيصال الأداء<input name="reference" class="field" required minlength="4" maxlength="100" autocomplete="off"></label><small>أدخل مرجع الإيصال فقط، وليس رمز سحب الأموال أو رمزًا سريًا.</small><button class="primary">أرسلت 50 درهمًا — إبلاغ الإدارة</button><p>هذا الإبلاغ لا يؤكد وصول الأموال. التجديد يضيف شهرًا بعد نهاية اشتراكك الحالي، أو من يوم التأكيد إن انتهى.</p>';
 f.onsubmit=e=>{e.preventDefault();mealBusy(f.querySelector('button'),async()=>{await mealRpc('submit_subscription_payment',{p_session_token:chefSessionToken,p_reference:f.elements.reference.value});await openSubscription();});};box.append(f);
 }
 if(s.payments.length){const history=document.createElement('details');history.innerHTML='<summary>سجل الأداء</summary>'+s.payments.map(p=>`<p>${escapeHtml(p.reference)} · 50 درهمًا · ${{pending:'بانتظار التحقق',approved:'تم تأكيد الاستلام',rejected:'لم يعتمد'}[p.status]}${p.reason?` — ${escapeHtml(p.reason)}`:''}</p>`).join('');box.append(history);}
 showScreen(screen.id);
}
const subscriptionMountDashboard=mountMealDashboard;
mountMealDashboard=function(c){subscriptionMountDashboard(c);document.getElementById('mealActions').append(mealAction('اشتراكي · 50 درهمًا / شهر',openSubscription));};
