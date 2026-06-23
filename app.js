var CHEFS = [
  {
    id: 1, gender: 'f', name: 'فاطمة الزهراء', avatar: '👩‍🍳',
    city: 'casablanca', cityLabel: 'الدار البيضاء',
    specialty: 'كسكس — طجين — حريرة',
    rating: 4.9, available: true, phone: '212600000001',
    bio: 'أطبخ منذ أكثر من عشرين سنة. تعلمت الطبخ من والدتي رحمها الله. كسكس الجمعة وطجين الدجاج بالزيتون هما تخصصاي الأول.',
    dishes: [
      { name: 'كسكس بالخضر السبع', desc: 'كسكس مغربي أصيل بالخضر الموسمية والمرق الدسم', emoji: '🫕', price: 40 },
      { name: 'طجين الدجاج بالزيتون', desc: 'دجاج بلدي مع الزيتون والليمون المصفّر', emoji: '🍲', price: 50 },
      { name: 'حريرة مغربية', desc: 'شوربة الحريرة التقليدية بالطماطم والعدس والكزبرة', emoji: '🥣', price: 18 }
    ]
  },
  {
    id: 2, gender: 'f', name: 'خديجة البوعناني', avatar: '🧕',
    city: 'casablanca', cityLabel: 'الدار البيضاء',
    specialty: 'بسطيلة — مروزية — حلويات',
    rating: 5.0, available: false, phone: '212600000002',
    bio: 'متخصصة في أطباق المناسبات المغربية. البسطيلة بالدجاج والمروزية من أشهر ما أعدّه. أستخدم مكونات طبيعية فقط.',
    dishes: [
      { name: 'بسطيلة بالدجاج', desc: 'فطيرة ورقية بحشو الدجاج واللوز والبيض والقرفة', emoji: '🥐', price: 65 },
      { name: 'مروزية اللحم', desc: 'لحم الضأن المطهو ببطء مع العسل والمشمش المجفف واللوز', emoji: '🍖', price: 70 },
      { name: 'شباكية بالعسل', desc: 'معجنات مغربية محلاة بالعسل الطبيعي ومزينة بالسمسم', emoji: '🍯', price: 25 }
    ]
  },
  {
    id: 3, gender: 'm', name: 'كريم الناصري', avatar: '👨‍🍳',
    city: 'casablanca', cityLabel: 'الدار البيضاء',
    specialty: 'كفتة — مشاوي — طجين',
    rating: 4.7, available: true, phone: '212600000003',
    bio: 'أطبخ المشاوي المغربية وأطباق اللحم منذ خمس عشرة سنة. كفتة الكشة والطجين بالبرقوق من تخصصاتي.',
    dishes: [
      { name: 'كفتة الكشة', desc: 'كرات اللحم المفروم بالبهارات المغربية في صلصة الطماطم', emoji: '🍢', price: 45 },
      { name: 'طجين الخروف بالبرقوق', desc: 'لحم الخروف مع البرقوق والسمسم والعسل', emoji: '🍲', price: 60 },
      { name: 'الدجاج المشوي بالشرمولة', desc: 'دجاج بلدي متبّل بالشرمولة المغربية ومشوي على الجمر', emoji: '🍗', price: 55 }
    ]
  },
  {
    id: 4, gender: 'f', name: 'مريم البقالي', avatar: '👵',
    city: 'rabat', cityLabel: 'الرباط',
    specialty: 'كسكس — رفيسة — بغرير',
    rating: 4.8, available: true, phone: '212600000004',
    bio: 'ربة بيت منذ ثلاثين سنة. أطبخ وصفات جدتي التي تعود إلى مدينة الرباط العريقة. الرفيسة وبغرير الصباح من أشهر طلباتي.',
    dishes: [
      { name: 'رفيسة بالدجاج والعدس', desc: 'طبق رباطي أصيل بالفلفل والكمون وورق الحلبة', emoji: '🫕', price: 45 },
      { name: 'بغرير الصباح', desc: 'فطائر مغربية إسفنجية تُقدّم مع العسل والزبدة', emoji: '🥞', price: 20 },
      { name: 'كسكس بالبيض المسلوق', desc: 'نسخة رباطية من الكسكس مع البيض والزبيب والبصل المكرمل', emoji: '🍚', price: 40 }
    ]
  },
  {
    id: 5, gender: 'm', name: 'عبد الرحيم الغازي', avatar: '🧔',
    city: 'rabat', cityLabel: 'الرباط',
    specialty: 'طجين — كسكس — سلطات',
    rating: 4.6, available: false, phone: '212600000005',
    bio: 'أطبخ منذ عشر سنوات بعد أن تعلمت من أمي. أتخصص في الطجين بكل أنواعه والسلطات المغربية المشوية.',
    dishes: [
      { name: 'طجين الكفتة بالبيض', desc: 'كرات اللحم المطهوة في الطماطم مع البيض والبقدونس', emoji: '🍳', price: 42 },
      { name: 'سلطة الباذنجان المشوي', desc: 'باذنجان مشوي بالثوم والكمون والكزبرة وزيت الزيتون', emoji: '🥗', price: 22 },
      { name: 'كسكس الجمعة', desc: 'الكسكس التقليدي بسبع خضر وقطع اللحم والمرق', emoji: '🫕', price: 45 }
    ]
  }
];

var selectedCity = '';
var selectedChef = null;

