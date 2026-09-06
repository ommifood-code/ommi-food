/* Ommi Food: gender is determined only by the user's explicit registration choice. */
function canonicalChefGender(g){
  const v=String(g??'').trim().toLowerCase();
  if(['m','male','man','homme','masculin','ذكر'].includes(v))return 'm';
  if(['f','female','woman','femme','feminin','féminin','أنثى'].includes(v))return 'f';
  return '';
}
function isMaleChefGender(g){return canonicalChefGender(g)==='m'}
prefix=function(g){return isMaleChefGender(g)?'عمّي':'أمّي'};

/* Keep the active gender button and the value sent to chef_register in strict sync. */
document.querySelectorAll('.gender').forEach(button=>{
  button.addEventListener('click',()=>{
    joinGender=button.dataset.gender==='male'?'m':'f';
  },true);
});
document.getElementById('submitJoinBtn')?.addEventListener('click',()=>{
  const selected=document.querySelector('.gender.active');
  joinGender=selected?.dataset.gender==='male'?'m':'f';
},true);

function applyChefGenderUi(g){
  const male=isMaleChefGender(g);
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
  currentChefGender=canonicalChefGender(currentChefGender)||'f';
  _openBuilder();
  applyChefGenderUi(currentChefGender);
  document.getElementById('builderKitchenName').textContent=`مطبخ ${prefix(currentChefGender)} ${currentChefName}`;
  updatePreview();
};