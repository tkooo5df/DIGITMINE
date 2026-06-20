# دليل التطبيق - Family System Implementation Guide

## ملخص التغييرات

تم تطوير نظام جديد لعرض المنتجات بناءً على **العائلات** بدلاً من عرض كل منتج بشكل منفرد. هذا يسمح بتجميع العروض المتعلقة (مثل جميع عروض Netflix) في مكان واحد.

## الملفات المضافة

### 1. مكتبات البيانات
```
src/lib/family-catalog-data.ts
```
- `useFamilyCatalog()`: جلب جميع العائلات مع منتجاتها
- `useFamily()`: جلب عائلة محددة
- `ProductFamily`: نوع البيانات

### 2. المكونات
```
src/components/FamilyCard.tsx
```
- بطاقة العائلة القابلة للتوسع
- عرض المنتجات والعروض عند التوسع
- معاينة الأسعار والمدد

### 3. الصفحات
```
src/routes/admin.families.tsx
```
- لوحة تحكم جديدة لإدارة العائلات
- تعديل العروض مباشرة
- حذف وإظهار/إخفاء العروض

### 4. السكريبتات
```
scripts/import-csv-data.ts
```
- استيراد البيانات من CSV
- تجميع البيانات حسب العائلة
- إنشاء المنتجات والعروض

## الملفات المعدلة

### 1. `src/routes/shop.tsx`
**التغييرات:**
- إضافة `useFamilyCatalog()` لجلب العائلات
- إضافة حالة `viewMode` للتبديل بين العائلات والمنتجات
- إضافة `filteredFamilies` للبحث على مستوى العائلات
- إضافة أزرار التبديل بين الوضعين
- إضافة عرض `FamilyCard` عند اختيار وضع العائلات

**الكود الرئيسي:**
```typescript
const [viewMode, setViewMode] = useState<'products' | 'families'>('families');

const filteredFamilies = useMemo(() => {
  if (!q.trim()) return families;
  const needle = q.toLowerCase().trim();
  return families.filter(f => 
    f.family.toLowerCase().includes(needle) ||
    f.products.some(p => 
      p.name.toLowerCase().includes(needle)
    )
  );
}, [families, q]);
```

### 2. `src/components/admin/AdminSidebar.tsx`
**التغييرات:**
- إضافة `Layers` من lucide-react
- إضافة رابط `/admin/families` في قسم "Catalogue"

```typescript
{ to: "/admin/families", label: "Families", icon: Layers }
```

## كيفية الاستخدام

### للعملاء

#### 1. عرض العائلات (الوضع الجديد)
```
URL: /shop
- يتم عرض العائلات كبطاقات قابلة للتوسع
- كل بطاقة تحتوي على:
  - صورة العائلة
  - اسم العائلة
  - عدد المنتجات والعروض
  - نطاق الأسعار
  - المخزون الإجمالي
```

#### 2. توسع العائلة
```
- الضغط على بطاقة العائلة
- يتم عرض جميع المنتجات تحتها
- لكل منتج:
  - الاسم والوصف
  - التقييم والمبيعات
  - معاينة العروض (أول 3)
  - رابط لعرض جميع العروض
```

#### 3. التبديل إلى المنتجات الفردية
```
- الضغط على زر "المنتجات"
- يتم عرض جميع المنتجات كبطاقات فردية
- نفس الواجهة القديمة
```

### للمسؤول

#### 1. الذهاب إلى إدارة العائلات
```
URL: /admin/families
- عرض جميع العائلات
- كل عائلة تحتوي على:
  - صورة العائلة
  - اسم العائلة
  - عدد المنتجات والعروض
  - نطاق الأسعار
  - المخزون الإجمالي
```

#### 2. توسع العائلة
```
- الضغط على عائلة
- يتم عرض جميع المنتجات تحتها
- لكل منتج:
  - الاسم والوصف
  - رابط التعديل
  - جميع العروض المرتبطة
```

#### 3. تعديل العرض
```
- الضغط على أيقونة التعديل بجانب العرض
- يتم تحويل العرض إلى وضع التحرير
- يمكن تعديل:
  - المدة (Duration)
  - السعر بالدينار (Price DZD)
  - السعر بالدولار (Price USD)
  - المخزون (Stock)
  - المورد (Supplier)
- الضغط على "حفظ" لحفظ التغييرات
```

#### 4. حذف العرض
```
- الضغط على أيقونة الحذف
- تأكيد الحذف
- يتم حذف العرض من قاعدة البيانات
```

#### 5. إظهار/إخفاء العرض
```
- الضغط على أيقونة العين
- يتم تبديل حالة العرض (مفعل/معطل)
- العروض المعطلة لا تظهر للعملاء
```

