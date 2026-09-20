const {JSDOM}=require('jsdom');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
const scripts=['app.js','dish-images.js','meal-orders.js','nearby.js','kitchen-settings.js','simple-launch.js','kitchen-overview.js','food-requests.js','navigation-state.js'];
const tokens=['a'.repeat(64),'b'.repeat(64),'c'.repeat(64)];
const requests=new Map(),offline=new Set(),windows=[],errors=[];
let cancelFails=false;
const tick=()=>new Promise(r=>setTimeout(r,30));
const active=w=>w.document.querySelector('.screen.active')?.id;
function seed(token,dish,status='pending',legacy=false){requests.set(token,{id:token,request_v2:!legacy,status,dish_name:dish,people:2,order_ref:'OF-test',requested_at:null,chef_phone:'0600000001',legacy});}
function create(previous,url='https://test.invalid/'){
 const w=new JSDOM(html,{url,runScripts:'dangerously',pretendToBeVisual:true}).window;windows.push(w);
 w.supabase={createClient:()=>({rpc:async(name,args={})=>{
  const token=args.p_token||args.p_access_token,request=requests.get(token);
  if(offline.has(token))return{error:{message:'offline'}};
  if(name==='food_request_customer')return{data:request?.legacy?null:request||null};
  if(name==='customer_meal_order')return{data:request||null};
  if(['food_request_customer_action','customer_meal_action'].includes(name)&&args.p_action==='cancel'){
   if(cancelFails)return{error:{message:'offline'}};
   request.status='cancelled';return{data:null};
  }
  return{data:[]};
 },from:()=>({select(){return this},eq(){return this},order:async()=>({data:[]})})})};
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
 if(previous)for(const store of ['localStorage','sessionStorage'])for(let i=0;i<previous[store].length;i++){const k=previous[store].key(i);w[store].setItem(k,previous[store].getItem(k));}
 w.addEventListener('error',e=>errors.push(e.error));
 w.polls=[];w.setInterval=fn=>{w.polls.push(fn);return w.polls.length;};
 for(const file of scripts){const s=w.document.createElement('script');s.textContent=fs.readFileSync(path.join(root,file),'utf8');w.document.body.append(s);}
 return w;
}
const receipts=w=>JSON.parse(w.localStorage.getItem('ommi_meal_receipts')||'[]').map(r=>r.token);
async function cancel(w,label='إلغاء طلبي'){
 const b=[...w.document.querySelectorAll('#customerMealTracking button')].find(b=>b.textContent===label);
 assert.ok(b);await b.onclick();await tick();
}
(async()=>{
 let w=create();await tick();seed(tokens[0],'الطلب الأول');seed(tokens[1],'طلب المطبخ الآخر');
 await w.openCustomerMealOrder(tokens[1]);await w.openCustomerMealOrder(tokens[0]);
 cancelFails=true;await cancel(w);assert.equal(active(w),'customerMealTracking');assert.equal(receipts(w).length,2,'failed cancellation must not remove the request');cancelFails=false;
 w.eval("mealRequest={token:'"+tokens[0]+"',signature:'old'}");await cancel(w);
 assert.equal(active(w),'myMealReceipts');assert.deepEqual(receipts(w),[tokens[1]]);
 assert.match(w.document.querySelector('#myMealReceipts').textContent,/طلب المطبخ الآخر/);
 assert.doesNotMatch(w.document.querySelector('#myMealReceipts').textContent,/الطلب الأول|ملغى/);
 assert.equal(w.document.getElementById('customerMealTracking'),null,'cancelled card and contact actions removed');
 assert.equal(w.eval('mealRequest'),null,'a fresh submission gets a fresh request token');
 assert.ok(!w.sessionStorage.getItem('ommi_navigation_state_v1').includes(tokens[0]));
 await w.openCustomerMealOrder(tokens[1]);await cancel(w);assert.equal(active(w),'home');assert.deepEqual(receipts(w),[]);assert.equal(w.location.hash,'');
 w.dispatchEvent(new w.Event('pagehide'));w=create(w);await tick();assert.equal(active(w),'home','refresh remains home after the final cancellation');
 // Old saved receipts, copied links and navigation snapshots cannot resurrect cancelled orders.
 w.localStorage.setItem('ommi_meal_receipts',JSON.stringify([{token:tokens[0],dish_name:'الطلب الأول'}]));
 w.localStorage.setItem('ommi_last_order_token',tokens[0]);
 w.sessionStorage.setItem('ommi_navigation_state_v1',JSON.stringify({current:{screen:'customerMealTracking',token:tokens[0]},trail:[{screen:'customerMealTracking',token:tokens[0]}]}));
 w=create(w,'https://test.invalid/#order='+tokens[0]);await tick();assert.equal(active(w),'home');assert.deepEqual(receipts(w),[]);assert.equal(w.location.hash,'');
 assert.equal(w.document.getElementById('customerMealTracking'),null);assert.ok(!w.sessionStorage.getItem('ommi_navigation_state_v1').includes(tokens[0]));
 w.history.replaceState(null,'','#order='+tokens[0]);await w.followOrderLink();assert.deepEqual(receipts(w),[],'hash-link handler must not re-save cancelled token');
 // A lost connection must never erase another kitchen's active order.
 seed(tokens[1],'طلب المطبخ الآخر');w.rememberMealReceipt(tokens[0],'الطلب الأول');w.rememberMealReceipt(tokens[1],'طلب المطبخ الآخر');offline.add(tokens[1]);
 await w.openMyMealReceipts();assert.deepEqual(receipts(w),[tokens[1]]);assert.equal(active(w),'myMealReceipts');assert.match(w.document.querySelector('#myMealReceipts').textContent,/تعذر تحديث/);offline.clear();
 // Cancellation by the kitchen is also removed on the existing refresh interval.
 await w.openCustomerMealOrder(tokens[1]);requests.get(tokens[1]).status='cancelled';for(const poll of w.polls)await poll();
 assert.equal(active(w),'home');assert.deepEqual(receipts(w),[]);
 // Legacy orders use the same cancellation behavior.
 seed(tokens[2],'طلب قديم','pending',true);await w.openCustomerMealOrder(tokens[2]);await cancel(w,'إلغاء الطلب قبل القبول');assert.equal(active(w),'home');assert.deepEqual(receipts(w),[]);
 assert.deepEqual(errors,[]);console.log('PASS cancellation success/failure, other active kitchens preserved, last order returns home, refresh/deep links cannot resurrect cancellation, offline retention, kitchen cancellation polling, legacy orders');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>windows.forEach(w=>w.close()));
