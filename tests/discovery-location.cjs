const {JSDOM}=require('jsdom');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
const scripts=require('../scripts/runtime-scripts.cjs').runtimeScripts();
const kitchens=[{id:'casa',name:'كريم',gender:'m',city:'casablanca',area:'المعاريف',status:'active',dishes:[]},{id:'rabat',name:'اختبار الرباط',city:'rabat',area:'أكدال',status:'active',dishes:[]},{id:'missing',name:'بلا موقع',city:'casablanca',area:'حي آخر',status:'active',dishes:[]}];
const windows=[],errors=[],calls=[];let locations=[],ownerLocation=null,locationError=false,gpsCalls=0,gpsFailure=false;
const tick=()=>new Promise(r=>setTimeout(r,30));
function create(previous){
 const w=new JSDOM(html,{url:'https://test.invalid/',runScripts:'dangerously'}).window;windows.push(w);
 const from=table=>({select(fields){calls.push(['select',table,fields]);return this;},eq(k,v){calls.push(['filter',table,k,v]);return this;},order:async()=>({data:table==='chefs'?kitchens:[{id:'dish',chef_id:'casa',dish_name:'كسكس',reference_price:40,active:true}]})});
 w.supabase={createClient:()=>({from,rpc:async(name,args={})=>{calls.push([name,args]);
  if(name==='public_kitchen_locations')return locationError?{error:{message:'offline'}}:{data:locations};
  if(name==='chef_session_status')return{data:[kitchens[0]]};
  if(name==='chef_subscription')return{data:{payments:[]}};
  if(name==='chef_location'){
   if(args.p_lat!=null)ownerLocation={lat:args.p_lat,lng:args.p_lng,public_on_map:false};
   return{data:ownerLocation};
  }
  if(name==='chef_location_visibility'){ownerLocation.public_on_map=args.p_public_on_map;locations=args.p_public_on_map?[{chef_id:'casa',lat:ownerLocation.lat,lng:ownerLocation.lng}]:[];return{data:ownerLocation};}
  return{data:[]};
 }})};
 w.maps={};w.layers=[];
 const marker=(point,options)=>({point,options,events:{},on(event,fn){this.events[event]=fn;return this;},bindTooltip(){return this;},addTo(target){target.items??=[];target.items.push(this);return this;},remove(){this.removed=true;}});
 w.L={map:id=>{const map={id,items:[],events:{},zoomControl:{setPosition(){}},setView(point,zoom){this.center=point;this.zoom=zoom;return this;},getZoom(){return this.zoom;},fitBounds(points){this.bounds=points;return this;},getContainer:()=>w.document.getElementById(id),on(event,fn){this.events[event]=fn;return this;},project:([lat,lng])=>({x:lng*10000,y:lat*10000}),invalidateSize(){},remove(){this.removed=true;}};w.maps[id]=map;return map;},tileLayer:()=>({on(){return this;},addTo(){return this;}}),circleMarker:marker,marker,divIcon:options=>options,layerGroup:()=>{const layer={items:[],clearLayers(){this.items=[];},addTo(){return this;}};w.layers.push(layer);return layer;}};
 Object.defineProperty(w.navigator,'geolocation',{value:{getCurrentPosition(ok,fail){gpsCalls++;if(gpsFailure)fail();else ok({coords:{latitude:34.01,longitude:-6.85}});}}});
 w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
 if(previous)for(const store of ['localStorage','sessionStorage'])for(let i=0;i<previous[store].length;i++){const k=previous[store].key(i);w[store].setItem(k,previous[store].getItem(k));}
 else w.localStorage.setItem('ommi_chef_session','test');
 w.addEventListener('error',e=>errors.push(e.error));
 for(const file of scripts){const s=w.document.createElement('script');s.textContent=fs.readFileSync(path.join(root,file),'utf8');w.document.body.append(s);}
 return w;
}
const text=(w,id)=>w.document.getElementById(id).textContent;
const click=async(w,id)=>{const b=w.document.getElementById(id);await b.onclick({currentTarget:b});};
const choose=(w,id,value)=>{const s=w.document.getElementById(id);s.value=value;s.dispatchEvent(new w.Event('change',{bubbles:true}));};
(async()=>{
 let w=create();await tick();w.showScreen('chefs');await w.loadChefs();
 assert.equal(gpsCalls,0,'opening discovery does not request customer location');assert.equal(w.document.getElementById('nearCity').value,'');assert.equal(text(w,'discoveryTitle'),'المطابخ المتاحة');assert.equal(text(w,'cityTitle'),'كل المدن');assert.doesNotMatch(text(w,'chefGrid'),/عن موقعك|كم/);
 assert.ok(!calls.some(c=>c[0]==='filter'&&c[1]==='chefs'&&c[2]==='city'),'no forced Casablanca query');assert.match(text(w,'chefGrid'),/40 درهمًا/);
 await click(w,'showKitchenMap');assert.equal(w.layers[0].items.length,0,'no invented marker for a kitchen without location');assert.match(text(w,'mapStatus'),/لم تنشر مواقعها/);
 locations=[{chef_id:'casa',lat:33.57,lng:-7.6},{chef_id:'rabat',lat:34.01,lng:-6.85}];await w.loadChefs();assert.equal(w.layers[0].items.length,2,'published kitchens create map markers');assert.equal(w.maps.nearMap.bounds.length,2);
 choose(w,'nearCity','rabat');assert.equal(w.document.querySelectorAll('#chefGrid .chef-card').length,1);assert.match(text(w,'chefGrid'),/اختبار الرباط/);assert.equal(w.layers[0].items.length,1);
 choose(w,'nearCity','agadir');assert.equal(w.layers[0].items.length,0,'empty filter clears old markers');assert.match(text(w,'chefGrid'),/لا توجد مطابخ/);
 await click(w,'nearMe');assert.equal(gpsCalls,1);assert.equal(w.document.getElementById('nearCity').value,'');assert.equal(w.document.querySelector('#chefGrid .chef-name').textContent,'أمّي اختبار الرباط');assert.match(text(w,'chefGrid'),/عن موقعك/);assert.equal(text(w,'discoveryTitle'),'المطابخ حسب المسافة');
 w.dispatchEvent(new w.Event('pagehide'));w=create(w);await tick();assert.equal(w.document.querySelector('.screen.active').id,'chefs');assert.match(text(w,'chefGrid'),/عن موقعك/,'refresh keeps the explicitly selected search context');
 choose(w,'nearCity','rabat');assert.equal(w.eval('nearbyPoint'),null);gpsFailure=true;await click(w,'nearMe');assert.equal(w.eval('nearbyPoint'),null,'GPS refusal does not invent a fallback location');gpsFailure=false;
 await click(w,'chooseSearchPoint');assert.doesNotMatch(text(w,'locationPicker'),/موقع مطبخك/);w.maps.pickerMap.events.click({latlng:{lat:33.57,lng:-7.6}});await click(w,'savePoint');
 assert.equal(w.document.querySelector('.screen.active').id,'chefs');assert.equal(w.document.getElementById('nearCity').value,'');assert.match(text(w,'chefGrid'),/عن المكان المختار/);assert.equal(w.document.querySelector('#chefGrid .chef-name').textContent,'عمّي كريم');
 locationError=true;await w.loadChefs();assert.match(text(w,'mapStatus'),/تعذر تحميل/);assert.match(text(w,'chefGrid'),/تعذر تحميل موقع/);assert.doesNotMatch(text(w,'chefGrid'),/لم يُنشر/);locationError=false;
 ownerLocation=null;locations=[];w.openKitchenDashboard(kitchens[0]);await tick();assert.match(text(w,'kitchenMapSummary'),/غير ظاهر على الخريطة/);
 const button=w.document.querySelector('#kitchenMapSummary button');await button.onclick();assert.equal(w.document.getElementById('savePoint').disabled,true);assert.equal(w.document.getElementById('publicMapConsent').checked,false);
 w.maps.pickerMap.events.click({latlng:{lat:33.57,lng:-7.6}});assert.equal(w.document.getElementById('savePoint').disabled,true,'point alone cannot publish');
 const consent=w.document.getElementById('publicMapConsent');consent.checked=true;consent.dispatchEvent(new w.Event('change'));assert.equal(w.document.getElementById('savePoint').disabled,false);await click(w,'savePoint');await tick();assert.equal(ownerLocation.public_on_map,true);assert.match(text(w,'kitchenMapSummary'),/منشور على الخريطة/);
 w.showScreen('chefs');await w.loadChefs();if(w.document.getElementById('nearMapWrap').hidden)await click(w,'showKitchenMap');assert.equal(w.layers[0].items.filter(x=>x.options?.icon).length,1,'saved consent produces a customer marker');
 assert.deepEqual(errors,[]);console.log('PASS neutral discovery, city/area filters, explicit GPS and denial, manual search/refresh, map markers and bounds, stale marker removal, load errors, kitchen save+consent+publication');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>windows.forEach(w=>w.close()));
