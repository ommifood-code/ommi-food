'use strict';
let kitchenOverviewVersion=0;
mountMealDashboard=function(c){
 const box=document.querySelector('#chefKitchenDashboard .kitchen-builder');
 let actions=document.getElementById('mealActions');if(!actions){actions=document.createElement('div');actions.id='mealActions';box.append(actions);}
 actions.className='kitchen-toolbar';actions.replaceChildren(mealAction('＋ إضافة وجبة',()=>openMealOfferForm(c)),mealAction('بيانات مطبخي',()=>openKitchenSettings(c)));actions.firstChild.className='primary';
 let overview=document.getElementById('kitchenOverview');if(!overview){overview=document.createElement('div');overview.id='kitchenOverview';box.append(overview);}
 overview.innerHTML='<div id="kitchenPendingSummary" aria-live="polite"></div><section class="kitchen-section"><h2>أطباق مطبخي</h2><div id="kitchenDishCards" class="kitchen-dish-grid"><p>جاري تحميل أطباقك…</p></div></section><section class="kitchen-section kitchen-orders" id="kitchenOrdersSection"><h2>طلبات مطبخي</h2><div id="kitchenOrderCards"><p>جاري تحميل الطلبات…</p></div></section>';
 const refresh=()=>loadKitchenOverview(c);const button=mealAction('تحديث الأطباق والطلبات',refresh);button.classList.add('overview-refresh');overview.append(button);refresh();
};
async function loadKitchenOverview(c){
 const version=++kitchenOverviewVersion,token=chefSessionToken;
 const results=await Promise.allSettled([mealRpc('chef_meal_offers',{p_session_token:token}),mealRpc('chef_meal_orders',{p_session_token:token})]);
 if(version!==kitchenOverviewVersion||token!==chefSessionToken)return;
 const dishes=document.getElementById('kitchenDishCards'),ordersBox=document.getElementById('kitchenOrderCards'),summary=document.getElementById('kitchenPendingSummary');if(!dishes||!ordersBox)return;
 const refresh=()=>loadKitchenOverview(c);dishes.replaceChildren();ordersBox.replaceChildren();summary.replaceChildren();
 if(results[0].status==='rejected'){dishes.textContent='تعذر تحميل الأطباق. اضغط تحديث للمحاولة مجددًا.';}else{
 const offers=results[0].value||[];
 if(!offers.length)dishes.innerHTML='<p class="overview-empty">لم تضف طبقًا بعد. ابدأ بزر «إضافة وجبة» أعلاه.</p>';
 offers.forEach(o=>{const card=document.createElement('article');card.className='kitchen-dish-card';const photo=safeImageUrl(o.image_url);card.innerHTML=`${photo?`<img src="${escapeHtml(photo)}" alt="${escapeHtml(o.dish_name)}" loading="lazy">`:'<div class="dish-placeholder" aria-hidden="true">🍲</div>'}<div class="dish-card-body"><h3>${escapeHtml(o.dish_name)}</h3><strong class="dish-price">${mealMoney(o.price)} — ثمن الطبق كاملًا</strong><p>يكفي ${peopleLabel(o.serves)}</p><span class="dish-state ${o.active?'is-available':'is-paused'}">${o.active?'متاح للطلب':'متوقف مؤقتًا'}</span></div>`;const controls=document.createElement('div');controls.className='dish-card-controls';controls.append(mealAction('تعديل الطبق',()=>openMealOfferForm(o)),mealAction(o.active?'إيقاف مؤقت':'إتاحة الطبق',async()=>{await mealRpc('meal_offer_availability',{p_session_token:chefSessionToken,p_offer_id:o.id,p_active:!o.active});await refresh();}));card.append(controls);dishes.append(card);});
 }
 if(results[1].status==='rejected'){ordersBox.textContent='تعذر تحميل الطلبات. اضغط تحديث للمحاولة مجددًا.';return;}
 const orders=results[1].value||[],priority={pending:0,accepted:1,preparing:2,ready:3};orders.sort((a,b)=>(priority[mealEffectiveStatus(a)]??4)-(priority[mealEffectiveStatus(b)]??4));
 const pending=orders.filter(o=>mealEffectiveStatus(o)==='pending').length;
 if(pending){const jump=mealAction(`لديك ${pending} طلب بانتظار قبولك — عرض الطلبات`,()=>document.getElementById('kitchenOrdersSection').scrollIntoView({behavior:'smooth',block:'start'}));jump.className='pending-summary';summary.append(jump);}
 if(!orders.length)ordersBox.innerHTML='<p class="overview-empty">لا توجد طلبات بعد. ستظهر هنا عندما يطلب زبون من مطبخك.</p>';
 orders.forEach(o=>{const card=chefOrderCard(o,refresh);const status=mealEffectiveStatus(o);card.dataset.status=status;ordersBox.append(card);});
}
