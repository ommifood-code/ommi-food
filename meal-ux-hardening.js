/* Ommi Food UX hardening before the final E2E test. No business rules live here. */
'use strict';

function uxInfo(className,title,text){
 const box=document.createElement('div');box.className=`meal-ux-note ${className||''}`;
 box.innerHTML=`<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;return box;
}

const _mountMealDashboard=mountMealDashboard;
mountMealDashboard=function(c){
 _mountMealDashboard(c);
 const dash=document.getElementById('chefKitchenDashboard'),actions=dash?.querySelector('#mealActions');if(!actions)return;
 actions.classList.add('meal-dashboard-actions');
 let guide=dash.querySelector('#mealKitchenGuide');
 if(!guide){
  guide=document.createElement('section');guide.id='mealKitchenGuide';guide.className='meal-kitchen-guide';
  guide.innerHTML=`<div><strong>أطباقي المحفوظة</strong><span>وصفات وصور وأسعار تحفظها في مطبخك ويمكنك تعديلها في أي وقت. حفظ الطبق وحده لا يجعله متاحًا للطلب.</span></div><div><strong>وجبات الحجز</strong><span>عندما تريد بيع طبق في موعد محدد، أتحه كوجبة وحدد عدد الحصص وآخر أجل للحجز وموعد الجاهزية.</span></div><div><strong>طلبات مطبخي</strong><span>هنا تدير الطلبات بعد وصولها: قبول أو رفض، ثم التحضير والجاهزية والتسليم أو الإلغاء.</span></div>`;
  actions.insertAdjacentElement('afterend',guide);
 }
};

const _openMealOfferForm=openMealOfferForm;
openMealOfferForm=async function(c){
 await _openMealOfferForm(c);
 const box=document.querySelector('#mealOfferEditor .meal-content');if(!box||box.querySelector('.offer-meaning'))return;
 box.prepend(uxInfo('offer-meaning','هذه وجبة متاحة وليست طبقًا جديدًا','اختر طبقًا محفوظًا في مطبخك وحدد متى سيكون متاحًا للحجز وكم حصة ستبيع. السعر يؤخذ من الطبق المحفوظ.'));
};

const _openMyMealOffers=openMyMealOffers;
openMyMealOffers=async function(){
 await _openMyMealOffers();
 const box=document.querySelector('#myMealOffers .meal-content');if(!box||box.querySelector('.offers-meaning'))return;
 box.prepend(uxInfo('offers-meaning','وجباتي المتاحة للحجز','هذه ليست قائمة أطباق مطبخك الدائمة. هنا تظهر فقط الوجبات التي حددت لها موعدًا وكمية لاستقبال طلبات الزبائن.'));
};

const _openMealOrdering=openMealOrdering;
openMealOrdering=async function(chef){
 await _openMealOrdering(chef);
 const fields=document.getElementById('mealOrderFields');if(!fields)return;
 let note=fields.querySelector('.pending-order-warning');
 if(!note){note=uxInfo('pending-order-warning','طلبك بانتظار قبول المطبخ','إرسال الطلب لا يعني تأكيده. لا تُحجز الحصص إلا عندما يقبل المطبخ الطلب. تابع الحالة من «طلباتي» واضغط «تحديث» لرؤية آخر تغيير.');fields.prepend(note);}
};

if(typeof openChefMealOrders==='function'){
 const _openChefMealOrders=openChefMealOrders;
 openChefMealOrders=async function(){
  await _openChefMealOrders();
  const box=document.querySelector('#chefMealOrders .meal-content');if(!box)return;
  let note=box.querySelector('.chef-order-rule');
  if(!note){note=uxInfo('chef-order-rule','قاعدة الحصص','الطلب المعلّق لا يحجز حصصًا. الحصص تُخصم عند القبول، وإذا أُلغي طلب مقبول يعيد النظام حصصه مرة واحدة فقط.');box.prepend(note);}
 };
}

if(typeof openCustomerMealOrders==='function'){
 const _openCustomerMealOrders=openCustomerMealOrders;
 openCustomerMealOrders=async function(){
  await _openCustomerMealOrders();
  const panel=document.querySelector('#customerMealOrders .meal-content');if(panel&&!panel.querySelector('.tracking-privacy'))panel.prepend(uxInfo('tracking-privacy','متابعة خاصة','تظهر طلباتك في هذا المتصفح باستخدام رموز المتابعة المحفوظة فيه. لا تُعرض بيانات الطلبات للعامة.'));
 };
}
