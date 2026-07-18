export class AppError extends Error {
  constructor(message: string, public readonly code: string, public readonly status = 400) {
    super(message);
  }
}

export function assertFound<T>(value: T | undefined | null, message = "العنصر غير موجود"): T {
  if (!value) throw new AppError(message, "NOT_FOUND", 404);
  return value;
}

export function assertAllowed(condition: unknown, message = "ليس لديك صلاحية"): asserts condition {
  if (!condition) throw new AppError(message, "FORBIDDEN", 403);
}
