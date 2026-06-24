/* ============================================================
   Ommi Food v3 — app.js
   Supabase integration: chefs + orders
   ============================================================ */

var SUPABASE_URL = 'https://qgblrockjswicegfldzm.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFnYmxyb2NranN3aWNlZ2ZsZHptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjg3MzgsImV4cCI6MjA5NzgwNDczOH0.zQASySR7h7iXnqqPahzPQNnIQnCSQ4Tpxk1ujtf59U4';

var db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* أطباق افتراضية لكل طاهية (تُضاف لاحقاً في قاعدة البيانات) */
var DEFAULT_DISHES = [
  { name: 'كسكس بالخضر السبع',    desc: 'كسكس مغربي أصيل بالخضر الموسمية',         emoji: '🫕', price: 40 },
  { name: 'طجين الدجاج بالزيتون', desc: 'دجاج بلدي مع الزيتون والليمون المصفّر',   emoji: '🍲', price: 50 },
  { name: 'حريرة مغربية',          desc: 'شوربة التقليدية بالطماطم والعدس',          emoji: '🥣', price: 18 }
];

/* ============================================================
   STATE
   ============================================================ */
var selectedCity  = '';
var selectedChef  = null;
var pendingDish   = null;
var chefGender    = 'f';
var chefsCache    = [];

/* ============================================================
   HELPERS
   ============================================================ */
function prefix(gender) {
  return gender === 'f' ? 'أمّي' : 'عمّي';
}

function stars(r) {
  var s = ''; var f = Math.floor(r);
  for (var i = 0; i < f; i++) s += '★';
  if (r - f >= 0.5) s += '☆';
  return s;
}

function cityLabel(city) {
  var labels = {
    casablanca:  'الدار البيضاء',
    rabat:       'الرباط',
    sale:        'سلا',
    tanger:      'طنجة',
    tetouan:     'تطوان',
    chefchaouen: 'شفشاون',
    alhoceima:   'الحسيمة',
    larache:     'العرائش',
    kenitra:     'القنيطرة',
    settat:      'سطات',
    eljadida:    'الجديدة',
    meknes:      'مكناس',
    fes:         'فاس',
    taza:        'تازة',
    benimelal:   'بني ملال',
    khenifra:    'خنيفرة',
    khouribga:   'خريبكة',
    marrakech:   'مراكش',
    safi:        'آسفي',
    essaouira:   'الصويرة',
    agadir:      'أكادير',
    ouarzazate:  'ورززات',
    oujda:       'وجدة',
    nador:       'الناظور',
    ifrane:      'إفران'
  };
  return labels[city] || city;
}

function generateRef() {
  return 'OF-' + Math.floor(10000 + Math.random() * 90000);
}

function sanitizeName(raw) {
  return raw.replace(/^(أمي|أمّي|امي|عمي|عمّي)\s*/g, '').trim();
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function showPage(name) {
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.remove('active');
  });
  var pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');
  window.scrollTo(0, 0);
}

/* ============================================================
   PAGE 1 — الرئيسية
   ============================================================ */
function goToChefs() {
  var city = document.getElementById('city-select').value;
  if (!city) { alert('الرجاء اختيار المدينة أولاً'); return; }
  selectedCity = city;
  var label = cityLabel(city);
  document.getElementById('chefs-city-label').textContent = label;
  document.getElementById('city-pill').textContent = '📍 ' + label;
  loadChefs();
  showPage('chefs');
}

/* ============================================================
   PAGE 2 — تحميل الطاهيات من Supabase
   ============================================================ */
