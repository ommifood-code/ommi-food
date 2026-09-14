/* Shared kitchen preferences. Days describe normal availability; they never block a request. */
'use strict';
const kitchenWeek=['الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت','الأحد'];
function kitchenSettingsFields(settings={}){
 const selected=String(settings.work_days||'').split('،').map(x=>x.trim());
 return `<fieldset class="kitchen-workdays"><legend>أيام العمل المعتادة</legend><p>اختر الأيام التي يمكنك فيها استقبال الطلبات، ويمكنك تعديلها لاحقًا.</p><button type="button" class="admin-secondary" data-all-days>كل الأيام</button><div class="kitchen-day-choices">${kitchenWeek.map(day=>`<label><input type="checkbox" name="work_day" value="${day}" ${selected.includes(day)?'checked':''}>${day}</label>`).join('')}</div><small>اختياري. يمكن للزبون طلب يوم آخر، والقبول حسب قدرتك.</small></fieldset>
 <label>طريقة الاستلام<select name="fulfilment_type" class="field"><option value="pickup">الاستلام من المطبخ</option><option value="delivery">التوصيل</option><option value="both">الاستلام أو التوصيل</option></select></label>
 <div data-pickup><label>عنوان الاستلام<input name="pickup_instructions" class="field" minlength="5" maxlength="1000"></label><small>يظهر فقط لصاحب الطلب بعد قبوله.</small></div>
 <div data-delivery hidden><label>أحياء التوصيل، كل حي في سطر<textarea name="delivery_areas" class="field" maxlength="2000"></textarea></label><label>ثمن التوصيل للطلب بالدرهم<input name="delivery_fee" type="number" min="0" max="1000" step="0.01" class="field" value="0"></label></div>`;
}
function bindKitchenSettings(form,settings={}){
 const mode=form.elements.fulfilment_type;mode.value=settings.fulfilment_type||'pickup';
 form.elements.pickup_instructions.value=settings.pickup_instructions||'';
 form.elements.delivery_areas.value=(settings.delivery_areas||[]).join('\n');form.elements.delivery_fee.value=settings.delivery_fee||0;
 const sync=()=>{const delivery=mode.value!=='pickup',pickup=mode.value!=='delivery';form.querySelector('[data-delivery]').hidden=!delivery;form.querySelector('[data-pickup]').hidden=!pickup;form.elements.delivery_areas.required=delivery;form.elements.delivery_fee.required=delivery;form.elements.pickup_instructions.required=pickup;};mode.onchange=sync;sync();
 form.querySelector('[data-all-days]').onclick=()=>form.querySelectorAll('[name=work_day]').forEach(x=>x.checked=true);
}
function readKitchenSettings(form){return {work_days:[...form.querySelectorAll('[name=work_day]:checked')].map(x=>x.value),fulfilment_type:form.elements.fulfilment_type.value,pickup_instructions:form.elements.pickup_instructions.value.trim(),delivery_areas:[...new Set(form.elements.delivery_areas.value.split('\n').map(x=>x.trim()).filter(Boolean))],delivery_fee:Number(form.elements.delivery_fee.value)};}
async function openKitchenPreferences(){
 const c=await restoreChefSession(false);if(!c)throw Error('ادخل إلى مطبخك مجددًا.');
 const settings=await mealRpc('chef_order_settings',{p_session_token:chefSessionToken});
 const screen=mealPanel('kitchenPreferences','أيام العمل والاستلام'),box=screen.querySelector('.meal-content');
 screen.querySelector('.back').onclick=()=>openKitchenSettings(c);
 box.innerHTML=`<form class="meal-form"><h1>إعدادات لجميع أطباق مطبخك</h1>${kitchenSettingsFields(settings)}<button type="submit" class="primary">حفظ والعودة إلى مطبخي</button></form>`;
 const form=box.querySelector('form');bindKitchenSettings(form,settings);
 form.onsubmit=e=>{e.preventDefault();if(!form.reportValidity())return;mealBusy(form.querySelector('[type=submit]'),async()=>{await mealRpc('chef_order_settings',{p_session_token:chefSessionToken,p_settings:readKitchenSettings(form)});markFormSaved(form);showToast('حُفظت إعدادات مطبخك لجميع الطلبات الجديدة.');const fresh=await restoreChefSession(false);if(fresh)await openKitchenDashboard(fresh);});};showScreen(screen.id);
}
function kitchenDaysLabel(days){return days?`أيام العمل المعتادة: ${days}`:'أيام العمل تُتفق مع المطبخ';}
