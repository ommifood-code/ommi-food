/* Ommi Food: gender is determined only by the user's explicit registration choice. */
function canonicalChefGender(g){
  const v=String(g??'').trim().toLowerCase();
  if(['m','male','man','homme','masculin','ذكر'].includes(v))return 'm';
  if(['f','female','woman','femme','feminin','féminin','أنثى'].includes(v))return 'f';
  return '';
}
function isMaleChefGender(g){return canonicalChefGender(g)==='m'}
prefix=function(g){const c=canonicalChefGender(g);return c==='m'?'عمّي':c==='f'?'أمّي':''};

/* No gender is selected by default. Registration must use an explicit user choice. */
joinGender='';
document.querySelectorAll('.gender').forEach(button=>{
  button.classList.remove('active');
  button.setAttribute('aria-pressed','false');
  button.textContent=button.dataset.gender==='male'?'ذكر':'أنثى';
  button.addEventListener('click',()=>{
    document.querySelectorAll('.gender').forEach(x=>{
      x.classList.remove('active');
      x.setAttribute('aria-pressed','false');
    });
    button.classList.add('active');
    button.setAttribute('aria-pressed','true');
    joinGender=button.dataset.gender==='male'?'m':'f';
  },true);
});

/* Capture the submit before dish-images.js onclick. If no choice exists, stop registration. */
document.getElementById('submitJoinBtn')?.addEventListener('click',event=>{
  const selected=document.querySelector('.gender.active');
  if(!selected){
    joinGender='';
    event.preventDefault();
    event.stopImmediatePropagation();
    showToast('حددي الجنس أولًا: أنثى أو ذكر.');
    return;
  }
  joinGender=selected.dataset.gender==='male'?'m':'f';
},true);

function applyChefGenderUi(g){
  const c=canonicalChefGender(g);
  const male=c==='m';
  const topbar=document.querySelector('#buildKitchen .topbar span');
  if(topbar)topbar.textContent=male?'أنت الآن داخل Ommi Food':'أنتِ الآن داخل Ommi Food';
  const firstStep=document.querySelector('#buildKitchen .builder-step:nth-of-type(2) p');
  if(firstStep)firstStep.textContent=male?'اختر نوع مطبخك':'اختاري نوع مطبخك';
  const addStep=[...document.querySelectorAll('#buildKitchen .builder-step')].find(x=>x.querySelector('h2')?.textContent.includes('أطباقك'));
  if(addStep){
    const h=addStep.querySelector('h2');
    const p=addStep.querySelector('p');
    if(h)h.textContent=male?'أضف أطباقك':'أضيفي أطباقك';
    if(p)p.textContent=male?'أضف أطباقك واحدًا واحدًا. الصورة اختيارية ويمكن إضافتها لاحقًا.':'أضيفي أطباقك واحدًا واحدًا. الصورة اختيارية ويمكن إضافتها لاحقًا.';
  }
  const daysStep=[...document.querySelectorAll('#buildKitchen .builder-step')].find(x=>x.querySelector('h2')?.textContent.includes('متى'));
  if(daysStep){
    const h=daysStep.querySelector('h2');
    const p=daysStep.querySelector('p');
    if(h)h.textContent=male?'متى تعمل؟':'متى تعملين؟';
    if(p)p.textContent=male?'اختر الأيام التي تستقبل فيها الطلبات.':'اختاري الأيام التي تستقبلين فيها الطلبات.';
  }
  const specialty=document.querySelector('#builderSpecialty option[value=""]');
  if(specialty)specialty.textContent=male?'— اختر —':'— اختاري —';
}

let kitchenFlowMode='onboarding';
const _openBuilder=openBuilder;
openBuilder=function(){
  currentChefGender=canonicalChefGender(currentChefGender);
  _openBuilder();
  applyChefGenderUi(currentChefGender);
  const titlePrefix=prefix(currentChefGender);
  document.getElementById('builderKitchenName').textContent=`مطبخ ${titlePrefix?titlePrefix+' ':''}${currentChefName}`;
  updatePreview();
  applyKitchenFlowMode();
};

