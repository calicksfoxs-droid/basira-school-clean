# بصيرة المدرسة — Basira School Platform

منصة عربية خاصة وبسيطة للمدير والمعلم والطالب. تجمع الحسابات، المجموعات، المواد، الدروس، الفيديوهات، الملازم، الاختبارات والتصحيح داخل واجهات منفصلة حسب الدور.

## ما الذي يعمل؟

- دخول مغلق برمز `BSR-XXXX-XXXXXXXX`، بدون تسجيل عام.
- مدير: الحسابات، جميع المجموعات، نقل الملكية، الإعلانات والمتابعة.
- معلم: مجموعاته وطلابه ومواده ودروسه وملفاته واختباراته وتصحيحه فقط.
- طالب: المجموعات المسندة إليه، الدروس المنشورة، ملفاته، اختباراته ونتائجه فقط.
- فيديو MP4/WebM حقيقي، ملزمة PDF، وإجابة ملف/صورة.
- MCQ وصح/خطأ بتصحيح تلقائي، ومقالي نص/ملف بتصحيح يدوي.
- إجابات الاختبار الصحيحة معزولة ولا تظهر للطالب إلا بعد إصدار النتيجة.
- إعلان دوّار كل خمس ثوانٍ مع تحكم يدوي ودعم reduced motion.
- Demo backend محلي فوري، وSupabase backend للإنتاج مع Auth/Storage/RLS.

## تشغيل العرض المحلي

المتطلبات: Node.js 20 أو أحدث.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run reset:demo
npm run dev
```

افتح: `http://localhost:3000/login`

رموز العرض:

```text
المدير:  BSR-ADMN-DEMO2026
المعلم:  BSR-TCHR-DEMO2026
الطالب:  BSR-STDN-DEMO2026
```

الـDemo يحفظ بياناته في `.data/`، ويمكن إعادته للحالة الأصلية عبر:

```powershell
npm run reset:demo
```

## الاختبارات

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run verify:static
npm run build
```

البوابة الكاملة:

```powershell
npm run verify:release
```

## إعداد Supabase

1. أنشئ مشروع Supabase منفصلًا للـstaging.
2. ضع قيم البيئة في `.env.local` أو Render Environment، ولا تلتزم بها في Git.
3. طبّق migration:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

4. أنشئ المدير الأول:

```powershell
npm run seed:supabase
```

لإعادة رمز المدير الموجود:

```powershell
npm run seed:supabase:reset-admin
```

الرمز الكامل يظهر مرة واحدة فقط. لا تحفظه في التقارير أو Git.

## نشر Render

- استخدم `render.yaml` أو أنشئ Web Service يدويًا.
- Build: `npm ci && npm run build`
- Start: `npm start`
- Health: `/api/health`
- اضبط `BASIRA_BACKEND=supabase` وقيم Supabase السرية على Render فقط.

التفاصيل: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

## بنية المشروع

```text
src/app              Next.js routes and API routes
src/actions          Server Actions
src/components       UI and domain components
src/domain           Models, schemas, grading rules
src/lib/auth         Demo/Supabase authentication
src/lib/data         Backend contract + demo/Supabase adapters
src/lib/supabase     SSR/admin/storage clients
supabase/migrations  Complete production schema + RLS + Storage
scripts              Seed/reset/release checks
```

راجع:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md)
