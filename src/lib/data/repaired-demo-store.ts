import "server-only";
import { randomUUID } from "node:crypto";
import type { Identity, UserRecord } from "@/domain/models";
import { generateAccessCode, hashSecret, mutateDemoDatabase } from "@/lib/demo/demo-db";
import { assertAllowed, AppError } from "./errors";
import type { CreatedAccessCode, CreateUserInput } from "./contracts";
import { DemoStore } from "./demo-store";

export class RepairedDemoStore extends DemoStore {
  override async createStudent(identity: Identity, input: CreateUserInput): Promise<CreatedAccessCode> {
    assertAllowed(identity.role === "admin" && identity.status === "active", "إنشاء حساب الطالب من صلاحيات الإدارة فقط");
    assertAllowed(!input.groupId, "إنشاء الحساب منفصل عن التسجيل في المجموعات");

    return mutateDemoDatabase((db) => {
      const existing = db.users.find((user) => user.id === input.creationRequestId);
      if (existing) {
        assertAllowed(existing.role === "student" && existing.createdBy === identity.userId);
        assertAllowed(existing.displayName === input.displayName.trim(), "طلب إنشاء الحساب لا يطابق المحاولة السابقة");
        db.credentials
          .filter((credential) => credential.userId === existing.id && credential.state !== "disabled")
          .forEach((credential) => { credential.state = "disabled"; });

        let generated = generateAccessCode();
        for (let attempt = 0; attempt < 6; attempt += 1) {
          if (!db.credentials.some((credential) => credential.publicRef === generated.publicRef)) break;
          generated = generateAccessCode();
        }
        if (db.credentials.some((credential) => credential.publicRef === generated.publicRef)) {
          throw new AppError("تعذر إصدار رمز دخول فريد", "ACCESS_CODE_COLLISION", 409);
        }
        db.credentials.push({
          id: randomUUID(), userId: existing.id, publicRef: generated.publicRef,
          secretHash: hashSecret(generated.secret), codeHint: `BSR-${generated.publicRef}-••••••••`,
          state: "unused", issuedBy: identity.userId, createdAt: new Date().toISOString(),
        });
        existing.sessionInvalidBefore = new Date().toISOString();
        return { user: existing, code: generated.code };
      }

      let generated = generateAccessCode();
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (!db.credentials.some((credential) => credential.publicRef === generated.publicRef)) break;
        generated = generateAccessCode();
      }
      if (db.credentials.some((credential) => credential.publicRef === generated.publicRef)) {
        throw new AppError("تعذر إصدار رمز دخول فريد", "ACCESS_CODE_COLLISION", 409);
      }

      const createdAt = new Date().toISOString();
      const user: UserRecord = {
        id: input.creationRequestId,
        displayName: input.displayName.trim(),
        role: "student",
        status: "active",
        createdBy: identity.userId,
        sessionInvalidBefore: createdAt,
        createdAt,
      };
      db.users.push(user);
      db.credentials.push({
        id: randomUUID(), userId: user.id, publicRef: generated.publicRef,
        secretHash: hashSecret(generated.secret), codeHint: `BSR-${generated.publicRef}-••••••••`,
        state: "unused", issuedBy: identity.userId, createdAt,
      });

      // No group membership is created here. Enrollment is a separate action.
      return { user, code: generated.code };
    });
  }
}
