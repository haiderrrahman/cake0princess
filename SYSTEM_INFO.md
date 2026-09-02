# ملف تعريف نظام "كيك الأميرة" (Princess Cake System)

هذا الملف يحتوي على تفاصيل النظام البرمجي، هيكليته، التقنيات المستخدمة، والمميزات الرئيسية، ليكون مرجعاً لأي ذكاء اصطناعي (AI) أو مطور يعمل على المشروع مستقبلاً.

## 1. نظرة عامة (Overview)
النظام هو تطبيق هجين (تطبيق ويب وتطبيق موبايل) متكامل لإدارة متجر "كيك الأميرة". يجمع بين منصة تجارة إلكترونية (E-commerce)، نظام إدارة المبيعات والطلبات (ERP مصغر)، نظام إدارة مالية ومصروفات (Finances & Expenses)، ومنصة لتقديم الدورات التدريبية (Courses).

## 2. التقنيات الأساسية (Tech Stack)
* **إطار العمل (Framework):** Next.js 14.2.3 (React 18) بميزة (App Router).
* **التصميم والواجهات (Styling):** Tailwind CSS 4، مع استخدام مكونات جاهزة مثل `lucide-react` للأيقونات، و `framer-motion` للحركات التفاعلية (Animations).
* **قاعدة البيانات والخدمات الخلفية (Backend & Database):** Firebase (Firestore, Storage, Authentication) مع استخدام `firebase-admin` للعمليات الخاصة بالآدمن (Server-side).
* **التطبيق المحمول (Mobile App):** Capacitor 8 (يُستخدم لتحويل تطبيق الويب إلى تطبيق Android محمول - `@capacitor/android`).
* **أدوات أخرى:** 
  * `recharts`: لإنشاء الرسوم البيانية والإحصائيات في لوحة التحكم.
  * `react-datepicker`: لاختيار التواريخ.
  * `jspdf` و `html-to-image`: لتوليد ملفات PDF وتصدير التقارير/الصور.

## 3. هيكلية المشروع (Project Structure)
التركيز الأساسي في مجلد `src/app` الذي يحتوي على صفحات النظام (بدون الاعتماد على مجلد pages القديم):

* **واجهة العميل (Customer Facing):**
  * `/shop`: عرض المنتجات والتسوق.
  * `/cart`, `/checkout`, `/orders`, `/track-order`: دورة حياة سلة المشتريات والدفع وتتبع الطلب.
  * `/courses`: عرض الدورات التدريبية المتاحة للاشتراك.
  * `/custom-design`: طلبات التصميم الخاص للكيك.
  * `/login`, `/profile`, `/settings`: إدارة حساب العميل.
  * `/offers`, `/competitions`: العروض والمسابقات.
  * `/supplies`: مستلزمات أو أدوات خاصة.

* **لوحة تحكم الإدارة (Admin Dashboard - `/admin`):**
  نظام إداري شامل ومتكامل يتضمن:
  * **المنتجات والطلبات:** `products`, `categories`, `orders`, `custom-orders`, `external-orders`.
  * **الإدارة المالية:** `finances`, `expenses` (المصروفات), `home-finance` (المالية المنزلية), `store-sales` (مبيعات المتجر).
  * **المخزون:** `inventory`, `supplies`.
  * **العملاء والمستخدمين:** `customers`, `users`.
  * **الدورات التدريبية:** `courses`.
  * **التسويق:** `ads`, `banners`, `offers`, `competitions`.
  * **المركز الموحد:** `hub` (قد يكون مركز تحكم شامل أو نظام إشعارات/تواصل).

## 4. إعدادات قاعدة البيانات (Firebase)
* ملف `firestore.rules` و `storage.rules`: يحتويان على قواعد الحماية (Security Rules).
* ملفات التكوين والاتصال في `src/lib/`:
  * `firebase.ts`: إعدادات Firebase للواجهة الأمامية (Client SDK).
  * `firebase-admin.ts`: إعدادات Firebase Admin (Server SDK) للعمليات الآمنة.

## 5. سكربتات الدعم والصيانة (Scripts)
البيئة مليئة بالسكربتات في الجذر لمعالجة وصيانة البيانات، مثل:
* فحص البيانات وتصحيحها: `check_db.js`, `check_expenses.js`, `check_installments.js`.
* إصلاحات الهيكلة المالية: `patch_finances.js`, `fix_home_finance.js`, `patch_repay.js`.
* زراعة بيانات تجريبية أو أولية (Seeding): `seed.js`, `seed_courses.js`, `seed_products.js`.

## 6. ملاحظات للتطوير (Development Notes)
* تشغيل البيئة محلياً: `npm run dev`.
* بناء التطبيق: `npm run build`.
* إدارة البيئة (Environment variables): يتم استخدام `.env`, `.env.local` مع توفر `.env.example` كنموذج للمفاتيح المطلوبة (مثل مفاتيح Firebase).
* النظام يعتمد بنسبة كبيرة على الـ Client-Side والـ Server-Side معاً في Next.js. عند التعديل، يجب الانتباه للتفريق بين أوامر `firebase` (العميل) و `firebase-admin` (السيرفر).

## 7. آلية العمل (Workflow for AI Agent)
عند طلب أي تعديل من الذكاء الاصطناعي:
1. يرجى توضيح ما إذا كان التعديل في **واجهة العميل** أم في **لوحة التحكم**.
2. في حال تعديل قواعد البيانات، يجب التأكد من تحديث `firestore.rules` إن لزم الأمر.
3. التعديلات الجمالية تعتمد بالكامل على `Tailwind CSS`.
4. أي ميزة جديدة تحتاج لحفظ بيانات يجب إضافتها عبر `src/lib/firebase.ts` أو استدعاءات API داخل `src/app`.
