/* Ommi Food: secure chef identity + optional dish images. */
const CHEF_SESSION_KEY='ommi_chef_session';
let chefSessionToken=localStorage.getItem(CHEF_SESSION_KEY)||'';
const _baseAddDish=addDish;

function addIdentityUi(){
  const area=document.getElementById('joinArea');
  if(area&&!document.getElementById('joinPin')){
    const pin=document.createElement('input'); pin.id='joinPin'; pin.className='field'; pin.type='password'; pin.inputMode='numeric'; pin.maxLength=6; pin.autocomplete='new-password'; pin.placeholder='رمز سري من 6 أرقام';
    area.insertAdjacentElement('afterend',pin);
    const note=document.createElement('div'); note.className='simple-join-copy'; note.textContent='احتفظي بهذا الرمز. ستستعملينه مع رقم هاتفك للرجوع إلى مطبخك وتعديله.'; pin.insertAdjacentElement('afterend',note);
  }
  const invite=document.querySelector('.chef-invite');
  if(invite&&!document.getElementById('chefLoginBtn')){
    const b=document.createElement('button'); b.id='chefLoginBtn'; b.type='button'; b.className='admin-secondary full'; b.textContent='لدي مطبخ بالفعل'; b.style.marginTop='10px'; invite.appendChild(b); b.onclick=openChefLogin;
  }
}

function openChefLogin(){
  let m=document.getElementById('chefLoginModal');
  if(!m){m=document.createElement('div');m.id='chefLoginModal';m.className='modal';m.setAttribute('aria-hidden','true');m.innerHTML=`<div class="modal-card small"><button class="close" type="button">×</button><h2>الدخول إلى مطبخي</h2><p class="simple-join-copy">أدخلي رقم الهاتف والرمز السري الذي اخترته عند الانضمام.</p><input id="chefLoginPhone" class="field" inputmode="tel" placeholder="رقم الهاتف"><input id="chefLoginPin" class="field" type="password" inputmode="numeric" maxlength="6" placeholder="الرمز السري"><button id="chefLoginSubmit" class="primary full">دخول آمن</button></div>`;document.body.appendChild(m);m.querySelector('.close').onclick=()=>closeModal(m);m.onclick=e=>{if(e.target===m)closeModal(m)};m.querySelector('#chefLoginSubmit').onclick=chefLogin;}
  openModal(m);
}

async function chefLogin(){
  const phone=document.getElementById('chefLoginPhone').value.trim(),pin=document.getElementById('chefLoginPin').value.trim(),btn=document.getElementById('chefLoginSubmit');
  if(!/^0[5-7][0-9]{8}$/.test(phone)||!/^\d{6}$/.test(pin)){showToast('تحققي من رقم الهاتف والرمز السري.');return}
  btn.disabled=true;btn.textContent='جاري التحقق...';
  const{data,error}=await db.rpc('chef_login',{p_phone:phone,p_pin:pin});btn.disabled=false;btn.textContent='دخول آمن';
  if(error){showToast(error.message?.includes('locked')?'تم إيقاف المحاولات مؤقتًا لحماية الحساب.':'رقم الهاتف أو الرمز السري غير صحيح.');return}
  chefSessionToken=data.session_token;localStorage.setItem(CHEF_SESSION_KEY,chefSessionToken);closeModal(document.getElementById('chefLoginModal'));await restoreChefSession(true);
}

async function restoreChefSession(open=false){
  if(!chefSessionToken)return false;
  const{data,error}=await db.rpc('chef_session_status',{p_session_token:chefSessionToken});
  if(error||!data?.length){localStorage.removeItem(CHEF_SESSION_KEY);chefSessionToken='';return false}
  const c=data[0];currentChefId=c.id;currentChefName=c.name;currentChefArea=c.area||'';currentChefGender=c.gender;
  if(open){
    openBuilder();document.getElementById('builderBio').value=c.bio||'';document.getElementById('builderSpecialty').value=c.specialty||'';document.getElementById('builderDishes').innerHTML='';
    const ds=Array.isArray(c.dishes)?c.dishes:[];(ds.length?ds:[{name:'',price:''}]).forEach(d=>addDish(d.name||'',d.price||'',d.image_url||null));
    const days=String(c.work_days||'').split('،').map(x=>x.trim());document.querySelectorAll('#builderDays button').forEach(b=>b.classList.toggle('selected',days.includes(b.dataset.day)));
    const times=String(c.work_hours||'').split(' - ');document.getElementById('builderFrom').value=times[0]||'';document.getElementById('builderTo').value=times[1]||'';
    if(c.fulfilment_type)document.getElementById('builderFulfilment').value=c.fulfilment_type;if(c.delivery_by)document.getElementById('builderDeliveryBy').value=c.delivery_by;updatePreview();
  }
  return true;
}

