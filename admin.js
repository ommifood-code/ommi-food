const SUPABASE_URL='https://qgblrockjswicegfldzm.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYmxyb2NranN3aWNlZ2ZsZHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjg3MzgsImV4cCI6MjA5NzgwNDczOH0.zQASySR7h7iXnqqPahzPQNnIQnCSQ4Tpxk1ujtf59U4';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const loginView=document.getElementById('adminLogin');
const dashboard=document.getElementById('adminDashboard');
const list=document.getElementById('adminChefList');
const loginError=document.getElementById('adminLoginError');
const toast=document.getElementById('toast');

function escapeHtml(v){return String(v??'').replace(/[&<>'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]))}
function prefix(g){return g==='m'?'عمّي':'أمّي'}
function showToast(text){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),3000)}
function membershipLabel(v){return v==='honorary'?'شرفية':v==='paid'?'مدفوعة':'غير محددة'}
function cityLabel(c){if(c.city_label)return c.city_label;return c.city==='casablanca'?'الدار البيضاء':c.city||'—'}
function formatDate(v){if(!v)return'—';const d=new Date(v);if(Number.isNaN(d.getTime()))return'—';return new Intl.DateTimeFormat('ar-MA',{dateStyle:'medium',timeStyle:'short'}).format(d)}
function hasKitchen(c){const dishes=Array.isArray(c.dishes)?c.dishes:[];return dishes.length>0}
function isPublic(c){return c.status==='active'&&c.membership_status==='active'&&['honorary','paid'].includes(c.membership_type)&&hasKitchen(c)}
function workflowStatus(c){
  if(c.status==='pending')return{label:'طلب جديد · قيد المراجعة',cls:'pending'};
  if(c.status==='rejected')return{label:'مرفوض',cls:'rejected'};
  if(c.status==='active'&&!hasKitchen(c))return{label:'مقبولة · تنتظر إكمال المطبخ',cls:'waiting'};
  if(c.status==='active'&&hasKitchen(c)&&c.membership_status!=='active')return{label:'المطبخ جاهز للمراجعة',cls:'review'};
  if(isPublic(c))return{label:'منشور للزبائن',cls:'active'};
  if(c.status==='active'&&c.membership_status==='suspended')return{label:'معلّق ومخفي',cls:'rejected'};
  return{label:c.status||'—',cls:''};
}

async function verifyAdmin(){
  const {data:{session}}=await db.auth.getSession();
  if(!session){showLogin();return false}
  const {data,error}=await db.rpc('admin_list_chefs');
  if(error){await db.auth.signOut();showLogin('هذا الحساب غير مخول للإدارة.');return false}
  showDashboard(session.user.email);renderChefs(data||[]);return true;
}
function showLogin(message=''){loginView.hidden=false;dashboard.hidden=true;loginError.textContent=message}
function showDashboard(email){loginView.hidden=true;dashboard.hidden=false;document.getElementById('adminIdentity').textContent=email||''}
async function loadAdminChefs(){list.innerHTML='<div class="empty-state loading">جاري تحميل الطلبات...</div>';const {data,error}=await db.rpc('admin_list_chefs');if(error){showToast('تعذر تحميل بيانات الإدارة');return}renderChefs(data||[])}

function lifecycleActions(c){
  if(c.status==='pending')return `<div class="admin-actions"><button class="primary" data-accept>قبول الطلب</button><button class="admin-danger" data-reject>رفض</button></div>`;
  if(c.status==='active'&&!hasKitchen(c)){
    return `<div class="admin-workflow-box"><b>المرحلة الحالية:</b> تنتظر الطاهية إكمال «ابني مطبخك». لا تظهر للزبائن في هذه المرحلة.</div><div class="admin-actions"><button class="admin-secondary" data-membership="honorary" ${c.membership_type==='honorary'?'disabled':''}>عضوية شرفية</button><button class="admin-secondary" data-membership="paid" ${c.membership_type==='paid'?'disabled':''}>عضوية مدفوعة</button></div>`;
  }
  if(c.status==='active'&&hasKitchen(c)){
    const membershipButtons=`<button class="admin-secondary" data-membership="honorary" ${c.membership_type==='honorary'?'disabled':''}>عضوية شرفية</button><button class="admin-secondary" data-membership="paid" ${c.membership_type==='paid'?'disabled':''}>عضوية مدفوعة</button>`;
    const stateButton=c.membership_status==='active'?'<button class="admin-danger" data-suspend>تعليق وإخفاء</button>':'<button class="primary" data-reactivate>نشر المطبخ</button>';
    return `<div class="admin-actions">${membershipButtons}${stateButton}</div>`;
  }
  return '';
}

function renderChefs(rows){
  const pending=rows.filter(c=>c.status==='pending').length;
  const active=rows.filter(c=>isPublic(c)).length;
  document.getElementById('pendingCount').textContent=pending;
  document.getElementById('activeCount').textContent=active;
  if(!rows.length){list.innerHTML='<div class="empty-state"><strong>لا توجد طلبات بعد.</strong><span>طلبات الانضمام الجديدة ستظهر هنا.</span></div>';return}
  list.innerHTML=rows.map(c=>{const wf=workflowStatus(c);return `<article class="admin-chef-card" data-id="${c.id}">
    <div class="admin-chef-top"><div><h3>${prefix(c.gender)} ${escapeHtml(c.name)}</h3><p>${escapeHtml(c.area||'الحي غير مسجل')}</p></div><span class="admin-badge ${wf.cls}">${wf.label}</span></div>
    <div class="admin-details admin-details-grid">
      <span><b>الهاتف</b>${escapeHtml(c.phone||'—')}</span>
      <span><b>المدينة</b>${escapeHtml(cityLabel(c))}</span>
      <span><b>الحي / المنطقة</b>${escapeHtml(c.area||'—')}</span>
      <span><b>تاريخ الطلب</b>${escapeHtml(formatDate(c.created_at))}</span>
      <span><b>العضوية</b>${membershipLabel(c.membership_type)}</span>
      <span><b>الظهور للزبائن</b>${isPublic(c)?'منشور':'مخفي'}</span>
    </div>
    <div class="admin-stage-line"><span><b>قبول الطاهية:</b> ${c.status==='pending'?'ينتظر القرار':c.status==='rejected'?'مرفوضة':'مقبولة'}</span><span><b>إكمال المطبخ:</b> ${hasKitchen(c)?'مكتمل مبدئيًا':'غير مكتمل'}</span><span><b>النشر:</b> ${isPublic(c)?'منشور':'غير منشور'}</span></div>
    ${c.bio?`<div class="admin-bio"><b>نبذة الطلب</b><p>${escapeHtml(c.bio)}</p></div>`:'<div class="admin-bio muted"><b>نبذة الطلب</b><p>لم تُكتب نبذة في الطلب الأولي.</p></div>'}
    ${c.rejection_reason?`<p class="admin-reason"><b>سبب الرفض:</b> ${escapeHtml(c.rejection_reason)}</p>`:''}
    ${lifecycleActions(c)}
  </article>`}).join('');
  list.querySelectorAll('[data-accept]').forEach(btn=>btn.addEventListener('click',()=>acceptChef(btn.closest('[data-id]').dataset.id,btn)));
  list.querySelectorAll('[data-reject]').forEach(btn=>btn.addEventListener('click',()=>rejectChef(btn.closest('[data-id]').dataset.id,btn)));
  list.querySelectorAll('[data-membership]').forEach(btn=>btn.addEventListener('click',()=>changeMembership(btn.closest('[data-id]').dataset.id,btn.dataset.membership,btn)));
  list.querySelectorAll('[data-suspend]').forEach(btn=>btn.addEventListener('click',()=>suspendChef(btn.closest('[data-id]').dataset.id,btn)));
  list.querySelectorAll('[data-reactivate]').forEach(btn=>btn.addEventListener('click',()=>reactivateChef(btn.closest('[data-id]').dataset.id,btn)));
}

async function acceptChef(id,btn){
  if(!confirm('قبول طلب الانضمام؟ سيبقى المطبخ مخفيًا إلى أن تُكمل الطاهية بياناته وتتم مراجعته.'))return;
  btn.disabled=true;
  const {error:approveError}=await db.rpc('approve_chef',{chef_id:id,new_membership_type:'honorary'});
  if(approveError){btn.disabled=false;showToast('تعذر قبول الطلب');return}
  const {error:suspendError}=await db.rpc('suspend_chef',{chef_id:id});
  btn.disabled=false;
  if(suspendError){showToast('تم القبول، لكن تعذر إبقاء المطبخ مخفيًا. راجع الحالة فورًا.');await loadAdminChefs();return}
  showToast('تم قبول الطلب. المطبخ مخفي حتى يكتمل ويُراجع.');await loadAdminChefs();
}
async function rejectChef(id,btn){const reason=prompt('سبب الرفض:');if(reason===null)return;if(!reason.trim()){showToast('اكتب سبب الرفض');return}btn.disabled=true;const {error}=await db.rpc('reject_chef',{chef_id:id,reason:reason.trim()});btn.disabled=false;if(error){showToast('تعذر رفض الملف');return}showToast('تم رفض الطلب');await loadAdminChefs()}
async function changeMembership(id,type,btn){const label=type==='honorary'?'الشرفية':'المدفوعة';if(!confirm(`تعيين العضوية ${label}؟ لن يؤدي هذا وحده إلى نشر مطبخ غير مكتمل.`))return;btn.disabled=true;const {error}=await db.rpc('set_chef_membership',{chef_id:id,new_membership_type:type});btn.disabled=false;if(error){showToast('تعذر تغيير العضوية');return}if(!hasKitchen((await currentChef(id))||{})){await db.rpc('suspend_chef',{chef_id:id})}showToast(`تم تعيين العضوية ${label}`);await loadAdminChefs()}
async function currentChef(id){const {data}=await db.rpc('admin_list_chefs');return(data||[]).find(c=>String(c.id)===String(id))}
async function suspendChef(id,btn){if(!confirm('تعليق هذا المطبخ وإخفاؤه عن الزبائن؟'))return;btn.disabled=true;const {error}=await db.rpc('suspend_chef',{chef_id:id});btn.disabled=false;if(error){showToast('تعذر تعليق الحساب');return}showToast('تم تعليق المطبخ وإخفاؤه');await loadAdminChefs()}
async function reactivateChef(id,btn){const c=await currentChef(id);if(!c||!hasKitchen(c)){showToast('لا يمكن نشر مطبخ بلا أطباق مكتملة.');return}if(!['honorary','paid'].includes(c.membership_type)){showToast('حدد نوع العضوية قبل النشر.');return}if(!confirm('نشر هذا المطبخ وإظهاره للزبائن؟'))return;btn.disabled=true;const {error}=await db.rpc('reactivate_chef',{chef_id:id});btn.disabled=false;if(error){showToast('تعذر نشر المطبخ');return}showToast('تم نشر المطبخ وأصبح ظاهرًا للزبائن');await loadAdminChefs()}

document.getElementById('adminLoginBtn').addEventListener('click',async()=>{const email=document.getElementById('adminEmail').value.trim();const password=document.getElementById('adminPassword').value;if(!email||!password){loginError.textContent='أدخل البريد وكلمة المرور.';return}const btn=document.getElementById('adminLoginBtn');btn.disabled=true;btn.textContent='جاري الدخول...';loginError.textContent='';const {error}=await db.auth.signInWithPassword({email,password});btn.disabled=false;btn.textContent='دخول';if(error){loginError.textContent='بيانات الدخول غير صحيحة.';return}await verifyAdmin()});
document.getElementById('adminLogoutBtn').addEventListener('click',async()=>{await db.auth.signOut();showLogin()});document.getElementById('adminRefreshBtn').addEventListener('click',loadAdminChefs);document.getElementById('adminPassword').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('adminLoginBtn').click()});verifyAdmin();