async function loadChefs() {
  var list = document.getElementById('chefs-list');
  list.innerHTML = '<div class="loading-state"><span class="spin">🍽️</span>جاري تحميل المطابخ...</div>';

  var result = await db
    .from('chefs')
    .select('*')
    .eq('city', selectedCity)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (result.error) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div>'
      + '<div class="empty-title">تعذّر تحميل البيانات. حاول مجدداً.</div></div>';
    return;
  }

  chefsCache = result.data || [];

  if (!chefsCache.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽️</div>'
      + '<div class="empty-title">لا توجد مطابخ متاحة في هذه المدينة حالياً</div>'
      + '<div style="font-size:13px;margin-top:8px;color:var(--ink3)">كن أول من ينضم!</div></div>';
    return;
  }

  list.innerHTML = chefsCache.map(function(c) {
    var pre    = prefix(c.gender);
    var avCls  = c.available ? 's-available' : 's-busy';
    var avTxt  = c.available ? '● متاحة الآن' : '● مشغولة حالياً';
    var avaCls = c.gender === 'm' ? 'male' : '';
    var preCls = c.gender === 'm' ? 'male' : '';
    var ava    = c.avatar || (c.gender === 'f' ? '👩‍🍳' : '👨‍🍳');
    return '<div class="chef-card" onclick="openChef(\'' + c.id + '\')">'
      + '<div class="chef-card-inner">'
      + '<div class="chef-avatar ' + avaCls + '">' + ava + '</div>'
      + '<div class="chef-info">'
      + '<div class="chef-prefix ' + preCls + '">' + pre + '</div>'
      + '<div class="chef-name-text">' + c.name + '</div>'
      + '<div class="chef-specialty">' + (c.specialty || '') + '</div>'
      + '<div class="chef-meta">'
      + '<span class="chef-stars">' + stars(c.rating || 5) + '</span>'
      + '<span class="chef-rating-val">' + (c.rating || 5) + '</span>'
      + '<span class="chef-status ' + avCls + '">' + avTxt + '</span>'
      + '</div></div>'
      + '<div class="chef-arrow">←</div>'
      + '</div></div>';
  }).join('');
}

/* ============================================================
   PAGE 3 — تفاصيل الطاهية
   ============================================================ */
