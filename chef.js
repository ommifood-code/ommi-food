const SUPABASE_URL='https://qgblrockjswicegfldzm.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYmxyb2NranN3aWNlZ2ZsZHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjg3MzgsImV4cCI6MjA5NzgwNDczOH0.zQASySR7h7iXnqqPahzPQNnIQnCSQ4Tpxk1ujtf59U4';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const id=new URLSearchParams(location.search).get('id');
const loading=document.getElementById('portalLoading'),pending=document.getElementById('portalPending'),rejected=document.getElementById('portalRejected'),accepted=document.getElementById('portalAccepted'),errorBox=document.getElementById('portalError'),toast=document.getElementById('toast');
function showToast(t){toast.textContent=t;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2800)}
function showOnly(el){[loading,pending,rejected,accepted,errorBox].forEach(x=>x.hidden=true);el.hidden=false}
function parseDishes(text){return text.split('\n').map(x=>x.trim()).filter(Boolean).map(line=>{const [name,...rest]=line.split('|');return{name:(name||'').trim(),price:rest.join('|').trim()}}).filter(x=>x.name)}
function dishesText(d){return Array.isArray(d)?d.map(x=>`${x.name||''}${x.price?` | ${x.price}`:''}`).join('\n'):''}
async function loadPortal(){
  if(!id){showOnly(errorBox);errorBox.textContent='الرابط غير صالح.';return}
  const {data,error}=await db.rpc('chef_portal_status',{p_chef_id:id});
  if(error||!data||!data.length){showOnly(errorBox);errorBox.textContent='تعذر التحقق من هذا الرابط.';return}
  const c=data[0];
  if(c.status==='pending'){showOnly(pending);return}
  if(c.status==='rejected'){showOnly(rejected);return}
  if(c.status!=='active'){showOnly(errorBox);errorBox.textContent='حالة الطلب غير متاحة حاليًا.';return}
  showOnly(accepted);
  document.getElementById('portalChefName').textContent=`${c.gender==='m'?'عمّي':'أمّي'} ${c.name||''}`;
  document.getElementById('portalBio').value=c.bio||'';
  document.getElementById('portalSpecialty').value=c.specialty||'';
  document.getElementById('portalDishes').value=dishesText(c.dishes);
  document.getElementById('portalDays').value=c.work_days||'';
  document.getElementById('portalHours').value=c.work_hours||'';
  document.getElementById('portalFulfilment').value=c.fulfilment_type||'pickup';
  document.getElementById('portalDeliveryBy').value=c.delivery_by||'none';
}
document.getElementById('portalSaveBtn').addEventListener('click',async()=>{
  const btn=document.getElementById('portalSaveBtn');
  const bio=document.getElementById('portalBio').value.trim();
  const specialty=document.getElementById('portalSpecialty').value.trim();
  const dishes=parseDishes(document.getElementById('portalDishes').value);
  const workDays=document.getElementById('portalDays').value.trim();
  const workHours=document.getElementById('portalHours').value.trim();
  const fulfilment=document.getElementById('portalFulfilment').value;
  const deliveryBy=document.getElementById('portalDeliveryBy').value;
  if(!bio||!specialty||!dishes.length||!workDays||!workHours){showToast('أكملي بيانات المطبخ الأساسية.');return}
  btn.disabled=true;btn.textContent='جاري الإرسال...';
  const {error}=await db.rpc('chef_portal_save',{p_chef_id:id,p_bio:bio,p_specialty:specialty,p_dishes:dishes,p_work_days:workDays,p_work_hours:workHours,p_fulfilment_type:fulfilment,p_delivery_by:deliveryBy});
  btn.disabled=false;btn.textContent='إرسال المطبخ للمراجعة';
  if(error){showToast('تعذر حفظ بيانات المطبخ.');return}
  showToast('تم إرسال مطبخك للمراجعة.');
});
loadPortal();