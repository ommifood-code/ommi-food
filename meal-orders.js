/* Scheduled home meals. Prices, quantities and transitions are enforced by RPCs. */
'use strict';
const mealStatus={pending:'بانتظار قبول المطبخ',accepted:'تم قبول الطلب',preparing:'قيد التحضير',ready:'جاهز للاستلام أو التوصيل',delivered:'تم التسليم',rejected:'اعتذر المطبخ',cancelled:'ملغى',expired:'مرّ الموعد دون قبول'};
const mealDate=v=>new Intl.DateTimeFormat('ar-MA',{timeZone:'Africa/Casablanca',dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
const peopleLabel=n=>Number(n)===1?'شخصًا واحدًا':Number(n)===2?'شخصين':`${n} أشخاص`;
const mealMoney=v=>`${Number(v).toFixed(2)} درهم`;
const mealEffectiveStatus=o=>o.status==='pending'&&new Date(o.order_until)<=new Date()?'expired':o.status;
function mealLocalToISO(value){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('حدد اليوم والوقت الذي تريد فيه طلبك.');
 const target=Date.parse(value+'Z');let instant=target;
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 for(let i=0;i<3;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(instant)).map(x=>[x.type,x.value]));const shown=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);if(shown===target)return new Date(instant).toISOString();instant+=target-shown;}
 throw Error('هذا التوقيت غير متاح بسبب تغيير الساعة. اختر موعدًا آخر.');
}
async function mealRpc(name,args){const{data,error}=await db.rpc(name,args);if(error)throw Error(mealError(error.message));return data;}
function mealError(message){
 const known={'subscription_reference_once':'مرجع الأداء مسجل من قبل. راجع المرجع أو تواصل مع الإدارة.','payment instructions unavailable':'لم تتوفر تعليمات الأداء بعد.','subscription required':'يحتاج اشتراك المطبخ إلى تأكيد أو تجديد.','invalid session':'انتهت الجلسة. ادخل إلى مطبخك مجددًا.','offer unavailable':'الوجبة غير متاحة الآن. حدّث القائمة.','invalid requested time':'اختر موعدًا مستقبلًا خلال الستين يومًا القادمة.','invalid portion':'حدد عدد الأشخاص الذين يكفيهم الطبق.','too many requests':'وصلت إلى حد الطلبات خلال الساعة. حاول لاحقًا.','invalid transition':'تغيرت حالة الطلب أو انتهت مهلة قبوله. حدّث القائمة.','order not found':'تعذر الوصول إلى الطلب. تحقق من رمز المتابعة.','invalid delivery address':'حدد حيًا مخدومًا وعنوانًا واضحًا.','invalid dates':'راجع المواعيد: آخر أجل قبل الجاهزية، وخلال الستين يومًا القادمة.'};
 return Object.entries(known).find(([key])=>String(message).includes(key))?.[1]||'تعذر إتمام العملية. راجع البيانات وحاول مجددًا.';
}
async function mealBusy(button,work){const label=button.textContent;button.disabled=true;try{await work();}catch(err){showToast(err.message||'تعذر الاتصال. حاول مجددًا.');}finally{button.disabled=false;button.textContent=label;}}
function mealPanel(id,title){let el=document.getElementById(id);if(el)return el;el=document.createElement('section');el.id=id;el.className='screen';el.innerHTML=`<header class="topbar"><button type="button" class="back">←</button><strong>${title}</strong></header><div class="content meal-content"></div>`;document.querySelector('main').appendChild(el);el.querySelector('.back').onclick=()=>showScreen('home');return el;}
function mealAction(label,fn){const b=document.createElement('button');b.type='button';b.className='admin-secondary';b.textContent=label;b.onclick=()=>mealBusy(b,fn);return b;}
function mountMealDashboard(c){
 const dash=document.getElementById('chefKitchenDashboard');let actions=dash.querySelector('#mealActions');
 if(!actions){actions=document.createElement('div');actions.id='mealActions';actions.className='meal-actions';dash.querySelector('.kitchen-builder').prepend(actions);}
 actions.replaceChildren(mealAction('إضافة وجبة',()=>openMealOfferForm(c)),mealAction('وجباتي المتاحة',openMyMealOffers),mealAction('طلبات مطبخي',openChefMealOrders));
}
async function openMyMealOffers(){
 const rows=await mealRpc('chef_meal_offers',{p_session_token:chefSessionToken}),screen=mealPanel('myMealOffers','أطباق مطبخي'),box=screen.querySelector('.meal-content');
 screen.querySelector('.back').onclick=async()=>{const c=await restoreChefSession(false);if(c)openKitchenDashboard(c);};box.innerHTML='';
 box.append(mealAction('تحديث',openMyMealOffers));if(!rows.length)box.insertAdjacentHTML('beforeend','<p>أضف أول طبق لاستقبال الطلبات.</p>');
 rows.forEach(o=>{const card=document.createElement('article');card.className='meal-card';card.innerHTML=`<h2>${escapeHtml(o.dish_name)}</h2><p>طبق واحد يكفي ${peopleLabel(o.serves)} · ${mealMoney(o.price)}</p><p>${o.active?'متاح للطلب — يُحضّر حسب الطلب':'غير متاح مؤقتًا'}</p>`;card.append(mealAction(o.active?'إيقاف طلب هذا الطبق مؤقتًا':'إتاحة هذا الطبق مجددًا',async()=>{await mealRpc('meal_offer_availability',{p_session_token:chefSessionToken,p_offer_id:o.id,p_active:!o.active});await openMyMealOffers();}));box.append(card);});showScreen(screen.id);
}
let selectedMealOffer=null,mealOffers=[],mealRequest=null;
async function openMealOrdering(chef){
 activeChef=chef;selectedMealOffer=null;mealRequest=null;
 document.getElementById('orderChefName').textContent=`${prefix(chef.gender)} ${chef.name}`;document.getElementById('orderChefArea').textContent=chef.area||'الدار البيضاء';
 const list=document.getElementById('dishList');list.innerHTML='<p>جاري تحميل الوجبات المتاحة للحجز...</p>';document.getElementById('mealOrderFields').hidden=true;showScreen('orderModal');
 const{data,error}=await db.from('meal_offers').select('*').eq('chef_id',chef.id).eq('active',true).order('created_at');
 if(activeChef?.id!==chef.id)return;if(error){list.innerHTML='<p>تعذر تحميل الوجبات. ارجع إلى قائمة المطابخ وحاول مجددًا.</p>';return;}
 mealOffers=data||[];
 list.innerHTML=mealOffers.length?'':'<p>لا توجد وجبات متاحة للحجز حاليًا من هذا المطبخ.</p>';
 mealOffers.forEach(o=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed','false');b.className='dish-option meal-card';const img=safeImageUrl(o.image_url);b.innerHTML=`${img?`<img class="dish-option-image" src="${escapeHtml(img)}" alt="${escapeHtml(o.dish_name)}">`:''}<span><strong>${escapeHtml(o.dish_name)} — ${mealMoney(o.price)}</strong><span>طبق واحد يكفي ${peopleLabel(o.serves)}، والثمن للطبق كاملًا.</span><span>يُحضّر حسب الطلب — اختر الموعد المناسب لك أدناه.</span>${o.ingredients?`<span>المكونات: ${escapeHtml(o.ingredients)}</span>`:''}</span>`;b.onclick=()=>selectMealOffer(o,b);list.append(b);});
 if(mealOffers.length)selectMealOffer(mealOffers[0],list.querySelector('button'));
}
function selectMealOffer(o,button){
 selectedMealOffer=o;mealRequest=null;document.querySelectorAll('#dishList .selected').forEach(e=>{e.classList.remove('selected');e.setAttribute('aria-pressed','false');});button.classList.add('selected');button.setAttribute('aria-pressed','true');
 const fields=document.getElementById('mealOrderFields');fields.hidden=false;
 const select=document.getElementById('mealFulfilment');select.innerHTML=(o.fulfilment_type==='both'?['pickup','delivery']:[o.fulfilment_type]).map(v=>`<option value="${v}">${v==='pickup'?'الاستلام من المطبخ':'التوصيل'}</option>`).join('');
 const quantity=document.getElementById('mealQuantity');quantity.max=50;quantity.value=1;document.getElementById('mealRequestedAt').min=localMealValue(new Date());
 document.getElementById('mealDeliveryArea').innerHTML=o.delivery_areas.map(a=>`<option>${escapeHtml(a)}</option>`).join('');updateMealTotal();
}
function updateMealTotal(){if(!selectedMealOffer)return;const delivery=document.getElementById('mealFulfilment').value==='delivery';document.getElementById('mealDeliveryFields').hidden=!delivery;document.getElementById('customerArea').required=delivery;const q=Number(document.getElementById('mealQuantity').value),fee=delivery?Number(selectedMealOffer.delivery_fee):0;document.getElementById('mealTotal').textContent=`${q} × طبق يكفي ${peopleLabel(selectedMealOffer.serves)} = ${q*selectedMealOffer.serves} أشخاص تقريبًا. ثمن الأطباق: ${mealMoney(q*Number(selectedMealOffer.price))} + التوصيل: ${mealMoney(fee)} = الإجمالي: ${mealMoney(q*Number(selectedMealOffer.price)+fee)}`;}
const MEAL_RECEIPTS_KEY='ommi_meal_receipts';
function readMealReceipts(){try{return JSON.parse(localStorage.getItem(MEAL_RECEIPTS_KEY)||'[]').filter(x=>/^[0-9a-f]{64}$/.test(x.token));}catch{return[];}}
function newMealToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
async function submitMealOrder(button){
 await mealBusy(button,async()=>{
 if(!selectedMealOffer)throw Error('اختر وجبة أولًا.');
 const form=document.getElementById('mealCustomerForm');if(!form.reportValidity())return;
 const quantity=Number(document.getElementById('mealQuantity').value);if(!Number.isInteger(quantity)||quantity<1||quantity>Number(document.getElementById('mealQuantity').max))throw Error('راجع عدد الأطباق.');
 const args={p_offer_id:selectedMealOffer.id,p_quantity:quantity,p_fulfilment:document.getElementById('mealFulfilment').value,p_customer:{requested_at:mealLocalToISO(document.getElementById('mealRequestedAt').value),name:document.getElementById('customerName').value.trim(),phone:document.getElementById('customerPhone').value.trim(),area:document.getElementById('mealDeliveryArea').value,address:document.getElementById('customerArea').value.trim(),notes:document.getElementById('mealNotes').value.trim()}};
 // Persist the request capability BEFORE the network call, so a lost response is recoverable.
 const signature=JSON.stringify(args);if(!mealRequest||mealRequest.signature!==signature){mealRequest={signature,token:newMealToken()};const receipts=readMealReceipts();receipts.unshift({token:mealRequest.token,ref:'طلب قيد الإرسال'});localStorage.setItem(MEAL_RECEIPTS_KEY,JSON.stringify(receipts.slice(0,100)));}
 const request=mealRequest;
 const result=await mealRpc('place_meal_order',{...args,p_access_token:request.token});
 const receipts=readMealReceipts();const record=receipts.find(r=>r.token===request.token);if(record)record.ref=result.order_ref;localStorage.setItem(MEAL_RECEIPTS_KEY,JSON.stringify(receipts));
 showToast('أُرسل الطلب؛ ينتظر قبول المطبخ.');await openCustomerMealOrder(request.token);
 });
}
async function openCustomerMealOrder(token){
 const o=await mealRpc('customer_meal_order',{p_access_token:token}),screen=mealPanel('customerMealTracking','متابعة طلبي'),box=screen.querySelector('.meal-content');screen.querySelector('.back').onclick=openMyMealReceipts;
 box.innerHTML=`<article class="meal-card"><h2>${escapeHtml(mealStatus[o.status]||o.status)}</h2><p>${escapeHtml(o.dish_name)} — ${o.quantity} × طبق</p><p>الطبق الواحد يكفي ${peopleLabel(o.serves||"—")} · ثمنه ${mealMoney(o.unit_price)}</p><p>الإجمالي شامل التوصيل: ${mealMoney(o.total)}</p><p>الموعد المطلوب: ${mealDate(o.ready_at)}</p><p>مرجع الطلب: ${escapeHtml(o.order_ref)}</p>${o.status==='pending'?`<p>طلبك لم يُقبل بعد. سيوافق المطبخ على العدد والموعد المطلوبين أو يعتذر. يمكنك الاتصال به لتسريع الرد.</p>`:''}${o.status_reason?`<p>${escapeHtml(o.status_reason)}</p>`:''}${o.chef_phone?`<p>للتنسيق مع المطبخ: <a href="tel:${escapeHtml(o.chef_phone)}">${escapeHtml(o.chef_phone)}</a></p>`:''}${o.pickup_instructions?`<p>الاستلام: ${escapeHtml(o.pickup_instructions)}</p>`:''}</article><p>طلبك محفوظ في هذا المتصفح. احفظ رابطه للرجوع إليه من جهاز آخر، واحتفظ به لنفسك.</p><p>الدفع مباشرة مع المطبخ.</p>`;
 box.append(mealAction('حفظ رابط طلبي',async()=>{const url=new URL(location.href);url.hash='order='+token;try{await navigator.clipboard.writeText(url.href);showToast('تم نسخ رابط طلبك. احتفظ به لنفسك.');}catch{const input=document.createElement('input');input.className='field';input.readOnly=true;input.value=url.href;input.setAttribute('aria-label','رابط طلبي الخاص');box.append(input);input.focus();input.select();showToast('انسخ الرابط الظاهر للاحتفاظ بطلبك.');}}));
 if(o.chef_phone){const phone=String(o.chef_phone).replace(/^0/,'212').replace(/[^0-9]/g,'');if(phone){const contact=document.createElement('a');contact.className='primary';contact.target='_blank';contact.rel='noopener noreferrer';contact.textContent='مراسلة المطبخ عبر واتساب';contact.href='https://wa.me/'+phone+'?text='+encodeURIComponent(`مرحبًا، أرسلت طلبًا عبر Ommi Food. المرجع: ${o.order_ref}، ${o.dish_name}، ${o.quantity} × طبق يكفي ${peopleLabel(o.serves)}، الموعد المطلوب: ${mealDate(o.ready_at)}، الإجمالي: ${mealMoney(o.total)}. هل يمكن تأكيده داخل التطبيق؟`);box.append(contact);}}
 if(['rejected','expired'].includes(o.status))box.append(mealAction('البحث عن مطبخ آخر قريب',async()=>{showScreen('chefs');await loadChefs();}));
 box.append(mealAction('تحديث حالة الطلب',()=>openCustomerMealOrder(token)));
 if(o.status==='pending')box.append(mealAction('إلغاء الطلب قبل القبول',async()=>{await mealRpc('customer_meal_action',{p_access_token:token,p_action:'cancel'});await openCustomerMealOrder(token);}));
 if(['accepted','preparing','ready'].includes(o.status))box.insertAdjacentHTML('beforeend','<p>لإلغاء طلب مقبول، تواصل مع المطبخ لتأكيد الإلغاء.</p>');
 if(o.status==='delivered'){box.insertAdjacentHTML('beforeend','<p class=warm-thanks>شكرًا لاختيارك مطبخًا منزليًا. طلبك يدعم عملًا من البيت.</p>');
 const f=document.createElement('form');f.className='meal-form';f.innerHTML=`<h2>كيف كانت التجربة؟</h2><label>هل استلمت الطلب؟<select name="received" class="field"><option value="true">نعم</option><option value="false">لا</option></select></label><label>هل ترغب في تكرار الطلب؟<select name="repeat" class="field"><option value="true">نعم</option><option value="false">لا</option></select></label><label>ملاحظتك<textarea name="feedback" class="field" maxlength="2000">${escapeHtml(o.feedback||'')}</textarea></label><button class="primary">حفظ رأيي</button>`;
 if(o.received_confirmed!==null)f.elements.received.value=String(o.received_confirmed);if(o.would_repeat!==null)f.elements.repeat.value=String(o.would_repeat);
 f.onsubmit=e=>{e.preventDefault();mealBusy(f.querySelector('button'),async()=>{await mealRpc('customer_meal_action',{p_access_token:token,p_action:'feedback',p_text:f.elements.feedback.value,p_received:f.elements.received.value==='true',p_repeat:f.elements.repeat.value==='true'});showToast('تم حفظ رأيك.');});};box.append(f);
 }
 const complaint=document.createElement('form');complaint.className='meal-form';complaint.innerHTML=`<label>إبلاغ الإدارة عن مشكلة<textarea name="message" class="field" required minlength="5" maxlength="2000">${escapeHtml(o.complaint||'')}</textarea></label><button class="admin-secondary">إرسال البلاغ</button>${o.complaint?`<p>${o.complaint_resolved_at?'أغلقت الإدارة البلاغ.':'بلاغك محفوظ وينتظر متابعة الإدارة.'}</p>`:''}`;
 complaint.onsubmit=e=>{e.preventDefault();mealBusy(complaint.querySelector('button'),async()=>{await mealRpc('customer_meal_action',{p_access_token:token,p_action:'complaint',p_text:complaint.elements.message.value});await openCustomerMealOrder(token);});};const help=document.createElement('details');help.innerHTML='<summary>لدي مشكلة — التواصل مع الإدارة</summary>';help.append(complaint);box.append(help);showScreen(screen.id);mealTrackingToken=token;mealTrackingStatus=o.status;
}
function openMyMealReceipts(){
 const screen=mealPanel('myMealReceipts','طلباتي'),box=screen.querySelector('.meal-content');box.innerHTML='<p>طلبات هذا المتصفح. يمكنك أيضًا إدخال رمز متابعة احتفظت به.</p>';
 for(const r of readMealReceipts())box.append(mealAction(r.ref,()=>openCustomerMealOrder(r.token)));
 const f=document.createElement('form');f.className='meal-form';f.innerHTML='<label>رمز المتابعة الخاص<input name="token" class="field" required pattern="[0-9a-f]{64}" autocomplete="off"></label><button class="primary">متابعة الطلب</button>';f.onsubmit=e=>{e.preventDefault();mealBusy(f.querySelector('button'),()=>openCustomerMealOrder(f.elements.token.value.trim()));};box.append(f);showScreen(screen.id);
}
async function openChefMealOrders(){
 const orders=await mealRpc('chef_meal_orders',{p_session_token:chefSessionToken}),screen=mealPanel('chefMealOrders','طلبات مطبخي'),box=screen.querySelector('.meal-content');screen.querySelector('.back').onclick=async()=>{const c=await restoreChefSession(false);if(c)openKitchenDashboard(c);};box.innerHTML='<p>اقبل الطلب فقط إذا استطعت تحضير العدد المطلوب في موعد الزبون. التنبيه يتحدث أثناء فتح التطبيق.</p>';orders.sort((a,b)=>Number(mealEffectiveStatus(b)==='pending')-Number(mealEffectiveStatus(a)==='pending'));box.append(mealAction('تحديث الطلبات',openChefMealOrders));
 if(!orders.length)box.insertAdjacentHTML('beforeend','<p>لا توجد طلبات بعد.</p>');
 orders.forEach(o=>{
 const s=mealEffectiveStatus(o),card=document.createElement('article');card.className='meal-card';card.innerHTML=`<h2>${escapeHtml(o.dish_name)} — ${o.quantity} × طبق</h2><strong>${escapeHtml(mealStatus[s]||s)}</strong><p>${escapeHtml(o.customer_name)} · <a href="tel:${escapeHtml(o.customer_phone)}">${escapeHtml(o.customer_phone)}</a></p><p>${o.fulfilment_type==='pickup'?'الاستلام من المطبخ':`التوصيل: ${escapeHtml(o.delivery_area)} — ${escapeHtml(o.customer_address)}`}</p><p>كل طبق يكفي ${peopleLabel(o.serves||"—")} · ثمن الطبق ${mealMoney(o.unit_price)}</p><p>الموعد المطلوب: ${mealDate(o.ready_at)} · الإجمالي ${mealMoney(o.total)}</p>${o.notes?`<p>ملاحظة الزبون: ${escapeHtml(o.notes)}</p>`:''}`;
 const transitions={pending:[['accepted','قبول العدد والموعد المطلوبين'],['rejected','الاعتذار عن الطلب']],accepted:[['preparing','بدء التحضير'],['cancelled','إلغاء الطلب']],preparing:[['ready','الطلب جاهز'],['cancelled','إلغاء الطلب']],ready:[['delivered','تم التسليم'],['cancelled','إلغاء الطلب']]};
 const reason=document.createElement('input');reason.hidden=true;reason.className='field';reason.placeholder='سبب الاعتذار أو الإلغاء';reason.maxLength=500;if(transitions[s])card.append(reason);
 for(const[next,label]of transitions[s]||[])card.append(mealAction(label,async()=>{if(['rejected','cancelled'].includes(next)&&reason.value.trim().length<3){reason.hidden=false;reason.focus();throw Error('اكتب سبب الاعتذار أو الإلغاء ثم اضغط مرة أخرى.');}await mealRpc('chef_meal_order_status',{p_session_token:chefSessionToken,p_order_id:o.id,p_status:next,p_reason:reason.value});await openChefMealOrders();}));box.append(card);
 });showScreen(screen.id);
}
document.getElementById('mealQuantity').addEventListener('input',updateMealTotal);
document.getElementById('mealFulfilment').addEventListener('change',updateMealTotal);
document.getElementById('mealCustomerForm').onsubmit=e=>{e.preventDefault();submitMealOrder(document.getElementById('submitOrderBtn'));};
document.getElementById('myOrdersBtn').onclick=openMyMealReceipts;

document.getElementById('orderBack').onclick=()=>showScreen('chefs');


// Only a fragment carries the private order capability; it is never sent in HTTP URLs.
let mealTrackingToken=null,mealTrackingStatus=null,mealPollBusy=false,mealLastPending=null,mealLastSession=null;
async function followOrderLink(){const m=location.hash.match(/^#order=([0-9a-f]{64})$/);if(!m)return;try{await openCustomerMealOrder(m[1]);const rows=readMealReceipts();if(!rows.some(r=>r.token===m[1])){rows.unshift({token:m[1],ref:'طلب محفوظ'});localStorage.setItem(MEAL_RECEIPTS_KEY,JSON.stringify(rows.slice(0,100)));}history.replaceState(null,'',location.pathname+location.search);}catch(err){showToast(err.message);}}
window.addEventListener('hashchange',followOrderLink);followOrderLink();
setInterval(async()=>{
 if(document.visibilityState==='hidden'||mealPollBusy)return;mealPollBusy=true;
 try{
  if(chefSessionToken&&document.querySelector('#chefKitchenDashboard.active,#chefMealOrders.active')){
   if(mealLastSession!==chefSessionToken){mealLastPending=null;mealLastSession=chefSessionToken;}
   const rows=await mealRpc('chef_meal_orders',{p_session_token:chefSessionToken});const ids=rows.filter(o=>mealEffectiveStatus(o)==='pending').map(o=>o.id);
   let note=document.getElementById('mealNewOrderNotice');if(!note){note=document.createElement('button');note.id='mealNewOrderNotice';note.className='primary';note.setAttribute('aria-live','polite');note.onclick=()=>mealBusy(note,openChefMealOrders);}
   const host=document.querySelector('#chefKitchenDashboard.active .kitchen-builder,#chefMealOrders.active .meal-content');if(host){host.prepend(note);note.hidden=ids.length===0;note.textContent=`طلبات تنتظر قبولك: ${ids.length} — فتح الطلبات`;}
   if(ids.some(id=>!mealLastPending?.includes(id)))showToast(`لديك ${ids.length} طلب بانتظار القبول`);mealLastPending=ids;
  }
  if(mealTrackingToken&&document.querySelector('#customerMealTracking.active')){
   const o=await mealRpc('customer_meal_order',{p_access_token:mealTrackingToken});if(o.status!==mealTrackingStatus){let note=document.getElementById('mealStatusChanged');if(!note){note=mealAction('تغيرت حالة طلبك — عرض التفاصيل',()=>openCustomerMealOrder(mealTrackingToken));note.id='mealStatusChanged';document.querySelector('#customerMealTracking .meal-content').prepend(note);}note.textContent=(mealStatus[o.status]||o.status)+' — عرض التفاصيل';showToast(mealStatus[o.status]||o.status);mealTrackingStatus=o.status;}
  }
 }catch{/* Keep the current form and retry next time; never discard typed notes. */}finally{mealPollBusy=false;}
},20000);