function showPage(name) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('page-' + name).classList.add('active');
  window.scrollTo(0, 0);
}

function goToChefs() {
  var city = document.getElementById('city-select').value;
  if (!city) { alert('الرجاء اختيار المدينة أولاً'); return; }
  selectedCity = city;
  var labels = { casablanca: 'الدار البيضاء', rabat: 'الرباط' };
  var label = labels[city];
  document.getElementById('chefs-city-label').textContent = label;
  document.getElementById('city-pill').textContent = '📍 ' + label;
  renderChefs();
  showPage('chefs');
}

function stars(r) {
  var s = '';
  var f = Math.floor(r);
  for (var i = 0; i < f; i++) s += '★';
  if (r - f >= 0.5) s += '☆';
  return s;
}

function renderChefs() {
  var list = document.getElementById('chefs-list');
  var data = CHEFS.filter(function(c) { return c.city === selectedCity; });
  if (!data.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🍽️</div><div class="empty-state-title">لا توجد طاهيات متاحات حالياً</div></div>';
    return;
  }
  list.innerHTML = data.map(function(c) {
    var prefix = c.gender === 'f' ? 'أمّي' : 'عمّي';
    var prefixCls = c.gender === 'f' ? '' : 'm';
    var avatarCls = c.gender === 'f' ? '' : 'male';
    var statusCls = c.available ? 's-available' : 's-busy';
    var statusTxt = c.available ? '● متاحة الآن' : '● مشغولة';
    return '<div class="chef-card" onclick="openChef(' + c.id + ')">'
      + '<div class="chef-card-inner">'
      + '<div class="chef-avatar ' + avatarCls + '">' + c.avatar + '</div>'
      + '<div class="chef-info">'
      + '<div class="chef-prefix ' + prefixCls + '">' + prefix + '</div>'
      + '<div class="chef-name-text">' + c.name + '</div>'
      + '<div class="chef-specialty">' + c.specialty + '</div>'
      + '<div class="chef-meta">'
      + '<span class="chef-stars">' + stars(c.rating) + '</span>'
      + '<span class="chef-rating-val">' + c.rating + '</span>'
      + '<span class="chef-status ' + statusCls + '">' + statusTxt + '</span>'
      + '</div></div>'
      + '<div class="chef-arrow">←</div>'
      + '</div></div>';
  }).join('');
}

function openChef(id) {
  selectedChef = CHEFS.find(function(c) { return c.id === id; });
  if (!selectedChef) return;
  var prefix = selectedChef.gender === 'f' ? 'أمّي' : 'عمّي';
  document.getElementById('detail-topbar-name').textContent = prefix + ' ' + selectedChef.name;
  document.getElementById('d-avatar').textContent = selectedChef.avatar;
  document.getElementById('d-prefix').textContent = prefix;
  document.getElementById('d-name').textContent = selectedChef.name;
  document.getElementById('d-loc').textContent = '📍 ' + selectedChef.cityLabel;
  document.getElementById('d-stars').textContent = stars(selectedChef.rating) + ' ' + selectedChef.rating;
  document.getElementById('d-bio').textContent = selectedChef.bio;
  document.getElementById('d-phone-label').textContent = 'اتصل مباشرة — +' + selectedChef.phone;
  var badge = document.getElementById('d-status-badge');
  if (selectedChef.available) {
    badge.textContent = '● متاحة الآن';
    badge.className = 'chef-hero-status available';
  } else {
    badge.textContent = '● مشغولة حالياً';
    badge.className = 'chef-hero-status busy';
  }
  document.getElementById('d-dishes').innerHTML = selectedChef.dishes.map(function(d) {
    return '<div class="dish-card">'
      + '<div class="dish-top">'
      + '<div class="dish-emoji">' + d.emoji + '</div>'
      + '<div><div class="dish-name">' + d.name + '</div><div class="dish-desc">' + d.desc + '</div></div>'
      + '</div>'
      + '<div class="dish-footer">'
      + '<div class="dish-price">' + d.price + ' <span>درهم</span></div>'
      + '<button class="btn-order" onclick="orderDish(\'' + d.name.replace(/'/g, "\\'") + '\')">'
      + '<span>💬</span> طلب الآن</button>'
      + '</div></div>';
  }).join('');
  showPage('detail');
}

function buildMsg(dish) {
  var prefix = selectedChef.gender === 'f' ? 'أمّي' : 'عمّي';
  var base = 'السلام عليكم، أرغب في طلب';
  var from = 'عبر منصة Ommi Food.';
  if (dish) return encodeURIComponent(base + ' طبق "' + dish + '" من ' + prefix + ' ' + selectedChef.name + ' ' + from);
  return encodeURIComponent(base + ' طبق من ' + prefix + ' ' + selectedChef.name + ' ' + from);
}

function openWhatsApp() {
  if (!selectedChef) return;
  window.open('https://wa.me/' + selectedChef.phone + '?text=' + buildMsg(null), '_blank');
}

function orderDish(name) {
  if (!selectedChef) return;
  window.open('https://wa.me/' + selectedChef.phone + '?text=' + buildMsg(name), '_blank');
}

function callChef() {
  if (!selectedChef) return;
  window.location.href = 'tel:+' + selectedChef.phone;
}

window.addEventListener('load', function() {
  setTimeout(function() {
    document.getElementById('loader').classList.add('hidden');
    showPage('home');
  }, 900);
});
