const {JSDOM}=require('jsdom');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
const scripts=['app.js','dish-images.js','meal-orders.js','nearby.js','kitchen-settings.js','simple-launch.js','kitchen-overview.js','food-requests.js','navigation-state.js'];
const chef={id:'chef',name:'كريم',gender:'m',area:'المعاريف',dishes:[],status:'active'};
const offer={id:'dish',chef_id:'chef',dish_name:'كسكس',price:40,reference_price:40,active:true,delivery_areas:[]};
const token='a'.repeat(64),request={id:'r',request_v2:true,status:'pending',dish_name:'كسكس',people:2,order_ref:'OF-test',requested_at:'2030-01-01T12:00Z',chef_phone:'0600000001'};
const settings={configured:true,work_days:'الجمعة',fulfilment_type:'pickup',pickup_instructions:'عنوان خاص',delivery_areas:[]};
let sessionValid=true;const errors=[],windows=[];const tick=()=>new Promise(r=>setTimeout(r,30));
function create(previous,url='https://test.invalid/'){
 const w=new JSDOM(html,{url,runScripts:'dangerously'}).window;windows.push(w);
 const query=table=>({select(){return this},eq(){return this},order(){return Promise.resolve({data:table==='chefs'?[chef]:[offer]})}});
 w.supabase={createClient:()=>({from:query,rpc:async(name)=>({data:({chef_session_status:sessionValid?[chef]:[],chef_meal_defaults:settings,chef_order_settings:settings,chef_meal_offers:[offer],food_request_customer:request,food_requests_chef:[],chef_meal_orders:[],public_kitchen_locations:[],public_kitchen_workdays:[],food_request_reputation:[],chef_correction_status:[],chef_subscription:{payments:[]},chef_location:null})[name]})})};
 w.L={map:()=>({setView(){return this},on(){return this},getContainer(){return w.document.createElement('div')},remove(){}}),tileLayer:()=>({on(){return this},addTo(){return this}}),circleMarker:()=>({addTo(){return this},remove(){}})};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
 if(previous){for(const key of ['localStorage','sessionStorage'])for(let i=0;i<previous[key].length;i++){const k=previous[key].key(i);w[key].setItem(k,previous[key].getItem(k));}}
 else w.localStorage.setItem('ommi_chef_session','test');
 w.addEventListener('error',e=>errors.push(e.error));
 for(const file of scripts){const script=w.document.createElement('script');script.textContent=fs.readFileSync(path.join(root,file),'utf8');w.document.body.append(script);}
 return w;
}
const active=w=>w.document.querySelector('.screen.active').id;
function reload(w,url){w.dispatchEvent(new w.Event('pagehide'));return create(w,url||w.location.href);}
(async()=>{
 let w=create();await tick();const home=w.document.getElementById('home').outerHTML;
 assert.equal(w.document.getElementById('homeOrderHint'),null);
 w.showScreen('chefs');await w.loadChefs();await w.openMealOrdering(chef);
 w.document.querySelector('#dishList button').click();let f=w.document.getElementById('mealCustomerForm');
 f.elements.name.value='اختبار حفظ الصفحة';f.elements.phone.value='0600000002';f.elements.people.value='5';f.elements.notes.value='رغبة محفوظة';f.elements.requested_at.value='2030-01-01T12:00';
 w=reload(w);await tick();assert.equal(active(w),'orderModal');assert.equal(w.eval('activeChef.id'),'chef');
 f=w.document.getElementById('mealCustomerForm');assert.equal(f.elements.people.value,'5');assert.equal(f.elements.notes.value,'رغبة محفوظة');assert.equal(w.document.querySelector('#dishList button').getAttribute('aria-pressed'),'false','refresh does not select a dish');assert.equal(w.eval('selectedMealOffer'),null);
 w.document.querySelector('#orderModal .meal-form').click();assert.equal(active(w),'orderModal','blank space does not navigate');
 await w.navigateBack();assert.equal(active(w),'chefs');await w.navigateBack();assert.equal(active(w),'home');assert.equal(w.document.getElementById('home').outerHTML,home,'approved homepage unchanged');
 // The map picker restores its point and returns to the original screen after save.
 w.showScreen('chefs');await w.loadChefs();await w.pickLocation(false,[33.57,-7.59],()=>{});
 w=reload(w);await tick();assert.equal(active(w),'locationPicker');assert.equal(w.document.getElementById('locationPicker').dataset.point,'[33.57,-7.59]');
 w.document.getElementById('savePoint').click();await tick();assert.equal(active(w),'chefs');await w.navigateBack();assert.equal(active(w),'home');
 // Restore dynamically built authenticated screens and editor context.
 for(const screen of ['chefKitchenDashboard','kitchenSettings','kitchenPreferences','myMealOffers','chefMealOrders','mealOfferEditor']){
  await w.openNavigationState({screen,owner:'chef',offerId:screen==='mealOfferEditor'?'dish':null});
  assert.equal(active(w),screen);w=reload(w);await tick();assert.equal(active(w),screen,'refresh '+screen);
 }
 f=w.document.getElementById('mealOfferForm');f.elements.dish_name.value='تعديل غير محفوظ';w=reload(w);await tick();assert.equal(w.document.getElementById('mealOfferForm').elements.dish_name.value,'تعديل غير محفوظ');assert.equal(w.document.getElementById('mealOfferEditor').dataset.offerId,'dish');
 sessionValid=false;w=reload(w);await tick();assert.equal(active(w),'home','no session bypass');assert.equal(w.document.getElementById('mealOfferEditor'),null,'private draft not rendered');sessionValid=true;w.localStorage.setItem('ommi_chef_session','test');w.eval("chefSessionToken='test'");
 // A private link wins over generic screen state. Receipts survive closing/reopening.
 await w.openCustomerMealOrder(token);w=reload(w);await tick();assert.equal(active(w),'customerMealTracking');
 w.showScreen('home');assert.equal(w.location.hash,'');w=reload(w);await tick();assert.equal(active(w),'home','intentional home wins over recent receipt');
 w.document.getElementById('homeMyOrdersBtn').click();w=reload(w);await tick();assert.equal(active(w),'myMealReceipts');
 const b=[...w.document.querySelectorAll('#myMealReceipts button')].find(b=>b.textContent==='كسكس');assert.ok(b);b.click();await tick();assert.equal(active(w),'customerMealTracking');
 w=reload(w);await tick();assert.equal(active(w),'customerMealTracking');await w.navigateBack();assert.equal(active(w),'myMealReceipts','order deep-link refresh preserves previous screen');
 // Closing a tab discards session navigation, but stored receipts remain usable.
 w.showScreen('home');w.sessionStorage.clear();w=reload(w);await tick();assert.ok(w.localStorage.getItem('ommi_meal_receipts').includes(token));
 // Never save secret PIN fields when a login dialog is open.
 w.openChefLogin();w.document.querySelector('#chefLoginModal input[type=password]').value='483927';w.dispatchEvent(new w.Event('pagehide'));assert.ok(!w.sessionStorage.getItem('ommi_navigation_state_v1').includes('483927'));
 chef.id='11111111-1111-4111-8111-111111111111';offer.chef_id=chef.id;
 w=create(null,'https://test.invalid/#kitchen='+chef.id);await tick();assert.equal(active(w),'orderModal','kitchen link opens once');
 w.document.getElementById('mealCustomerForm').elements.people.value='7';w=reload(w);await tick();assert.equal(active(w),'orderModal');assert.equal(w.document.getElementById('mealCustomerForm').elements.people.value,'7','kitchen link retains draft');await w.navigateBack();assert.equal(active(w),'home');
 assert.deepEqual(errors,[]);console.log('PASS public/chef refresh, draft and dish context, previous screen, inert whitespace, home, private session, receipt recovery, PIN exclusion');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>windows.forEach(w=>w.close()));
