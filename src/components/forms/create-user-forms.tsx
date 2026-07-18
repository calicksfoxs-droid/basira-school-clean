import { createStudentAction, createTeacherAction } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Group } from "@/domain/models";

export function CreateTeacherForm({ returnTo }: { returnTo: string }) { return <form action={createTeacherAction} className="grid gap-5"><input type="hidden" name="returnTo" value={returnTo}/><Field label="اسم المعلم"><Input name="displayName" required placeholder="مثال: أ. أحمد علي"/></Field><Button>إنشاء الحساب وإصدار الرمز</Button></form>; }

export function CreateStudentForm({ groups, returnTo, fixedGroupId }: { groups: Group[]; returnTo: string; fixedGroupId?: string }) { return <form action={createStudentAction} className="grid gap-5"><input type="hidden" name="returnTo" value={returnTo}/><Field label="اسم الطالب"><Input name="displayName" required/></Field>{fixedGroupId ? <input type="hidden" name="groupId" value={fixedGroupId}/> : <Field label="المجموعة"><Select name="groupId" required defaultValue=""><option value="" disabled>اختر المجموعة</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></Field>}<div className="grid gap-4 sm:grid-cols-2"><Field label="رقم التواصل" hint="خاص بالمعلم والإدارة"><Input name="contactNumber" dir="ltr"/></Field><Field label="المبلغ / الحالة" hint="ملاحظة داخلية فقط"><Input name="amountNote"/></Field></div><Field label="ملاحظة خاصة"><Textarea name="paymentNote"/></Field><Button>إنشاء الطالب وإصدار الرمز</Button></form>; }
