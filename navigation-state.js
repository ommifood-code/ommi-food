'use strict';
// Preserve only public, safely reconstructable navigation. Private order tracking
// already has its own capability-token recovery and must take precedence.
const OMMI_NAV_STATE_KEY='ommi_navigation_state_v1';
let restoringNavigationState=false;

function saveNavigationState(id){
 if(restoringNavigationState)return;
 try{
  if(id==='home')sessionStorage.setItem(OMMI_NAV_STATE_KEY,JSON.stringify({screen:'home'}));
  else if(id==='chefs')sessionStorage.setItem(OMMI_NAV_STATE_KEY,JSON.stringify({screen:'chefs'}));
  else if(id==='orderModal'&&activeChef?.id)sessionStorage.setItem(OMMI_NAV_STATE_KEY,JSON.stringify({screen:'orderModal',chefId:String(activeChef.id)}));
 }catch{}
}

const navigationStateShowScreen=showScreen;
showScreen=function(id){
 const result=navigationStateShowScreen(id);
 saveNavigationState(id);
 return result;
};

async function restoreNavigationState(){
 // A private order link or a recently tracked order is more specific than a
 // generic page position, so the existing order recovery owns those cases.
 if(/^#order=[0-9a-f]{64}$/.test(location.hash))return;
 try{
  const lastOrder=localStorage.getItem('ommi_last_order_token')||'';
  if(/^[0-9a-f]{64}$/.test(lastOrder))return;
 }catch{}
 let state=null;
 try{state=JSON.parse(sessionStorage.getItem(OMMI_NAV_STATE_KEY)||'null')}catch{}
 if(!state||state.screen==='home')return;
 restoringNavigationState=true;
 try{
  if(state.screen==='chefs'){
   showScreen('chefs');
   await loadChefs();
   return;
  }
  if(state.screen==='orderModal'&&state.chefId){
   await loadChefs();
   const chef=chefsCache.find(c=>String(c.id)===String(state.chefId));
   if(chef){
    await openMealOrdering(chef);
    return;
   }
  }
  sessionStorage.removeItem(OMMI_NAV_STATE_KEY);
 }catch{
  try{sessionStorage.removeItem(OMMI_NAV_STATE_KEY)}catch{}
  showScreen('home');
 }finally{
  restoringNavigationState=false;
 }
}

window.addEventListener('DOMContentLoaded',restoreNavigationState,{once:true});
