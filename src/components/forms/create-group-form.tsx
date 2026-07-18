import { createGroupAction } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Identity, UserRecord } from "@/domain/models";

export function CreateGroupForm({ identity, teachers, returnTo }: { identity: Identity; teachers?: UserRecord[]; returnTo: string }) {
  return <form action={createGroupAction} className="grid gap-5"><input type="hidden" name="returnTo" value={returnTo}/><Field label="اسم المجموعة"><Input name="name" required placeholder="مثال: الصف الثالث — فيزياء"/></Field><Field label="وصف مختصر"><Textarea name="description" placeholder="معلومة قصيرة تساعدك على تمييز المجموعة"/></Field>{identity.role === "admin" && <Field label="المعلم المسؤول"><Select name="ownerTeacherId" required defaultValue=""><option value="" disabled>اختر المعلم</option>{teachers?.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.displayName}</option>)}</Select></Field>}<Button>إنشاء المجموعة</Button></form>;
}
