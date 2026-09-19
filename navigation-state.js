'use strict';
// Keep page context per tab. Credentials are never copied into this state;
// protected pages always revalidate the existing kitchen session with the server.
const OMMI_NAV_STATE_KEY='ommi_navigation_state_v1';
const navigationPublic=new Set(['home','chefs','orderModal','myMealReceipts','customerMealTracking','locationPicker']);
const navigationPrivate=new Set(['chefKitchenDashboard','kitchenSettings','kitchenPreferences','myMealOffers','chefMealOrders','mealOfferEditor','buildKitchen']);
let restoringNavigationState=false,navigationRestoreFailed=false,navigationCurrent=null,navigationTrail=[];
function navigationFields(root){
 return [...root.querySelectorAll('input,select,textarea')].filter(el=>!['password','file','hidden','submit','button'].includes(el.type)&&!/(pin|secret|token)/i.test(el.name||el.id)).map(el=>({key:el.id?'#'+el.id:el.name,kind:el.type,value:el.value,checked:el.checked})).filter(x=>x.key);
}
function navigationSnapshot(){
 const screen=document.querySelector('.screen.active');if(!screen)return null;
 const id=screen.id;if(!navigationPublic.has(id)&&!navigationPrivate.has(id))return null;
 const state={screen:id,fields:navigationFields(screen),scroll:window.scrollY};
 if(navigationPrivate.has(id))state.owner=currentChefId;
 if(id==='orderModal'){state.chefId=activeChef?.id;state.offerId=selectedMealOffer?.id||null;}
 if(id==='mealOfferEditor')state.offerId=screen.dataset.offerId||null;
 if(id==='customerMealTracking')state.token=requestTrackingToken||mealTrackingToken;
 if(id==='locationPicker'){state.locationOwner=screen.dataset.locationOwner==='true';state.point=JSON.parse(screen.dataset.point||'null');if(state.locationOwner)state.owner=currentChefId;}
 const modal=document.querySelector('.modal.open');
 if(modal&&['joinModal','chefLoginModal'].includes(modal.id))state.modal={id:modal.id,fields:navigationFields(modal)};
 return state;
}
function saveNavigationState(){
 if(restoringNavigationState||navigationRestoreFailed)return;
 navigationCurrent=navigationSnapshot();
 try{sessionStorage.setItem(OMMI_NAV_STATE_KEY,JSON.stringify({current:navigationCurrent,trail:navigationTrail.slice(-20)}));}catch{}
}
const navigationStateShowScreen=showScreen;
showScreen=function(id){
 if(!document.getElementById(id))return;
 if(!restoringNavigationState){
  navigationRestoreFailed=false;
  const previous=navigationSnapshot();
  if(id==='home')navigationTrail=[];
  else if(previous&&previous.screen!==id)navigationTrail.push(previous);
  if(/^#kitchen=/.test(location.hash)&&(id!=='orderModal'||location.hash!=='#kitchen='+activeChef?.id))history.replaceState(null,'',location.pathname+location.search);
 }
 const result=navigationStateShowScreen(id);saveNavigationState();return result;
};
function restoreNavigationFields(state){
 const screen=document.getElementById(state.screen);
 for(const entry of state.fields||[]){
  const fields=[...screen.querySelectorAll('input,select,textarea')].filter(el=>(el.id?'#'+el.id:el.name)===entry.key);
  for(const field of fields){
   if(['password','file','hidden'].includes(field.type))continue;
   if(['checkbox','radio'].includes(field.type)){if(field.value===entry.value)field.checked=Boolean(entry.checked);}
   else field.value=entry.value;
  }
 }
 for(const select of screen.querySelectorAll('select'))select.dispatchEvent(new Event('change',{bubbles:true}));
 if(state.screen==='orderModal'){
  document.querySelector('#mealCustomerForm [name=people]')?.dispatchEvent(new Event('input',{bubbles:true}));
  if(state.offerId){const index=mealOffers.findIndex(o=>o.id===state.offerId);if(index>=0)document.querySelectorAll('#dishList button')[index]?.click();}
 }
 if(state.modal){const modal=document.getElementById(state.modal.id);if(modal){openModal(modal);restoreNavigationFields({screen:modal.id,fields:state.modal.fields});}}
 window.scrollTo(0,Number(state.scroll)||0);
}
async function openNavigationState(state){
 if(!state||(!navigationPublic.has(state.screen)&&!navigationPrivate.has(state.screen)))return false;
 let chef;
 if(navigationPrivate.has(state.screen)||state.locationOwner){
  chef=await restoreChefSession(false);
  if(!chef||String(chef.id)!==String(state.owner)){showScreen('home');showToast('ادخل إلى مطبخك للمتابعة.');return false;}
 }
 switch(state.screen){
  case 'home':showScreen('home');break;
  case 'chefs':showScreen('chefs');await loadChefs();break;
  case 'orderModal':{
   await loadChefs();const c=chefsCache.find(c=>String(c.id)===String(state.chefId));
   if(!c){showScreen('chefs');showToast('هذا المطبخ غير متاح الآن.');return false;}
   await openMealOrdering(c);break;
  }
  case 'myMealReceipts':openMyMealReceipts();break;
  case 'customerMealTracking':
   if(!/^[0-9a-f]{64}$/.test(state.token||''))return false;
   await openCustomerMealOrder(state.token);break;
  case 'chefKitchenDashboard':openKitchenDashboard(chef);break;
  case 'kitchenSettings':await openKitchenSettings(chef);break;
  case 'kitchenPreferences':await openKitchenPreferences();break;
  case 'myMealOffers':await openMyMealOffers();break;
  case 'chefMealOrders':await openChefMealOrders();break;
  case 'mealOfferEditor':{
   let offer=null;
   if(state.offerId){const rows=await mealRpc('chef_meal_offers',{p_session_token:chefSessionToken});offer=rows.find(o=>o.id===state.offerId);if(!offer){openKitchenDashboard(chef);return false;}}
   await openMealOfferForm(offer);break;
  }
  case 'buildKitchen':await openKitchenEditor(chef);break;
  case 'locationPicker':{
   const previous=navigationTrail.at(-1);
   if(previous&&previous.screen!=='locationPicker')await openNavigationState(previous);
   else if(state.locationOwner)await openKitchenSettings(chef);
   else {showScreen('chefs');await loadChefs();}
   await pickLocation(Boolean(state.locationOwner),state.point,state.locationOwner?saveKitchenPoint:p=>{nearbyPoint=p;document.getElementById('nearArea').value='';renderNearby();});break;
  }
 }
 restoreNavigationFields(state);return true;
}
navigateBack=async function(){
 const previous=navigationTrail.pop()||{screen:'home'};
 restoringNavigationState=true;
 try{if(!await openNavigationState(previous))navigationTrail=[];}
 catch{navigationTrail.push(previous);showToast('تعذر الرجوع الآن. حاول مجددًا.');}
 finally{restoringNavigationState=false;screenTrail.splice(0,screenTrail.length,...navigationTrail.map(x=>x.screen));saveNavigationState();}
};
async function restoreNavigationState(){
 if(/^#(?:order|kitchen)=/.test(location.hash))return;
 let saved;try{saved=JSON.parse(sessionStorage.getItem(OMMI_NAV_STATE_KEY)||'null');}catch{}
 const current=saved?.current||saved;
 if(!current?.screen){await restoreRecentOrder();return;}
 restoringNavigationState=true;navigationTrail=Array.isArray(saved.trail)?saved.trail:[];
 try{if(!await openNavigationState(current))navigationTrail=[];}
 catch{navigationRestoreFailed=true;showToast('تعذر استعادة الصفحة الآن. حدّثها للمحاولة مجددًا.');return;}
 finally{restoringNavigationState=false;}
 screenTrail.splice(0,screenTrail.length,...navigationTrail.map(x=>x.screen));saveNavigationState();
}
// Avoid two independent startup handlers racing to replace the restored page.
window.removeEventListener('DOMContentLoaded',restoreRecentOrder);
window.addEventListener('DOMContentLoaded',restoreNavigationState,{once:true});
window.addEventListener('pagehide',saveNavigationState);
window.addEventListener('beforeunload',saveNavigationState);
let navigationSaveTimer;
for(const event of ['input','change'])document.addEventListener(event,()=>{clearTimeout(navigationSaveTimer);navigationSaveTimer=setTimeout(saveNavigationState,120);});
