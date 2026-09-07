'use strict';
let subscriptionAdminRows=[];
async function loadSubscriptions(){
 const box=document.getElementById('adminSubscriptions');
 const{data:s,error}=await db.rpc('admin_subscriptions');
 if(error){box.textContent='تعذر تحميل الاشتراكات.';return;}
 adminExpiredSubscriptions=new Set(s.expired.map(c=>c.id));subscriptionAdminRender(subscriptionAdminRows);
 box.innerHTML=`<h2>الاشتراكات · 50 درهمًا شهريًا</h2><p>كاش بليس · دون عمولة على الطلبات</p><p>أداء بانتظار التحقق: ${s.payments.filter(p=>p.status==='pending').length} · اشتراكات منتهية: ${s.expired.length}</p>`;
 const settings=document.createElement('details');settings.innerHTML=`<summary>بيانات استقبال الأداء</summary><form class="meal-form"><label>تعليمات كاش بليس التي تظهر لأصحاب المطابخ<textarea name="instructions" class="field" maxlength="2000" placeholder="اسم المستفيد وطريقة إرسال المبلغ وتعليمات الإيصال">${e(s.instructions)}</textarea></label><p>أدخل بيانات استقبال صحيحة فقط. لا تنشر رمز سحب أو بيانات دخول.</p><button class="admin-secondary">حفظ التعليمات</button></form>`;
 settings.querySelector('form').onsubmit=async ev=>{ev.preventDefault();const f=ev.target,b=f.querySelector('button');b.disabled=true;try{const{error}=await db.rpc('admin_subscription_settings',{p_instructions:f.elements.instructions.value});if(error)throw error;toastMsg('تم حفظ تعليمات الأداء');}catch{toastMsg('تعذر حفظ التعليمات');}finally{b.disabled=false;}};box.append(settings);
 for(const p of s.payments.filter(p=>p.status==='pending')){
 const card=document.createElement('article');card.className='meal-card';card.innerHTML=`<h3>${e(p.name)} · 50 درهمًا</h3><p>مرجع الإيصال: ${e(p.reference)}</p><p>${e(date(p.created_at))}</p><a href="tel:${e(p.phone)}">${e(p.phone)}</a><p>راجع وصول المبلغ في سجل كاش بليس؛ مرجع الإيصال وحده لا يثبت الأداء.</p><label><input type="checkbox" data-publish ${p.chef_status!=='rejected'?'checked':''}> اعتماد المطبخ ونشره مع تأكيد الأداء</label>${!p.phone_verified?'<label><input type="checkbox" data-phone> تحققت من ملكية الهاتف وراجعت المطبخ</label>':''}`;
 const approve=document.createElement('button');approve.className='primary';approve.textContent='تأكيد استلام 50 درهمًا';
 approve.onclick=()=>review(p,card,true,approve);const reject=document.createElement('button');reject.className='admin-secondary';reject.textContent='طلب تصحيح مرجع الأداء';reject.onclick=()=>review(p,card,false,reject);card.append(approve,reject);box.append(card);
 }
 if(s.expired.length){const expired=document.createElement('details');expired.innerHTML='<summary>اشتراكات تحتاج تجديدًا</summary>'+s.expired.map(c=>`<p>${e(c.name)} · ${e(date(c.paid_until))}</p>`).join('');box.append(expired);}
 const history=document.createElement('details');history.innerHTML='<summary>سجل تأكيدات الأداء</summary>'+s.payments.filter(p=>p.status!=='pending').map(p=>`<p>${e(p.name)} · ${e(p.reference)} · ${p.status==='approved'?'50 درهمًا — مؤكد حتى '+e(date(p.period_end)):'لم يعتمد — '+e(p.reason)}</p>`).join('');box.append(history);
}
async function review(p,card,approve,b){
 const reason=approve?'':prompt('سبب طلب التصحيح:');if(!approve&&(!reason||reason.trim().length<3))return;
 if(approve&&!confirm('هل تأكدت فعلًا من استلام 50 درهمًا عبر كاش بليس؟'))return;
 b.disabled=true;try{const{error}=await db.rpc('review_subscription_payment',{p_payment_id:p.id,p_approve:approve,p_reason:reason,p_publish:approve&&card.querySelector('[data-publish]').checked,p_phone_confirmed:!!card.querySelector('[data-phone]')?.checked});if(error)throw error;await load();toastMsg(approve?'تم تسجيل الشهر المدفوع':'تم إرسال طلب التصحيح');}catch{toastMsg('تعذر التأكيد. إن اخترت النشر، تحقق من الهاتف واكتمال المطبخ.');}finally{b.disabled=false;}
}
const subscriptionAdminRender=render;
render=function(rows){subscriptionAdminRows=rows;subscriptionAdminRender(rows);loadSubscriptions().catch(()=>toastMsg('تعذر تحميل الاشتراكات'));loadAdminOrders().catch(()=>toastMsg('تعذر تحميل الطلبات'));};

if(!dashboard.hidden)load().catch(()=>toastMsg("تعذر التحديث"));
