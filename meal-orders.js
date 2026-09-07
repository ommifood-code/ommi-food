/* Scheduled home meals. Prices, quantities and transitions are enforced by RPCs. */
'use strict';
const mealStatus={pending:'بانتظار قبول المطبخ',accepted:'تم قبول الطلب',preparing:'قيد التحضير',ready:'جاهز للاستلام أو التوصيل',delivered:'تم التسليم',rejected:'اعتذر المطبخ',cancelled:'ملغى',expired:'انتهت مهلة القبول'};
const mealDate=v=>new Intl.DateTimeFormat('ar-MA',{timeZone:'Africa/Casablanca',dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
const mealMoney=v=>`${Number(v).toFixed(2)} درهم`;
const mealEffectiveStatus=o=>o.status==='pending'&&new Date(o.order_until)<=new Date()?'expired':o.status;
function mealLocalToISO(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('حدد موعد الوجبة وآخر أجل للطلب.');
 const target=Date.parse(value+'Z');let instant=target;
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(let i=0;i<3;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(instant)).map(x=>[x.type,x.value]));const shown=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);if(shown===target)return new Date(instant).toISOString();instant+=target-shown;}
 throw Error('هذا التوقيت غير متاح بسبب تغيير الساعة. اختر موعدًا آخر.');
}
async function mealRpc(name,args){const{data,error}=await db.rpc(name,args);if(error)throw Error(mealError(error.message));return data;}
function mealError(message){
 const known={'invalid session':'انتهت الجلسة. ادخل إلى مطبخك مجددًا.','offer unavailable':'الوجبة غير متاحة الآن. حدّث القائمة.','insufficient portions':'لا توجد حصص كافية لقبول هذا الطلب.','too many requests':'وصلت إلى حد الطلبات خلال الساعة. حاول لاحقًا.','invalid transition':'تغيرت حالة الطلب أو انتهت مهلة قبوله. حدّث القائمة.','order not found':'تعذر الوصول إلى الطلب. تحقق من رمز المتابعة.','invalid delivery address':'حدد حيًا مخدومًا وعنوانًا واضحًا.','invalid dates':'راجع المواعيد: آخر أجل قبل الجاهزية، وخلال الستين يومًا القادمة.'};
 return Object.entries(known).find(([key])=>String(message).includes(key))?.[1]||'تعذر إتمام العملية. راجع البيانات وحاول مجددًا.';
}
async function mealBusy(button,work){const label=button.textContent;button.disabled=true;try{await work();}catch(err){showToast(err.message||'تعذر الاتصال. حاول مجددًا.');}finally{button.disabled=false;button.textContent=label;}}
function mealPanel(id,title){let el=document.getElementById(id);if(el)return el;el=document.createElement('section');el.id=id;el.className='screen';el.innerHTML=`<header class="topbar"><button type="button" class="back">←</button><strong>${title}</strong></header><div class="content meal-content"></div>`;document.querySelector('main').appendChild(el);el.querySelector('.back').onclick=()=>showScreen('home');return el;}
function mealAction(label,fn){const b=document.createElement('button');b.type='button';b.className='admin-secondary';b.textContent=label;b.onclick=()=>mealBusy(b,fn);return b;}
function mountMealDashboard(c){
 const dash=document.getElementById('chefKitchenDashboard');let actions=dash.querySelector('#mealActions');
 if(!actions){actions=document.createElement('div');actions.id='mealActions';actions.className='meal-actions';dash.querySelector('.kitchen-builder').prepend(actions);}
 actions.replaceChildren(mealAction('إتاحة وجبة للحجز',()=>openMealOfferForm(c)),mealAction('وجباتي المتاحة',openMyMealOffers),mealAction('طلبات مطبخي',openChefMealOrders));
}
async function openMealOfferForm(c){
 const fresh=await restoreChefSession(false);if(!fresh)throw Error('ادخل إلى مطبخك مجددًا.');c=fresh;
 const screen=mealPanel('mealOfferEditor','إتاحة وجبة للحجز'),box=screen.querySelector('.meal-content');
 screen.querySelector('.back').onclick=()=>openKitchenDashboard(c);
 const dishes=normaliseDishes(c.dishes);if(!dishes.length)throw Error('أضف طبقًا إلى مطبخك أولًا.');
 box.innerHTML=`<p>اختر طبقًا محفوظًا وحدد موعده وكميته. جميع المواعيد بتوقيت المغرب. ظهور الوجبة للزبائن يتبع تفعيل المطبخ.</p>
 <form id="mealOfferForm" class="meal-form">
 <label>الطبق<select name="dish" class="field">${dishes.map((d,i)=>`<option value="${i}">${escapeHtml(d.name)} — ${escapeHtml(d.price)} درهم للحصة</option>`).join('')}</select></label>
 <label>ماذا تتضمن الحصة؟ ولِكم شخصًا تكفي؟<input name="portion" class="field" required maxlength="300" placeholder="مثال: حصة لشخص واحد مع الخضر واللحم"></label>
 <label>المكونات الرئيسية<textarea name="ingredients" class="field" required maxlength="2000"></textarea></label>
 <label>عدد الحصص<input name="quantity" type="number" min="1" max="500" value="5" class="field" required></label>
 <label>آخر أجل للطلب وقبوله<input name="order_until" type="datetime-local" class="field" required></label>
 <label>موعد جاهزية الوجبة<input name="ready_at" type="datetime-local" class="field" required></label>
 <label>طريقة الاستلام<select name="fulfilment_type" class="field">${(c.fulfilment_type==='both'?['pickup','delivery','both']:[c.fulfilment_type||'pickup']).map(v=>`<option value="${v}">${{pickup:'الاستلام من المطبخ',delivery:'التوصيل',both:'الاستلام أو التوصيل'}[v]}</option>`).join('')}</select></label>
 <div data-pickup><label>عنوان الاستلام وتعليماته<input name="pickup_instructions" class="field" minlength="5" maxlength="1000"></label><small>يظهر للزبون بعد قبول طلبه فقط.</small></div>
 <div data-delivery hidden><label>أحياء التوصيل، حي واحد في كل سطر<textarea name="delivery_areas" class="field" maxlength="2000"></textarea></label><label>ثمن التوصيل للطلب داخل هذه الأحياء<input name="delivery_fee" type="number" min="0" max="1000" step="0.01" value="0" class="field"></label></div>
 <button class="primary full" type="submit">حفظ الوجبة وإتاحتها للحجز</button><p>الطلب يحتاج قبول المطبخ. الحصص تُحجز عند القبول؛ لا تعد بكمية تتجاوز قدرتك.</p></form>`;
 const form=box.querySelector('form'),mode=form.elements.fulfilment_type;
 function sync(){const delivery=mode.value!=='pickup',pickup=mode.value!=='delivery';box.querySelector('[data-delivery]').hidden=!delivery;box.querySelector('[data-pickup]').hidden=!pickup;form.elements.delivery_areas.required=delivery;form.elements.pickup_instructions.required=pickup;}
 mode.onchange=sync;sync();
 form.onsubmit=e=>{e.preventDefault();mealBusy(form.querySelector('[type=submit]'),async()=>{const p=Object.fromEntries(new FormData(form));p.order_until=mealLocalToISO(p.order_until);p.ready_at=mealLocalToISO(p.ready_at);if(new Date(p.order_until)<=new Date()||new Date(p.order_until)>=new Date(p.ready_at))throw Error('آخر أجل يجب أن يكون مستقبلًا وقبل جاهزية الوجبة.');p.delivery_areas=[...new Set(p.delivery_areas.split('\n').map(x=>x.trim()).filter(Boolean))];await mealRpc('meal_offer_create',{p_session_token:chefSessionToken,p_dish_index:Number(p.dish),p_offer:p});showToast('تم حفظ الوجبة.');await openMyMealOffers();});};showScreen(screen.id);
}
async function openMyMealOffers(){
 const rows=await mealRpc('chef_meal_offers',{p_session_token:chefSessionToken}),screen=mealPanel('myMealOffers','وجباتي للحجز'),box=screen.querySelector('.meal-content');
 screen.querySelector('.back').onclick=async()=>{const c=await restoreChefSession(false);if(c)openKitchenDashboard(c);};box.innerHTML='';
 box.append(mealAction('تحديث',openMyMealOffers));if(!rows.length)box.insertAdjacentHTML('beforeend','<p>لا توجد وجبات مجدولة بعد. يمكنك إتاحة وجبة من «مطبخي».</p>');
 rows.forEach(o=>{const card=document.createElement('article');card.className='meal-card';card.innerHTML=`<h2>${escapeHtml(o.dish_name)}</h2><p>${mealDate(o.ready_at)}</p><p>الحصص المؤكدة: ${o.allocated} من ${o.quantity}</p><p>${o.active&&new Date(o.order_until)>new Date()?'الحجز مفتوح':'الحجز مغلق'}</p>`;if(o.active)card.append(mealAction('إيقاف استقبال طلبات جديدة',async()=>{await mealRpc('meal_offer_close',{p_session_token:chefSessionToken,p_offer_id:o.id});await openMyMealOffers();}));box.append(card);});showScreen(screen.id);
}
let selectedMealOffer=null,mealOffers=[],mealRequest=null;
async function openMealOrdering(chef){
 activeChef=chef;selectedMealOffer=null;mealRequest=null;
 document.getElementById('orderChefName').textContent=`${prefix(chef.gender)} ${chef.name}`;document.getElementById('orderChefArea').textContent=chef.area||'الدار البيضاء';
 const list=document.getElementById('dishList');list.innerHTML='<p>جاري تحميل الوجبات المتاحة للحجز...</p>';document.getElementById('mealOrderFields').hidden=true;openModal(orderModal);
 const{data,error}=await db.from('meal_offers').select('*').eq('chef_id',chef.id).eq('active',true).gt('order_until',new Date().toISOString()).order('ready_at');
 if(activeChef?.id!==chef.id)return;if(error){list.innerHTML='<p>تعذر تحميل الوجبات. أغلق النافذة وحاول مجددًا.</p>';return;}
 mealOffers=(data||[]).filter(o=>o.quantity>o.allocated);
 list.innerHTML=mealOffers.length?'':'<p>لا توجد وجبات متاحة للحجز حاليًا من هذا المطبخ.</p>';
 mealOffers.forEach(o=>{const b=document.createElement('button');b.type='button';b.className='dish-option meal-card';const img=safeImageUrl(o.image_url);b.innerHTML=`${img?`<img class="dish-option-image" src="${escapeHtml(img)}" alt="${escapeHtml(o.dish_name)}">`:''}<span><strong>${escapeHtml(o.dish_name)} — ${mealMoney(o.price)}</strong><span>${escapeHtml(o.portion)}</span><span>جاهزة: ${mealDate(o.ready_at)}</span><span>آخر أجل: ${mealDate(o.order_until)}</span><span>المتاح للتأكيد: ${o.quantity-o.allocated} حصة</span><span>المكونات: ${escapeHtml(o.ingredients)}</span></span>`;b.onclick=()=>selectMealOffer(o,b);list.append(b);});
}
function selectMealOffer(o,button){
 selectedMealOffer=o;mealRequest=null;document.querySelectorAll('#dishList .selected').forEach(e=>e.classList.remove('selected'));button.classList.add('selected');
 const fields=document.getElementById('mealOrderFields');fields.hidden=false;
 const select=document.getElementById('mealFulfilment');select.innerHTML=(o.fulfilment_type==='both'?['pickup','delivery']:[o.fulfilment_type]).map(v=>`<option value="${v}">${v==='pickup'?'الاستلام من المطبخ':'التوصيل'}</option>`).join('');
 const quantity=document.getElementById('mealQuantity');quantity.max=Math.min(50,o.quantity-o.allocated);quantity.value=1;
 document.getElementById('mealDeliveryArea').innerHTML=o.delivery_areas.map(a=>`<option>${escapeHtml(a)}</option>`).join('');updateMealTotal();
}
function updateMealTotal(){if(!selectedMealOffer)return;const delivery=document.getElementById('mealFulfilment').value==='delivery';document.getElementById('mealDeliveryFields').hidden=!delivery;document.getElementById('customerArea').required=delivery;const q=Number(document.getElementById('mealQuantity').value),fee=delivery?Number(selectedMealOffer.delivery_fee):0;document.getElementById('mealTotal').textContent=`الوجبة: ${mealMoney(q*Number(selectedMealOffer.price))} + التوصيل: ${mealMoney(fee)} = الإجمالي: ${mealMoney(q*Number(selectedMealOffer.price)+fee)}`;}
const MEAL_RECEIPTS_KEY='ommi_meal_receipts';
function readMealReceipts(){try{return JSON.parse(localStorage.getItem(MEAL_RECEIPTS_KEY)||'[]').filter(x=>/^[0-9a-f]{64}$/.test(x.token));}catch{return[];}}
function newMealToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
async function submitMealOrder(button){
 await mealBusy(button,async()=>{
 if(!selectedMealOffer)throw Error('اختر وجبة أولًا.');
 const form=document.getElementById('mealCustomerForm');if(!form.reportValidity())return;
 const quantity=Number(document.getElementById('mealQuantity').value);if(!Number.isInteger(quantity)||quantity<1||quantity>Number(document.getElementById('mealQuantity').max))throw Error('راجع عدد الحصص.');
 const args={p_offer_id:selectedMealOffer.id,p_quantity:quantity,p_fulfilment:document.getElementById('mealFulfilment').value,p_customer:{name:document.getElementById('customerName').value.trim(),phone:document.getElementById('customerPhone').value.trim(),area:document.getElementById('mealDeliveryArea').value,address:document.getElementById('customerArea').value.trim(),notes:document.getElementById('mealNotes').value.trim()}};
 // Persist the request capability BEFORE the network call, so a lost response is recoverable.
 const signature=JSON.stringify(args);if(!mealRequest||mealRequest.signature!==signature){mealRequest={signature,token:newMealToken()};const receipts=readMealReceipts();receipts.unshift({token:mealRequest.token,ref:'طلب قيد الإرسال'});localStorage.setItem(MEAL_RECEIPTS_KEY,JSON.stringify(receipts.slice(0,100)));}
 const request=mealRequest;
 const result=await mealRpc('place_meal_order',{...args,p_access_token:request.token});
 const receipts=readMealReceipts();const record=receipts.find(r=>r.token===request.token);if(record)record.ref=result.order_ref;localStorage.setItem(MEAL_RECEIPTS_KEY,JSON.stringify(receipts));
 closeModal(orderModal);showToast('أُرسل الطلب؛ ينتظر قبول المطبخ.');await openCustomerMealOrder(request.token);
 });
}
async function openCustomerMealOrder(token){
 const o=await mealRpc('customer_meal_order',{p_access_token:token}),screen=mealPanel('customerMealTracking','متابعة طلبي'),box=screen.querySelector('.meal-content');screen.querySelector('.back').onclick=openMyMealReceipts;
 box.innerHTML=`<article class="meal-card"><h2>${escapeHtml(mealStatus[o.status]||o.status)}</h2><p>${escapeHtml(o.dish_name)} — ${o.quantity} حصة</p><p>الإجمالي: ${mealMoney(o.total)}</p><p>الجاهزية: ${mealDate(o.ready_at)}</p><p>مرجع الطلب: ${escapeHtml(o.order_ref)}</p>${o.status==='pending'?`<p>لم يُؤكد الطلب بعد. القبول مطلوب قبل ${mealDate(o.order_until)}؛ الحصة غير محجوزة حتى القبول.</p>`:''}${o.status_reason?`<p>${escapeHtml(o.status_reason)}</p>`:''}${o.chef_phone?`<p>للتنسيق مع المطبخ: <a href="tel:${escapeHtml(o.chef_phone)}">${escapeHtml(o.chef_phone)}</a></p>`:''}${o.pickup_instructions?`<p>الاستلام: ${escapeHtml(o.pickup_instructions)}</p>`:''}</article><p>احتفظ برمز المتابعة الخاص؛ من يملكه يستطيع متابعة طلبك. يبقى محفوظًا في هذا المتصفح.</p><input class="field" readonly aria-label="رمز متابعة الطلب" value="${token}"><p>لا يوجد دفع إلكتروني في هذه النسخة؛ يُرتب الدفع مباشرة مع المطبخ.</p>`;
 box.append(mealAction('تحديث حالة الطلب',()=>openCustomerMealOrder(token)));
 if(o.status==='pending')box.append(mealAction('إلغاء الطلب قبل القبول',async()=>{await mealRpc('customer_meal_action',{p_access_token:token,p_action:'cancel'});await openCustomerMealOrder(token);}));
 if(['accepted','preparing','ready'].includes(o.status))box.insertAdjacentHTML('beforeend','<p>لإلغاء طلب مقبول، تواصل مع المطبخ لتأكيد الإلغاء.</p>');
 if(o.status==='delivered'){
 const f=document.createElement('form');f.className='meal-form';f.innerHTML=`<h2>كيف كانت التجربة؟</h2><label>هل استلمت الطلب؟<select name="received" class="field"><option value="true">نعم</option><option value="false">لا</option></select></label><label>هل ترغب في تكرار الطلب؟<select name="repeat" class="field"><option value="true">نعم</option><option value="false">لا</option></select></label><label>ملاحظتك<textarea name="feedback" class="field" maxlength="2000">${escapeHtml(o.feedback||'')}</textarea></label><button class="primary">حفظ رأيي</button>`;
 if(o.received_confirmed!==null)f.elements.received.value=String(o.received_confirmed);if(o.would_repeat!==null)f.elements.repeat.value=String(o.would_repeat);
 f.onsubmit=e=>{e.preventDefault();mealBusy(f.querySelector('button'),async()=>{await mealRpc('customer_meal_action',{p_access_token:token,p_action:'feedback',p_text:f.elements.feedback.value,p_received:f.elements.received.value==='true',p_repeat:f.elements.repeat.value==='true'});showToast('تم حفظ رأيك.');});};box.append(f);
 }
 const complaint=document.createElement('form');complaint.className='meal-form';complaint.innerHTML=`<label>إبلاغ الإدارة عن مشكلة<textarea name="message" class="field" required minlength="5" maxlength="2000">${escapeHtml(o.complaint||'')}</textarea></label><button class="admin-secondary">إرسال البلاغ</button>${o.complaint?`<p>${o.complaint_resolved_at?'أغلقت الإدارة البلاغ.':'بلاغك محفوظ وينتظر متابعة الإدارة.'}</p>`:''}`;
 complaint.onsubmit=e=>{e.preventDefault();mealBusy(complaint.querySelector('button'),async()=>{await mealRpc('customer_meal_action',{p_access_token:token,p_action:'complaint',p_text:complaint.elements.message.value});await openCustomerMealOrder(token);});};box.append(complaint);showScreen(screen.id);
}
function openMyMealReceipts(){
 const screen=mealPanel('myMealReceipts','طلباتي'),box=screen.querySelector('.meal-content');box.innerHTML='<p>طلبات هذا المتصفح. يمكنك أيضًا إدخال رمز متابعة احتفظت به.</p>';
 for(const r of readMealReceipts())box.append(mealAction(r.ref,()=>openCustomerMealOrder(r.token)));
 const f=document.createElement('form');f.className='meal-form';f.innerHTML='<label>رمز المتابعة الخاص<input name="token" class="field" required pattern="[0-9a-f]{64}" autocomplete="off"></label><button class="primary">متابعة الطلب</button>';f.onsubmit=e=>{e.preventDefault();mealBusy(f.querySelector('button'),()=>openCustomerMealOrder(f.elements.token.value.trim()));};box.append(f);showScreen(screen.id);
}
async function openChefMealOrders(){
 const orders=await mealRpc('chef_meal_orders',{p_session_token:chefSessionToken}),screen=mealPanel('chefMealOrders','طلبات مطبخي'),box=screen.querySelector('.meal-content');screen.querySelector('.back').onclick=async()=>{const c=await restoreChefSession(false);if(c)openKitchenDashboard(c);};box.innerHTML='<p>حدّث القائمة لمتابعة الطلبات الجديدة. لا تُحجز الحصص إلا عند القبول.</p>';box.append(mealAction('تحديث الطلبات',openChefMealOrders));
 if(!orders.length)box.insertAdjacentHTML('beforeend','<p>لا توجد طلبات بعد.</p>');
 orders.forEach(o=>{
 const s=mealEffectiveStatus(o),card=document.createElement('article');card.className='meal-card';card.innerHTML=`<h2>${escapeHtml(o.dish_name)} — ${o.quantity} حصة</h2><strong>${escapeHtml(mealStatus[s]||s)}</strong><p>${escapeHtml(o.customer_name)} · <a href="tel:${escapeHtml(o.customer_phone)}">${escapeHtml(o.customer_phone)}</a></p><p>${o.fulfilment_type==='pickup'?'الاستلام من المطبخ':`التوصيل: ${escapeHtml(o.delivery_area)} — ${escapeHtml(o.customer_address)}`}</p><p>الجاهزية: ${mealDate(o.ready_at)} · ${mealMoney(o.total)}</p>${o.notes?`<p>ملاحظة الزبون: ${escapeHtml(o.notes)}</p>`:''}`;
 const transitions={pending:[['accepted','قبول الطلب'],['rejected','الاعتذار عن الطلب']],accepted:[['preparing','بدء التحضير'],['cancelled','إلغاء الطلب']],preparing:[['ready','الطلب جاهز'],['cancelled','إلغاء الطلب']],ready:[['delivered','تم التسليم'],['cancelled','إلغاء الطلب']]};
 const reason=document.createElement('input');reason.className='field';reason.placeholder='سبب الاعتذار أو الإلغاء';reason.maxLength=500;if(transitions[s])card.append(reason);
 for(const[next,label]of transitions[s]||[])card.append(mealAction(label,async()=>{if(['rejected','cancelled'].includes(next)&&reason.value.trim().length<3)throw Error('اكتب سبب الاعتذار أو الإلغاء.');await mealRpc('chef_meal_order_status',{p_session_token:chefSessionToken,p_order_id:o.id,p_status:next,p_reason:reason.value});await openChefMealOrders();}));box.append(card);
 });showScreen(screen.id);
}
document.getElementById('mealQuantity').addEventListener('input',updateMealTotal);
document.getElementById('mealFulfilment').addEventListener('change',updateMealTotal);
document.getElementById('mealCustomerForm').onsubmit=e=>{e.preventDefault();submitMealOrder(document.getElementById('submitOrderBtn'));};
document.getElementById('myOrdersBtn').onclick=openMyMealReceipts;
