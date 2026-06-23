/* ============================================================
   Ommi Food — app.js
   لتعديل بيانات الطاهيات: عدّل مصفوفة CHEFS أدناه فقط
   ============================================================ */

var CHEFS = [
  {
    id: 1,
    gender: 'f',
    name: 'فاطمة الزهراء',
    avatar: '👩‍🍳',
    city: 'casablanca',
    cityLabel: 'الدار البيضاء',
    specialty: 'كسكس — طجين — حريرة',
    rating: 4.9,
    available: true,
    phone: '212600000001',
    bio: 'أطبخ منذ أكثر من عشرين سنة. تعلمت الطبخ من والدتي رحمها الله. كسكس الجمعة وطجين الدجاج بالزيتون هما تخصصاي الأول.',
    dishes: [
      { name: 'كسكس بالخضر السبع',     desc: 'كسكس مغربي أصيل بالخضر الموسمية والمرق الدسم',        emoji: '🫕', price: 40 },
      { name: 'طجين الدجاج بالزيتون',  desc: 'دجاج بلدي مع الزيتون والليمون المصفّر',               emoji: '🍲', price: 50 },
      { name: 'حريرة مغربية',           desc: 'شوربة الحريرة التقليدية بالطماطم والعدس والكزبرة',    emoji: '🥣', price: 18 }
    ]
  },
  {
    id: 2,
    gender: 'f',
    name: 'خديجة البوعناني',
    avatar: '🧕',
    city: 'casablanca',
    cityLabel: 'الدار البيضاء',
    specialty: 'بسطيلة — مروزية — حلويات',
    rating: 5.0,
    available: false,
    phone: '212600000002',
    bio: 'متخصصة في أطباق المناسبات المغربية. البسطيلة بالدجاج والمروزية من أشهر ما أعدّه. أستخدم مكونات طبيعية فقط.',
    dishes: [
      { name: 'بسطيلة بالدجاج',   desc: 'فطيرة ورقية بحشو الدجاج واللوز والبيض والقرفة',        emoji: '🥐', price: 65 },
      { name: 'مروزية اللحم',      desc: 'لحم الضأن المطهو ببطء مع العسل والمشمش المجفف واللوز', emoji: '🍖', price: 70 },
      { name: 'شباكية بالعسل',     desc: 'معجنات مغربية محلاة بالعسل الطبيعي ومزينة بالسمسم',   emoji: '🍯', price: 25 }
    ]
  },
  {
    id: 3,
    gender: 'm',
    name: 'كريم الناصري',
    avatar: '👨‍🍳',
    city: 'casablanca',
    cityLabel: 'الدار البيضاء',
    specialty: 'كفتة — مشاوي — طجين',
    rating: 4.7,
    available: true,
    phone: '212600000003',
    bio: 'أطبخ المشاوي المغربية وأطباق اللحم منذ خمس عشرة سنة. كفتة الكشة والطجين بالبرقوق من تخصصاتي.',
    dishes: [
      { name: 'كفتة الكشة',               desc: 'كرات اللحم المفروم بالبهارات المغربية في صلصة الطماطم', emoji: '🍢', price: 45 },
      { name: 'طجين الخروف بالبرقوق',      desc: 'لحم الخروف مع البرقوق والسمسم والعسل',                emoji: '🍲', price: 60 },
      { name: 'الدجاج المشوي بالشرمولة',  desc: 'دجاج بلدي متبّل بالشرمولة المغربية ومشوي على الجمر', emoji: '🍗', price: 55 }
    ]
  },
  {
    id: 4,
    gender: 'f',
    name: 'مريم البقالي',
    avatar: '👵',
    city: 'rabat',
    cityLabel: 'الرباط',
    specialty: 'كسكس — رفيسة — بغرير',
    rating: 4.8,
    available: true,
    phone: '212600000004',
    bio: 'ربة بيت منذ ثلاثين سنة. أطبخ وصفات جدتي التي تعود إلى مدينة الرباط العريقة. الرفيسة وبغرير الصباح من أشهر طلباتي.',
    dishes: [
      { name: 'رفيسة بالدجاج والعدس',    desc: 'طبق رباطي أصيل بالفلفل والكمون وورق الحلبة',                  emoji: '🫕', price: 45 },
      { name: 'بغرير الصباح',             desc: 'فطائر مغربية إسفنجية تُقدّم مع العسل والزبدة',               emoji: '🥞', price: 20 },
      { name: 'كسكس بالبيض المسلوق',     desc: 'نسخة رباطية من الكسكس مع البيض والزبيب والبصل المكرمل',      emoji: '🍚', price: 40 }
    ]
  },
  {
    id: 5,
    gender: 'm',
    name: 'عبد الرحيم الغازي',
    avatar: '🧔',
    city: 'rabat',
    cityLabel: 'الرباط',
    specialty: 'طجين — كسكس — سلطات',
    rating: 4.6,
    available: false,
    phone: '212600000005',
    bio: 'أطبخ منذ عشر سنوات بعد أن تعلمت من والدتي. أتخصص في الطجين بكل أنواعه والسلطات المغربية المشوية.',
    dishes: [
      { name: 'طجين الكفتة بالبيض',      desc: 'كرات اللحم المطهوة في الطماطم مع البيض والبقدونس',           emoji: '🍳', price: 42 },
      { name: 'سلطة الباذنجان المشوي',    desc: 'باذنجان مشوي بالثوم والكمون والكزبرة وزيت الزيتون',          emoji: '🥗', price: 22 },
      { name: 'كسكس الجمعة',             desc: 'الكسكس التقليدي بسبع خضر وقطع اللحم والمرق',                  emoji: '🫕', price: 45 }
    ]
  }
];

