import { ShieldCheck, WalletCards } from "lucide-react";
import { saveTeacherFinanceRecordAction } from "@/actions/teacher-private-records";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function TeacherFinanceNoteEditor({
  groupId,
  studentId,
  amountNote,
  paymentNote,
  returnTo = "/app/teacher/students",
}: {
  teacherId?: string;
  groupId: string;
  studentId: string;
  amountNote?: string;
  paymentNote?: string;
  returnTo?: string;
}) {
  return <form action={saveTeacherFinanceRecordAction} className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 p-3" data-testid="teacher-db-finance">
    <input type="hidden" name="groupId" value={groupId}/>
    <input type="hidden" name="studentId" value={studentId}/>
    <input type="hidden" name="returnTo" value={returnTo}/>
    <div className="mb-3 flex items-center justify-between gap-3 text-xs font-bold text-amber-900">
      <span className="inline-flex items-center gap-1.5"><WalletCards className="size-4"/> متابعة مالية خاصة</span>
      <span className="inline-flex items-center gap-1 text-[11px]"><ShieldCheck className="size-3.5"/> مرئية للمعلم فقط</span>
    </div>
    <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
      <Input name="amountNote" defaultValue={amountNote ?? ""} maxLength={80} placeholder="المبلغ / الحالة" aria-label="المبلغ أو الحالة المالية الخاصة"/>
      <Textarea name="paymentNote" defaultValue={paymentNote ?? ""} maxLength={300} placeholder="ملاحظة مالية خاصة" aria-label="الملاحظة المالية الخاصة" className="min-h-11"/>
      <Button type="submit" size="sm" variant="secondary">حفظ خاص</Button>
    </div>
  </form>;
}
