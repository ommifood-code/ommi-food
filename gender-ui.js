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
    showToast('حددي أولًا: أنثى · أمّي أم ذكر · عمّي.');
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

const _openBuilder=openBuilder;
openBuilder=function(){
  currentChefGender=canonicalChefGender(currentChefGender);
  _openBuilder();
  applyChefGenderUi(currentChefGender);
  const titlePrefix=prefix(currentChefGender);
  document.getElementById('builderKitchenName').textContent=`مطبخ ${titlePrefix?titlePrefix+' ':''}${currentChefName}`;
  updatePreview();
};