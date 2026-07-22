# تسليم بصيرة النهائي

المشروع القابل للتشغيل موجود في `C:\Basira\BASIRA_SCHOOL_CLEAN_COMPLETE`.

تم تسليم واجهة عربية نهائية، أدوار المدير/المعلم/الطالب، مواد مستقلة، مجموعات خاصة بكل مادة، وحدات ودروس ومحتوى واختبارات، رحلة تعلم وتقدم، إعدادات وثيمات، وطبقة أمان محسّنة لرموز الدخول والانضمام.

## التشغيل

```powershell
npm ci
Copy-Item .env.example .env.local
npm run reset:demo
npm run dev
```

افتح `http://localhost:3000/login`.

## قبل النشر الحقيقي

- استخدم Supabase staging.
- طبّق migrations ‏001 إلى 004 بالترتيب.
- اضبط سرًا عشوائيًا قويًا وبيانات Supabase على الخادم فقط.
- نفّذ RLS/Storage smoke test ثم انشر نفس commit.

نتائج التحقق الدقيقة موجودة في `docs/TEST_REPORT.md`.