function applyKitchenFlowMode(){
  const manage=kitchenFlowMode==='manage';
  const screen=document.getElementById('buildKitchen');
  if(!screen)return;
  const topStrong=screen.querySelector('.topbar strong');
  const topSpan=screen.querySelector('.topbar span');
  const back=screen.querySelector('.topbar .back');
  const welcome=screen.querySelector('.welcome-kitchen');
  const steps=[...screen.querySelectorAll('.builder-step')];
  const readyStep=steps.find(x=>x.querySelector('h2')?.textContent.trim()==='جاهز');
  const preview=document.getElementById('builderPreview');
  const submit=document.getElementById('submitKitchenBtn');
  screen.querySelectorAll('.builder-step > b').forEach(b=>b.style.display=manage?'none':'');
  if(welcome)welcome.style.display=manage?'none':'';
  if(readyStep)readyStep.style.display=manage?'none':'';
  if(preview)preview.style.display=manage?'none':'';
  if(topStrong)topStrong.textContent=manage?'إدارة مطبخي':'مطبخي';
  if(topSpan)topSpan.textContent=manage?'عدّل معلومات مطبخك وأطباقك':(isMaleChefGender(currentChefGender)?'أنت الآن داخل Ommi Food':'أنتِ الآن داخل Ommi Food');
  if(submit)submit.textContent=manage?'حفظ التعديلات':'ابدأ من مطبخك';
  if(back)back.onclick=manage?()=>openKitchenDashboard():()=>showScreen('home');
}

/* Patch the post-load flow so returning cooks go to a dashboard, not back into onboarding. */
window.addEventListener('load',()=>{
  document.querySelectorAll('.gender').forEach(button=>{
    button.textContent=button.dataset.gender==='male'?'ذكر':'أنثى';
  });

  chefLogin=async function(){
    const phone=document.getElementById('chefLoginPhone').value.trim(),pin=document.getElementById('chefLoginPin').value.trim(),btn=document.getElementById('chefLoginSubmit');
    if(!/^0[5-7][0-9]{8}$/.test(phone)||!/^\d{6}$/.test(pin)){showToast('تحقق من رقم الهاتف والرمز السري.');return}
    btn.disabled=true;btn.textContent='جاري التحقق...';
    const{data,error}=await db.rpc('chef_login',{p_phone:phone,p_pin:pin});
    btn.disabled=false;btn.textContent='دخول آمن';
    if(error){showToast('تعذر التحقق حاليًا. حاول مرة أخرى.');return}
    if(!data?.ok){showToast(data?.error==='temporarily_locked'?'تم إيقاف المحاولات مؤقتًا لحماية الحساب.':'رقم الهاتف أو الرمز السري غير صحيح.');return}
    chefSessionToken=data.session_token;
    localStorage.setItem(CHEF_SESSION_KEY,chefSessionToken);
    closeModal(document.getElementById('chefLoginModal'));
    const ok=await restoreChefSession(false);
    if(ok)openKitchenDashboard();
  };

  ensureKitchenDashboard=function(){
    let screen=document.getElementById('chefKitchenDashboard');
    if(!screen){
      screen=document.createElement('section');
      screen.id='chefKitchenDashboard';
      screen.className='screen';
      screen.innerHTML=`<header class="topbar"><button class="back" type="button">←</button><div><strong>مطبخي</strong><span>لوحة إدارة المطبخ</span></div><div class="mini-logo">Ommi Food</div></header><div class="content kitchen-builder"><div class="builder-actions"><button type="button" class="primary full" id="kitchenDashEdit">إدارة مطبخي وتعديل الأطباق</button><button type="button" class="admin-secondary full" id="kitchenDashPublic">استكشاف المطابخ القريبة</button></div></div>`;
      document.querySelector('main')?.appendChild(screen)||document.body.appendChild(screen);
    }
    screen.querySelector('.back').onclick=()=>showScreen('home');
    screen.querySelector('#kitchenDashEdit').onclick=async()=>{
      kitchenFlowMode='manage';
      const ok=await restoreChefSession(true);
      if(ok)applyKitchenFlowMode();
    };
    screen.querySelector('#kitchenDashPublic').onclick=async()=>{showScreen('chefs');await loadChefs()};
    return screen;
  };

  openKitchenDashboard=function(){
    kitchenFlowMode='manage';
    ensureKitchenDashboard();
    showScreen('chefKitchenDashboard');
  };

  const saveBtn=document.getElementById('submitKitchenBtn');
  if(saveBtn?.onclick){
    const originalSave=saveBtn.onclick;
    saveBtn.onclick=async function(){
      const wasManage=kitchenFlowMode==='manage';
      const originalShowToast=showToast;
      if(wasManage){
        showToast=function(t){originalShowToast(t==='تم ربط مطبخ منزلك بالمنصة.'?'تم حفظ التعديلات.':t)};
      }
      try{
        await originalSave.call(this);
      }finally{
        showToast=originalShowToast;
      }
    };
  }
});