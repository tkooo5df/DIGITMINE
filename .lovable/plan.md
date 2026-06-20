
# بوت تيليجرام متكامل مع المتجر

الهدف: تمكين العملاء من تصفح المنتجات، اختيار عرض، الاطلاع على طرق الدفع، وإرسال صورة الوصل مباشرة من البوت — مع إنشاء طلب حقيقي في قاعدة البيانات يظهر فوراً في لوحة الإدارة (الفواتير + المحادثات) ويُشعِر الأدمن كما هو الحال من الموقع.

## التدفق من جهة المستخدم في البوت

1. `/start` → ترحيب + أزرار: «تصفح المنتجات» / «طلباتي» / «ربط حسابي»
2. «تصفح المنتجات» → قائمة الفئات (inline keyboard) → قائمة المنتجات → تفاصيل المنتج (صورة + وصف مختصر) → اختيار العرض (الأسعار + المدد)
3. عند اختيار عرض: البوت يعرض طرق الدفع المتاحة (CCP, BaridiMob...) مع التعليمات والـ QR
4. المستخدم يضغط «لقد دفعت» → البوت يطلب «أرسل صورة الوصل الآن»
5. المستخدم يرسل الصورة → البوت يقوم بـ:
   - رفع الصورة إلى bucket `receipts`
   - إنشاء `orders` + `payment_receipts` (status: submitted)
   - إشعار الأدمن (نفس قالب `notifyReceipt` الحالي)
   - إرسال تأكيد للمستخدم مع رقم الطلب
6. لاحقاً عند قبول/رفض الأدمن (عبر البوت أو الموقع): إشعار يصل للمستخدم في البوت مع رابط استلام المنتج (للتسليم التلقائي).

## ربط الحساب

كل عملية شراء تحتاج `user_id` (RLS تتطلبه). الحل:
- جدول جديد `telegram_users(chat_id, user_id, linked_at)`
- في `/start` إذا غير مربوط: البوت يعطي رمز ربط (token) ورابط `https://site/link-telegram?token=...`
- المستخدم يفتح الرابط في الموقع (يجب أن يكون مسجلاً) → نربط الـ chat_id بحسابه
- بدلاً من ذلك (أبسط للمستخدم): إنشاء حساب «ضيف» تلقائي من البوت باستخدام email وهمي مبني على chat_id، يمكنه لاحقاً المطالبة به. **سأستخدم الخيار الأول (ربط آمن)** لأنه يحترم نموذج المصادقة الحالي.

## التعديلات على قاعدة البيانات

```sql
-- جدول ربط حسابات تيليجرام
create table public.telegram_users (
  chat_id bigint primary key,
  user_id uuid not null,
  username text,
  first_name text,
  linked_at timestamptz not null default now()
);

-- رموز الربط المؤقتة
create table public.telegram_link_tokens (
  token text primary key,
  chat_id bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used boolean not null default false
);

-- توسيع telegram_admin_state لحفظ حالة المستخدم العادي (محادثة شراء)
alter table public.telegram_admin_state
  add column awaiting_receipt_for_offer uuid,
  add column awaiting_receipt_payment_method text;
-- ملاحظة: سنُعيد تسمية الجدول مفهومياً ليشمل كل المستخدمين (admin + customers)
-- بدون كسر التوافق نُبقي الاسم.

-- RLS: قراءة عامة للمنتجات/العروض/طرق الدفع موجودة بالفعل ✓
-- جدولا telegram_users و telegram_link_tokens: محدودان للأدمن فقط
```

## الملفات

### جديدة
- `src/lib/telegram-shop.server.ts` — منطق عرض المنتجات/العروض/طرق الدفع في البوت
- `src/lib/telegram-purchase.server.ts` — إنشاء الطلب من البوت ورفع الوصل
- `src/routes/link-telegram.tsx` — صفحة في الموقع لإتمام الربط (يجب تسجيل دخول)
- `src/lib/telegram-link.functions.ts` — server function لتأكيد الربط

### تعديل
- `src/routes/api/public/telegram-webhook.ts` — توسيع للتعامل مع:
  - أوامر المستخدم العادي (`/start`, `/products`, `/orders`)
  - callbacks للتنقل (cat:<id>, prod:<id>, offer:<id>, pay:<method>, paid:<offer>)
  - استقبال الصور كوصل دفع
- `src/lib/telegram.server.ts` — إضافة `sendProductCard`, `buildCategoriesKeyboard`, إلخ.

## نقاط تقنية

- استخدام `supabaseAdmin` (service role) داخل الـ webhook لتجاوز RLS عند الإنشاء بالنيابة عن المستخدم المربوط.
- معدّل التحويل: قراءة آخر `exchange_rate`.
- ترقيم الطلب: يستخدم `default` الموجود.
- التسليم التلقائي عند قبول الأدمن: قراءة من `auto_delivery_stock` وإرسال البيانات للمستخدم في البوت.

هل تريد المتابعة بهذا التصميم؟ أم تفضل الخيار الأبسط (إنشاء حساب ضيف تلقائي بدون خطوة ربط)؟
