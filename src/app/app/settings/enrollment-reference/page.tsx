import { EnrollmentReferenceCard } from "@/components/settings/enrollment-reference-card";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth";
import { getLearningCoreStore } from "@/lib/core";

export default async function EnrollmentReferencePage() {
  const identity = await requireRole("student");
  const reference = await getLearningCoreStore().getOwnEnrollmentReference(identity);
  return <div className="grid gap-6">
    <PageHeader title="حسابي" description="إدارة معرّف الانضمام والتفضيلات الشخصية."/>
    <EnrollmentReferenceCard initial={reference}/>
    <Card>
      <CardTitle>إعدادات العرض</CardTitle>
      <CardDescription>يمكنك تعديل السمة وتقليل الحركة من صفحة الإعدادات.</CardDescription>
      <div className="mt-4"><LinkButton href="/app/settings" variant="secondary">فتح الإعدادات</LinkButton></div>
    </Card>
  </div>;
}
