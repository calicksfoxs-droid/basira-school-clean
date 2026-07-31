export interface TeacherFinanceNote {
  amount: string;
  note: string;
  updatedAt: string;
}

type TeacherFinanceDatabase = Record<string, TeacherFinanceNote>;

function storageKey(teacherId: string) {
  return `basira:teacher-finance:v1:${teacherId}`;
}

function recordKey(groupId: string, studentId: string) {
  return `${groupId}:${studentId}`;
}

function readDatabase(teacherId: string): TeacherFinanceDatabase {
  if (typeof window === "undefined") return {};
  try {
    const value = window.localStorage.getItem(storageKey(teacherId));
    if (!value) return {};
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as TeacherFinanceDatabase
      : {};
  } catch {
    return {};
  }
}

export function readTeacherFinanceNote(teacherId: string, groupId: string, studentId: string) {
  return readDatabase(teacherId)[recordKey(groupId, studentId)];
}

export function saveTeacherFinanceNote(
  teacherId: string,
  groupId: string,
  studentId: string,
  input: { amount: string; note: string },
) {
  if (typeof window === "undefined") return;
  const database = readDatabase(teacherId);
  const key = recordKey(groupId, studentId);
  const amount = input.amount.trim().slice(0, 80);
  const note = input.note.trim().slice(0, 300);
  if (!amount && !note) delete database[key];
  else database[key] = { amount, note, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(storageKey(teacherId), JSON.stringify(database));
}
