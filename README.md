# بصيرة — منصة تعليمية عربية

منتج تعليمي عربي خفيف للمدير والمعلمين المستقلين والطلاب. ينشئ كل معلم مواده ومجموعاته، ويسجّل الطالب في المجموعة المناسبة بمعرّف انضمام منفصل عن رمز الدخول. لا يرى الطالب إلا المواد والمجموعات التي سُجّل فيها.

## ما الذي يعمل؟

- لوحات مستقلة للمدير والمعلم والطالب، بواجهة RTL متجاوبة وثيم فاتح/داكن.
- المادة هي الجذر، وتحتها مجموعات ووحدات ودروس مرتبة.
- إعلان بصري داخل المادة، وحالات مسودة/منشور مع شروط نشر تمنع المحتوى الفارغ.
- محرر درس يدعم فيديو MP4/WebM وملزمة PDF ودرسًا مباشرًا أو أجزاء.
- اختبارات اختيار من متعدد، صح/خطأ، مقالي نصي وملف، مع تصحيح آلي ويدوي.
- رحلة تعلم للطالب، فتح تدريجي للدروس، وتسجيل تقدم حقيقي.
- رموز دخول مغلقة، ومعرّف انضمام مستقل لا يُخزّن كاملًا.
- كشف رمز الدخول الجديد مرة واحدة فقط داخل cookie مشفّر و`no-store`.
- Demo محلي دائم للاختبار السريع، وSupabase/PostgreSQL للإنتاج مع RLS وStorage خاص.

## التشغيل المحلي

المتطلبات: Node.js 20 أو أحدث.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run reset:demo
npm run dev
```

افتح `http://localhost:3000/login`.

رموز العرض المحلية:

```text
المدير:  BSR-ADMN-DEMO2026
المعلم:  BSR-TCHR-DEMO2026
الطالب:  BSR-STDN-DEMO2026
```

لإعادة بيانات العرض:

```powershell
npm run reset:demo
```

## التحقق

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run verify:static
npm run build
```

أو البوابة الكاملة:

```powershell
npm run verify:release
```

آخر نتيجة مثبتة: ESLint ناجح، TypeScript ناجح، Vitest ‏76/76، Playwright ‏35 ناجحًا وواحد تخطٍ مقصود، والتحقق الثابت وبناء Next.js وبناء Cloudflare Workers ناجحة.

نسخة الإنتاج الأساسية: `https://basira-school-clean.calicksfoxs.workers.dev`

## إعداد الإنتاج على Supabase

1. أنشئ مشروع staging منفصلًا.
2. انسخ `.env.example` إلى ملف بيئة سري، واضبط `BASIRA_BACKEND=supabase`.
3. أنشئ `BASIRA_APP_SECRET` عشوائيًا بطول 32 حرفًا على الأقل؛ التطبيق يرفض القيمة الافتراضية في الإنتاج.
4. طبّق جميع الملفات داخل `supabase/migrations` بالترتيب.
5. أنشئ المدير الأول:

```powershell
npm run seed:supabase
```

لا ترفع `.env.local` أو Service Role Key أو أي رمز دخول كامل إلى Git.

## البنية

```text
src/app              الصفحات وواجهات API
src/actions          عمليات الخادم
src/components       الواجهة ومكوّنات المنتج
src/domain           النماذج وقواعد التحقق والتصحيح
src/lib/core         المواد المستقلة والمجموعات والرحلة والتفضيلات
src/lib/data         المحتوى والاختبارات وموصلا Demo/Supabase
supabase/migrations  PostgreSQL وRLS وStorage والتقدم
test/e2e             اختبارات المتصفح Desktop/Mobile
```

راجع [تقرير الاختبارات](docs/TEST_REPORT.md)، [الأمان](docs/SECURITY.md)، [النشر](docs/DEPLOYMENT.md)، و[تقرير التنفيذ النهائي](docs/FINAL_IMPLEMENTATION_REPORT.md).
