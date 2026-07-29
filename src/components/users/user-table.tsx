import type { UserRecord } from "@/domain/models";
import { requireIdentity } from "@/lib/auth";
import { UserTableClient } from "./user-table-client";

const UserRole = { Admin: "admin" } as const;

export async function UserTable({ users, returnTo }: { users: UserRecord[]; returnTo: string }) {
  const currentUser = await requireIdentity();
  return <UserTableClient users={users} returnTo={returnTo} canManageCredentials={currentUser.role === UserRole.Admin} />;
}
