import { updatePlatformSettingsFormAction as updatePlatformSettingsAction, updateUserPreferencesFormAction as updateUserPreferencesAction } from "@/actions/learning-core";
import { EnrollmentReferenceCard } from "@/components/settings/enrollment-reference-card";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireIdentity } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export const metadata = { title: "الإعدادات" };

export default async function SettingsPage() {
  const identity = await requireIdentity();
  const store = getLearningCoreStore();
  const [settings, preferences, enrollment] = await Promise.all([
    store.getPlatformSettings(identity),
    store.getUserPreferences(identity),
    identity.role === "student" ? store.getOwnEnrollmentReference(identity) : Promise.resolve(undefined),
  ]);
  return <div className="grid gap-6"><PageHeader title="الإعدادات" description="اضبط تجربتك الشخصية، وإعدادات المنصة العامة إذا كنت مديرًا."/><div className="grid items-start gap-6 xl:grid-cols-2">
    <Card><CardTitle>تفضيلات العرض</CardTitle><CardDescription>تُطبّق على حسابك فقط.</CardDescription><form action={updateUserPreferencesAction} className="mt-5 grid gap-5"><Field label="السمة"><Select name="theme" defaultValue={preferences.theme}><option value="system">حسب الجهاز</option><option value="light">فاتح</option><option value="dark">داكن</option></Select></Field><label className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-[var(--border)] p-4"><span><strong className="block">تقليل الحركة</strong><small className="text-[var(--muted)]">يوقف الحركات غير الضرورية.</small></span><input type="checkbox" name="reducedMotion" value="true" defaultChecked={preferences.reducedMotion} className="size-5 accent-[#0f8b8d]"/></label><Button>حفظ تفضيلاتي</Button></form></Card>
    <Card><CardTitle>معلومات الحساب</CardTitle><CardDescription>بيانات تعريفية غير قابلة للتعديل من هذه الشاشة.</CardDescription><dl className="mt-5 grid gap-3 text-sm"><div className="flex justify-between rounded-xl bg-[var(--soft)] p-3"><dt className="text-[var(--muted)]">الاسم</dt><dd className="font-bold">{identity.displayName}</dd></div><div className="flex justify-between rounded-xl bg-[var(--soft)] p-3"><dt className="text-[var(--muted)]">الدور</dt><dd className="font-bold">{identity.role === "admin" ? "مدير" : identity.role === "teacher" ? "معلم" : "طالب"}</dd></div></dl></Card>
    {identity.role === "admin" && <Card className="xl:col-span-2"><CardTitle>إعدادات المنصة</CardTitle><CardDescription>تظهر لجميع المستخدمين بعد الحفظ.</CardDescription><form action={updatePlatformSettingsAction} className="mt-5 grid gap-4 md:grid-cols-2"><Field label="اسم المنصة"><Input name="platformName" required defaultValue={settings.platformName}/></Field><Field label="المنطقة الزمنية"><Input name="timezone" required dir="ltr" defaultValue={settings.timezone}/></Field><Field label="رسالة الصيانة"><Textarea name="maintenanceMessage" defaultValue={settings.maintenanceMessage} className="md:min-h-24"/></Field><div className="flex items-end"><Button className="w-full">حفظ إعدادات المنصة</Button></div></form></Card>}
    {enrollment && <EnrollmentReferenceCard initial={enrollment}/>} 
  </div></div>;
}
