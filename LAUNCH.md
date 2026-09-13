# الإطلاق المبسط

القرارات المعتمدة:
- الانطلاقة مجانية، لا عمولة ولا شاشة تحصيل اشتراك. الأساس السابق للاشتراك المستقبلي يبقى غير مفعّل.
- المطبخ يتفعل بالتسجيل، والطلب ينتظر قبول المطبخ. الحصص تخصم عند القبول وتعود مرة واحدة عند الإلغاء.
- التسجيل: الاسم ثم أنثى/ذكر دون اختيار افتراضي، ثم الهاتف والحي والرمز. لا يُستنتج الجنس من الاسم.
- بعد التسجيل لوحة بثلاثة مسارات: إضافة وجبة، الوجبات والطلبات، بيانات المطبخ.
- إضافة وجبة تحفظ وصف الطبق وعرضه المؤقت معًا داخل معاملة واحدة قابلة لإعادة المحاولة دون تكرار.
- دخول المطبخ من القائمة يفتح صفحة الوجبات والطلب مباشرة. التواصل هاتفي أو واتساب بإجراء المستخدم، لا رسالة آلية.
- الشكايات قابلة للمتابعة الإدارية ولا تُحذف مقابل دفع.

العبارات المعتمدة:
- من مطابخ أمهاتنا… أطباق مغربية بطعم البيت.
- حوّلي مهارتك في الطبخ إلى عمل من بيتك.
- شكرًا لاختيارك مطبخًا منزليًا. طلبك يدعم عملًا من البيت.
لا وعود غير مثبتة بالنظافة أو تقييمات مصطنعة.

الموقع:
- اختيار الموقع بإذن المستخدم، أو الحي، أو نقطة على الخريطة.
- الموقع الدقيق محفوظ في جدول خاص ولا يعرض للعامة. الإحداثيات العامة مقربة إلى شبكة ثابتة 0.003 درجة، والقرب مسافة مباشرة تقريبية.
- اختيار نقطة للمطبخ محدود بمنطقة الدار البيضاء في فترة الإطلاق. إحداثيات الزبون لا تخزن في الخادم.
- الخريطة لا تحمل حتى يطلبها المستخدم. رفض الموقع وفشل الخريطة لا يمنعان الطلب بالقائمة.
- النقاط الخضراء تخص المطابخ ذات الوجبات المفتوحة والحصص المتاحة. التجمعات تعرض العدد وتتيح اختيار المطبخ دون تزوير مكانه.
- Leaflet 1.9.4 محفوظ محليًا. خوادم OSM بلا ضمان خدمة؛ الإسناد ظاهر، لا تحميل جماعي أو دون اتصال، والمزوّد قابل للاستبدال في mapConfig.

النقل:
- python scripts/build-static.py ينتج dist/ من الملفات العامة فقط.
- يمكن رفع محتوى dist إلى Cloudflare Pages أو استضافة ملفات ثابتة؛ لا حاجة إلى نقل Supabase.
- حساب Cloudflare لم يُربط بعد؛ المتصفح المتاح واجه تحدي تحقق أمني. لا نشر على Cloudflare ولا تحويل نطاق تم في هذه المرحلة.
- عند الانتقال إلى نطاق مختلف، جلسة الطاهية تحتاج دخولًا جديدًا؛ الطلبات القديمة تبقى في المتصفح على النطاق القديم. احفظ رابط الطلب أو افتحه برمزه على النطاق الجديد. لا تُنقل رموز الجلسات سرًا عبر روابط عامة.
- راجع عناوين إعادة توجيه الإدارة وأصل طلبات رفع الصور على النطاق الجديد قبل تحويل الموقع الرئيسي.

التحقق:
- tests/simple-launch.sql: معاملة اختبار تتراجع بالكامل؛ الموقع الخاص/التقريبي، الصلاحيات، نطاق المدينة، نشر الوجبة مع الطبق، منع التكرار، قبول الطلب والحصص والإلغاء والتعليق.
- tests/meal-ui.cjs: اختبار DOM بمضاعف لخدمة البيانات؛ الإنشاء والحجز والإجمالي والرمز الخاص والقائمة والتحميل الاختياري.
- لا يعوض الاختبار البرمجي اختبار سهولة الاستخدام مع مستخدم فعلي.


## Cook-to-order update — 2026-09-13
Supersedes the scheduled-stock model above. Dish inventory and cook-specified deadlines are removed. A published dish describes a whole priced unit serving an explicit number of people. Customer quantity counts those units, not people; the server snapshots serves, price, quantity and the customer-requested time. The cook accepts that request or declines. Pending requests cease to be acceptable once their requested time passes; this is not a promise of preparation time. No stock allocation or replenishment exists. Ingredients optional. Additional dishes reuse private fulfilment defaults. Existing kitchen workday settings remain informational and do not block requests.
Admin sees pending requests first, age, kitchen phone, and last manual call timestamp. Refresh once per minute only while visible. A call does not accept an order. No background SMS, push or email is claimed. Off-app negotiations remain possible; the app shows the submitted request, and cannot infer changed amounts from a phone call. No commissions or billing activated.