function attachImage(row,imageUrl=null){
  if(!row||row.querySelector('.dish-image-wrap'))return;
  const w=document.createElement('div');w.className='dish-image-wrap';w.innerHTML=`<label class="dish-image-label"><span>عندك صورة للطبق؟ أضيفيها الآن</span><small>الصورة تساعد الزبائن على معرفة طبقك واختياره. لا توجد صورة؟ لا بأس، يمكنك إضافتها لاحقًا.</small><input class="dish-image" type="file" accept="image/jpeg,image/png,image/webp" hidden><button type="button" class="dish-image-btn">اختيار صورة</button></label><div class="dish-image-preview" hidden><img alt="معاينة صورة الطبق"><button type="button" class="dish-image-remove">حذف الصورة</button></div>`;row.appendChild(w);
  const input=w.querySelector('.dish-image'),button=w.querySelector('.dish-image-btn'),preview=w.querySelector('.dish-image-preview'),img=preview.querySelector('img');
  if(imageUrl){img.src=imageUrl;img.dataset.savedUrl=imageUrl;preview.hidden=false;button.textContent='تغيير الصورة'}
  button.onclick=()=>input.click();input.onchange=()=>{const f=input.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5*1024*1024){input.value='';showToast('اختاري JPG أو PNG أو WebP بحجم لا يتجاوز 5 MB.');return}if(img.dataset.objectUrl)URL.revokeObjectURL(img.dataset.objectUrl);img.dataset.objectUrl=URL.createObjectURL(f);img.src=img.dataset.objectUrl;preview.hidden=false;button.textContent='تغيير الصورة'};
  w.querySelector('.dish-image-remove').onclick=()=>{if(img.dataset.objectUrl)URL.revokeObjectURL(img.dataset.objectUrl);input.value='';img.removeAttribute('src');delete img.dataset.objectUrl;delete img.dataset.savedUrl;preview.hidden=true;button.textContent='اختيار صورة'};
}

addDish=function(name='',price='',imageUrl=null){_baseAddDish(name,price);const rows=document.querySelectorAll('.builder-dish-row');attachImage(rows[rows.length-1],imageUrl)};

async function uploadImageSecure(file){
  const form=new FormData();form.append('session_token',chefSessionToken);form.append('file',file);
  const r=await fetch(`${SUPABASE_URL}/functions/v1/chef-dish-image`,{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`},body:form});const out=await r.json();if(!r.ok||!out.image_url)throw new Error(out.error||'upload failed');return out.image_url;
}
async function collectDishesSecure(){const result=[];for(const row of document.querySelectorAll('.builder-dish-row')){const name=row.querySelector('.dish-name').value.trim(),price=row.querySelector('.dish-price').value.trim();if(!name)continue;const input=row.querySelector('.dish-image'),img=row.querySelector('.dish-image-preview img');let image_url=img?.dataset.savedUrl||null;if(input?.files?.[0])image_url=await uploadImageSecure(input.files[0]);result.push({name,price,image_url})}return result}

const joinBtn=document.getElementById('submitJoinBtn');
joinBtn.onclick=async()=>{clearJoinErrors();const name=cleanName(document.getElementById('joinName').value),phone=document.getElementById('joinPhone').value.trim(),area=document.getElementById('joinArea').value.trim(),pin=document.getElementById('joinPin').value.trim(),consent=document.getElementById('joinConsent').checked;if(!name){joinFieldError('joinName','أدخلي اسمك الأول.');return}if(!/^0[5-7][0-9]{8}$/.test(phone)){joinFieldError('joinPhone','أدخلي رقم هاتف مغربي صحيحًا من 10 أرقام.');return}if(!area){joinFieldError('joinArea','أدخلي الحي أو المنطقة.');return}if(!/^\d{6}$/.test(pin)){joinFieldError('joinPin','اختاري رمزًا سريًا من 6 أرقام.');return}if(!consent){document.getElementById('joinConsent').closest('label')?.classList.add('consent-invalid');showToast('وافقي على شروط المنصة للمتابعة');return}joinBtn.disabled=true;joinBtn.textContent='جاري فتح مطبخك...';const{data,error}=await db.rpc('chef_register',{p_name:name,p_phone:phone,p_city:'casablanca',p_city_label:'الدار البيضاء',p_area:area,p_gender:joinGender,p_pin:pin});joinBtn.disabled=false;joinBtn.textContent='ابدئي مطبخك';if(error){showToast(error.message?.includes('phone already')?'هذا الرقم مرتبط بمطبخ موجود. استخدمي «لدي مطبخ بالفعل».':'تعذر بدء المطبخ حاليًا.');return}currentChefId=data.chef_id;currentChefName=name;currentChefArea=area;currentChefGender=joinGender;chefSessionToken=data.session_token;localStorage.setItem(CHEF_SESSION_KEY,chefSessionToken);closeModal(joinModal);openBuilder()};

document.getElementById('submitKitchenBtn').onclick=async function(){const bio=document.getElementById('builderBio').value.trim(),specialty=document.getElementById('builderSpecialty').value.trim(),basic=collectDishes(),days=[...document.querySelectorAll('#builderDays button.selected')].map(b=>b.dataset.day),from=document.getElementById('builderFrom').value,to=document.getElementById('builderTo').value,fulfilment=document.getElementById('builderFulfilment').value,deliveryBy=document.getElementById('builderDeliveryBy').value;if(!chefSessionToken){showToast('انتهت جلسة المطبخ. ادخلي من «لدي مطبخ بالفعل».');return}if(!bio||!specialty||!basic.length||!days.length||!from||!to){showToast('أكملي الخطوات الأساسية قبل الحفظ.');return}if(basic.some(d=>!d.price)){showToast('أضيفي ثمنًا لكل طبق.');return}this.disabled=true;this.textContent='جاري حفظ مطبخك...';try{const dishes=await collectDishesSecure();const{error}=await db.rpc('chef_secure_save',{p_session_token:chefSessionToken,p_bio:bio,p_specialty:specialty,p_dishes:dishes,p_work_days:days.join('، '),p_work_hours:`${from} - ${to}`,p_fulfilment_type:fulfilment,p_delivery_by:deliveryBy});if(error)throw error;showToast('تم حفظ مطبخك بأمان. أصبح جاهزًا للمراجعة.');this.textContent='تم حفظ مطبخك'}catch(e){console.error(e);showToast('تعذر الحفظ. لم نفقد بياناتك، حاولي مرة أخرى.');this.disabled=false;this.textContent='حفظ مطبخي وإرساله للمراجعة'}};

addIdentityUi();restoreChefSession(false);