function openChef(id) {
  selectedChef = chefsCache.find(function(c) { return c.id === id; });
  if (!selectedChef) return;

  var pre = prefix(selectedChef.gender);
  var ava = selectedChef.avatar || (selectedChef.gender === 'f' ? '👩‍🍳' : '👨‍🍳');

  document.getElementById('detail-topbar-name').textContent = pre + ' ' + selectedChef.name;
  document.getElementById('d-avatar').textContent  = ava;
  document.getElementById('d-prefix').textContent  = pre;
  document.getElementById('d-name').textContent    = selectedChef.name;
  document.getElementById('d-loc').textContent     = '📍 ' + cityLabel(selectedChef.city);
  document.getElementById('d-stars').textContent   = stars(selectedChef.rating || 5) + '  ' + (selectedChef.rating || 5);
  document.getElementById('d-bio').textContent     = selectedChef.bio || '';
  document.getElementById('d-phone-label').textContent = 'اتصل بـ ' + pre + ' ' + selectedChef.name;

  var badge = document.getElementById('d-status');
  if (selectedChef.available) {
    badge.textContent = '● متاحة الآن'; badge.className = 'chef-hero-status available';
  } else {
    badge.textContent = '● مشغولة حالياً'; badge.className = 'chef-hero-status busy';
  }

  /* أطباق الطاهية — افتراضية في المرحلة الأولى */
  var dishes = selectedChef.dishes || DEFAULT_DISHES;
  document.getElementById('d-dishes').innerHTML = dishes.map(function(d) {
    var safeName = (d.name || '').replace(/'/g, "\\'");
    return '<div class="dish-card">'
      + '<div class="dish-top">'
      + '<div class="dish-emoji">' + (d.emoji || '🍽️') + '</div>'
      + '<div><div class="dish-name">' + d.name + '</div>'
      + '<div class="dish-desc">' + (d.desc || '') + '</div></div>'
      + '</div>'
      + '<div class="dish-footer">'
      + '<div class="dish-price">' + (d.price || '—') + ' <span>درهم</span></div>'
      + '<button class="btn-order" onclick="openOrderModal(\'' + safeName + '\')">'
      + '🛒 طلب الآن</button>'
      + '</div></div>';
  }).join('');

  showPage('detail');
}

/* ============================================================
   MODAL COMMANDE — نافذة الطلب
   ============================================================ */
function openOrderModal(dishName) {
  pendingDish = dishName;
  document.getElementById('modal-dish-tag').textContent = dishName;
  document.getElementById('modal-error').textContent = '';
  document.getElementById('inp-name').value    = '';
  document.getElementById('inp-phone').value   = '';
  document.getElementById('inp-address').value = '';
  document.getElementById('inp-notes').value   = '';
  document.getElementById('order-modal').classList.add('open');
  setTimeout(function(){ document.getElementById('inp-name').focus(); }, 100);
}

function closeOrderModal() {
  document.getElementById('order-modal').classList.remove('open');
  pendingDish = null;
}

async function confirmOrder() {
  var name    = document.getElementById('inp-name').value.trim();
  var phone   = document.getElementById('inp-phone').value.trim();
  var address = document.getElementById('inp-address').value.trim();
  var notes   = document.getElementById('inp-notes').value.trim();
  var errEl   = document.getElementById('modal-error');

  if (!name)    { errEl.textContent = 'الرجاء إدخال اسمك الكامل';     return; }
  if (!phone)   { errEl.textContent = 'الرجاء إدخال رقم هاتفك';       return; }
  if (!address) { errEl.textContent = 'الرجاء إدخال عنوانك أو حيّك'; return; }
  errEl.textContent = '';

  var ref = generateRef();
  var pre = prefix(selectedChef.gender);

  /* حفظ الطلب في Supabase */
  await db.from('orders').insert({
    order_ref:        ref,
    chef_id:          selectedChef.id,
    chef_name:        pre + ' ' + selectedChef.name,
    dish_name:        pendingDish,
    customer_name:    name,
    customer_phone:   phone,
    customer_address: address,
    notes:            notes || null,
    status:           'whatsapp_sent'
  });

  /* بناء رسالة WhatsApp */
  var msg = 'السلام عليكم ' + pre + ' ' + selectedChef.name + '،\n\n'
    + '🔖 رقم الطلب: ' + ref + '\n\n'
    + '🍽️ الطبق: ' + pendingDish + '\n'
    + '👤 الاسم: ' + name + '\n'
    + '📞 الهاتف: ' + phone + '\n'
    + '📍 العنوان: ' + address
    + (notes ? '\n📝 ملاحظات: ' + notes : '')
    + '\n\n_تم إنشاء هذا الطلب عبر Ommi Food_';

  closeOrderModal();
  window.open('https://wa.me/' + selectedChef.phone + '?text=' + encodeURIComponent(msg), '_blank');
}

/* ============================================================
   MODAL CHEF — تسجيل طاهية جديدة
   ============================================================ */
function openChefModal() {
  document.getElementById('chef-modal').classList.add('open');
  document.getElementById('chef-modal-error').textContent = '';
  document.getElementById('chef-modal-success').style.display = 'none';
  document.getElementById('chef-submit-btn').style.display = 'block';
}

function closeChefModal() {
  document.getElementById('chef-modal').classList.remove('open');
}

function setChefGender(g) {
  chefGender = g;
  document.getElementById('go-f').className = 'gender-opt' + (g === 'f' ? ' active' : '');
  document.getElementById('go-m').className = 'gender-opt' + (g === 'm' ? ' active' : '');
  updateChefPreview();
}

function updateChefPreview() {
  var raw  = document.getElementById('c-name').value;
  var name = sanitizeName(raw) || (chefGender === 'f' ? 'فاطمة' : 'كريم');
  document.getElementById('chef-preview').textContent = prefix(chefGender) + ' ' + name;
}

async function submitChef() {
  var name      = sanitizeName(document.getElementById('c-name').value.trim());
  var phone     = document.getElementById('c-phone').value.trim();
  var city      = document.getElementById('c-city').value;
  var specialty = document.getElementById('c-specialty').value.trim();
  var bio       = document.getElementById('c-bio').value.trim();
  var errEl     = document.getElementById('chef-modal-error');

  if (!name)      { errEl.textContent = 'الرجاء إدخال اسمك';        return; }
  if (!phone)     { errEl.textContent = 'الرجاء إدخال رقم WhatsApp'; return; }
  if (!city)      { errEl.textContent = 'الرجاء اختيار المدينة';     return; }
  if (!specialty) { errEl.textContent = 'الرجاء إدخال تخصصك';       return; }
  errEl.textContent = '';

  document.getElementById('chef-submit-btn').textContent = '...جاري الإرسال';
  document.getElementById('chef-submit-btn').disabled = true;

  var result = await db.from('chefs').insert({
    name:       name,
    gender:     chefGender,
    phone:      phone,
    city:       city,
    city_label: cityLabel(city),
    specialty:  specialty,
    bio:        bio || null,
    status:     'pending'
  });

  document.getElementById('chef-submit-btn').textContent = 'إرسال طلب الانضمام';
  document.getElementById('chef-submit-btn').disabled = false;

  if (result.error) {
    errEl.textContent = 'حدث خطأ. حاول مجدداً.';
    return;
  }

  document.getElementById('chef-modal-success').style.display = 'block';
  document.getElementById('chef-submit-btn').style.display = 'none';
}

/* ============================================================
   اتصال مباشر
   ============================================================ */
function callChef() {
  if (!selectedChef) return;
  window.location.href = 'tel:+' + selectedChef.phone;
}

/* ============================================================
   إغلاق المودال بالضغط خارجه أو بـ Escape
   ============================================================ */
['order-modal', 'chef-modal'].forEach(function(id) {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === this) {
      if (id === 'order-modal') closeOrderModal();
      else closeChefModal();
    }
  });
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeOrderModal(); closeChefModal(); }
});

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener('load', function() {
  setTimeout(function() {
    document.getElementById('loader').classList.add('hidden');
    showPage('home');
  }, 800);
});