## استيراد البيانات

### الخطوة 1: تحضير ملف CSV
```bash
# تأكد من أن ملف CSV يحتوي على الأعمدة التالية:
# العائلة, اسم المنتج, OFFERE, Account Type, Offer Type, Duration, Description, ...
```

### الخطوة 2: نسخ الملف
```bash
cp /path/to/prod_list_unified_updated-Products.csv DIGITMINE/public/
```

### الخطوة 3: تثبيت المتطلبات
```bash
cd DIGITMINE
npm install csv-parse
```

### الخطوة 4: تشغيل السكريبت
```bash
npx ts-node scripts/import-csv-data.ts
```

### الخطوة 5: التحقق
```bash
# الذهاب إلى /admin/families للتحقق من الاستيراد
# يجب أن ترى جميع العائلات والمنتجات والعروض
```

## نموذج البيانات

### جدول `products`
```sql
- id (UUID): معرف فريد
- name (TEXT): اسم المنتج (عادة = اسم العائلة)
- slug (TEXT): رابط فريد
- family (TEXT): اسم العائلة
- category_id (UUID): معرف الفئة
- short_description (TEXT): وصف قصير
- description (TEXT): وصف طويل
- main_image (TEXT): رابط الصورة
- visible (BOOLEAN): هل المنتج مرئي
- featured (BOOLEAN): هل المنتج مميز
- delivery_type (ENUM): نوع التسليم
- created_at (TIMESTAMP): تاريخ الإنشاء
- updated_at (TIMESTAMP): تاريخ التحديث
```

### جدول `product_offers`
```sql
- id (UUID): معرف فريد
- product_id (UUID): معرف المنتج
- name (TEXT): اسم العرض
- duration (TEXT): مدة الاشتراك (مثل "1 Month")
- price_dzd (NUMERIC): السعر بالدينار
- price_usd (NUMERIC): السعر بالدولار
- stock (INTEGER): عدد الوحدات المتاحة
- supplier (TEXT): مصدر العرض
- account_type (TEXT): نوع الحساب (Private/Shared/Family)
- offer_type (TEXT): نوع العرض (Premium/Pro/Standard/etc)
- delivery_method (TEXT): طريقة التسليم
- warranty (TEXT): الضمان
- product_url (TEXT): رابط المنتج
- active (BOOLEAN): هل العرض مفعل
- sort_order (INTEGER): ترتيب العرض
- created_at (TIMESTAMP): تاريخ الإنشاء
```

## الواجهات البرمجية (APIs)

### جلب جميع العائلات
```typescript
import { useFamilyCatalog } from "@/lib/family-catalog-data";

const { data: families, isLoading } = useFamilyCatalog();

// families: ProductFamily[]
// ProductFamily = {
//   family: string;
//   products: CatalogProduct[];
//   minPrice: number | null;
//   maxPrice: number | null;
//   totalStock: number;
//   image: string | null;
// }
```

### جلب عائلة محددة
```typescript
import { useFamily } from "@/lib/family-catalog-data";

const { data: family } = useFamily("Netflix");

// family: ProductFamily | null
```

## الأداء والتحسينات

### تحسينات الأداء
- استخدام `useMemo` لتجنب إعادة الحسابات غير الضرورية
- تجميع البيانات على جانب العميل بدلاً من الخادم
- استخدام `useQuery` مع React Query للتخزين المؤقت

### التحسينات المستقبلية
- إضافة pagination للعائلات الكبيرة
- تحسين البحث باستخدام Elasticsearch
- إضافة sorting متقدم
- تصدير البيانات إلى CSV/Excel

## استكشاف الأخطاء

### المشكلة: العائلات لا تظهر في المتجر
**الحل:**
1. تأكد من تشغيل `useFamilyCatalog()` بشكل صحيح
2. تحقق من أن البيانات موجودة في قاعدة البيانات
3. تحقق من أن `visible = true` للمنتجات

### المشكلة: العروض لا تظهر عند التوسع
**الحل:**
1. تأكد من أن `product_offers` موجودة في قاعدة البيانات
2. تحقق من أن `active = true` للعروض
3. تحقق من أن `stock > 0`

### المشكلة: لا يمكن تعديل العروض
**الحل:**
1. تأكد من أنك مسؤول
2. تحقق من أن لديك صلاحيات الكتابة على الجدول
3. تحقق من رسائل الخطأ في وحدة التحكم

## الدعم

للأسئلة أو المشاكل، يرجى:
1. التحقق من الوثائق
2. البحث عن المشكلة في GitHub Issues
3. فتح issue جديد مع وصف المشكلة