/* ============================================================
   ÉTAT
   ============================================================ */
var selectedCity  = '';
var selectedChef  = null;
var pendingDish   = null;   // الطبق المعلّق عند فتح المودال

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
  var labels = { casablanca: 'الدار البيضاء', rabat: 'الرباط' };
  var label  = labels[city] || city;
  document.getElementById('chefs-city-label').textContent = label;
  document.getElementById('city-pill').textContent = '📍 ' + label;
  renderChefs();
  showPage('chefs');
}

/* ============================================================
   PAGE 2 — قائمة الطاهيين
   ============================================================ */
function stars(r) {
  var s = '';
  var f = Math.floor(r);
  for (var i = 0; i < f; i++) s += '★';
  if (r - f >= 0.5) s += '☆';
  return s;
}

function prefix(gender) {
  return gender === 'f' ? 'أمّي' : 'عمّي';
}

function renderChefs() {
  var list   = document.getElementById('chefs-list');
  var data   = CHEFS.filter(function(c) { return c.city === selectedCity; });
  if (!data.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽️</div>'
      + '<div class="empty-title">لا توجد مطابخ متاحة في هذه المدينة حالياً</div></div>';
    return;
  }
  list.innerHTML = data.map(function(c) {
    var pre     = prefix(c.gender);
    var avCls   = c.available ? 's-available' : 's-busy';
    var avTxt   = c.available ? '● متاحة الآن' : '● مشغولة حالياً';
    var avaCls  = c.gender === 'm' ? 'male' : '';
    var preCls  = c.gender === 'm' ? 'male' : '';
    var avatarContent = c.photo
      ? '<img src="' + c.photo + '" alt="' + c.name + '"/>'
      : c.avatar;
    return '<div class="chef-card" onclick="openChef(' + c.id + ')" role="button" tabindex="0">'
      + '<div class="chef-card-inner">'
      + '<div class="chef-avatar ' + avaCls + '">' + avatarContent + '</div>'
      + '<div class="chef-info">'
      + '<div class="chef-prefix ' + preCls + '">' + pre + '</div>'
      + '<div class="chef-name-text">' + c.name + '</div>'
      + '<div class="chef-specialty">' + c.specialty + '</div>'
      + '<div class="chef-meta">'
      + '<span class="chef-stars">' + stars(c.rating) + '</span>'
      + '<span class="chef-rating-val">' + c.rating + '</span>'
      + '<span class="chef-status ' + avCls + '">' + avTxt + '</span>'
      + '</div></div>'
      + '<div class="chef-arrow">←</div>'
      + '</div></div>';
  }).join('');
}

/* ============================================================
   PAGE 3 — تفاصيل المطبخ
   ============================================================ */