/* ============================================================
   ADMIN — لوحة التحكم
   ============================================================ */

/* كلمة المرور اليومية المتغيرة */
function getAdminPassword() {
  var d = new Date();
  var day  = String(d.getDate()).padStart(2,'0');
  var year = String(d.getFullYear()).slice(-2);
  return 'ommi' + day + year;
}

function adminLogin() {
  var pass  = document.getElementById('admin-pass').value;
  var errEl = document.getElementById('login-error');
  if (pass === getAdminPassword()) {
    sessionStorage.setItem('ommi_admin', '1');
    errEl.textContent = '';
    loadAdminData();
    showPage('admin');
  } else {
    errEl.textContent = 'كلمة المرور غير صحيحة';
  }
}

function adminLogout() {
  sessionStorage.removeItem('ommi_admin');
  showPage('home');
}

function openAdmin() {
  if (sessionStorage.getItem('ommi_admin') === '1') {
    loadAdminData();
    showPage('admin');
  } else {
    showPage('admin-login');
    setTimeout(function(){ document.getElementById('admin-pass').focus(); }, 100);
  }
}

/* ---- تحميل البيانات ---- */
async function loadAdminData() {
  var [chefsRes, ordersRes] = await Promise.all([
    db.from('chefs').select('*').order('created_at', { ascending: false }),
    db.from('orders').select('*').order('created_at', { ascending: false })
  ]);

  var chefs  = chefsRes.data  || [];
  var orders = ordersRes.data || [];

  /* KPIs */
  document.getElementById('kpi-total-chefs').textContent  = chefs.length;
  document.getElementById('kpi-active-chefs').textContent = chefs.filter(function(c){ return c.status==='active'; }).length;
  document.getElementById('kpi-pending-chefs').textContent= chefs.filter(function(c){ return c.status==='pending'; }).length;
  document.getElementById('kpi-total-orders').textContent = orders.length;

  renderAdminChefs(chefs);
  renderAdminOrders(orders);
  renderAdminCities(orders);
}

