const SUPABASE_URL='https://qgblrockjswicegfldzm.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYmxyb2NranN3aWNlZ2ZsZHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjg3MzgsImV4cCI6MjA5NzgwNDczOH0.zQASySR7h7iXnqqPahzPQNnIQnCSQ4Tpxk1ujtf59U4';
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

const loginView=document.getElementById('adminLogin');
const dashboard=document.getElementById('adminDashboard');
const list=document.getElementById('adminChefList');
const loginError=document.getElementById('adminLoginError');
const toast=document.getElementById('toast');

function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]))}
function prefix(g){return g==='m'?'عمّي':'أمّي'}
function showToast(text){toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600)}
function membershipLabel(v){return v==='honorary'?'شرفية':v==='paid'?'مدفوعة':'بدون عضوية'}
function statusLabel(v){return v==='pending'?'قيد المراجعة':v==='active'?'مقبول':v==='rejected'?'مرفوض':v}

async function verifyAdmin(){
  const {data:{session}}=await db.auth.getSession();
  if(!session){showLogin();return false}
  const {data,error}=await db.rpc('admin_list_chefs');
  if(error){await db.auth.signOut();showLogin('هذا الحساب غير مخول للإدارة.');return false}
  showDashboard(session.user.email);
  renderChefs(data||[]);
  return true;
}

function showLogin(message=''){
  loginView.hidden=false;dashboard.hidden=true;loginError.textContent=message;
}
function showDashboard(email){
  loginView.hidden=true;dashboard.hidden=false;document.getElementById('adminIdentity').textContent=email||'';
}

async function loadAdminChefs(){
  list.innerHTML='<div class="empty-state loading">جاري تحميل الطلبات...</div>';
  const {data,error}=await db.rpc('admin_list_chefs');
  if(error){showToast('تعذر تحميل بيانات الإدارة');return}
  renderChefs(data||[]);
}

function renderChefs(rows){
  const pending=rows.filter(c=>c.status==='pending').length;
  const active=rows.filter(c=>c.status==='active'&&c.membership_status==='active').length;
  document.getElementById('pendingCount').textContent=pending;
  document.getElementById('activeCount').textContent=active;
  if(!rows.length){list.innerHTML='<div class="empty-state"><strong>لا توجد طلبات بعد.</strong><span>طلبات الانضمام الجديدة ستظهر هنا.</span></div>';return}
  list.innerHTML=rows.map(c=>`<article class="admin-chef-card" data-id="${c.id}">
    <div class="admin-chef-top"><div><h3>${prefix(c.gender)} ${escapeHtml(c.name)}</h3><p>${escapeHtml(c.specialty||'بدون تخصص')}</p></div><span class="admin-badge ${escapeHtml(c.status)}">${statusLabel(c.status)}</span></div>
    <div class="admin-details"><span><b>الهاتف:</b> ${escapeHtml(c.phone||'—')}</span><span><b>المدينة:</b> ${escapeHtml(c.city||'—')}</span><span><b>العضوية:</b> ${membershipLabel(c.membership_type)}</span></div>
    ${c.bio?`<p class="admin-bio">${escapeHtml(c.bio)}</p>`:''}
    ${c.rejection_reason?`<p class="admin-reason"><b>سبب الرفض:</b> ${escapeHtml(c.rejection_reason)}</p>`:''}
    ${c.status==='pending'?`<div class="admin-actions"><button class="primary" data-approve="honorary">قبول · عضوية شرفية</button><button class="primary" data-approve="paid">قبول · عضوية مدفوعة</button><button class="admin-danger" data-reject>رفض</button></div>`:''}
  </article>`).join('');

  list.querySelectorAll('[data-approve]').forEach(btn=>btn.addEventListener('click',()=>approveChef(btn.closest('[data-id]').dataset.id,btn.dataset.approve,btn)));
  list.querySelectorAll('[data-reject]').forEach(btn=>btn.addEventListener('click',()=>rejectChef(btn.closest('[data-id]').dataset.id,btn)));
}

async function approveChef(id,type,btn){
  const label=type==='honorary'?'الشرفية':'المدفوعة';
  if(!confirm(`تأكيد قبول هذا الملف بالعضوية ${label}؟`))return;
  btn.disabled=true;
  const {error}=await db.rpc('approve_chef',{chef_id:id,new_membership_type:type});
  btn.disabled=false;
  if(error){showToast('تعذر قبول الملف');return}
  showToast(`تم القبول وتفعيل العضوية ${label}`);await loadAdminChefs();
}

async function rejectChef(id,btn){
  const reason=prompt('سبب الرفض:');
  if(reason===null)return;
  if(!reason.trim()){showToast('اكتب سبب الرفض');return}
  btn.disabled=true;
  const {error}=await db.rpc('reject_chef',{chef_id:id,reason:reason.trim()});
  btn.disabled=false;
  if(error){showToast('تعذر رفض الملف');return}
  showToast('تم رفض الطلب');await loadAdminChefs();
}

document.getElementById('adminLoginBtn').addEventListener('click',async()=>{
  const email=document.getElementById('adminEmail').value.trim();
  const password=document.getElementById('adminPassword').value;
  if(!email||!password){loginError.textContent='أدخل البريد وكلمة المرور.';return}
  const btn=document.getElementById('adminLoginBtn');btn.disabled=true;btn.textContent='جاري الدخول...';loginError.textContent='';
  const {error}=await db.auth.signInWithPassword({email,password});
  btn.disabled=false;btn.textContent='دخول';
  if(error){loginError.textContent='بيانات الدخول غير صحيحة.';return}
  await verifyAdmin();
});

document.getElementById('adminLogoutBtn').addEventListener('click',async()=>{await db.auth.signOut();showLogin()});
document.getElementById('adminRefreshBtn').addEventListener('click',loadAdminChefs);
document.getElementById('adminPassword').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('adminLoginBtn').click()});
verifyAdmin();