function openChef(id) {
  selectedChef = CHEFS.find(function(c) { return c.id === id; });
  if (!selectedChef) return;

  var pre = prefix(selectedChef.gender);
  var avatarContent = selectedChef.photo
    ? '<img src="' + selectedChef.photo + '" alt="' + selectedChef.name + '"/>'
    : selectedChef.avatar;

  document.getElementById('detail-topbar-name').textContent = pre + ' ' + selectedChef.name;
  document.getElementById('d-avatar').innerHTML = avatarContent;
  document.getElementById('d-prefix').textContent = pre;
  document.getElementById('d-name').textContent   = selectedChef.name;
  document.getElementById('d-loc').textContent    = '📍 ' + selectedChef.cityLabel;
  document.getElementById('d-stars').textContent  = stars(selectedChef.rating) + '  ' + selectedChef.rating;
  document.getElementById('d-bio').textContent    = selectedChef.bio;
  document.getElementById('d-phone-label').textContent = 'اتصل بـ ' + pre + ' ' + selectedChef.name;

  var badge = document.getElementById('d-status');
  if (selectedChef.available) {
    badge.textContent = '● متاحة الآن';
    badge.className   = 'chef-hero-status available';
  } else {
    badge.textContent = '● مشغولة حالياً';
    badge.className   = 'chef-hero-status busy';
  }

  document.getElementById('d-dishes').innerHTML = selectedChef.dishes.map(function(d) {
    var safeName = d.name.replace(/'/g, "\\'");
    return '<div class="dish-card">'
      + '<div class="dish-top">'
      + '<div class="dish-emoji">' + d.emoji + '</div>'
      + '<div>'
      + '<div class="dish-name">' + d.name + '</div>'
      + '<div class="dish-desc">' + d.desc + '</div>'
      + '</div></div>'
      + '<div class="dish-footer">'
      + '<div class="dish-price">' + d.price + ' <span>درهم</span></div>'
      + '<button class="btn-order" onclick="openOrderModal(\'' + safeName + '\')">'
      + '<span>🛒</span> طلب الآن</button>'
      + '</div></div>';
  }).join('');

  showPage('detail');
}

/* ============================================================
   MODAL — نافذة تفاصيل الطلب
   ============================================================ */
function openOrderModal(dishName) {
  pendingDish = dishName;
  document.getElementById('modal-dish-name').textContent = dishName;
  document.getElementById('modal-error').textContent     = '';
  document.getElementById('inp-name').value    = '';
  document.getElementById('inp-phone').value   = '';
  document.getElementById('inp-address').value = '';
  document.getElementById('inp-notes').value   = '';
  document.getElementById('order-modal').classList.add('open');
  document.getElementById('inp-name').focus();
}

function closeModal() {
  document.getElementById('order-modal').classList.remove('open');
  pendingDish = null;
}

/* إغلاق عند الضغط خارج النافذة */
document.getElementById('order-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

/* إغلاق بمفتاح Escape */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeModal();
});

function confirmOrder() {
  var name    = document.getElementById('inp-name').value.trim();
  var phone   = document.getElementById('inp-phone').value.trim();
  var address = document.getElementById('inp-address').value.trim();
  var notes   = document.getElementById('inp-notes').value.trim();
  var errEl   = document.getElementById('modal-error');

  /* التحقق من الحقول الإلزامية */
  if (!name)    { errEl.textContent = 'الرجاء إدخال اسمك الكامل';  return; }
  if (!phone)   { errEl.textContent = 'الرجاء إدخال رقم هاتفك';    return; }
  if (!address) { errEl.textContent = 'الرجاء إدخال عنوانك أو حيّك'; return; }
  errEl.textContent = '';

  /* بناء الرسالة */
  var pre = prefix(selectedChef.gender);
  var msg = 'السلام عليكم ' + pre + ' ' + selectedChef.name + '،\n\n'
    + 'أرغب في طلب عبر منصة Ommi Food:\n\n'
    + '🍽️ الطبق: ' + pendingDish + '\n'
    + '👤 الاسم: ' + name + '\n'
    + '📞 الهاتف: ' + phone + '\n'
    + '📍 العنوان: ' + address
    + (notes ? '\n📝 ملاحظات: ' + notes : '')
    + '\n\nشكراً جزيلاً 🙏';

  closeModal();
  window.open(
    'https://wa.me/' + selectedChef.phone + '?text=' + encodeURIComponent(msg),
    '_blank'
  );
}

/* ============================================================
   اتصال مباشر
   ============================================================ */
function callChef() {
  if (!selectedChef) return;
  window.location.href = 'tel:+' + selectedChef.phone;
}

/* ============================================================
   قاعدة أمّي / عمّي — حذف البادئة المكررة
   (تُستعمل مستقبلاً عند إضافة نموذج تسجيل الطاهية)
   ============================================================ */
function sanitizeName(rawName, gender) {
  var forbidden = /^(أمي|أمّي|امي|عمي|عمّي)\s*/;
  var clean = rawName.replace(forbidden, '').trim();
  return prefix(gender) + ' ' + clean;
}

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener('load', function() {
  setTimeout(function() {
    document.getElementById('loader').classList.add('hidden');
    showPage('home');
  }, 800);
});
