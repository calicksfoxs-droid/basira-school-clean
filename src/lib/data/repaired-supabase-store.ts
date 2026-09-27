import "server-only";
import type { Asset, Identity } from "@/domain/models";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateAccessCode } from "@/lib/demo/demo-db";
import { assertAllowed, AppError } from "./errors";
import type { AttachAssetInput, CreatedAccessCode, CreateUserInput } from "./contracts";
import { SupabaseStore } from "./supabase-store";

type StudentIdentityCreationState = "prepared" | "complete" | "cleanup_pending" | "cleaned";

type StudentIdentityCreationOperation = {
  requestId: string;
  actorId: string;
  authUserId: string;
  displayName: string;
  publicRef: string;
  syntheticEmail: string;
  state: StudentIdentityCreationState;
  cleanupError?: string;
};

type Row = Record<string, unknown>;

function operationFrom(row: Row): StudentIdentityCreationOperation {
  return {
    requestId: String(row.request_id),
    actorId: String(row.actor_id),
    authUserId: String(row.auth_user_id),
    displayName: String(row.display_name),
    publicRef: String(row.public_account_ref),
    syntheticEmail: String(row.synthetic_email),
    state: String(row.state) as StudentIdentityCreationState,
    cleanupError: row.cleanup_error ? String(row.cleanup_error) : undefined,
  };
}

function assetFromRow(row: Row): Asset {
  return {
    id: String(row.id),
    kind: String(row.kind) as Asset["kind"],
    lessonId: row.lesson_id ? String(row.lesson_id) : undefined,
    lessonPartId: row.lesson_part_id ? String(row.lesson_part_id) : undefined,
    submissionId: row.submission_id ? String(row.submission_id) : undefined,
    ownerStudentId: row.owner_student_id ? String(row.owner_student_id) : undefined,
    title: String(row.title),
    storagePath: String(row.storage_path),
    originalFilename: String(row.original_filename),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    state: String(row.state) as Asset["state"],
    createdAt: String(row.created_at),
  };
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function isAuthUserNotFound(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; code?: unknown };
  return candidate.status === 404 || candidate.code === "user_not_found";
}

function isDefiniteAuthCreateFailure(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const status = Number((error as { status?: unknown }).status);
  return Number.isInteger(status) && status >= 400 && status < 500 && status !== 408;
}

/**
 * Repair-line account/content adapter.
 *
 * Student identity is platform-owned. Admin creates the login identity only;
 * teachers later enroll that identity into Learning Core groups using the
 * student's private enrollment reference. Lesson asset finalization is also
 * routed through the retry-safe v2 database primitive.
 */
export class RepairedSupabaseStore extends SupabaseStore {
  private repairAdmin() { return createAdminSupabaseClient(); }

