# Ommi Food — MVP

**من مطبخ أمهاتنا إلى قلب بيتك**

---

## الملفات

```
ommi-food/
├── index.html      ← الهيكل
├── style.css       ← التصميم
├── app.js          ← المنطق والبيانات
├── vercel.json     ← إعدادات Vercel
└── README.md
```

---

## النشر على Vercel — 3 خطوات

### الطريقة الأولى: عبر GitHub (موصى بها)

1. ارفع المجلد على GitHub كـ repository جديد
2. افتح vercel.com وسجّل الدخول
3. اضغط **Add New Project** ← اختر الـ repository
4. اضغط **Deploy** — بدون أي إعدادات إضافية

### الطريقة الثانية: عبر Vercel CLI

```bash
npm i -g vercel
cd ommi-food
vercel
```

---

## ربط الدومين ommifood.com

بعد النشر على Vercel:

1. افتح Project Settings ← Domains
2. أضف: `ommifood.com` و `www.ommifood.com`
3. عند مزود الدومين أضف:
   - **A Record**: `@` ← `76.76.21.21`
   - **CNAME**: `www` ← `cname.vercel-dns.com`
4. انتظر 10–30 دقيقة للانتشار

---

## تحديث بيانات الطاهيات

افتح `app.js` وعدّل مصفوفة `CHEFS` في أعلى الملف.

لإضافة طاهية جديدة:

```javascript
{
  id: 6,
  gender: 'f',           // 'f' للمرأة — 'm' للرجل
  name: 'اسم الطاهية',
  avatar: '👩‍🍳',
  city: 'casablanca',    // 'casablanca' أو 'rabat'
  cityLabel: 'الدار البيضاء',
  specialty: 'كسكس — طجين',
  rating: 4.8,
  available: true,
  phone: '212600000006', // بدون + وبدون مسافة
  bio: 'نص قصير عن الطاهية...',
  dishes: [
    { name: 'اسم الطبق', desc: 'وصف مختصر', emoji: '🍲', price: 45 }
  ]
}
```

---

## ملاحظات تقنية

- لا يحتاج Backend
- لا يحتاج npm أو build
- يعمل على جميع المتصفحات الحديثة
- متجاوب مع الهاتف والحاسوب
- زر WhatsApp يفتح محادثة مباشرة مع رسالة جاهزة
