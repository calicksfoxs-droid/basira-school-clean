import { disableUserAction, resetAccessCodeAction } from "@/actions/accounts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UserRecord } from "@/domain/models";
import { formatDate, roleLabel } from "@/lib/utils";
import { requireIdentity } from "@/lib/auth";

const UserRole = {
  Admin: "admin",
} as const;

export async function UserTable({ users, returnTo }: { users: UserRecord[]; returnTo: string }) {
  const currentUser = await requireIdentity();
  const canManageCredentials = currentUser.role === UserRole.Admin;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] card-shadow">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-right text-sm">
          <thead className="bg-[var(--soft)] text-xs text-[var(--muted)]">
            <tr>
              <th className="p-4">الاسم</th>
              <th className="p-4">الدور</th>
              <th className="p-4">الحالة</th>
              <th className="p-4">تاريخ الإنشاء</th>
              <th className="p-4">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {users.map((user) => {
              const showDisableButton = canManageCredentials && user.status === "active";
              const showResetButton = canManageCredentials;

              return (
                <tr key={user.id}>
                  <td className="p-4 font-bold text-[var(--text)]">{user.displayName}</td>
                  <td className="p-4 text-[var(--text)]">{roleLabel(user.role)}</td>
                  <td className="p-4">
                    <Badge tone={user.status === "active" ? "success" : "danger"}>
                      {user.status === "active" ? "نشط" : "معطل"}
                    </Badge>
                  </td>
                  <td className="p-4 text-[var(--muted)]">{formatDate(user.createdAt)}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      {showResetButton && (
                        <form action={resetAccessCodeAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <Button variant="secondary" size="sm">
                            إعادة الرمز
                          </Button>
                        </form>
                      )}
                      {showDisableButton && (
                        <form action={disableUserAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="returnTo" value={returnTo} />
                          <Button variant="danger" size="sm">
                            تعطيل
                          </Button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