/* ---- الطاهيات ---- */
function renderAdminChefs(chefs) {
  var el = document.getElementById('admin-chefs-list');
  if (!chefs.length) { el.innerHTML = '<div class="admin-empty">لا توجد طاهيات بعد</div>'; return; }
  el.innerHTML = chefs.map(function(c) {
    var pre    = c.gender === 'f' ? 'أمّي' : 'عمّي';
    var badge  = '<span class="badge badge-' + c.status + '">' + c.status + '</span>';
    var btns   = '';
    if (c.status === 'pending')
      btns += '<button class="admin-btn btn-approve" onclick="chefAction(\'' + c.id + '\',\'active\')">✓ موافقة</button>';
    if (c.status === 'active')
      btns += '<button class="admin-btn btn-hide" onclick="chefAction(\'' + c.id + '\',\'inactive\')">إخفاء</button>';
    if (c.status === 'inactive')
      btns += '<button class="admin-btn btn-show" onclick="chefAction(\'' + c.id + '\',\'active\')">إظهار</button>';
    btns += '<button class="admin-btn btn-delete" onclick="chefDelete(\'' + c.id + '\')">حذف</button>';
    return '<div class="admin-row chefs-header">'
      + '<div><strong>' + pre + ' ' + c.name + '</strong><div style="font-size:11px;color:#888">📞 ' + c.phone + '</div></div>'
      + '<div>' + cityLabel(c.city) + '</div>'
      + '<div style="font-size:12px">' + (c.specialty || '—') + '</div>'
      + '<div>' + badge + '</div>'
      + '<div class="admin-actions">' + btns + '</div>'
      + '</div>';
  }).join('');
}

async function chefAction(id, status) {
  await db.from('chefs').update({ status: status }).eq('id', id);
  loadAdminData();
}

async function chefDelete(id) {
  if (!confirm('حذف هذه الطاهية نهائياً؟')) return;
  await db.from('chefs').delete().eq('id', id);
  loadAdminData();
}

/* ---- الطلبات ---- */
function renderAdminOrders(orders) {
  var el = document.getElementById('admin-orders-list');
  if (!orders.length) { el.innerHTML = '<div class="admin-empty">لا توجد طلبات بعد</div>'; return; }
  el.innerHTML = orders.map(function(o) {
    var d = new Date(o.created_at);
    var time = d.toLocaleDateString('ar-MA') + ' ' + d.toLocaleTimeString('ar-MA', {hour:'2-digit',minute:'2-digit'});
    return '<div class="admin-row orders-header">'
      + '<div><strong style="color:#B03A2E">' + o.order_ref + '</strong><div style="font-size:10px;color:#888">' + time + '</div></div>'
      + '<div><div>' + o.dish_name + '</div><div style="font-size:11px;color:#888">' + (o.chef_name||'—') + '</div></div>'
      + '<div><div>' + o.customer_name + '</div><div style="font-size:11px;color:#888">📞 ' + o.customer_phone + '</div></div>'
      + '<div style="font-size:12px">📍 ' + o.customer_address + '</div>'
      + '<div><span class="badge badge-sent">WhatsApp</span></div>'
      + '</div>';
  }).join('');
}

/* ---- إحصائيات المدن ---- */
function renderAdminCities(orders) {
  var el = document.getElementById('admin-cities-list');
  if (!orders.length) { el.innerHTML = '<div class="admin-empty">لا توجد طلبات بعد</div>'; return; }
  var counts = {};
  orders.forEach(function(o) {
    var city = o.customer_address || 'غير محدد';
    counts[city] = (counts[city] || 0) + 1;
  });
  var sorted = Object.entries(counts).sort(function(a,b){ return b[1]-a[1]; });
  el.innerHTML = sorted.map(function(e) {
    return '<div class="city-stat-card">'
      + '<div class="city-stat-name">' + e[0] + '</div>'
      + '<div class="city-stat-count">' + e[1] + '</div>'
      + '<div class="city-stat-label">طلب</div>'
      + '</div>';
  }).join('');
}

/* ---- التبويبات ---- */
function switchTab(name) {
  document.querySelectorAll('.admin-panel').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.admin-tab').forEach(function(t){ t.classList.remove('active'); });
  document.getElementById('tab-' + name).classList.add('active');
  event.target.classList.add('active');
}

/* رابط الإدارة السري */
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.shiftKey && e.key === 'A') openAdmin();
});