  override async attachAsset(identity: Identity, input: AttachAssetInput): Promise<Asset> {
    assertAllowed(identity.role === "teacher" && identity.status === "active");
    assertAllowed(input.kind === "video" || input.kind === "handout", "Core 1.0 يدعم فيديو MP4/WebM وملزمة PDF فقط");
    assertAllowed(
      (input.kind === "video" && (input.mimeType === "video/mp4" || input.mimeType === "video/webm")) ||
      (input.kind === "handout" && input.mimeType === "application/pdf"),
      "نوع الملف غير مدعوم في Core 1.0",
    );

    const storageProvider = input.storageProvider ?? "supabase";
    assertAllowed(storageProvider === "demo" || storageProvider === "supabase" || storageProvider === "r2");
    assertAllowed(input.kind !== "handout" || storageProvider !== "r2", "R2 للملزمات غير مفعل في Core 1.0");

    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("finalize_lesson_asset_v2", {
      p_kind: input.kind,
      p_lesson_id: input.lessonId ?? null,
      p_lesson_part_id: input.lessonPartId ?? null,
      p_title: input.title,
      p_storage_provider: storageProvider,
      p_storage_path: input.storagePath,
      p_original_filename: input.originalFilename,
      p_mime_type: input.mimeType,
      p_size_bytes: input.sizeBytes,
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new AppError("تعذر اعتماد الملف", "ASSET_FINALIZE_FAILED");
    return assetFromRow(row as Row);
  }

  private async findStudentIdentityOperation(
    identity: Identity,
    requestId: string,
  ): Promise<StudentIdentityCreationOperation | null> {
    const { data, error } = await this.repairAdmin()
      .rpc("get_student_identity_creation_operation_v2", {
        p_request_id: requestId,
        p_actor_id: identity.userId,
      })
      .maybeSingle();
    if (error) throw error;
    return data ? operationFrom(data as Row) : null;
  }

  private async prepareStudentIdentityOperation(
    identity: Identity,
    input: CreateUserInput,
  ): Promise<StudentIdentityCreationOperation> {
    const admin = this.repairAdmin();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const publicRef = generateAccessCode().publicRef;
      const { data, error } = await admin
        .rpc("prepare_student_identity_creation_v2", {
          p_request_id: input.creationRequestId,
          p_actor_id: identity.userId,
          p_display_name: input.displayName.trim(),
          p_public_account_ref: publicRef,
        })
        .single();
      if (!error && data) return operationFrom(data as Row);
      if (!isUniqueViolation(error)) throw error ?? new Error("تعذر تجهيز إنشاء حساب الطالب");
    }
    throw new AppError("تعذر حجز رمز دخول فريد. حاول مرة أخرى.", "ACCESS_CODE_COLLISION", 409);
  }

  private async setStudentIdentityCleanup(
    identity: Identity,
    operation: StudentIdentityCreationOperation,
    state: "cleaned" | "cleanup_pending",
    errorMessage?: string,
  ) {
    const { error } = await this.repairAdmin()
      .rpc("set_student_identity_creation_cleanup_v2", {
        p_request_id: operation.requestId,
        p_actor_id: identity.userId,
        p_state: state,
        p_error: errorMessage ?? null,
      })
      .single();
    if (error) console.error("Student identity cleanup state update failed", error.message);
  }

  private async inspectStudentAuth(operation: StudentIdentityCreationOperation) {
    try {
      const { data, error } = await this.repairAdmin().auth.admin.getUserById(operation.authUserId);
      if (error) {
        if (isAuthUserNotFound(error)) return { status: "absent" as const };
        return { status: "ambiguous" as const, error };
      }
      if (!data.user) return { status: "ambiguous" as const, error: new Error("Auth lookup returned no user") };
      const marker = data.user.app_metadata?.basira_student_identity_request_v2;
      if (
        data.user.id !== operation.authUserId ||
        data.user.email !== operation.syntheticEmail ||
        marker !== operation.requestId
      ) {
        return { status: "ambiguous" as const, error: new Error("Auth user does not match student identity operation") };
      }
      return { status: "present" as const, user: data.user };
    } catch (error) {
      return { status: "ambiguous" as const, error };
    }
  }

  private async compensateStudentAuth(
    identity: Identity,
    operation: StudentIdentityCreationOperation,
    reason: string,
  ): Promise<"clean" | "pending"> {
    let deleteError: unknown;
    try {
      const result = await this.repairAdmin().auth.admin.deleteUser(operation.authUserId);
      deleteError = result.error;
    } catch (error) {
      deleteError = error;
    }

    if (!deleteError) {
      await this.setStudentIdentityCleanup(identity, operation, "cleaned");
      return "clean";
    }

    const observed = await this.inspectStudentAuth(operation);
    if (observed.status === "absent") {
      await this.setStudentIdentityCleanup(identity, operation, "cleaned");
      return "clean";
    }

    const detail = observed.status === "ambiguous"
      ? `${reason}; delete=${String(deleteError)}; reconcile=${String(observed.error)}`
      : `${reason}; delete=${String(deleteError)}; auth-user-still-present`;
    await this.setStudentIdentityCleanup(identity, operation, "cleanup_pending", detail);
    return "pending";
  }

  private async provisionStudentIdentity(
    identity: Identity,
    operation: StudentIdentityCreationOperation,
  ): Promise<StudentIdentityCreationOperation> {
    let result;
    try {
      result = await this.repairAdmin()
        .rpc("provision_student_identity_v2", {
          p_request_id: operation.requestId,
          p_actor_id: identity.userId,
        })
        .single();
    } catch (error) {
      result = { data: null, error };
    }

    if (!result.error && result.data) {
      return operationFrom({
        ...(result.data as Row),
        actor_id: identity.userId,
        cleanup_error: null,
      });
    }

    const observed = await this.findStudentIdentityOperation(identity, operation.requestId);
    if (observed?.state === "complete") return observed;
    if (!observed || observed.state !== "prepared") {
      throw new AppError(
        "حالة إنشاء حساب الطالب تحتاج مراجعة قبل إعادة المحاولة.",
        "ACCOUNT_CREATION_RECOVERY_PENDING",
        503,
      );
    }

    const cleanup = await this.compensateStudentAuth(
      identity,
      observed,
      result.error instanceof Error ? result.error.message : "student identity database provisioning failed",
    );
    if (cleanup === "pending") {
      throw new AppError(
        "فشل إنشاء الحساب وتعذر تأكيد تنظيف مستخدم Auth. لم يتم كشف رمز الدخول.",
        "ACCOUNT_CREATION_RECOVERY_PENDING",
        503,
      );
    }
    throw result.error ?? new Error("تعذر إكمال إنشاء حساب الطالب");
  }

  override async createStudent(identity: Identity, input: CreateUserInput): Promise<CreatedAccessCode> {
    assertAllowed(identity.role === "admin" && identity.status === "active", "إنشاء حساب الطالب من صلاحيات الإدارة فقط");
    assertAllowed(!input.groupId, "إنشاء الحساب منفصل عن التسجيل في المجموعات");

    let operation = await this.findStudentIdentityOperation(identity, input.creationRequestId);
    if (operation) {
      assertAllowed(operation.actorId === identity.userId);
      assertAllowed(operation.displayName === input.displayName.trim(), "طلب إنشاء الحساب لا يطابق المحاولة السابقة");
    } else {
      operation = await this.prepareStudentIdentityOperation(identity, input);
    }

    if (operation.state === "complete") {
      return this.resetAccessCode(identity, operation.authUserId);
    }

    if (operation.state === "cleanup_pending") {
      const cleanup = await this.compensateStudentAuth(identity, operation, "retry cleanup");
      if (cleanup === "pending") {
        throw new AppError(
          "تعذر تأكيد تنظيف محاولة سابقة. لم يتم إصدار رمز دخول جديد.",
          "ACCOUNT_CREATION_RECOVERY_PENDING",
          503,
        );
      }
      operation = await this.prepareStudentIdentityOperation(identity, input);
    }

    if (operation.state !== "prepared") {
      throw new AppError("تعذر بدء إنشاء الحساب من الحالة الحالية.", "ACCOUNT_CREATION_RECOVERY_PENDING", 503);
    }

    const beforeCreate = await this.inspectStudentAuth(operation);
    if (beforeCreate.status === "ambiguous") {
      throw new AppError(
        "تعذر تأكيد حالة مستخدم Auth لمحاولة الإنشاء الحالية.",
        "ACCOUNT_CREATION_RECONCILIATION_PENDING",
        503,
      );
    }

    const secret = generateAccessCode().secret;
    let directAuthSuccess = false;

    if (beforeCreate.status === "absent") {
      let createResult: Awaited<ReturnType<ReturnType<typeof createAdminSupabaseClient>["auth"]["admin"]["createUser"]>> | undefined;
      let createThrown: unknown;
      try {
        createResult = await this.repairAdmin().auth.admin.createUser({
          id: operation.authUserId,
          email: operation.syntheticEmail,
          password: secret,
          email_confirm: true,
          user_metadata: { display_name: operation.displayName },
          app_metadata: {
            basira_student_identity_request_v2: operation.requestId,
            basira_target_role: "student",
          },
        });
      } catch (error) {
        createThrown = error;
      }

      if (createResult && !createResult.error && createResult.data.user) {
        directAuthSuccess = createResult.data.user.id === operation.authUserId;
        if (!directAuthSuccess) {
          throw new AppError("Auth أعاد مستخدمًا غير متوقع.", "ACCOUNT_CREATION_RECONCILIATION_PENDING", 503);
        }
      } else {
        const afterCreate = await this.inspectStudentAuth(operation);
        if (afterCreate.status === "absent") {
          if (createResult?.error && isDefiniteAuthCreateFailure(createResult.error) && !createThrown) {
            await this.setStudentIdentityCleanup(identity, operation, "cleaned");
            throw createResult.error;
          }
          throw new AppError(
            "نتيجة إنشاء مستخدم Auth غير مؤكدة. أعد المحاولة بنفس الطلب.",
            "ACCOUNT_CREATION_RECONCILIATION_PENDING",
            503,
          );
        }
        if (afterCreate.status === "ambiguous") {
          throw new AppError(
            "نتيجة إنشاء مستخدم Auth غير مؤكدة. أعد المحاولة بنفس الطلب.",
            "ACCOUNT_CREATION_RECONCILIATION_PENDING",
            503,
          );
        }
      }
    }

    const provisioned = await this.provisionStudentIdentity(identity, operation);
    if (!directAuthSuccess) return this.resetAccessCode(identity, provisioned.authUserId);

    return {
      user: {
        id: provisioned.authUserId,
        displayName: provisioned.displayName,
        role: "student",
        status: "active",
        syntheticEmail: provisioned.syntheticEmail,
        createdBy: identity.userId,
        createdAt: new Date().toISOString(),
      },
      code: `BSR-${provisioned.publicRef}-${secret}`,
    };
  }
}
