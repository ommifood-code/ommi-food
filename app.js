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
  return city === 'casablanca' ? 'الدار البيضاء' : 'الرباط';
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
