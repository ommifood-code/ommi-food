/* Ommi Food UX hardening before the final E2E test. Business rules live in SQL. */
'use strict';

function uxInfo(className,title,text){
 const box=document.createElement('div');box.className=`meal-ux-note ${className||''}`;
 box.innerHTML=`<strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span>`;return box;
}

// New orders are confirmed immediately by the server. Keep a neutral label only for legacy pending rows.
if(typeof mealStatus==='object'){
 mealStatus.pending='طلب مسجل';
 mealStatus.accepted='تم تأكيد الطلب';
}

const pendingCopy=document.querySelector('.pending-order-warning');
if(pendingCopy)pendingCopy.textContent='عند إرسال الطلب تُحجز الحصص المتاحة مباشرة ويصبح الطلب مؤكدًا. الدفع مباشرة مع المطبخ.';

const _mountMealDashboard=mountMealDashboard;
mountMealDashboard=function(c){
 _mountMealDashboard(c);
 const dash=document.getElementById('chefKitchenDashboard'),actions=dash?.querySelector('#mealActions');if(!actions)return;
 actions.classList.add('meal-dashboard-actions');
 let guide=dash.querySelector('#mealKitchenGuide');
 if(!guide){
  guide=document.createElement('section');guide.id='mealKitchenGuide';guide.className='meal-kitchen-guide';
  guide.innerHTML=`<div><strong>أطباقي المحفوظة</strong><span>وصفات وصور وأسعار تحفظها في مطبخك ويمكنك تعديلها في أي وقت. حفظ الطبق وحده لا يجعله متاحًا للطلب.</span></div><div><strong>وجبات الحجز</strong><span>عندما تريد بيع طبق في موعد محدد، أتحه كوجبة وحدد عدد الحصص وآخر أجل للحجز وموعد الجاهزية.</span></div><div><strong>طلبات مطبخي</strong><span>كل طلب جديد لوجبة متاحة يتأكد مباشرة إذا كانت الحصص موجودة. بعدها تدير التحضير والجاهزية والتسليم أو الإلغاء.</span></div>`;
  actions.insertAdjacentElement('afterend',guide);
 }
};

const _openMealOfferForm=openMealOfferForm;
openMealOfferForm=async function(c){
 await _openMealOfferForm(c);
 const box=document.querySelector('#mealOfferEditor .meal-content');if(!box)return;
 if(!box.querySelector('.offer-meaning'))box.prepend(uxInfo('offer-meaning','هذه وجبة متاحة وليست طبقًا جديدًا','اختر طبقًا محفوظًا في مطبخك وحدد متى سيكون متاحًا للحجز وكم حصة ستبيع. السعر يؤخذ من الطبق المحفوظ.'));
 [...box.querySelectorAll('label')].forEach(label=>{
  if(label.textContent.includes('آخر أجل للطلب وقبوله'))label.childNodes[0].textContent='آخر أجل للطلب';
 });
 [...box.querySelectorAll('small,p')].forEach(el=>{
  if(el.textContent.includes('يظهر للزبون بعد قبول طلبه فقط'))el.textContent='يظهر عنوان الاستلام للزبون بعد تأكيد الطلب.';
  if(el.textContent.includes('الطلب يحتاج قبول المطبخ'))el.textContent='كل طلب جديد يُؤكد مباشرة إذا كانت الحصص متاحة، وتُحجز الحصص لحظة تسجيله.';
 });
};

const _openMyMealOffers=openMyMealOffers;
openMyMealOffers=async function(){
 await _openMyMealOffers();
 const box=document.querySelector('#myMealOffers .meal-content');if(!box||box.querySelector('.offers-meaning'))return;
 box.prepend(uxInfo('offers-meaning','وجباتي المتاحة للحجز','هذه ليست قائمة أطباق مطبخك الدائمة. هنا تظهر فقط الوجبات التي حددت لها موعدًا وكمية لاستقبال طلبات الزبائن.'));
};

if(typeof openChefMealOrders==='function'){
 const _openChefMealOrders=openChefMealOrders;
 openChefMealOrders=async function(){
  await _openChefMealOrders();
  const box=document.querySelector('#chefMealOrders .meal-content');if(!box)return;
  let note=box.querySelector('.chef-order-rule');
  if(!note){note=uxInfo('chef-order-rule','قاعدة الحصص','الحصص تُحجز فور تسجيل الطلب المؤكد. إذا أُلغي الطلب قبل بدء التحضير يعيد النظام حصصه مرة واحدة فقط.');box.prepend(note);}
 };
}

if(typeof openCustomerMealOrders==='function'){
 const _openCustomerMealOrders=openCustomerMealOrders;
 openCustomerMealOrders=async function(){
  await _openCustomerMealOrders();
  const panel=document.querySelector('#customerMealOrders .meal-content');if(panel&&!panel.querySelector('.tracking-privacy'))panel.prepend(uxInfo('tracking-privacy','متابعة خاصة','تظهر طلباتك في هذا المتصفح باستخدام رموز المتابعة المحفوظة فيه. لا تُعرض بيانات الطلبات للعامة.'));
 };
}
